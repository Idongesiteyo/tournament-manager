import { Lock, Trophy } from "lucide-react";
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
      <Card className="mb-6 border-primary/50 bg-gradient-to-br from-card via-card to-primary/10 overflow-hidden relative">
        {isCompleted && (
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-xs font-bold rounded-bl-lg flex items-center gap-1">
            <Trophy className="w-3 h-3" /> CHAMPION CROWNED
          </div>
        )}
        <CardHeader className="pb-2 pt-6">
          <CardTitle className="text-center text-primary font-black uppercase tracking-widest text-lg">
            Championship Final
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mt-4">
            <div className="flex flex-col items-center gap-2 w-1/3">
              <TeamColorBadge team={homeTeam} className="w-16 h-16 text-2xl shadow-lg" />
              <span className="font-bold text-center text-sm">{homeTeam?.name}</span>
            </div>
            
            <div className="w-1/3 flex flex-col items-center justify-center">
              {isCompleted ? (
                <div className="flex items-center justify-center gap-3 text-4xl font-black">
                  <span className={finalMatch.home_score > finalMatch.away_score ? "text-primary" : "text-muted-foreground"}>
                    {finalMatch.home_score}
                  </span>
                  <span className="text-muted-foreground text-2xl">-</span>
                  <span className={finalMatch.away_score > finalMatch.home_score ? "text-primary" : "text-muted-foreground"}>
                    {finalMatch.away_score}
                  </span>
                </div>
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">VS</span>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 w-1/3">
              <TeamColorBadge team={awayTeam} className="w-16 h-16 text-2xl shadow-lg" />
              <span className="font-bold text-center text-sm">{awayTeam?.name}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
