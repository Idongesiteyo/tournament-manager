import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, ShieldAlert } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export default function AdminMatchInfoModal({ isOpen, onClose, matchId, homeTeam, awayTeam }) {
  const [info, setInfo] = useState({
    goals: [],
    assists: [],
    yellow_cards: [],
    red_cards: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [goalForm, setGoalForm] = useState({ player_name: "", team_name: homeTeam?.name || "", minute: "", is_penalty: false });
  const [assistForm, setAssistForm] = useState({ player_name: "", team_name: homeTeam?.name || "", minute: "" });
  const [yellowForm, setYellowForm] = useState({ player_name: "", team_name: homeTeam?.name || "", minute: "" });
  const [redForm, setRedForm] = useState({ player_name: "", team_name: homeTeam?.name || "", minute: "" });

  useEffect(() => {
    if (!isOpen || !matchId) return;
    
    const fetchInfo = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("match_info").select("*").eq("match_id", matchId).single();
      if (data) {
        setInfo({
          goals: data.goals || [],
          assists: data.assists || [],
          yellow_cards: data.yellow_cards || [],
          red_cards: data.red_cards || []
        });
      } else {
        // Reset if no data
        setInfo({ goals: [], assists: [], yellow_cards: [], red_cards: [] });
      }
      setLoading(false);
    };
    
    fetchInfo();
  }, [isOpen, matchId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    
    // Check if record exists
    const { data: existing } = await supabase.from("match_info").select("match_id").eq("match_id", matchId).single();
    
    let error;
    if (existing) {
      const res = await supabase.from("match_info").update(info).eq("match_id", matchId);
      error = res.error;
    } else {
      const res = await supabase.from("match_info").insert([{ match_id: matchId, ...info }]);
      error = res.error;
    }

    setSaving(false);
    if (error) {
      toast.error("Failed to save match info: " + error.message);
    } else {
      toast.success("Match info saved successfully!");
      onClose();
    }
  };

  const addEvent = (type, formState, setFormState, defaultTeam) => {
    if (!formState.player_name.trim()) {
      toast.error("Player name is required");
      return;
    }
    
    const newEvent = { ...formState, id: crypto.randomUUID() };
    if (newEvent.minute) newEvent.minute = parseInt(newEvent.minute, 10);
    
    setInfo(prev => ({ ...prev, [type]: [...prev[type], newEvent] }));
    
    // Reset form but keep team name
    if (type === 'goals') setFormState({ player_name: "", team_name: defaultTeam, minute: "", is_penalty: false });
    else setFormState({ player_name: "", team_name: defaultTeam, minute: "" });
  };

  const removeEvent = (type, id) => {
    setInfo(prev => ({ ...prev, [type]: prev[type].filter(e => e.id !== id) }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f1423] border border-white/10 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/20 shrink-0">
          <div>
            <h2 className="text-xl font-black text-white">Match Info</h2>
            <p className="text-sm text-slate-400">{homeTeam?.name} vs {awayTeam?.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
          {loading ? (
            <div className="text-center text-slate-400 py-10">Loading...</div>
          ) : (
            <>
              {/* GOALS */}
              <section className="space-y-4">
                <h3 className="font-bold text-emerald-400 text-lg border-b border-white/5 pb-2">Goals</h3>
                <div className="flex flex-wrap gap-3 items-end bg-black/20 p-4 rounded-lg border border-white/5">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Player</label>
                    <Input placeholder="Player Name" value={goalForm.player_name} onChange={e => setGoalForm({...goalForm, player_name: e.target.value})} className="h-9 bg-black/40" />
                  </div>
                  <div className="w-32">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Team</label>
                    <select className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-2 text-sm text-white" value={goalForm.team_name} onChange={e => setGoalForm({...goalForm, team_name: e.target.value})}>
                      <option value={homeTeam?.name}>{homeTeam?.short_name}</option>
                      <option value={awayTeam?.name}>{awayTeam?.short_name}</option>
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Min</label>
                    <Input type="number" placeholder="45" value={goalForm.minute} onChange={e => setGoalForm({...goalForm, minute: e.target.value})} className="h-9 bg-black/40" />
                  </div>
                  <div className="flex items-center gap-2 h-9 px-2">
                    <input type="checkbox" id="pen" checked={goalForm.is_penalty} onChange={e => setGoalForm({...goalForm, is_penalty: e.target.checked})} className="rounded bg-black border-white/20" />
                    <label htmlFor="pen" className="text-xs text-slate-300 cursor-pointer">Penalty</label>
                  </div>
                  <Button onClick={() => addEvent("goals", goalForm, setGoalForm, homeTeam?.name)} size="sm" className="h-9"><Plus className="w-4 h-4 mr-1" /> Add</Button>
                </div>
                {info.goals.map(g => (
                  <div key={g.id} className="flex items-center justify-between bg-white/[0.02] p-2 rounded border border-white/5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 w-8">{g.minute ? `${g.minute}'` : '-'}</span>
                      <span className="font-bold text-white">{g.player_name}</span>
                      <span className="text-slate-500 text-xs">({g.team_name})</span>
                      {g.is_penalty && <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-bold">⚽ Penalty</span>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeEvent("goals", g.id)} className="h-6 w-6 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </section>

              {/* ASSISTS */}
              <section className="space-y-4">
                <h3 className="font-bold text-blue-400 text-lg border-b border-white/5 pb-2">Assists</h3>
                <div className="flex flex-wrap gap-3 items-end bg-black/20 p-4 rounded-lg border border-white/5">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Player</label>
                    <Input placeholder="Player Name" value={assistForm.player_name} onChange={e => setAssistForm({...assistForm, player_name: e.target.value})} className="h-9 bg-black/40" />
                  </div>
                  <div className="w-32">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Team</label>
                    <select className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-2 text-sm text-white" value={assistForm.team_name} onChange={e => setAssistForm({...assistForm, team_name: e.target.value})}>
                      <option value={homeTeam?.name}>{homeTeam?.short_name}</option>
                      <option value={awayTeam?.name}>{awayTeam?.short_name}</option>
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Min</label>
                    <Input type="number" placeholder="45" value={assistForm.minute} onChange={e => setAssistForm({...assistForm, minute: e.target.value})} className="h-9 bg-black/40" />
                  </div>
                  <Button onClick={() => addEvent("assists", assistForm, setAssistForm, homeTeam?.name)} size="sm" className="h-9"><Plus className="w-4 h-4 mr-1" /> Add</Button>
                </div>
                {info.assists.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-white/[0.02] p-2 rounded border border-white/5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 w-8">{a.minute ? `${a.minute}'` : '-'}</span>
                      <span className="font-bold text-white">{a.player_name}</span>
                      <span className="text-slate-500 text-xs">({a.team_name})</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeEvent("assists", a.id)} className="h-6 w-6 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </section>

              {/* YELLOW CARDS */}
              <section className="space-y-4">
                <h3 className="font-bold text-yellow-400 text-lg border-b border-white/5 pb-2">Yellow Cards</h3>
                <div className="flex flex-wrap gap-3 items-end bg-black/20 p-4 rounded-lg border border-white/5">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Player</label>
                    <Input placeholder="Player Name" value={yellowForm.player_name} onChange={e => setYellowForm({...yellowForm, player_name: e.target.value})} className="h-9 bg-black/40" />
                  </div>
                  <div className="w-32">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Team</label>
                    <select className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-2 text-sm text-white" value={yellowForm.team_name} onChange={e => setYellowForm({...yellowForm, team_name: e.target.value})}>
                      <option value={homeTeam?.name}>{homeTeam?.short_name}</option>
                      <option value={awayTeam?.name}>{awayTeam?.short_name}</option>
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Min</label>
                    <Input type="number" placeholder="45" value={yellowForm.minute} onChange={e => setYellowForm({...yellowForm, minute: e.target.value})} className="h-9 bg-black/40" />
                  </div>
                  <Button onClick={() => addEvent("yellow_cards", yellowForm, setYellowForm, homeTeam?.name)} size="sm" className="h-9"><Plus className="w-4 h-4 mr-1" /> Add</Button>
                </div>
                {info.yellow_cards.map(y => (
                  <div key={y.id} className="flex items-center justify-between bg-white/[0.02] p-2 rounded border border-white/5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 w-8">{y.minute ? `${y.minute}'` : '-'}</span>
                      <span className="font-bold text-white">{y.player_name}</span>
                      <span className="text-slate-500 text-xs">({y.team_name})</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeEvent("yellow_cards", y.id)} className="h-6 w-6 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </section>

              {/* RED CARDS */}
              <section className="space-y-4">
                <h3 className="font-bold text-red-500 text-lg border-b border-white/5 pb-2">Red Cards</h3>
                <div className="flex flex-wrap gap-3 items-end bg-black/20 p-4 rounded-lg border border-white/5">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Player</label>
                    <Input placeholder="Player Name" value={redForm.player_name} onChange={e => setRedForm({...redForm, player_name: e.target.value})} className="h-9 bg-black/40" />
                  </div>
                  <div className="w-32">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Team</label>
                    <select className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-2 text-sm text-white" value={redForm.team_name} onChange={e => setRedForm({...redForm, team_name: e.target.value})}>
                      <option value={homeTeam?.name}>{homeTeam?.short_name}</option>
                      <option value={awayTeam?.name}>{awayTeam?.short_name}</option>
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Min</label>
                    <Input type="number" placeholder="45" value={redForm.minute} onChange={e => setRedForm({...redForm, minute: e.target.value})} className="h-9 bg-black/40" />
                  </div>
                  <Button onClick={() => addEvent("red_cards", redForm, setRedForm, homeTeam?.name)} size="sm" className="h-9"><Plus className="w-4 h-4 mr-1" /> Add</Button>
                </div>
                {info.red_cards.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-white/[0.02] p-2 rounded border border-white/5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 w-8">{r.minute ? `${r.minute}'` : '-'}</span>
                      <span className="font-bold text-white">{r.player_name}</span>
                      <span className="text-slate-500 text-xs">({r.team_name})</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeEvent("red_cards", r.id)} className="h-6 w-6 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 bg-black/40 flex justify-end shrink-0 gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? "Saving..." : "Save Match Info"}
          </Button>
        </div>
      </div>
    </div>
  );
}
