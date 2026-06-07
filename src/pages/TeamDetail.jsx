import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, UserPlus, Trash2, Shield, Target, CalendarDays, UserRound, Activity } from "lucide-react";
import { supabase } from "../lib/supabase";
import { computeStandings, getRecentForm } from "../lib/logic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

import FormationPitch from "../components/ui/FormationPitch";

export default function TeamDetail() {
  const { tournamentId, teamId } = useParams();
  
  const [team, setTeam] = useState(null);
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const [t, m, ts, p] = await Promise.all([
      supabase.from("teams").select("*").eq("id", teamId).single(),
      supabase.from("matches").select("*").eq("tournament_id", tournamentId),
      supabase.from("teams").select("*").eq("tournament_id", tournamentId),
      supabase.from("players").select("*").eq("team_id", teamId)
    ]);
    
    if (t.data) setTeam(t.data);
    if (m.data) setMatches(m.data);
    if (ts.data) setTeams(ts.data);
    if (p.data) setPlayers(p.data);
    
    setLoading(false);
  };

  useEffect(() => {
    if (!tournamentId || !teamId) return;
    loadData();

    const channel = supabase.channel(`public_${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `team_id=eq.${teamId}` }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, teamId]);

  const starters = players.filter(p => p.is_starter).sort((a,b) => a.jersey_number - b.jersey_number);
  const bench = players.filter(p => !p.is_starter).sort((a,b) => a.jersey_number - b.jersey_number);

  const standings = useMemo(() => computeStandings(teams, matches), [teams, matches]);
  const teamStats = standings.find(s => s.team.id === teamId);
  
  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading team data...</div>;
  if (!team) return <div className="p-8 text-center text-destructive font-bold">Team not found</div>;

  const teamMatches = matches
    .filter(m => m.home_team_id === teamId || m.away_team_id === teamId)
    .sort((a, b) => a.matchday - b.matchday);

  const form = getRecentForm(teamId, matches);
  const formStyle = { W: "bg-emerald-500", D: "bg-amber-500", L: "bg-red-500" };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="hover:bg-white/5">
          <Link to={`/t/${tournamentId}`}><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div 
          className="w-12 h-12 rounded-xl shadow-lg border border-white/10 flex items-center justify-center font-black text-xl"
          style={{ backgroundColor: team.color, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
        >
          {team.short_name}
        </div>
        <div>
          <h1 className="text-3xl font-black">{team.name}</h1>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Recent Form:</span>
              <div className="flex gap-1">
                {form.length === 0 ? <span className="text-xs text-muted-foreground">No matches</span> : 
                  form.map((res, i) => (
                    <span key={i} className={`w-4 h-4 rounded-sm text-[9px] font-bold flex items-center justify-center text-white ${formStyle[res]}`}>{res}</span>
                  ))
                }
              </div>
            </div>
            {team.formation && (
              <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                <span className="text-sm font-medium text-muted-foreground">Formation:</span>
                <span className="text-sm font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{team.formation}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <Card className="bg-[#0f1423] border-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg">Season Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 md:gap-4">
            <div className="flex-1 min-w-[60px] bg-[#1a1f2e] rounded-xl p-3 text-center border border-white/5">
              <div className="text-[10px] font-bold text-slate-400 mb-1">MP</div>
              <div className="text-xl font-black text-white">{teamStats?.mp || 0}</div>
            </div>
            <div className="flex-1 min-w-[60px] bg-[#1a1f2e] rounded-xl p-3 text-center border border-white/5">
              <div className="text-[10px] font-bold text-slate-400 mb-1">W</div>
              <div className="text-xl font-black text-emerald-400">{teamStats?.w || 0}</div>
            </div>
            <div className="flex-1 min-w-[60px] bg-[#1a1f2e] rounded-xl p-3 text-center border border-white/5">
              <div className="text-[10px] font-bold text-slate-400 mb-1">D</div>
              <div className="text-xl font-black text-amber-500">{teamStats?.d || 0}</div>
            </div>
            <div className="flex-1 min-w-[60px] bg-[#1a1f2e] rounded-xl p-3 text-center border border-white/5">
              <div className="text-[10px] font-bold text-slate-400 mb-1">L</div>
              <div className="text-xl font-black text-red-400">{teamStats?.l || 0}</div>
            </div>
            <div className="flex-1 min-w-[60px] bg-[#1a1f2e] rounded-xl p-3 text-center border border-white/5">
              <div className="text-[10px] font-bold text-slate-400 mb-1">GF</div>
              <div className="text-xl font-black text-white">{teamStats?.gf || 0}</div>
            </div>
            <div className="flex-1 min-w-[60px] bg-[#1a1f2e] rounded-xl p-3 text-center border border-white/5">
              <div className="text-[10px] font-bold text-slate-400 mb-1">GA</div>
              <div className="text-xl font-black text-white">{teamStats?.ga || 0}</div>
            </div>
            <div className="flex-1 min-w-[60px] bg-[#1a1f2e] rounded-xl p-3 text-center border border-white/5">
              <div className="text-[10px] font-bold text-slate-400 mb-1">GD</div>
              <div className={`text-xl font-black ${!teamStats ? 'text-white' : teamStats.gd > 0 ? 'text-emerald-400' : teamStats.gd < 0 ? 'text-red-400' : 'text-white'}`}>
                {teamStats?.gd > 0 ? `+${teamStats.gd}` : teamStats?.gd || 0}
              </div>
            </div>
            <div className="flex-1 min-w-[60px] bg-[#1a1f2e] rounded-xl p-3 text-center border border-white/5">
              <div className="text-[10px] font-bold text-slate-400 mb-1">PTS</div>
              <div className="text-xl font-black text-amber-400">{teamStats?.pts || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-[#0f1423] border-white/5">
            <CardHeader className="pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> Tactical Formation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-md mx-auto mb-6">
                <FormationPitch teamColor={team.color} formation={team.formation || "3-3-1"} starters={starters} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0f1423] border-white/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" /> Starting VIII
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {starters.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-4">Lineup not announced.</p>
                ) : (
                  starters.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-emerald-500/20">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                          {p.jersey_number}
                        </div>
                        <div>
                          <p className="font-bold text-white flex items-center gap-2">
                            {p.name}
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 bg-black/20 px-1.5 py-0.5 rounded-sm">
                              {p.position}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0f1423] border-white/5 mt-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <UserRound className="w-5 h-5 text-slate-400" /> Substitutes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {bench.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-4">No substitutes.</p>
                ) : (
                  bench.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-white/5 text-slate-300 flex items-center justify-center font-bold text-xs">
                          {p.jersey_number}
                        </div>
                        <div>
                          <p className="font-bold text-slate-300 flex items-center gap-2">
                            {p.name}
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 bg-black/20 px-1.5 py-0.5 rounded-sm">
                              {p.position}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Fixtures</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teamMatches.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No matches scheduled.</p>
                ) : (
                  teamMatches.map(m => {
                    const isHome = m.home_team_id === teamId;
                    const oppId = isHome ? m.away_team_id : m.home_team_id;
                    const opp = teams.find(t => t.id === oppId);
                    
                    let resultClass = "text-muted-foreground";
                    let scoreText = "vs";
                    
                    if (m.status === "completed") {
                      const myScore = isHome ? m.home_score : m.away_score;
                      const oppScore = isHome ? m.away_score : m.home_score;
                      scoreText = `${myScore} - ${oppScore}`;
                      if (myScore > oppScore) resultClass = "text-emerald-400";
                      else if (myScore < oppScore) resultClass = "text-red-400";
                      else resultClass = "text-amber-400";
                    }

                    return (
                      <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.01] border border-white/5 text-sm">
                        <span className="text-xs text-muted-foreground w-12">MD {m.matchday}</span>
                        <div className="flex items-center gap-2 flex-1 justify-center">
                          <span className={isHome ? "font-bold text-foreground" : "text-muted-foreground"}>{team.short_name}</span>
                          <span className={`font-black w-12 text-center ${resultClass}`}>{scoreText}</span>
                          <span className={!isHome ? "font-bold text-foreground" : "text-muted-foreground"}>{opp?.short_name}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
