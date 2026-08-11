import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Trophy, Save, PlayCircle } from "lucide-react";
import { toast } from "sonner";

interface Kpi { id: string; name: string; kpi_type: string }
interface Tier { id?: string; threshold: string; payout: string; label: string }
interface Run {
  id: string; month_year: string; meta: number | null; realizado: number | null; pct: number | null;
  payout_cents: number; status: string; detail: string | null; created_at: string;
}

const money = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toCents = (s: string) => Math.round(parseFloat(String(s).replace(/\./g, "").replace(",", ".")) * 100) || 0;
const fromCents = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const STATUS_LABEL: Record<string, string> = {
  paid_tier: "Faturado", no_tier: "Não bateu", no_target: "Sem meta", error: "Erro",
};

export function CompanyCommissionRule({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);

  const [ruleId, setRuleId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [kpiId, setKpiId] = useState<string>("");
  const [basis, setBasis] = useState<"percent" | "value">("percent");
  const [dueDay, setDueDay] = useState("5");
  const [description, setDescription] = useState("");
  const [tiers, setTiers] = useState<Tier[]>([{ threshold: "100", payout: "", label: "Meta batida" }]);

  const load = useCallback(async () => {
    setLoading(true);
    const [kpiRes, ruleRes, runRes] = await Promise.all([
      supabase.from("company_kpis").select("id, name, kpi_type").eq("company_id", companyId).eq("is_active", true).order("sort_order"),
      (supabase as any).from("company_commission_rules").select("*").eq("company_id", companyId).maybeSingle(),
      (supabase as any).from("company_commission_runs").select("id, month_year, meta, realizado, pct, payout_cents, status, detail, created_at")
        .eq("company_id", companyId).order("month_year", { ascending: false }).limit(12),
    ]);
    setKpis((kpiRes.data as Kpi[]) || []);
    setRuns((runRes.data as Run[]) || []);

    const rule = ruleRes.data as any;
    if (rule) {
      setRuleId(rule.id);
      setIsActive(!!rule.is_active);
      setKpiId(rule.kpi_id || "");
      setBasis(rule.basis === "value" ? "value" : "percent");
      setDueDay(String(rule.due_day || 5));
      setDescription(rule.description || "");
      const { data: t } = await (supabase as any).from("company_commission_tiers")
        .select("id, threshold, payout_cents, label").eq("rule_id", rule.id).order("threshold");
      setTiers(((t as any[]) || []).map((x) => ({
        id: x.id, threshold: String(x.threshold).replace(".", ","), payout: fromCents(x.payout_cents), label: x.label || "",
      })));
      if (!t?.length) setTiers([{ threshold: "100", payout: "", label: "Meta batida" }]);
    }
    setLoading(false);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const addTier = () => setTiers((p) => [...p, { threshold: "", payout: "", label: "" }]);
  const removeTier = (i: number) => setTiers((p) => p.filter((_, idx) => idx !== i));
  const setTier = (i: number, k: keyof Tier, v: string) =>
    setTiers((p) => p.map((t, idx) => (idx === i ? { ...t, [k]: v } : t)));

  const save = async () => {
    if (isActive && !kpiId) { toast.error("Escolha o KPI que será olhado"); return; }
    const clean = tiers
      .map((t) => ({ ...t, thresholdNum: parseFloat(String(t.threshold).replace(",", ".")), payoutCents: toCents(t.payout) }))
      .filter((t) => isFinite(t.thresholdNum) && t.payoutCents > 0);
    if (isActive && !clean.length) { toast.error("Cadastre ao menos uma faixa (quanto atingir e quanto recebe)"); return; }

    setSaving(true);
    try {
      const payload = {
        company_id: companyId, kpi_id: kpiId || null, basis, is_active: isActive,
        description: description.trim() || null, due_day: Number(dueDay) || 5,
        updated_at: new Date().toISOString(),
      };
      let id = ruleId;
      if (id) {
        const { error } = await (supabase as any).from("company_commission_rules").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("company_commission_rules").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id; setRuleId(id);
      }
      // faixas: regrava do zero (lista curta, evita divergência)
      await (supabase as any).from("company_commission_tiers").delete().eq("rule_id", id);
      if (clean.length) {
        const rows = clean
          .sort((a, b) => a.thresholdNum - b.thresholdNum)
          .map((t, i) => ({ rule_id: id, threshold: t.thresholdNum, payout_cents: t.payoutCents, label: t.label.trim() || null, sort_order: i }));
        const { error } = await (supabase as any).from("company_commission_tiers").insert(rows);
        if (error) throw error;
      }
      toast.success(isActive ? "Comissão ativada e salva" : "Comissão salva (desativada)");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  };

  const simulate = async () => {
    if (!ruleId || !isActive) { toast.error("Ative e salve a comissão antes de simular"); return; }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("commission-engine", {
        body: { company_id: companyId, dry_run: true },
      });
      if (error) throw error;
      const r = (data as any)?.results?.[0];
      if (!r) { toast.error("Sem retorno do cálculo"); return; }
      if (r.status === "dry") {
        toast.success(`Bateria: ${r.realizado} de ${r.meta} (${r.pct}%) → faixa "${r.tier || "—"}" = ${money(r.payout_cents)} vencendo ${r.due_date}`, { duration: 9000 });
      } else if (r.status === "no_tier") {
        toast.message(`Não atingiu nenhuma faixa (medida ${r.medida}) na competência ${(data as any).competencia}`, { duration: 8000 });
      } else if (r.status === "no_target") {
        toast.message(`Sem meta cadastrada na competência ${(data as any).competencia}`, { duration: 8000 });
      } else {
        toast.message(JSON.stringify(r).slice(0, 200));
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao simular");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const unit = basis === "percent" ? "% da meta" : "valor do KPI";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Trophy className="h-4 w-4 text-amber-500" /> Comissão por resultado
                <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Ativa" : "Desativada"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                Todo dia 1 o sistema apura o mês anterior pelos KPIs do projeto. Se o cliente bateu, gera a fatura
                da faixa correspondente vencendo no dia {dueDay || 5} do mês da apuração. Desmarcada, nada é cobrado.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {isActive && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">KPI observado</Label>
                  <Select value={kpiId} onValueChange={setKpiId}>
                    <SelectTrigger><SelectValue placeholder="Escolha o KPI" /></SelectTrigger>
                    <SelectContent>
                      {kpis.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!kpis.length && <p className="text-[11px] text-muted-foreground mt-1">Nenhum KPI ativo neste cliente.</p>}
                </div>
                <div>
                  <Label className="text-xs">A faixa é medida por</Label>
                  <Select value={basis} onValueChange={(v) => setBasis(v as "percent" | "value")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">% da meta (ex: 100%)</SelectItem>
                      <SelectItem value="value">Valor do KPI (ex: 500.000)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Vencimento da fatura</Label>
                  <Select value={dueDay} onValueChange={setDueDay}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 5, 10, 15, 20, 25].map((d) => <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Descrição da fatura (opcional)</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder={`Comissão por resultado — ${companyName}`} />
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Faixas — vale a maior atingida</Label>
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={addTier}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar faixa
                  </Button>
                </div>
                {tiers.map((t, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr_auto] items-end">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Se atingir ({unit})</Label>
                      <Input value={t.threshold} onChange={(e) => setTier(i, "threshold", e.target.value)} placeholder={basis === "percent" ? "100" : "500000"} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Recebe (R$)</Label>
                      <Input value={t.payout} onChange={(e) => setTier(i, "payout", e.target.value)} placeholder="2.000,00" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Nome da faixa (opcional)</Label>
                      <Input value={t.label} onChange={(e) => setTier(i, "label", e.target.value)} placeholder="Meta / Superação…" />
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeTier(i)} disabled={tiers.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </Button>
            {isActive && ruleId && (
              <Button variant="outline" onClick={simulate} disabled={testing} className="gap-2">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} Simular mês anterior
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {runs.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h4 className="font-semibold text-sm mb-3">Apurações</h4>
            <div className="space-y-2">
              {runs.map((r) => (
                <div key={r.id} className="flex items-center gap-3 text-sm border rounded-md p-2.5">
                  <span className="font-semibold w-20">{r.month_year}</span>
                  <Badge variant={r.status === "paid_tier" ? "default" : r.status === "error" ? "destructive" : "secondary"} className="text-[10px]">
                    {STATUS_LABEL[r.status] || r.status}
                  </Badge>
                  <span className="flex-1 text-xs text-muted-foreground truncate">{r.detail}</span>
                  {r.payout_cents > 0 && <span className="font-bold tabular-nums">{money(r.payout_cents)}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
