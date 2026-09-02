import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, Link2, Undo2, EyeOff, Receipt, ArrowRightLeft, PlusCircle } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Label } from "@/components/ui/label";
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
  // resolver "na mão": criar recebível (com empresa) ou conta a pagar a partir da linha do extrato
  const [resolving, setResolving] = useState<Entry | null>(null);
  const [resForm, setResForm] = useState({ company_id: "", party: "", description: "", category_id: "", supplier_name: "" });
  const [resSaving, setResSaving] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; type: string }[]>([]);
  useEffect(() => {
    (async () => {
      const [c, k] = await Promise.all([
        (supabase as any).from("onboarding_companies").select("id, name").eq("status", "active").order("name"),
        (supabase as any).from("staff_financial_categories").select("id, name, type").order("name"),
      ]);
      setCompanies(c.data || []); setCategories(k.data || []);
    })();
  }, []);

  // Toda resolução passa pela RPC: baixa/cria o título E lança no razão interno
  // uma única vez (é isso que substitui o antigo "ajuste automático" de saldo).
  const resolver = async (e: Entry, action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await (supabase as any).rpc("resolve_statement_entry", { p_entry_id: e.id, p_action: action, p_payload: payload });
    if (error) { toast.error(error.message || "Não consegui resolver"); return false; }
    const r = data || {};
    toast.success(r.ledger_posted ? "Resolvido e lançado no extrato interno" : "Resolvido");
    return true;
  };

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("financial_statement_entries")
      .select("*").eq("provider", "asaas").order("entry_date", { ascending: false }).limit(300);
    if (filter !== "all") q = q.eq("status", filter);
    if (dateFrom) q = q.gte("entry_date", dateFrom);
    if (dateTo) q = q.lte("entry_date", dateTo);
    const [entRes, runRes] = await Promise.all([
      q,
      (supabase as any).from("financial_reconciliation_runs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setEntries((entRes.data as Entry[]) || []);
    setLastRun((runRes.data as Run) || null);
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
    const ok = await resolver(e, "link", { kind: e.kind === "credit" ? "receivable" : "payable", id: c.id });
    if (!ok) return;
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
    if (await resolver(e, "ignore")) load();
  };

  const abrirResolver = (e: Entry) => {
    setResolving(e);
    setResForm({ company_id: "", party: "", description: e.description || "", category_id: "", supplier_name: "Asaas" });
  };
  const confirmarResolver = async () => {
    if (!resolving) return;
    if (!resForm.description.trim()) { toast.error("Descreva o lançamento"); return; }
    const credito = resolving.kind === "credit";
    if (credito && !resForm.company_id && !resForm.party.trim()) { toast.error("Escolha a empresa ou informe o nome"); return; }
    setResSaving(true);
    const ok = await resolver(resolving, credito ? "create_receivable" : "create_payable", credito
      ? { company_id: resForm.company_id || null, party: resForm.party.trim() || null, description: resForm.description.trim(), category_id: resForm.category_id || null }
      : { supplier_name: resForm.supplier_name.trim() || "Asaas", description: resForm.description.trim(), category_id: resForm.category_id || null });
    setResSaving(false);
    if (ok) { setResolving(null); load(); }
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
              Importa o extrato do Asaas linha a linha, dá baixa e lança no extrato interno sozinho quando tem certeza
              (taxa, transferência, id do Asaas, ou valor e vencimento batendo com um único título). Na dúvida, não
              inventa lançamento: fica aqui pra você decidir — vincular, criar recebível com a empresa, taxa, transferência
              ou ignorar. A diferença de saldo Asaas × sistema é exatamente o que ainda está nesta fila.
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
                        <>
                          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => openLink(e)} title="Baixar um título já cadastrado">
                            <Link2 className="h-3.5 w-3.5" /> Vincular
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => abrirResolver(e)}
                            title={credito ? "Criar recebível pago (com empresa)" : "Criar conta paga"}>
                            <PlusCircle className="h-3.5 w-3.5" /> {credito ? "Criar recebível" : "Criar conta"}
                          </Button>
                          {!credito && (
                            <Button size="sm" variant="ghost" className="h-8 gap-1" title="É taxa do Asaas"
                              onClick={async () => { if (await resolver(e, "fee")) load(); }}>
                              <Receipt className="h-3.5 w-3.5" /> Taxa
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 gap-1" title="Transferência entre contas próprias / antecipação"
                            onClick={async () => { if (await resolver(e, "transfer")) load(); }}>
                            <ArrowRightLeft className="h-3.5 w-3.5" /> Transf.
                          </Button>
                        </>
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

      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resolving?.kind === "credit" ? "Criar recebível" : "Criar conta a pagar"} de {resolving ? brl(Math.abs(resolving.amount_cents)) : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">{resolving?.entry_date && dt(resolving.entry_date)} · {resolving?.description}</p>
          <div className="space-y-3">
            {resolving?.kind === "credit" ? (
              <>
                <div>
                  <Label>Empresa</Label>
                  <SearchableSelect value={resForm.company_id || "none"} onValueChange={(v) => setResForm(f => ({ ...f, company_id: v === "none" ? "" : v }))}
                    options={companies.map(c => ({ value: c.id, label: c.name }))} allowNone noneLabel="Sem empresa (nome livre)"
                    placeholder="Digite pra buscar a empresa" emptyMessage="Nenhuma empresa encontrada" />
                </div>
                {!resForm.company_id && (
                  <div><Label>Nome do recebedor</Label><Input value={resForm.party} onChange={(e) => setResForm(f => ({ ...f, party: e.target.value }))} placeholder="Ex: Fulano (venda avulsa)" /></div>
                )}
              </>
            ) : (
              <div><Label>Fornecedor</Label><Input value={resForm.supplier_name} onChange={(e) => setResForm(f => ({ ...f, supplier_name: e.target.value }))} /></div>
            )}
            <div><Label>Descrição *</Label><Input value={resForm.description} onChange={(e) => setResForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={resForm.category_id || "none"} onValueChange={(v) => setResForm(f => ({ ...f, category_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.filter(c => c.type === (resolving?.kind === "credit" ? "receita" : "despesa")).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground">O título nasce já pago na data do extrato e o valor entra no extrato interno uma única vez.</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setResolving(null)}>Cancelar</Button>
              <Button onClick={confirmarResolver} disabled={resSaving}>{resSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
