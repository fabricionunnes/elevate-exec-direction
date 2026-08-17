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
import { ArrowLeft, Loader2, Save, Plus, Trash2, Undo2, Redo2, ChevronsUpDown, Palette } from "lucide-react";
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
interface MMData { root: MMNode }

const PALETTE = ["#0D2B5E", "#CC1B1B", "#1B7F4B", "#B7791F", "#7C3AED", "#0E7490", "#BE185D", "#4B5563"];
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
const NODE_W = 180, NODE_H = 40, GAP_X = 70, GAP_Y = 14;

/** altura total de um ramo (respeitando colapso) */
function subtreeHeight(n: MMNode): number {
  if (n.collapsed || n.children.length === 0) return NODE_H;
  const h = n.children.reduce((s, c) => s + subtreeHeight(c), 0) + GAP_Y * (n.children.length - 1);
  return Math.max(NODE_H, h);
}

function layout(root: MMNode) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const cx = 0, cy = 0;
  nodes.push({ id: root.id, type: "mm", position: { x: cx - 110, y: cy - NODE_H / 2 },
    data: { node: root, isRoot: true, depth: 0, side: 0 } });

  // divide os filhos do root: metade direita, metade esquerda
  const kids = root.collapsed ? [] : root.children;
  const right = kids.filter((_, i) => i % 2 === 0);
  const left = kids.filter((_, i) => i % 2 === 1);

  const place = (children: MMNode[], side: 1 | -1, parent: MMNode, px: number, py: number, depth: number, color?: string) => {
    if (!children.length) return;
    const total = children.reduce((s, c) => s + subtreeHeight(c), 0) + GAP_Y * (children.length - 1);
    let y = py - total / 2;
    for (const c of children) {
      const h = subtreeHeight(c);
      const ny = y + h / 2;
      const nx = px + side * (NODE_W + GAP_X);
      const col = c.color || color || PALETTE[0];
      nodes.push({ id: c.id, type: "mm", position: { x: nx - NODE_W / 2, y: ny - NODE_H / 2 },
        data: { node: c, isRoot: false, depth, side, color: col } });
      edges.push({ id: `${parent.id}-${c.id}`, source: parent.id, target: c.id,
        sourceHandle: side === 1 ? "r" : "l", targetHandle: side === 1 ? "l" : "r",
        type: "smoothstep", style: { stroke: col, strokeWidth: Math.max(1.5, 3.5 - depth * 0.7) } });
      if (!c.collapsed) place(c.children, side, c, nx, ny, depth + 1, col);
      y += h + GAP_Y;
    }
  };
  place(right, 1, root, cx, cy, 1);
  place(left, -1, root, cx, cy, 1);
  return { nodes, edges };
}

