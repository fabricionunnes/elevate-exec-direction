import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Network, RefreshCw, Search, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  userRole: string;
}

interface GraphNode {
  id: string;
  label: string;
  kind: string;
  weight: number;
  resumo?: string;
  evidencias?: { fonte: string; quem?: string | null; quando?: string | null; trecho: string }[];
}

interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
  why?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  resumo?: string;
}

/** Nó vivo da simulação (posição/velocidade mutáveis, fora do React). */
interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const KIND_META: Record<string, { label: string; color: string }> = {
  pessoa: { label: "Pessoas", color: "#60a5fa" },
  tema: { label: "Temas", color: "#a78bfa" },
  dor: { label: "Dores", color: "#f87171" },
  decisao: { label: "Decisões", color: "#34d399" },
  meta: { label: "Metas", color: "#fbbf24" },
  risco: { label: "Riscos", color: "#fb7185" },
  produto: { label: "Produtos", color: "#22d3ee" },
  evento: { label: "Eventos", color: "#e879f9" },
};

const FONTE_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  reuniao: "Reunião",
  tarefa: "Tarefa",
  briefing: "Briefing",
  grade: "Grade",
  kpi: "KPI",
  nps: "NPS",
  cerebro: "Cérebro",
};

const kindColor = (kind: string) => KIND_META[kind]?.color || "#94a3b8";

// Posições persistem entre remontagens do painel (a página do projeto
// re-renderiza com frequência) — senão o grafo "flutua" eternamente.
const posCache = new Map<string, { x: number; y: number }>();

