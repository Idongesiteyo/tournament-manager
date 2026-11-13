// ---------------------------------------------------------------------------
// Tie-breaker configuration
// ---------------------------------------------------------------------------
// Rules are applied in order, only to teams still level on points.
export const TIEBREAKER_RULES = {
  gd: { label: "Goal difference", description: "Higher goal difference ranks first" },
  gf: { label: "Goals scored", description: "More goals scored ranks first" },
  ga: { label: "Goals conceded", description: "Fewer goals conceded ranks first" },
  wins: { label: "Number of wins", description: "More wins ranks first" },
  h2h: { label: "Head-to-head", description: "Points from matches between the tied teams" },
  fair_play: { label: "Fair play", description: "Fewer cards (yellow = 1, red = 3) ranks first" },
};

export const DEFAULT_TIEBREAKER_RULES = ["gd", "gf", "h2h"];

export const RESOLUTION_METHODS = {
  manual: "Admin decision",
  playoff: "Tie-breaker match",
  penalties: "Penalty shootout",
};

// Builds the config object consumed by computeStandings from a tournaments row.
// tiebreaker_config shape: { rules: string[], resolution: { order: teamId[], method, note } | null }
export function getTiebreakConfig(settings, cardPoints = {}) {
  const cfg = settings?.tiebreaker_config || {};
  const rules = Array.isArray(cfg.rules) ? cfg.rules.filter((r) => TIEBREAKER_RULES[r]) : DEFAULT_TIEBREAKER_RULES;
  return { rules, resolution: cfg.resolution || null, cardPoints };
}

// Fair-play points per team name from match_info rows (yellow = 1, red = 3)
export function computeCardPoints(matchInfoRows, teams) {
  const byName = {};
  teams.forEach((t) => { byName[t.name] = t.id; });
  const pts = {};
  (matchInfoRows || []).forEach((row) => {
    (row.yellow_cards || []).forEach((c) => {
      const id = byName[c.team_name];
      if (id) pts[id] = (pts[id] || 0) + 1;
    });
    (row.red_cards || []).forEach((c) => {
      const id = byName[c.team_name];
      if (id) pts[id] = (pts[id] || 0) + 3;
    });
  });
  return pts;
}

export function computeStandings(teams, matches, config = {}) {
  const rules = config.rules || DEFAULT_TIEBREAKER_RULES;
  const resolutionOrder = config.resolution?.order || [];
  const cardPoints = config.cardPoints || {};

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

  const regularDone = matches.filter((m) => m.stage === "regular" && m.status === "completed");

  regularDone.forEach((match) => {
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
  });

  standings.forEach((s) => {
    s.gd = s.gf - s.ga;
  });

  // Points from matches played only among the given group of teams
  const h2hPoints = (group) => {
    const ids = group.map((s) => s.team.id);
    const result = new Map(ids.map((id) => [id, 0]));
    regularDone.forEach((m) => {
      if (!ids.includes(m.home_team_id) || !ids.includes(m.away_team_id)) return;
      if (m.home_score > m.away_score) result.set(m.home_team_id, result.get(m.home_team_id) + 3);
      else if (m.home_score < m.away_score) result.set(m.away_team_id, result.get(m.away_team_id) + 3);
      else {
        result.set(m.home_team_id, result.get(m.home_team_id) + 1);
        result.set(m.away_team_id, result.get(m.away_team_id) + 1);
      }
    });
    return result;
  };

  // Value per team for a rule (higher is better)
  const ruleValue = (rule, group) => {
    if (rule === "h2h") {
      const map = h2hPoints(group);
      return (s) => map.get(s.team.id);
    }
    return (s) => {
      switch (rule) {
        case "gd": return s.gd;
        case "gf": return s.gf;
        case "ga": return -s.ga;
        case "wins": return s.w;
        case "fair_play": return -(cardPoints[s.team.id] || 0);
        default: return 0;
      }
    };
  };

  // Splits a group of level teams into ranked sub-groups by applying the remaining rules in order
  const rank = (group, remainingRules) => {
    if (group.length < 2 || remainingRules.length === 0) return [group];
    const [rule, ...rest] = remainingRules;
    const value = ruleValue(rule, group);
    const sorted = [...group].sort((a, b) => value(b) - value(a));
    const subGroups = [];
    sorted.forEach((s) => {
      const last = subGroups[subGroups.length - 1];
      if (last && value(last[0]) === value(s)) last.push(s);
      else subGroups.push([s]);
    });
    return subGroups.flatMap((g) => rank(g, rest));
  };

  // If no matches have been played at all, sort teams alphabetically
  if (regularDone.length === 0) {
    return [...standings]
      .sort((a, b) => a.team.name.localeCompare(b.team.name))
      .map((s) => ({ ...s, tied: false, tieGroup: null, resolvedBy: null }));
  }

  // 1. Group by points, 2. apply each configured tie-breaker rule in order
  const byPoints = [...standings].sort((a, b) => b.pts - a.pts);
  const pointGroups = [];
  byPoints.forEach((s) => {
    const last = pointGroups[pointGroups.length - 1];
    if (last && last[0].pts === s.pts) last.push(s);
    else pointGroups.push([s]);
  });
  const rankedGroups = pointGroups.flatMap((g) => rank(g, rules));

  // 3. Any teams still inseparable: use the admin resolution (manual / tie-breaker match / shootout)
  const result = [];
  let groupId = 0;
  rankedGroups.forEach((group) => {
    if (group.length < 2) {
      group[0].tied = false;
      group[0].tieGroup = null;
      result.push(group[0]);
      return;
    }
    const pos = (s) => {
      const i = resolutionOrder.indexOf(s.team.id);
      return i === -1 ? Infinity : i;
    };
    const resolved = group.every((s) => pos(s) !== Infinity);
    const ordered = resolved ? [...group].sort((a, b) => pos(a) - pos(b)) : group;
    groupId += 1;
    ordered.forEach((s) => {
      s.tied = !resolved;
      s.tieGroup = resolved ? null : groupId;
      s.resolvedBy = resolved ? config.resolution?.method || "manual" : null;
      result.push(s);
    });
  });

  return result;
}

// True when the first two places cannot be separated by any tiebreaker
export function isTopTied(standings) {
  return standings.length > 1 && standings[0].tied && standings[1].tied &&
    standings[0].tieGroup === standings[1].tieGroup;
}

// Groups of teams that are still level after every rule and have not been resolved
export function getUnresolvedTies(standings) {
  const groups = {};
  standings.forEach((s, i) => {
    if (s.tied) groups[s.tieGroup] = [...(groups[s.tieGroup] || []), { ...s, position: i + 1 }];
  });
  return Object.values(groups);
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

export function sortMatches(a, b) {
  if (a.matchday !== b.matchday) return a.matchday - b.matchday;
  const timeA = a.match_date ? new Date(a.match_date).getTime() : Infinity;
  const timeB = b.match_date ? new Date(b.match_date).getTime() : Infinity;
  if (timeA !== timeB) return timeA - timeB;
  return String(a.id).localeCompare(String(b.id));
}

export function getRecentForm(teamId, matches) {
  const teamMatches = matches
    .filter(
      (m) =>
        m.stage === "regular" &&
        m.status === "completed" &&
        (m.home_team_id === teamId || m.away_team_id === teamId)
    )
    .sort(sortMatches); // chronological

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
