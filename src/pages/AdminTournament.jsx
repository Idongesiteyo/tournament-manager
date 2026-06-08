import { useEffect, useState, useRef } from "react";
import { Save, Settings, Trash2, CalendarPlus, Check, X, ArrowLeft, ShieldAlert, ImagePlus, Edit2, UserCog, Info, RotateCcw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { generateSchedule, isSeasonComplete } from "../lib/logic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { TeamColorBadge } from "../components/shared/TeamColorBadge";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import AdminMatchInfoModal from "../components/admin/AdminMatchInfoModal";
import UnauthorizedAccess from "../components/ui/UnauthorizedAccess";

export default function AdminTournament() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [settings, setSettings] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);

  const [tName, setTName] = useState("");
  const [tImage, setTImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [newTeam, setNewTeam] = useState({ name: "", short_name: "", color: "#eab308" });
  
  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamData, setEditTeamData] = useState({ name: "", short_name: "", color: "" });

  const [editingMatch, setEditingMatch] = useState(null);
  const [editScores, setEditScores] = useState({ home: "", away: "", match_date: "" });
  const [finalScores, setFinalScores] = useState({ home: "", away: "" });
  const [manualWinnerOverride, setManualWinnerOverride] = useState("");
  const [infoMatch, setInfoMatch] = useState(null);

  const [confirmFullReset, setConfirmFullReset] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [halfDurations, setHalfDurations] = useState({});

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      const userIsSuperAdmin = profile?.role === 'super_admin';
      setIsSuperAdmin(userIsSuperAdmin);
      
      const { data: tData, error: tErr } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", tournamentId)
        .single();
        
      if (tErr || !tData) {
        setAuthError(true);
        setLoading(false);
        return;
      }

      let isAuthorized = userIsSuperAdmin || tData.user_id === session.user.id;

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
      
      setSettings(tData);
      setTName(tData.name);
      setTImage(tData.image_url);
      
      await loadData();
      setLoading(false);
    };
    
    checkAuthAndLoad();

    const channel = supabase.channel(`admin_${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` }, (payload) => {
        setSettings(payload.new);
        if(payload.new.name) setTName(payload.new.name);
        if(payload.new.image_url !== undefined) setTImage(payload.new.image_url);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, navigate]);

  const loadData = async () => {
    const [teamsRes, matchesRes] = await Promise.all([
      supabase.from("teams").select("*").eq("tournament_id", tournamentId),
      supabase.from("matches").select("*").eq("tournament_id", tournamentId)
    ]);
    
    if (teamsRes.data) setTeams(teamsRes.data);
    if (matchesRes.data) setMatches(matchesRes.data);
  };

  const getTeam = (id) => teams.find(t => t.id === id);

  const saveTournamentName = async () => {
    await supabase.from("tournaments").update({ name: tName }).eq("id", tournamentId);
    toast.success("Tournament name updated");
  };

  const uploadTournamentImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${tournamentId}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('tournaments')
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Failed to upload image");
      setIsUploading(false);
      return;
    }

    const { data } = supabase.storage.from('tournaments').getPublicUrl(filePath);
    
    await supabase.from("tournaments").update({ image_url: data.publicUrl }).eq("id", tournamentId);
    setTImage(data.publicUrl);
    toast.success("Tournament image updated");
    setIsUploading(false);
  };

  const addTeam = async (e) => {
    e.preventDefault();
    if (teams.length >= 4) return;
    
    if (!newTeam.name.trim() || !newTeam.short_name.trim()) {
      toast.error("Please provide both a team name and short code.");
      return;
    }
    if (newTeam.short_name.trim().length > 5) {
      toast.error("Short code cannot exceed 5 characters.");
      return;
    }

    const isDuplicate = teams.some(t => 
      t.name.toLowerCase() === newTeam.name.trim().toLowerCase() || 
      t.short_name.toLowerCase() === newTeam.short_name.trim().toLowerCase()
    );
    if (isDuplicate) {
      toast.error("A team with this name or code already exists!");
      return;
    }
    
    const { error } = await supabase.from("teams").insert([{
      ...newTeam,
      name: newTeam.name.trim(),
      short_name: newTeam.short_name.trim().toUpperCase(),
      tournament_id: tournamentId
    }]);

    if (error) {
      toast.error("Failed to add team: " + error.message);
      return;
    }

    setNewTeam({ name: "", short_name: "", color: "#eab308" });
    toast.success("Team added successfully!");
  };

  const saveEditedTeam = async (id) => {
    await supabase.from("teams").update(editTeamData).eq("id", id);
    setEditingTeam(null);
  };

  const deleteTeam = async (id) => {
    await supabase.from("teams").delete().eq("id", id);
  };

  const handleGenerateSchedule = async () => {
    if (teams.length !== 4) return;
    const schedule = generateSchedule(teams).map(m => ({
      tournament_id: tournamentId,
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
      matchday: m.matchday,
      status: m.status,
      stage: m.stage
    }));
    await supabase.from("matches").insert(schedule);
  };

  const saveMatchScore = async (matchId, originalStatus) => {
    const updates = {};
    
    if (editScores.match_date) {
      const parsedDate = new Date(editScores.match_date);
      if (isNaN(parsedDate.getTime())) {
        toast.error("Invalid date format provided.");
        return;
      }
      updates.match_date = parsedDate.toISOString();
    } else {
      updates.match_date = null;
    }

    if (editScores.home !== "" && editScores.away !== "") {
      updates.home_score = parseInt(editScores.home, 10);
      updates.away_score = parseInt(editScores.away, 10);
      if (originalStatus === "scheduled") {
        updates.status = "completed";
      }
    }

    const { error } = await supabase.from("matches").update(updates).eq("id", matchId);
    
    if (error) {
      console.error(error);
      toast.error("Failed to save match: Check if you ran the SQL script to add match_date!");
      return;
    }
    
    setEditingMatch(null);
    toast.success("Match saved successfully!");
  };

  const updateMatchStatus = async (matchId, status, extraFields = {}) => {
    const { error } = await supabase.from("matches").update({ status, ...extraFields }).eq("id", matchId);
    if (error) {
      toast.error("Failed to update status: " + error.message);
    } else {
      toast.success("Match status updated to " + status);
    }
  };

  const resetSingleMatch = async (matchId) => {
    if (!window.confirm("Are you sure you want to reset this match? All scores, timers, and match info will be cleared.")) return;
    
    const { error: matchError } = await supabase.from("matches").update({
      status: "scheduled",
      home_score: null,
      away_score: null,
      first_half_start: null,
      second_half_start: null,
      match_end: null
    }).eq("id", matchId);
    
    if (matchError) {
      toast.error("Failed to reset match: " + matchError.message);
      return;
    }

    await supabase.from("match_info").delete().eq("match_id", matchId);
    toast.success("Match reset successfully!");
  };

  const generateFinal = async () => {
    if (teams.length < 2) return;
    const standings = require('../lib/logic').computeStandings(teams, matches);
    if(standings.length < 2) return;
    
    await supabase.from("matches").insert([{
      tournament_id: tournamentId,
      home_team_id: standings[0].team.id,
      away_team_id: standings[1].team.id,
      matchday: 99,
      status: "scheduled",
      stage: "final"
    }]);
  };

  const saveFinalScore = async (matchId, homeTeamId, awayTeamId) => {
    if (finalScores.home === "" || finalScores.away === "") return;
    const hScore = parseInt(finalScores.home, 10);
    const aScore = parseInt(finalScores.away, 10);
    
    let winnerId = manualWinnerOverride;
    if (!winnerId) {
      winnerId = hScore > aScore ? homeTeamId : awayTeamId;
    }

    await supabase.from("matches").update({
      home_score: hScore,
      away_score: aScore,
      status: "completed",
      winner_team_id: winnerId
    }).eq("id", matchId);

    await supabase.from("tournaments").update({ champion_team_id: winnerId }).eq("id", tournamentId);
  };

  const setManualChampion = async (winnerId) => {
    await supabase.from("tournaments").update({ champion_team_id: winnerId }).eq("id", tournamentId);
    toast.success("Champion manually overridden");
  };

  const handleResetMatches = async () => {
    if (confirm("Are you sure you want to delete all matches? This cannot be undone.")) {
      await supabase.from("matches").delete().eq("tournament_id", tournamentId);
      await supabase.from("tournaments").update({ champion_team_id: null }).eq("id", tournamentId);
    }
  };

  const handleFullReset = async () => {
    await supabase.from("matches").delete().eq("tournament_id", tournamentId);
    await supabase.from("teams").delete().eq("tournament_id", tournamentId);
    await supabase.from("tournaments").update({ champion_team_id: null, image_url: null }).eq("id", tournamentId);
    setConfirmFullReset(false);
  };

  if (authError) return <UnauthorizedAccess />;
  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  const seasonComplete = isSeasonComplete(matches);
  const finalMatch = matches.find(m => m.stage === "final");
  const regularMatches = matches.filter(m => m.stage === "regular");
  const completedRegular = regularMatches.filter(m => m.status === "completed").length;

  const formatDateForInput = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
  };

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-black text-primary flex items-center gap-3">
            <Settings className="w-8 h-8" /> Manage League
          </h1>
        </div>
        <Button variant="outline" asChild className="border-white/10 hover:bg-white/5">
          <Link to={`/t/${tournamentId}`}>View Public Page</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Teams", value: `${teams.length} / 4` },
          { label: "Total Matches", value: matches.length },
          { label: "Completed", value: completedRegular, color: "text-emerald-400" },
          { label: "Remaining", value: regularMatches.length - completedRegular },
        ].map(s => (
          <Card key={s.label} className="bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground mb-1">{s.label}</div>
              <div className={`text-2xl font-black ${s.color || ""}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tournament Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Tournament Name</label>
              <div className="flex gap-2">
                <Input 
                  value={tName} 
                  onChange={(e) => setTName(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && saveTournamentName()}
                />
                <Button onClick={saveTournamentName}><Save className="w-4 h-4" /></Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Tournament Logo</label>
              <div className="flex items-center gap-4">
                {tImage ? (
                  <img src={tImage} alt="Tournament" className="w-16 h-16 rounded-xl object-cover border border-white/10" />
                ) : (
                  <div className="w-16 h-16 rounded-xl border border-dashed border-white/20 flex items-center justify-center text-muted-foreground bg-white/5">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={uploadTournamentImage}
                  />
                  <Button variant="secondary" onClick={() => fileInputRef.current.click()} disabled={isUploading}>
                    {isUploading ? "Uploading..." : tImage ? "Change Image" : "Upload Image"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Playoff Final</CardTitle>
          </CardHeader>
          <CardContent>
            {!seasonComplete && !finalMatch && (
              <div className="text-center py-2 text-muted-foreground text-sm">
                Complete all regular season matches to unlock final generation.
                <div className="mt-2 w-full bg-white/5 rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(completedRegular/12)*100}%`}} />
                </div>
              </div>
            )}
            {seasonComplete && !finalMatch && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-400">Season Complete!</span>
                <Button onClick={generateFinal} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  Generate Final
                </Button>
              </div>
            )}
            {finalMatch && (
              <div className="space-y-4 border border-primary/30 p-4 rounded-xl bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold mb-1">Home</span>
                    <Input 
                      type="number" 
                      className="w-16 h-10 text-center font-bold text-lg" 
                      value={finalMatch.status === "completed" ? finalMatch.home_score : finalScores.home}
                      onChange={(e) => setFinalScores({...finalScores, home: e.target.value})}
                      disabled={finalMatch.status === "completed"}
                    />
                  </div>
                  <span className="font-black text-muted-foreground">VS</span>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold mb-1">Away</span>
                    <Input 
                      type="number" 
                      className="w-16 h-10 text-center font-bold text-lg" 
                      value={finalMatch.status === "completed" ? finalMatch.away_score : finalScores.away}
                      onChange={(e) => setFinalScores({...finalScores, away: e.target.value})}
                      disabled={finalMatch.status === "completed"}
                    />
                  </div>
                </div>

                {finalMatch.status !== "completed" ? (
                  <>
                    {finalScores.home !== "" && finalScores.away !== "" && finalScores.home === finalScores.away && (
                      <div className="space-y-2 pt-2 border-t border-primary/20">
                        <label className="text-xs font-bold text-amber-500 block">Match is a draw. Select Winner (Penalties):</label>
                        <select 
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          value={manualWinnerOverride}
                          onChange={(e) => setManualWinnerOverride(e.target.value)}
                        >
                          <option value="">-- Select Winner --</option>
                          <option value={finalMatch.home_team_id}>{teams.find(t=>t.id===finalMatch.home_team_id)?.name}</option>
                          <option value={finalMatch.away_team_id}>{teams.find(t=>t.id===finalMatch.away_team_id)?.name}</option>
                        </select>
                      </div>
                    )}
                    <Button 
                      className="w-full" 
                      onClick={() => saveFinalScore(finalMatch.id, finalMatch.home_team_id, finalMatch.away_team_id)}
                      disabled={finalScores.home === finalScores.away && !manualWinnerOverride}
                    >
                      Save Final Result & Crown Champion
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="text-center text-primary font-bold text-sm tracking-widest uppercase">
                      Champion Crowned
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground block text-center">Override Champion (if needed)</label>
                      <select 
                        className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        value={settings?.champion_team_id || ""}
                        onChange={(e) => setManualChampion(e.target.value)}
                      >
                        <option value="">-- Select --</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Teams Manager</CardTitle>
          <span className="text-sm text-muted-foreground">{teams.length} / 4</span>
        </CardHeader>
        <CardContent>
          <form onSubmit={addTeam} className="flex gap-2 mb-6">
            <Input 
              placeholder="Full Name (e.g. FC Barcelona)" 
              value={newTeam.name} 
              onChange={(e) => setNewTeam({...newTeam, name: e.target.value})} 
              className="flex-1"
            />
            <Input 
              placeholder="Code (FCB)" 
              value={newTeam.short_name} 
              onChange={(e) => setNewTeam({...newTeam, short_name: e.target.value})} 
              className="w-24 uppercase"
              maxLength={3}
            />
            <input 
              type="color" 
              value={newTeam.color} 
              onChange={(e) => setNewTeam({...newTeam, color: e.target.value})}
              className="w-10 h-10 rounded border-0 cursor-pointer bg-transparent p-1"
            />
            <Button type="submit" disabled={teams.length >= 4}>Add</Button>
          </form>

          <div className="space-y-2">
            {teams.map(t => {
              const isEditing = editingTeam === t.id;
              
              return (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 group">
                  {isEditing ? (
                    <div className="flex flex-1 gap-2 items-center mr-4">
                      <Input 
                        value={editTeamData.name} 
                        onChange={e => setEditTeamData({...editTeamData, name: e.target.value})} 
                        className="flex-1"
                      />
                      <Input 
                        value={editTeamData.short_name} 
                        onChange={e => setEditTeamData({...editTeamData, short_name: e.target.value})} 
                        className="w-20 uppercase"
                        maxLength={3}
                      />
                      <input 
                        type="color" 
                        value={editTeamData.color} 
                        onChange={e => setEditTeamData({...editTeamData, color: e.target.value})}
                        className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent p-0.5"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <TeamColorBadge team={t} />
                      <div>
                        <p className="font-bold">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.id}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-1">
                    {isEditing ? (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => saveEditedTeam(t.id)} className="text-emerald-400">
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingTeam(null)} className="text-muted-foreground">
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          asChild
                          className="text-primary hover:text-primary/80"
                        >
                          <Link to={`/dashboard/${tournamentId}/team/${t.id}`}>
                            <UserCog className="w-4 h-4 mr-1" /> Squad
                          </Link>
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => {
                            setEditingTeam(t.id);
                            setEditTeamData({ name: t.name, short_name: t.short_name, color: t.color });
                          }} 
                          className="text-muted-foreground hover:text-white"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteTeam(t.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {teams.length === 4 && matches.length === 0 && (
            <div className="mt-6 pt-6 border-t border-white/10 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground text-center">
                You have 4 teams. You can now generate the 12-match regular season schedule.
              </p>
              <Button size="lg" className="w-full sm:w-auto" onClick={handleGenerateSchedule}>
                <CalendarPlus className="w-5 h-5 mr-2" /> Generate Schedule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Match Results Manager</CardTitle>
            <CardDescription>Enter scores and dates for regular season matches.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {regularMatches.sort((a,b) => a.matchday - b.matchday).map(match => {
                const home = getTeam(match.home_team_id);
                const away = getTeam(match.away_team_id);
                const isEditing = editingMatch?.id === match.id;

                return (
                  <div key={match.id} className={`flex flex-col sm:flex-row items-center justify-between p-3 rounded-xl border gap-4 transition-colors ${isEditing ? "bg-white/5 border-primary/30" : "bg-white/[0.02] border-white/5"}`}>
                    <div className="flex flex-col items-center sm:items-start w-full sm:w-auto">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        MD {match.matchday}
                      </div>
                      {!isEditing && match.match_date && (
                        <div className="text-xs text-primary/80 font-medium">
                          {new Date(match.match_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 justify-center w-full">
                      <div className="flex items-center gap-2 justify-end w-full sm:w-32">
                        <span className="font-bold truncate" style={{ color: home?.color }}>{home?.short_name}</span>
                        <TeamColorBadge team={home} />
                      </div>
                      
                      {isEditing ? (
                        <div className="flex flex-col items-center gap-2">
                          <input 
                            type="datetime-local" 
                            className="flex h-8 w-full rounded-md border border-input bg-black/40 px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            value={editScores.match_date}
                            onChange={e => setEditScores({...editScores, match_date: e.target.value})}
                          />
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number" 
                              className="w-14 h-8 text-center px-1 font-bold" 
                              value={editScores.home} 
                              onChange={e => setEditScores({...editScores, home: e.target.value})}
                              onKeyDown={e => e.key === 'Enter' && saveMatchScore(match.id, match.status)}
                              placeholder={match.home_score ?? "-"}
                            />
                            <span className="text-muted-foreground font-bold">-</span>
                            <Input 
                              type="number" 
                              className="w-14 h-8 text-center px-1 font-bold" 
                              value={editScores.away} 
                              onChange={e => setEditScores({...editScores, away: e.target.value})}
                              onKeyDown={e => e.key === 'Enter' && saveMatchScore(match.id, match.status)}
                              placeholder={match.away_score ?? "-"}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className={`px-4 py-1.5 rounded-lg border font-black text-lg ${['completed', 'first_half', 'second_half', 'halftime'].includes(match.status) ? "bg-white/5 border-white/10" : "bg-transparent border-white/5 text-muted-foreground"}`}>
                          {['completed', 'first_half', 'second_half', 'halftime'].includes(match.status) ? `${match.home_score ?? 0} - ${match.away_score ?? 0}` : "vs"}
                        </div>
                      )}

                      <div className="flex items-center gap-2 justify-start w-full sm:w-32">
                        <TeamColorBadge team={away} />
                        <span className="font-bold truncate" style={{ color: away?.color }}>{away?.short_name}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 self-end sm:self-auto w-full sm:w-auto justify-end mt-2 sm:mt-0 flex-wrap">
                      {isEditing ? (
                        <>
                          <Button size="sm" onClick={() => saveMatchScore(match.id, match.status)} className="bg-emerald-500 hover:bg-emerald-600 text-white h-8">
                            Save
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingMatch(null)} className="text-muted-foreground hover:text-foreground h-8 w-8">
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <div className="flex items-center gap-1 mr-2 border-r border-white/10 pr-3">
                            {match.status === 'scheduled' && (
                              <div className="flex items-center gap-1">
                                <select 
                                  className="h-8 bg-black/40 border border-white/10 rounded px-1 text-xs text-white"
                                  value={halfDurations[match.id] || 45}
                                  onChange={(e) => setHalfDurations({...halfDurations, [match.id]: parseInt(e.target.value)})}
                                >
                                  {[10, 15, 20, 25, 30, 35, 40, 45].map(m => (
                                    <option key={m} value={m}>{m}m half</option>
                                  ))}
                                </select>
                                <Button size="sm" variant="outline" className="h-8 text-xs border-emerald-500/50 text-emerald-400 px-2" onClick={() => updateMatchStatus(match.id, 'first_half', { half_duration: halfDurations[match.id] || 45, first_half_start: new Date().toISOString() })}>Start</Button>
                              </div>
                            )}
                            {match.status === 'first_half' && (
                              <>
                                <Button size="sm" variant="outline" className="h-8 text-xs border-amber-500/50 text-amber-400" onClick={() => updateMatchStatus(match.id, 'halftime')}>HT</Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs border-blue-500/50 text-blue-400" onClick={() => updateMatchStatus(match.id, 'completed', { match_end: new Date().toISOString() })}>FT</Button>
                              </>
                            )}
                            {match.status === 'halftime' && (
                              <>
                                <Button size="sm" variant="outline" className="h-8 text-xs border-emerald-500/50 text-emerald-400" onClick={() => updateMatchStatus(match.id, 'second_half', { second_half_start: new Date().toISOString() })}>2nd Half</Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs border-blue-500/50 text-blue-400" onClick={() => updateMatchStatus(match.id, 'completed', { match_end: new Date().toISOString() })}>FT</Button>
                              </>
                            )}
                            {match.status === 'second_half' && (
                              <Button size="sm" variant="outline" className="h-8 text-xs border-blue-500/50 text-blue-400" onClick={() => updateMatchStatus(match.id, 'completed', { match_end: new Date().toISOString() })}>FT</Button>
                            )}
                            {match.status === 'completed' && (
                              <span className="text-xs text-blue-400 font-bold px-2 uppercase">FT</span>
                            )}
                          </div>
                          
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="border-white/10 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                            onClick={() => setInfoMatch({ matchId: match.id, homeTeam: home, awayTeam: away })}
                          >
                            <Info className="w-4 h-4 mr-1" /> Info
                          </Button>
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            className="h-8 text-xs"
                            onClick={() => {
                              setEditingMatch(match);
                              setEditScores({ 
                                home: match.home_score ?? "", 
                                away: match.away_score ?? "",
                                match_date: formatDateForInput(match.match_date)
                              });
                            }}
                          >
                            <Edit2 className="w-3 h-3 mr-2" /> Edit Match
                          </Button>
                          {match.status !== 'scheduled' && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all ml-1"
                              onClick={() => resetSingleMatch(match.id)}
                              title="Reset Match"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 pt-12 border-t border-destructive/20">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Reset Matches</CardTitle>
            <CardDescription>Deletes all match records. Keeps teams.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleResetMatches}>Delete All Matches</Button>
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardHeader>
              <CardTitle className="text-destructive font-black flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" /> Danger Zone
              </CardTitle>
              <CardDescription className="text-destructive/80">Completely wipe the tournament database.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-white" onClick={() => setConfirmFullReset(true)}>
                Full Database Reset
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {confirmFullReset && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1423] border border-red-500/20 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Full Database Reset</h3>
                <p className="text-slate-400 mt-2">
                  Are you absolutely sure? This will delete ALL teams, matches, scores, and statistics. 
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 w-full mt-4">
                <Button variant="ghost" className="flex-1" onClick={() => setConfirmFullReset(false)}>Cancel</Button>
                <Button variant="destructive" className="flex-1" onClick={handleFullReset}>Yes, wipe everything</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {infoMatch && (
        <AdminMatchInfoModal 
          isOpen={!!infoMatch}
          onClose={() => setInfoMatch(null)}
          matchId={infoMatch.matchId}
          homeTeam={infoMatch.homeTeam}
          awayTeam={infoMatch.awayTeam}
          onSaveSuccess={(mId, hScore, aScore) => {
            setMatches(prev => prev.map(m => m.id === mId ? { ...m, home_score: hScore, away_score: aScore } : m));
          }}
        />
      )}
    </div>
  );
}
