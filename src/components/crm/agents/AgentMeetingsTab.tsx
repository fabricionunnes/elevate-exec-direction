import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, CalendarCheck, ExternalLink, Video } from "lucide-react";
import { Link } from "react-router-dom";

interface Reuniao {
  id: string;
  title: string | null;
  scheduled_at: string | null;
  created_at: string;
  status: string | null;
  description: string | null;
  meeting_link: string | null;
  lead_id: string | null;
  responsible_staff_id: string | null;
  lead?: { id: string; name: string; company: string | null; phone: string | null } | null;
}

const PERIODOS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Desde o início" },
];

// O agente grava a autoria na descrição: Agendada pelo agente IA "Nome do agente"
const nomeDoAgente = (descricao: string | null) => {
  const m = /agente IA "([^"]+)"/i.exec(descricao || "");
  return m ? m[1] : "Agente de IA";
};

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-";

const BADGE: Record<string, { texto: string; classe: string }> = {
  pending: { texto: "Agendada", classe: "bg-blue-500 text-white" },
  completed: { texto: "Realizada", classe: "bg-green-600 text-white" },
  cancelled: { texto: "Cancelada", classe: "bg-muted text-muted-foreground" },
  canceled: { texto: "Cancelada", classe: "bg-muted text-muted-foreground" },
  no_show: { texto: "No-show", classe: "bg-amber-500 text-white" },
};

export function AgentMeetingsTab() {
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("30");
  const [agente, setAgente] = useState("all");

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      let q = (supabase as any)
        .from("crm_activities")
        .select("id, title, scheduled_at, created_at, status, description, meeting_link, lead_id, responsible_staff_id, lead:crm_leads(id, name, company, phone)")
        .eq("type", "meeting")
        .ilike("description", "Agendada pelo agente%")
        .order("scheduled_at", { ascending: false })
        .limit(500);
      if (periodo !== "all") {
        q = q.gte("created_at", new Date(Date.now() - Number(periodo) * 86400000).toISOString());
      }
      const [{ data, error }, { data: st }] = await Promise.all([
        q,
        supabase.from("onboarding_staff").select("id, name"),
      ]);
      if (!ativo) return;
      setLoading(false);
      if (error) {
        console.error("agendamentos dos agentes:", error.message);
        setReunioes([]);
        return;
      }
      setReunioes((data || []) as Reuniao[]);
      setStaff(Object.fromEntries(((st || []) as any[]).map((s) => [s.id, s.name])));
    })();
    return () => { ativo = false; };
  }, [periodo]);

  const agentes = useMemo(() => {
    const contagem = new Map<string, number>();
    reunioes.forEach((r) => {
      const n = nomeDoAgente(r.description);
      contagem.set(n, (contagem.get(n) || 0) + 1);
    });
    return [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  }, [reunioes]);

  const lista = useMemo(
    () => (agente === "all" ? reunioes : reunioes.filter((r) => nomeDoAgente(r.description) === agente)),
    [reunioes, agente]
  );

  const resumo = useMemo(() => {
    const agora = Date.now();
    return {
      total: lista.length,
      futuras: lista.filter((r) => r.status === "pending" && r.scheduled_at && Date.parse(r.scheduled_at) > agora).length,
      realizadas: lista.filter((r) => r.status === "completed").length,
      canceladas: lista.filter((r) => ["cancelled", "canceled", "no_show"].includes(String(r.status))).length,
    };
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
        {[
          { rotulo: "Agendamentos", valor: resumo.total },
          { rotulo: "Ainda vão acontecer", valor: resumo.futuras },
          { rotulo: "Realizadas", valor: resumo.realizadas },
          { rotulo: "Canceladas", valor: resumo.canceladas },
        ].map((c) => (
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
            const b = BADGE[String(r.status)] || { texto: String(r.status || "-"), classe: "bg-muted text-muted-foreground" };
            return (
              <Card key={r.id}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{r.lead?.name || r.title || "Sem lead"}</p>
                      <Badge className={b.classe + " text-[10px]"}>{b.texto}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {dataHora(r.scheduled_at)}
                      {r.lead?.company ? ` · ${r.lead.company}` : ""}
                      {r.responsible_staff_id && staff[r.responsible_staff_id] ? ` · com ${staff[r.responsible_staff_id]}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {nomeDoAgente(r.description)} · agendou em {dataHora(r.created_at)}
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
