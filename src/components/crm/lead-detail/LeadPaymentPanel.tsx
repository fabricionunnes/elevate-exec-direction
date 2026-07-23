import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Copy, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Payment {
  id: string; amount_cents: number; description: string | null; status: string;
  url: string | null; installments: number | null; created_at: string; paid_at: string | null;
}

const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  paid: { label: "Pago", variant: "default" },
  pending: { label: "Aguardando", variant: "secondary" },
  rejected: { label: "Recusado", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  error: { label: "Erro", variant: "destructive" },
};

export function LeadPaymentPanel({ leadId, leadName, opportunityValue }: { leadId: string; leadName: string; opportunityValue: number | null }) {
  const [amount, setAmount] = useState<string>(opportunityValue ? String(opportunityValue).replace(".", ",") : "");
  const [installments, setInstallments] = useState("12");
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("crm_lead_payments")
      .select("id, amount_cents, description, status, url, installments, created_at, paid_at")
      .eq("lead_id", leadId).order("created_at", { ascending: false });
    setPayments((data as Payment[]) || []);
    setLoading(false);
  }, [leadId]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    const cents = Math.round(parseFloat(String(amount).replace(/\./g, "").replace(",", ".")) * 100);
    if (!cents || cents < 100) { toast.error("Informe um valor válido (mín. R$ 1,00)"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-create-payment", {
        body: { lead_id: leadId, amount_cents: cents, installments: Number(installments), description: description || `Pagamento — ${leadName}` },
      });
      if (error || !data?.ok) { toast.error(data?.error || error?.message || "Falha ao gerar link"); return; }
      toast.success("Link gerado!");
      if (data.url) { navigator.clipboard.writeText(data.url); toast.success("Link copiado"); }
      load();
    } finally {
      setGenerating(false);
    }
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copiado"); };

  return (
    <div className="p-4 space-y-5 overflow-auto h-full">
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4 text-emerald-500" /> Gerar link de pagamento (Mercado Pago)</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Valor</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input className="pl-8" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Parcelas sem juros</Label>
            <Select value={installments} onValueChange={setInstallments}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}x{n === 1 ? " (à vista)" : " sem juros"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Descrição (opcional)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`Pagamento — ${leadName}`} />
        </div>
        <Button onClick={generate} disabled={generating} className="w-full gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          Gerar link de pagamento
        </Button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-sm">Links gerados</h4>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : payments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum link gerado ainda.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => {
              const st = STATUS[p.status] || { label: p.status, variant: "secondary" as const };
              return (
                <div key={p.id} className="rounded-md border p-2.5 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{fmt(p.amount_cents)}</span>
                      <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                      {p.installments && p.installments > 1 && <span className="text-[11px] text-muted-foreground">{p.installments}x</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{p.description}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{p.paid_at ? ` · pago em ${new Date(p.paid_at).toLocaleDateString("pt-BR")}` : ""}</p>
                  </div>
                  {p.url && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(p.url!)}><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(p.url!, "_blank")}><ExternalLink className="h-4 w-4" /></Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