export const ProjectGraphPanel = ({ projectId, userRole }: Props) => {
  const isStaff = userRole !== "client";
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [search, setSearch] = useState("");
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // pin: clicou num nó, as conexões ficam fixas destacadas até clicar no vazio
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [meetingHits, setMeetingHits] = useState<
    { title: string; date: string | null; snippet: string }[]
  >([]);
  const [searchingMeetings, setSearchingMeetings] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<{ nodes: SimNode[]; byId: Map<string, SimNode> }>({ nodes: [], byId: new Map() });
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const hoverRef = useRef<string | null>(null);
  const dragRef = useRef<{ node: SimNode | null; panning: boolean; lastX: number; lastY: number }>({
    node: null, panning: false, lastX: 0, lastY: 0,
  });
  const alphaRef = useRef(1);
  const searchRef = useRef("");
  const hiddenRef = useRef<Set<string>>(new Set());
  const selectedRef = useRef<string | null>(null);
  const pinnedRef = useRef<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // A geração roda em background na edge function; o painel acompanha a tabela.
  const startPolling = useCallback(() => {
    stopPolling();
    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > 5 * 60 * 1000) {
        stopPolling();
        setBuilding(false);
        toast.error("A geração demorou demais — tente de novo");
        return;
      }
      const { data } = await (supabase as any)
        .from("project_graph")
        .select("graph, generated_at")
        .eq("project_id", projectId)
        .maybeSingle();
      const g = data?.graph as any;
      if (g && !g.building) {
        stopPolling();
        setBuilding(false);
        if (g.error) {
          toast.error(`Erro ao gerar grafo: ${g.error}`);
          return;
        }
        setGraph(g as GraphData);
        setGeneratedAt(data.generated_at);
        toast.success("Grafo pronto");
      }
    }, 5000);
  }, [projectId, stopPolling]);

  // Carrega o grafo salvo (sem disparar IA)
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("project_graph")
        .select("graph, generated_at")
        .eq("project_id", projectId)
        .maybeSingle();
      const g = data?.graph as any;
      if (g?.building) {
        setBuilding(true);
        startPolling();
      } else if (g && !g.error && Array.isArray(g.nodes)) {
        setGraph(g as GraphData);
        setGeneratedAt(data.generated_at);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, startPolling]);

  useEffect(() => {
    load();
    return stopPolling;
  }, [load, stopPolling]);

  const build = async (force: boolean) => {
    setBuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke("graph-engine", {
        body: { projectId, force },
      });
      if (error) {
        let msg = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* mantém genérica */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.building) {
        // gerando em background — acompanha na tabela
        startPolling();
        return;
      }
      setGraph((data as any).graph as GraphData);
      setGeneratedAt((data as any).generatedAt || (data as any).generated_at || new Date().toISOString());
      setBuilding(false);
      toast.success("Grafo atualizado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar grafo");
      setBuilding(false);
    }
  };

  // Índice de adjacência
  const neighbors = useMemo(() => {
    const map = new Map<string, { id: string; why?: string }[]>();
    for (const e of graph?.edges || []) {
      (map.get(e.source) || map.set(e.source, []).get(e.source)!).push({ id: e.target, why: e.why });
      (map.get(e.target) || map.set(e.target, []).get(e.target)!).push({ id: e.source, why: e.why });
    }
    return map;
  }, [graph]);

  // Busca: ids que casam com o termo (label, resumo, evidências)
  const matchedIds = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return null;
    const set = new Set<string>();
    for (const n of graph?.nodes || []) {
      const hay = [
        n.label, n.resumo || "",
        ...(n.evidencias || []).map((ev) => `${ev.trecho} ${ev.quem || ""}`),
      ].join(" ").toLowerCase();
      if (hay.includes(term)) set.add(n.id);
    }
    return set;
  }, [search, graph]);
  // Busca SEMÂNTICA (embeddings): acha por significado, não só por letra
  const [semanticIds, setSemanticIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    const term = search.trim();
    if (term.length < 3 || !isStaff) {
      setSemanticIds(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("graph-engine", {
          body: { action: "search", query: term, projectId, limit: 12 },
        });
        const hits = ((data as any)?.hits || []) as any[];
        setSemanticIds(new Set(hits.filter((h) => Number(h.similarity) >= 0.34).map((h) => String(h.node_key))));
      } catch {
        setSemanticIds(null);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [search, projectId, isStaff]);

  const combinedMatched = useMemo(() => {
    if (!matchedIds && !semanticIds) return null;
    return new Set<string>([...(matchedIds || []), ...(semanticIds || [])]);
  }, [matchedIds, semanticIds]);

  const matchedRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    matchedRef.current = combinedMatched;
    alphaRef.current = Math.max(alphaRef.current, 0.05);
    // centraliza a câmera nos nós encontrados
    if (combinedMatched && combinedMatched.size > 0 && wrapRef.current) {
      const nodes = simRef.current.nodes.filter((n) => combinedMatched.has(n.id));
      if (nodes.length) {
        const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
        const minX = Math.min(...xs) - 80, maxX = Math.max(...xs) + 80;
        const minY = Math.min(...ys) - 80, maxY = Math.max(...ys) + 80;
        const W = wrapRef.current.clientWidth, H = 560;
        const scale = Math.min(Math.max(Math.min(W / (maxX - minX), H / (maxY - minY)), 0.5), 1.6);
        viewRef.current = {
          scale,
          x: W / 2 - ((minX + maxX) / 2) * scale,
          y: H / 2 - ((minY + maxY) / 2) * scale,
        };
      }
    }
  }, [combinedMatched]);
  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { hiddenRef.current = hiddenKinds; alphaRef.current = Math.max(alphaRef.current, 0.05); }, [hiddenKinds]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { pinnedRef.current = pinnedId; }, [pinnedId]);

  // Busca nas transcrições: o que foi falado sobre o termo nas reuniões
  useEffect(() => {
    const term = search.trim();
    if (term.length < 3) {
      setMeetingHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingMeetings(true);
      try {
        const like = `%${term.replace(/[%_]/g, "")}%`;
        const { data } = await (supabase as any)
          .from("onboarding_meeting_notes")
          .select("meeting_title, meeting_date, transcript, notes")
          .eq("project_id", projectId)
          .or(`transcript.ilike.${like},notes.ilike.${like}`)
          .order("meeting_date", { ascending: false })
          .limit(6);
        const lower = term.toLowerCase();
        const hits = ((data || []) as any[]).map((m) => {
          const text: string = m.transcript || m.notes || "";
          const idx = text.toLowerCase().indexOf(lower);
          const start = Math.max(0, idx - 130);
          const end = Math.min(text.length, idx + term.length + 170);
          const snippet = (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
          return { title: m.meeting_title || "Reunião", date: m.meeting_date, snippet };
        });
        setMeetingHits(hits);
      } finally {
        setSearchingMeetings(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [search, projectId]);

  // (Re)constrói a simulação quando o grafo muda
  useEffect(() => {
    if (!graph?.nodes?.length) return;
    const W = wrapRef.current?.clientWidth || 900;
    const H = 560;
    let cacheHits = 0;
    const nodes: SimNode[] = graph.nodes.map((n, i) => {
      const cached = posCache.get(`${projectId}:${n.id}`);
      if (cached) cacheHits++;
      const angle = (i / graph.nodes.length) * Math.PI * 2;
      const rad = 120 + ((i * 7919) % 160); // determinístico, sem salto a cada remontagem
      return {
        ...n,
        x: cached?.x ?? W / 2 + Math.cos(angle) * rad,
        y: cached?.y ?? H / 2 + Math.sin(angle) * rad,
        vx: 0, vy: 0,
        r: 6 + Math.min(Math.max(n.weight || 3, 1), 10) * 1.5,
      };
    });
    simRef.current = { nodes, byId: new Map(nodes.map((n) => [n.id, n])) };
    viewRef.current = { x: 0, y: 0, scale: 1 };
    // remontou com layout já assentado → não reaquece
    alphaRef.current = cacheHits >= nodes.length * 0.8 ? 0.02 : 1;
  }, [graph, projectId]);

  // Loop: física + render
  useEffect(() => {
    if (!graph?.nodes?.length) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = wrap.clientWidth * dpr;
      canvas.height = 560 * dpr;
      canvas.style.width = `${wrap.clientWidth}px`;
      canvas.style.height = "560px";
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const edges = graph.edges || [];

    const tick = () => {
      const { nodes, byId } = simRef.current;
      const hidden = hiddenRef.current;
      const visible = nodes.filter((n) => !hidden.has(n.kind));
      const alpha = alphaRef.current;

      // ── física ──
      if (alpha > 0.005) {
        for (let i = 0; i < visible.length; i++) {
          const a = visible[i];
          for (let j = i + 1; j < visible.length; j++) {
            const b = visible[j];
            let dx = a.x - b.x, dy = a.y - b.y;
            let d2 = dx * dx + dy * dy;
            if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
            const f = (2600 * alpha) / d2;
            const d = Math.sqrt(d2);
            a.vx += (dx / d) * f; a.vy += (dy / d) * f;
            b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
          }
        }
        for (const e of edges) {
          const a = byId.get(e.source), b = byId.get(e.target);
          if (!a || !b || hidden.has(a.kind) || hidden.has(b.kind)) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const rest = 90 + (a.r + b.r);
          const f = ((d - rest) / d) * 0.045 * alpha * Math.min(e.weight || 1, 5);
          a.vx += dx * f; a.vy += dy * f;
          b.vx -= dx * f; b.vy -= dy * f;
        }
        const cx = (wrap.clientWidth || 900) / 2, cy = 280;
        for (const n of visible) {
          n.vx += (cx - n.x) * 0.0025 * alpha;
          n.vy += (cy - n.y) * 0.0025 * alpha;
          if (dragRef.current.node !== n) {
            n.vx *= 0.85; n.vy *= 0.85;
            n.x += n.vx; n.y += n.vy;
          }
        }
        alphaRef.current = Math.max(alpha * 0.99, dragRef.current.node ? 0.3 : 0.004);
        if (alphaRef.current <= 0.006) {
          for (const n of simRef.current.nodes) posCache.set(`${projectId}:${n.id}`, { x: n.x, y: n.y });
        }
      }

      // ── render ──
      const dpr = window.devicePixelRatio || 1;
      const view = viewRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#070b16";
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.translate(view.x, view.y);
      ctx.scale(view.scale, view.scale);

      const hover = hoverRef.current;
      const selected = selectedRef.current;
      const matched = matchedRef.current;
      const focusId = hover || selected || pinnedRef.current;
      const focusSet = new Set<string>();
      if (focusId) {
        focusSet.add(focusId);
        for (const nb of neighbors.get(focusId) || []) focusSet.add(nb.id);
      }
      const dimOf = (id: string) => {
        if (matched && !matched.has(id)) return true;
        if (focusId && !focusSet.has(id)) return true;
        return false;
      };

      for (const e of edges) {
        const a = byId.get(e.source), b = byId.get(e.target);
        if (!a || !b || hidden.has(a.kind) || hidden.has(b.kind)) continue;
        const onFocus = focusId && (e.source === focusId || e.target === focusId);
        const dim = dimOf(e.source) || dimOf(e.target);
        ctx.strokeStyle = onFocus ? "rgba(148,163,184,0.85)" : dim ? "rgba(148,163,184,0.06)" : "rgba(148,163,184,0.22)";
        ctx.lineWidth = (onFocus ? 1.6 : 0.8) / view.scale;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (const n of simRef.current.nodes) {
        if (hidden.has(n.kind)) continue;
        const dim = dimOf(n.id);
        const isFocus = n.id === focusId;
        const isMatch = matched?.has(n.id);
        const color = kindColor(n.kind);
        ctx.globalAlpha = dim ? 0.15 : 1;
        if ((isFocus || isMatch) && !dim) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + (isMatch ? 12 : 6), 0, Math.PI * 2);
          ctx.fillStyle = color + (isMatch ? "44" : "33");
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (isMatch && !dim) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2.5 / view.scale;
          ctx.stroke();
        }
        if (n.id === selected || n.id === pinnedRef.current) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2 / view.scale;
          ctx.stroke();
        }
        const showLabel = !dim && (isFocus || isMatch || view.scale > 0.9 || n.weight >= 7);
        if (showLabel) {
          ctx.font = `${Math.max(11 / view.scale, 8)}px Inter, sans-serif`;
          ctx.fillStyle = dim ? "rgba(226,232,240,0.2)" : "rgba(226,232,240,0.92)";
          ctx.textAlign = "center";
          ctx.fillText(n.label, n.x, n.y + n.r + 12 / view.scale);
        }
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // ── interações ──
    const toWorld = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const view = viewRef.current;
      return {
        x: (ev.clientX - rect.left - view.x) / view.scale,
        y: (ev.clientY - rect.top - view.y) / view.scale,
      };
    };
    const nodeAt = (wx: number, wy: number) => {
      const hidden = hiddenRef.current;
      const nodes = simRef.current.nodes;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (hidden.has(n.kind)) continue;
        const dx = n.x - wx, dy = n.y - wy;
        if (dx * dx + dy * dy <= (n.r + 4) * (n.r + 4)) return n;
      }
      return null;
    };

    const onDown = (ev: MouseEvent) => {
      const { x, y } = toWorld(ev);
      const n = nodeAt(x, y);
      if (n) {
        dragRef.current = { node: n, panning: false, lastX: ev.clientX, lastY: ev.clientY };
        alphaRef.current = Math.max(alphaRef.current, 0.3);
      } else {
        dragRef.current = { node: null, panning: true, lastX: ev.clientX, lastY: ev.clientY };
      }
    };
    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (drag.node) {
        const view = viewRef.current;
        drag.node.x += (ev.clientX - drag.lastX) / view.scale;
        drag.node.y += (ev.clientY - drag.lastY) / view.scale;
        drag.node.vx = 0; drag.node.vy = 0;
        drag.lastX = ev.clientX; drag.lastY = ev.clientY;
      } else if (drag.panning) {
        viewRef.current.x += ev.clientX - drag.lastX;
        viewRef.current.y += ev.clientY - drag.lastY;
        drag.lastX = ev.clientX; drag.lastY = ev.clientY;
      } else {
        const { x, y } = toWorld(ev);
        const n = nodeAt(x, y);
        hoverRef.current = n?.id || null;
        canvas.style.cursor = n ? "pointer" : "grab";
      }
    };
    const onUp = (ev: MouseEvent) => {
      const drag = dragRef.current;
      const moved = Math.abs(ev.clientX - drag.lastX) + Math.abs(ev.clientY - drag.lastY);
      if (drag.node && moved < 4) {
        // clique no nó: fixa as conexões e abre o detalhe
        setPinnedId(drag.node.id);
        setSelectedId(drag.node.id);
      } else if (!drag.node && drag.panning && moved < 4) {
        // clique no vazio: solta o pin
        setPinnedId(null);
      }
      dragRef.current = { node: null, panning: false, lastX: 0, lastY: 0 };
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const view = viewRef.current;
      const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
      const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      const next = Math.min(Math.max(view.scale * factor, 0.25), 4);
      view.x = mx - ((mx - view.x) / view.scale) * next;
      view.y = my - ((my - view.y) / view.scale) * next;
      view.scale = next;
    };

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [graph, neighbors, projectId]);

  const selected = selectedId ? graph?.nodes.find((n) => n.id === selectedId) || null : null;
  const selectedNeighbors = selectedId ? neighbors.get(selectedId) || [] : [];

  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of graph?.nodes || []) counts.set(n.kind, (counts.get(n.kind) || 0) + 1);
    return counts;
  }, [graph]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando grafo...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" /> Grafo do Cliente
          </h3>
          <p className="text-xs text-muted-foreground">
            Tudo que o Nexus sabe deste cliente, conectado — clique num nó pra ver as evidências
          </p>
        </div>
        <div className="flex items-center gap-2">
          {generatedAt && (
            <span className="text-[11px] text-muted-foreground">
              gerado {format(new Date(generatedAt), "dd/MM HH:mm", { locale: ptBR })}
            </span>
          )}
          {isStaff && (
            <Button size="sm" className="gap-1.5" disabled={building} onClick={() => build(!!graph)}>
              {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : graph ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {graph ? "Atualizar grafo" : "Gerar grafo"}
            </Button>
          )}
        </div>
      </div>

      {!graph && building ? (
        <div className="border border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
          <p className="font-medium text-foreground">A IA está montando o grafo...</p>
          <p className="mt-1">Conectando conversas, reuniões, tarefas e briefing — leva 1 a 2 minutos.</p>
        </div>
      ) : !graph ? (
        <div className="border border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          <Network className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Este projeto ainda não tem grafo.</p>
          {isStaff && (
            <p className="mt-1">
              Clique em <span className="font-medium text-foreground">Gerar grafo</span> — a IA conecta conversas dos
              grupos, reuniões, tarefas, briefing e grade num mapa navegável.
            </p>
          )}
        </div>
      ) : (
        <>
          {graph.resumo && (
            <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-3">{graph.resumo}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Pesquisar tema, pessoa, dor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            {combinedMatched && (
              <Badge variant="secondary" className="text-[10px]">
                {combinedMatched.size} nó{combinedMatched.size !== 1 ? "s" : ""}
                {semanticIds && semanticIds.size > 0 && " · semântica"}
              </Badge>
            )}
            <div className="flex flex-wrap gap-1.5 ml-auto">
              {Object.entries(KIND_META)
                .filter(([k]) => (kindCounts.get(k) || 0) > 0)
                .map(([k, meta]) => {
                  const off = hiddenKinds.has(k);
                  return (
                    <button
                      key={k}
                      onClick={() => {
                        setHiddenKinds((prev) => {
                          const next = new Set(prev);
                          if (next.has(k)) next.delete(k);
                          else next.add(k);
                          return next;
                        });
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] transition-opacity",
                        off ? "opacity-35 border-border" : "border-border/80",
                      )}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                      {meta.label}
                      <span className="text-muted-foreground">{kindCounts.get(k)}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {search.trim().length >= 3 && (searchingMeetings || meetingHits.length > 0) && (
            <div className="rounded-lg border border-border divide-y divide-border">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30">
                {searchingMeetings ? "Buscando nas transcrições..." : `Falado nas reuniões (${meetingHits.length})`}
              </div>
              {meetingHits.map((h, i) => (
                <div key={i} className="px-3 py-2">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Reunião</Badge>
                    <span className="font-medium text-foreground">{h.title}</span>
                    {h.date && <span className="ml-auto">{format(new Date(h.date), "dd/MM/yy", { locale: ptBR })}</span>}
                  </div>
                  <p className="text-xs leading-snug mt-1 text-muted-foreground">{h.snippet}</p>
                </div>
              ))}
            </div>
          )}

          <div ref={wrapRef} className="relative rounded-xl overflow-hidden border border-border">
            <canvas ref={canvasRef} className="block cursor-grab" />
            <div className="absolute bottom-2 right-3 text-[10px] text-slate-400/70 pointer-events-none">
              arraste os nós · role pra zoom · clique pra abrir
            </div>
          </div>
        </>
      )}

      {/* Detalhe do nó */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-base">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: kindColor(selected.kind) }} />
                  {selected.label}
                  <Badge variant="outline" className="ml-auto text-[10px] capitalize">
                    {KIND_META[selected.kind]?.label || selected.kind}
                  </Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4 text-sm">
                {selected.resumo && <p className="text-muted-foreground">{selected.resumo}</p>}

                {(selected.evidencias?.length || 0) > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      O que foi falado
                    </h4>
                    {selected.evidencias!.map((ev, i) => (
                      <div key={i} className="rounded-lg border border-border p-2.5 space-y-1">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                            {FONTE_LABEL[ev.fonte] || ev.fonte}
                          </Badge>
                          {ev.quem && <span className="font-medium">{ev.quem}</span>}
                          {ev.quando && (
                            <span className="ml-auto">
                              {format(new Date(ev.quando), "dd/MM/yy", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-snug">"{ev.trecho}"</p>
                      </div>
                    ))}
                  </div>
                )}

                {selectedNeighbors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Conexões ({selectedNeighbors.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedNeighbors.map((nb) => {
                        const node = graph?.nodes.find((n) => n.id === nb.id);
                        if (!node) return null;
                        return (
                          <button
                            key={nb.id}
                            title={nb.why}
                            onClick={() => setSelectedId(nb.id)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border text-xs hover:bg-muted transition-colors"
                          >
                            <span className="h-2 w-2 rounded-full" style={{ background: kindColor(node.kind) }} />
                            {node.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
