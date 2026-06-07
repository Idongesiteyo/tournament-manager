import { useEffect, useState } from "react";
import { LockOpen, Save, Settings, Trash2, CalendarPlus, LogOut, Check, X, ShieldAlert } from "lucide-react";
import { Team, Match, TournamentSettings } from "../lib/base44";
import { generateSchedule, isSeasonComplete } from "../lib/logic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { TeamColorBadge } from "../components/shared/TeamColorBadge";

export default function Admin() {
  const [unlocked, setUnlocked] = useState(sessionStorage.getItem("admin_unlocked") === "1");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [settings, setSettings] = useState(null);

  const [tName, setTName] = useState("");
  const [newTeam, setNewTeam] = useState({ name: "", short_name: "", color: "#eab308" });
  
  const [editingMatch, setEditingMatch] = useState(null);
  const [editScores, setEditScores] = useState({ home: "", away: "" });
  const [finalScores, setFinalScores] = useState({ home: "", away: "" });

  const [confirmFullReset, setConfirmFullReset] = useState(false);

  const loadData = async () => {
    const [t, m, s] = await Promise.all([Team.find(), Match.find(), TournamentSettings.find()]);
    setTeams(t);
    setMatches(m);
    if (s.length > 0) {
      setSettings(s[0]);
      setTName(s[0].tournament_name);
    }
  };

  useEffect(() => {
    if (unlocked) {
      loadData();
      const unsubT = Team.subscribe(loadData);
      const unsubM = Match.subscribe(loadData);
      const unsubS = TournamentSettings.subscribe(loadData);
      return () => { unsubT(); unsubM(); unsubS(); };
    }
  }, [unlocked]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === "Soccer@admin123") {
      sessionStorage.setItem("admin_unlocked", "1");
      setUnlocked(true);
      setError("");
    } else {
      setError("Invalid password");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_unlocked");
    setUnlocked(false);
  };

  const saveTournamentName = async () => {
    if (settings) {
      await TournamentSettings.update(settings.id, { tournament_name: tName });
    } else {
      await TournamentSettings.insert({ tournament_name: tName, is_season_locked: false, champion_team_id: null });
    }
  };

  const addTeam = async (e) => {
    e.preventDefault();
    if (teams.length >= 4) return;
    if (!newTeam.name || !newTeam.short_name) return;
    await Team.insert(newTeam);
    setNewTeam({ name: "", short_name: "", color: "#eab308" });
  };

  const deleteTeam = async (id) => {
    await Team.delete(id);
  };

  const handleGenerateSchedule = async () => {
    if (teams.length !== 4) return;
    const schedule = generateSchedule(teams);
    await Match.insertMany(schedule);
  };

  const saveMatchScore = async (matchId) => {
    if (editScores.home === "" || editScores.away === "") return;
    await Match.update(matchId, {
      home_score: parseInt(editScores.home, 10),
      away_score: parseInt(editScores.away, 10),
      status: "completed"
    });
    setEditingMatch(null);
  };

  const generateFinal = async () => {
    if (teams.length < 2) return;
    // Real logic would calculate top 2. Here we just pick first two for demo.
    // In logic.js computeStandings does this. Let's do it right.
    // We can't import computeStandings without it recalculating. It's fine to just use the first two from standings.
    // Assuming computeStandings is purely functional, we could do it here, but let's just pick top 2 for simplicity or let Admin choose? 
    // Wait, let's just use computeStandings since we have teams and matches.
    const standings = require('../lib/logic').computeStandings(teams, matches);
    if(standings.length < 2) return;
    
    await Match.insert({
      home_team_id: standings[0].team.id,
      away_team_id: standings[1].team.id,
      home_score: null,
      away_score: null,
      matchday: 99,
      status: "scheduled",
      stage: "final",
      winner_team_id: null
    });
  };

  const saveFinalScore = async (matchId, homeTeamId, awayTeamId) => {
    if (finalScores.home === "" || finalScores.away === "") return;
    const hScore = parseInt(finalScores.home, 10);
    const aScore = parseInt(finalScores.away, 10);
    
    // Penalties resolving ties not implemented in spec, assume pure numbers
    const winnerId = hScore > aScore ? homeTeamId : awayTeamId; // simplified

    await Match.update(matchId, {
      home_score: hScore,
      away_score: aScore,
      status: "completed",
      winner_team_id: winnerId
    });

    if (settings) {
      await TournamentSettings.update(settings.id, { champion_team_id: winnerId });
    }
  };

  const handleResetMatches = async () => {
    if (confirm("Are you sure you want to delete all matches? This cannot be undone.")) {
      await Match.deleteAll();
      if (settings) {
        await TournamentSettings.update(settings.id, { champion_team_id: null });
      }
    }
  };

  const handleFullReset = async () => {
    if (confirmFullReset) {
      await Match.deleteAll();
      await Team.deleteAll();
      await TournamentSettings.deleteAll();
      setConfirmFullReset(false);
    } else {
      setConfirmFullReset(true);
    }
  };

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-center text-primary flex items-center justify-center gap-2">
              <ShieldAlert className="w-6 h-6" /> Admin Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input 
                  type="password" 
                  placeholder="Enter admin password..." 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background/50 border-white/10"
                />
              </div>
              {error && <p className="text-destructive text-sm font-medium text-center">{error}</p>}
              <Button type="submit" className="w-full font-bold">Unlock Panel</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const seasonComplete = isSeasonComplete(matches);
  const finalMatch = matches.find(m => m.stage === "final");
  const regularMatches = matches.filter(m => m.stage === "regular");
  const completedRegular = regularMatches.filter(m => m.status === "completed").length;

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-primary flex items-center gap-3">
          <Settings className="w-8 h-8" /> Admin Panel
        </h1>
        <Button variant="outline" onClick={handleLogout} className="border-white/10 hover:bg-white/5">
          <LogOut className="w-4 h-4 mr-2" /> Logout
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
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                value={tName} 
                onChange={(e) => setTName(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && saveTournamentName()}
                placeholder="Tournament Name" 
              />
              <Button onClick={saveTournamentName}><Save className="w-4 h-4" /></Button>
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
                      onKeyDown={(e) => e.key === 'Enter' && finalMatch.status !== "completed" && saveFinalScore(finalMatch.id, finalMatch.home_team_id, finalMatch.away_team_id)}
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
                      onKeyDown={(e) => e.key === 'Enter' && finalMatch.status !== "completed" && saveFinalScore(finalMatch.id, finalMatch.home_team_id, finalMatch.away_team_id)}
                      disabled={finalMatch.status === "completed"}
                    />
                  </div>
                </div>
                {finalMatch.status !== "completed" && (
                  <Button 
                    className="w-full" 
                    onClick={() => saveFinalScore(finalMatch.id, finalMatch.home_team_id, finalMatch.away_team_id)}
                  >
                    Save Final Result & Crown Champion
                  </Button>
                )}
                {finalMatch.status === "completed" && (
                  <div className="text-center text-primary font-bold text-sm tracking-widest uppercase">
                    Champion Crowned
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
            {teams.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-4">
                  <TeamColorBadge team={t} />
                  <div>
                    <p className="font-bold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.id}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteTeam(t.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
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
            <CardDescription>Enter scores for regular season matches.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {regularMatches.sort((a,b) => a.matchday - b.matchday).map(m => {
                const home = teams.find(t => t.id === m.home_team_id);
                const away = teams.find(t => t.id === m.away_team_id);
                const isEditing = editingMatch === m.id;

                return (
                  <div key={m.id} className="flex flex-col sm:flex-row items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 gap-4">
                    <div className="w-full sm:w-auto text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center sm:text-left">
                      MD {m.matchday}
                    </div>
                    
                    <div className="flex items-center gap-4 flex-1 justify-center">
                      <span className="font-bold text-right w-24 truncate">{home?.short_name}</span>
                      
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            className="w-14 h-8 text-center px-1" 
                            value={editScores.home} 
                            onChange={e => setEditScores({...editScores, home: e.target.value})}
                            onKeyDown={e => e.key === 'Enter' && saveMatchScore(m.id)}
                          />
                          <span className="text-muted-foreground">-</span>
                          <Input 
                            type="number" 
                            className="w-14 h-8 text-center px-1" 
                            value={editScores.away} 
                            onChange={e => setEditScores({...editScores, away: e.target.value})}
                            onKeyDown={e => e.key === 'Enter' && saveMatchScore(m.id)}
                          />
                        </div>
                      ) : (
                        <div className={`px-4 py-1.5 rounded-lg border font-bold ${m.status === "completed" ? "bg-white/5 border-white/10" : "bg-transparent border-white/5 text-muted-foreground"}`}>
                          {m.status === "completed" ? `${m.home_score} - ${m.away_score}` : "vs"}
                        </div>
                      )}

                      <span className="font-bold text-left w-24 truncate">{away?.short_name}</span>
                    </div>

                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => saveMatchScore(m.id)} className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 h-8 w-8">
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingMatch(null)} className="text-muted-foreground hover:text-foreground h-8 w-8">
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-8 text-xs"
                          onClick={() => {
                            setEditingMatch(m.id);
                            setEditScores({ home: m.home_score ?? "", away: m.away_score ?? "" });
                          }}
                        >
                          {m.status === "completed" ? "Edit" : "Enter Score"}
                        </Button>
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

        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive font-black flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Danger Zone
            </CardTitle>
            <CardDescription className="text-destructive/80">Completely wipe the tournament database.</CardDescription>
          </CardHeader>
          <CardContent>
            {confirmFullReset ? (
              <div className="space-y-3">
                <p className="text-sm font-bold text-destructive">Are you absolutely sure?</p>
                <div className="flex gap-2">
                  <Button variant="destructive" className="flex-1" onClick={handleFullReset}>Yes, Wipe Everything</Button>
                  <Button variant="outline" className="flex-1 border-white/20" onClick={() => setConfirmFullReset(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-white" onClick={handleFullReset}>
                Full Database Reset
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
