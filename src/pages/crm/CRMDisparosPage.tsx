// Disparos pela API oficial do WhatsApp: lista de todos os disparos, detalhe por
// disparo (quem recebeu, leu, respondeu, falhou e por quê), histórico de erros e
// custo estimado. O dialog de template abre /crm/disparos/:id ao terminar.
// Dados: whatsapp_official_campaigns + _recipients (RPCs official_campaigns_list,
// official_campaign_recipients, official_campaign_errors). O status de entrega
// vem do whatsapp-official-webhook.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DisparosPainel } from "@/components/crm/disparos/DisparosPainel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OfficialTemplatesTab } from "@/components/crm/settings/OfficialTemplatesTab";
import { cancelarDisparo, retomarDisparo, pausadoPorPagamento, linkPagamentoMeta } from "@/components/crm/OfficialDispatchProgress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, ArrowLeft, CalendarDays, Download, Loader2, RefreshCw, RotateCcw, Search, ShieldCheck } from "lucide-react";

interface CampaignRow {
  id: string; created_at: string; finished_at: string | null; status: string; template_name: string;
  template_category: string | null; created_by_name: string | null; source: string | null; notes: string | null;
  official_instance_id: string | null; total: number; skipped: number; send_errors: number; accepted: number;
  delivered: number; read: number; failed: number; billable: number; responded: number; opted_out: number;
}
interface RecipientRow {
  id: string; lead_id: string | null; lead_name: string | null; phone: string | null; status: string;
  error_text: string | null; sent_at: string | null; conversation_id: string | null; stage_reverted: boolean;
  billable: boolean | null; reply_text: string | null; reply_at: string | null; replies: number;
  stage_name: string | null; pipeline_name: string | null; moved_to_stage_name: string | null;
}
interface ErrorRow {
  recipient_id: string; campaign_id: string; campaign_at: string; template_name: string; lead_id: string | null;
  lead_name: string | null; phone: string | null; status: string; error_text: string | null; at: string;
}
interface Instance { id: string; display_name: string | null; pricing_rates: Record<string, number> | null; waba_id?: string | null; business_id?: string | null }

const DEFAULT_RATES: Record<string, number> = { MARKETING: 0.3125, UTILITY: 0.04, AUTHENTICATION: 0.04 };

const STATUS_LABEL: Record<string, string> = {
  pending: "Na fila", processing: "Enviando", skipped: "Pulado", error: "Erro no envio", sent: "Enviado",
  delivered: "Entregue", read: "Lido", failed: "Não entregue",
};
const STATUS_CLASS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  processing: "bg-primary/10 text-primary",
  skipped: "bg-muted text-muted-foreground",
  error: "bg-red-500/15 text-red-700 dark:text-red-400",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  sent: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  delivered: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  read: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

// Motivos mais comuns da Meta, em português de gente
const ERROR_HELP: Record<string, string> = {
  "131048": "A Meta limitou o número por taxa de spam: muita gente bloqueou ou denunciou mensagens recentes. Espere o limite normalizar antes de reenviar.",
  "130472": "O contato está num teste da Meta que bloqueia mensagens de marketing. Não adianta reenviar agora.",
  "131026": "O número não recebe: não tem WhatsApp, é fixo, o app está muito desatualizado ou a pessoa não aceitou os termos novos do WhatsApp.",
  "131049": "A Meta segurou a mensagem de marketing porque esse número já recebeu muitas mensagens de empresas. Dá pra tentar de novo outro dia.",
  "131050": "A pessoa bloqueou mensagens de marketing da sua empresa.",
  "131047": "Fora da janela de 24h: nesse caso só template pode ser enviado.",
  "131008": "Faltou preencher uma variável do template.",
  "131009": "Algum valor de variável foi recusado pela Meta.",
  "132000": "A quantidade de variáveis não bate com o template aprovado.",
  "132001": "O template não existe ou não está aprovado nesse idioma.",
  "132015": "Template pausado pela Meta por baixa qualidade.",
  "132016": "Template desativado pela Meta por baixa qualidade.",
  "130429": "Limite de envios por segundo da Meta. Tente de novo em instantes.",
  "131056": "Muitas mensagens pro mesmo número em pouco tempo.",
  "131042": "Problema no método de pagamento da conta da Meta.",
  "141006": "Problema no método de pagamento da conta da Meta.",
  "131031": "A conta da Meta está bloqueada ou restrita.",
  "368": "Conta temporariamente bloqueada por violar política da Meta.",
  "100": "Algum parâmetro enviado pra Meta é inválido.",
};
const errorCode = (t: string | null) => (String(t || "").match(/\b(1\d{5}|130429|368|100)\b/) || [])[1] || "";
const errorLabel = (t: string | null) => {
  const c = errorCode(t);
  return c ? `${c}` : "Outro";
};

const n = (v: unknown) => Number(v || 0);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const tplLabel = (name: string) => name.replace(/_/g, " ");

