import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Wallet, Plus, Loader2, Copy, ExternalLink, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

const brl = (v: number | string) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Ledger { id: string; amount: number; balance_after: number | null; minutes: number | null; operation: string; description: string | null; created_at: string; reference_id: string | null }
interface UnvCall { id: string; created_at: string; duration_seconds: number | null; answered: boolean; cost: number | null; cost_currency: string; lead: string | null; company: string | null }

export function DialerWalletPanel({ tenantId }: { tenantId: string | null }) {
  const [wallet, setWallet] = useState<{ balance: number; total_spent: number; total_deposited: number } | null>(null);
  const [pricing, setPricing] = useState<{ price_per_minute: number; min_balance_to_dial: number } | null>(null);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [callLeads, setCallLeads] = useState<Record<string, string>>({});
  const [unv, setUnv] = useState<{ totalUsd: number; totalBrl: number | null; brlRate: number; pendingCount: number; calls: UnvCall[] } | null>(null);
  const [twilioBal, setTwilioBal] = useState<{ balance: number; currency: string; low: boolean; critical: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [amount, setAmount] = useState("100");
  const [cpf, setCpf] = useState("");
  const [generating, setGenerating] = useState(false);
  const [pix, setPix] = useState<{ payload: string | null; image: string | null; url: string | null } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    // UNV (uso próprio): sem carteira — extrato de custo Twilio por ligação
    if (!tenantId) {
      const [{ data }, { data: bal }] = await Promise.all([
        supabase.functions.invoke("dialer-twilio-costs", { body: { limit: 150 } }),
        supabase.functions.invoke("dialer-balance"),
      ]);
      if (data && !data.error) setUnv(data);
      if (bal && typeof bal.balance === "number") setTwilioBal(bal);
      setLoading(false);
      return;
    }
    const [{ data: w }, { data: p }, { data: l }] = await Promise.all([
      supabase.from("dialer_wallets").select("balance, total_spent, total_deposited").maybeSingle(),
      supabase.from("dialer_pricing").select("price_per_minute, min_balance_to_dial").or(`tenant_id.eq.${tenantId},tenant_id.is.null`).order("tenant_id", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
      supabase.from("dialer_ledger").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setWallet(w as any);
    setPricing(p as any);
    const led = (l || []) as Ledger[];
    setLedger(led);
    // nome do lead pra cada ligação do extrato
    const callIds = [...new Set(led.filter((e) => e.operation === "debit_call" && e.reference_id).map((e) => e.reference_id as string))];
    if (callIds.length) {
      const { data: cs } = await supabase.from("crm_calls").select("id, lead:crm_leads(name, company)").in("id", callIds);
      const map: Record<string, string> = {};
      (cs || []).forEach((c: any) => { map[c.id] = c.lead?.name || c.lead?.company || ""; });
      setCallLeads(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); return () => { if (pollRef.current) clearInterval(pollRef.current); }; /* eslint-disable-next-line */ }, []);

  const recharge = async (openPayment = false) => {
    if (!tenantId) return toast.error("Carteira é por cliente.");
    const val = Number(amount);
    if (!val || val < 5) return toast.error("Valor mínimo: R$ 5,00");
    // abre a aba já (antes do await) pra o navegador não bloquear o popup
    const win = openPayment ? window.open("", "_blank", "noopener") : null;
    setGenerating(true);
    setPix(null);
    try {
      const { data, error } = await supabase.functions.invoke("dialer-recharge", { body: { tenantId, amount: val, cpfCnpj: cpf || undefined } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setPix({ payload: data.pixPayload, image: data.pixQrCodeImage, url: data.invoiceUrl });
      if (openPayment && data.invoiceUrl) {
        if (win) win.location.href = data.invoiceUrl;
        else window.open(data.invoiceUrl, "_blank", "noopener");
        toast.success("Página de pagamento aberta. Credita automático ao pagar.");
      } else {
        if (win) win.close();
        toast.success("Cobrança gerada. Pague o PIX para creditar.");
      }
      // poll do saldo até creditar
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const { data: w } = await supabase.from("dialer_wallets").select("balance, total_spent, total_deposited").maybeSingle();
        if (w && wallet && Number(w.balance) > Number(wallet.balance)) {
          setWallet(w as any); load(); toast.success("Recarga creditada!");
          if (pollRef.current) clearInterval(pollRef.current);
          setRechargeOpen(false);
        }
      }, 5000);
    } catch (e: any) {
      if (win) win.close();
      toast.error(e?.message || "Erro ao gerar recarga");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando carteira…</div>;

  // UNV (uso próprio): extrato de custo Twilio por ligação (sem carteira/recarga)
  if (!tenantId) {
    const fmtUsd = (v: number) => `US$ ${v.toFixed(4)}`;
    const rate = unv?.brlRate || 0;
    const usdToBrl = (v: number) => rate ? Number(v * rate).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : fmtUsd(v);
    return (
      <div className="p-4 space-y-4">
        {twilioBal && (
          <Card className={twilioBal.critical ? "border-red-500/40" : twilioBal.low ? "border-amber-500/40" : ""}>
            <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Saldo Twilio (sua conta)</div>
                <p className={`text-3xl font-bold mt-1 ${twilioBal.critical ? "text-red-500" : twilioBal.low ? "text-amber-500" : ""}`}>{twilioBal.currency} {twilioBal.balance.toFixed(2)}</p>
                {(twilioBal.low || twilioBal.critical) && <Badge variant="outline" className="mt-1 border-amber-500/40 text-amber-500">Saldo baixo — adicione créditos</Badge>}
              </div>
              <Button className="gap-2" onClick={() => window.open("https://console.twilio.com/us1/billing/manage-billing/add-funds", "_blank", "noopener")}>
                <Plus className="h-4 w-4" /> Adicionar créditos na Twilio <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        )}
        <div className="grid sm:grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Gasto Twilio (últimas ligações)</div><p className="text-3xl font-bold mt-1">{rate ? usdToBrl(unv?.totalUsd || 0) : fmtUsd(unv?.totalUsd || 0)}</p><p className="text-[11px] text-muted-foreground">{fmtUsd(unv?.totalUsd || 0)}{rate ? ` · dólar R$ ${rate.toFixed(2)}` : ""}</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Ligações</div><p className="text-2xl font-bold mt-1">{unv?.calls.length ?? 0}</p><p className="text-[11px] text-muted-foreground">conta própria UNV</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Custo médio por ligação</div><p className="text-2xl font-bold mt-1">{unv?.calls.length ? (rate ? usdToBrl((unv.totalUsd) / unv.calls.length) : fmtUsd((unv.totalUsd) / unv.calls.length)) : "—"}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center justify-between">Extrato por ligação{unv && unv.pendingCount > 0 && <span className="text-xs font-normal text-muted-foreground">{unv.pendingCount} aguardando preço da Twilio</span>}</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Lead</TableHead><TableHead className="text-right">Duração</TableHead><TableHead className="text-right">Custo</TableHead></TableRow></TableHeader>
              <TableBody>
                {(unv?.calls || []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell className="text-sm truncate max-w-[200px]">{c.lead || "—"}{!c.answered && <span className="text-[11px] text-muted-foreground"> · não atendida</span>}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}:${String(c.duration_seconds % 60).padStart(2, "0")}` : "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{c.cost != null ? (rate ? usdToBrl(c.cost) : fmtUsd(c.cost)) : <span className="text-muted-foreground">calculando…</span>}</TableCell>
                  </TableRow>
                ))}
                {(!unv || unv.calls.length === 0) && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem ligações ainda</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <p className="text-[11px] text-muted-foreground">Custo real cobrado pela Twilio por ligação (puxado da conta). O total do dia fica no Dashboard do discador. A compra de créditos é feita na própria Twilio (com seu cartão) — dica: ative a auto-recarga lá pra nunca ficar sem saldo. Isso vale só pra sua conta; os clientes recarregam pelo PIX da carteira.</p>
      </div>
    );
  }

  const low = wallet && pricing && Number(wallet.balance) < Number(pricing.min_balance_to_dial);

  return (
    <div className="p-4 space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Card className={low ? "border-red-500/40" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Saldo atual</div>
            <p className={`text-3xl font-bold mt-1 ${low ? "text-red-500" : ""}`}>{brl(wallet?.balance ?? 0)}</p>
            {low && <Badge variant="outline" className="mt-1 border-red-500/40 text-red-500">Saldo baixo — recarregue</Badge>}
          </CardContent>
        </Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Preço por minuto</div><p className="text-2xl font-bold mt-1">{brl(pricing?.price_per_minute ?? 0)}</p><p className="text-[11px] text-muted-foreground">por minuto gravado/transcrito</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total recarregado</div><p className="text-2xl font-bold mt-1">{brl(wallet?.total_deposited ?? 0)}</p><p className="text-[11px] text-muted-foreground">gasto: {brl(wallet?.total_spent ?? 0)}</p></CardContent></Card>
      </div>

      <Button className="gap-2" onClick={() => { setPix(null); setRechargeOpen(true); }}><Plus className="h-4 w-4" /> Recarregar</Button>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Extrato</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
            <TableBody>
              {ledger.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(e.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</TableCell>
                  <TableCell className="text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      {Number(e.amount) >= 0 ? <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" /> : <ArrowDownCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                      {e.operation === "recharge" ? "Recarga"
                        : e.operation === "debit_call" ? `Ligação${e.reference_id && callLeads[e.reference_id] ? ` — ${callLeads[e.reference_id]}` : ""}${e.minutes ? ` (${e.minutes} min)` : ""}`
                        : e.operation === "franchise_grant" ? "Franquia mensal"
                        : e.operation === "adjustment" ? "Ajuste"
                        : e.operation}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right text-sm ${Number(e.amount) >= 0 ? "text-emerald-500" : ""}`}>{Number(e.amount) >= 0 ? "+" : ""}{brl(e.amount)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{e.balance_after != null ? brl(e.balance_after) : "—"}</TableCell>
                </TableRow>
              ))}
              {ledger.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem movimentações ainda</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recarregar carteira</DialogTitle></DialogHeader>
          {!pix ? (
            <div className="space-y-3">
              <div><Label>Valor (R$)</Label><Input type="number" min={5} step={10} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div><Label>CPF/CNPJ (só na 1ª recarga)</Label><Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Necessário se ainda não houver cadastro Asaas" /></div>
              <div className="flex flex-col gap-2 pt-1">
                <Button className="gap-2" onClick={() => recharge(true)} disabled={generating}>
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} Ir para o pagamento
                </Button>
                <div className="flex justify-between gap-2">
                  <Button variant="ghost" onClick={() => setRechargeOpen(false)}>Cancelar</Button>
                  <Button variant="outline" onClick={() => recharge(false)} disabled={generating}>Gerar PIX aqui</Button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">Na página de pagamento dá pra pagar por PIX, cartão ou boleto. Credita automático ao confirmar.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              {pix.image && <img src={pix.image} alt="QR Code PIX" className="mx-auto w-48 h-48" />}
              {pix.payload && (
                <Button variant="outline" className="gap-2" onClick={() => { navigator.clipboard.writeText(pix.payload!); toast.success("Código PIX copiado"); }}>
                  <Copy className="h-4 w-4" /> Copiar código PIX (copia e cola)
                </Button>
              )}
              {pix.url && (
                <Button variant="outline" className="gap-2 w-full" onClick={() => window.open(pix.url!, "_blank", "noopener")}>
                  <ExternalLink className="h-4 w-4" /> Ir para o pagamento (PIX, cartão ou boleto)
                </Button>
              )}
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Aguardando pagamento — credita automático ao pagar.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