// ─────────────────────────── nó visual ───────────────────────────
function MMNodeView({ id, data, selected }: NodeProps) {
  const d = data as any;
  const n: MMNode = d.node;
  const color: string = d.isRoot ? "#0D2B5E" : d.color;
  const editing = d.editingId === id;
  const [txt, setTxt] = useState(n.text);
  useEffect(() => setTxt(n.text), [n.text]);
  const hasKids = n.children.length > 0;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 shadow-sm px-3 flex items-center transition-shadow",
        d.isRoot ? "text-white font-semibold text-[15px]" : "bg-white text-[13px]",
        selected && "ring-2 ring-offset-2 ring-primary/60 shadow-md",
      )}
      style={{
        width: d.isRoot ? 220 : NODE_W, minHeight: d.isRoot ? 52 : NODE_H,
        borderColor: color, background: d.isRoot ? color : "#fff",
      }}
      onDoubleClick={() => d.startEdit(id)}
    >
      <Handle type="target" position={Position.Left} id="l" className="!opacity-0 !w-2 !h-2" />
      <Handle type="target" position={Position.Right} id="r" className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Left} id="l" className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="r" className="!opacity-0 !w-2 !h-2" />
      {editing ? (
        <input
          autoFocus
          className="w-full bg-transparent outline-none py-2"
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onBlur={() => d.commitEdit(id, txt)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); d.commitEdit(id, txt); d.addSibling(id); }
            if (e.key === "Tab") { e.preventDefault(); d.commitEdit(id, txt); d.addChild(id); }
            if (e.key === "Escape") { d.commitEdit(id, n.text); }
            e.stopPropagation();
          }}
        />
      ) : (
        <span className="py-2 truncate">{n.text || <span className="opacity-50">vazio</span>}</span>
      )}
      {hasKids && !d.isRoot && (
        <button
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border bg-white text-[10px] font-bold flex items-center justify-center shadow"
          style={{ borderColor: color, color, [d.side === -1 ? "left" : "right"]: -10 } as any}
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
    setSelectedId(nid); setEditingId(nid);
  }, [mutate]);

  const addSibling = useCallback((id: string) => {
    if (id === "root") { addChild("root"); return; }
    const nid = uid();
    mutate((root) => {
      const f = findNode(root, id); if (!f?.parent) return;
      const i = f.parent.children.findIndex((c) => c.id === id);
      f.parent.children.splice(i + 1, 0, { id: nid, text: "", children: [] });
    });
    setSelectedId(nid); setEditingId(nid);
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
    setEditingId(null);
    mutate((root) => { const f = findNode(root, id); if (f) f.node.text = text.trim(); });
  }, [mutate]);

  const toggle = useCallback((id: string) => {
    mutate((root) => { const f = findNode(root, id); if (f) f.node.collapsed = !f.node.collapsed; });
  }, [mutate]);

  const setColor = useCallback((id: string, color: string) => {
    mutate((root) => { const f = findNode(root, id); if (f) f.node.color = color; });
  }, [mutate]);

  const doUndo = () => { const p = undo.current.pop(); if (!p) return; redo.current.push(clone(data)); setData(p); setDirty(true); };
  const doRedo = () => { const p = redo.current.pop(); if (!p) return; undo.current.push(clone(data)); setData(p); setDirty(true); };

  // teclado global
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (editingId) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Tab") { e.preventDefault(); addChild(selectedId); }
      else if (e.key === "Enter") { e.preventDefault(); addSibling(selectedId); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeNode(selectedId); }
      else if (e.key === "F2") { e.preventDefault(); setEditingId(selectedId); }
      else if (e.key === " ") { e.preventDefault(); toggle(selectedId); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // começou a digitar em cima de um nó: entra em edição já com a letra
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
    const l = layout(data.root);
    return {
      nodes: l.nodes.map((n) => ({
        ...n, selected: n.id === selectedId,
        data: { ...n.data, editingId, startEdit: (id: string) => canEdit && setEditingId(id),
          commitEdit, addChild, addSibling, toggle },
      })),
      edges: l.edges,
    };
  }, [data, selectedId, editingId, commitEdit, addChild, addSibling, toggle, canEdit]);

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
              {PALETTE.map((c) => (
                <button key={c} className={cn("h-4 w-4 rounded-full border", sel.color === c && "ring-2 ring-offset-1 ring-primary")}
                  style={{ background: c }} onClick={() => setColor(selectedId, c)} />
              ))}
            </div>
          )}
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
      <div className="flex-1">
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => { setEditingId(null); }}
          fitView minZoom={0.2} maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(n) => (n.data as any)?.isRoot ? "#0D2B5E" : ((n.data as any)?.color || "#94a3b8")} />
        </ReactFlow>
      </div>
      <div className="px-3 py-1.5 border-t text-[11px] text-muted-foreground bg-background">
        <b>Tab</b> filho · <b>Enter</b> irmão · <b>Delete</b> apagar · <b>F2</b> ou duplo clique editar · <b>Espaço</b> colapsar · <b>Ctrl+Z</b> desfazer · digitar em cima do nó já edita
      </div>
    </div>
  );
}

export default function MindMapEditorPage() {
  return <ReactFlowProvider><Editor /></ReactFlowProvider>;
}
