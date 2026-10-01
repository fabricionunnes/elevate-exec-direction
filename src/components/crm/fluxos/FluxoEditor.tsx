// Editor visual de um fluxo: paleta de blocos, canvas (@xyflow/react), painel de configuração,
// teste com um lead (simulação ou de verdade) e aba Execuções com o passo a passo por lead.
// Todo número abre o detalhe: os contadores filtram a lista e cada bloco mostra quem passou por ele.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, useReactFlow,
  MarkerType, type Connection, type Edge, type Node, type IsValidConnection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, Play, Copy, Download, Search, AlertTriangle, FlaskConical } from "lucide-react";
import { FluxoNode } from "./FluxoNode";
import { PainelBloco, type FluxoMeta } from "./PainelBloco";
import { FluxoExecucoes } from "./FluxoExecucoes";
import { CATALOGO, GRUPOS, LISTAS_VAZIAS, uid, validarFluxo, triggerLabel, type NodeType, type Listas, type BlocoDef } from "./catalogo";

const nodeTypes = Object.fromEntries(Object.keys(CATALOGO).map((k) => [k, FluxoNode]));
const limpar = (n: Node) => ({ id: n.id, type: n.type, position: n.position, data: Object.fromEntries(Object.entries(n.data || {}).filter(([k]) => !k.startsWith("_"))) });
const limparEdge = (e: Edge) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle || "default", target: e.target });
const novaEdge = (e: { id?: string; source: string; sourceHandle?: string | null; target: string }): Edge => ({
  id: e.id || `${e.source}-${e.sourceHandle || "default"}-${e.target}`, source: e.source, sourceHandle: e.sourceHandle || "default", target: e.target,
  type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed },
});
interface Stats { status: Record<string, number>; total: number; simulacoes: number; nodes: Record<string, { n: number; erros: number }>; esperando: Record<string, number> }

