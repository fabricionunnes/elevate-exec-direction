import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, CalendarCheck, ExternalLink, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface Reuniao {
  activity_id: string;
  title: string | null;
  scheduled_at: string | null;
  created_at: string;
  status: string | null;
  meeting_link: string | null;
  lead_id: string | null;
  lead_name: string | null;
  company: string | null;
  staff_name: string | null;
  agent_id: string | null;
  agent_name: string | null;
  outcome: string;
  fora_icp: boolean;
  fechou: boolean;
}

const PERIODOS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Desde o início" },
];

const DESFECHO: Record<string, { texto: string; classe: string }> = {
  realizada: { texto: "Aconteceu", classe: "bg-green-600 text-white" },
  no_show: { texto: "No-show", classe: "bg-amber-500 text-white" },
  fora_icp: { texto: "Fora do ICP", classe: "bg-purple-600 text-white" },
  agendada: { texto: "Ainda vai acontecer", classe: "bg-blue-500 text-white" },
  cancelada: { texto: "Cancelada", classe: "bg-muted text-muted-foreground" },
  sem_registro: { texto: "Sem registro", classe: "bg-muted text-muted-foreground" },
};

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-";

export function AgentMeetingsTab() {
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("30");
  const [agente, setAgente] = useState("all");

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any).rpc("crm_agent_meetings", {
        p_days: periodo === "all" ? null : Number(periodo),
      });
      if (!ativo) return;
      setLoading(false);
      if (error) {
        toast.error(error.message || "Erro ao carregar os agendamentos");
        setReunioes([]);
        return;
      }
      setReunioes((data || []) as Reuniao[]);
    })();
    return () => { ativo = false; };
  }, [periodo]);

  const agentes = useMemo(() => {
    const contagem = new Map<string, number>();
    reunioes.forEach((r) => {
      const n = r.agent_name || "Agente de IA";
      contagem.set(n, (contagem.get(n) || 0) + 1);
    });
    return [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  }, [reunioes]);

  const lista = useMemo(
    () => (agente === "all" ? reunioes : reunioes.filter((r) => (r.agent_name || "Agente de IA") === agente)),
    [reunioes, agente]
  );

  const resumo = useMemo(() => {
    const c = (f: (r: Reuniao) => boolean) => lista.filter(f).length;
    return [
      { rotulo: "Agendamentos", valor: lista.length },
      { rotulo: "Aconteceram", valor: c((r) => r.outcome === "realizada") },
      { rotulo: "No-show", valor: c((r) => r.outcome === "no_show") },
      { rotulo: "Fora do ICP", valor: c((r) => r.fora_icp) },
      { rotulo: "Fecharam", valor: c((r) => r.fechou) },
      { rotulo: "Ainda vão acontecer", valor: c((r) => r.outcome === "agendada") },
      { rotulo: "Canceladas", valor: c((r) => r.outcome === "cancelada") },
      { rotulo: "Sem registro", valor: c((r) => r.outcome === "sem_registro") },
    ];
  }, [lista]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="w-56">
          <SearchableSelect value={periodo} onValueChange={setPeriodo} options={PERIODOS} placeholder="Período" />
        </div>
        <div className="w-72">
          <SearchableSelect
            value={agente}
            onValueChange={setAgente}
            options={[
              { value: "all", label: `Todos os agentes (${reunioes.length})` },
              ...agentes.map(([nome, qtd]) => ({ value: nome, label: `${nome} (${qtd})` })),
            ]}
            placeholder="Agente"
            emptyMessage="Nenhum agente encontrado."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {resumo.map((c) => (
          <Card key={c.rotulo}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.rotulo}</p>
              <p className="text-2xl font-bold">{c.valor}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {agentes.length > 1 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Por agente</p>
            {agentes.map(([nome, qtd]) => (
              <div key={nome} className="flex items-center justify-between text-sm">
                <span className="truncate">{nome}</span>
                <Badge variant="secondary">{qtd}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando...
        </div>
      ) : lista.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <CalendarCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhuma reunião agendada pelos agentes neste período.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {lista.map((r) => {
            const d = DESFECHO[r.outcome] || DESFECHO.sem_registro;
            return (
              <Card key={r.activity_id}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{r.lead_name || r.title || "Sem lead"}</p>
                      <Badge className={d.classe + " text-[10px]"}>{d.texto}</Badge>
                      {r.fora_icp && r.outcome !== "fora_icp" && (
                        <Badge className="bg-purple-600 text-white text-[10px]">Fora do ICP</Badge>
                      )}
                      {r.fechou && <Badge className="bg-green-700 text-white text-[10px]">Fechou</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {dataHora(r.scheduled_at)}
                      {r.company ? ` · ${r.company}` : ""}
                      {r.staff_name ? ` · com ${r.staff_name}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.agent_name || "Agente de IA"} · agendou em {dataHora(r.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {r.meeting_link && (
                      <Button asChild variant="ghost" size="sm" className="h-8 px-2" title="Link da reunião">
                        <a href={r.meeting_link} target="_blank" rel="noreferrer"><Video className="h-4 w-4" /></a>
                      </Button>
                    )}
                    {r.lead_id && (
                      <Button asChild variant="ghost" size="sm" className="h-8 px-2" title="Abrir o lead">
                        <Link to={`/crm/leads/${r.lead_id}`}><ExternalLink className="h-4 w-4" /></Link>
                      </Button>
                    )}
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
