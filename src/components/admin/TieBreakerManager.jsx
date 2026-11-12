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

export default function TieBreakerManager({ settings, tournamentId, standings }) {
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

  const ties = getUnresolvedTies(standings);

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
    const rules = ruleList.filter((r) => r.enabled).map((r) => r.key);
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
    if (await saveConfig({ resolution: null })) toast.success("Tie resolution cleared");
  };

  const teamName = (id) => standings.find((s) => s.team.id === id)?.team.name || "Unknown team";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Scale className="w-5 h-5" /> Tie-Breakers</CardTitle>
        <CardDescription>
          Teams level on points are separated by the rules below, in order. If they are still level, you can decide manually,
          or record the result of a tie-breaker match or penalty shootout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ranking rules (after points)</div>
          {ruleList.map((r, i) => (
            <div key={r.key} className="flex items-center gap-3 p-2 rounded-md bg-white/[0.03] border border-white/5">
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={(e) => setRuleList(ruleList.map((x, idx) => (idx === i ? { ...x, enabled: e.target.checked } : x)))}
                className="rounded bg-black border-white/20"
              />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${r.enabled ? "text-white" : "text-slate-500"}`}>{TIEBREAKER_RULES[r.key].label}</div>
                <div className="text-xs text-slate-500">{TIEBREAKER_RULES[r.key].description}</div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => setRuleList(move(ruleList, i, -1))}><ArrowUp className="w-4 h-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === ruleList.length - 1} onClick={() => setRuleList(move(ruleList, i, 1))}><ArrowDown className="w-4 h-4" /></Button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button type="button" onClick={saveRules} disabled={saving}><Save className="w-4 h-4 mr-2" /> Save rules</Button>
            <Button type="button" variant="ghost" onClick={() => setRuleList(buildRuleList(DEFAULT_TIEBREAKER_RULES))}>Reset to default</Button>
          </div>
        </div>

        {ties.length > 0 && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-amber-500 text-sm font-bold">
              Some teams are still level after every rule. Choose how to separate them.
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(RESOLUTION_METHODS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, e.g. result of tie-breaker match (optional)" maxLength={200} />
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
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => setGroupOrders({ ...groupOrders, [group[0].tieGroup]: move(order, i, -1) })}><ArrowUp className="w-4 h-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === order.length - 1} onClick={() => setGroupOrders({ ...groupOrders, [group[0].tieGroup]: move(order, i, 1) })}><ArrowDown className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" onClick={() => applyResolution(group)} disabled={saving}>Apply order</Button>
                </div>
              );
            })}
          </div>
        )}

        {config.resolution && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-primary/5 border border-primary/20 text-sm">
            <div>
              <div className="font-bold text-primary">Tie resolved by: {RESOLUTION_METHODS[config.resolution.method] || "Admin decision"}</div>
              {config.resolution.note && <div className="text-xs text-slate-400">{config.resolution.note}</div>}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearResolution} disabled={saving}><RotateCcw className="w-4 h-4 mr-1" /> Clear</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
