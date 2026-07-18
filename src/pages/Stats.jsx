import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { computeStandings, getRecentForm } from "../lib/logic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { Activity, Target, Shield, TrendingUp, BarChart2 } from "lucide-react";
import { TeamColorBadge } from "../components/shared/TeamColorBadge";

export default function Stats() {
  const { tournamentId } = useParams();
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [matchInfo, setMatchInfo] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const [t, m] = await Promise.all([
      supabase.from("teams").select("*").eq("tournament_id", tournamentId),
      supabase.from("matches").select("*").eq("tournament_id", tournamentId)
    ]);
    
    if (t.data) setTeams(t.data);
    if (m.data) {
      setMatches(m.data);
      const matchIds = m.data.map(match => match.id);
      if (matchIds.length > 0) {
        const { data: infoData } = await supabase.from("match_info").select("*").in("match_id", matchIds);
        setMatchInfo(infoData || []);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!tournamentId) return;
    loadData();

    const channel = supabase.channel(`public_${tournamentId}_stats`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_info' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  const standings = useMemo(() => computeStandings(teams, matches), [teams, matches]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading stats...</div>;

  const totalGoals = standings.reduce((acc, s) => acc + s.gf, 0);
  const totalMatches = standings.reduce((acc, s) => acc + s.mp, 0) / 2;
  const avgGoals = totalMatches ? (totalGoals / totalMatches).toFixed(2) : "0.00";

  // Goals per Matchday data
  const completedMatches = matches.filter(m => m.status === 'completed' && m.stage === 'regular');
  const goalsPerMatchday = completedMatches.reduce((acc, m) => {
    acc[m.matchday] = (acc[m.matchday] || 0) + m.home_score + m.away_score;
    return acc;
  }, {});
  const goalsChartData = Object.keys(goalsPerMatchday).sort().map(md => ({
    name: `MD${md}`,
    goals: goalsPerMatchday[md]
  }));

  // Top Attacking Teams (Design matching)
  const attackData = [...standings].sort((a, b) => b.gf - a.gf || b.gd - a.gd).slice(0, 5);
  const maxGoals = attackData.length > 0 ? attackData[0].gf : 1;

  // Best Defense Teams
  const defenseData = [...standings].sort((a, b) => a.ga - b.ga || b.gd - a.gd).slice(0, 5);
  const maxConceded = defenseData.length > 0 ? Math.max(...defenseData.map(d => d.ga)) || 1 : 1;

  // Form / Heatmap logic
  const allMatchdays = [...new Set(matches.filter(m=>m.stage==='regular').map(m => m.matchday))].sort((a,b)=>a-b);

  const getMatchResultForTeam = (teamId, matchday) => {
    const m = matches.find(m => m.matchday === matchday && m.stage === 'regular' && (m.home_team_id === teamId || m.away_team_id === teamId));
    if (!m || m.status !== 'completed') return null;
    const isHome = m.home_team_id === teamId;
    const myScore = isHome ? m.home_score : m.away_score;
    const oppScore = isHome ? m.away_score : m.home_score;
    if (myScore > oppScore) return 'W';
    if (myScore < oppScore) return 'L';
    return 'D';
  };

  const formColors = {
    'W': 'bg-[#10b981] text-white',
    'D': 'bg-[#f59e0b] text-white',
    'L': 'bg-[#ef4444] text-white'
  };

  // -------------------------------------------------------------
  // Player Stats Aggregation (Scorers, Assists, Cards)
  // -------------------------------------------------------------
  const playerStats = {}; // key: "Player Name|Team Name"
  
  matchInfo.forEach(info => {
    const processEvent = (events, type) => {
      if (!events) return;
      events.forEach(e => {
        if (!e.player_name || !e.team_name) return;
        const pName = e.player_name.trim();
        const tName = e.team_name.trim();
        const key = `${pName.toLowerCase()}|${tName.toLowerCase()}`;
        if (!playerStats[key]) {
          playerStats[key] = { 
            player_name: pName, // keep original casing for display
            team_name: tName, 
            matchesSet: new Set(), 
            goals: 0, 
            assists: 0, 
            yellow_cards: 0, 
            red_cards: 0 
          };
        }
        playerStats[key].matchesSet.add(info.match_id);
        
        if (type === 'goal' && !e.is_own_goal && !e.is_penalty_shootout) playerStats[key].goals += 1;
        if (type === 'assist') playerStats[key].assists += 1;
        if (type === 'yellow') playerStats[key].yellow_cards += 1;
        if (type === 'red') playerStats[key].red_cards += 1;
      });
    };
    
    processEvent(info.goals, 'goal');
    processEvent(info.assists, 'assist');
    processEvent(info.yellow_cards, 'yellow');
    processEvent(info.red_cards, 'red');
  });

  const playersArr = Object.values(playerStats).map(p => ({
    ...p,
    matchesPlayed: p.matchesSet.size
  }));

  const topScorers = [...playersArr].filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists);
  const topAssists = [...playersArr].filter(p => p.assists > 0).sort((a, b) => b.assists - a.assists || b.goals - a.goals);
  const topCards = [...playersArr].filter(p => p.yellow_cards > 0 || p.red_cards > 0).sort((a, b) => b.red_cards - a.red_cards || b.yellow_cards - a.yellow_cards);

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      <div>
        <h1 className="text-3xl font-black text-primary flex items-center gap-3">
          <Activity className="w-8 h-8" /> League Statistics
        </h1>
        <p className="text-muted-foreground mt-2">Comprehensive data analysis across all teams.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-primary/20 rounded-full text-primary">
              <Target className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Goals</p>
              <h2 className="text-3xl font-black">{totalGoals}</h2>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-emerald-500/20 rounded-full text-emerald-400">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Goals / Match</p>
              <h2 className="text-3xl font-black text-emerald-400">{avgGoals}</h2>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-blue-500/20 rounded-full text-blue-400">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Matches Played</p>
              <h2 className="text-3xl font-black text-blue-400">{totalMatches}</h2>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals per Matchday Chart */}
        <Card className="bg-[#0f1423] border-white/5 shadow-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <span className="w-1.5 h-6 bg-emerald-500 rounded-full inline-block"></span>
              <BarChart2 className="w-5 h-5 text-emerald-500" />
              Goals per Matchday
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            {goalsChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No completed matches yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={goalsChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.02)'}}
                    contentStyle={{ backgroundColor: '#0f1423', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                  />
                  <Bar dataKey="goals" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Attacking Teams */}
        <Card className="bg-[#0f1423] border-white/5 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-white">
              <span className="w-1.5 h-6 bg-red-500 rounded-full inline-block"></span>
              <Target className="w-5 h-5 text-red-500" />
              Top Attacking Teams
            </CardTitle>
            <CardDescription className="text-slate-400">Ranked by goals scored • goal difference as tiebreaker</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">
            {attackData.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">No teams available.</div>
            ) : (
              attackData.map((row, idx) => {
                const widthPercent = Math.max((row.gf / maxGoals) * 100, 5);
                return (
                  <div key={row.team.id} className="flex items-center gap-4">
                    <div className="w-6 font-bold text-slate-400 text-center">{idx + 1}</div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-lg" style={{ backgroundColor: row.team.color, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)'}}>
                      {row.team.short_name}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="font-bold text-white truncate text-sm sm:text-base pr-2">{row.team.name}</span>
                        <div className="flex gap-4 shrink-0 items-center">
                          <div className="text-right">
                            <span className="font-black text-white text-lg">{row.gf}</span>
                            <span className="text-[10px] text-slate-400 block -mt-1">goals</span>
                          </div>
                          <div className="text-right w-8">
                            <span className={`font-bold text-sm text-emerald-400`}>
                              {row.gd > 0 ? `+${row.gd}` : row.gd}
                            </span>
                            <span className="text-[10px] text-slate-400 block -mt-0.5">GD</span>
                          </div>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${widthPercent}%`, backgroundColor: row.team.color }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Best Defense Teams */}
        <Card className="bg-[#0f1423] border-white/5 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-white">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block"></span>
              <Shield className="w-5 h-5 text-blue-500" />
              Best Defense
            </CardTitle>
            <CardDescription className="text-slate-400">Ranked by least goals conceded</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">
            {defenseData.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">No teams available.</div>
            ) : (
              defenseData.map((row, idx) => {
                const widthPercent = Math.max((row.ga / maxConceded) * 100, 5);
                return (
                  <div key={row.team.id} className="flex items-center gap-4">
                    <div className="w-6 font-bold text-slate-400 text-center">{idx + 1}</div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-lg" style={{ backgroundColor: row.team.color, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)'}}>
                      {row.team.short_name}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="font-bold text-white truncate text-sm sm:text-base pr-2">{row.team.name}</span>
                        <div className="flex gap-4 shrink-0 items-center">
                          <div className="text-right">
                            <span className="font-black text-white text-lg">{row.ga}</span>
                            <span className="text-[10px] text-slate-400 block -mt-1">conceded</span>
                          </div>
                          <div className="text-right w-8">
                            <span className={`font-bold text-sm text-emerald-400`}>
                              {row.gd > 0 ? `+${row.gd}` : row.gd}
                            </span>
                            <span className="text-[10px] text-slate-400 block -mt-0.5">GD</span>
                          </div>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${widthPercent}%`, backgroundColor: row.team.color }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>


        {/* Match Result Heatmap */}
        <Card className="bg-[#0f1423] border-white/5 shadow-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block"></span>
              <Activity className="w-5 h-5 text-blue-500" />
              Match Result Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[500px] md:min-w-[600px]">
                <div className="flex mb-4">
                  <div className="w-32 md:w-48 shrink-0 sticky left-0 bg-[#0f1423] z-10 border-r border-white/5 md:border-transparent mr-2 md:mr-0"></div>
                  <div className="flex-1 flex gap-2">
                    {allMatchdays.map(md => (
                      <div key={md} className="flex-1 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">MD{md}</div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {teams.map(team => (
                    <div key={team.id} className="flex items-center">
                      <div className="w-32 md:w-48 shrink-0 flex items-center gap-2 md:gap-3 sticky left-0 bg-[#0f1423] z-10 py-1 border-r border-white/5 md:border-transparent mr-2 md:mr-0 pr-2">
                        <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center font-bold text-[10px] shrink-0" style={{ backgroundColor: team.color, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                          {team.short_name}
                        </div>
                        <span className="font-medium text-slate-300 truncate text-xs md:text-base">{team.name}</span>
                      </div>
                      <div className="flex-1 flex gap-2">
                        {allMatchdays.map(md => {
                          const res = getMatchResultForTeam(team.id, md);
                          return (
                            <div key={md} className="flex-1 flex justify-center">
                              {res ? (
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-lg ${formColors[res]}`}>
                                  {res}
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/5"></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-6 mt-8 pt-6 border-t border-white/5">
                  <div className="flex items-center gap-2"><div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${formColors['W']}`}>W</div><span className="text-sm text-slate-400">Win</span></div>
                  <div className="flex items-center gap-2"><div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${formColors['D']}`}>D</div><span className="text-sm text-slate-400">Draw</span></div>
                  <div className="flex items-center gap-2"><div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${formColors['L']}`}>L</div><span className="text-sm text-slate-400">Loss</span></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Player Stats Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
        {/* Top Scorers */}
        <Card className="bg-[#0f1423] border-white/5 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <span className="w-1.5 h-6 bg-emerald-500 rounded-full inline-block"></span>
              ⚽ Top Scorers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topScorers.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No stats available yet.</p>
            ) : (
              <div className="space-y-4">
                {topScorers.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center text-slate-500 font-bold text-sm">{idx + 1}</span>
                      <div>
                        <div className="font-bold text-white text-sm">{p.player_name}</div>
                        <div className="text-xs text-slate-500">{p.team_name} • {p.matchesPlayed} MP</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.assists > 0 && <span className="text-xs font-bold text-blue-400">{p.assists}A</span>}
                      <span className="font-black text-emerald-400 text-lg">{p.goals}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Assists */}
        <Card className="bg-[#0f1423] border-white/5 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block"></span>
              👟 Top Assists
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topAssists.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No stats available yet.</p>
            ) : (
              <div className="space-y-4">
                {topAssists.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center text-slate-500 font-bold text-sm">{idx + 1}</span>
                      <div>
                        <div className="font-bold text-white text-sm">{p.player_name}</div>
                        <div className="text-xs text-slate-500">{p.team_name} • {p.matchesPlayed} MP</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.goals > 0 && <span className="text-xs font-bold text-emerald-400">{p.goals}G</span>}
                      <span className="font-black text-blue-400 text-lg">{p.assists}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discipline (Cards) */}
        <Card className="bg-[#0f1423] border-white/5 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <span className="w-1.5 h-6 bg-red-500 rounded-full inline-block"></span>
              🟨🟥 Discipline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCards.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No stats available yet.</p>
            ) : (
              <div className="space-y-4">
                {topCards.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center text-slate-500 font-bold text-sm">{idx + 1}</span>
                      <div>
                        <div className="font-bold text-white text-sm">{p.player_name}</div>
                        <div className="text-xs text-slate-500">{p.team_name} • {p.matchesPlayed} MP</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.yellow_cards > 0 && <span className="font-black text-yellow-500 text-lg">{p.yellow_cards}</span>}
                      {p.red_cards > 0 && <span className="font-black text-red-500 text-lg ml-2">{p.red_cards}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
