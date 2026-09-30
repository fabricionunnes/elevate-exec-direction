// Dashboard de Negócios (item 16 do benchmark Datacrazy, 30/09/2026): criados, ganhos,
// perdidos e em aberto no período, produtividade por dono e por funil, motivos de perda e a
// lista de negócios em aberto com dias em aberto e dias parado na etapa, com ações na linha
// (abrir lead, mover etapa, criar atividade). Dados: crm_negocios_dashboard(...), que ordena
// e limita a lista no banco (117k leads abertos na base, quase tudo disparo antigo).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/crm/traffic/SearchableSelect";
import { AddActivityDialog } from "@/components/crm/AddActivityDialog";
import { syncLeadToClint } from "@/hooks/useClintSync";
import { createStageActivities } from "@/hooks/useStageActions";
import { Loader2, RefreshCw, Download, Briefcase, ArrowRightLeft, Plus, ExternalLink } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import {
  C, tipStyle, n, pct, moeda, dataHora,
  Kpi, Grafico, ExportarDialog, PeriodoFiltro, intervalo, useStaffOptions, ThOrdenavel, type Periodo,
} from "./dashboardShared";

interface Props {
  staffId?: string | null;
  /** Fora da gestão, o painel fica travado nos negócios do próprio usuário. */
  lockedStaffId?: string | null;
}

interface Etapa { id: string; name: string; pipeline_id: string; sort_order: number | null; final_type: string | null; is_final: boolean | null }

const ORDENS = [
  { value: "valor", label: "Maior valor" }, { value: "dias_aberto", label: "Mais tempo em aberto" },
  { value: "dias_etapa", label: "Mais tempo parado na etapa" }, { value: "recentes", label: "Mais recentes" },
];