// Filtro por data (data do disparo). Datas no fuso do navegador.
type Periodo = "hoje" | "ontem" | "7" | "30" | "90" | "180" | "custom";
const PERIODO_LABEL: Record<Periodo, string> = {
  hoje: "Hoje", ontem: "Ontem", "7": "Últimos 7 dias", "30": "Últimos 30 dias",
  "90": "Últimos 90 dias", "180": "Últimos 180 dias", custom: "Personalizado",
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inicioDoDia = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
function intervaloDo(periodo: Periodo, de: string, ate: string): { from: Date; to: Date } {
  const hoje = inicioDoDia(ymd(new Date()));
  const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
  if (periodo === "hoje") return { from: hoje, to: amanha };
  if (periodo === "ontem") { const o = new Date(hoje); o.setDate(o.getDate() - 1); return { from: o, to: hoje }; }
  if (periodo === "custom") {
    const from = de ? inicioDoDia(de) : new Date(2020, 0, 1);
    const to = ate ? inicioDoDia(ate) : new Date(hoje);
    to.setDate(to.getDate() + 1);
    return { from, to };
  }
  const from = new Date(hoje); from.setDate(from.getDate() - (Number(periodo) - 1));
  return { from, to: amanha };
}

function useInstances() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from("whatsapp_official_instances").select("id, display_name, pricing_rates, waba_id, business_id");
    setInstances((data || []) as Instance[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  const rateFor = (instanceId: string | null, category: string | null) => {
    const inst = instances.find((i) => i.id === instanceId) || instances[0];
    const rates = { ...DEFAULT_RATES, ...(inst?.pricing_rates || {}) };
    return rates[(category || "MARKETING").toUpperCase()] ?? rates.MARKETING;
  };
  return { instances, rateFor, reload: load };
}

// Uso do limite diário: a Meta conta CONTATOS ÚNICOS com template numa janela móvel de 24h.
async function contarEnviosDoDia() {
  const desde24 = new Date(Date.now() - 864e5);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const inicio = desde24 < hoje ? desde24 : hoje;
  const { data } = await supabase.from("whatsapp_official_campaign_recipients" as any)
    .select("phone, sent_at")
    .in("status", ["sent", "delivered", "read"]) // falha de entrega não consome limite nem conta como enviado
    .gte("sent_at", inicio.toISOString())
    .limit(10000);
  // último envio de cada contato na janela: ele sai da conta da Meta 24h depois desse envio
  const ultimoPorContato = new Map<string, number>();
  let hojeTotal = 0;
  for (const r of (data || []) as any[]) {
    const t = new Date(r.sent_at).getTime();
    if (t >= desde24.getTime() && r.phone) ultimoPorContato.set(r.phone, Math.max(ultimoPorContato.get(r.phone) || 0, t));
    if (t >= hoje.getTime()) hojeTotal++;
  }
  const fimDoDia = new Date(); fimDoDia.setHours(23, 59, 59, 999);
  let liberamHoje = 0;
  let proximaLiberacao: number | null = null;
  for (const t of ultimoPorContato.values()) {
    const libera = t + 864e5;
    if (libera <= fimDoDia.getTime()) liberamHoje++;
    if (proximaLiberacao === null || libera < proximaLiberacao) proximaLiberacao = libera;
  }
  return { ultimas24: ultimoPorContato.size, hoje: hojeTotal, liberamHoje, proximaLiberacao };
}

const QUALIDADE: Record<string, { label: string; cls: string }> = {
  GREEN: { label: "Alta", cls: "text-emerald-600" },
  YELLOW: { label: "Média", cls: "text-amber-600" },
  RED: { label: "Baixa", cls: "text-red-600" },
};

function LimiteDiarioCard({ instanceId, refreshKey }: { instanceId: string | null; refreshKey: number }) {
  const [lim, setLim] = useState<any>(null);
  const [uso, setUso] = useState<{ ultimas24: number; hoje: number; liberamHoje: number; proximaLiberacao: number | null } | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!instanceId) return;
    (async () => {
      const [res, u] = await Promise.all([
        supabase.functions.invoke("whatsapp-official-api", { body: { action: "getLimits", instanceId } }),
        contarEnviosDoDia(),
      ]);
      if (res.error || res.data?.error) setErro("Não consegui consultar o limite na Meta agora.");
      else { setErro(""); setLim(res.data); }
      setUso(u);
    })();
  }, [instanceId, refreshKey]);

  const limite: number | null = lim ? lim.dailyLimit : null;
  const usados = uso?.ultimas24 ?? 0;
  const restam = limite == null ? null : Math.max(limite - usados, 0);
  // quanto ainda dá pra disparar até 23:59: o que está livre agora + contatos que saem da janela de 24h hoje
  const disponivelHoje = limite == null || !uso ? null : Math.min(limite, (restam || 0) + uso.liberamHoje);
  const corDisponivel = disponivelHoje == null ? "" : disponivelHoje === 0 ? "text-red-600" : limite && disponivelHoje < limite * 0.2 ? "text-amber-600" : "text-emerald-600";
  const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const pctUso = limite ? Math.min(100, Math.round((usados / limite) * 100)) : 0;
  const barra = pctUso >= 90 ? "bg-red-500" : pctUso >= 70 ? "bg-amber-500" : "bg-emerald-500";
  const q = QUALIDADE[lim?.qualityRating || ""];
  const nomePendente = (lim?.info || []).some((i: string) => /display name has not been approved/i.test(i));

  return (
    <Card>
      <CardContent className="p-4 flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Limite diário liberado</div>
          <div className="text-xl font-semibold tabular-nums">
            {lim ? (limite == null ? "Ilimitado" : limite.toLocaleString("pt-BR")) : erro ? "—" : <Loader2 className="h-4 w-4 animate-spin" />}
            {limite != null && <span className="ml-1 text-xs font-normal text-muted-foreground">contatos a cada 24h</span>}
          </div>
          {lim && (
            <div className="text-[11px] text-muted-foreground">
              Qualidade do número: <span className={`font-medium ${q?.cls || ""}`}>{q?.label || lim.qualityRating || "—"}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-[240px] space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span>Usados nas últimas 24h</span>
            <span className="tabular-nums font-medium">{usados}{limite != null ? ` de ${limite.toLocaleString("pt-BR")}` : ""}</span>
          </div>
          {limite != null && (
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${barra}`} style={{ width: `${pctUso}%` }} />
            </div>
          )}
          <div className="text-[11px] text-muted-foreground">
            {restam != null ? `Restam ${restam.toLocaleString("pt-BR")} contatos novos agora. ` : ""}
            Conta só contatos únicos com template enviado ou entregue numa janela móvel de 24h; falhas ficam de fora.
          </div>
        </div>

        <div className="rounded-lg border-2 border-primary/20 bg-primary/5 px-4 py-2.5 min-w-[190px]">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Ainda dá pra disparar hoje</div>
          <div className={`text-3xl font-bold tabular-nums leading-tight ${corDisponivel}`}>
            {disponivelHoje == null ? (lim || erro ? "—" : <Loader2 className="h-5 w-5 animate-spin" />) : disponivelHoje.toLocaleString("pt-BR")}
          </div>
          {disponivelHoje != null && (
            <div className="text-[11px] text-muted-foreground">
              {(restam || 0).toLocaleString("pt-BR")} agora
              {uso && uso.liberamHoje > 0 ? ` + ${uso.liberamHoje.toLocaleString("pt-BR")} liberam até 23:59` : ""}
              {uso && (restam || 0) === 0 && uso.proximaLiberacao ? ` · próxima liberação às ${hhmm(uso.proximaLiberacao)}` : ""}
            </div>
          )}
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Enviados hoje</div>
          <div className="text-xl font-semibold tabular-nums">{uso ? uso.hoje : "—"}</div>
          <div className="text-[11px] text-muted-foreground">desde 00:00</div>
        </div>

        {(nomePendente || erro) && (
          <div className="basis-full text-[11px] text-amber-700 dark:text-amber-400">
            {erro || "O nome de exibição do número ainda não foi aprovado pela Meta. O limite sobe depois da aprovação."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-xl font-semibold tabular-nums ${tone || ""}`}>{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_CLASS[status] || "bg-muted"}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CRMDisparosPage() {
  const { id } = useParams();
  return id ? <DisparoDetalhe id={id} /> : <DisparosLista />;
}

// ───────────────────────── Lista ─────────────────────────
function DisparosLista() {
  const navigate = useNavigate();
  const { instances, rateFor, reload: reloadInstances } = useInstances();
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  // resultado comercial atribuído ao disparo (reuniões, no-show, vendas)
  const [outcomes, setOutcomes] = useState<Map<string, { agendadas: number; realizadas: number; no_show: number; vendas: number; valor_vendas: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [rateInput, setRateInput] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [refreshKey, setRefreshKey] = useState(0);
  const [pagina, setPagina] = useState(1);   // 10 disparos por página (24/09/2026)
  const POR_PAGINA = 10;
  const [de, setDe] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return ymd(d); });
  const [ate, setAte] = useState(() => ymd(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
    const { from, to } = intervaloDo(periodo, de, ate);
    const range = { p_from: from.toISOString(), p_to: to.toISOString() };
    const [c, e, o] = await Promise.all([
      supabase.rpc("official_campaigns_range" as any, range),
      supabase.rpc("official_campaign_errors_range" as any, range),
      supabase.rpc("official_campaign_outcomes" as any, range),
    ]);
    setOutcomes(new Map(((o.data || []) as any[]).map((x) => [x.campaign_id, {
      agendadas: n(x.agendadas), realizadas: n(x.realizadas), no_show: n(x.no_show), vendas: n(x.vendas), valor_vendas: Number(x.valor_vendas || 0),
    }])));
    if (c.error) toast.error("Não consegui carregar os disparos");
    setRows(((c.data || []) as any[]).map((r) => ({ ...r })) as CampaignRow[]);
    setErrors((e.data || []) as ErrorRow[]);
    setLoading(false);
  }, [periodo, de, ate]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPagina(1); }, [periodo, de, ate]);

  const periodoTexto = periodo === "custom"
    ? `${de ? inicioDoDia(de).toLocaleDateString("pt-BR") : "início"} a ${ate ? inicioDoDia(ate).toLocaleDateString("pt-BR") : "hoje"}`
    : PERIODO_LABEL[periodo];

  useEffect(() => {
    const inst = instances[0];
    if (inst) setRateInput(String({ ...DEFAULT_RATES, ...(inst.pricing_rates || {}) }.MARKETING).replace(".", ","));
  }, [instances]);

  const costOf = (r: CampaignRow) => n(r.billable) * rateFor(r.official_instance_id, r.template_category);

  const totals = useMemo(() => {
    const t = { campaigns: rows.length, accepted: 0, delivered: 0, read: 0, responded: 0, failed: 0, errors: 0, cost: 0,
      agendadas: 0, realizadas: 0, noShow: 0, vendas: 0, valorVendas: 0 };
    for (const r of rows) {
      t.accepted += n(r.accepted); t.delivered += n(r.delivered); t.read += n(r.read);
      t.responded += n(r.responded); t.failed += n(r.failed); t.errors += n(r.send_errors); t.cost += costOf(r);
      const o = outcomes.get(r.id);
      if (o) { t.agendadas += o.agendadas; t.realizadas += o.realizadas; t.noShow += o.no_show; t.vendas += o.vendas; t.valorVendas += o.valor_vendas; }
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, instances, outcomes]);

  const errorGroups = useMemo(() => {
    const map = new Map<string, { code: string; count: number; sample: string }>();
    for (const e of errors) {
      const code = errorLabel(e.error_text);
      const g = map.get(code) || { code, count: 0, sample: e.error_text || "" };
      g.count++;
      map.set(code, g);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [errors]);

  const saveRate = async () => {
    const v = Number(rateInput.replace(",", "."));
    if (!Number.isFinite(v) || v < 0) { toast.error("Valor inválido"); return; }
    setSavingRate(true);
    for (const inst of instances) {
      const rates = { ...DEFAULT_RATES, ...(inst.pricing_rates || {}), MARKETING: v };
      const { error } = await supabase.from("whatsapp_official_instances").update({ pricing_rates: rates } as any).eq("id", inst.id);
      if (error) { toast.error("Sem permissão pra alterar o custo"); setSavingRate(false); return; }
    }
    setSavingRate(false);
    toast.success("Custo por mensagem atualizado");
    reloadInstances();
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
        <h1 className="text-xl font-bold">Disparos API oficial</h1>
        <span className="text-xs text-muted-foreground">{periodoTexto}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="h-8 w-[170px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIODO_LABEL) as Periodo[]).map((k) => (
                  <SelectItem key={k} value={k}>{PERIODO_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {periodo === "custom" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Input type="date" className="h-8 w-[150px] text-sm" value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} />
              <span>até</span>
              <Input type="date" className="h-8 w-[150px] text-sm" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} />
            </div>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="painel">
        <TabsList>
          <TabsTrigger value="painel">Painel</TabsTrigger>
          <TabsTrigger value="resumo">Números e limite</TabsTrigger>
          <TabsTrigger value="disparos">Disparos</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="erros" className="gap-1.5">
            Histórico de erros {errors.length > 0 && <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">{errors.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-4 space-y-5">
          <LimiteDiarioCard instanceId={instances[0]?.id || null} refreshKey={refreshKey} />

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            <Stat label="Disparos" value={totals.campaigns} />
            <Stat label="Enviados" value={totals.accepted} />
            <Stat label="Entregues" value={totals.delivered} sub={pct(totals.delivered, totals.accepted)} />
            <Stat label="Lidos" value={totals.read} sub={pct(totals.read, totals.delivered)} />
            <Stat label="Responderam" value={totals.responded} sub={pct(totals.responded, totals.delivered)} tone="text-emerald-600" />
            <Stat label="Falhas" value={totals.failed + totals.errors} sub={`${totals.failed} não entregues · ${totals.errors} erro no envio`} tone="text-red-600" />
            <Stat label="Custo estimado" value={brl(totals.cost)} sub="só mensagens entregues" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Reuniões agendadas" value={totals.agendadas} sub={`${pct(totals.agendadas, totals.responded)} de quem respondeu`} tone="text-blue-600" />
            <Stat label="Reuniões realizadas" value={totals.realizadas} sub={totals.realizadas + totals.noShow ? `${pct(totals.realizadas, totals.realizadas + totals.noShow)} de comparecimento` : undefined} tone="text-emerald-600" />
            <Stat label="No-show" value={totals.noShow} tone="text-amber-600" />
            <Stat label="Vendas" value={totals.vendas} sub={totals.realizadas ? `${pct(totals.vendas, totals.realizadas)} das reuniões realizadas` : undefined} tone="text-emerald-700" />
          </div>

          {/* Dinheiro: quanto custou cada etapa e quanto voltou */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Stat label="Custo por reunião agendada" value={totals.agendadas ? brl(totals.cost / totals.agendadas) : "—"} sub="custo estimado ÷ agendadas" />
            <Stat label="Custo por reunião realizada" value={totals.realizadas ? brl(totals.cost / totals.realizadas) : "—"} sub="custo estimado ÷ realizadas" />
            <Stat label="CAC" value={totals.vendas ? brl(totals.cost / totals.vendas) : "—"} sub={totals.vendas ? "custo estimado ÷ vendas" : "ainda sem venda no período"} />
            <Stat label="Ticket médio" value={totals.vendas ? brl(totals.valorVendas / totals.vendas) : "—"} sub={totals.vendas ? `${totals.vendas} venda${totals.vendas > 1 ? "s" : ""}` : undefined} tone="text-emerald-700" />
            <Stat label="Valor de vendas" value={brl(totals.valorVendas)} sub={totals.cost > 0 && totals.valorVendas > 0 ? `retorno de ${(totals.valorVendas / totals.cost).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x sobre o custo` : undefined} tone="text-emerald-700" />
          </div>
          <p className="-mt-1 text-[11px] text-muted-foreground">
            Reuniões e vendas contam pro último disparo que chegou no lead antes delas, em até 30 dias.
          </p>
        </TabsContent>

        <TabsContent value="painel" className="mt-4">
          <DisparosPainel from={intervaloDo(periodo, de, ate).from} to={intervaloDo(periodo, de, ate).to} periodoTexto={periodoTexto} />
        </TabsContent>

        <TabsContent value="disparos" className="mt-4 space-y-3">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…</div>
          ) : !rows.length ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum disparo nesse período. Pra disparar, selecione leads em Negócios e use "Template oficial".</div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Data</th>
                    <th className="text-left font-medium px-3 py-2">Template</th>
                    <th className="text-left font-medium px-3 py-2">Quem enviou</th>
                    <th className="text-right font-medium px-3 py-2">Enviados</th>
                    <th className="text-right font-medium px-3 py-2">Entregues</th>
                    <th className="text-right font-medium px-3 py-2">Lidos</th>
                    <th className="text-right font-medium px-3 py-2">Responderam</th>
                    <th className="text-right font-medium px-3 py-2">Agendadas</th>
                    <th className="text-right font-medium px-3 py-2">Realizadas</th>
                    <th className="text-right font-medium px-3 py-2">No-show</th>
                    <th className="text-right font-medium px-3 py-2">Vendas</th>
                    <th className="text-right font-medium px-3 py-2">Falhas</th>
                    <th className="text-right font-medium px-3 py-2">Pulados</th>
                    <th className="text-right font-medium px-3 py-2">Custo est.</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => navigate(`/crm/disparos/${r.id}`)}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {dt(r.created_at)}
                        {r.status === "sending" && <Badge variant="secondary" className="ml-2 text-[10px]">Enviando</Badge>}
                        {r.status === "paused" && <Badge variant="outline" className="ml-2 text-[10px] border-amber-500 text-amber-700">Pausado</Badge>}
                        {r.status === "canceled" && <Badge variant="outline" className="ml-2 text-[10px]">Cancelado</Badge>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{tplLabel(r.template_name)}</div>
                        <div className="text-[11px] text-muted-foreground">{(r.template_category || "").toLowerCase()}{r.source === "backfill" ? " · reconstruído do histórico" : ""}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.created_by_name || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{n(r.accepted)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{n(r.delivered)} <span className="text-[11px] text-muted-foreground">{pct(n(r.delivered), n(r.accepted))}</span></td>
                      <td className="px-3 py-2 text-right tabular-nums">{n(r.read)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">{n(r.responded)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-blue-700 dark:text-blue-400">{outcomes.get(r.id)?.agendadas || 0}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{outcomes.get(r.id)?.realizadas || 0}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">{outcomes.get(r.id)?.no_show || 0}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {outcomes.get(r.id)?.vendas || 0}
                        {outcomes.get(r.id)?.vendas ? <div className="text-[11px] text-muted-foreground">{brl(outcomes.get(r.id)!.valor_vendas)}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600">{n(r.failed) + n(r.send_errors)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{n(r.skipped)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{brl(costOf(r))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > POR_PAGINA && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, rows.length)} de {rows.length} disparos
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
                {Array.from({ length: Math.ceil(rows.length / POR_PAGINA) }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === Math.ceil(rows.length / POR_PAGINA) || Math.abs(p - pagina) <= 1)
                  .map((p, i, arr) => (
                    <span key={p} className="flex items-center gap-1">
                      {i > 0 && arr[i - 1] !== p - 1 && <span className="text-muted-foreground px-1">…</span>}
                      <Button variant={p === pagina ? "default" : "outline"} size="sm" className="h-8 w-8 p-0" onClick={() => setPagina(p)}>{p}</Button>
                    </span>
                  ))}
                <Button variant="outline" size="sm" className="h-8" disabled={pagina >= Math.ceil(rows.length / POR_PAGINA)} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs">
            <span className="font-medium">Custo por mensagem de marketing entregue</span>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">R$</span>
              <Input className="h-8 w-24" value={rateInput} onChange={(e) => setRateInput(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" className="h-8" onClick={saveRate} disabled={savingRate}>Salvar</Button>
            <span className="text-muted-foreground">
              A Meta não informa o custo por API nesta conta. O valor é estimado; confira na fatura da Meta e ajuste aqui.
            </span>
          </div>
        </TabsContent>

        {/* Templates da API oficial (antes ficava em Configurações do CRM) */}
        <TabsContent value="templates" className="mt-4">
          <OfficialTemplatesTab />
        </TabsContent>

        <TabsContent value="erros" className="mt-4 space-y-4">
          {!errors.length ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum erro nesse período.</div>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-2">
                {errorGroups.map((g) => (
                  <div key={g.code} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="font-semibold">{g.code === "Outro" ? "Outros erros" : `Erro ${g.code}`}</span>
                      <Badge variant="destructive" className="ml-auto">{g.count}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{ERROR_HELP[g.code] || g.sample}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadCsv("erros-disparos.csv", [
                  ["Data", "Lead", "Telefone", "Template", "Status", "Erro"],
                  ...errors.map((e) => [dt(e.at), e.lead_name, e.phone, e.template_name, STATUS_LABEL[e.status] || e.status, e.error_text]),
                ])}>
                  <Download className="h-3.5 w-3.5" /> Exportar
                </Button>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Quando</th>
                      <th className="text-left font-medium px-3 py-2">Lead</th>
                      <th className="text-left font-medium px-3 py-2">Telefone</th>
                      <th className="text-left font-medium px-3 py-2">Disparo</th>
                      <th className="text-left font-medium px-3 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.map((e) => (
                      <tr key={e.recipient_id} className="border-t align-top">
                        <td className="px-3 py-2 whitespace-nowrap">{dt(e.at)}</td>
                        <td className="px-3 py-2">
                          {e.lead_id ? <Link to={`/crm/leads/${e.lead_id}`} className="font-medium hover:underline">{e.lead_name || "Lead"}</Link> : (e.lead_name || "—")}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">{e.phone || "—"}</td>
                        <td className="px-3 py-2">
                          <Link to={`/crm/disparos/${e.campaign_id}`} className="hover:underline">{tplLabel(e.template_name)}</Link>
                          <div className="text-[11px] text-muted-foreground">{dt(e.campaign_at)}</div>
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={e.status} />
                          <div className="mt-1 text-xs">{ERROR_HELP[errorCode(e.error_text)] || e.error_text}</div>
                          {ERROR_HELP[errorCode(e.error_text)] && <div className="text-[11px] text-muted-foreground">{e.error_text}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────────────────── Reenvio das falhas ─────────────────────────
// Erros em que reenviar não resolve: vêm desmarcados
const FALHA_PERMANENTE = new Set(["131026", "130472", "131050"]);
// mesmo critério da RPC official_campaign_retry: código numérico no começo do erro
const codigoFalha = (t: string | null) => (String(t || "").match(/^\d+/) || [])[0] || "outros";

function ReenviarFalhasDialog({ campaign, rows, open, onOpenChange }: {
  campaign: any; rows: RecipientRow[]; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const grupos = useMemo(() => {
    const m = new Map<string, { code: string; count: number; sample: string }>();
    for (const r of rows) {
      if (!["failed", "error"].includes(r.status)) continue;
      const code = codigoFalha(r.error_text);
      const g = m.get(code) || { code, count: 0, sample: r.error_text || "Sem detalhe" };
      g.count++;
      m.set(code, g);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [rows]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [restam, setRestam] = useState<number | null | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMarcados(new Set(grupos.filter((g) => !FALHA_PERMANENTE.has(g.code)).map((g) => g.code)));
    setRestam(undefined);
    (async () => {
      const [res, uso] = await Promise.all([
        supabase.functions.invoke("whatsapp-official-api", { body: { action: "getLimits", instanceId: campaign.official_instance_id } }),
        contarEnviosDoDia(),
      ]);
      const limite = res.error || res.data?.error ? null : res.data?.dailyLimit ?? null;
      setRestam(limite == null ? null : Math.max(limite - uso.ultimas24, 0));
    })();
  }, [open, grupos, campaign.official_instance_id]);

  const selecionados = grupos.filter((g) => marcados.has(g.code)).reduce((a, g) => a + g.count, 0);
  const spamRecente = rows.some((r) => codigoFalha(r.error_text) === "131048" && r.sent_at && Date.now() - Date.parse(r.sent_at) < 864e5);

  const reenviar = async () => {
    if (!selecionados || enviando) return;
    setEnviando(true);
    const { data, error } = await (supabase as any).rpc("official_campaign_retry", { p_campaign: campaign.id, p_codes: [...marcados] });
    if (error || !data?.campaign_id) {
      toast.error(error?.message || "Não consegui criar o reenvio");
      setEnviando(false);
      return;
    }
    const { error: invErr } = await supabase.functions.invoke("official-campaign-dispatch", { body: { campaign_id: data.campaign_id } });
    if (invErr) {
      await supabase.from("whatsapp_official_campaigns" as any)
        .update({ status: "paused", notes: "O envio não iniciou no servidor. Clique em Retomar." } as any).eq("id", data.campaign_id);
      toast.error("O reenvio foi criado mas não iniciou. Abra o disparo e clique em Retomar.");
    } else {
      toast.success(`Reenvio iniciado para ${data.total} contato(s)`);
    }
    setEnviando(false);
    onOpenChange(false);
    navigate(`/crm/disparos/${data.campaign_id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reenviar mensagens que falharam</DialogTitle>
          <DialogDescription>
            Cria um disparo novo só com essas pessoas: mesmo template, variáveis, etapa, agente e etiquetas.
            Quem já recebeu esse template nos últimos 7 dias fica de fora.
          </DialogDescription>
        </DialogHeader>

        {spamRecente && (
          <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-800 dark:text-red-300 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              A Meta limitou este número por taxa de spam nas últimas 24h (131048). Reenviar agora tende a falhar de novo e
              derrubar a qualidade do número. O ideal é esperar. Se a Meta seguir recusando, o reenvio pausa sozinho.
            </span>
          </div>
        )}
        {restam != null && selecionados > restam && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
            Restam {restam} contatos no limite das últimas 24h e você vai reenviar pra {selecionados}. O que passar do limite a Meta recusa.
          </div>
        )}

        <div className="space-y-2">
          {grupos.map((g) => {
            const permanente = FALHA_PERMANENTE.has(g.code);
            return (
              <label key={g.code} className="flex items-start gap-2 rounded-md border p-2.5 cursor-pointer hover:bg-muted/40">
                <Checkbox
                  className="mt-0.5"
                  checked={marcados.has(g.code)}
                  onCheckedChange={(v) => setMarcados((prev) => {
                    const n = new Set(prev);
                    if (v === true) n.add(g.code); else n.delete(g.code);
                    return n;
                  })}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {g.code === "outros" ? "Outros erros" : `Erro ${g.code}`}
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{g.count}</Badge>
                    {permanente && <span className="text-[11px] font-normal text-muted-foreground">não adianta reenviar</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{ERROR_HELP[g.code] || g.sample}</p>
                </div>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={reenviar} disabled={!selecionados || enviando} className="gap-1.5">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {selecionados ? `Reenviar pra até ${selecionados}` : "Selecione um motivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Detalhe ─────────────────────────
type Filtro = "todos" | "entregues" | "lidos" | "responderam" | "sem_resposta" | "falhas" | "pulados";

function DisparoDetalhe({ id }: { id: string }) {
  const { instances, rateFor } = useInstances();
  const [campaign, setCampaign] = useState<any>(null);
  const [rows, setRows] = useState<RecipientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [reenviarOpen, setReenviarOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [c, r] = await Promise.all([
      supabase.from("whatsapp_official_campaigns" as any).select("*").eq("id", id).maybeSingle(),
      supabase.rpc("official_campaign_recipients" as any, { p_campaign: id }),
    ]);
    setCampaign(c.data || null);
    setRows((r.data || []) as RecipientRow[]);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // disparo recente: status de entrega e respostas chegam nos minutos seguintes
  useEffect(() => {
    if (!campaign) return;
    const recente = campaign.status === "sending" || campaign.status === "paused" || Date.now() - new Date(campaign.created_at).getTime() < 3 * 3600e3;
    if (!recente) return;
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [campaign, load]);

  const stats = useMemo(() => {
    const s = { total: rows.length, accepted: 0, delivered: 0, read: 0, responded: 0, failed: 0, errors: 0, skipped: 0, pending: 0, billable: 0, reverted: 0, optOut: 0 };
    for (const r of rows) {
      if (["sent", "delivered", "read", "failed"].includes(r.status)) s.accepted++;
      if (["delivered", "read"].includes(r.status)) s.delivered++;
      if (r.status === "read") s.read++;
      if (r.status === "failed") s.failed++;
      if (r.status === "error") s.errors++;
      if (r.status === "skipped") s.skipped++;
      if (r.status === "pending" || r.status === "processing") s.pending++;
      if (r.reply_at) s.responded++;
      if (r.billable === true || (r.billable === null && ["delivered", "read"].includes(r.status))) s.billable++;
      if (r.stage_reverted) s.reverted++;
      if (/parar de receber/i.test(r.reply_text || "")) s.optOut++;
    }
    return s;
  }, [rows]);

  const cost = stats.billable * rateFor(campaign?.official_instance_id || null, campaign?.template_category || null);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtro === "entregues" && !["delivered", "read"].includes(r.status)) return false;
      if (filtro === "lidos" && r.status !== "read") return false;
      if (filtro === "responderam" && !r.reply_at) return false;
      if (filtro === "sem_resposta" && (r.reply_at || !["delivered", "read"].includes(r.status))) return false;
      if (filtro === "falhas" && !["failed", "error"].includes(r.status)) return false;
      if (filtro === "pulados" && r.status !== "skipped") return false;
      if (q && !`${r.lead_name || ""} ${r.phone || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filtro, busca]);

  const filtros: { key: Filtro; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: stats.total },
    { key: "entregues", label: "Entregues", count: stats.delivered },
    { key: "lidos", label: "Lidos", count: stats.read },
    { key: "responderam", label: "Responderam", count: stats.responded },
    { key: "sem_resposta", label: "Entregues sem resposta", count: Math.max(stats.delivered - rows.filter((r) => r.reply_at && ["delivered", "read"].includes(r.status)).length, 0) },
    { key: "falhas", label: "Falhas", count: stats.failed + stats.errors },
    { key: "pulados", label: "Pulados", count: stats.skipped },
  ];

  if (loading) {
    return <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando disparo…</div>;
  }
  if (!campaign) {
    return (
      <div className="p-6 space-y-3">
        <Link to="/crm/disparos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Disparos</Link>
        <p className="text-sm text-muted-foreground">Disparo não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl">
      <div className="space-y-1">
        <Link to="/crm/disparos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Todos os disparos</Link>
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h1 className="text-xl font-bold">{tplLabel(campaign.template_name)}</h1>
          {campaign.status === "sending" ? <Badge variant="secondary">Enviando</Badge>
            : campaign.status === "paused" ? <Badge variant="outline" className="border-amber-500 text-amber-700">Pausado</Badge>
            : campaign.status === "canceled" ? <Badge variant="outline">Cancelado</Badge>
            : <Badge variant="outline">Concluído</Badge>}
          {campaign.status === "paused" && pausadoPorPagamento(campaign.notes) && (
            <Button asChild size="sm" className="ml-auto bg-[#0866FF] hover:bg-[#0654d4] text-white">
              <a href={linkPagamentoMeta(instances.find((x) => x.id === campaign.official_instance_id))} target="_blank" rel="noreferrer">Pagar na Meta</a>
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button size="sm" variant={pausadoPorPagamento(campaign.notes) ? "outline" : "default"} className={pausadoPorPagamento(campaign.notes) ? "" : "ml-auto"} onClick={async () => { await retomarDisparo(campaign.id); load(true); }}>Retomar</Button>
          )}
          {(campaign.status === "sending" || campaign.status === "paused") && (
            <Button size="sm" variant="outline" className={`${campaign.status === "paused" ? "" : "ml-auto "}text-red-600`} onClick={async () => {
              if (!window.confirm("Cancelar o disparo? Quem ainda não recebeu fica de fora.")) return;
              await cancelarDisparo(campaign.id); load(true);
            }}>Cancelar envio</Button>
          )}
          <Button variant="outline" size="sm" className={`${campaign.status === "sending" || campaign.status === "paused" ? "" : "ml-auto "}gap-1.5`} onClick={() => load()}>
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadCsv(`disparo-${campaign.template_name}-${campaign.created_at.slice(0, 10)}.csv`, [
            ["Lead", "Telefone", "Status", "Erro", "Enviado em", "Respondeu em", "Resposta", "Etapa atual", "Funil"],
            ...rows.map((r) => [r.lead_name, r.phone, STATUS_LABEL[r.status] || r.status, r.error_text, dt(r.sent_at), dt(r.reply_at), r.reply_text, r.stage_name, r.pipeline_name]),
          ])}>
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
          {stats.failed + stats.errors > 0 && campaign.status !== "sending" && (
            <Button size="sm" className="gap-1.5" onClick={() => setReenviarOpen(true)}>
              <RotateCcw className="h-3.5 w-3.5" /> Reenviar falhas
            </Button>
          )}
        </div>
        <ReenviarFalhasDialog campaign={campaign} rows={rows} open={reenviarOpen} onOpenChange={setReenviarOpen} />
        <p className="text-xs text-muted-foreground">
          {dt(campaign.created_at)} · por {campaign.created_by_name || "—"} · {(campaign.template_category || "").toLowerCase()}
          {campaign.notes ? ` · ${campaign.notes}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <Stat label="Destinatários" value={stats.total} sub={stats.pending ? `${stats.pending} na fila` : undefined} />
        <Stat label="Enviados" value={stats.accepted} />
        <Stat label="Entregues" value={stats.delivered} sub={pct(stats.delivered, stats.accepted)} />
        <Stat label="Lidos" value={stats.read} sub={pct(stats.read, stats.delivered)} />
        <Stat label="Responderam" value={stats.responded} sub={`${pct(stats.responded, stats.delivered)}${stats.optOut ? ` · ${stats.optOut} pediram pra parar` : ""}`} tone="text-emerald-600" />
        <Stat label="Falhas" value={stats.failed + stats.errors} sub={`${stats.failed} não entregues · ${stats.errors} no envio`} tone="text-red-600" />
        <Stat label="Pulados" value={stats.skipped} />
        <Stat label="Custo estimado" value={brl(cost)} sub={`${stats.billable} cobráveis`} />
      </div>

      {stats.reverted > 0 && (
        <p className="text-xs text-muted-foreground">{stats.reverted} lead(s) voltaram pra etapa anterior porque a Meta não entregou.</p>
      )}

      {campaign.body_preview && (
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Mensagem enviada</summary>
          <p className="mt-2 whitespace-pre-wrap">{campaign.body_preview}</p>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {filtros.map((f) => (
            <Button key={f.key} size="sm" variant={filtro === f.key ? "default" : "outline"} className="h-8 gap-1.5 text-xs" onClick={() => setFiltro(f.key)}>
              {f.label} <span className="tabular-nums opacity-70">{f.count}</span>
            </Button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-8 pl-8 text-sm" placeholder="Buscar lead ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Lead</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="text-left font-medium px-3 py-2">Resposta</th>
              <th className="text-left font-medium px-3 py-2">Etapa atual</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-3 py-2">
                  {r.lead_id ? <Link to={`/crm/leads/${r.lead_id}`} className="font-medium hover:underline">{r.lead_name || "Lead"}</Link> : <span className="font-medium">{r.lead_name || "—"}</span>}
                  <div className="text-[11px] text-muted-foreground tabular-nums">{r.phone || "sem telefone"}</div>
                </td>
                <td className="px-3 py-2 max-w-[320px]">
                  <StatusBadge status={r.status} />
                  {r.sent_at && <div className="text-[11px] text-muted-foreground mt-0.5">{dt(r.sent_at)}</div>}
                  {r.error_text && (
                    <div className="mt-1 text-xs text-red-700 dark:text-red-400">{ERROR_HELP[errorCode(r.error_text)] || r.error_text}</div>
                  )}
                  {r.stage_reverted && <div className="text-[11px] text-muted-foreground">voltou pra etapa anterior</div>}
                </td>
                <td className="px-3 py-2 max-w-[360px]">
                  {r.reply_at ? (
                    <>
                      <div className="text-sm line-clamp-2">{r.reply_text || "(mídia)"}</div>
                      <div className="text-[11px] text-muted-foreground">{dt(r.reply_at)}{r.replies > 1 ? ` · ${r.replies} mensagens` : ""}</div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="text-sm">{r.stage_name || "—"}</div>
                  {r.pipeline_name && <div className="text-[11px] text-muted-foreground">{r.pipeline_name}</div>}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhum lead nesse filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
