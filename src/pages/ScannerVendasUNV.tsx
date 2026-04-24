import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PhoneInput } from "@/components/ui/phone-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowRight, ArrowLeft, Sparkles, TrendingUp, AlertTriangle, CheckCircle2,
  Loader2, Target, DollarSign, Users, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, CartesianGrid,
} from "recharts";

const STORAGE_KEY = "scanner_vendas_unv_state_v1";

const REVENUE_OPTIONS = [
  { value: "ate_50k", label: "Até R$ 50 mil" },
  { value: "50_100k", label: "R$ 50k a R$ 100k" },
  { value: "100_300k", label: "R$ 100k a R$ 300k" },
  { value: "300k_1m", label: "R$ 300k a R$ 1M" },
  { value: "acima_1m", label: "Acima de R$ 1M" },
];

const LEAD_CHANNELS = [
  { value: "organico", label: "Orgânico" },
  { value: "indicacao", label: "Indicação" },
  { value: "trafego_pago", label: "Tráfego pago" },
  { value: "prospeccao", label: "Prospecção ativa" },
];

const TOTAL_STEPS = 6;

type FormData = {
  // 1
  full_name: string; whatsapp: string; email: string;
  // 2
  company_name: string; segment: string; revenue_range: string;
  sellers_count: string; has_sales_manager: string;
  // 3
  lead_channels: string[]; leads_per_month: string; has_process: string;
  // 4
  avg_ticket: number | undefined; conversion_rate: string; sales_cycle_days: string;
  sales_per_month: string; has_crm: string; tracks_goals_daily: string;
  // 5
  invests_paid_traffic: string; paid_traffic_monthly: number | undefined;
  cost_per_lead: number | undefined; has_marketing_team: string;
  // 6
  maturity_organization: number; maturity_goals: number;
  maturity_predictability: number; maturity_lead_quality: number;
  maturity_performance: number;
};

const initialData: FormData = {
  full_name: "", whatsapp: "", email: "",
  company_name: "", segment: "", revenue_range: "", sellers_count: "", has_sales_manager: "",
  lead_channels: [], leads_per_month: "", has_process: "",
  avg_ticket: undefined, conversion_rate: "", sales_cycle_days: "", sales_per_month: "",
  has_crm: "", tracks_goals_daily: "",
  invests_paid_traffic: "", paid_traffic_monthly: undefined, cost_per_lead: undefined, has_marketing_team: "",
  maturity_organization: 3, maturity_goals: 3, maturity_predictability: 3,
  maturity_lead_quality: 3, maturity_performance: 3,
};

type Diagnosis = {
  diagnosis_text: string;
  performance_level: "baixo" | "medio" | "alto";
  bottlenecks: string[];
  action_plan: { title: string; description: string }[];
};

