import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Trophy, Clock, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { computeStandings, isSeasonComplete, getRecentForm } from "../lib/logic";
import { PlayoffWidget } from "../components/shared/PlayoffWidget";
import { TeamColorBadge } from "../components/shared/TeamColorBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { cn } from "../lib/utils";
import PublicMatchDetailModal from "../components/ui/PublicMatchDetailModal";
import { MatchTimer } from "../components/ui/MatchTimer";

export default function Home() {
  const { tournamentId } = useParams();
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [settings, setSettings] = useState(null);
  const [fixturesFilter, setFixturesFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);

  const loadData = async () => {
    const [t, m, s] = await Promise.all([
      supabase.from("teams").select("*").eq("tournament_id", tournamentId),
      supabase.from("matches").select("*").eq("tournament_id", tournamentId),
      supabase.from("tournaments").select("*").eq("id", tournamentId).single()
    ]);
    if (t.data) setTeams(t.data);
    if (m.data) setMatches(m.data);
    if (s.data) setSettings(s.data);
    setLoading(false);
  };

  useEffect(() => {
    if (!tournamentId) return;
    loadData();

    const channel = supabase.channel(`public_${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading tournament...</div>;
  if (!settings) return <div className="p-8 text-center text-destructive font-bold">Tournament not found</div>;

  const standings = computeStandings(teams, matches);
  const seasonComplete = isSeasonComplete(matches);
  const championId = settings?.champion_team_id;
  const championTeam = championId ? teams.find(t => t.id === championId) : null;

  const formStyle = { 
    W: "bg-[#10b981] text-white", 
    D: "bg-[#f59e0b] text-white", 
    L: "bg-[#ef4444] text-white" 
  };

  const filteredMatches = matches
    .filter(m => m.stage === "regular")
    .filter((m) => {
      if (fixturesFilter === "results") return m.status === "completed";
      if (fixturesFilter === "upcoming") return m.status === "scheduled";
      return true;
    })
    .sort((a, b) => a.matchday - b.matchday);

  const matchesByDay = filteredMatches.reduce((acc, m) => {
    acc[m.matchday] = acc[m.matchday] || [];
    acc[m.matchday].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Champion Banner */}
      {championTeam && (
        <div className="bg-gradient-to-r from-primary/20 via-primary/5 to-transparent border border-primary/20 rounded-xl p-6 flex items-center gap-6 shadow-2xl shadow-primary/10 mb-8 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 text-primary/10 transform rotate-12">
            <Trophy className="w-64 h-64" />
          </div>
          <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl shadow-xl z-10 shrink-0 border-2 border-white/20" style={{ backgroundColor: championTeam.color, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
            {championTeam.short_name}
          </div>
          <div className="z-10">
            <h2 className="text-primary font-black text-sm uppercase tracking-widest mb-1 flex items-center gap-2">
              <Trophy className="w-4 h-4" /> LEAGUE CHAMPIONS
            </h2>
            <p className="text-3xl font-black text-white">{championTeam.name}</p>
          </div>
        </div>
      )}

      <PlayoffWidget isComplete={seasonComplete} matches={matches} teams={teams} settings={settings} onMatchClick={(m, h, a) => setSelectedMatch({ match: m, homeTeam: h, awayTeam: a })} />

      <Card className="bg-[#0f1423] border-white/5 shadow-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2 text-white">
            <span className="w-1.5 h-6 bg-primary rounded-full inline-block"></span>
            League Standings
          </CardTitle>
          <div className="flex items-center gap-1 text-xs text-slate-400 sm:hidden animate-pulse">
            <ChevronRight className="w-4 h-4" /> Swipe for more
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[700px]">
              <TableHeader className="bg-black/20">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="w-12 text-center text-slate-400 font-bold sticky left-0 bg-[#0f1423] z-20 px-1 sm:px-4">#</TableHead>
                  <TableHead className="text-slate-400 font-bold sticky left-12 bg-[#0f1423] z-20 shadow-[4px_0_12px_rgba(0,0,0,0.5)] w-[140px] sm:w-[200px] px-2 sm:px-4">TEAM</TableHead>
                  <TableHead className="text-center text-slate-400 font-bold w-12">W</TableHead>
                  <TableHead className="text-center text-slate-400 font-bold w-12">D</TableHead>
                  <TableHead className="text-center text-slate-400 font-bold w-12">L</TableHead>
                  <TableHead className="text-center text-slate-400 font-bold w-12 hidden md:table-cell">GF</TableHead>
                  <TableHead className="text-center text-slate-400 font-bold w-12 hidden md:table-cell">GA</TableHead>
                  <TableHead className="text-center text-slate-400 font-bold w-12">GD</TableHead>
                  <TableHead className="text-center text-slate-400 font-bold w-32">FORM</TableHead>
                  <TableHead className="text-center font-black text-white w-16">PTS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.map((row, idx) => {
                  const isPlayoff = idx < 2;
                  const isChampion = championId === row.team.id;
                  const form = getRecentForm(row.team.id, matches);

                  return (
                    <TableRow 
                      key={row.team.id}
                      className={cn(
                        "border-white/5 transition-colors",
                        isChampion ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-white/[0.02]"
                      )}
                    >
                      <TableCell className="text-center font-bold text-slate-400 sticky left-0 bg-[#0f1423] group-hover:bg-[#1a2035] transition-colors z-10 px-1 sm:px-4">
                        {isPlayoff ? (
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-black flex items-center justify-center mx-auto text-[10px] sm:text-xs">{idx + 1}</div>
                        ) : (
                          <span className="text-xs sm:text-sm">{idx + 1}</span>
                        )}
                      </TableCell>
                      <TableCell className="sticky left-12 bg-[#0f1423] group-hover:bg-[#1a2035] transition-colors z-10 shadow-[4px_0_12px_rgba(0,0,0,0.5)] w-[140px] sm:w-[200px] px-2 sm:px-4">
                        <Link to={`/t/${tournamentId}/team/${row.team.id}`} className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity">
                          <div className="shrink-0 scale-75 sm:scale-100 origin-left -ml-1 sm:ml-0">
                            <TeamColorBadge team={row.team} />
                          </div>
                          <div className="flex flex-col min-w-0 overflow-hidden">
                            <span className="font-bold flex items-center gap-1 text-white text-xs sm:text-sm truncate">
                              <span className="truncate">{row.team.name}</span>
                              {isChampion && <Trophy className="w-3 h-3 text-primary shrink-0" />}
                            </span>
                            {isPlayoff && !championId && (
                              <span className="text-[9px] sm:text-[10px] text-primary font-bold">
                                ● Playoff
                              </span>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center font-medium text-emerald-400">{row.w}</TableCell>
                      <TableCell className="text-center font-medium text-amber-400">{row.d}</TableCell>
                      <TableCell className="text-center font-medium text-red-400">{row.l}</TableCell>
                      <TableCell className="text-center text-slate-400 hidden md:table-cell">{row.gf}</TableCell>
                      <TableCell className="text-center text-slate-400 hidden md:table-cell">{row.ga}</TableCell>
                      <TableCell className={`text-center font-bold ${row.gd > 0 ? 'text-emerald-400' : row.gd < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {row.gd > 0 ? `+${row.gd}` : row.gd}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {form.map((result, i) => (
                            <span key={i} className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${formStyle[result]}`}>
                              {result}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-black text-primary text-lg">{row.pts}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 border-t border-white/5 bg-black/10">
            <span className="text-xs text-primary font-bold flex items-center gap-2">
              ● Top 2 qualify for Finals
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#0f1423] border-white/5 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
          <CardTitle className="text-white">Fixtures</CardTitle>
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
            {["all", "results", "upcoming"].map((filter) => (
              <button
                key={filter}
                onClick={() => setFixturesFilter(filter)}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold rounded-md capitalize transition-all",
                  fixturesFilter === filter ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            {Object.keys(matchesByDay).sort((a,b) => a - b).map((day) => (
              <div key={day} className="p-6">
                <h4 className="text-xs font-black text-slate-500 mb-4 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-8 h-px bg-white/10 block"></span>
                  Matchday {day}
                  <span className="flex-1 h-px bg-white/10 block"></span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matchesByDay[day].map((m) => {
                    const homeTeam = teams.find(t => t.id === m.home_team_id);
                    const awayTeam = teams.find(t => t.id === m.away_team_id);
                    if (!homeTeam || !awayTeam) return null;

                    return (
                      <div 
                        key={m.id} 
                        className={cn(
                          "flex flex-col p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors relative overflow-hidden",
                          ['completed', 'first_half', 'second_half', 'halftime'].includes(m.status) && "cursor-pointer"
                        )}
                        onClick={() => ['completed', 'first_half', 'second_half', 'halftime'].includes(m.status) && setSelectedMatch({ match: m, homeTeam, awayTeam })}
                      >
                        {/* Match Date Header */}
                        {m.match_date && (
                          <div className="text-[10px] text-center font-bold text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-white/5">
                            {new Date(m.match_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {!m.match_date && m.status !== "completed" && (
                           <div className="text-[10px] text-center font-bold text-slate-500 uppercase tracking-widest mb-3 pb-2 border-b border-white/5">
                             TBD
                           </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col items-center gap-2 flex-1">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shadow-lg" style={{ backgroundColor: homeTeam.color, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                              {homeTeam.short_name}
                            </div>
                            <span className="font-bold text-sm text-center text-white">{homeTeam.name}</span>
                          </div>

                          <div className="w-24 flex flex-col items-center justify-center mx-2 shrink-0 relative">
                            {['completed', 'first_half', 'second_half', 'halftime'].includes(m.status) ? (
                              <div className="relative w-full flex flex-col items-center">
                                <MatchTimer match={m} />
                                <div className={`px-4 py-2 rounded-xl text-xl font-black tracking-widest border w-full text-center ${m.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                                  {m.home_score ?? 0} - {m.away_score ?? 0}
                                </div>
                              </div>
                            ) : (
                              <span className="flex items-center justify-center w-8 h-8 text-slate-500 text-xs font-bold bg-black/40 rounded-full border border-white/5">
                                VS
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col items-center gap-2 flex-1">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shadow-lg" style={{ backgroundColor: awayTeam.color, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                              {awayTeam.short_name}
                            </div>
                            <span className="font-bold text-sm text-center text-white">{awayTeam.name}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {Object.keys(matchesByDay).length === 0 && (
              <div className="text-center text-slate-500 font-medium py-12">
                No fixtures found.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Match Detail Modal */}
      {selectedMatch && (
        <PublicMatchDetailModal
          isOpen={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          match={selectedMatch.match}
          homeTeam={selectedMatch.homeTeam}
          awayTeam={selectedMatch.awayTeam}
        />
      )}
    </div>
  );
}
