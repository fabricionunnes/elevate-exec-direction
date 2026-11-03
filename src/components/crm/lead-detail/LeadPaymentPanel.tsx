// Painel de pagamento do lead — links Mercado Pago / Dom Pagamentos / Asaas / TMB (boleto parcelado)
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CreditCard, Copy, Loader2, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

type ProviderKey = "mercadopago" | "dompagamentos" | "asaas" | "tmb";
const PROVIDERS: { key: ProviderKey; name: string; sub: string }[] = [
  { key: "mercadopago", name: "Mercado Pago", sub: "Cartão parcelado" },
  { key: "dompagamentos", name: "Dom Pagamentos", sub: "Cartão parcelado" },
  { key: "asaas", name: "Asaas", sub: "PIX · mensal" },
  // TMB (Tem Mais no Boleto): boleto parcelado. Fabrício, 03/11/2026: cobra EXATAMENTE o valor
  // do negócio do CRM (o valor não é editável nessa forma).
  { key: "tmb", name: "TMB", sub: "Boleto parcelado" },
];
const GRID_COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2" };
type TmbProduto = { produto_id: number; nome: string; descricao: string | null; valor: string | null; ativo: boolean };

interface Payment {
  id: string; amount_cents: number; description: string | null; status: string;
  url: string | null; installments: number | null; created_at: string; paid_at: string | null;
  provider: string; recurring: boolean; due_day: number | null;
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
  const [provider, setProvider] = useState<ProviderKey>("mercadopago");
  // TMB: produto em que a oferta é criada, entrada opcional
  const [tmbProdutos, setTmbProdutos] = useState<TmbProduto[]>([]);
  const [tmbProduto, setTmbProduto] = useState<string>("");
  const [tmbPadrao, setTmbPadrao] = useState<string>("");
  const [tmbCarregando, setTmbCarregando] = useState(false);
  const [tmbErro, setTmbErro] = useState<string>("");
  const [tmbEntrada, setTmbEntrada] = useState("");
  const [tmbEntradaVenc, setTmbEntradaVenc] = useState("");
  const [installments, setInstallments] = useState("12");
  const [dueDay, setDueDay] = useState("5");
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ mercadopago: true, dompagamentos: true, asaas: true, tmb: true });
  const { isMaster, currentStaff } = useStaffPermissions();
  const canDelete = isMaster || currentStaff?.role === "admin";

  useEffect(() => {
    (supabase as any).from("crm_payment_provider_settings").select("provider, is_enabled, config")
      .then(({ data }: any) => {
        if (!data?.length) return;
        const map: Record<string, boolean> = { mercadopago: true, dompagamentos: true, asaas: true, tmb: true };
        data.forEach((r: any) => {
          map[r.provider] = r.is_enabled;
          if (r.provider === "tmb" && r.config?.produto_id) { setTmbPadrao(String(r.config.produto_id)); setTmbProduto((cur) => cur || String(r.config.produto_id)); }
        });
        setEnabled(map);
      });
  }, []);

  // Produtos da TMB: carrega quando a forma TMB é escolhida pela primeira vez
  useEffect(() => {
    if (provider !== "tmb" || tmbProdutos.length || tmbCarregando) return;
    setTmbCarregando(true); setTmbErro("");
    supabase.functions.invoke("tmb-create-payment", { body: { action: "produtos" } })
      .then(({ data, error }) => {
        if (error || !data?.ok) { setTmbErro(data?.error || error?.message || "Não consegui listar os produtos da TMB"); return; }
        const lista: TmbProduto[] = (data.produtos || []).filter((p: TmbProduto) => p.ativo);
        setTmbProdutos(lista);
        setTmbProduto((cur) => cur || (lista.length === 1 ? String(lista[0].produto_id) : ""));
      })
      .finally(() => setTmbCarregando(false));
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvarTmbPadrao = async () => {
    if (!tmbProduto) return;
    const { error } = await (supabase as any).from("crm_payment_provider_settings")
      .update({ config: { produto_id: Number(tmbProduto) }, updated_at: new Date().toISOString() })
      .eq("provider", "tmb");
    if (error) { toast.error("Sem permissão para salvar o padrão"); return; }
    setTmbPadrao(tmbProduto); toast.success("Produto padrão da TMB salvo");
  };

  const visibleProviders = isMaster ? PROVIDERS : PROVIDERS.filter((p) => enabled[p.key] !== false);
  const enabledProviders = PROVIDERS.filter((p) => enabled[p.key] !== false);

  useEffect(() => {
    if (enabled[provider] === false && enabledProviders.length > 0) setProvider(enabledProviders[0].key);
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleProvider = async (key: ProviderKey, value: boolean) => {
    const prev = enabled;
    setEnabled({ ...enabled, [key]: value });
    const { error } = await (supabase as any).from("crm_payment_provider_settings")
      .update({ is_enabled: value, updated_at: new Date().toISOString() })
      .eq("provider", key);
    if (error) { setEnabled(prev); toast.error("Sem permissão para alterar"); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("crm_lead_payments")
      .select("id, amount_cents, description, status, url, installments, created_at, paid_at, provider, recurring, due_day")
      .eq("lead_id", leadId).order("created_at", { ascending: false });
    setPayments((data as Payment[]) || []);
    setLoading(false);
  }, [leadId]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (enabled[provider] === false || enabledProviders.length === 0) { toast.error("Esta forma de pagamento está desabilitada"); return; }
    if (provider === "tmb") {
      // valor vem do negócio do CRM, não do campo
      if (!opportunityValue || opportunityValue < 1) { toast.error("Preencha o Valor do negócio na ficha do lead: a TMB cobra exatamente esse valor"); return; }
      if (!tmbProduto) { toast.error("Escolha o produto da TMB"); return; }
    }
    const cents = provider === "tmb"
      ? Math.round(Number(opportunityValue) * 100)
      : Math.round(parseFloat(String(amount).replace(/\./g, "").replace(",", ".")) * 100);
    if (!cents || cents < 100) { toast.error("Informe um valor válido (mín. R$ 1,00)"); return; }
    const entradaCents = tmbEntrada ? Math.round(parseFloat(String(tmbEntrada).replace(/\./g, "").replace(",", ".")) * 100) : 0;
    if (provider === "tmb" && entradaCents && entradaCents >= cents) { toast.error("A entrada precisa ser menor que o valor do negócio"); return; }
    setGenerating(true);
    try {
      const fn = provider === "asaas" ? "asaas-lead-subscription"
        : provider === "dompagamentos" ? "dompagamentos-create-payment"
        : provider === "tmb" ? "tmb-create-payment"
        : "mercadopago-create-payment";
      const payload = provider === "asaas"
        ? { lead_id: leadId, amount_cents: cents, due_day: Number(dueDay), description: description || `Assinatura mensal — ${leadName}` }
        : provider === "dompagamentos"
        ? { lead_id: leadId, amount_cents: cents, installments: Number(installments), interest_free_installments: Number(installments), description: description || `Pagamento — ${leadName}` }
        : provider === "tmb"
        ? { lead_id: leadId, installments: Number(installments), produto_id: Number(tmbProduto), entry_cents: entradaCents || undefined, entry_due: tmbEntradaVenc || undefined, description: description || `Boleto parcelado TMB — ${leadName}` }
        : { lead_id: leadId, amount_cents: cents, installments: Number(installments), description: description || `Pagamento — ${leadName}` };
      const { data, error } = await supabase.functions.invoke(fn, { body: payload });
      if (error || !data?.ok) { toast.error(data?.error || error?.message || "Falha ao gerar link"); return; }
      toast.success("Link gerado!");
      if (data.url) { navigator.clipboard.writeText(data.url); toast.success("Link copiado"); }
      load();
    } finally {
      setGenerating(false);
    }
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copiado"); };

  const removePayment = async (p: Payment) => {
    if (!canDelete) return;
    if (!window.confirm(`Excluir o link de ${fmt(p.amount_cents)}? O link deixa de aparecer aqui, mas quem já o tiver aberto ainda consegue pagar por ele.`)) return;
    const { error } = await supabase.from("crm_lead_payments").delete().eq("id", p.id);
    if (error) { toast.error("Sem permissão para excluir"); return; }
    toast.success("Link excluído");
    load();
  };

  return (
    <div className="p-4 space-y-5 overflow-auto h-full">
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4 text-emerald-500" /> Gerar link de pagamento</h3>
        <div>
          <Label className="text-xs">Forma</Label>
          {visibleProviders.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">Nenhuma forma de pagamento habilitada no momento.</p>
          ) : (
            <div className={`grid ${GRID_COLS[visibleProviders.length] || "grid-cols-3"} gap-2 mt-1`}>
              {visibleProviders.map((p) => {
                const isOn = enabled[p.key] !== false;
                return (
                  <div key={p.key} className="relative">
                    <button type="button" disabled={!isOn} onClick={() => setProvider(p.key)}
                      className={`w-full rounded-md border p-2 text-xs text-left ${provider === p.key && isOn ? "border-primary bg-primary/5 font-medium" : "border-border"} ${!isOn ? "opacity-40 cursor-not-allowed" : ""}`}>
                      {p.name}<br /><span className="text-[10px] text-muted-foreground">{p.sub}</span>
                    </button>
                    {isMaster && (
                      <div className="absolute top-1.5 right-1.5" title={isOn ? "Desabilitar para todos" : "Habilitar para todos"}>
                        <Switch checked={isOn} onCheckedChange={(v) => toggleProvider(p.key, v)} className="scale-[0.65] origin-top-right" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {isMaster && <p className="text-[10px] text-muted-foreground mt-1">Os interruptores habilitam/desabilitam cada forma para todo o time (visível só pra você).</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Valor{provider === "asaas" ? " (por mês)" : provider === "tmb" ? " (do negócio no CRM)" : ""}</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              {provider === "tmb" ? (
                <Input className="pl-8" readOnly value={opportunityValue ? Number(opportunityValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""} placeholder="preencha o Valor do negócio" title="A TMB cobra exatamente o valor do negócio cadastrado na ficha do lead" />
              ) : (
                <Input className="pl-8" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
              )}
            </div>
          </div>
          {provider === "asaas" ? (
            <div>
              <Label className="text-xs">Vencimento (todo dia)</Label>
              <Select value={dueDay} onValueChange={setDueDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 5, 10, 15, 20, 25].map((n) => <SelectItem key={n} value={String(n)}>Dia {n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="text-xs">{provider === "tmb" ? "Parcelas no boleto" : "Parcelas sem juros"}</Label>
              <Select value={installments} onValueChange={setInstallments}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: provider === "tmb" ? 24 : 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}x{n === 1 ? " (à vista)" : provider === "tmb" ? " no boleto" : " sem juros"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {provider === "tmb" && (
          <div className="space-y-3 rounded-md border border-dashed p-3">
            <p className="text-[11px] text-muted-foreground">A TMB cobra exatamente o valor do negócio cadastrado no CRM. Pra mudar o valor, altere o Valor do negócio na ficha do lead.</p>
            <div>
              <Label className="text-xs">Produto da TMB (onde a oferta é criada)</Label>
              {tmbErro ? (
                <p className="text-xs text-destructive mt-1">{tmbErro}</p>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <Select value={tmbProduto} onValueChange={setTmbProduto} disabled={tmbCarregando}>
                    <SelectTrigger><SelectValue placeholder={tmbCarregando ? "Carregando produtos..." : "Escolha o produto"} /></SelectTrigger>
                    <SelectContent>
                      {tmbProdutos.map((p) => (
                        <SelectItem key={p.produto_id} value={String(p.produto_id)}>{p.nome}{p.valor ? ` · ${p.valor}` : ""}{String(p.produto_id) === tmbPadrao ? " (padrão)" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isMaster && tmbProduto && tmbProduto !== tmbPadrao && (
                    <Button type="button" variant="outline" size="sm" onClick={salvarTmbPadrao} title="Usar este produto como padrão pra todo o time">Padrão</Button>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Boleto de entrada (opcional)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <Input className="pl-8" value={tmbEntrada} onChange={(e) => setTmbEntrada(e.target.value)} placeholder="padrão da TMB" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Vencimento da entrada</Label>
                <Input type="date" value={tmbEntradaVenc} onChange={(e) => setTmbEntradaVenc(e.target.value)} />
                <p className="text-[10px] text-muted-foreground mt-0.5">de 3 a 60 dias a partir de hoje</p>
              </div>
            </div>
          </div>
        )}
        {provider === "asaas" && (
          <p className="text-[11px] text-muted-foreground">Cria uma assinatura mensal via PIX no Asaas. Exige o CPF/CNPJ preenchido no lead.</p>
        )}
        <div>
          <Label className="text-xs">Descrição (opcional)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`Pagamento — ${leadName}`} />
        </div>
        <Button onClick={generate} disabled={generating || enabledProviders.length === 0 || enabled[provider] === false} className="w-full gap-2">
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
                      <span className="text-[10px] text-muted-foreground">{p.provider === "asaas" ? `PIX · mensal (dia ${p.due_day})` : p.provider === "tmb" ? "Boleto parcelado (TMB)" : "Cartão"}</span>
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
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir link (master/admin)" onClick={() => removePayment(p)}><Trash2 className="h-4 w-4" /></Button>
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