export function NegociosDashboardTab({ staffId, lockedStaffId }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>({ key: "30" });
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [funil, setFunil] = useState<string>("all");
  const [dono, setDono] = useState<string>(lockedStaffId || "all");
  const [soComValor, setSoComValor] = useState(true);
  const [ordem, setOrdem] = useState("valor");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "valor", dir: "desc" });
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [novaAtividadeLead, setNovaAtividadeLead] = useState<string | null>(null);
  const [mover, setMover] = useState<{ lead: any; stageId: string; nota: string } | null>(null);
  const [movendo, setMovendo] = useState(false);
  const staff = useStaffOptions();

  useEffect(() => {
    supabase.from("crm_pipelines").select("id, name").eq("is_active", true).order("sort_order")
      .then(({ data }) => setPipelines((data || []) as { id: string; name: string }[]));
    supabase.from("crm_stages").select("id, name, pipeline_id, sort_order, final_type, is_final").order("sort_order")
      .then(({ data }) => setEtapas((data || []) as Etapa[]));
  }, []);

  const carregar = useCallback(async () => {
    if (periodo.key === "custom" && (!periodo.from || !periodo.to)) return;
    setCarregando(true);
    const { from, to } = intervalo(periodo);
    const { data, error } = await (supabase as any).rpc("crm_negocios_dashboard", {
      p_from: from.toISOString(), p_to: to.toISOString(),
      p_pipeline: funil === "all" ? null : funil, p_owner: dono === "all" ? null : dono,
      p_only_valued: soComValor, p_order: ordem, p_limit: 300,
    });
    if (error) toast.error("Erro ao carregar o painel: " + error.message);
    setDados(data || null);
    setCarregando(false);
  }, [periodo, funil, dono, soComValor, ordem]);
  useEffect(() => { carregar(); }, [carregar]);

  const k = dados?.kpis || {};
  const { texto } = intervalo(periodo);
  const porDono = useMemo(() => (dados?.por_dono || []).map((d: any) => ({ ...d, criados: n(d.criados), ganhos: n(d.ganhos), perdidos: n(d.perdidos), abertos: n(d.abertos), ganhos_valor: n(d.ganhos_valor), abertos_valor: n(d.abertos_valor) })), [dados]);
  const porFunil = useMemo(() => (dados?.por_funil || []).map((d: any) => ({ ...d, criados: n(d.criados), ganhos: n(d.ganhos), perdidos: n(d.perdidos), abertos: n(d.abertos), ganhos_valor: n(d.ganhos_valor), abertos_valor: n(d.abertos_valor) })), [dados]);
  const porEtapa: any[] = dados?.por_etapa || [];
  const motivos: any[] = dados?.motivos_perda || [];
  const lista: any[] = useMemo(() => {
    const rows = [...(dados?.lista || [])];
    const m = sort.dir === "asc" ? 1 : -1;
    const texto = (r: any) => {
      if (sort.key === "nome") return `${r.nome || ""} ${r.empresa || ""}`;
      if (sort.key === "funil") return `${r.funil || ""} ${r.etapa || ""}`;
      if (sort.key === "dono") return r.dono || "";
      return "";
    };
    rows.sort((a, b) => {
      if (["nome", "funil", "dono"].includes(sort.key)) return texto(a).localeCompare(texto(b), "pt-BR") * m;
      return ((Number(a[sort.key]) || 0) - (Number(b[sort.key]) || 0)) * m;
    });
    return rows;
  }, [dados, sort]);
  const onSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: ["nome", "funil", "dono"].includes(key) ? "asc" : "desc" }));

  const blocosExport = useMemo(() => [
    { chave: "kpis", rotulo: "Resumo", linhas: dados ? [{
      Periodo: texto, Criados: n(k.criados), "Criados (valor)": n(k.criados_valor), Ganhos: n(k.ganhos), "Ganhos (valor)": n(k.ganhos_valor),
      Perdidos: n(k.perdidos), "Perdidos (valor)": n(k.perdidos_valor), "Em aberto criados no periodo": n(k.abertos_periodo), "Em aberto no periodo (valor)": n(k.abertos_periodo_valor),
      "Em aberto total": n(k.abertos_total), "Em aberto total (valor)": n(k.abertos_total_valor), "Em aberto com valor": n(k.abertos_com_valor),
      "Ticket medio ganho": Math.round(n(k.ticket_ganho)), "Ciclo medio (dias)": n(k.ciclo_medio_dias),
    }] : [] },
    { chave: "por_dono", rotulo: "Por dono", linhas: porDono.map((d: any) => ({ Dono: d.nome, Criados: d.criados, Ganhos: d.ganhos, "Ganhos (valor)": d.ganhos_valor, Perdidos: d.perdidos, "Em aberto (criados no periodo)": d.abertos, "Em aberto (valor)": d.abertos_valor })) },
    { chave: "por_funil", rotulo: "Por funil", linhas: porFunil.map((d: any) => ({ Funil: d.nome, Criados: d.criados, Ganhos: d.ganhos, "Ganhos (valor)": d.ganhos_valor, Perdidos: d.perdidos, "Em aberto (criados no periodo)": d.abertos, "Em aberto (valor)": d.abertos_valor })) },
    { chave: "por_etapa", rotulo: "Em aberto por etapa", linhas: porEtapa.map((e: any) => ({ Funil: e.funil, Etapa: e.etapa, Negocios: n(e.total), Valor: n(e.valor), "Parados ha mais de 7 dias": n(e.parados_7d) })) },
    { chave: "motivos", rotulo: "Motivos de perda", linhas: motivos.map((m: any) => ({ Motivo: m.nome, Perdidos: n(m.total), Valor: n(m.valor) })) },
    { chave: "lista", rotulo: "Negocios em aberto", linhas: (dados?.lista || []).map((l: any) => ({ Lead: l.nome, Empresa: l.empresa || "", Funil: l.funil, Etapa: l.etapa, Dono: l.dono || "", Valor: n(l.valor), "Criado em": new Date(l.created_at).toLocaleString("pt-BR"), "Dias em aberto": n(l.dias_aberto), "Na etapa desde": l.etapa_desde ? new Date(l.etapa_desde).toLocaleString("pt-BR") : "", "Dias parado na etapa": n(l.dias_etapa), "Ultima atividade": l.last_activity_at ? new Date(l.last_activity_at).toLocaleString("pt-BR") : "", "Proxima atividade": l.next_activity_at ? new Date(l.next_activity_at).toLocaleString("pt-BR") : "" })) },
  ], [dados, k, texto, porDono, porFunil, porEtapa, motivos]);

  // Mover etapa: mesma forma do kanban (CRMPipelinePage): update de stage_id (+ closed_at e
  // closer no ganho), nota opcional em crm_lead_history, ações da etapa e sync com o Clint.
  // O histórico stage_change e o stage_entered_at são gravados por trigger no banco.
  const confirmarMover = async () => {
    if (!mover || !mover.stageId) return;
    setMovendo(true);
    try {
      const alvo = etapas.find((e) => e.id === mover.stageId);
      const ganho = alvo?.final_type === "won";
      const upd: { stage_id: string; closed_at?: string; closer_staff_id?: string } = { stage_id: mover.stageId };
      if (ganho) {
        upd.closed_at = new Date().toISOString();
        const { data: l } = await supabase.from("crm_leads").select("owner_staff_id, closer_staff_id").eq("id", mover.lead.id).single();
        if (l && !l.closer_staff_id) upd.closer_staff_id = l.owner_staff_id || staffId || undefined;
      }
      const { error } = await supabase.from("crm_leads").update(upd).eq("id", mover.lead.id);
      if (error) throw error;
      syncLeadToClint(mover.lead.id, "stage_change");
      if (mover.nota.trim()) {
        await supabase.from("crm_lead_history").insert({
          lead_id: mover.lead.id, action: "note_added", notes: mover.nota.trim(), field_changed: "stage_change_note",
          new_value: alvo?.name || null, staff_id: staffId || null,
        });
      }
      await createStageActivities(mover.lead.id, mover.stageId, staffId || undefined);
      toast.success(ganho ? "Negócio movido pra GANHO" : "Negócio movido");
      setMover(null);
      carregar();
    } catch (e: any) {
      toast.error("Erro ao mover: " + (e?.message || "tente de novo"));
    } finally {
      setMovendo(false);
    }
  };

  const etapasDoLead = mover ? etapas.filter((e) => e.pipeline_id === mover.lead.pipeline_id && e.id !== mover.lead.stage_id) : [];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl">
      <div className="flex flex-wrap items-center gap-2">
        <Briefcase className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Negócios</h2>
        <span className="text-xs text-muted-foreground">{texto}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PeriodoFiltro value={periodo} onChange={setPeriodo} />
          <div className="w-[190px]"><SearchableSelect value={funil} onChange={setFunil} options={[{ value: "all", label: "Todos os funis" }, ...pipelines.map((p) => ({ value: p.id, label: p.name }))]} /></div>
          {!lockedStaffId && <div className="w-[180px]"><SearchableSelect value={dono} onChange={setDono} options={[{ value: "all", label: "Todos os donos" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} /></div>}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={carregar} disabled={carregando}><RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} /> Atualizar</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setExportOpen(true)} disabled={!dados}><Download className="h-3.5 w-3.5" /> Exportar</Button>
        </div>
      </div>
      <ExportarDialog open={exportOpen} onOpenChange={setExportOpen} blocos={blocosExport} nomeArquivo={`negocios-${periodo.key}`} />
      {novaAtividadeLead && (
        <AddActivityDialog open onOpenChange={(v) => { if (!v) setNovaAtividadeLead(null); }} leadId={novaAtividadeLead}
          onSuccess={() => { setNovaAtividadeLead(null); carregar(); }} />
      )}

      <Dialog open={!!mover} onOpenChange={(v) => { if (!v && !movendo) setMover(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mover etapa</DialogTitle>
            <DialogDescription>{mover?.lead?.nome}{mover?.lead?.empresa ? `, ${mover.lead.empresa}` : ""}. Hoje em {mover?.lead?.etapa} ({mover?.lead?.funil}).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <SearchableSelect value={mover?.stageId || ""} onChange={(v) => setMover((m) => (m ? { ...m, stageId: v } : m))} placeholder="Escolha a etapa"
              options={etapasDoLead.map((e) => ({ value: e.id, label: e.final_type === "won" ? `${e.name} (ganho)` : e.final_type === "lost" ? `${e.name} (perdido)` : e.name }))} />
            <Textarea value={mover?.nota || ""} onChange={(e) => setMover((m) => (m ? { ...m, nota: e.target.value } : m))} placeholder="Observação (opcional), fica no histórico do lead" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMover(null)} disabled={movendo}>Cancelar</Button>
            <Button onClick={confirmarMover} disabled={movendo || !mover?.stageId}>{movendo && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {carregando && !dados ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando o painel...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kpi label="Criados" valor={n(k.criados).toLocaleString("pt-BR")} sub={moeda(k.criados_valor)} cor={C.azul} destaque />
            <Kpi label="Ganhos" valor={n(k.ganhos).toLocaleString("pt-BR")} sub={`${moeda(k.ganhos_valor)}, ticket ${moeda(k.ticket_ganho)}`} cor={C.verde} destaque />
            <Kpi label="Perdidos" valor={n(k.perdidos).toLocaleString("pt-BR")} sub={moeda(k.perdidos_valor)} cor={C.vermelho} destaque />
            <Kpi label="Em aberto (criados no período)" valor={n(k.abertos_periodo).toLocaleString("pt-BR")} sub={moeda(k.abertos_periodo_valor)} cor={C.violeta} destaque />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kpi label="Em aberto (total)" valor={n(k.abertos_total).toLocaleString("pt-BR")} sub={`${n(k.abertos_com_valor).toLocaleString("pt-BR")} com valor, ${moeda(k.abertos_total_valor)}`} cor={C.cinza} />
            <Kpi label="Conversão" valor={pct(n(k.ganhos), n(k.ganhos) + n(k.perdidos))} sub="ganhos sobre fechados no período" cor={C.verde} />
            <Kpi label="Ciclo médio" valor={k.ciclo_medio_dias != null ? `${n(k.ciclo_medio_dias)}d` : "-"} sub="da criação ao ganho" cor={C.amarelo} />
            <Kpi label="Motivos de perda" valor={String(motivos.length)} sub={motivos[0] ? `${motivos[0].nome}: ${n(motivos[0].total)}` : "nenhum perdido no período"} cor={C.laranja} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Grafico titulo="Produtividade por dono" subtitulo="Criados, ganhos e perdidos no período" altura={Math.max(200, 40 + porDono.length * 34)}>
                <BarChart data={porDono} layout="vertical" margin={{ top: 4, right: 30, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={tipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="criados" name="Criados" fill={C.azul} radius={[0, 4, 4, 0]} barSize={9} fillOpacity={0.6} />
                  <Bar dataKey="ganhos" name="Ganhos" fill={C.verde} radius={[0, 4, 4, 0]} barSize={9} />
                  <Bar dataKey="perdidos" name="Perdidos" fill={C.vermelho} radius={[0, 4, 4, 0]} barSize={9} />
                </BarChart>
              </Grafico>
            </div>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium">Motivos de perda</p>
                <p className="text-xs text-muted-foreground mb-3">Perdidos no período</p>
                {motivos.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nenhum negócio perdido no período.</p> : (
                  <div className="space-y-2.5">
                    {motivos.slice(0, 8).map((m: any) => {
                      const max = n(motivos[0]?.total) || 1;
                      return (
                        <div key={m.nome} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate max-w-[70%]">{m.nome}</span>
                            <span className="tabular-nums text-muted-foreground">{n(m.total)}{n(m.valor) ? ` · ${moeda(m.valor)}` : ""}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.round((n(m.total) / max) * 100)}%`, background: C.vermelho }} /></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">Por funil</p>
                <div className="overflow-x-auto max-h-[320px]">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground sticky top-0 bg-card"><tr className="border-b">
                      <th className="text-left font-medium py-1.5">Funil</th><th className="text-right font-medium">Criados</th><th className="text-right font-medium">Ganhos</th>
                      <th className="text-right font-medium">Valor ganho</th><th className="text-right font-medium">Perdidos</th><th className="text-right font-medium">Em aberto</th>
                    </tr></thead>
                    <tbody>
                      {porFunil.map((f: any) => (
                        <tr key={f.id || f.nome} className="border-b last:border-0">
                          <td className="py-1.5">{f.nome}</td>
                          <td className="text-right tabular-nums">{f.criados}</td>
                          <td className="text-right tabular-nums" style={{ color: C.verde }}>{f.ganhos}</td>
                          <td className="text-right tabular-nums text-xs">{f.ganhos_valor ? moeda(f.ganhos_valor) : "-"}</td>
                          <td className="text-right tabular-nums" style={{ color: f.perdidos ? C.vermelho : undefined }}>{f.perdidos}</td>
                          <td className="text-right tabular-nums">{f.abertos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-1">Em aberto por etapa</p>
                <p className="text-xs text-muted-foreground mb-3">Onde o dinheiro está parado{soComValor ? " (só negócios com valor)" : ""}</p>
                <div className="overflow-x-auto max-h-[320px]">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground sticky top-0 bg-card"><tr className="border-b">
                      <th className="text-left font-medium py-1.5">Funil / etapa</th><th className="text-right font-medium">Negócios</th><th className="text-right font-medium">Valor</th><th className="text-right font-medium">Parados +7d</th>
                    </tr></thead>
                    <tbody>
                      {porEtapa.map((e: any) => (
                        <tr key={`${e.funil}-${e.etapa}`} className="border-b last:border-0">
                          <td className="py-1.5 text-xs"><span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ background: e.cor || "#6B7280" }} />{e.funil} <span className="text-muted-foreground">/ {e.etapa}</span></td>
                          <td className="text-right tabular-nums">{n(e.total)}</td>
                          <td className="text-right tabular-nums text-xs">{moeda(e.valor)}</td>
                          <td className="text-right tabular-nums" style={{ color: n(e.parados_7d) ? C.amarelo : undefined }}>{n(e.parados_7d)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <p className="text-sm font-medium flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> Negócios em aberto</p>
                <span className="text-xs text-muted-foreground">{(dados?.lista || []).length} de {n(dados?.lista_total).toLocaleString("pt-BR")}</span>
                <div className="ml-auto flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox checked={soComValor} onCheckedChange={(v) => setSoComValor(!!v)} /> Só com valor
                  </label>
                  <div className="w-[210px]"><SearchableSelect value={ordem} onChange={setOrdem} options={ORDENS} /></div>
                </div>
              </div>
              {lista.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Nenhum negócio em aberto com esses filtros.</p> : (
                <div className="overflow-x-auto max-h-[560px]">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground sticky top-0 bg-card"><tr className="border-b">
                      <ThOrdenavel label="Lead" chave="nome" sort={sort} onSort={onSort} />
                      <ThOrdenavel label="Funil / etapa" chave="funil" sort={sort} onSort={onSort} />
                      <ThOrdenavel label="Dono" chave="dono" sort={sort} onSort={onSort} />
                      <ThOrdenavel label="Valor" chave="valor" sort={sort} onSort={onSort} alinhar="right" />
                      <ThOrdenavel label="Em aberto" chave="dias_aberto" sort={sort} onSort={onSort} alinhar="right" />
                      <ThOrdenavel label="Parado na etapa" chave="dias_etapa" sort={sort} onSort={onSort} alinhar="right" />
                      <th className="text-left font-medium">Última atividade</th>
                      <th></th>
                    </tr></thead>
                    <tbody>
                      {lista.map((l: any) => (
                        <tr key={l.id} className="border-b last:border-0">
                          <td className="py-1.5">
                            <Link to={`/crm/leads/${l.id}`} className="hover:underline font-medium">{l.nome || "Lead"}</Link>
                            {l.empresa && <span className="text-xs text-muted-foreground ml-1.5">{l.empresa}</span>}
                          </td>
                          <td className="text-xs whitespace-nowrap"><span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ background: l.cor || "#6B7280" }} />{l.funil} <span className="text-muted-foreground">/ {l.etapa}</span></td>
                          <td className="text-xs">{l.dono || <span className="text-muted-foreground">sem dono</span>}</td>
                          <td className="text-right tabular-nums">{n(l.valor) ? moeda(l.valor) : <span className="text-muted-foreground">-</span>}</td>
                          <td className="text-right tabular-nums">{n(l.dias_aberto)}d</td>
                          <td className="text-right tabular-nums" style={{ color: n(l.dias_etapa) > 14 ? C.vermelho : n(l.dias_etapa) > 7 ? C.amarelo : undefined }}>{n(l.dias_etapa)}d</td>
                          <td className="text-xs whitespace-nowrap">{l.last_activity_at ? dataHora(l.last_activity_at) : <Badge variant="outline" className="text-[10px]">nunca</Badge>}</td>
                          <td className="text-right whitespace-nowrap">
                            <Link to={`/crm/leads/${l.id}`} className="inline-flex items-center h-7 px-2 text-xs text-primary hover:underline" title="Abrir lead"><ExternalLink className="h-3 w-3 mr-1" /> Abrir</Link>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setMover({ lead: l, stageId: "", nota: "" })} title="Mover etapa"><ArrowRightLeft className="h-3 w-3" /> Etapa</Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setNovaAtividadeLead(l.id)} title="Criar atividade"><Plus className="h-3 w-3" /> Atividade</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
