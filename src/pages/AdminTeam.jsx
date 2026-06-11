import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, UserPlus, Trash2, Check, X, Shield, Users, Edit2, Save } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import UnauthorizedAccess from "../components/ui/UnauthorizedAccess";

const VALID_FORMATIONS = ["3-3-1", "3-2-2", "2-3-2", "2-4-1", "4-2-1"];

export default function AdminTeam() {
  const { tournamentId, teamId } = useParams();
  
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNum, setNewPlayerNum] = useState("");
  const [newPlayerPos, setNewPlayerPos] = useState("Midfielder");

  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editData, setEditData] = useState({ name: "", jersey_number: "", position: "" });

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setAuthError(true); setLoading(false); return; }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
    const isSuperAdmin = profile?.role === 'super_admin';

    const { data: tData, error: tErr } = await supabase
      .from("tournaments")
      .select("user_id")
      .eq("id", tournamentId)
      .single();
      
    if (tErr || !tData) {
      setAuthError(true);
      setLoading(false);
      return;
    }

    let isAuthorized = isSuperAdmin || tData.user_id === session.user.id;

    if (!isAuthorized) {
      const { data: assignment } = await supabase
        .from("tournament_admins")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("admin_id", session.user.id)
        .maybeSingle();
      if (assignment) isAuthorized = true;
    }
      
    if (!isAuthorized) {
      setAuthError(true);
      setLoading(false);
      return;
    }

    const [t, p] = await Promise.all([
      supabase.from("teams").select("*").eq("id", teamId).single(),
      supabase.from("players").select("*").eq("team_id", teamId)
    ]);
    
    if (t.data) setTeam(t.data);
    if (p.data) setPlayers(p.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    const channel = supabase.channel(`admin_team_${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `id=eq.${teamId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `team_id=eq.${teamId}` }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const updateFormation = async (formation) => {
    const { error } = await supabase.from("teams").update({ formation }).eq("id", teamId);
    if (error) {
      toast.error("Failed to update formation. Have you run the SQL script?");
    } else {
      toast.success("Formation updated");
    }
  };

  const addPlayer = async (e) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !newPlayerNum) return;
    
    const { error } = await supabase.from("players").insert([{
      team_id: teamId,
      name: newPlayerName.trim(),
      position: newPlayerPos,
      jersey_number: parseInt(newPlayerNum, 10),
      is_starter: false
    }]);
    
    if (error) {
      toast.error("Failed to add player: " + error.message);
      return;
    }
    
    setNewPlayerName("");
    setNewPlayerNum("");
    toast.success("Player added");
  };

  const deletePlayer = async (id) => {
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete player: " + error.message);
    } else {
      toast.success("Player deleted");
    }
  };

  const startEdit = (p) => {
    setEditingPlayerId(p.id);
    setEditData({ name: p.name, jersey_number: p.jersey_number, position: p.position });
  };

  const cancelEdit = () => {
    setEditingPlayerId(null);
    setEditData({ name: "", jersey_number: "", position: "" });
  };

  const saveEdit = async (id) => {
    if (!editData.name.trim() || !editData.jersey_number) return;
    
    const { error } = await supabase.from("players").update({
      name: editData.name.trim(),
      jersey_number: parseInt(editData.jersey_number, 10),
      position: editData.position
    }).eq("id", id);

    if (error) {
      toast.error("Failed to update player: " + error.message);
    } else {
      toast.success("Player updated");
      setEditingPlayerId(null);
    }
  };

  const toggleStarter = async (player) => {
    const isCurrentlyStarter = player.is_starter;
    
    if (!isCurrentlyStarter) {
      const currentStarters = players.filter(p => p.is_starter).length;
      if (currentStarters >= 8) {
        toast.error("You can only have a maximum of 8 starting players.");
        return;
      }
    }
    
    const { error } = await supabase.from("players").update({ is_starter: !isCurrentlyStarter }).eq("id", player.id);
    if (error) {
      toast.error("Failed to update player status.");
    }
  };

  if (authError) return <UnauthorizedAccess />;
  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading Team Data...</div>;
  if (!team) return <div className="p-8 text-center text-destructive font-bold">Team not found</div>;

  const starters = players.filter(p => p.is_starter).sort((a,b) => a.jersey_number - b.jersey_number);
  const bench = players.filter(p => !p.is_starter).sort((a,b) => a.jersey_number - b.jersey_number);

  return (
    <div className="space-y-8 animate-in fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild className="hover:bg-white/5">
          <Link to={`/dashboard/${tournamentId}`}><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-black text-white">{team.name} Squad</h1>
          <p className="text-slate-400">Manage starting VIII and substitutes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-[#0f1423] border-white/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" /> Formation
              </CardTitle>
              <CardDescription>Select 8-a-side formation</CardDescription>
            </CardHeader>
            <CardContent>
              <select 
                className="w-full h-10 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                value={team.formation || "3-3-1"}
                onChange={(e) => updateFormation(e.target.value)}
              >
                {VALID_FORMATIONS.map(f => (
                  <option key={f} value={f} className="bg-[#0f1423] text-white">{f}</option>
                ))}
              </select>
            </CardContent>
          </Card>
          
          <Card className="bg-[#0f1423] border-white/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" /> Add Player
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={addPlayer} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Name</label>
                  <Input 
                    placeholder="Player Name" 
                    value={newPlayerName} 
                    onChange={e => setNewPlayerName(e.target.value)} 
                    className="bg-black/20 border-white/10 mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Number</label>
                    <Input 
                      type="number"
                      placeholder="#" 
                      value={newPlayerNum} 
                      onChange={e => setNewPlayerNum(e.target.value)} 
                      className="bg-black/20 border-white/10 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Position</label>
                    <select 
                      className="w-full h-10 mt-1 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={newPlayerPos}
                      onChange={e => setNewPlayerPos(e.target.value)}
                    >
                      <option className="bg-[#0f1423]">Forward</option>
                      <option className="bg-[#0f1423]">Midfielder</option>
                      <option className="bg-[#0f1423]">Defender</option>
                      <option className="bg-[#0f1423]">Goalkeeper</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" className="w-full font-bold">Add Player</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="bg-[#0f1423] border-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" /> Starting VIII
                </CardTitle>
                <CardDescription>Must be exactly 8 players ({starters.length}/8)</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {starters.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-sm">No starters selected.</div>
              ) : (
                <div className="space-y-2">
                  {starters.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-white/[0.02] border border-white/5 border-l-2 border-l-primary gap-2">
                      {editingPlayerId === p.id ? (
                        <div className="flex-1 flex items-center gap-2 mr-2 sm:mr-4">
                          <Input className="h-8 bg-black/20" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} placeholder="Name" />
                          <Input type="number" className="h-8 w-16 sm:w-20 bg-black/20" value={editData.jersey_number} onChange={e => setEditData({...editData, jersey_number: e.target.value})} placeholder="#" />
                          <select className="h-8 rounded-md border border-white/10 bg-black/20 px-1 sm:px-2 text-white text-xs w-20 sm:w-auto" value={editData.position} onChange={e => setEditData({...editData, position: e.target.value})}>
                            <option className="bg-[#0f1423]">Forward</option>
                            <option className="bg-[#0f1423]">Midfielder</option>
                            <option className="bg-[#0f1423]">Defender</option>
                            <option className="bg-[#0f1423]">Goalkeeper</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20">
                            {p.jersey_number}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white text-sm sm:text-base flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 leading-tight">
                              <span className="truncate">{p.name}</span>
                              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-primary/70 bg-primary/10 px-1 sm:px-1.5 py-0.5 rounded-sm w-fit shrink-0">
                                {p.position}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-0 sm:gap-1 md:gap-2 shrink-0">
                        {editingPlayerId === p.id ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => saveEdit(p.id)} className="text-emerald-400 hover:text-emerald-300 h-7 w-7 sm:h-8 sm:w-8"><Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={cancelEdit} className="text-slate-400 hover:text-white h-7 w-7 sm:h-8 sm:w-8"><X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={() => toggleStarter(p)} className="h-7 sm:h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 whitespace-nowrap text-[10px] sm:text-xs px-2 sm:px-3">Bench</Button>
                            <Button variant="ghost" size="icon" onClick={() => startEdit(p)} className="text-slate-400 hover:text-white h-7 w-7 sm:h-8 sm:w-8"><Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deletePlayer(p.id)} className="text-slate-500 hover:text-destructive h-7 w-7 sm:h-8 sm:w-8"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#0f1423] border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" /> Bench Substitutes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bench.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-sm">Bench is empty.</div>
              ) : (
                <div className="space-y-2">
                  {bench.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-white/[0.02] border border-white/5 gap-2">
                      {editingPlayerId === p.id ? (
                        <div className="flex-1 flex items-center gap-2 mr-2 sm:mr-4">
                          <Input className="h-8 bg-black/20" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} placeholder="Name" />
                          <Input type="number" className="h-8 w-16 sm:w-20 bg-black/20" value={editData.jersey_number} onChange={e => setEditData({...editData, jersey_number: e.target.value})} placeholder="#" />
                          <select className="h-8 rounded-md border border-white/10 bg-black/20 px-1 sm:px-2 text-white text-xs w-20 sm:w-auto" value={editData.position} onChange={e => setEditData({...editData, position: e.target.value})}>
                            <option className="bg-[#0f1423]">Forward</option>
                            <option className="bg-[#0f1423]">Midfielder</option>
                            <option className="bg-[#0f1423]">Defender</option>
                            <option className="bg-[#0f1423]">Goalkeeper</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full bg-white/5 text-slate-300 flex items-center justify-center font-bold text-xs">
                            {p.jersey_number}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-300 text-sm sm:text-base flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 leading-tight">
                              <span className="truncate">{p.name}</span>
                              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 bg-black/20 px-1 sm:px-1.5 py-0.5 rounded-sm w-fit shrink-0">
                                {p.position}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-0 sm:gap-1 md:gap-2 shrink-0">
                        {editingPlayerId === p.id ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => saveEdit(p.id)} className="text-emerald-400 hover:text-emerald-300 h-7 w-7 sm:h-8 sm:w-8"><Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={cancelEdit} className="text-slate-400 hover:text-white h-7 w-7 sm:h-8 sm:w-8"><X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={() => toggleStarter(p)} className="h-7 sm:h-8 border-white/10 text-slate-400 hover:text-white hover:bg-white/5 whitespace-nowrap text-[10px] sm:text-xs px-2 sm:px-3">Move up</Button>
                            <Button variant="ghost" size="icon" onClick={() => startEdit(p)} className="text-slate-400 hover:text-white h-7 w-7 sm:h-8 sm:w-8"><Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deletePlayer(p.id)} className="text-slate-500 hover:text-destructive h-7 w-7 sm:h-8 sm:w-8"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
