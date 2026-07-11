import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, Building2, ExternalLink, Loader2, Network, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface GNode {
  id: string; // `${project_id}:${node_key}` ou `c:${project_id}`
  project_id: string;
  node_key: string;
  label: string;
  kind: string; // 'empresa' pros nós de cliente
  weight: number;
  resumo?: string | null;
  evidencias?: { fonte: string; quem?: string | null; quando?: string | null; trecho: string }[];
  company?: string;
}

interface GEdge {
  source: string;
  target: string;
  weight?: number;
  why?: string;
}

interface SimNode extends GNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const KIND_META: Record<string, { label: string; color: string }> = {
  empresa: { label: "Clientes", color: "#f8fafc" },
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
const TOP_PER_COMPANY = 8;
const H = 620;

const posCache = new Map<string, { x: number; y: number }>();

export default function GlobalGraphPage() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<{ id: string; company: string }[]>([]);
  const [rawNodes, setRawNodes] = useState<any[]>([]);
  const [rawEdges, setRawEdges] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [semanticHits, setSemanticHits] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<{ nodes: SimNode[]; byId: Map<string, SimNode> }>({ nodes: [], byId: new Map() });
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const hoverRef = useRef<string | null>(null);
  const dragRef = useRef<{ node: SimNode | null; panning: boolean; lastX: number; lastY: number }>({
    node: null, panning: false, lastX: 0, lastY: 0,
  });
  const alphaRef = useRef(1);
  const matchedRef = useRef<Set<string> | null>(null);
  const pinnedRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);

  useEffect(() => { pinnedRef.current = pinnedId; }, [pinnedId]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  // Papel: master/admin (tudo) e consultant (os dele); resto não entra
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAllowed(false); return; }
      const { data: staff } = await (supabase as any)
        .from("onboarding_staff")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      setAllowed(!!staff && ["master", "admin", "consultant"].includes(staff.role));
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("graph-engine", { body: { action: "global" } });
      if (error || (data as any)?.error) throw error || new Error((data as any).error);
      setProjects((data as any).projects || []);
      setRawNodes((data as any).nodes || []);
      setRawEdges((data as any).edges || []);
    } catch (e) {
      console.error("grafo geral:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  // Busca semântica na carteira toda
  useEffect(() => {
    const term = search.trim();
    if (term.length < 3) { setSemanticHits(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase.functions.invoke("graph-engine", {
          body: { action: "search", query: term, limit: 25 },
        });
        setSemanticHits(((data as any)?.hits || []).filter((h: any) => Number(h.similarity) >= 0.3));
      } catch {
        setSemanticHits(null);
      } finally {
        setSearching(false);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [search]);

  // Monta o grafo exibido: empresas + top nós por empresa (+ hits da busca)
  const { nodes, edges } = useMemo(() => {
    const companyById = new Map(projects.map((p) => [p.id, p.company]));
    const byProject = new Map<string, any[]>();
    for (const n of rawNodes) {
      const list = byProject.get(n.project_id) || [];
      list.push(n);
      byProject.set(n.project_id, list);
    }
    const shown = new Map<string, GNode>();
    const gEdges: GEdge[] = [];

    for (const p of projects) {
      const topicCount = (byProject.get(p.id) || []).length;
      shown.set(`c:${p.id}`, {
        id: `c:${p.id}`,
        project_id: p.id,
        node_key: "__company",
        label: p.company,
        kind: "empresa",
        weight: 10,
        resumo: `${topicCount} registros no grafo deste cliente`,
        company: p.company,
      });
    }

    const addTopic = (n: any) => {
      const id = `${n.project_id}:${n.node_key}`;
      if (shown.has(id)) return;
      shown.set(id, {
        id,
        project_id: n.project_id,
        node_key: n.node_key,
        label: n.label,
        kind: n.kind,
        weight: n.weight,
        resumo: n.resumo,
        evidencias: n.evidencias,
        company: companyById.get(n.project_id),
      });
      gEdges.push({ source: `c:${n.project_id}`, target: id, weight: 2 });
    };

    for (const [pid, list] of byProject) {
      if (!companyById.has(pid)) continue;
      [...list]
        .sort((a, b) => (b.weight || 0) - (a.weight || 0))
        .slice(0, TOP_PER_COMPANY)
        .forEach(addTopic);
    }
    // hits da busca semântica entram mesmo fora do top
    for (const h of semanticHits || []) {
      if (companyById.has(h.project_id)) addTopic(h);
    }
    // arestas reais entre nós exibidos
    for (const e of rawEdges) {
      const s = `${e.project_id}:${e.source_key}`;
      const t = `${e.project_id}:${e.target_key}`;
      if (shown.has(s) && shown.has(t)) gEdges.push({ source: s, target: t, weight: e.weight, why: e.why });
    }
    return { nodes: [...shown.values()], edges: gEdges };
  }, [projects, rawNodes, rawEdges, semanticHits]);

  // Conjunto de nós destacados pela busca (lexical + semântica)
  const matchedIds = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return null;
    const set = new Set<string>();
    for (const n of nodes) {
      if (n.kind === "empresa") continue;
      const hay = `${n.label} ${n.resumo || ""} ${n.company || ""}`.toLowerCase();
      if (hay.includes(term)) set.add(n.id);
    }
    for (const h of semanticHits || []) set.add(`${h.project_id}:${h.node_key}`);
    return set;
  }, [search, nodes, semanticHits]);

  const neighbors = useMemo(() => {
    const map = new Map<string, { id: string; why?: string }[]>();
    for (const e of edges) {
      (map.get(e.source) || map.set(e.source, []).get(e.source)!).push({ id: e.target, why: e.why });
      (map.get(e.target) || map.set(e.target, []).get(e.target)!).push({ id: e.source, why: e.why });
    }
    return map;
  }, [edges]);

  useEffect(() => {
    matchedRef.current = matchedIds;
    alphaRef.current = Math.max(alphaRef.current, 0.05);
    if (matchedIds && matchedIds.size > 0 && wrapRef.current) {
      const ms = simRef.current.nodes.filter((n) => matchedIds.has(n.id));
      if (ms.length) {
        const xs = ms.map((n) => n.x), ys = ms.map((n) => n.y);
        const minX = Math.min(...xs) - 100, maxX = Math.max(...xs) + 100;
        const minY = Math.min(...ys) - 100, maxY = Math.max(...ys) + 100;
        const W = wrapRef.current.clientWidth;
        const scale = Math.min(Math.max(Math.min(W / (maxX - minX), H / (maxY - minY)), 0.35), 1.5);
        viewRef.current = {
          scale,
          x: W / 2 - ((minX + maxX) / 2) * scale,
          y: H / 2 - ((minY + maxY) / 2) * scale,
        };
      }
    }
  }, [matchedIds]);

  // (Re)inicializa a simulação
  useEffect(() => {
    if (!nodes.length) return;
    const W = wrapRef.current?.clientWidth || 1200;
    let hits = 0;
    const sim: SimNode[] = nodes.map((n, i) => {
      const cached = posCache.get(n.id);
      if (cached) hits++;
      const angle = (i / nodes.length) * Math.PI * 2;
      const rad = 180 + ((i * 7919) % 320);
      return {
        ...n,
        x: cached?.x ?? W / 2 + Math.cos(angle) * rad,
        y: cached?.y ?? H / 2 + Math.sin(angle) * rad,
        vx: 0, vy: 0,
        r: n.kind === "empresa" ? 14 : 5 + Math.min(Math.max(n.weight || 3, 1), 10) * 1.1,
      };
    });
    simRef.current = { nodes: sim, byId: new Map(sim.map((n) => [n.id, n])) };
    alphaRef.current = hits >= sim.length * 0.8 ? 0.03 : 1;
  }, [nodes]);

  // Loop física + render (mesma engine do grafo do projeto, escala maior)
  useEffect(() => {
    if (!nodes.length) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = wrap.clientWidth * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${wrap.clientWidth}px`;
      canvas.style.height = `${H}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const tick = () => {
      const { nodes: sim, byId } = simRef.current;
      const alpha = alphaRef.current;

      if (alpha > 0.005) {
        for (let i = 0; i < sim.length; i++) {
          const a = sim[i];
          for (let j = i + 1; j < sim.length; j++) {
            const b = sim[j];
            let dx = a.x - b.x, dy = a.y - b.y;
            let d2 = dx * dx + dy * dy;
            if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
            if (d2 > 90000) continue; // repulsão local (performance com 400+ nós)
            const f = (2200 * alpha) / d2;
            const d = Math.sqrt(d2);
            a.vx += (dx / d) * f; a.vy += (dy / d) * f;
            b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
          }
        }
        for (const e of edges) {
          const a = byId.get(e.source), b = byId.get(e.target);
          if (!a || !b) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const rest = 70 + (a.r + b.r);
          const f = ((d - rest) / d) * 0.04 * alpha * Math.min(e.weight || 1, 4);
          a.vx += dx * f; a.vy += dy * f;
          b.vx -= dx * f; b.vy -= dy * f;
        }
        const cx = (wrap.clientWidth || 1200) / 2, cy = H / 2;
        for (const n of sim) {
          n.vx += (cx - n.x) * 0.0015 * alpha;
          n.vy += (cy - n.y) * 0.0015 * alpha;
          if (dragRef.current.node !== n) {
            n.vx *= 0.85; n.vy *= 0.85;
            n.x += n.vx; n.y += n.vy;
          }
        }
        alphaRef.current = Math.max(alpha * 0.99, dragRef.current.node ? 0.3 : 0.004);
        if (alphaRef.current <= 0.006) {
          for (const n of sim) posCache.set(n.id, { x: n.x, y: n.y });
        }
      }

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
        if (matched && !matched.has(id) && !id.startsWith("c:")) return true;
        if (focusId && !focusSet.has(id)) return true;
        return false;
      };

      for (const e of edges) {
        const a = byId.get(e.source), b = byId.get(e.target);
        if (!a || !b) continue;
        const onFocus = focusId && (e.source === focusId || e.target === focusId);
        const dim = dimOf(e.source) || dimOf(e.target);
        ctx.strokeStyle = onFocus ? "rgba(148,163,184,0.9)" : dim ? "rgba(148,163,184,0.04)" : "rgba(148,163,184,0.16)";
        ctx.lineWidth = (onFocus ? 1.6 : 0.7) / view.scale;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (const n of simRef.current.nodes) {
        const dim = dimOf(n.id);
        const isFocus = n.id === focusId;
        const isMatch = matched?.has(n.id);
        const color = kindColor(n.kind);
        ctx.globalAlpha = dim ? 0.14 : 1;
        if ((isFocus || isMatch) && !dim) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + (isMatch ? 11 : 6), 0, Math.PI * 2);
          ctx.fillStyle = color + (isMatch ? "44" : "33");
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (n.kind === "empresa") {
          ctx.strokeStyle = "rgba(148,163,184,0.6)";
          ctx.lineWidth = 1.5 / view.scale;
          ctx.stroke();
        }
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
        const showLabel =
          !dim && (isFocus || isMatch || n.kind === "empresa" || view.scale > 1.1);
        if (showLabel) {
          ctx.font = `${n.kind === "empresa" ? "bold " : ""}${Math.max(11 / view.scale, 8)}px Inter, sans-serif`;
          ctx.fillStyle = n.kind === "empresa" ? "rgba(248,250,252,0.95)" : "rgba(226,232,240,0.9)";
          ctx.textAlign = "center";
          ctx.fillText(
            n.kind === "empresa" ? n.label : n.label.length > 34 ? n.label.slice(0, 33) + "…" : n.label,
            n.x,
            n.y + n.r + 12 / view.scale,
          );
        }
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const toWorld = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const view = viewRef.current;
      return {
        x: (ev.clientX - rect.left - view.x) / view.scale,
        y: (ev.clientY - rect.top - view.y) / view.scale,
      };
    };
    const nodeAt = (wx: number, wy: number) => {
      const sim = simRef.current.nodes;
      for (let i = sim.length - 1; i >= 0; i--) {
        const n = sim[i];
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
        alphaRef.current = Math.max(alphaRef.current, 0.25);
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
        setPinnedId(drag.node.id);
        setSelectedId(drag.node.id);
      } else if (!drag.node && drag.panning && moved < 4) {
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
      const next = Math.min(Math.max(view.scale * factor, 0.2), 4);
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
  }, [nodes, edges, neighbors]);

  const selected = selectedId ? nodes.find((n) => n.id === selectedId) || null : null;
  const selectedNeighbors = selectedId ? neighbors.get(selectedId) || [] : [];

  if (allowed === false) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Network className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">O Grafo Geral é restrito a master, admin e consultores.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1500px] mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" /> Grafo Geral da Carteira
          </h1>
          <p className="text-xs text-muted-foreground">
            Todos os clientes num só mapa — busca semântica encontra por significado, em qualquer cliente
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Building2 className="h-3 w-3" /> {projects.length} clientes · {nodes.length - projects.length} registros
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Busca semântica: tema, dor, decisão, pessoa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        {matchedIds && (
          <Badge variant="secondary" className="text-[10px]">
            {matchedIds.size} registro{matchedIds.size !== 1 ? "s" : ""} em{" "}
            {new Set([...matchedIds].map((id) => id.split(":")[0])).size} cliente(s)
          </Badge>
        )}
        <div className="flex flex-wrap gap-1.5 ml-auto">
          {Object.entries(KIND_META).map(([k, meta]) => (
            <span key={k} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border/60 text-[11px]">
              <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
              {meta.label}
            </span>
          ))}
        </div>
      </div>

      {/* Hits da busca semântica */}
      {semanticHits && semanticHits.length > 0 && (
        <div className="rounded-lg border border-border divide-y divide-border max-h-52 overflow-y-auto">
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30 sticky top-0">
            Encontrado por significado ({semanticHits.length})
          </div>
          {semanticHits.map((h, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2 hover:bg-muted/40 transition-colors"
              onClick={() => {
                setPinnedId(`${h.project_id}:${h.node_key}`);
                setSelectedId(`${h.project_id}:${h.node_key}`);
              }}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: kindColor(h.kind) }} />
                <span className="font-medium">{h.label}</span>
                <Badge variant="outline" className="text-[9px] h-4 px-1">{h.company_name}</Badge>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {Math.round(Number(h.similarity) * 100)}%
                </span>
              </div>
              {h.resumo && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{h.resumo}</p>}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Montando o grafo da carteira...
        </div>
      ) : nodes.length <= projects.length ? (
        <div className="border border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          <Network className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum cliente tem grafo gerado ainda.</p>
          <p className="mt-1">Abra um projeto → aba Grafo → "Gerar grafo". Os clientes aparecem aqui conforme os grafos existirem.</p>
        </div>
      ) : (
        <div ref={wrapRef} className="relative rounded-xl overflow-hidden border border-border">
          <canvas ref={canvasRef} className="block cursor-grab" />
          <div className="absolute bottom-2 right-3 text-[10px] text-slate-400/70 pointer-events-none">
            arraste os nós · role pra zoom · clique fixa as conexões
          </div>
        </div>
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
                <div className="flex items-center justify-between gap-2">
                  {selected.company && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Building2 className="h-3 w-3" /> {selected.company}
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 ml-auto"
                    onClick={() => window.open(`#/onboarding-tasks/${selected.project_id}`, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" /> Abrir projeto
                  </Button>
                </div>
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
                        const node = nodes.find((n) => n.id === nb.id);
                        if (!node) return null;
                        return (
                          <button
                            key={nb.id}
                            title={nb.why}
                            onClick={() => { setSelectedId(nb.id); setPinnedId(nb.id); }}
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded-full border border-border text-xs hover:bg-muted transition-colors",
                            )}
                          >
                            <span className="h-2 w-2 rounded-full" style={{ background: kindColor(node.kind) }} />
                            {node.label.length > 30 ? node.label.slice(0, 29) + "…" : node.label}
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
}
