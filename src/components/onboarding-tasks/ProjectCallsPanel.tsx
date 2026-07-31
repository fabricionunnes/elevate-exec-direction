import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Phone, Loader2, RefreshCw, Sparkles, ClipboardList, Clock, Users, PhoneCall, Mic } from "lucide-react";
import { CallDockProvider, useCallDock } from "@/components/crm/call/CallDockProvider";
import { dialerAudioSrc } from "@/lib/dialer/audio";
import { cn } from "@/lib/utils";

// Ligações do PROJETO: o consultor liga pro cliente daqui de dentro (mesmo
// motor Twilio do CRM Comercial), com gravação, transcrição, resumo de IA,
// geração de tarefa a partir da ligação e dashboard de quem ligou.

interface ProjectCall {
  id: string;
  agent_staff_id: string | null;
  agent?: { name: string } | null;
  to_number: string | null;
  status: string;
  answered_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcription: string | null;
  ai_summary: string | null;
  created_at: string;
}

const mmss = (s?: number | null) => {
  const v = Number(s) || 0;
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila", ringing: "Chamando", "in-progress": "Em ligação",
  completed: "Concluída", "no-answer": "Não atendeu", busy: "Ocupado",
  failed: "Falhou", canceled: "Cancelada", voicemail: "Caixa postal",
};

function DialCard({ projectId, defaultPhone, contactName }: { projectId: string; defaultPhone: string; contactName: string }) {
  const { startCall, busy } = useCallDock();
  const [phone, setPhone] = useState(defaultPhone);
  useEffect(() => { setPhone(defaultPhone); }, [defaultPhone]);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-primary" /> Ligar pro cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Telefone</Label>
          <Input className="mt-1 w-52" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="31999998888" />
        </div>
        <Button
          className="gap-2"
          disabled={busy || !phone.trim()}
          onClick={() => startCall({ id: projectId, name: contactName, phone: phone.trim(), projectId })}
        >
          <Phone className="h-4 w-4" /> Ligar agora
        </Button>
        <p className="text-[11px] text-muted-foreground basis-full">
          A ligação sai pelo navegador (mesmo motor do CRM). Gravação e transcrição entram sozinhas na lista abaixo e alimentam as IAs do projeto.
        </p>
      </CardContent>
    </Card>
  );
}

