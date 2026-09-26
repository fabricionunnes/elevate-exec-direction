// Editor de mapa mental (estilo MindMeister). Árvore em JSON na tabela mindmaps;
// React Flow desenha e cuida de zoom/pan/minimapa; o layout radial é nosso.
// Teclado: Tab = filho · Enter = irmão · Delete = apagar · F2/duplo clique = editar
//          Espaço = colapsar/expandir · Ctrl+Z / Ctrl+Shift+Z = desfazer/refazer
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position,
  type Node, type Edge, type NodeProps, useReactFlow, ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Save, Plus, Trash2, Undo2, Redo2, ChevronsUpDown, Palette, Download, LayoutTemplate } from "lucide-react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─────────────────────────── modelo ───────────────────────────
export interface MMNode {
  id: string;
  text: string;
  children: MMNode[];
  collapsed?: boolean;
  color?: string;
  note?: string;
}
type LayoutKind = "radial" | "right" | "tree";
interface MMData { root: MMNode; layout?: LayoutKind; theme?: string }

// temas de cor prontos (a cor de um ramo pode ser trocada por cima)
const THEMES: Record<string, { name: string; root: string; palette: string[] }> = {
  unv:     { name: "UNV",       root: "#0D2B5E", palette: ["#0D2B5E", "#CC1B1B", "#1B7F4B", "#B7791F", "#7C3AED", "#0E7490", "#BE185D", "#4B5563"] },
  vivid:   { name: "Vibrante",  root: "#111827", palette: ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"] },
  pastel:  { name: "Pastel",    root: "#475569", palette: ["#F87171", "#FBBF24", "#34D399", "#60A5FA", "#A78BFA", "#F472B6", "#2DD4BF", "#FB923C"] },
  mono:    { name: "Monocromo", root: "#111827", palette: ["#1F2937", "#374151", "#4B5563", "#6B7280", "#9CA3AF", "#374151", "#4B5563", "#6B7280"] },
  gold:    { name: "Mansão",    root: "#0A0A0A", palette: ["#C9A84C", "#E8D5A3", "#8B7332", "#C9A84C", "#E8D5A3", "#8B7332", "#C9A84C", "#E8D5A3"] },
};

const PALETTE = THEMES.unv.palette;
const uid = () => Math.random().toString(36).slice(2, 10);

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

function findNode(root: MMNode, id: string, parent: MMNode | null = null): { node: MMNode; parent: MMNode | null } | null {
  if (root.id === id) return { node: root, parent };
  for (const c of root.children) {
    const r = findNode(c, id, root);
    if (r) return r;
  }
  return null;
}

// ─────────────────────────── layout radial (dois lados) ───────────────────────────
// O nó cresce com o texto. Antes a caixa era fixa em 180px com truncate: frase
// longa virava "Quando o potencial cli…" e o mapa não servia pra ler nada.
const NODE_MIN_W = 130, NODE_MAX_W = 270, NODE_H = 40, GAP_X = 70, GAP_Y = 14;
const ROOT_MIN_W = 220, ROOT_MAX_W = 340, ROOT_H = 52;
// box-sizing: border-box — a largura do style já inclui padding E borda, então
// a conta precisa dos dois. Com 26 sobrava 2px e frase que cabia numa linha
// quebrava em duas sem precisar.
const PAD_X = 28;  // px-3 (12+12) + borda 2px de cada lado
const PAD_Y = 20;  // py-2 (8+8) + borda 2px de cada lado
const LINE_H = 18, ROOT_LINE_H = 21;
const FONTE = '13px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const FONTE_ROOT = '600 15px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

// Medir texto de verdade (canvas) em vez de chutar por número de caracteres:
// "Iiii" e "MMMM" têm o mesmo tamanho no chute e larguras bem diferentes na tela.
let _ctx: CanvasRenderingContext2D | null | undefined;
const _larguras = new Map<string, number>();
function larguraTexto(txt: string, fonte: string): number {
  const k = `${fonte}|${txt}`;
  const cache = _larguras.get(k);
  if (cache !== undefined) return cache;
  if (_ctx === undefined) _ctx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  // sem canvas (SSR, navegador antigo): estimativa grosseira, melhor que quebrar
  const w = _ctx ? (_ctx.font = fonte, _ctx.measureText(txt).width) : txt.length * 7;
  if (_larguras.size > 4000) _larguras.clear();
  _larguras.set(k, w);
  return w;
}

/** quantas linhas UM parágrafo ocupa quebrando em palavras dentro de maxW */
function contarLinhas(txt: string, maxW: number, fonte: string): number {
  const palavras = txt.split(/\s+/).filter(Boolean);
  if (!palavras.length) return 1;
  let linhas = 1, atual = "";
  for (const p of palavras) {
    const larguraP = larguraTexto(p, fonte);
    // palavra sozinha maior que a caixa: o CSS quebra no meio dela (break-words)
    if (larguraP > maxW) {
      if (atual) { linhas++; atual = ""; }
      linhas += Math.ceil(larguraP / maxW) - 1;
      continue;
    }
    const teste = atual ? `${atual} ${p}` : p;
    if (larguraTexto(teste, fonte) <= maxW) atual = teste;
    else { linhas++; atual = p; }
  }
  return linhas;
}

const _medidas = new Map<string, { w: number; h: number }>();
/** largura e altura que a caixa precisa ter pro texto caber inteiro */
function medida(n: MMNode, isRoot = false): { w: number; h: number } {
  const txt = n.text || "vazio";
  const k = `${isRoot ? "r" : "n"}|${txt}`;
  const cache = _medidas.get(k);
  if (cache) return cache;
  const fonte = isRoot ? FONTE_ROOT : FONTE;
  const minW = isRoot ? ROOT_MIN_W : NODE_MIN_W;
  const maxW = isRoot ? ROOT_MAX_W : NODE_MAX_W;
  const lineH = isRoot ? ROOT_LINE_H : LINE_H;
  const alturaMin = isRoot ? ROOT_H : NODE_H;
  // O texto pode ter quebra de linha própria (listas com traço, por exemplo) e
  // o CSS preserva ela (whitespace-pre-wrap). Medir tudo como um parágrafo só
  // contava linhas a menos: a caixa saía baixa, o texto era cortado embaixo e o
  // nó vizinho subia por cima. Cada parágrafo conta o seu wrap separado.
  const paragrafos = txt.split("\n");
  const maiorLinha = Math.max(...paragrafos.map((p) => larguraTexto(p, fonte)));
  const larguraIdeal = maiorLinha + PAD_X;
  const w = Math.min(maxW, Math.max(minW, Math.ceil(larguraIdeal)));
  const linhas = paragrafos.length === 1 && larguraIdeal <= maxW
    ? 1
    : paragrafos.reduce((soma, par) => soma + contarLinhas(par, w - PAD_X, fonte), 0);
  const m = { w, h: Math.max(alturaMin, linhas * lineH + PAD_Y) };
  if (_medidas.size > 4000) _medidas.clear();
  _medidas.set(k, m);
  return m;
}

/** altura total de um ramo (respeitando colapso) */
function subtreeHeight(n: MMNode): number {
  const propria = medida(n).h;
  if (n.collapsed || n.children.length === 0) return propria;
  const h = n.children.reduce((s, c) => s + subtreeHeight(c), 0) + GAP_Y * (n.children.length - 1);
  return Math.max(propria, h);
}

function layout(root: MMNode, kind: LayoutKind = "radial", theme = "unv") {
  const pal = (THEMES[theme] || THEMES.unv).palette;
  const rootColor = (THEMES[theme] || THEMES.unv).root;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const kids = root.collapsed ? [] : root.children;

  if (kind === "tree") {
    // organograma: raiz em cima, filhos abaixo, ramos descem
    const GY = 70;
    const W = (n: MMNode) => medida(n).w + 24;
    const width = (n: MMNode): number => (n.collapsed || !n.children.length) ? W(n)
      : Math.max(W(n), n.children.reduce((s, c) => s + width(c), 0));
    const mr = medida(root, true);
    nodes.push({ id: root.id, type: "mm", position: { x: -mr.w / 2, y: 0 }, data: { node: root, isRoot: true, depth: 0, side: 0, rootColor, w: mr.w, h: mr.h } });
    // o nível de baixo começa depois da altura REAL do pai: com caixa de três
    // linhas, a distância fixa fazia a linha do ramo entrar por cima do texto
    const place = (children: MMNode[], parent: MMNode, cx: number, py: number, parentH: number, depth: number, color?: string, idx = 0) => {
      const total = children.reduce((s, c) => s + width(c), 0);
      let x = cx - total / 2;
      children.forEach((c, i) => {
        const w = width(c);
        const ncx = x + w / 2;
        const m = medida(c);
        const ny = py + parentH + GY;
        const col = c.color || color || pal[(depth === 1 ? i : idx) % pal.length];
        nodes.push({ id: c.id, type: "mm", position: { x: ncx - m.w / 2, y: ny }, data: { node: c, isRoot: false, depth, side: 0, color: col, rootColor, w: m.w, h: m.h } });
        edges.push({ id: `${parent.id}-${c.id}`, source: parent.id, target: c.id, sourceHandle: "b", targetHandle: "t",
          type: "smoothstep", style: { stroke: col, strokeWidth: Math.max(1.5, 3.5 - depth * 0.7) } });
        if (!c.collapsed) place(c.children, c, ncx, ny, m.h, depth + 1, col, depth === 1 ? i : idx);
        x += w;
      });
    };
    place(kids, root, 0, 0, mr.h, 1);
    return { nodes, edges };
  }

  // radial (dois lados) ou direita (um lado só)
  const cx = 0, cy = 0;
  const mr = medida(root, true);
  nodes.push({ id: root.id, type: "mm", position: { x: cx - mr.w / 2, y: cy - mr.h / 2 },
    data: { node: root, isRoot: true, depth: 0, side: 0, rootColor, w: mr.w, h: mr.h } });
  const right = kind === "right" ? kids : kids.filter((_, i) => i % 2 === 0);
  const left = kind === "right" ? [] : kids.filter((_, i) => i % 2 === 1);

  // px é a BORDA do pai (direita no lado direito, esquerda no esquerdo), não o
  // centro: com caixa de largura variável, medir pelo centro empurrava nó largo
  // por cima do vizinho. Assim os irmãos começam todos na mesma coluna.
  const place = (children: MMNode[], side: 1 | -1, parent: MMNode, px: number, py: number, depth: number, color?: string, baseIdx = 0) => {
    if (!children.length) return;
    const total = children.reduce((s, c) => s + subtreeHeight(c), 0) + GAP_Y * (children.length - 1);
    let y = py - total / 2;
    children.forEach((c, i) => {
      const h = subtreeHeight(c);
      const ny = y + h / 2;
      const m = medida(c);
      const nx = side === 1 ? px + GAP_X : px - GAP_X - m.w;
      const col = c.color || color || pal[(baseIdx + i) % pal.length];
      nodes.push({ id: c.id, type: "mm", position: { x: nx, y: ny - m.h / 2 },
        data: { node: c, isRoot: false, depth, side, color: col, rootColor, w: m.w, h: m.h } });
      edges.push({ id: `${parent.id}-${c.id}`, source: parent.id, target: c.id,
        sourceHandle: side === 1 ? "r" : "l", targetHandle: side === 1 ? "l" : "r",
        type: "smoothstep", style: { stroke: col, strokeWidth: Math.max(1.5, 3.5 - depth * 0.7) } });
      if (!c.collapsed) place(c.children, side, c, side === 1 ? nx + m.w : nx, ny, depth + 1, col, baseIdx + i);
      y += h + GAP_Y;
    });
  };
  place(right, 1, root, cx + mr.w / 2, cy, 1, undefined, 0);
  place(left, -1, root, cx - mr.w / 2, cy, 1, undefined, right.length);
  return { nodes, edges };
}

// ─────────────────────────── nó visual ───────────────────────────
function MMNodeView({ id, data, selected }: NodeProps) {
  const d = data as any;
  const n: MMNode = d.node;
  const color: string = d.isRoot ? (d.rootColor || "#0D2B5E") : d.color;
  const editing = d.editingId === id;
  const [txt, setTxt] = useState(n.text);
  useEffect(() => setTxt(n.text), [n.text]);
  // se a edição começou por uma tecla (digitou em cima do nó), começa por ela
  useEffect(() => { if (editing && d.seed !== undefined) setTxt(d.seed === null ? n.text : d.seed); }, [editing]); // eslint-disable-line
  const hasKids = n.children.length > 0;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 shadow-sm px-3 flex items-center transition-shadow",
        d.isRoot ? "text-white font-semibold text-[15px]" : "bg-white text-[13px]",
        selected && "ring-2 ring-offset-2 ring-primary/60 shadow-md",
      )}
      style={{
        width: d.w ?? (d.isRoot ? ROOT_MIN_W : NODE_MIN_W),
        minHeight: d.h ?? (d.isRoot ? ROOT_H : NODE_H),
        borderColor: color, background: d.isRoot ? color : "#fff",
      }}
      onDoubleClick={(e) => { e.stopPropagation(); d.startEdit(id); }}
    >
      <Handle type="target" position={Position.Left} id="l" className="!opacity-0 !w-2 !h-2" />
      <Handle type="target" position={Position.Right} id="r" className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Left} id="l" className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="r" className="!opacity-0 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="t" className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} id="b" className="!opacity-0 !w-2 !h-2" />
      {editing ? (
        // textarea e não input: em texto de três linhas o input mostrava só um
        // pedaço enquanto a pessoa digitava. Enter continua criando irmão.
        <textarea
          autoFocus
          rows={1}
          className="nodrag nopan w-full bg-transparent outline-none py-2 resize-none overflow-hidden"
          style={{ lineHeight: `${d.isRoot ? ROOT_LINE_H : LINE_H}px` }}
          value={txt}
          ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }}
          onFocus={(e) => { const v = e.target.value; e.target.setSelectionRange(v.length, v.length); }}
          onChange={(e) => { setTxt(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${e.target.scrollHeight}px`; }}
          onBlur={() => d.commitEdit(id, txt)}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            // o campo é dono do teclado enquanto edita — nada sobe pro canvas
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); d.commitEdit(id, txt); d.addSibling(id); }
            else if (e.key === "Tab") { e.preventDefault(); d.commitEdit(id, txt); d.addChild(id); }
            else if (e.key === "Escape") { e.preventDefault(); d.commitEdit(id, n.text); }
          }}
        />
      ) : (
        <span className="py-2 w-full whitespace-pre-wrap break-words"
          style={{ lineHeight: `${d.isRoot ? ROOT_LINE_H : LINE_H}px` }}>
          {n.text || <span className="opacity-50">vazio</span>}
        </span>
      )}
      {hasKids && !d.isRoot && (
        <button
          className="nodrag absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border bg-white text-[10px] font-bold flex items-center justify-center shadow z-10"
          style={{ borderColor: color, color,
            ...(d.side === 0 ? { left: "50%", top: "auto", bottom: -12, transform: "translateX(-50%)" }
              : d.side === -1 ? { left: -12 } : { right: -12 }) }}
          onClick={(e) => { e.stopPropagation(); d.toggle(id); }}
          title={n.collapsed ? "Expandir" : "Colapsar"}
        >
          {n.collapsed ? n.children.length : "–"}
        </button>
      )}
    </div>
  );
}
const nodeTypes = { mm: MMNodeView };

// ─────────────────────────── editor ───────────────────────────
function Editor() {
  const { id: mapId } = useParams();
  const navigate = useNavigate();
  const rf = useReactFlow();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("Novo mapa");
  const [data, setData] = useState<MMData>({ root: { id: "root", text: "Ideia central", children: [] } });
  const [selectedId, setSelectedId] = useState<string>("root");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSeed, setEditSeed] = useState<string | null>(null); // 1ª letra digitada em cima do nó
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const undo = useRef<MMData[]>([]);
  const redo = useRef<MMData[]>([]);
  const staffIdRef = useRef<string | null>(null);

  // carga
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staff } = await (supabase as any).from("onboarding_staff")
        .select("id").eq("user_id", user?.id).maybeSingle();
      staffIdRef.current = staff?.id || null;
      if (mapId && mapId !== "novo") {
        const { data: row, error } = await (supabase as any).from("mindmaps")
          .select("id, title, data, owner_staff_id").eq("id", mapId).maybeSingle();
        if (error || !row) { toast.error("Mapa não encontrado ou sem acesso"); navigate("/onboarding-tasks/mapas"); return; }
        setTitle(row.title); setData(row.data as MMData);
        setCanEdit(row.owner_staff_id === staff?.id);
      }
      setLoading(false);
    })();
  }, [mapId, navigate]);

  const push = useCallback((next: MMData) => {
    undo.current.push(clone(data)); if (undo.current.length > 80) undo.current.shift();
    redo.current = [];
    setData(next); setDirty(true);
  }, [data]);

  const mutate = useCallback((fn: (root: MMNode) => void) => {
    if (!canEdit) return;
    const next = clone(data); fn(next.root); push(next);
  }, [data, push, canEdit]);

  const addChild = useCallback((pid: string) => {
    const nid = uid();
    mutate((root) => {
      const f = findNode(root, pid); if (!f) return;
      f.node.collapsed = false;
      f.node.children.push({ id: nid, text: "", children: [] });
    });
    setSelectedId(nid); setEditSeed(""); setEditingId(nid);
  }, [mutate]);

  const addSibling = useCallback((id: string) => {
    if (id === "root") { addChild("root"); return; }
    const nid = uid();
    mutate((root) => {
      const f = findNode(root, id); if (!f?.parent) return;
      const i = f.parent.children.findIndex((c) => c.id === id);
      f.parent.children.splice(i + 1, 0, { id: nid, text: "", children: [] });
    });
    setSelectedId(nid); setEditSeed(""); setEditingId(nid);
  }, [mutate, addChild]);

  const removeNode = useCallback((id: string) => {
    if (id === "root") return;
    let nextSel = "root";
    mutate((root) => {
      const f = findNode(root, id); if (!f?.parent) return;
      const i = f.parent.children.findIndex((c) => c.id === id);
      f.parent.children.splice(i, 1);
      nextSel = f.parent.children[Math.max(0, i - 1)]?.id || f.parent.id;
    });
    setSelectedId(nextSel);
  }, [mutate]);

  const commitEdit = useCallback((id: string, text: string) => {
    setEditingId(null); setEditSeed(null);
    mutate((root) => { const f = findNode(root, id); if (f) f.node.text = text.trim(); });
  }, [mutate]);

  const toggle = useCallback((id: string) => {
    mutate((root) => { const f = findNode(root, id); if (f) f.node.collapsed = !f.node.collapsed; });
  }, [mutate]);

  const setColor = useCallback((id: string, color: string) => {
    mutate((root) => { const f = findNode(root, id); if (!f) return; if (color) f.node.color = color; else delete f.node.color; });
  }, [mutate]);

  const setLayoutKind = (kind: LayoutKind) => { if (!canEdit) return; push({ ...clone(data), layout: kind }); setTimeout(() => rf.fitView({ padding: 0.3, duration: 300 }), 30); };
  const setTheme = (theme: string) => { if (!canEdit) return; push({ ...clone(data), theme }); };

  // exportação: renderiza só o viewport do canvas em PNG e (opcional) embrulha em PDF
  const canvasRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const exportImage = async (format: "png" | "pdf") => {
    const el = canvasRef.current?.querySelector(".react-flow__viewport") as HTMLElement | null;
    const wrap = canvasRef.current;
    if (!el || !wrap) return;
    setExporting(true);
    try {
      // enquadra tudo antes de fotografar
      await rf.fitView({ padding: 0.15, duration: 0 });
      await new Promise((r) => setTimeout(r, 120));
      const dataUrl = await toPng(wrap, {
        backgroundColor: "#ffffff", pixelRatio: 2,
        filter: (n) => !(n as HTMLElement).classList?.contains("react-flow__minimap")
                    && !(n as HTMLElement).classList?.contains("react-flow__controls"),
      });
      const fname = (title || "mapa").replace(/[^\w\-]+/g, "_");
      if (format === "png") {
        const a = document.createElement("a"); a.href = dataUrl; a.download = `${fname}.png`; a.click();
      } else {
        const img = new Image(); img.src = dataUrl; await img.decode();
        const landscape = img.width >= img.height;
        const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
        const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
        const m = 28;
        const scale = Math.min((pw - 2 * m) / img.width, (ph - 2 * m - 30) / img.height);
        const w = img.width * scale, h = img.height * scale;
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.setTextColor(13, 43, 94);
        pdf.text(title || "Mapa mental", m, m + 4);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(120);
        pdf.text(`UNV Nexus · ${new Date().toLocaleDateString("pt-BR")}`, pw - m, m + 4, { align: "right" });
        pdf.addImage(dataUrl, "PNG", (pw - w) / 2, m + 22, w, h);
        pdf.save(`${fname}.pdf`);
      }
    } catch (e: any) {
      toast.error("Não consegui exportar: " + (e?.message || e));
    } finally {
      setExporting(false);
    }
  };

  const doUndo = () => { const p = undo.current.pop(); if (!p) return; redo.current.push(clone(data)); setData(p); setDirty(true); };
  const doRedo = () => { const p = redo.current.pop(); if (!p) return; undo.current.push(clone(data)); setData(p); setDirty(true); };

  // teclado global
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (editingId) return; // o input do nó é dono do teclado
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "Tab") { e.preventDefault(); addChild(selectedId); }
      else if (e.key === "Enter") { e.preventDefault(); addSibling(selectedId); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeNode(selectedId); }
      else if (e.key === "F2") { e.preventDefault(); setEditSeed(null); setEditingId(selectedId); }
      else if (e.key === " ") { e.preventDefault(); toggle(selectedId); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // começou a digitar em cima de um nó: entra em edição já com a letra
        e.preventDefault();
        setEditSeed(e.key);
        setEditingId(selectedId);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editingId, addChild, addSibling, removeNode, toggle, data]);

  const save = useCallback(async () => {
    if (!canEdit || !staffIdRef.current) return;
    setSaving(true);
    try {
      if (mapId && mapId !== "novo") {
        const { error } = await (supabase as any).from("mindmaps")
          .update({ title, data, updated_at: new Date().toISOString() }).eq("id", mapId);
        if (error) throw error;
      } else {
        const { data: row, error } = await (supabase as any).from("mindmaps")
          .insert({ title, data, owner_staff_id: staffIdRef.current }).select("id").single();
        if (error) throw error;
        navigate(`/onboarding-tasks/mapas/${row.id}`, { replace: true });
      }
      setDirty(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [canEdit, mapId, title, data, navigate]);

  // autosave 2s após parar de mexer
  useEffect(() => {
    if (!dirty || !mapId || mapId === "novo") return;
    const t = setTimeout(save, 2000);
    return () => clearTimeout(t);
  }, [dirty, data, title, mapId, save]);

  const { nodes, edges } = useMemo(() => {
    const l = layout(data.root, data.layout || "radial", data.theme || "unv");
    return {
      nodes: l.nodes.map((n) => ({
        ...n, selected: n.id === selectedId,
        data: { ...n.data, editingId, seed: n.id === editingId ? editSeed : undefined,
          startEdit: (id: string) => { if (!canEdit) return; setEditSeed(null); setEditingId(id); },
          commitEdit, addChild, addSibling, toggle },
      })),
      edges: l.edges,
    };
  }, [data, selectedId, editingId, editSeed, commitEdit, addChild, addSibling, toggle, canEdit]);

  useEffect(() => { if (!loading) setTimeout(() => rf.fitView({ padding: 0.3, duration: 300 }), 50); }, [loading]); // eslint-disable-line

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const sel = findNode(data.root, selectedId)?.node;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* barra */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background">
        <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks/mapas")}><ArrowLeft className="h-4 w-4" /></Button>
        <Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} disabled={!canEdit}
          className="max-w-xs h-8 font-semibold" />
        <div className="flex items-center gap-1 ml-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => addChild(selectedId)} disabled={!canEdit} title="Tab"><Plus className="h-3.5 w-3.5" /> Filho</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => addSibling(selectedId)} disabled={!canEdit || selectedId === "root"} title="Enter"><Plus className="h-3.5 w-3.5" /> Irmão</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => removeNode(selectedId)} disabled={!canEdit || selectedId === "root"} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={() => toggle(selectedId)} disabled={!sel?.children.length} title="Espaço"><ChevronsUpDown className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={doUndo} disabled={!canEdit} title="Ctrl+Z"><Undo2 className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={doRedo} disabled={!canEdit} title="Ctrl+Shift+Z"><Redo2 className="h-3.5 w-3.5" /></Button>
          {sel && selectedId !== "root" && canEdit && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              {(THEMES[data.theme || "unv"] || THEMES.unv).palette.slice(0, 8).map((c) => (
                <button key={c} className={cn("h-4 w-4 rounded-full border", sel.color === c && "ring-2 ring-offset-1 ring-primary")}
                  style={{ background: c }} onClick={() => setColor(selectedId, c)} title={c} />
              ))}
              {/* cor livre: qualquer cor, não só a paleta */}
              <label className="h-5 w-5 rounded-full border-2 border-dashed border-muted-foreground/50 cursor-pointer overflow-hidden relative" title="Cor personalizada">
                <input type="color" value={sel.color || "#0D2B5E"} onChange={(e) => setColor(selectedId, e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer" />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">+</span>
              </label>
              {sel.color && (
                <button className="text-[10px] text-muted-foreground hover:text-foreground ml-1" onClick={() => setColor(selectedId, "")}>limpar</button>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 ml-2 pl-2 border-l">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={!canEdit}><LayoutTemplate className="h-3.5 w-3.5" /> {({ radial: "Radial", right: "Direita", tree: "Organograma" } as any)[data.layout || "radial"]}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Tipo de mapa</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setLayoutKind("radial")}>Radial — ramos dos dois lados</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLayoutKind("right")}>Direita — todos os ramos à direita</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLayoutKind("tree")}>Organograma — de cima pra baixo</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Tema de cores</DropdownMenuLabel>
                {Object.entries(THEMES).map(([k, t]) => (
                  <DropdownMenuItem key={k} onClick={() => setTheme(k)} className="gap-2">
                    <span className="flex gap-0.5">{t.palette.slice(0, 5).map((c) => <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />)}</span>
                    {t.name}{(data.theme || "unv") === k ? " ✓" : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={exporting}>
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => exportImage("pdf")}>Baixar PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportImage("png")}>Baixar imagem (PNG)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {!canEdit && <span className="text-amber-600">somente leitura — mapa de outra pessoa</span>}
          {canEdit && (dirty ? "alterações não salvas" : "salvo")}
          {canEdit && (
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
            </Button>
          )}
        </div>
      </div>

      {/* canvas */}
      <div className="flex-1" ref={canvasRef}>
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onNodeDoubleClick={(_, n) => { if (canEdit) { setSelectedId(n.id); setEditSeed(null); setEditingId(n.id); } }}
          onPaneClick={() => { setEditingId(null); }}
          zoomOnDoubleClick={false}
          fitView minZoom={0.2} maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(n) => (n.data as any)?.isRoot ? "#0D2B5E" : ((n.data as any)?.color || "#94a3b8")} />
        </ReactFlow>
      </div>
      <div className="px-3 py-1.5 border-t text-[11px] text-muted-foreground bg-background">
        <b>Duplo clique</b> edita o texto · <b>Tab</b> filho · <b>Enter</b> irmão · <b>Delete</b> apagar · <b>Espaço</b> colapsar · <b>Ctrl+Z</b> desfazer
      </div>
    </div>
  );
}

export default function MindMapEditorPage() {
  return <ReactFlowProvider><Editor /></ReactFlowProvider>;
}
