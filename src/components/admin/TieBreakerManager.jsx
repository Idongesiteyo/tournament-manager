import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Save, Scale, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { TIEBREAKER_RULES, DEFAULT_TIEBREAKER_RULES, RESOLUTION_METHODS, getUnresolvedTies } from "../../lib/logic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const move = (arr, i, dir) => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
};

export default function TieBreakerManager({ settings, tournamentId, standings, hasPlayedMatches = false }) {
  const config = settings?.tiebreaker_config || {};
  const savedRules = Array.isArray(config.rules) ? config.rules : DEFAULT_TIEBREAKER_RULES;

  // Ordered list of ALL rules: enabled ones first (in saved order), then disabled ones
  const buildRuleList = (rules) => [
    ...rules.filter((r) => TIEBREAKER_RULES[r]).map((key) => ({ key, enabled: true })),
    ...Object.keys(TIEBREAKER_RULES).filter((k) => !rules.includes(k)).map((key) => ({ key, enabled: false })),
  ];

  const [ruleList, setRuleList] = useState(buildRuleList(savedRules));
  const [saving, setSaving] = useState(false);
  const [groupOrders, setGroupOrders] = useState({});
  const [method, setMethod] = useState("manual");
  const [note, setNote] = useState("");

  useEffect(() => {
    setRuleList(buildRuleList(savedRules));
  }, [JSON.stringify(savedRules)]);

  const ties = hasPlayedMatches ? getUnresolvedTies(standings) : [];
  const enabledRules = ruleList.filter((r) => r.enabled);
  const disabledRules = ruleList.filter((r) => !r.enabled);

  const toggleRule = (key, enabled) => {
    if (enabled) {
      const target = ruleList.find((r) => r.key === key);
      if (!target) return;
      setRuleList([...enabledRules, { ...target, enabled: true }, ...disabledRules.filter((r) => r.key !== key)]);
    } else {
      const target = ruleList.find((r) => r.key === key);
      if (!target) return;
      setRuleList([...enabledRules.filter((r) => r.key !== key), ...disabledRules, { ...target, enabled: false }]);
    }
  };

  const moveEnabledRule = (idxInEnabled, dir) => {
    const reordered = move(enabledRules, idxInEnabled, dir);
    setRuleList([...reordered, ...disabledRules]);
  };

  const saveConfig = async (patch) => {
    setSaving(true);
    const next = { rules: savedRules, resolution: config.resolution || null, ...patch };
    const { error } = await supabase.from("tournaments").update({ tiebreaker_config: next }).eq("id", tournamentId);
    setSaving(false);
    if (error) {
      toast.error("Could not save. Make sure the tiebreaker_config column exists (run supabase_tiebreakers.sql).");
      return false;
    }
    return true;
  };

  const saveRules = async () => {
    const rules = enabledRules.map((r) => r.key);
    if (await saveConfig({ rules })) toast.success("Tie-breaker rules saved");
  };

  const getGroupOrder = (group) => groupOrders[group[0].tieGroup] || group.map((s) => s.team.id);

  const applyResolution = async (group) => {
    const order = getGroupOrder(group);
    const groupIds = group.map((s) => s.team.id);
    const existing = (config.resolution?.order || []).filter((id) => !groupIds.includes(id));
    const resolution = {
      order: [...existing, ...order],
      method,
      note: note.trim() || null,
    };
    if (await saveConfig({ resolution })) {
      toast.success("Tie resolved");
      setNote("");
    }
  };

  const clearResolution = async () => {
    if (await saveConfig({ resolution: null })) toast.success("Manual tie resolution cleared");
  };

  const teamName = (id) => standings.find((s) => s.team.id === id)?.team.name || "Unknown team";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Scale className="w-5 h-5 text-primary" /> Tie-Breakers</CardTitle>
        <CardDescription>
          Teams level on points are separated by the active rules below, in order (1, 2, 3…). If teams remain inseparable after all active rules, you can record a manual decision, tie-breaker match, or penalty shootout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active ranking rules (after points)</div>
          {enabledRules.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No automatic tie-breaker rules enabled. Enable rules below.</p>
          ) : (
            enabledRules.map((r, i) => {
              const checkboxId = `tb-rule-${r.key}`;
              return (
                <div key={r.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/10">
                  <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-black flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={true}
                    onChange={(e) => toggleRule(r.key, e.target.checked)}
                    className="rounded bg-black border-white/20 cursor-pointer"
                  />
                  <label htmlFor={checkboxId} className="flex-1 min-w-0 cursor-pointer">
                    <div className="text-sm font-semibold text-white">{TIEBREAKER_RULES[r.key].label}</div>
                    <div className="text-xs text-slate-400">{TIEBREAKER_RULES[r.key].description}</div>
                  </label>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${TIEBREAKER_RULES[r.key].label} up`}
                      title="Move rule up"
                      className="h-8 w-8 text-slate-300 hover:text-white disabled:opacity-30"
                      disabled={i === 0}
                      onClick={() => moveEnabledRule(i, -1)}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${TIEBREAKER_RULES[r.key].label} down`}
                      title="Move rule down"
                      className="h-8 w-8 text-slate-300 hover:text-white disabled:opacity-30"
                      disabled={i === enabledRules.length - 1}
                      onClick={() => moveEnabledRule(i, 1)}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}

          {disabledRules.length > 0 && (
            <div className="pt-2 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Inactive rules (check to enable)</div>
              {disabledRules.map((r) => {
                const checkboxId = `tb-rule-${r.key}`;
                return (
                  <div key={r.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.01] border border-white/5 opacity-70">
                    <span className="w-6 h-6 rounded-full bg-white/5 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0">
                      –
                    </span>
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={false}
                      onChange={(e) => toggleRule(r.key, e.target.checked)}
                      className="rounded bg-black border-white/20 cursor-pointer"
                    />
                    <label htmlFor={checkboxId} className="flex-1 min-w-0 cursor-pointer">
                      <div className="text-sm font-semibold text-slate-400">{TIEBREAKER_RULES[r.key].label}</div>
                      <div className="text-xs text-slate-500">{TIEBREAKER_RULES[r.key].description}</div>
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={saveRules} disabled={saving}>
              <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save Rules"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/10"
              onClick={() => setRuleList(buildRuleList(DEFAULT_TIEBREAKER_RULES))}
            >
              Reset to Default
            </Button>
          </div>
        </div>

        {ties.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-amber-500 text-sm font-bold">
              Some teams are still level after every active rule. Choose how to separate them.
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="sm:w-56">
                <label htmlFor="tb-resolution-method" className="text-xs text-slate-400 block mb-1">Resolution method</label>
                <select
                  id="tb-resolution-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {Object.entries(RESOLUTION_METHODS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="tb-resolution-note" className="text-xs text-slate-400 block mb-1">Resolution note (optional)</label>
                <Input
                  id="tb-resolution-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Won 4–3 on penalties in playoff"
                  maxLength={200}
                />
              </div>
            </div>
            {ties.map((group) => {
              const order = getGroupOrder(group);
              return (
                <div key={group[0].tieGroup} className="space-y-2 p-3 rounded-md border border-white/10">
                  <div className="text-xs text-muted-foreground">Level on {group[0].pts} pts — set final order (top = ranked highest)</div>
                  {order.map((id, i) => (
                    <div key={id} className="flex items-center gap-3 p-2 rounded bg-white/[0.03]">
                      <span className="w-6 text-center font-bold text-primary">{group[0].position + i}</span>
                      <span className="flex-1 text-sm font-semibold">{teamName(id)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${teamName(id)} up`}
                        title="Move team up"
                        className="h-8 w-8 text-slate-300 hover:text-white"
                        disabled={i === 0}
                        onClick={() => setGroupOrders({ ...groupOrders, [group[0].tieGroup]: move(order, i, -1) })}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${teamName(id)} down`}
                        title="Move team down"
                        className="h-8 w-8 text-slate-300 hover:text-white"
                        disabled={i === order.length - 1}
                        onClick={() => setGroupOrders({ ...groupOrders, [group[0].tieGroup]: move(order, i, 1) })}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" onClick={() => applyResolution(group)} disabled={saving}>Apply Order</Button>
                </div>
              );
            })}
          </div>
        )}

        {hasPlayedMatches && config.resolution && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-md bg-primary/5 border border-primary/20 text-sm">
            <div>
              <div className="font-bold text-primary">Tie resolved by: {RESOLUTION_METHODS[config.resolution.method] || "Admin decision"}</div>
              {config.resolution.note && <div className="text-xs text-slate-400">{config.resolution.note}</div>}
              <div className="text-[11px] text-slate-500 mt-0.5">
                Clearing removes this manual override and reverts tied teams to automatic rules.
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              title="Remove manual tie resolution and revert to automatic rules"
              onClick={clearResolution}
              disabled={saving}
              className="border-white/10 shrink-0"
            >
              <RotateCcw className="w-4 h-4 mr-1" /> Clear Override
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
