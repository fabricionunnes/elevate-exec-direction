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

interface Ledger { id: string; amount: number; balance_after: number | null; minutes: number | null; operation: string; description: string | null; created_at: string }

export function DialerWalletPanel({ tenantId }: { tenantId: string | null }) {
  const [wallet, setWallet] = useState<{ balance: number; total_spent: number; total_deposited: number } | null>(null);
  const [pricing, setPricing] = useState<{ price_per_minute: number; min_balance_to_dial: number } | null>(null);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [amount, setAmount] = useState("100");
  const [cpf, setCpf] = useState("");
  const [generating, setGenerating] = useState(false);
  const [pix, setPix] = useState<{ payload: string | null; image: string | null; url: string | null } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    const [{ data: w }, { data: p }, { data: l }] = await Promise.all([
      supabase.from("dialer_wallets").select("balance, total_spent, total_deposited").maybeSingle(),
      supabase.from("dialer_pricing").select("price_per_minute, min_balance_to_dial").or(`tenant_id.eq.${tenantId},tenant_id.is.null`).order("tenant_id", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
      supabase.from("dialer_ledger").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setWallet(w as any);
    setPricing(p as any);
    setLedger((l || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); return () => { if (pollRef.current) clearInterval(pollRef.current); }; /* eslint-disable-next-line */ }, []);

  const recharge = async () => {
    if (!tenantId) return toast.error("Carteira é por cliente.");
    const val = Number(amount);
    if (!val || val < 5) return toast.error("Valor mínimo: R$ 5,00");
    setGenerating(true);
    setPix(null);
    try {
      const { data, error } = await supabase.functions.invoke("dialer-recharge", { body: { tenantId, amount: val, cpfCnpj: cpf || undefined } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setPix({ payload: data.pixPayload, image: data.pixQrCodeImage, url: data.invoiceUrl });
      toast.success("Cobrança gerada. Pague o PIX para creditar.");
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
      toast.error(e?.message || "Erro ao gerar recarga");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando carteira…</div>;

  if (!tenantId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">A carteira é por cliente. Como uso interno da UNV, suas ligações não debitam carteira.</p>
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
                      {e.operation === "recharge" ? "Recarga" : e.operation === "debit_call" ? `Ligação${e.minutes ? ` (${e.minutes} min)` : ""}` : e.operation}
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRechargeOpen(false)}>Cancelar</Button>
                <Button onClick={recharge} disabled={generating}>{generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Gerar PIX</Button>
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
              {pix.url && <a href={pix.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline"><ExternalLink className="h-3 w-3 inline mr-1" /> Abrir fatura</a>}
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Aguardando pagamento — credita automático ao pagar.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
