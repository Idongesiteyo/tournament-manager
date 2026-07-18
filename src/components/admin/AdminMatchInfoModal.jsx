import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, ShieldAlert } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const PlayerAutocomplete = ({ value, onChange, onSelectTeam, teamPlayers, placeholder, homeTeam, awayTeam }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const filtered = teamPlayers.filter(p => 
    p.name.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="relative">
      <Input 
        placeholder={placeholder} 
        value={value} 
        onChange={e => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        className="h-9 bg-black/40" 
      />
      {showSuggestions && value && filtered.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#1a2235] border border-white/10 rounded-md shadow-lg max-h-40 overflow-y-auto custom-scrollbar">
          {filtered.map(p => {
            const isHome = p.team_id === homeTeam?.id;
            const teamBadge = isHome ? homeTeam?.short_name : awayTeam?.short_name;
            const teamName = isHome ? homeTeam?.name : awayTeam?.name;

            return (
              <div 
                key={p.id} 
                className="px-3 py-2 text-sm hover:bg-white/10 cursor-pointer text-white flex justify-between items-center"
                onClick={() => {
                  onChange(p.name);
                  if (onSelectTeam) onSelectTeam(teamName);
                  setShowSuggestions(false);
                }}
              >
                <span>{p.name} <span className="text-xs text-slate-400">#{p.jersey_number}</span></span>
                <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-300">{teamBadge}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function AdminMatchInfoModal({ isOpen, onClose, matchId, homeTeam, awayTeam, onSaveSuccess, stage, status }) {
  const [info, setInfo] = useState({
    goals: [],
    assists: [],
    yellow_cards: [],
    red_cards: []
  });
  const [teamPlayers, setTeamPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Form states
  const [goalForm, setGoalForm] = useState({ player_name: "", team_name: homeTeam?.name || "", minute: "", is_penalty: false, is_own_goal: false });
  const [assistForm, setAssistForm] = useState({ player_name: "", team_name: homeTeam?.name || "", minute: "" });
  const [yellowForm, setYellowForm] = useState({ player_name: "", team_name: homeTeam?.name || "", minute: "" });
  const [redForm, setRedForm] = useState({ player_name: "", team_name: homeTeam?.name || "", minute: "" });
  const [penaltyShootoutForm, setPenaltyShootoutForm] = useState({ player_name: "", team_name: homeTeam?.name || "", is_penalty_shootout: true, shootout_result: "scored" });

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
        setInfo({ goals: [], assists: [], yellow_cards: [], red_cards: [] });
      }

      if (homeTeam?.id && awayTeam?.id) {
        const { data: players } = await supabase
          .from("players")
          .select("*")
          .in("team_id", [homeTeam.id, awayTeam.id]);
        if (players) setTeamPlayers(players);
      }

      setLoading(false);
    };
    
    fetchInfo();
  }, [isOpen, matchId, homeTeam, awayTeam]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    
    const { data: existing } = await supabase.from("match_info").select("match_id").eq("match_id", matchId).single();
    
    let error;
    if (existing) {
      const res = await supabase.from("match_info").update(info).eq("match_id", matchId);
      error = res.error;
    } else {
      const res = await supabase.from("match_info").insert([{ match_id: matchId, ...info }]);
      error = res.error;
    }

    if (!error) {
      // Automatically update the match scoreline based on the goals array
      const homeGoalsCount = info.goals.filter(g => 
        !g.is_penalty_shootout && (
          (g.team_name === homeTeam?.name && !g.is_own_goal) ||
          (g.team_name === awayTeam?.name && g.is_own_goal)
        )
      ).length;
      const awayGoalsCount = info.goals.filter(g => 
        !g.is_penalty_shootout && (
          (g.team_name === awayTeam?.name && !g.is_own_goal) ||
          (g.team_name === homeTeam?.name && g.is_own_goal)
        )
      ).length;
      
      await supabase.from("matches").update({
        home_score: homeGoalsCount,
        away_score: awayGoalsCount
      }).eq("id", matchId);
      
      if (onSaveSuccess) {
        onSaveSuccess(matchId, homeGoalsCount, awayGoalsCount);
      }
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
    
    if (editingEvent && editingEvent.type === type) {
      // Update existing
      setInfo(prev => ({
        ...prev,
        [type]: prev[type].map(e => e.id === editingEvent.id ? { ...e, ...formState, minute: formState.minute ? parseInt(formState.minute, 10) : "" } : e)
      }));
      setEditingEvent(null);
    } else {
      // Add new
      const newEvent = { ...formState, id: crypto.randomUUID() };
      if (newEvent.minute) newEvent.minute = parseInt(newEvent.minute, 10);
      setInfo(prev => ({ ...prev, [type]: [...prev[type], newEvent] }));
    }
    
    if (formState.is_penalty_shootout) {
      setFormState({ player_name: "", team_name: defaultTeam, is_penalty_shootout: true, shootout_result: "scored" });
    } else if (type === 'goals') {
      setFormState({ player_name: "", team_name: defaultTeam, minute: "", is_penalty: false, is_own_goal: false });
    } else if (type === 'penalty_shootout') {
      setFormState({ player_name: "", team_name: defaultTeam, is_penalty_shootout: true, shootout_result: "scored" });
    } else {
      setFormState({ player_name: "", team_name: defaultTeam, minute: "" });
    }
  };

  const startEditEvent = (type, event, setFormState) => {
    setEditingEvent({ type, id: event.id });
    setFormState({
      player_name: event.player_name,
      team_name: event.team_name,
      minute: event.minute || "",
      is_penalty: event.is_penalty || false,
      is_own_goal: event.is_own_goal || false,
      is_penalty_shootout: event.is_penalty_shootout || false,
      shootout_result: event.shootout_result || "scored"
    });
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
            <div className="text-center text-slate-400 py-10">Loading data...</div>
          ) : (
            <>
              {/* GOALS */}
              <section className="space-y-4">
                <h3 className="font-bold text-emerald-400 text-lg border-b border-white/5 pb-2">Goals</h3>
                <div className="flex flex-wrap gap-3 items-end bg-black/20 p-4 rounded-lg border border-white/5">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Player</label>
                    <PlayerAutocomplete 
                      placeholder="Type player name..."
                      value={goalForm.player_name}
                      onChange={val => setGoalForm({...goalForm, player_name: val})}
                      onSelectTeam={team => setGoalForm(prev => ({...prev, team_name: team}))}
                      teamPlayers={teamPlayers}
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                    />
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
                    <input type="checkbox" id="pen" checked={goalForm.is_penalty} onChange={e => setGoalForm({...goalForm, is_penalty: e.target.checked, is_own_goal: e.target.checked ? false : goalForm.is_own_goal})} className="rounded bg-black border-white/20" />
                    <label htmlFor="pen" className="text-xs text-slate-300 cursor-pointer">Penalty</label>
                  </div>
                  <div className="flex items-center gap-2 h-9 px-2">
                    <input type="checkbox" id="og" checked={goalForm.is_own_goal} onChange={e => setGoalForm({...goalForm, is_own_goal: e.target.checked, is_penalty: e.target.checked ? false : goalForm.is_penalty})} className="rounded bg-black border-white/20" />
                    <label htmlFor="og" className="text-xs text-slate-300 cursor-pointer">Own Goal</label>
                  </div>
                  <Button 
                    onClick={() => addEvent("goals", goalForm, setGoalForm, homeTeam?.name)} 
                    size="sm" 
                    className={`h-9 ${editingEvent?.type === 'goals' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  >
                    {editingEvent?.type === 'goals' ? 'Update' : <><Plus className="w-4 h-4 mr-1" /> Add</>}
                  </Button>
                  {editingEvent?.type === 'goals' && (
                    <Button variant="ghost" size="sm" onClick={() => { setEditingEvent(null); setGoalForm({ player_name: "", team_name: homeTeam?.name, minute: "", is_penalty: false, is_own_goal: false }); }} className="h-9">Cancel</Button>
                  )}
                </div>
                {info.goals.map(g => (
                  <div key={g.id} className="flex items-center justify-between bg-white/[0.02] p-2 rounded border border-white/5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 w-8">{g.minute ? `${g.minute}'` : '-'}</span>
                      <span className="font-bold text-white">{g.player_name}</span>
                      <span className="text-slate-500 text-xs">({g.team_name})</span>
                      {g.is_penalty && <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-bold">⚽ Penalty</span>}
                      {g.is_own_goal && <span className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded font-bold">⚽ OG</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEditEvent("goals", g, setGoalForm)} className="h-6 w-6 text-slate-500 hover:text-blue-400">✏️</Button>
                      <Button variant="ghost" size="icon" onClick={() => removeEvent("goals", g.id)} className="h-6 w-6 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </section>

              {/* ASSISTS */}
              <section className="space-y-4">
                <h3 className="font-bold text-blue-400 text-lg border-b border-white/5 pb-2">Assists</h3>
                <div className="flex flex-wrap gap-3 items-end bg-black/20 p-4 rounded-lg border border-white/5">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Player</label>
                    <PlayerAutocomplete 
                      placeholder="Type player name..."
                      value={assistForm.player_name}
                      onChange={val => setAssistForm({...assistForm, player_name: val})}
                      onSelectTeam={team => setAssistForm(prev => ({...prev, team_name: team}))}
                      teamPlayers={teamPlayers}
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                    />
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
                  <Button 
                    onClick={() => addEvent("assists", assistForm, setAssistForm, homeTeam?.name)} 
                    size="sm" 
                    className={`h-9 ${editingEvent?.type === 'assists' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  >
                    {editingEvent?.type === 'assists' ? 'Update' : <><Plus className="w-4 h-4 mr-1" /> Add</>}
                  </Button>
                  {editingEvent?.type === 'assists' && (
                    <Button variant="ghost" size="sm" onClick={() => { setEditingEvent(null); setAssistForm({ player_name: "", team_name: homeTeam?.name, minute: "" }); }} className="h-9">Cancel</Button>
                  )}
                </div>
                {info.assists.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-white/[0.02] p-2 rounded border border-white/5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 w-8">{a.minute ? `${a.minute}'` : '-'}</span>
                      <span className="font-bold text-white">{a.player_name}</span>
                      <span className="text-slate-500 text-xs">({a.team_name})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEditEvent("assists", a, setAssistForm)} className="h-6 w-6 text-slate-500 hover:text-blue-400">✏️</Button>
                      <Button variant="ghost" size="icon" onClick={() => removeEvent("assists", a.id)} className="h-6 w-6 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </section>

              {/* YELLOW CARDS */}
              <section className="space-y-4">
                <h3 className="font-bold text-yellow-400 text-lg border-b border-white/5 pb-2">Yellow Cards</h3>
                <div className="flex flex-wrap gap-3 items-end bg-black/20 p-4 rounded-lg border border-white/5">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Player</label>
                    <PlayerAutocomplete 
                      placeholder="Type player name..."
                      value={yellowForm.player_name}
                      onChange={val => setYellowForm({...yellowForm, player_name: val})}
                      onSelectTeam={team => setYellowForm(prev => ({...prev, team_name: team}))}
                      teamPlayers={teamPlayers}
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                    />
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
                  <Button 
                    onClick={() => addEvent("yellow_cards", yellowForm, setYellowForm, homeTeam?.name)} 
                    size="sm" 
                    className={`h-9 ${editingEvent?.type === 'yellow_cards' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  >
                    {editingEvent?.type === 'yellow_cards' ? 'Update' : <><Plus className="w-4 h-4 mr-1" /> Add</>}
                  </Button>
                  {editingEvent?.type === 'yellow_cards' && (
                    <Button variant="ghost" size="sm" onClick={() => { setEditingEvent(null); setYellowForm({ player_name: "", team_name: homeTeam?.name, minute: "" }); }} className="h-9">Cancel</Button>
                  )}
                </div>
                {info.yellow_cards.map(y => (
                  <div key={y.id} className="flex items-center justify-between bg-white/[0.02] p-2 rounded border border-white/5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 w-8">{y.minute ? `${y.minute}'` : '-'}</span>
                      <span className="font-bold text-white">{y.player_name}</span>
                      <span className="text-slate-500 text-xs">({y.team_name})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEditEvent("yellow_cards", y, setYellowForm)} className="h-6 w-6 text-slate-500 hover:text-blue-400">✏️</Button>
                      <Button variant="ghost" size="icon" onClick={() => removeEvent("yellow_cards", y.id)} className="h-6 w-6 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </section>

              {/* RED CARDS */}
              <section className="space-y-4">
                <h3 className="font-bold text-red-500 text-lg border-b border-white/5 pb-2">Red Cards</h3>
                <div className="flex flex-wrap gap-3 items-end bg-black/20 p-4 rounded-lg border border-white/5">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Player</label>
                    <PlayerAutocomplete 
                      placeholder="Type player name..."
                      value={redForm.player_name}
                      onChange={val => setRedForm({...redForm, player_name: val})}
                      onSelectTeam={team => setRedForm(prev => ({...prev, team_name: team}))}
                      teamPlayers={teamPlayers}
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                    />
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
                  <Button 
                    onClick={() => addEvent("red_cards", redForm, setRedForm, homeTeam?.name)} 
                    size="sm" 
                    className={`h-9 ${editingEvent?.type === 'red_cards' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  >
                    {editingEvent?.type === 'red_cards' ? 'Update' : <><Plus className="w-4 h-4 mr-1" /> Add</>}
                  </Button>
                  {editingEvent?.type === 'red_cards' && (
                    <Button variant="ghost" size="sm" onClick={() => { setEditingEvent(null); setRedForm({ player_name: "", team_name: homeTeam?.name, minute: "" }); }} className="h-9">Cancel</Button>
                  )}
                </div>
                {info.red_cards.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-white/[0.02] p-2 rounded border border-white/5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 w-8">{r.minute ? `${r.minute}'` : '-'}</span>
                      <span className="font-bold text-white">{r.player_name}</span>
                      <span className="text-slate-500 text-xs">({r.team_name})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEditEvent("red_cards", r, setRedForm)} className="h-6 w-6 text-slate-500 hover:text-blue-400">✏️</Button>
                      <Button variant="ghost" size="icon" onClick={() => removeEvent("red_cards", r.id)} className="h-6 w-6 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </section>

              {/* PENALTY SHOOTOUT (ONLY FOR FINALS IF SCORE IS TIED, OR IF ALREADY HAS PENALTIES) */}
              {(stage === 'final' || info.goals.some(g => g.is_penalty_shootout)) && (
                <section className="space-y-4">
                  <h3 className="font-bold text-orange-400 text-lg border-b border-white/5 pb-2">Penalty Shootout</h3>
                  <div className="flex flex-wrap gap-3 items-end bg-black/20 p-4 rounded-lg border border-white/5">
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Player</label>
                      <PlayerAutocomplete 
                        placeholder="Type player name..."
                        value={penaltyShootoutForm.player_name}
                        onChange={val => setPenaltyShootoutForm({...penaltyShootoutForm, player_name: val})}
                        onSelectTeam={team => setPenaltyShootoutForm(prev => ({...prev, team_name: team}))}
                        teamPlayers={teamPlayers}
                        homeTeam={homeTeam}
                        awayTeam={awayTeam}
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Team</label>
                      <select className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-2 text-sm text-white" value={penaltyShootoutForm.team_name} onChange={e => setPenaltyShootoutForm({...penaltyShootoutForm, team_name: e.target.value})}>
                        <option value={homeTeam?.name}>{homeTeam?.short_name}</option>
                        <option value={awayTeam?.name}>{awayTeam?.short_name}</option>
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Result</label>
                      <select className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-2 text-sm text-white" value={penaltyShootoutForm.shootout_result} onChange={e => setPenaltyShootoutForm({...penaltyShootoutForm, shootout_result: e.target.value})}>
                        <option value="scored">Scored</option>
                        <option value="missed">Missed</option>
                      </select>
                    </div>
                    <Button 
                      onClick={() => addEvent("goals", penaltyShootoutForm, setPenaltyShootoutForm, homeTeam?.name)} 
                      size="sm" 
                      className={`h-9 ${editingEvent?.type === 'penalty_shootout' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                    >
                      {editingEvent?.type === 'penalty_shootout' ? 'Update' : <><Plus className="w-4 h-4 mr-1" /> Add</>}
                    </Button>
                    {editingEvent?.type === 'penalty_shootout' && (
                      <Button variant="ghost" size="sm" onClick={() => { setEditingEvent(null); setPenaltyShootoutForm({ player_name: "", team_name: homeTeam?.name, is_penalty_shootout: true, shootout_result: "scored" }); }} className="h-9">Cancel</Button>
                    )}
                  </div>
                  {info.goals.filter(g => g.is_penalty_shootout).map(g => (
                    <div key={g.id} className={`flex items-center justify-between bg-white/[0.02] p-2 rounded border border-white/5 text-sm ${g.shootout_result === 'missed' ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 w-8">{g.shootout_result === 'scored' ? '⚽' : '❌'}</span>
                        <span className={`font-bold ${g.shootout_result === 'missed' ? 'line-through text-slate-500' : 'text-white'}`}>{g.player_name}</span>
                        <span className="text-slate-500 text-xs">({g.team_name})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEditEvent("penalty_shootout", g, setPenaltyShootoutForm)} className="h-6 w-6 text-slate-500 hover:text-blue-400">✏️</Button>
                        <Button variant="ghost" size="icon" onClick={() => removeEvent("goals", g.id)} className="h-6 w-6 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ))}
                </section>
              )}
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
