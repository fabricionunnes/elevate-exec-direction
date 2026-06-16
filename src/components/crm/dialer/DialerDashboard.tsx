import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, PhoneCall, Voicemail, Clock, Timer, Loader2, Wallet, AlertTriangle } from "lucide-react";

type Range = "today" | "7d" | "30d";

interface CallRow { agent_staff_id: string | null; status: string; answered_at: string | null; duration_seconds: number | null; created_at: string }
interface SessionRow { agent_staff_id: string | null; started_at: string; ended_at: string | null }

interface AgentMetrics {
  staffId: string; name: string;
  calls: number; answered: number; voicemail: number; noAnswer: number;
  talkSeconds: number; dialerSeconds: number;
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m}min`;
}

function rangeStart(r: Range): string {
  const now = new Date();
  if (r === "today") { now.setHours(0, 0, 0, 0); return now.toISOString(); }
  const days = r === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function DialerDashboard() {
  const [range, setRange] = useState<Range>("today");
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<{ balance: number; currency: string; low: boolean; critical: boolean } | null>(null);

  useEffect(() => {
    supabase.functions.invoke("dialer-balance").then(({ data }) => {
      if (data && typeof data.balance === "number") setBalance(data);
    });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const since = rangeStart(range);
      const [callsRes, sessRes, staffRes] = await Promise.all([
        supabase.from("crm_calls").select("agent_staff_id, status, answered_at, duration_seconds, created_at").gte("created_at", since),
        supabase.from("crm_dialer_sessions").select("agent_staff_id, started_at, ended_at").gte("started_at", since),
        supabase.from("onboarding_staff").select("id, name"),
      ]);
      if (!active) return;
      setCalls((callsRes.data || []) as any);
      setSessions((sessRes.data || []) as any);
      const map: Record<string, string> = {};
      (staffRes.data || []).forEach((s: any) => { map[s.id] = s.name; });
      setStaff(map);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [range]);

  const { rows, totals } = useMemo(() => {
    const byAgent: Record<string, AgentMetrics> = {};
    const ensure = (id: string) => {
      if (!byAgent[id]) byAgent[id] = { staffId: id, name: staff[id] || "—", calls: 0, answered: 0, voicemail: 0, noAnswer: 0, talkSeconds: 0, dialerSeconds: 0 };
      return byAgent[id];
    };
    for (const c of calls) {
      const id = c.agent_staff_id || "sem_agente";
      const a = ensure(id);
      a.calls++;
      if (c.answered_at) { a.answered++; a.talkSeconds += c.duration_seconds || 0; }
      else if (c.status === "voicemail") a.voicemail++;
      else if (["no-answer", "busy", "failed", "canceled"].includes(c.status)) a.noAnswer++;
    }
    for (const s of sessions) {
      const id = s.agent_staff_id || "sem_agente";
      const a = ensure(id);
      const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
      a.dialerSeconds += Math.max(0, (end - new Date(s.started_at).getTime()) / 1000);
    }
    const list = Object.values(byAgent).sort((x, y) => y.calls - x.calls);
    const totals = list.reduce(
      (t, a) => ({ calls: t.calls + a.calls, answered: t.answered + a.answered, voicemail: t.voicemail + a.voicemail, talkSeconds: t.talkSeconds + a.talkSeconds, dialerSeconds: t.dialerSeconds + a.dialerSeconds }),
      { calls: 0, answered: 0, voicemail: 0, talkSeconds: 0, dialerSeconds: 0 },
    );
    return { rows: list, totals };
  }, [calls, sessions, staff]);

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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi icon={Phone} label="Ligações" value={totals.calls} />
            <Kpi icon={PhoneCall} label="Atendidas" value={totals.answered} sub={totals.calls ? `${Math.round((totals.answered / totals.calls) * 100)}% de atendimento` : ""} />
            <Kpi icon={Voicemail} label="Caixa postal" value={totals.voicemail} />
            <Kpi icon={Clock} label="Minutos falados" value={Math.round(totals.talkSeconds / 60)} sub="sem caixa postal" />
            <Kpi icon={Timer} label="Tempo no discador" value={fmtDuration(totals.dialerSeconds)} />
          </div>

          <Card>
            <CardContent className="p-0">
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
                  {rows.map((a) => (
                    <TableRow key={a.staffId}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-right">{a.calls}</TableCell>
                      <TableCell className="text-right">{a.answered}</TableCell>
                      <TableCell className="text-right">{a.voicemail}</TableCell>
                      <TableCell className="text-right">{Math.round(a.talkSeconds / 60)}</TableCell>
                      <TableCell className="text-right">{fmtDuration(a.dialerSeconds)}</TableCell>
                      <TableCell className="text-right">{a.calls ? `${Math.round((a.answered / a.calls) * 100)}%` : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Sem ligações no período</TableCell></TableRow>
                  )}
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