type Revenue = {
  currentRevenue: number; potentialRevenue: number;
  monthlyLoss: number; annualLoss: number;
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

export default function ScannerVendasUNV() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>(initialData);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [meetingRequested, setMeetingRequested] = useState(false);

  // SEO
  useEffect(() => {
    document.title = "Scanner de Vendas UNV — Diagnóstico Comercial Gratuito";
    const desc = "Descubra em 3 minutos onde sua empresa perde dinheiro nas vendas. Diagnóstico com IA e plano de ação personalizado.";
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); }
    m.setAttribute("content", desc);
  }, []);

  // Meta Pixel — carregamento adiado (após interação ou 4s)
  useEffect(() => {
    let loaded = false;
    const loadPixel = () => {
      if (loaded) return;
      loaded = true;
      const pixelId = "247392077001023";
      (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = "2.0";
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      (window as any).fbq("init", pixelId);
      (window as any).fbq("track", "PageView");
    };

    const timeout = setTimeout(loadPixel, 4000);
    const onInteract = () => loadPixel();
    window.addEventListener("scroll", onInteract, { once: true, passive: true });
    window.addEventListener("pointerdown", onInteract, { once: true });

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("scroll", onInteract);
      window.removeEventListener("pointerdown", onInteract);
    };
  }, []);

  // Restaurar progresso
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.data) setData((d) => ({ ...d, ...saved.data }));
        if (saved.step) setStep(saved.step);
        if (saved.submissionId) setSubmissionId(saved.submissionId);
      }
    } catch {}
  }, []);

  // Salvar progresso
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, step, submissionId }));
  }, [data, step, submissionId]);

  const progress = useMemo(() => Math.round(((step - 1) / TOTAL_STEPS) * 100), [step]);

  const update = <K extends keyof FormData>(k: K, v: FormData[K]) => setData((d) => ({ ...d, [k]: v }));

  // === Etapa 1: cria lead + submissão ===
  const handleStep1Submit = async () => {
    if (!data.full_name.trim() || !data.email.trim() || !data.whatsapp.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (data.whatsapp.replace(/\D/g, "").length < 10) {
      toast.error("WhatsApp inválido");
      return;
    }

    setLoading(true);
    try {
      // Se já tem submissionId (retorno via localStorage), só avança
      if (submissionId) {
        setStep(2);
        return;
      }

      const { data: resp, error } = await supabase.functions.invoke("sales-scanner-analyze", {
        body: {
          action: "create_initial",
          full_name: data.full_name.trim(),
          whatsapp: data.whatsapp,
          email: data.email.trim(),
        },
      });
      if (error || resp?.error) throw new Error(resp?.error || error?.message || "Erro");

      setSubmissionId(resp.submission_id);

      // Meta Pixel — conversão "Lead" após envio dos dados iniciais
      try {
        const pixelId = "247392077001023";
        const w = window as any;
        if (typeof w.fbq === "function") {
          w.fbq("track", "Lead");
        }
        const img = new Image(1, 1);
        img.style.display = "none";
        img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=Lead&noscript=1`;
      } catch {}

      setStep(2);
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar diagnóstico");
    } finally {
      setLoading(false);
    }
  };

  // === Salva progresso da etapa atual ===
  const saveProgress = async (extra: Record<string, any>) => {
    if (!submissionId) return;
    try {
      await supabase.functions.invoke("sales-scanner-analyze", {
        body: { action: "save_progress", submission_id: submissionId, data: extra },
      });
    } catch (e) {
      console.error("save_progress", e);
    }
  };

  const goNext = async () => {
    // valida & salva por etapa
    if (step === 2) {
      if (!data.company_name || !data.revenue_range || !data.has_sales_manager) {
        toast.error("Preencha os campos obrigatórios");
        return;
      }
      await saveProgress({
        company_name: data.company_name,
        segment: data.segment || null,
        revenue_range: data.revenue_range,
        sellers_count: data.sellers_count ? Number(data.sellers_count) : null,
        has_sales_manager: data.has_sales_manager === "sim",
      });
    } else if (step === 3) {
      if (data.lead_channels.length === 0 || !data.has_process) {
        toast.error("Selecione pelo menos um canal e indique o processo");
        return;
      }
      await saveProgress({
        lead_channels: data.lead_channels,
        leads_per_month: data.leads_per_month ? Number(data.leads_per_month) : null,
        has_process: data.has_process,
      });
    } else if (step === 4) {
      if (!data.avg_ticket || !data.conversion_rate || !data.sales_per_month) {
        toast.error("Preencha ticket médio, conversão e vendas/mês");
        return;
      }
      await saveProgress({
        avg_ticket: data.avg_ticket,
        conversion_rate: Number(data.conversion_rate),
        sales_cycle_days: data.sales_cycle_days ? Number(data.sales_cycle_days) : null,
        sales_per_month: Number(data.sales_per_month),
        has_crm: data.has_crm === "sim",
        tracks_goals_daily: data.tracks_goals_daily === "sim",
      });
    } else if (step === 5) {
      await saveProgress({
        invests_paid_traffic: data.invests_paid_traffic === "sim",
        paid_traffic_monthly: data.paid_traffic_monthly || null,
        cost_per_lead: data.cost_per_lead || null,
        has_marketing_team: data.has_marketing_team === "sim",
      });
    }
    setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  // === Etapa 6 final + IA ===
  const handleFinalize = async () => {
    if (!submissionId) return;
    setAnalyzing(true);
    try {
      // salva maturidade primeiro
      await saveProgress({
        maturity_organization: data.maturity_organization,
        maturity_goals: data.maturity_goals,
        maturity_predictability: data.maturity_predictability,
        maturity_lead_quality: data.maturity_lead_quality,
        maturity_performance: data.maturity_performance,
      });

      const { data: resp, error } = await supabase.functions.invoke("sales-scanner-analyze", {
        body: { action: "finalize_and_analyze", submission_id: submissionId },
      });
      if (error || resp?.error) throw new Error(resp?.error || error?.message || "Erro");

      setDiagnosis(resp.diagnosis);
      setRevenue(resp.revenue);
      setStep(7);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar diagnóstico");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRequestMeeting = async () => {
    if (!submissionId) return;
    setLoading(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("sales-scanner-analyze", {
        body: { action: "request_meeting", submission_id: submissionId },
      });
      if (error || resp?.error) throw new Error(resp?.error || error?.message || "Erro");
      setMeetingRequested(true);
      // limpa storage para próximo uso
      localStorage.removeItem(STORAGE_KEY);
    } catch (e: any) {
      toast.error(e.message || "Erro ao solicitar reunião");
    } finally {
      setLoading(false);
    }
  };

  // === Render por etapa ===
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold">Scanner de Vendas UNV</span>
          </div>
          {step <= TOTAL_STEPS && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
              <span>Etapa {step} de {TOTAL_STEPS}</span>
            </div>
          )}
        </div>
        {step <= TOTAL_STEPS && <Progress value={progress} className="h-1 rounded-none" />}
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {step === 1 && (
          <section>
            <div className="text-center mb-8 space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Descubra onde sua empresa está perdendo dinheiro nas vendas
              </h1>
              <p className="text-muted-foreground text-lg">
                Leva menos de 3 minutos e você recebe um diagnóstico completo com números reais
              </p>
              <p className="text-sm text-primary font-medium">
                Empresas sem processo comercial estruturado perdem até 30% do faturamento sem perceber
              </p>
            </div>

            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo *</Label>
                <Input id="name" value={data.full_name}
                  onChange={(e) => update("full_name", e.target.value)} placeholder="Seu nome" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa">WhatsApp *</Label>
                <PhoneInput value={data.whatsapp} onChange={(v) => update("whatsapp", v)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input id="email" type="email" value={data.email}
                  onChange={(e) => update("email", e.target.value)} placeholder="voce@empresa.com" />
              </div>
              <Button className="w-full" size="lg" onClick={handleStep1Submit} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>Começar diagnóstico <ArrowRight className="w-4 h-4" /></>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Seus dados ficam protegidos. Não enviamos spam.
              </p>
            </Card>
          </section>
        )}

        {step === 2 && (
          <StepCard title="Informações da empresa" subtitle="Conte um pouco sobre a sua operação">
            <Field label="Nome da empresa *">
              <Input value={data.company_name} onChange={(e) => update("company_name", e.target.value)} />
            </Field>
            <Field label="Nicho / segmento">
              <Input value={data.segment} onChange={(e) => update("segment", e.target.value)}
                placeholder="Ex: Imobiliário, SaaS, Saúde…" />
            </Field>
            <Field label="Faturamento mensal *">
              <Select value={data.revenue_range} onValueChange={(v) => update("revenue_range", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {REVENUE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Número de vendedores">
              <Input type="number" min={0} value={data.sellers_count}
                onChange={(e) => update("sellers_count", e.target.value)} />
            </Field>
            <Field label="Possui gerente comercial? *">
              <YesNo value={data.has_sales_manager} onChange={(v) => update("has_sales_manager", v)} />
            </Field>
            <NavBtns onBack={goBack} onNext={goNext} />
          </StepCard>
        )}

        {step === 3 && (
          <StepCard title="Estrutura de vendas" subtitle="Como sua máquina comercial funciona hoje">
            <Field label="Como chegam os leads? *">
              <div className="grid grid-cols-2 gap-3">
                {LEAD_CHANNELS.map((c) => (
                  <label key={c.value} className="flex items-center gap-2 p-3 border border-border rounded-md cursor-pointer hover:bg-secondary/50">
                    <Checkbox
                      checked={data.lead_channels.includes(c.value)}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...data.lead_channels, c.value]
                          : data.lead_channels.filter((x) => x !== c.value);
                        update("lead_channels", next);
                      }}
                    />
                    <span className="text-sm">{c.label}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Quantos leads por mês (média)?">
              <Input type="number" min={0} value={data.leads_per_month}
                onChange={(e) => update("leads_per_month", e.target.value)} />
            </Field>
            <Field label="Existe processo comercial definido? *">
              <RadioGroup value={data.has_process} onValueChange={(v) => update("has_process", v)} className="flex gap-4">
                {[{v:"sim",l:"Sim"},{v:"nao",l:"Não"},{v:"parcial",l:"Parcial"}].map((o) => (
                  <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value={o.v} /><span className="text-sm">{o.l}</span>
                  </label>
                ))}
              </RadioGroup>
            </Field>
            <NavBtns onBack={goBack} onNext={goNext} />
          </StepCard>
        )}

        {step === 4 && (
          <StepCard title="Indicadores comerciais" subtitle="Os números que realmente importam">
            <Field label="Ticket médio (R$) *">
              <CurrencyInput value={data.avg_ticket} onChange={(v) => update("avg_ticket", v)} />
            </Field>
            <Field label="Taxa de conversão (%) *">
              <Input type="number" min={0} max={100} step="0.1" value={data.conversion_rate}
                onChange={(e) => update("conversion_rate", e.target.value)} placeholder="Ex: 15" />
            </Field>
            <Field label="Ciclo médio de vendas (dias)">
              <Input type="number" min={0} value={data.sales_cycle_days}
                onChange={(e) => update("sales_cycle_days", e.target.value)} />
            </Field>
            <Field label="Quantas vendas por mês *">
              <Input type="number" min={0} value={data.sales_per_month}
                onChange={(e) => update("sales_per_month", e.target.value)} />
            </Field>
            <Field label="Possui CRM?">
              <YesNo value={data.has_crm} onChange={(v) => update("has_crm", v)} />
            </Field>
            <Field label="Acompanha metas diariamente?">
              <YesNo value={data.tracks_goals_daily} onChange={(v) => update("tracks_goals_daily", v)} />
            </Field>
            <NavBtns onBack={goBack} onNext={goNext} />
          </StepCard>
        )}

        {step === 5 && (
          <StepCard title="Marketing e investimento" subtitle="Como você está alimentando o topo do funil">
            <Field label="Investe em tráfego pago?">
              <YesNo value={data.invests_paid_traffic} onChange={(v) => update("invests_paid_traffic", v)} />
            </Field>
            {data.invests_paid_traffic === "sim" && (
              <Field label="Quanto por mês?">
                <CurrencyInput value={data.paid_traffic_monthly} onChange={(v) => update("paid_traffic_monthly", v)} />
              </Field>
            )}
            <Field label="Custo por lead (se souber)">
              <CurrencyInput value={data.cost_per_lead} onChange={(v) => update("cost_per_lead", v)} />
            </Field>
            <Field label="Tem equipe de marketing?">
              <YesNo value={data.has_marketing_team} onChange={(v) => update("has_marketing_team", v)} />
            </Field>
            <NavBtns onBack={goBack} onNext={goNext} />
          </StepCard>
        )}

        {step === 6 && (
          <StepCard title="Diagnóstico de maturidade" subtitle="Avalie de 1 (péssimo) a 5 (excelente)">
            {[
              { k: "maturity_organization" as const, l: "Organização do time comercial" },
              { k: "maturity_goals" as const, l: "Clareza de metas" },
              { k: "maturity_predictability" as const, l: "Previsibilidade de vendas" },
              { k: "maturity_lead_quality" as const, l: "Qualidade dos leads" },
              { k: "maturity_performance" as const, l: "Performance dos vendedores" },
            ].map((m) => (
              <div key={m.k} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{m.l}</span>
                  <span className="font-semibold text-primary">{data[m.k]}</span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => update(m.k, n)}
                      className={`flex-1 h-10 rounded-md border-2 transition-all ${
                        data[m.k] === n ? "border-primary bg-primary/10 font-semibold" : "border-border hover:border-primary/50"
                      }`}
                    >{n}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={goBack} disabled={analyzing} className="flex-1">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Button>
              <Button onClick={handleFinalize} disabled={analyzing} className="flex-1" size="lg">
                {analyzing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Analisando…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Gerar diagnóstico</>
                )}
              </Button>
            </div>
          </StepCard>
        )}

        {step === 7 && diagnosis && revenue && (
          <ResultView
            diagnosis={diagnosis}
            revenue={revenue}
            data={data}
            meetingRequested={meetingRequested}
            onRequestMeeting={handleRequestMeeting}
            loading={loading}
          />
        )}
      </main>
    </div>
  );
}

// ───────── Helpers visuais ─────────

function StepCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 sm:p-8 space-y-5">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function YesNo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="flex gap-4">
      {[{v:"sim",l:"Sim"},{v:"nao",l:"Não"}].map((o) => (
        <label key={o.v} className="flex items-center gap-2 cursor-pointer">
          <RadioGroupItem value={o.v} /><span className="text-sm">{o.l}</span>
        </label>
      ))}
    </RadioGroup>
  );
}

function NavBtns({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex gap-3 pt-4">
      <Button variant="outline" onClick={onBack} className="flex-1">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>
      <Button onClick={onNext} className="flex-1" size="lg">
        Continuar <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ───────── Resultado ─────────

function ResultView({
  diagnosis, revenue, data, meetingRequested, onRequestMeeting, loading,
}: {
  diagnosis: Diagnosis; revenue: Revenue; data: FormData;
  meetingRequested: boolean; onRequestMeeting: () => void; loading: boolean;
}) {
  const levelColor = {
    baixo: "text-destructive bg-destructive/10",
    medio: "text-amber-600 bg-amber-500/10",
    alto: "text-emerald-600 bg-emerald-500/10",
  }[diagnosis.performance_level];

  const levelLabel = {
    baixo: "Baixo desempenho",
    medio: "Desempenho médio",
    alto: "Alto desempenho",
  }[diagnosis.performance_level];

  const barData = [
    { name: "Atual", valor: revenue.currentRevenue, fill: "hsl(var(--muted-foreground))" },
    { name: "Potencial", valor: revenue.potentialRevenue, fill: "hsl(var(--primary))" },
  ];

  const radarData = [
    { item: "Organização", v: data.maturity_organization },
    { item: "Metas", v: data.maturity_goals },
    { item: "Previsibilidade", v: data.maturity_predictability },
    { item: "Leads", v: data.maturity_lead_quality },
    { item: "Performance", v: data.maturity_performance },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold ${levelColor}`}>
          <Activity className="w-4 h-4" /> {levelLabel}
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold">Seu diagnóstico está pronto</h2>
        <p className="text-muted-foreground">Análise completa baseada nos dados informados</p>
      </div>

      {/* Cards de destaque */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard icon={DollarSign} label="Faturamento atual" value={fmtBRL(revenue.currentRevenue)} />
        <KPICard icon={TrendingUp} label="Faturamento potencial" value={fmtBRL(revenue.potentialRevenue)} highlight />
        <KPICard icon={AlertTriangle} label="Perda mensal" value={fmtBRL(revenue.monthlyLoss)} danger />
        <KPICard icon={Target} label="Perda anual" value={fmtBRL(revenue.annualLoss)} danger />
      </div>

      {/* CTA principal */}
      <Card className="p-6 sm:p-8 bg-primary/5 border-primary/20">
        <div className="space-y-4 text-center">
          <p className="text-lg sm:text-xl">
            Hoje você está deixando de faturar aproximadamente{" "}
            <span className="font-bold text-primary">{fmtBRL(revenue.monthlyLoss)}</span>{" "}
            por mês por falta de estrutura comercial.
          </p>
          {!meetingRequested ? (
            <Button size="xl" onClick={onRequestMeeting} disabled={loading} className="w-full sm:w-auto">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>Quero resolver isso agora <ArrowRight className="w-5 h-5" /></>
              )}
            </Button>
          ) : (
            <div className="inline-flex items-center gap-2 text-primary font-semibold text-lg">
              <CheckCircle2 className="w-5 h-5" />
              Nosso time vai entrar em contato com você
            </div>
          )}
        </div>
      </Card>

      {/* Diagnóstico texto */}
      <Card className="p-6">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Diagnóstico geral
        </h3>
        <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
          {diagnosis.diagnosis_text}
        </p>
        {diagnosis.bottlenecks.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {diagnosis.bottlenecks.map((b) => (
              <span key={b} className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                {b}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="font-bold mb-4">Faturamento: atual vs potencial</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => fmtBRL(v)}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              />
              <Bar dataKey="valor" radius={[8, 8, 0, 0]}>
                {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">Maturidade comercial</h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="item" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 5]} stroke="hsl(var(--muted-foreground))" />
              <Radar dataKey="v" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Plano de ação */}
      <Card className="p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" /> Plano de ação sugerido
        </h3>
        <div className="space-y-3">
          {diagnosis.action_plan.map((a, i) => (
            <div key={i} className="flex gap-3 p-4 rounded-lg border border-border">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                {i + 1}
              </div>
              <div>
                <p className="font-semibold">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* CTA repetido */}
      {!meetingRequested && (
        <div className="text-center pt-4">
          <Button size="xl" onClick={onRequestMeeting} disabled={loading} variant="premium">
            Quero resolver isso agora <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, highlight, danger }: {
  icon: any; label: string; value: string; highlight?: boolean; danger?: boolean;
}) {
  return (
    <Card className={`p-4 ${highlight ? "border-primary/40 bg-primary/5" : ""} ${danger ? "border-destructive/30 bg-destructive/5" : ""}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className={`text-lg font-bold ${danger ? "text-destructive" : highlight ? "text-primary" : ""}`}>
        {value}
      </div>
    </Card>
  );
}
