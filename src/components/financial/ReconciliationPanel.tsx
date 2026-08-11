import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, Link2, Undo2, EyeOff } from "lucide-react";
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
interface Candidate { id: string; description: string | null; amount: number; due_date: string | null; status: string }

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

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("financial_statement_entries")
      .select("*").eq("provider", "asaas").order("entry_date", { ascending: false }).limit(300);
    if (filter !== "all") q = q.eq("status", filter);
    const [entRes, runRes] = await Promise.all([
      q,
      (supabase as any).from("financial_reconciliation_runs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setEntries((entRes.data as Entry[]) || []);
    setLastRun((runRes.data as Run) || null);
    setLoading(false);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-reconcile", { body: { pages: 6 } });
      if (error) throw error;
      const d = data as any;
      if (!d?.ok) throw new Error(d?.error || "falha na conciliação");
      toast.success(`${d.imported} novos · ${d.auto_matched} conciliados · ${d.needs_review} pra revisar`, { duration: 8000 });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao conciliar");
    } finally {
      setRunning(false);
    }
  };

  const openLink = async (e: Entry) => {
    setLinking(e); setSearch(""); setCands([]);
    const table = e.kind === "credit" ? "financial_receivables" : "financial_payables";
    const { data } = await (supabase as any).from(table)
      .select("id, description, amount, due_date, status").neq("status", "paid")
      .order("due_date", { ascending: false }).limit(200);
    setCands((data as Candidate[]) || []);
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
      match_confidence: "manual", match_reason: `vinculado manualmente (${c.description || ""})`.trim(),
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

  const filtered = cands.filter(c =>
    !search.trim() || (c.description || "").toLowerCase().includes(search.toLowerCase()) || String(c.amount).includes(search));

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
              batendo com um único título). Na dúvida, não mexe: marca para você decidir e avisa no WhatsApp.
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
            <Button onClick={run} disabled={running} className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Conciliar agora
            </Button>
          </div>
        </CardContent>
      </Card>

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
          <Input placeholder="Buscar por descrição ou valor..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-[380px] overflow-auto space-y-1.5">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum título em aberto encontrado.</p>
            ) : filtered.map((c) => (
              <button key={c.id} onClick={() => confirmLink(c)}
                className="w-full text-left border rounded-md p-2.5 hover:border-primary hover:bg-primary/5 transition">
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{c.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  <span className="flex-1 truncate text-sm">{c.description}</span>
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
