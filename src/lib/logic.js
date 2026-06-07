export function computeStandings(teams, matches) {
  const standings = teams.map((team) => ({
    team,
    mp: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    pts: 0,
  }));

  const teamIndex = new Map(standings.map((s, idx) => [s.team.id, idx]));

  matches.forEach((match) => {
    if (match.stage === "regular" && match.status === "completed") {
      const home = standings[teamIndex.get(match.home_team_id)];
      const away = standings[teamIndex.get(match.away_team_id)];

      if (!home || !away) return;

      home.mp += 1;
      away.mp += 1;
      home.gf += match.home_score;
      home.ga += match.away_score;
      away.gf += match.away_score;
      away.ga += match.home_score;

      if (match.home_score > match.away_score) {
        home.w += 1;
        home.pts += 3;
        away.l += 1;
      } else if (match.home_score < match.away_score) {
        away.w += 1;
        away.pts += 3;
        home.l += 1;
      } else {
        home.d += 1;
        home.pts += 1;
        away.d += 1;
        away.pts += 1;
      }
    }
  });

  standings.forEach((s) => {
    s.gd = s.gf - s.ga;
  });

  // Sort: PTS, GD, GF
  standings.sort((a, b) => {
    if (a.pts !== b.pts) return b.pts - a.pts;
    if (a.gd !== b.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });

  return standings;
}

export function generateSchedule(teams) {
  if (teams.length !== 4) return [];

  const t = teams.map((team) => team.id);
  const pairings = [
    // Matchday 1
    { home: t[0], away: t[3], md: 1 },
    { home: t[1], away: t[2], md: 1 },
    // Matchday 2
    { home: t[3], away: t[1], md: 2 },
    { home: t[2], away: t[0], md: 2 },
    // Matchday 3
    { home: t[0], away: t[1], md: 3 },
    { home: t[2], away: t[3], md: 3 },
    // Matchday 4
    { home: t[3], away: t[0], md: 4 },
    { home: t[2], away: t[1], md: 4 },
    // Matchday 5
    { home: t[1], away: t[3], md: 5 },
    { home: t[0], away: t[2], md: 5 },
    // Matchday 6
    { home: t[1], away: t[0], md: 6 },
    { home: t[3], away: t[2], md: 6 },
  ];

  return pairings.map((p, idx) => ({
    id: `m_${Date.now()}_${idx}`,
    home_team_id: p.home,
    away_team_id: p.away,
    home_score: null,
    away_score: null,
    matchday: p.md,
    status: "scheduled",
    stage: "regular",
    winner_team_id: null,
  }));
}

export function isSeasonComplete(matches) {
  const regularMatches = matches.filter((m) => m.stage === "regular");
  return (
    regularMatches.length === 12 &&
    regularMatches.every((m) => m.status === "completed")
  );
}

export function getRecentForm(teamId, matches) {
  const teamMatches = matches
    .filter(
      (m) =>
        m.stage === "regular" &&
        m.status === "completed" &&
        (m.home_team_id === teamId || m.away_team_id === teamId)
    )
    .sort((a, b) => a.matchday - b.matchday); // chronological

  const recent = teamMatches.slice(-5); // last 5

  return recent.map((m) => {
    const isHome = m.home_team_id === teamId;
    const teamScore = isHome ? m.home_score : m.away_score;
    const oppScore = isHome ? m.away_score : m.home_score;

    if (teamScore > oppScore) return "W";
    if (teamScore < oppScore) return "L";
    return "D";
  });
}
