import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, PhoneCall, Voicemail, Clock, Timer, Loader2, Wallet, AlertTriangle, CalendarCheck, Target, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

type Range = "today" | "7d" | "30d";

interface CallRow { agent_staff_id: string | null; campaign_id: string | null; status: string; answered_at: string | null; duration_seconds: number | null; created_at: string }
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
const dispoLabel = (k: string) => DISPOS.find((d) => d.key === k)?.label || k;
const dispoColor = (k: string) => DISPOS.find((d) => d.key === k)?.color || "#94a3b8";

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
}
function rangeStart(r: Range): string {
  const now = new Date();
  if (r === "today") { now.setHours(0, 0, 0, 0); return now.toISOString(); }
  return new Date(Date.now() - (r === "7d" ? 7 : 30) * 86400000).toISOString();
}
// Soma intervalos de sessão sem dupla contagem (fim = ended_at ?? last_seen_at ?? started_at)
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
    supabase.functions.invoke("dialer-balance").then(({ data }) => {
      if (data && typeof data.balance === "number") setBalance(data);
    });
  }, []);

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
        supabase.from("crm_calls").select("agent_staff_id, campaign_id, status, answered_at, duration_seconds, created_at").gte("created_at", since),
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
    // Totais
    let answered = 0, voicemail = 0, talk = 0;
    const byHourCalls = Array(24).fill(0);
    const byHourAnswered = Array(24).fill(0);
    for (const c of calls) {
      const h = new Date(c.created_at).getHours();
      byHourCalls[h]++;
      if (c.answered_at) { answered++; talk += c.duration_seconds || 0; byHourAnswered[h]++; }
      else if (c.status === "voicemail") voicemail++;
    }

    // Dispositions (da fila) — geral e por campanha
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

    // Tempo no discador por agente (merge de intervalos)
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

    // Por colaborador
    const agentIds = new Set<string>([...calls.map((c) => c.agent_staff_id || "—"), ...Object.keys(dialerByAgent)]);
    const perAgent = Array.from(agentIds).map((id) => {
      const cs = calls.filter((c) => (c.agent_staff_id || "—") === id);
      const ans = cs.filter((c) => c.answered_at).length;
      const talkS = cs.filter((c) => c.answered_at).reduce((s, c) => s + (c.duration_seconds || 0), 0);
      return {
        id, name: staff[id] || "—", calls: cs.length, answered: ans,
        voicemail: cs.filter((c) => c.status === "voicemail").length,
        talkSeconds: talkS, dialerSeconds: dialerByAgent[id] || 0,
      };
    }).filter((a) => a.calls > 0 || a.dialerSeconds > 0).sort((a, b) => b.calls - a.calls);

    // Por campanha (tabela detalhada)
    const campaigns = Object.entries(perCampaign).map(([cid, dc]) => ({
      id: cid, name: campaignNames[cid] || (cid === "—" ? "Sem campanha" : "—"),
      total: Object.values(dc).reduce((a, b) => a + b, 0), dispo: dc,
    })).sort((a, b) => b.total - a.total);

    const hourData = byHourCalls.map((cnt, h) => ({
      hora: `${h}h`, ligacoes: cnt, atendidas: byHourAnswered[h],
      taxa: cnt ? Math.round((byHourAnswered[h] / cnt) * 100) : 0,
    })).filter((d) => d.ligacoes > 0);

    const dispoData = DISPOS.map((d) => ({ name: d.label, value: dispoCount[d.key] || 0, color: d.color })).filter((d) => d.value > 0);

    return {
      total: calls.length, answered, voicemail, talk, dialerTotal,
      qualificados, agendamentos,
      answerRate: calls.length ? Math.round((answered / calls.length) * 100) : 0,
      convRate: answered ? Math.round((qualificados / answered) * 100) : 0,
      perAgent, campaigns, hourData, dispoData,
    };
  }, [calls, sessions, queue, staff, campaignNames]);

  const bestHour = useMemo(() => {
    const withCalls = m.hourData.filter((h) => h.ligacoes >= 2);
    if (!withCalls.length) return null;
    return withCalls.reduce((best, h) => (h.taxa > best.taxa ? h : best));
  }, [m.hourData]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(["today", "7d", "30d"] as Range[]).map((r) => (
          <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
            {r === "today" ? "Hoje" : r === "7d" ? "7 dias" : "30 dias"}
          </Button>
        ))}
        {balance && (
          <div className={`ml-auto flex items-center gap-1.5 text-sm rounded-md border px-2.5 py-1 ${balance.critical ? "border-red-500/40 bg-red-500/10 text-red-500" : balance.low ? "border-amber-500/40 bg-amber-500/10 text-amber-600" : "border-border text-muted-foreground"}`}>
            {balance.low || balance.critical ? <AlertTriangle className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
            Saldo Twilio: {balance.currency} {balance.balance.toFixed(2)}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando métricas…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            <Kpi icon={Phone} label="Ligações" value={m.total} />
            <Kpi icon={PhoneCall} label="Atendidas" value={m.answered} sub={`${m.answerRate}% atend.`} />
            <Kpi icon={Voicemail} label="Caixa postal" value={m.voicemail} />
            <Kpi icon={Clock} label="Min. falados" value={Math.round(m.talk / 60)} sub="sem caixa postal" />
            <Kpi icon={Target} label="Qualificados" value={m.qualificados} sub={`${m.convRate}% das atend.`} />
            <Kpi icon={CalendarCheck} label="Agendamentos" value={m.agendamentos} />
            <Kpi icon={Timer} label="Tempo no discador" value={fmtDuration(m.dialerTotal)} />
          </div>

          {bestHour && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-md border border-border bg-muted/30 px-3 py-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Melhor horário pra falar com lead: <span className="font-semibold text-foreground">{bestHour.hora}</span> ({bestHour.taxa}% de atendimento)
            </div>
          )}

          {/* Gráficos: horários */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Ligações por horário</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={m.hourData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="hora" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="ligacoes" name="Ligações" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="atendidas" name="Atendidas" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Taxa de atendimento por horário (%)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={m.hourData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="hora" fontSize={11} />
                    <YAxis fontSize={11} domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="taxa" name="% atendimento" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Dispositions + Gasto */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Resultado das ligações</CardTitle></CardHeader>
              <CardContent>
                {m.dispoData.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={m.dispoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.name}: ${e.value}`}>
                        {m.dispoData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
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
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="dia" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip formatter={(v: any) => `${usage.currency} ${v}`} />
                        <Bar dataKey="gasto" name="Gasto" fill="#ef4444" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground py-8 text-center">Carregando gasto…</p>}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Métricas por campanha */}
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
                      <TableCell className="text-right">{c.total}</TableCell>
                      {DISPOS.map((d) => (
                        <TableCell key={d.key} className="text-right">
                          {c.dispo[d.key] ? <span style={{ color: d.color }}>{c.dispo[d.key]}</span> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {m.campaigns.length === 0 && <TableRow><TableCell colSpan={2 + DISPOS.length} className="text-center py-8 text-muted-foreground">Sem resultados no período</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Por colaborador */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Por colaborador</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead className="text-right">Ligações</TableHead>
                    <TableHead className="text-right">Atendidas</TableHead>
                    <TableHead className="text-right">Caixa postal</TableHead>
                    <TableHead className="text-right">Min. falados</TableHead>
                    <TableHead className="text-right">Tempo no discador</TableHead>
                    <TableHead className="text-right">Atendimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.perAgent.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-right">{a.calls}</TableCell>
                      <TableCell className="text-right">{a.answered}</TableCell>
                      <TableCell className="text-right">{a.voicemail}</TableCell>
                      <TableCell className="text-right">{Math.round(a.talkSeconds / 60)}</TableCell>
                      <TableCell className="text-right">{fmtDuration(a.dialerSeconds)}</TableCell>
                      <TableCell className="text-right">{a.calls ? `${Math.round((a.answered / a.calls) * 100)}%` : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {m.perAgent.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sem ligações no período</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number | string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
