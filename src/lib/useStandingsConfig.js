import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { getTiebreakConfig, computeCardPoints } from "./logic";

// Loads the tournament's tie-breaker config (live) and, when the fair-play rule is enabled,
// the card data needed to evaluate it. Returns a config object for computeStandings.
export function useStandingsConfig(tournamentId, teams, matches) {
  const [settings, setSettings] = useState(null);
  const [matchInfo, setMatchInfo] = useState([]);

  useEffect(() => {
    if (!tournamentId) return;
    const load = async () => {
      const { data } = await supabase.from("tournaments").select("*").eq("id", tournamentId).single();
      if (data) setSettings(data);
    };
    load();
    const channel = supabase
      .channel(`tiebreak_cfg_${tournamentId}_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tournamentId]);

  const needsCards = !!settings?.tiebreaker_config?.rules?.includes("fair_play");
  const matchIdsKey = (matches || []).map((m) => m.id).join(",");

  useEffect(() => {
    if (!needsCards || !matchIdsKey) { setMatchInfo([]); return; }
    supabase.from("match_info").select("*").in("match_id", matchIdsKey.split(","))
      .then(({ data }) => setMatchInfo(data || []));
  }, [needsCards, matchIdsKey, matches]);

  return useMemo(
    () => getTiebreakConfig(settings, computeCardPoints(matchInfo, teams || [])),
    [settings, matchInfo, teams]
  );
}
