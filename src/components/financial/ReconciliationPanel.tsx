import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, Link2, Undo2, EyeOff, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Entry {
  id: string; entry_date: string; amount_cents: number; kind: string; entry_type: string | null;
  description: string | null; provider_payment_id: string | null; status: string;
  match_kind: string | null; match_id: string | null; match_confidence: string | null;
  match_reason: string | null; auto_settled: boolean;
}
interface Run {
  id: string; created_at: string; imported: number; auto_matched: number; needs_review: number;
  provider_balance_cents: number | null; system_balance_cents: number | null; diff_cents: number | null;
}
interface Candidate { id: string; description: string | null; amount: number; due_date: string | null; status: string; party: string | null }
interface SaldoConta {
  id: string; name: string; current_balance_cents: number;
  provider_balance_cents: number | null; provider_balance_at: string | null; provider_balance_error: string | null;
}

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (d: string) => d.split("-").reverse().join("/");

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  matched: { label: "Conciliado", variant: "default" },
  review: { label: "Revisar", variant: "destructive" },
  pending: { label: "Pendente", variant: "secondary" },
  ignored: { label: "Ignorado", variant: "outline" },
};

export function ReconciliationPanel() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [lastRun, setLastRun] = useState<Run | null>(null);
  const [filter, setFilter] = useState<string>("review");
  const [linking, setLinking] = useState<Entry | null>(null);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [candFrom, setCandFrom] = useState("");
  const [candTo, setCandTo] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [saldos, setSaldos] = useState<SaldoConta[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("financial_statement_entries")
      .select("*").eq("provider", "asaas").order("entry_date", { ascending: false }).limit(300);
    if (filter !== "all") q = q.eq("status", filter);
    if (dateFrom) q = q.gte("entry_date", dateFrom);
    if (dateTo) q = q.lte("entry_date", dateTo);
    const [entRes, runRes, saldoRes] = await Promise.all([
      q,
      (supabase as any).from("financial_reconciliation_runs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from("financial_banks")
        .select("id, name, current_balance_cents, provider_balance_cents, provider_balance_at, provider_balance_error")
        .ilike("name", "%asaas%").order("name"),
    ]);
    setEntries((entRes.data as Entry[]) || []);
    setLastRun((runRes.data as Run) || null);
    setSaldos((saldoRes.data as SaldoConta[]) || []);
    setLoading(false);
  }, [filter, dateFrom, dateTo]);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-reconcile", { body: { pages: 6 } });
      if (error) throw error;
      const d = data as any;
      if (!d?.ok) throw new Error(d?.error || "falha na conciliação");
      const partes = [
        `${d.imported} novos`,
        `${d.auto_matched} conciliados`,
        `${d.needs_review} pra classificar`,
        d.fila_antiga_quitada ? `${d.fila_antiga_quitada} pendência(s) antiga(s) lançada(s) no saldo` : "",
        d.residuo ? `resíduo de ${brl(d.residuo.cents)} lançado — saldo igualado ao Asaas` : "",
      ].filter(Boolean);
      toast.success(partes.join(" · "), { duration: 10000 });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao conciliar");
    } finally {
      setRunning(false);
    }
  };

  const openLink = async (e: Entry) => {
    setLinking(e); setSearch(""); setCands([]);
    const isCredit = e.kind === "credit";
    const table = isCredit ? "financial_receivables" : "financial_payables";
    // Nome real de quem paga/recebe: sem ele a lista vira "Venda 1704012" e não
    // dá pra saber de quem é o título.
    const cols = isCredit
      ? "id, description, amount, due_date, status, custom_receiver_name, company:onboarding_companies(name)"
      : "id, description, amount, due_date, status, supplier_name";
    const { data } = await (supabase as any).from(table)
      .select(cols).neq("status", "paid")
      .order("due_date", { ascending: false }).limit(400);
    setCands(((data as any[]) || []).map((r) => ({
      id: r.id, description: r.description, amount: r.amount, due_date: r.due_date, status: r.status,
      party: isCredit ? (r.custom_receiver_name || r.company?.name || null) : (r.supplier_name || null),
    })));
  };

  const confirmLink = async (c: Candidate) => {
    if (!linking) return;
    const e = linking;
    const table = e.kind === "credit" ? "financial_receivables" : "financial_payables";
    const valor = Math.abs(e.amount_cents) / 100;
    const { error: upErr } = await (supabase as any).from(table).update({
      status: "paid", paid_date: e.entry_date, paid_amount: valor, updated_at: new Date().toISOString(),
    }).eq("id", c.id);
    if (upErr) { toast.error("Sem permissão para dar baixa"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase as any).from("financial_statement_entries").update({
      status: "matched", match_kind: e.kind === "credit" ? "receivable" : "payable", match_id: c.id,
      match_confidence: "manual", match_reason: `vinculado manualmente (${[c.party, c.description].filter(Boolean).join(" — ")})`.trim(),
      auto_settled: false, reviewed_by: user?.id || null, reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", e.id);
    toast.success("Vinculado e baixado");
    setLinking(null); load();
  };

  const undo = async (e: Entry) => {
    if (!window.confirm("Desfazer a conciliação? O título volta para em aberto.")) return;
    if (e.match_id && (e.match_kind === "receivable" || e.match_kind === "payable")) {
      const table = e.match_kind === "receivable" ? "financial_receivables" : "financial_payables";
      await (supabase as any).from(table).update({
        status: "pending", paid_date: null, paid_amount: null, updated_at: new Date().toISOString(),
      }).eq("id", e.match_id);
    }
    const { error } = await (supabase as any).from("financial_statement_entries").update({
      status: "review", match_kind: null, match_id: null, match_confidence: null,
      match_reason: "conciliação desfeita manualmente", auto_settled: false, updated_at: new Date().toISOString(),
    }).eq("id", e.id);
    if (error) { toast.error("Sem permissão para editar"); return; }
    toast.success("Conciliação desfeita");
    load();
  };

  const ignore = async (e: Entry) => {
    const { error } = await (supabase as any).from("financial_statement_entries").update({
      status: "ignored", match_reason: "marcado como sem efeito no financeiro", updated_at: new Date().toISOString(),
    }).eq("id", e.id);
    if (error) { toast.error("Sem permissão para editar"); return; }
    load();
  };

  const filtered = cands.filter((c) => {
    const q = search.trim().toLowerCase();
    if (q && !(c.description || "").toLowerCase().includes(q)
          && !(c.party || "").toLowerCase().includes(q)
          && !String(c.amount).includes(q)) return false;
    if (candFrom && (!c.due_date || c.due_date < candFrom)) return false;
    if (candTo && (!c.due_date || c.due_date > candTo)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" /> Conciliação bancária — Asaas
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Importa o extrato e dá baixa sozinho quando tem certeza (id do Asaas, ou valor e vencimento
              batendo com um único título). Na dúvida, o dinheiro entra no saldo de qualquer jeito e fica
              aqui só a classificação: dizer de qual título é. Por isso o saldo do sistema acompanha o Asaas
              mesmo com pendência na fila.
            </p>
            {lastRun && (
              <div className="flex flex-wrap gap-3 mt-3 text-xs">
                <span>Última rodada: <b>{new Date(lastRun.created_at).toLocaleString("pt-BR")}</b></span>
                <span className="text-emerald-600">✅ {lastRun.auto_matched} conciliados</span>
                <span className="text-rose-600">⚠️ {lastRun.needs_review} a revisar</span>
                {lastRun.provider_balance_cents != null && (
                  <span>Asaas: <b>{brl(lastRun.provider_balance_cents)}</b></span>
                )}
                {lastRun.system_balance_cents != null && (
                  <span>Sistema: <b>{brl(lastRun.system_balance_cents)}</b></span>
                )}
                {lastRun.diff_cents != null && lastRun.diff_cents !== 0 && (
                  <span className="text-rose-600 font-semibold">Diferença: {brl(lastRun.diff_cents)}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="review">Precisam revisão</SelectItem>
                <SelectItem value="matched">Conciliados</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="ignored">Ignorados</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Input type="date" value={dateFrom} onChange={(ev) => setDateFrom(ev.target.value)}
                className="w-[145px]" title="Lançamentos a partir de" />
              <span className="text-muted-foreground text-sm">até</span>
              <Input type="date" value={dateTo} onChange={(ev) => setDateTo(ev.target.value)}
                className="w-[145px]" title="Lançamentos até" />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Limpar</Button>
              )}
            </div>
            <Button onClick={run} disabled={running} className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Conciliar agora
            </Button>
          </div>
        </CardContent>
      </Card>

      {saldos.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Saldo real de cada conta Asaas
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Lido direto no Asaas na última conciliação. É a conferência: quando o razão do Nexus se afasta,
              a diferença aparece aqui em vez de passar batido.
            </p>
            <div className="grid gap-2 mt-3 md:grid-cols-2">
              {saldos.map((b) => {
                const dif = b.provider_balance_cents != null
                  ? b.provider_balance_cents - Number(b.current_balance_cents || 0) : null;
                return (
                  <div key={b.id} className="border rounded-md p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{b.name}</span>
                      {b.provider_balance_error ? (
                        <Badge variant="destructive" className="text-[10px]">sem leitura</Badge>
                      ) : dif === 0 ? (
                        <Badge variant="default" className="text-[10px]">batendo</Badge>
                      ) : dif != null ? (
                        <Badge variant="destructive" className="text-[10px]">{brl(dif)}</Badge>
                      ) : null}
                    </div>
                    {b.provider_balance_error ? (
                      <p className="text-[11px] text-rose-600 mt-1.5">{b.provider_balance_error}</p>
                    ) : (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs">
                        <span>No Asaas: <b className="tabular-nums">{b.provider_balance_cents != null ? brl(b.provider_balance_cents) : "—"}</b></span>
                        <span className="text-muted-foreground">No Nexus: <b className="tabular-nums">{brl(Number(b.current_balance_cents || 0))}</b></span>
                      </div>
                    )}
                    {b.provider_balance_at && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Conferido em {new Date(b.provider_balance_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nada aqui neste filtro.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => {
                const st = STATUS[e.status] || { label: e.status, variant: "secondary" as const };
                const credito = e.kind === "credit";
                return (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 border rounded-md p-3">
                    <span className="text-xs text-muted-foreground w-20">{dt(e.entry_date)}</span>
                    <span className={`font-bold tabular-nums w-32 ${credito ? "text-emerald-600" : "text-rose-600"}`}>
                      {credito ? "+" : "−"}{brl(Math.abs(e.amount_cents))}
                    </span>
                    <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                    {e.match_confidence && e.status === "matched" && (
                      <Badge variant="outline" className="text-[10px]">
                        {e.match_confidence === "exact" ? "id do Asaas" : e.match_confidence === "high" ? "valor+data" : "manual"}
                      </Badge>
                    )}
                    <div className="flex-1 min-w-[220px]">
                      <p className="text-sm truncate">{e.description || e.entry_type}</p>
                      {e.match_reason && <p className="text-[11px] text-muted-foreground truncate">{e.match_reason}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {e.status !== "matched" && (
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => openLink(e)}>
                          <Link2 className="h-3.5 w-3.5" /> Vincular
                        </Button>
                      )}
                      {e.status === "matched" && e.match_kind !== "fee" && (
                        <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => undo(e)}>
                          <Undo2 className="h-3.5 w-3.5" /> Desfazer
                        </Button>
                      )}
                      {e.status !== "ignored" && e.status !== "matched" && (
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" onClick={() => ignore(e)}>
                          <EyeOff className="h-3.5 w-3.5" /> Ignorar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!linking} onOpenChange={(o) => !o && setLinking(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Vincular {linking?.kind === "credit" ? "recebimento" : "pagamento"} de{" "}
              {linking ? brl(Math.abs(linking.amount_cents)) : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">{linking?.description}</p>
          <Input placeholder="Buscar por nome, descrição ou valor..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Vencimento</span>
            <Input type="date" value={candFrom} onChange={(e) => setCandFrom(e.target.value)} className="h-8 w-[140px]" />
            <span className="text-muted-foreground text-xs">até</span>
            <Input type="date" value={candTo} onChange={(e) => setCandTo(e.target.value)} className="h-8 w-[140px]" />
            {(candFrom || candTo) && (
              <Button variant="ghost" size="sm" className="h-8" onClick={() => { setCandFrom(""); setCandTo(""); }}>Limpar</Button>
            )}
          </div>
          <div className="max-h-[380px] overflow-auto space-y-1.5">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum título em aberto encontrado.</p>
            ) : filtered.map((c) => (
              <button key={c.id} onClick={() => confirmLink(c)}
                className="w-full text-left border rounded-md p-2.5 hover:border-primary hover:bg-primary/5 transition">
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{c.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-medium">{c.party || c.description || "(sem nome)"}</span>
                    {c.party && c.description && (
                      <span className="block truncate text-xs text-muted-foreground">{c.description}</span>
                    )}
                  </span>
                  {c.due_date && <span className="text-xs text-muted-foreground">venc. {dt(c.due_date)}</span>}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