export const ProjectCallsPanel = ({ projectId, companyId }: { projectId: string; companyId: string | null }) => {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [calls, setCalls] = useState<ProjectCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<{ name: string; phone: string }>({ name: "Cliente", phone: "" });
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("crm_calls")
      .select("id, agent_staff_id, agent:onboarding_staff!crm_calls_agent_staff_id_fkey(name), to_number, status, answered_at, duration_seconds, recording_url, transcription, ai_summary, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(200);
    setCalls((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: st } = await supabase.from("onboarding_staff")
          .select("id").eq("user_id", userData.user.id).eq("is_active", true).maybeSingle();
        setStaffId(st?.id || null);
      }
      if (companyId) {
        const { data: co } = await supabase.from("onboarding_companies")
          .select("name, owner_name, phone, owner_phone").eq("id", companyId).maybeSingle();
        if (co) setContact({ name: co.owner_name || co.name || "Cliente", phone: co.owner_phone || co.phone || "" });
      }
      load();
    })();
  }, [projectId, companyId]);

  // atualiza a lista enquanto tem ligação rolando/processando
  useEffect(() => {
    const t = setInterval(() => {
      if (calls.some(c => ["queued", "ringing", "in-progress"].includes(c.status) || (c.recording_url && !c.transcription))) load();
    }, 8000);
    return () => clearInterval(t);
  }, [calls]);

  const stats = useMemo(() => {
    const now = new Date();
    const mKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const month = calls.filter(c => c.created_at.startsWith(mKey));
    const answered = month.filter(c => c.answered_at);
    const totalSec = month.reduce((s, c) => s + (Number(c.duration_seconds) || 0), 0);
    const byAgent = new Map<string, { n: number; sec: number }>();
    month.forEach(c => {
      const n = c.agent?.name || "—";
      const e = byAgent.get(n) || { n: 0, sec: 0 };
      e.n += 1; e.sec += Number(c.duration_seconds) || 0;
      byAgent.set(n, e);
    });
    return {
      total: month.length,
      answered: answered.length,
      minutes: Math.round(totalSec / 60),
      byAgent: [...byAgent.entries()].sort((a, b) => b[1].n - a[1].n),
    };
  }, [calls]);

  const summarize = async (call: ProjectCall) => {
    setWorkingId(call.id);
    try {
      const { data, error } = await supabase.functions.invoke("dialer-qualify", { body: { callId: call.id } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Transcrição e resumo prontos");
      await load();
    } catch (e: any) { toast.error(e.message || "Erro ao transcrever"); }
    finally { setWorkingId(null); }
  };

  const createTask = async (call: ProjectCall) => {
    setWorkingId(call.id);
    try {
      const when = new Date(call.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const { error } = await supabase.from("onboarding_tasks").insert({
        project_id: projectId,
        title: `Ligação ${when} — próximos passos`,
        description: `[Gerada da ligação de ${when} — ${call.agent?.name || "consultor"}]\n\n${call.ai_summary || ""}\n\nTrecho da transcrição:\n${(call.transcription || "").slice(0, 1200)}`,
        status: "pending",
        sort_order: 999,
        is_internal: false,
      });
      if (error) throw error;
      toast.success("Tarefa criada na Jornada do projeto");
    } catch (e: any) { toast.error(e.message || "Erro ao criar tarefa"); }
    finally { setWorkingId(null); }
  };

  if (loading) {
    return <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <CallDockProvider staffId={staffId}>
      <div className="space-y-4">
        <DialCard projectId={projectId} defaultPhone={contact.phone} contactName={contact.name} />

        {/* Dashboard do mês */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Ligações no mês</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><PhoneCall className="h-3.5 w-3.5" /> Atendidas</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{stats.answered}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Minutos falados</p>
            <p className="text-2xl font-bold mt-1">{stats.minutes}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Quem ligou</p>
            <div className="mt-1 space-y-0.5">
              {stats.byAgent.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              {stats.byAgent.slice(0, 3).map(([nome, v]) => (
                <p key={nome} className="text-xs"><span className="font-semibold">{nome.split(" ")[0]}</span> · {v.n} lig · {Math.round(v.sec / 60)} min</p>
              ))}
            </div>
          </CardContent></Card>
        </div>

        {/* Lista de ligações */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              Histórico de Ligações
              <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {calls.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhuma ligação ainda — faça a primeira ali em cima.</p>}
            {calls.map(c => (
              <div key={c.id} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-medium">{c.agent?.name || "Consultor"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[c.status] || c.status}</Badge>
                  {(c.duration_seconds || 0) > 0 && <span className="text-xs text-muted-foreground">{mmss(c.duration_seconds)}</span>}
                  <span className="text-xs text-muted-foreground ml-auto">{c.to_number}</span>
                </div>
                {c.recording_url && (
                  <audio controls preload="none" className="w-full h-9" src={dialerAudioSrc(c.id)} />
                )}
                {c.ai_summary && (
                  <div className="rounded-lg bg-muted/50 p-2.5 text-xs whitespace-pre-line">
                    <span className="font-semibold flex items-center gap-1 mb-1"><Sparkles className="h-3 w-3 text-primary" /> Resumo da IA</span>
                    {c.ai_summary}
                  </div>
                )}
                {c.transcription && (
                  <div>
                    <button className="text-xs text-primary flex items-center gap-1" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                      <Mic className="h-3 w-3" /> {openId === c.id ? "Esconder transcrição" : "Ver transcrição"}
                    </button>
                    {openId === c.id && (
                      <p className="mt-1.5 rounded-lg border border-border p-2.5 text-xs whitespace-pre-line max-h-64 overflow-y-auto">{c.transcription}</p>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {c.recording_url && !c.transcription && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={workingId === c.id} onClick={() => summarize(c)}>
                      {workingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Transcrever + resumir
                    </Button>
                  )}
                  {(c.transcription || c.ai_summary) && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={workingId === c.id} onClick={() => createTask(c)}>
                      <ClipboardList className="h-3 w-3" /> Gerar tarefa
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </CallDockProvider>
  );
};
