import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Phone, PhoneCall, Voicemail, Clock, Timer, Loader2, Wallet, AlertTriangle, CalendarCheck,
  Target, TrendingUp, Gauge, MessageSquareText, DollarSign, Filter, Trophy, Activity,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";

type Range = "today" | "7d" | "30d";

interface CallRow { agent_staff_id: string | null; campaign_id: string | null; status: string; answered_at: string | null; answered_by: string | null; duration_seconds: number | null; created_at: string }
const isHuman = (c: CallRow) => c.answered_by === "human";
interface SessionRow { agent_staff_id: string | null; started_at: string; ended_at: string | null; last_seen_at: string | null }
interface QueueRow { campaign_id: string | null; disposition: string | null }

const DISPOS = [
  { key: "qualificado", label: "Qualificado", color: "#10b981" },
  { key: "agendou_reuniao", label: "Agendou", color: "#3b82f6" },
  { key: "retornar_depois", label: "Retornar", color: "#6366f1" },
  { key: "sem_interesse", label: "Sem interesse", color: "#f59e0b" },
  { key: "nao_qualificado", label: "Não qualificado", color: "#9ca3af" },
  { key: "nao_atendeu", label: "Não atendeu", color: "#64748b" },
  { key: "voicemail", label: "Caixa postal", color: "#a855f7" },
  { key: "atendida", label: "Atendida (s/ tag)", color: "#14b8a6" },
];

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 8px 30px -10px rgba(0,0,0,.5)",
  color: "hsl(var(--popover-foreground))",
};

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
}
function fmtMMSS(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function rangeStart(r: Range): string {
  const now = new Date();
  if (r === "today") { now.setHours(0, 0, 0, 0); return now.toISOString(); }
  return new Date(Date.now() - (r === "7d" ? 7 : 30) * 86400000).toISOString();
}
function mergedSeconds(items: { start: number; end: number }[]): number {
  const iv = items.map((s) => ({ start: s.start, end: Math.max(s.start, s.end) })).filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
  let total = 0, cs: number | null = null, ce: number | null = null;
  for (const s of iv) {
    if (ce === null) { cs = s.start; ce = s.end; }
    else if (s.start <= ce) { ce = Math.max(ce, s.end); }
    else { total += ce - (cs as number); cs = s.start; ce = s.end; }
  }
  if (ce !== null) total += ce - (cs as number);
  return total / 1000;
}

export function DialerDashboard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [range, setRange] = useState<Range>("7d");
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [campaignNames, setCampaignNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<{ balance: number; currency: string; low: boolean; critical: boolean } | null>(null);
  const [usage, setUsage] = useState<{ currency: string; total: number; records: { date: string; spend: number }[] } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.functions.invoke("dialer-balance").then(({ data }) => {
      if (data && typeof data.balance === "number") setBalance(data);
    });
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
    supabase.functions.invoke("dialer-usage", { body: { days: Math.max(days, 7) } }).then(({ data }) => {
      if (data?.records) setUsage(data);
    });
  }, [range, isAdmin]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const since = rangeStart(range);
      const [callsRes, sessRes, queueRes, staffRes, campRes] = await Promise.all([
        supabase.from("crm_calls").select("agent_staff_id, campaign_id, status, answered_at, answered_by, duration_seconds, created_at").gte("created_at", since),
        supabase.from("crm_dialer_sessions").select("agent_staff_id, started_at, ended_at, last_seen_at").gte("started_at", since),
        supabase.from("crm_dialer_queue").select("campaign_id, disposition").not("disposition", "is", null).gte("updated_at", since),
        supabase.from("onboarding_staff").select("id, name"),
        supabase.from("crm_dialer_campaigns").select("id, name"),
      ]);
      if (!active) return;
      setCalls((callsRes.data || []) as any);
      setSessions((sessRes.data || []) as any);
      setQueue((queueRes.data || []) as any);
      const sm: Record<string, string> = {}; (staffRes.data || []).forEach((s: any) => { sm[s.id] = s.name; });
      const cm: Record<string, string> = {}; (campRes.data || []).forEach((c: any) => { cm[c.id] = c.name; });
      setStaff(sm); setCampaignNames(cm);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [range]);

  const m = useMemo(() => {
    let answered = 0, voicemail = 0, talk = 0;
    const byHourCalls = Array(24).fill(0);
    const byHourAnswered = Array(24).fill(0);
    for (const c of calls) {
      const h = new Date(c.created_at).getHours();
      byHourCalls[h]++;
      if (isHuman(c)) { answered++; talk += c.duration_seconds || 0; byHourAnswered[h]++; }
      else if (c.status === "voicemail") voicemail++;
    }

    const dispoCount: Record<string, number> = {};
    const perCampaign: Record<string, Record<string, number>> = {};
    for (const q of queue) {
      const k = q.disposition || "outros";
      dispoCount[k] = (dispoCount[k] || 0) + 1;
      const cid = q.campaign_id || "—";
      (perCampaign[cid] ||= {})[k] = ((perCampaign[cid] ||= {})[k] || 0) + 1;
    }
    const qualificados = dispoCount["qualificado"] || 0;
    const agendamentos = dispoCount["agendou_reuniao"] || 0;

    const sessByAgent: Record<string, { start: number; end: number }[]> = {};
    for (const s of sessions) {
      const id = s.agent_staff_id || "—";
      const start = new Date(s.started_at).getTime();
      const end = new Date(s.ended_at || s.last_seen_at || s.started_at).getTime();
      (sessByAgent[id] ||= []).push({ start, end });
    }
    const dialerByAgent: Record<string, number> = {};
    let dialerTotal = 0;
    for (const [id, iv] of Object.entries(sessByAgent)) { const sec = mergedSeconds(iv); dialerByAgent[id] = sec; dialerTotal += sec; }

    const agentIds = new Set<string>([...calls.map((c) => c.agent_staff_id || "—"), ...Object.keys(dialerByAgent)]);
    const perAgent = Array.from(agentIds).map((id) => {
      const cs = calls.filter((c) => (c.agent_staff_id || "—") === id);
      const ans = cs.filter(isHuman).length;
      const talkS = cs.filter(isHuman).reduce((s, c) => s + (c.duration_seconds || 0), 0);
      return {
        id, name: staff[id] || "—", calls: cs.length, answered: ans,
        voicemail: cs.filter((c) => c.status === "voicemail").length,
        talkSeconds: talkS, dialerSeconds: dialerByAgent[id] || 0,
      };
    }).filter((a) => a.calls > 0 || a.dialerSeconds > 0).sort((a, b) => b.answered - a.answered || b.calls - a.calls);

    const campaigns = Object.entries(perCampaign).map(([cid, dc]) => ({
      id: cid, name: campaignNames[cid] || (cid === "—" ? "Sem campanha" : "—"),
      total: Object.values(dc).reduce((a, b) => a + b, 0), dispo: dc,
    })).sort((a, b) => b.total - a.total);

    const hourData = byHourCalls.map((cnt, h) => ({
      hora: `${h}h`, ligacoes: cnt, atendidas: byHourAnswered[h],
      taxa: cnt ? Math.round((byHourAnswered[h] / cnt) * 100) : 0,
    })).filter((d) => d.ligacoes > 0);

    const dispoData = DISPOS.map((d) => ({ name: d.label, value: dispoCount[d.key] || 0, color: d.color })).filter((d) => d.value > 0);

    const total = calls.length;
    const dialerHours = dialerTotal / 3600;
    return {
      total, answered, voicemail, talk, dialerTotal,
      qualificados, agendamentos,
      answerRate: total ? Math.round((answered / total) * 100) : 0,
      vmRate: total ? Math.round((voicemail / total) * 100) : 0,
      convRate: answered ? Math.round((qualificados / answered) * 100) : 0,
      schedRate: qualificados ? Math.round((agendamentos / qualificados) * 100) : 0,
      avgTalk: answered ? talk / answered : 0,
      callsPerHour: dialerHours > 0.02 ? total / dialerHours : 0,
      perAgent, campaigns, hourData, dispoData,
    };
  }, [calls, sessions, queue, staff, campaignNames]);

  const bestHour = useMemo(() => {
    const withCalls = m.hourData.filter((h) => h.ligacoes >= 2);
    if (!withCalls.length) return null;
    return withCalls.reduce((best, h) => (h.taxa > best.taxa ? h : best));
  }, [m.hourData]);

  const cur = usage?.currency || "USD";
  const costPerCall = usage && m.total ? usage.total / m.total : 0;
  const costPerAnswered = usage && m.answered ? usage.total / m.answered : 0;
  const costPerQualified = usage && m.qualificados ? usage.total / m.qualificados : 0;
  const maxAgentCalls = Math.max(1, ...m.perAgent.map((a) => a.calls));

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
          {(["today", "7d", "30d"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${range === r ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              {r === "today" ? "Hoje" : r === "7d" ? "7 dias" : "30 dias"}
            </button>
          ))}
        </div>
        {isAdmin && balance && (
          <div className={`ml-auto flex items-center gap-1.5 text-sm rounded-lg border px-3 py-1.5 ${balance.critical ? "border-red-500/40 bg-red-500/10 text-red-500" : balance.low ? "border-amber-500/40 bg-amber-500/10 text-amber-600" : "border-border text-muted-foreground"}`}>
            {balance.low || balance.critical ? <AlertTriangle className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
            Saldo Twilio: <span className="font-semibold">{balance.currency} {balance.balance.toFixed(2)}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando métricas…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={Phone} label="Ligações" value={m.total} accent="#3b82f6" sub="no período" />
            <Kpi icon={PhoneCall} label="Atendidas" value={m.answered} accent="#10b981" sub={`${m.answerRate}% de atendimento`} pct={m.answerRate} />
            <Kpi icon={MessageSquareText} label="Tempo médio de conversa" value={fmtMMSS(m.avgTalk)} accent="#14b8a6" sub={`${Math.round(m.talk / 60)} min falados`} />
            <Kpi icon={Voicemail} label="Caixa postal" value={m.voicemail} accent="#a855f7" sub={`${m.vmRate}% das ligações`} />
            <Kpi icon={Target} label="Qualificados" value={m.qualificados} accent="#6366f1" sub={`${m.convRate}% das atendidas`} pct={m.convRate} />
            <Kpi icon={CalendarCheck} label="Agendamentos" value={m.agendamentos} accent="#f59e0b" sub={`${m.schedRate}% dos qualificados`} pct={m.schedRate} />
            <Kpi icon={Gauge} label="Ligações por hora" value={m.callsPerHour ? m.callsPerHour.toFixed(1) : "—"} accent="#ec4899" sub="ritmo no discador" />
            <Kpi icon={Timer} label="Tempo no discador" value={fmtDuration(m.dialerTotal)} accent="#f43f5e" sub="equipe somada" />
          </div>

          {/* Funil + insight de horário */}
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 overflow-hidden">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /> Funil de conversão</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                <FunnelStep label="Ligações" value={m.total} base={m.total} prev={null} color="#3b82f6" />
                <FunnelStep label="Atendidas" value={m.answered} base={m.total} prev={m.total} color="#10b981" />
                <FunnelStep label="Qualificados" value={m.qualificados} base={m.total} prev={m.answered} color="#6366f1" />
                <FunnelStep label="Agendamentos" value={m.agendamentos} base={m.total} prev={m.qualificados} color="#f59e0b" />
              </CardContent>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-500" /> Destaques</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                {bestHour ? (
                  <Insight icon={TrendingUp} color="#10b981" title={`Melhor horário: ${bestHour.hora}`} desc={`${bestHour.taxa}% de atendimento`} />
                ) : <Insight icon={TrendingUp} color="#64748b" title="Sem horário destaque" desc="poucos dados ainda" />}
                <Insight icon={Target} color="#6366f1" title={`${m.convRate}% viram qualificado`} desc="das ligações atendidas" />
                {m.perAgent[0] && <Insight icon={Trophy} color="#f59e0b" title={m.perAgent[0].name} desc={`top em atendimento (${m.perAgent[0].answered})`} />}
                {isAdmin && usage && m.qualificados > 0 && (
                  <Insight icon={DollarSign} color="#ef4444" title={`${cur} ${costPerQualified.toFixed(2)} / qualificado`} desc="custo Twilio por lead qualificado" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Custo (admin) */}
          {isAdmin && usage && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi icon={DollarSign} label="Gasto Twilio" value={`${cur} ${usage.total.toFixed(2)}`} accent="#ef4444" sub="no período (conta UNV)" />
              <Kpi icon={DollarSign} label="Custo por ligação" value={`${cur} ${costPerCall.toFixed(3)}`} accent="#fb7185" sub="média geral" />
              <Kpi icon={DollarSign} label="Custo por atendimento" value={`${cur} ${costPerAnswered.toFixed(3)}`} accent="#f97316" sub="só quem atendeu" />
              <Kpi icon={DollarSign} label="Custo por qualificado" value={m.qualificados ? `${cur} ${costPerQualified.toFixed(2)}` : "—"} accent="#f59e0b" sub="CAC do discador" />
            </div>
          )}

          {/* Gráficos: horários */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Ligações por horário</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={m.hourData} barGap={2}>
                    <defs>
                      <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#1d4ed8" />
                      </linearGradient>
                      <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                    <XAxis dataKey="hora" fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} allowDecimals={false} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                    <Bar dataKey="ligacoes" name="Ligações" fill="url(#gradBlue)" radius={[5, 5, 0, 0]} maxBarSize={34} />
                    <Bar dataKey="atendidas" name="Atendidas" fill="url(#gradGreen)" radius={[5, 5, 0, 0]} maxBarSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Taxa de atendimento por horário (%)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={m.hourData}>
                    <defs>
                      <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                    <XAxis dataKey="hora" fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} domain={[0, 100]} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}%`, "Atendimento"]} />
                    <Area type="monotone" dataKey="taxa" name="% atendimento" stroke="#f59e0b" strokeWidth={2.5} fill="url(#gradAmber)" dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Dispositions (donut) + Gasto */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Resultado das ligações</CardTitle></CardHeader>
              <CardContent>
                {m.dispoData.length ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative" style={{ width: 220, height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={m.dispoData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={95} paddingAngle={2} stroke="hsl(var(--background))" strokeWidth={2}>
                            {m.dispoData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-bold">{m.dispoData.reduce((a, b) => a + b.value, 0)}</span>
                        <span className="text-xs text-muted-foreground">resultados</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 flex-1 w-full">
                      {m.dispoData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2 text-sm">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                          <span className="text-muted-foreground flex-1 truncate">{d.name}</span>
                          <span className="font-semibold tabular-nums">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="text-sm text-muted-foreground py-8 text-center">Sem dispositions no período</p>}
              </CardContent>
            </Card>

            {isAdmin && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    Gasto Twilio por dia
                    {usage && <span className="text-xs font-normal text-muted-foreground">Total: {usage.currency} {usage.total.toFixed(2)}</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {usage?.records?.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={[...usage.records].reverse().map((r) => ({ dia: r.date.slice(5), gasto: Number(r.spend.toFixed(2)) }))}>
                        <defs>
                          <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f87171" /><stop offset="100%" stopColor="#dc2626" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                        <XAxis dataKey="dia" fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                        <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} formatter={(v: any) => [`${usage.currency} ${v}`, "Gasto"]} />
                        <Bar dataKey="gasto" name="Gasto" fill="url(#gradRed)" radius={[5, 5, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground py-8 text-center">Carregando gasto…</p>}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Ranking por colaborador */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Ranking por colaborador</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead className="text-right">Ligações</TableHead>
                    <TableHead className="text-right">Atendidas</TableHead>
                    <TableHead className="text-right">Caixa postal</TableHead>
                    <TableHead className="text-right">Min. falados</TableHead>
                    <TableHead className="text-right">Tempo no discador</TableHead>
                    <TableHead className="text-right">Atendimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.perAgent.map((a, i) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-muted-foreground">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="min-w-[120px]">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${(a.calls / maxAgentCalls) * 100}%` }} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{a.calls}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-500 font-medium">{a.answered}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.voicemail}</TableCell>
                      <TableCell className="text-right tabular-nums">{Math.round(a.talkSeconds / 60)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtDuration(a.dialerSeconds)}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.calls ? `${Math.round((a.answered / a.calls) * 100)}%` : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {m.perAgent.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sem ligações no período</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Resultado por campanha */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Resultado por campanha</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead className="text-right">Trabalhados</TableHead>
                    {DISPOS.map((d) => <TableHead key={d.key} className="text-right whitespace-nowrap">{d.label}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.campaigns.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{c.total}</TableCell>
                      {DISPOS.map((d) => (
                        <TableCell key={d.key} className="text-right tabular-nums">
                          {c.dispo[d.key] ? <span style={{ color: d.color }} className="font-medium">{c.dispo[d.key]}</span> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {m.campaigns.length === 0 && <TableRow><TableCell colSpan={2 + DISPOS.length} className="text-center py-8 text-muted-foreground">Sem resultados no período</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent = "#3b82f6", pct }: { icon: any; label: string; value: number | string; sub?: string; accent?: string; pct?: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4"
      style={{
        borderColor: `${accent}33`,
        background: `linear-gradient(135deg, ${accent}1f 0%, hsl(var(--card)) 55%)`,
        boxShadow: `0 6px 22px -14px ${accent}cc`,
      }}
    >
      <Icon className="absolute -right-3 -bottom-3 h-20 w-20 opacity-[0.07]" style={{ color: accent }} />
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${accent}26`, color: accent }}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs text-muted-foreground leading-tight">{label}</span>
      </div>
      <p className="text-2xl font-bold mt-2 tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      {typeof pct === "number" && (
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: accent }} />
        </div>
      )}
    </div>
  );
}

function FunnelStep({ label, value, base, prev, color }: { label: string; value: number; base: number; prev: number | null; color: string }) {
  const widthPct = base ? Math.max(4, (value / base) * 100) : 4;
  const convPct = prev != null && prev > 0 ? Math.round((value / prev) * 100) : null;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums"><span className="font-semibold text-foreground">{value}</span>{convPct != null && <span className="text-muted-foreground"> · {convPct}% da etapa anterior</span>}</span>
      </div>
      <div className="h-7 rounded-lg bg-muted/50 overflow-hidden">
        <div
          className="h-full rounded-lg flex items-center px-2 text-[11px] font-medium text-white transition-all"
          style={{ width: `${widthPct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, boxShadow: `0 2px 10px -4px ${color}` }}
        >
          {base ? `${Math.round((value / base) * 100)}%` : ""}
        </div>
      </div>
    </div>
  );
}

function Insight({ icon: Icon, color, title, desc }: { icon: any; color: string; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{ background: `${color}22`, color }}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-medium leading-tight truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
    </div>
  );
}
