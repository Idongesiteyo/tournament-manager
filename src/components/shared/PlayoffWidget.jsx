import { Lock, Trophy, Swords } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { TeamColorBadge } from "./TeamColorBadge";

export function PlayoffWidget({ isComplete, matches, teams, settings }) {
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

    return (
      <Card className="mb-6 border-[#fbbf24]/30 bg-[#0f1423] overflow-hidden relative shadow-[0_0_15px_rgba(251,191,36,0.1)]">
        {isCompleted && (
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-xs font-bold rounded-bl-lg flex items-center gap-1">
            <Trophy className="w-3 h-3" /> CHAMPION CROWNED
          </div>
        )}
        <CardHeader className="pb-3 pt-4 border-b border-white/5">
          <CardTitle className="text-center text-[#fbbf24] font-black tracking-wide text-lg flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5" /> Championship Final
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-8 pb-10">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-4 w-1/3">
              <TeamColorBadge team={homeTeam} className="w-24 h-24 text-3xl shadow-lg rounded-2xl" />
              <span className="font-bold text-center text-white">{homeTeam?.name}</span>
            </div>
            
            <div className="w-1/3 flex flex-col items-center justify-center">
              {isCompleted ? (
                <div className="flex items-center justify-center gap-3 text-5xl font-black">
                  <span className={finalMatch.home_score > finalMatch.away_score ? "text-white" : "text-white/50"}>
                    {finalMatch.home_score}
                  </span>
                  <span className="text-white/30 text-3xl">-</span>
                  <span className={finalMatch.away_score > finalMatch.home_score ? "text-white" : "text-white/50"}>
                    {finalMatch.away_score}
                  </span>
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
