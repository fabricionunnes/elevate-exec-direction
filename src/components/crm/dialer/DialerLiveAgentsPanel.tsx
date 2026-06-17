import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { PhoneCall, PhoneOutgoing, Radio, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveAgent {
  agentId: string;
  name: string;
  avatarUrl: string | null;
  tenantId: string | null;
  tenantName: string;
  campaignName: string | null;
  since: string;
  lastSeen: string;
  status: "em_ligacao" | "chamando" | "pronta";
  currentLead: string | null;
  callsCount: number;
  answeredCount: number;
}

const STATUS: Record<LiveAgent["status"], { label: string; dot: string; icon: any; ring: string }> = {
  em_ligacao: { label: "Em ligação", dot: "bg-emerald-500", icon: PhoneCall, ring: "ring-emerald-500/30" },
  chamando: { label: "Chamando", dot: "bg-amber-500 animate-pulse", icon: PhoneOutgoing, ring: "ring-amber-500/30" },
  pronta: { label: "Pronta", dot: "bg-sky-500", icon: Radio, ring: "ring-sky-500/20" },
};

function elapsed(fromIso: string, nowMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  if (h) return `${h}h${String(m).padStart(2, "0")}`;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

export function DialerLiveAgentsPanel() {
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUnv, setShowUnv] = useState(false);
  const [now, setNow] = useState(Date.now());
  const mounted = useRef(true);

  const load = async () => {
    const { data } = await supabase.functions.invoke("dialer-live-agents", { body: {} });
    if (!mounted.current) return;
    if (data?.agents) { setAgents(data.agents); setShowUnv(!!data.isUnvAdmin); }
    setLoading(false);
  };

  useEffect(() => {
    mounted.current = true;
    load();
    const poll = setInterval(load, 3500);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { mounted.current = false; clearInterval(poll); clearInterval(tick); };
  }, []);

  const onCall = agents.filter((a) => a.status === "em_ligacao").length;
  const dialing = agents.filter((a) => a.status === "chamando").length;

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando equipe ao vivo…</div>;
  }

  return (
    <div className="p-3 sm:p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <h2 className="text-base font-semibold">Equipe ao vivo</h2>
          <span className="text-xs text-muted-foreground">atualiza a cada 3s</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Stat icon={Users} label="online" value={agents.length} />
          <Stat icon={PhoneCall} label="em ligação" value={onCall} cls="text-emerald-600" />
          <Stat icon={PhoneOutgoing} label="chamando" value={dialing} cls="text-amber-600" />
        </div>
      </div>

      {agents.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Ninguém online no discador agora. Quando uma atendente clicar em "Ficar pronta", ela aparece aqui em tempo real.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => {
            const st = STATUS[a.status];
            return (
              <Card key={a.agentId} className={cn("ring-1", st.ring)}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium overflow-hidden">
                        {a.avatarUrl ? <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" /> : a.name.slice(0, 1).toUpperCase()}
                      </div>
                      <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background", st.dot)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      {showUnv && <p className="text-[11px] text-muted-foreground truncate">{a.tenantName}</p>}
                    </div>
                    <div className="text-right">
                      <div className={cn("flex items-center gap-1 text-xs font-medium justify-end",
                        a.status === "em_ligacao" ? "text-emerald-600" : a.status === "chamando" ? "text-amber-600" : "text-sky-600")}>
                        <st.icon className="h-3.5 w-3.5" /> {st.label}
                      </div>
                      <p className="text-[11px] text-muted-foreground tabular-nums">{elapsed(a.since, now)} online</p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground min-h-[16px]">
                    {a.currentLead ? <span>Falando com <span className="text-foreground font-medium">{a.currentLead}</span></span>
                      : a.campaignName ? <span>Campanha: {a.campaignName}</span> : <span>Aguardando próximo</span>}
                  </div>

                  <div className="flex items-center gap-4 pt-1 border-t border-border text-xs">
                    <span><span className="font-semibold text-foreground">{a.callsCount}</span> <span className="text-muted-foreground">ligações</span></span>
                    <span><span className="font-semibold text-emerald-600">{a.answeredCount}</span> <span className="text-muted-foreground">atendidas</span></span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, cls }: { icon: any; label: string; value: number; cls?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5", cls)}>
      <Icon className="h-4 w-4" /> <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </span>
  );
}
