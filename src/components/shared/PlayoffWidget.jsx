import React, { useState, useEffect } from "react";
import { Lock, Trophy, Swords, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { TeamColorBadge } from "./TeamColorBadge";
import { supabase } from "../../lib/supabase";
import { MatchTimer } from "../ui/MatchTimer";

export function PlayoffWidget({ isComplete, matches, teams, settings, onMatchClick }) {
  const [penaltyScore, setPenaltyScore] = useState(null);
  const finalMatch = matches.find((m) => m.stage === "final");
  const regularMatches = matches.filter((m) => m.stage === "regular");
  const completedRegular = regularMatches.filter((m) => m.status === "completed").length;

  if (!isComplete && !finalMatch) {
    return (
      <Card className="mb-6 bg-gradient-to-br from-card to-background border-white/5">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Lock className="w-5 h-5" /> Playoff Final Locked
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Regular Season Progress</span>
            <span>{completedRegular} / 12 Matches</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${(completedRegular / 12) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pending State (Season complete, but final not generated)
  if (isComplete && !finalMatch) {
    // Top 2 teams logic would be passed in or we expect them to be the finalists.
    // For pending, it just shows a placeholder waiting for admin to generate.
    return (
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Trophy className="w-5 h-5" /> Playoff Final Pending
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The regular season is complete. Waiting for the administrator to schedule the final match between the top 2 teams.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Live State (Final generated)
  if (finalMatch) {
    const homeTeam = teams.find((t) => t.id === finalMatch.home_team_id);
    const awayTeam = teams.find((t) => t.id === finalMatch.away_team_id);
    const isCompleted = finalMatch.status === "completed";
    const hasStarted = ['completed', 'first_half', 'second_half', 'halftime'].includes(finalMatch.status);

    useEffect(() => {
      if (!hasStarted || !finalMatch || !homeTeam || !awayTeam) return;
      const fetchMatchInfo = async () => {
        const { data } = await supabase.from("match_info").select("goals").eq("match_id", finalMatch.id).single();
        if (data && data.goals) {
          const homePenalties = data.goals.filter(g => g.is_penalty_shootout && g.shootout_result === 'scored' && g.team_name === homeTeam?.name).length;
          const awayPenalties = data.goals.filter(g => g.is_penalty_shootout && g.shootout_result === 'scored' && g.team_name === awayTeam?.name).length;
          if (data.goals.some(g => g.is_penalty_shootout)) {
            setPenaltyScore({ home: homePenalties, away: awayPenalties });
          }
        }
      };
      fetchMatchInfo();
    }, [hasStarted, finalMatch, homeTeam, awayTeam]);

    return (
      <Card 
        className={`mb-6 border-[#fbbf24]/30 bg-[#0f1423] overflow-hidden relative shadow-[0_0_15px_rgba(251,191,36,0.1)] ${hasStarted && onMatchClick ? 'cursor-pointer hover:bg-white/[0.02] transition-colors' : ''}`}
        onClick={() => hasStarted && onMatchClick && onMatchClick(finalMatch, homeTeam, awayTeam)}
      >
        {isCompleted && (
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-xs font-bold rounded-bl-lg flex items-center gap-1">
            <Trophy className="w-3 h-3" /> CHAMPION CROWNED
          </div>
        )}
        <CardHeader className="pb-3 pt-4 border-b border-white/5">
          <CardTitle className="text-center text-[#fbbf24] font-black tracking-wide text-lg flex flex-col items-center justify-center gap-1.5">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" /> Championship Final
            </div>
            {finalMatch.match_date && (
              <span className="text-xs text-slate-400 font-normal tracking-normal flex items-center gap-1">
                <Clock className="w-3 h-3" /> {new Date(finalMatch.match_date).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-8 pb-10">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-4 w-1/3">
              <TeamColorBadge team={homeTeam} className="w-24 h-24 text-3xl shadow-lg rounded-2xl" />
              <span className="font-bold text-center text-white">{homeTeam?.name}</span>
            </div>
            
            <div className="w-1/3 flex flex-col items-center justify-center">
              {hasStarted ? (
                <div className="flex flex-col items-center gap-1 relative pt-4">
                  {!isCompleted && <MatchTimer match={finalMatch} />}
                  <div className="flex items-center justify-center gap-3 text-5xl font-black">
                    <span className={finalMatch.home_score > finalMatch.away_score || (finalMatch.home_score === finalMatch.away_score && penaltyScore?.home > penaltyScore?.away) ? "text-white" : "text-white/50"}>
                      {finalMatch.home_score ?? 0}
                    </span>
                    <span className="text-white/30 text-3xl">-</span>
                    <span className={finalMatch.away_score > finalMatch.home_score || (finalMatch.home_score === finalMatch.away_score && penaltyScore?.away > penaltyScore?.home) ? "text-white" : "text-white/50"}>
                      {finalMatch.away_score ?? 0}
                    </span>
                  </div>
                  {penaltyScore && (
                    <div className="text-sm font-bold text-orange-400 mt-2 bg-orange-400/10 px-3 py-1 rounded-full border border-orange-400/20">
                      ({penaltyScore.home} - {penaltyScore.away} on pens)
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Swords className="w-8 h-8 text-[#fbbf24]/80" />
                  <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">Upcoming</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-4 w-1/3">
              <TeamColorBadge team={awayTeam} className="w-24 h-24 text-3xl shadow-lg rounded-2xl" />
              <span className="font-bold text-center text-white">{awayTeam?.name}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
