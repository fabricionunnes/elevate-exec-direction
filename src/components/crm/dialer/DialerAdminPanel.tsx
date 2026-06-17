import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Save, TrendingUp, DollarSign, Wallet, Percent } from "lucide-react";

const brl = (v: number | string) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Pricing {
  id?: string;
  plan_price_per_user: number; included_minutes_per_user: number;
  price_per_minute: number; overage_per_minute: number;
  setup_fee: number; min_balance_to_dial: number;
}
interface Stats {
  totalRevenue: number; totalMinutes: number; totalRecharged: number;
  twilioCostBrl: number; twilioCostUsd: number; usdBrl: number; margin: number; marginPct: number;
  tenants: { tenant_id: string; name: string; revenue: number; minutes: number }[];
}

export function DialerAdminPanel() {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [range, setRange] = useState<number>(30);
  const [loadingStats, setLoadingStats] = useState(true);
  const [billingRun, setBillingRun] = useState(false);
  const [billingResult, setBillingResult] = useState<any[] | null>(null);

  const loadPricing = async () => {
    const { data } = await supabase.from("dialer_pricing").select("*").is("tenant_id", null).maybeSingle();
    setPricing(data as any);
  };
  const loadStats = async () => {
    setLoadingStats(true);
    const { data } = await supabase.functions.invoke("dialer-admin-stats", { body: { days: range } });
    if (data && !data.error) setStats(data);
    setLoadingStats(false);
  };

  useEffect(() => { loadPricing(); }, []);
  useEffect(() => { loadStats(); /* eslint-disable-next-line */ }, [range]);

  const savePricing = async () => {
    if (!pricing) return;
    setSaving(true);
    const { error } = await supabase.from("dialer_pricing").update({
      plan_price_per_user: pricing.plan_price_per_user,
      included_minutes_per_user: pricing.included_minutes_per_user,
      price_per_minute: pricing.price_per_minute,
      overage_per_minute: pricing.overage_per_minute,
      setup_fee: pricing.setup_fee,
      min_balance_to_dial: pricing.min_balance_to_dial,
    }).is("tenant_id", null);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Preços atualizados");
  };

  const runBilling = async () => {
    if (!confirm("Rodar a cobrança do mês para todos os clientes ativos? Gera a fatura no Asaas e credita a franquia na carteira de cada um.")) return;
    setBillingRun(true);
    const { data, error } = await supabase.functions.invoke("dialer-billing-run", { body: {} });
    setBillingRun(false);
    if (error || data?.error) return toast.error(data?.error || error?.message);
    setBillingResult(data?.results || []);
    const charged = (data?.results || []).filter((r: any) => r.amount).length;
    toast.success(`Cobrança rodada. ${charged} cliente(s) faturado(s).`);
  };

  const field = (k: keyof Pricing, label: string, step = "0.01") => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step} value={pricing?.[k] ?? 0}
        onChange={(e) => setPricing((p) => p ? { ...p, [k]: Number(e.target.value) } : p)} />
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Margem / Lucro */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold mr-2">Margem do discador</span>
        {[7, 30, 90].map((d) => (
          <Button key={d} size="sm" variant={range === d ? "default" : "outline"} onClick={() => setRange(d)}>{d} dias</Button>
        ))}
      </div>
      {loadingStats ? (
        <div className="flex items-center gap-2 text-muted-foreground p-4 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Calculando…</div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={DollarSign} label="Cobrado dos clientes" value={brl(stats.totalRevenue)} sub={`${Math.round(stats.totalMinutes)} min`} />
            <Kpi icon={Wallet} label="Custo Twilio" value={brl(stats.twilioCostBrl)} sub={`US$ ${stats.twilioCostUsd.toFixed(2)} × ${stats.usdBrl}`} />
            <Kpi icon={TrendingUp} label="Margem" value={brl(stats.margin)} highlight />
            <Kpi icon={Percent} label="Margem %" value={`${stats.marginPct}%`} />
          </div>
          {stats.tenants.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Receita por cliente</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Minutos</TableHead><TableHead className="text-right">Cobrado</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {stats.tenants.map((t) => (
                      <TableRow key={t.tenant_id}><TableCell className="font-medium">{t.name}</TableCell><TableCell className="text-right">{Math.round(t.minutes)}</TableCell><TableCell className="text-right">{brl(t.revenue)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          <p className="text-[11px] text-muted-foreground">Custo Twilio é o total da conta no período (câmbio USD→BRL configurável via secret USD_BRL). Cobrado = soma dos minutos debitados das carteiras dos clientes.</p>
        </>
      ) : <p className="text-sm text-muted-foreground">Sem dados de margem ainda.</p>}

      {/* Cobrança por usuário ativo */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Cobrança por usuário ativo</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Fatura cada cliente por nº de usuários ativos no mês (× assinatura), gera a cobrança no Asaas e credita a franquia de minutos na carteira. Roda automático todo dia 1; aqui dá pra rodar na mão.</p>
          <Button className="gap-2" variant="outline" onClick={runBilling} disabled={billingRun}>
            {billingRun ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />} Rodar cobrança do mês
          </Button>
          {billingResult && (
            <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
              {billingResult.map((r, i) => (
                <div key={i}>{r.amount ? `${r.activeUsers} usuário(s) → ${brl(r.amount)}${r.invoiceUrl ? "" : " (sem cobrança Asaas — cadastrar cliente)"}` : `pulado: ${r.skipped || "—"}`}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preços (configurável) */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Preços (padrão global)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!pricing ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {field("plan_price_per_user", "Assinatura por usuário (R$)")}
                {field("included_minutes_per_user", "Franquia (min/usuário)", "1")}
                {field("price_per_minute", "Preço por minuto (R$)")}
                {field("overage_per_minute", "Excedente por minuto (R$)")}
                {field("setup_fee", "Setup (R$)")}
                {field("min_balance_to_dial", "Saldo mínimo p/ discar (R$)")}
              </div>
              <Button className="gap-2" onClick={savePricing} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar preços</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, highlight }: { icon: any; label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-emerald-500/40" : ""}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
        <p className={`text-xl font-bold mt-1 ${highlight ? "text-emerald-500" : ""}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