function useTemaEscuro() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function Editor({ id, canEdit }: { id: string; canEdit: boolean }) {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const rf = useReactFlow();
  const dark = useTemaEscuro();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [meta, setMeta] = useState<FluxoMeta>({ name: "", description: "", trigger_type: "manual", trigger_config: {}, filters: {} });
  const [isActive, setIsActive] = useState(false);
  const [listas, setListas] = useState<Listas>(LISTAS_VAZIAS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [tab, setTab] = useState<string>(sp.get("tab") === "execucoes" ? "execucoes" : "editor");
  const [stats, setStats] = useState<Stats | null>(null);
  const [filtroRun, setFiltroRun] = useState<string>(sp.get("status") || "all");
  const [filtroNode, setFiltroNode] = useState<string | null>(null);
  const [refreshRuns, setRefreshRuns] = useState(0);
  const [teste, setTeste] = useState(false);
  const [buscaLead, setBuscaLead] = useState("");
  const [leads, setLeads] = useState<{ id: string; name: string; phone: string | null; company: string | null }[]>([]);
  const [testando, setTestando] = useState(false);
  const [confirmarAtivar, setConfirmarAtivar] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<any>(null);

  // ---------- carregar
  useEffect(() => {
    let vivo = true;
    (async () => {
      const sb = supabase as any;
      const f = await sb.from("crm_flows").select("*").eq("id", id).maybeSingle();
      if (!vivo) return;
      if (!f.data) { toast.error("Fluxo não encontrado"); navigate("/crm/fluxos"); return; }
      const [st, pp, og, tg, cd, staff, ins, of, fl] = await Promise.all([
        sb.from("crm_stages").select("id, name, pipeline_id, sort_order").order("sort_order"),
        sb.from("crm_pipelines").select("id, name, is_active").order("name"),
        sb.from("crm_origins").select("id, name, is_active").order("name"),
        sb.from("crm_tags").select("id, name, is_active").order("name"),
        sb.from("crm_cadences").select("id, name, is_active").order("name"),
        sb.from("onboarding_staff").select("id, name, role").eq("is_active", true).order("name"),
        sb.from("whatsapp_instances").select("id, instance_name, display_name, phone_number, status").is("project_id", null).order("display_name"),
        sb.from("whatsapp_official_instances").select("id, display_name, phone_number, status").order("created_at"),
        sb.from("crm_flows").select("id, name").neq("id", id).order("name"),
      ]);
      if (!vivo) return;
      const pipes = (pp.data || []).filter((p: any) => p.is_active !== false);
      const pipeNome = (pid: string) => pipes.find((p: any) => p.id === pid)?.name;
      const evo = (ins.data || []).map((i: any) => ({ id: i.id, label: `${i.display_name || i.instance_name}${i.phone_number ? ` (${i.phone_number})` : ""}${i.status === "connected" ? "" : ", desconectado"}` }));
      const L: Listas = {
        stages: (st.data || []).filter((s: any) => pipeNome(s.pipeline_id)).map((s: any) => ({ value: s.id, label: `${pipeNome(s.pipeline_id)} › ${s.name}` })).sort((a: any, b: any) => a.label.split(" › ")[0].localeCompare(b.label.split(" › ")[0])),
        pipelines: pipes.map((p: any) => ({ value: p.id, label: p.name })),
        origins: (og.data || []).filter((o: any) => o.is_active !== false).map((o: any) => ({ value: o.id, label: o.name })),
        tags: (tg.data || []).filter((t: any) => t.is_active !== false).map((t: any) => ({ value: t.id, label: t.name })),
        cadences: (cd.data || []).map((c: any) => ({ value: c.id, label: `${c.name}${c.is_active ? "" : " (desligada)"}` })),
        staff: staff.data || [],
        instances: evo.map((i: any) => ({ value: i.id, label: i.label })),
        sendInstances: [
          ...evo.map((i: any) => ({ value: `evolution:${i.id}`, label: i.label })),
          ...(of.data || []).map((i: any) => ({ value: `official:${i.id}`, label: `${i.display_name || i.phone_number || "API oficial"} (API oficial)` })),
        ],
        flows: (fl.data || []).map((x: any) => ({ value: x.id, label: x.name })),
      };
      setListas(L);
      const fw = f.data;
      setMeta({ name: fw.name, description: fw.description || "", trigger_type: fw.trigger_type || "manual", trigger_config: fw.trigger_config || {}, filters: fw.filters || {} });
      setIsActive(!!fw.is_active);
      const ns: Node[] = (fw.nodes || []).map((n: any) => ({ id: n.id, type: n.type, position: n.position || { x: 0, y: 0 }, data: { ...(n.data || {}), _listas: L, _trigger: fw.trigger_type } }));
      if (!ns.length) ns.push({ id: uid(), type: "trigger", position: { x: 260, y: 40 }, data: { _listas: L, _trigger: fw.trigger_type } });
      setNodes(ns);
      setEdges((fw.edges || []).map((e: any) => novaEdge(e)));
      viewportRef.current = fw.viewport || null;
      setLoading(false);
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (loading) return;
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, _trigger: meta.trigger_type, _listas: listas } })));
  }, [meta.trigger_type, listas, loading, setNodes]);

  // o canvas é remontado ao voltar da aba Execuções: devolve o enquadramento em que estava
  useEffect(() => {
    if (loading || tab !== "editor") return;
    const t = setTimeout(() => { if (viewportRef.current) rf.setViewport(viewportRef.current); else rf.fitView({ padding: 0.3, maxZoom: 1 }); }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tab]);

  // ---------- contadores (calculados no banco)
  const loadStats = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc("crm_flow_stats", { p_flow_id: id });
    if (!error) setStats(data as Stats);
  }, [id]);
  useEffect(() => { if (!loading) loadStats(); }, [loading, loadStats, refreshRuns]);
  const emAndamento = (stats?.status?.running || 0) + (stats?.status?.waiting || 0);
  useEffect(() => {
    if (!emAndamento && tab !== "execucoes") return;
    const t = setInterval(loadStats, 20000);
    return () => clearInterval(t);
  }, [emAndamento, tab, loadStats]);
  useEffect(() => {
    if (loading) return;
    setNodes((ns) => ns.map((n) => {
      const s = stats?.nodes?.[n.id]; const espera = stats?.esperando?.[n.id] || 0;
      return { ...n, data: { ...n.data, _stats: s ? { n: s.n, erros: s.erros, espera } : null, _ativo: espera > 0 } };
    }));
  }, [stats, loading, setNodes]);

  // sair com alteração pendente
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // ---------- edição
  const marcar = useCallback(() => setDirty(true), []);
  const onConnect = useCallback((c: Connection) => {
    if (!canEdit) return;
    // cada saída liga em um bloco só: a ligação nova substitui a antiga
    setEdges((eds) => addEdge(novaEdge({ source: c.source!, sourceHandle: c.sourceHandle, target: c.target! }),
      eds.filter((e) => !(e.source === c.source && (e.sourceHandle || "default") === (c.sourceHandle || "default")))));
    marcar();
  }, [setEdges, canEdit, marcar]);
  const isValidConnection: IsValidConnection = useCallback((c) => c.source !== c.target, []);

  const addNode = useCallback((type: NodeType, pos?: { x: number; y: number }) => {
    if (!canEdit) return;
    const def = CATALOGO[type];
    const sel = nodes.find((n) => n.id === selId);
    let position = pos;
    if (!position) {
      if (sel) position = { x: sel.position.x, y: sel.position.y + 150 };
      else { const b = wrapRef.current?.getBoundingClientRect(); position = rf.screenToFlowPosition({ x: (b?.left || 0) + (b?.width || 800) / 2, y: (b?.top || 0) + (b?.height || 500) / 2 }); }
    }
    // não deixa cair em cima de outro bloco: anda pro lado até achar espaço livre
    const ocupado = (p: { x: number; y: number }) => nodes.some((n) => Math.abs(n.position.x - p.x) < 240 && Math.abs(n.position.y - p.y) < 110);
    let tentativas = 0;
    const base = position!;
    while (ocupado(position!) && tentativas < 12) { tentativas++; position = { x: base.x + (tentativas % 2 === 1 ? 260 : -260) * Math.ceil(tentativas / 2), y: base.y }; }
    const nid = uid();
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { id: nid, type, selected: true, position: position!, data: { ...JSON.parse(JSON.stringify(def.padrao)), _listas: listas, _trigger: meta.trigger_type } }]);
    // liga sozinho ao bloco selecionado, na primeira saída livre dele
    if (!pos && sel && def.entrada) {
      const selDef = CATALOGO[sel.type as NodeType];
      const handle = selDef?.saidas.find((s) => !edges.some((e) => e.source === sel.id && (e.sourceHandle || "default") === s.id));
      if (handle) setEdges((eds) => [...eds, novaEdge({ source: sel.id, sourceHandle: handle.id, target: nid })]);
    }
    setSelId(nid); marcar();
  }, [nodes, edges, selId, listas, meta.trigger_type, rf, setNodes, setEdges, canEdit, marcar]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/fluxo-bloco") as NodeType;
    if (!type || !CATALOGO[type]) return;
    addNode(type, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }, [addNode, rf]);

  const selNode = nodes.find((n) => n.id === selId) || null;
  const setData = (patch: Record<string, any>) => { setNodes((ns) => ns.map((n) => (n.id === selId ? { ...n, data: { ...n.data, ...patch } } : n))); marcar(); };
  const removerSel = () => {
    if (!selNode || selNode.type === "trigger") { toast.error("O gatilho não pode ser removido"); return; }
    setNodes((ns) => ns.filter((n) => n.id !== selId)); setEdges((es) => es.filter((e) => e.source !== selId && e.target !== selId)); setSelId(null); marcar();
  };
  const duplicarSel = () => {
    if (!selNode || selNode.type === "trigger") return;
    const nid = uid();
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { ...selNode, id: nid, selected: true, position: { x: selNode.position.x + 40, y: selNode.position.y + 40 }, data: { ...selNode.data, _stats: null, _ativo: false } }]);
    setSelId(nid); marcar();
  };

  const payload = () => ({
    name: meta.name.trim() || "Fluxo sem nome", description: meta.description || null, trigger_type: meta.trigger_type,
    trigger_config: meta.trigger_config, filters: meta.filters, nodes: nodes.map(limpar), edges: edges.map(limparEdge),
  });
  const salvar = async (silent = false): Promise<boolean> => {
    if (!canEdit) return false;
    setSaving(true);
    const { error } = await (supabase as any).from("crm_flows").update({ ...payload(), viewport: rf.getViewport() }).eq("id", id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return false; }
    setDirty(false);
    if (!silent) toast.success(isActive ? "Fluxo salvo. As próximas execuções já usam esta versão." : "Rascunho salvo");
    return true;
  };

  const erros = useMemo(() => validarFluxo(nodes.map(limpar), edges, meta.trigger_type), [nodes, edges, meta.trigger_type]);
  const mandaWhats = nodes.some((n) => n.type === "send_whatsapp");
  const aplicarAtivo = async (v: boolean) => {
    if (dirty || v) { const ok = await salvar(true); if (!ok) return; }
    const { error } = await (supabase as any).from("crm_flows").update({ is_active: v }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setIsActive(v); setConfirmarAtivar(false);
    toast.success(v ? "Fluxo ativo. Os próximos casos do gatilho já entram." : "Fluxo desativado. Ninguém novo entra, quem estava no meio fica parado e nada sai da fila de envio até reativar.");
  };
  const alternarAtivo = (v: boolean) => {
    if (!canEdit) return;
    if (!v) { aplicarAtivo(false); return; }
    if (erros.length) { toast.error(erros[0] + (erros.length > 1 ? ` (e mais ${erros.length - 1})` : "")); return; }
    if (meta.trigger_type === "manual") { toast.error("Fluxo manual não precisa ser ativado: ele roda pelo botão Testar ou quando outro fluxo chama."); return; }
    setConfirmarAtivar(true);
  };

  const duplicarFluxo = async () => {
    const { data, error } = await (supabase as any).from("crm_flows").insert({ ...payload(), name: `${meta.name} (cópia)` }).select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Cópia criada, desligada"); navigate(`/crm/fluxos/${data.id}`);
  };
  const exportar = () => {
    const blob = new Blob([JSON.stringify({ versao: 1, ...payload() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `fluxo-${meta.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "sem-nome"}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  // ---------- teste com um lead
  useEffect(() => {
    if (!teste) return;
    const t = setTimeout(async () => {
      let q = (supabase as any).from("crm_leads").select("id, name, phone, company").order("created_at", { ascending: false }).limit(12);
      const termo = buscaLead.trim().replace(/[%,()]/g, " ");
      if (termo) q = q.or(`name.ilike.%${termo}%,phone.ilike.%${termo}%,company.ilike.%${termo}%`);
      const { data } = await q;
      setLeads(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [teste, buscaLead]);
  const rodarTeste = async (leadId: string, nome: string, dry: boolean) => {
    if (!dry && erros.length) { toast.error(erros[0]); return; }
    if (!dry && !window.confirm(`Rodar "${meta.name}" DE VERDADE com ${nome}? Mensagens saem, tarefas são criadas, etapa e responsável mudam.`)) return;
    setTestando(true);
    if (dirty && canEdit) { const ok = await salvar(true); if (!ok) { setTestando(false); return; } }
    const { data, error } = await (supabase as any).rpc("crm_flow_start_manual", { p_flow_id: id, p_lead_ids: [leadId], p_dry: dry });
    setTestando(false);
    if (error) { toast.error(error.message); return; }
    if (!data?.started) {
      toast.error(dry
        ? (canEdit ? "Não consegui simular com esse lead (ele é de outra empresa ou o fluxo está sem gatilho)." : "Você só simula com lead que é seu.")
        : "Esse lead já está no meio deste fluxo. Cancele a execução dele em Execuções ou escolha outro.");
      return;
    }
    toast.success(dry ? "Simulação pronta: nada foi enviado nem alterado. Veja o caminho em Execuções." : "Fluxo iniciado. Acompanhe em Execuções.");
    setTeste(false); setTab("execucoes"); setFiltroRun("all"); setFiltroNode(null); setRefreshRuns((n) => n + 1);
  };

  const nomeBloco = useCallback((nid: string | null) => {
    const n = nodes.find((x) => x.id === nid);
    if (!n) return nid ? "bloco removido" : "-";
    return (n.data as any)?.label || CATALOGO[n.type as NodeType]?.label || String(n.type);
  }, [nodes]);
  const verBloco = (nid: string) => {
    setTab("editor"); setSelId(nid); setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === nid })));
    const n = nodes.find((x) => x.id === nid);
    if (n) setTimeout(() => rf.setCenter(n.position.x + 115, n.position.y + 60, { zoom: 1.1, duration: 400 }), 80);
  };
  const verExecucoesDoBloco = (nid: string, status = "all") => { setFiltroNode(nid); setFiltroRun(status); setTab("execucoes"); };

  useEffect(() => {
    const p: Record<string, string> = {};
    if (tab === "execucoes") p.tab = "execucoes";
    if (filtroRun !== "all") p.status = filtroRun;
    setSp(p, { replace: true });
  }, [tab, filtroRun, setSp]);

  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando fluxo...</div>;

  const statSel = selNode ? stats?.nodes?.[selNode.id] : null;
  const esperaSel = selNode ? stats?.esperando?.[selNode.id] || 0 : 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] min-h-[560px] bg-background">
      {/* cabeçalho */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-background">
        <Button variant="ghost" size="sm" title="Voltar pra lista" onClick={() => { if (dirty && !window.confirm("Sair sem salvar as alterações?")) return; navigate("/crm/fluxos"); }}><ArrowLeft className="h-4 w-4" /></Button>
        <Input className="h-8 w-[260px] font-semibold" value={meta.name} disabled={!canEdit} onChange={(e) => { setMeta((m) => ({ ...m, name: e.target.value })); marcar(); }} />
        <Badge variant="outline" className="text-[10px]">{triggerLabel(meta.trigger_type)}</Badge>
        {dirty && <span className="text-[11px] text-amber-600 dark:text-amber-400">alterações não salvas</span>}
        <Tabs value={tab} onValueChange={setTab} className="ml-2">
          <TabsList className="h-8">
            <TabsTrigger value="editor" className="text-xs h-7">Editor</TabsTrigger>
            <TabsTrigger value="execucoes" className="text-xs h-7">Execuções {emAndamento > 0 && <Badge className="ml-1.5 h-4 px-1.5 text-[10px] bg-emerald-600 text-white">{emAndamento}</Badge>}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {erros.length > 0 && <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1" title={erros.join("\n")}><AlertTriangle className="h-3.5 w-3.5" /> {erros.length} pendência{erros.length > 1 ? "s" : ""}</span>}
          <label className="flex items-center gap-1.5 text-xs cursor-pointer text-foreground"><Switch checked={isActive} disabled={!canEdit} onCheckedChange={alternarAtivo} /> {isActive ? "Ativo" : "Desligado"}</label>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setTeste(true)}><Play className="h-3.5 w-3.5" /> Testar com um lead</Button>
          {canEdit && <Button variant="outline" size="sm" onClick={duplicarFluxo} title="Duplicar fluxo"><Copy className="h-3.5 w-3.5" /></Button>}
          <Button variant="outline" size="sm" onClick={exportar} title="Exportar JSON"><Download className="h-3.5 w-3.5" /></Button>
          {canEdit && <Button size="sm" className="gap-1" onClick={() => salvar()} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {isActive ? "Salvar" : "Salvar rascunho"}</Button>}
        </div>
      </div>
      {erros.length > 0 && tab === "editor" && (
        <div className="px-3 py-1.5 border-b border-border bg-amber-500/10 text-[11px] text-foreground flex flex-wrap gap-x-4 gap-y-0.5">
          <span className="font-medium">Pra ativar, falta:</span>
          {erros.slice(0, 4).map((e, i) => <span key={i}>{e}</span>)}
          {erros.length > 4 && <span className="text-muted-foreground">e mais {erros.length - 4}</span>}
        </div>
      )}

      {tab === "editor" ? (
        <div className="flex flex-1 min-h-0">
          {/* paleta */}
          {canEdit && (
            <aside className="w-[210px] shrink-0 border-r border-border overflow-y-auto p-2 space-y-3 bg-muted/20">
              <p className="text-[11px] text-muted-foreground px-1">Clique pra adicionar (liga no bloco selecionado) ou arraste pro canvas.</p>
              {GRUPOS.map((g) => (
                <div key={g} className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1">{g}</p>
                  {(Object.entries(CATALOGO) as [NodeType, BlocoDef][]).filter(([, d]) => d.grupo === g).map(([t, d]) => {
                    const Icon = d.icon;
                    return (
                      <button key={t} type="button" draggable title={d.desc}
                        onDragStart={(e) => { e.dataTransfer.setData("application/fluxo-bloco", t); e.dataTransfer.effectAllowed = "move"; }}
                        onClick={() => addNode(t)}
                        className="w-full flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left text-xs text-foreground hover:border-primary/60 hover:shadow-sm cursor-grab active:cursor-grabbing">
                        <span className="rounded p-1 text-white shrink-0" style={{ background: d.cor }}><Icon className="h-3 w-3" /></span>
                        <span className="truncate">{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </aside>
          )}

          {/* canvas */}
          <div ref={wrapRef} className="flex-1 min-w-0 relative" onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}>
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} colorMode={dark ? "dark" : "light"}
              nodesDraggable={canEdit} nodesConnectable={canEdit} edgesFocusable={canEdit}
              onNodesChange={(ch) => { onNodesChange(ch); if (canEdit && ch.some((c) => (c.type === "position" && c.dragging) || c.type === "remove")) marcar(); }}
              onEdgesChange={(ch) => { onEdgesChange(ch); if (canEdit && ch.some((c) => c.type === "remove")) marcar(); }}
              onConnect={onConnect} isValidConnection={isValidConnection}
              onMoveEnd={(_, vp) => { viewportRef.current = vp; }}
              onSelectionChange={({ nodes: sel }) => setSelId(sel[0]?.id || null)}
              onNodeDoubleClick={(_, n) => { if (stats?.nodes?.[n.id]) verExecucoesDoBloco(n.id); }}
              onBeforeDelete={async ({ nodes: del }) => canEdit && !del.some((n) => n.type === "trigger")}
              deleteKeyCode={canEdit ? ["Backspace", "Delete"] : null} snapToGrid snapGrid={[10, 10]} minZoom={0.2} maxZoom={2}
              proOptions={{ hideAttribution: true }} defaultEdgeOptions={{ type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } }}>
              <Background gap={20} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable nodeColor={(n) => CATALOGO[n.type as NodeType]?.cor || "#999"} />
            </ReactFlow>
            {(stats?.total || 0) > 0 && (
              <div className="absolute top-2 left-2 rounded-md border border-border bg-background/95 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
                {stats!.total} execuç{stats!.total === 1 ? "ão" : "ões"} · dois cliques num bloco mostram quem passou por ele
              </div>
            )}
          </div>

          {/* painel */}
          <aside className="w-[340px] shrink-0 border-l border-border overflow-y-auto p-3 bg-background">
            <PainelBloco node={selNode ? { id: selNode.id, type: selNode.type as NodeType, data: selNode.data as any } : null} listas={listas} meta={meta} readOnly={!canEdit}
              onMeta={(p) => { setMeta((m) => ({ ...m, ...p })); marcar(); }} onData={setData} onDelete={removerSel} onDuplicate={duplicarSel} />
            {selNode && (statSel || esperaSel > 0) && (
              <div className="mt-4 rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Passagens por este bloco</p>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <button type="button" onClick={() => verExecucoesDoBloco(selNode.id)} className="rounded border border-border p-1.5 hover:bg-muted/50"><p className="text-base font-bold tabular-nums text-foreground">{statSel?.n || 0}</p><p className="text-[10px] text-muted-foreground">passaram</p></button>
                  <button type="button" onClick={() => verExecucoesDoBloco(selNode.id, "waiting")} className="rounded border border-border p-1.5 hover:bg-muted/50"><p className="text-base font-bold tabular-nums text-sky-600 dark:text-sky-400">{esperaSel}</p><p className="text-[10px] text-muted-foreground">parados aqui</p></button>
                  <button type="button" onClick={() => verExecucoesDoBloco(selNode.id, "failed")} className="rounded border border-border p-1.5 hover:bg-muted/50"><p className="text-base font-bold tabular-nums text-destructive">{statSel?.erros || 0}</p><p className="text-[10px] text-muted-foreground">erros</p></button>
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <FluxoExecucoes flowId={id} listas={listas} status={filtroRun} onStatus={setFiltroRun} nodeFilter={filtroNode} onClearNode={() => setFiltroNode(null)}
            nomeBloco={nomeBloco} onVerBloco={verBloco} counts={stats?.status || {}} canEdit={canEdit} refreshKey={refreshRuns} onChanged={loadStats} />
        </div>
      )}

      {/* testar */}
      <Dialog open={teste} onOpenChange={setTeste}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Testar com um lead</DialogTitle>
            <DialogDescription>
              Simular percorre o fluxo inteiro sem enviar nem alterar nada, e mostra o que cada bloco faria. Rodar de verdade executa tudo: mensagem sai, tarefa é criada, etapa muda.
            </DialogDescription>
          </DialogHeader>
          <div className="relative"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8" autoFocus placeholder="Nome, telefone ou empresa" value={buscaLead} onChange={(e) => setBuscaLead(e.target.value)} /></div>
          <div className="max-h-[320px] overflow-y-auto rounded border border-border divide-y divide-border">
            {leads.map((l) => (
              <div key={l.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{l.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{[l.company, l.phone].filter(Boolean).join(" · ") || "sem telefone"}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1 shrink-0" disabled={testando} onClick={() => rodarTeste(l.id, l.name, true)}><FlaskConical className="h-3.5 w-3.5" /> Simular</Button>
                {canEdit && <Button size="sm" variant="ghost" className="shrink-0 text-destructive hover:text-destructive" disabled={testando} onClick={() => rodarTeste(l.id, l.name, false)}>Rodar de verdade</Button>}
              </div>
            ))}
            {!leads.length && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum lead encontrado.</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTeste(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* confirmar ativação */}
      <Dialog open={confirmarAtivar} onOpenChange={setConfirmarAtivar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ativar "{meta.name}"?</DialogTitle>
            <DialogDescription>A partir de agora, todo caso de "{triggerLabel(meta.trigger_type)}" que passar pelos filtros entra no fluxo sozinho.</DialogDescription>
          </DialogHeader>
          <ul className="text-xs text-foreground space-y-1.5 list-disc pl-4">
            {mandaWhats && <li><b>Este fluxo manda WhatsApp pra lead.</b> Simule com um lead antes e confira o número que envia.</li>}
            {meta.trigger_config?.only_new === false && <li><b>Vai pegar também o passado</b> (50 casos por varredura), não só o que acontecer daqui pra frente.</li>}
            {meta.trigger_config?.include_bulk && <li><b>Importação e ação em massa também disparam.</b></li>}
            {!meta.filters?.pipeline_id && <li>Sem filtro de funil: vale pra todos os funis do CRM.</li>}
            <li>Pra parar tudo de uma vez, é só desligar: ninguém novo entra e nada sai da fila de envio.</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarAtivar(false)}>Cancelar</Button>
            <Button onClick={() => aplicarAtivo(true)} disabled={saving}>Ativar fluxo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function FluxoEditor({ id, canEdit }: { id: string; canEdit: boolean }) {
  return <ReactFlowProvider><Editor key={id} id={id} canEdit={canEdit} /></ReactFlowProvider>;
}
