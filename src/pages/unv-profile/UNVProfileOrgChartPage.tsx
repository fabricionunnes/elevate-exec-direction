import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Network, Pencil, Plus, Loader2, Search, UserMinus, X, ZoomIn, ZoomOut, Maximize2, Crown, Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Node {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  manager_id?: string | null;
  position?: string;
  contract_type?: string | null;
  outsourced?: boolean;
}

// Cores por nível da hierarquia (cicla)
const LEVELS = [
  { grad: "from-rose-500 to-red-600", line: "#f43f5e", glow: "shadow-rose-500/20", chip: "bg-rose-500" },
  { grad: "from-indigo-500 to-violet-600", line: "#6366f1", glow: "shadow-indigo-500/20", chip: "bg-indigo-500" },
  { grad: "from-cyan-500 to-teal-600", line: "#06b6d4", glow: "shadow-cyan-500/20", chip: "bg-cyan-500" },
  { grad: "from-amber-500 to-orange-600", line: "#f59e0b", glow: "shadow-amber-500/20", chip: "bg-amber-500" },
  { grad: "from-emerald-500 to-green-600", line: "#10b981", glow: "shadow-emerald-500/20", chip: "bg-emerald-500" },
  { grad: "from-fuchsia-500 to-pink-600", line: "#d946ef", glow: "shadow-fuchsia-500/20", chip: "bg-fuchsia-500" },
];
const lvl = (n: number) => LEVELS[n % LEVELS.length];

function NodeCard({
  node,
  onEdit,
  level = 0,
  isTop = false,
}: {
  node: Node;
  onEdit: (n: Node) => void;
  level?: number;
  isTop?: boolean;
}) {
  const s = lvl(level);
  return (
    <div
      className={cn(
        "relative w-44 mb-3 group cursor-pointer rounded-2xl border bg-card/80 backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-xl",
        s.glow,
      )}
      onClick={() => onEdit(node)}
    >
      {/* faixa de cor no topo */}
      <div className={cn("h-1.5 rounded-t-2xl bg-gradient-to-r", s.grad)} />
      <div className="p-3 flex flex-col items-center text-center relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-0 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onEdit(node); }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <div className="relative mb-2">
          <Avatar className={cn("h-14 w-14 ring-2 ring-background shadow-md")}>
            <AvatarImage src={node.avatar_url || undefined} />
            <AvatarFallback className={cn("bg-gradient-to-br text-white font-bold", s.grad)}>{node.full_name?.[0]}</AvatarFallback>
          </Avatar>
          {isTop && (
            <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-amber-400 flex items-center justify-center shadow ring-2 ring-background">
              <Crown className="h-3.5 w-3.5 text-amber-900" />
            </div>
          )}
        </div>
        <p className="text-xs font-semibold truncate w-full">{node.full_name}</p>
        {node.position ? (
          <p className="text-[10px] text-muted-foreground truncate w-full">{node.position}</p>
        ) : (
          <p className="text-[10px] text-muted-foreground/50 truncate w-full">sem cargo</p>
        )}
      </div>
    </div>
  );
}

function Tree({
  nodes,
  parentId = null,
  onEdit,
  isRoot = false,
  level = 0,
}: {
  nodes: Node[];
  parentId?: string | null;
  onEdit: (n: Node) => void;
  isRoot?: boolean;
  level?: number;
}) {
  const children = nodes.filter((n) => (n.manager_id || null) === parentId);
  if (children.length === 0) return null;
  const line = lvl(level).line;

  return (
    <div className="flex flex-col items-center">
      {/* Linha descendo do pai */}
      {!isRoot && <div className="w-0.5 h-6 rounded" style={{ background: line, opacity: 0.5 }} />}

      <div className="flex items-start justify-center gap-0">
        {children.map((child, index) => {
          const hasChildren = nodes.some((n) => n.manager_id === child.id);
          const isFirst = index === 0;
          const isLast = index === children.length - 1;
          const isSingle = children.length === 1;

          return (
            <div key={child.id} className="flex flex-col items-center">
              {/* Conector horizontal superior */}
              {!isSingle && (
                <div className="flex w-full h-6 items-end">
                  <div className={`h-0.5 rounded flex-1 ${isFirst ? "invisible" : ""}`} style={{ minWidth: 32, background: line, opacity: 0.5 }} />
                  <div className="w-0.5 h-6 rounded" style={{ background: line, opacity: 0.5 }} />
                  <div className={`h-0.5 rounded flex-1 ${isLast ? "invisible" : ""}`} style={{ minWidth: 32, background: line, opacity: 0.5 }} />
                </div>
              )}

              {/* Card */}
              <div className="px-3">
                <NodeCard node={child} onEdit={onEdit} level={level} isTop={isRoot} />
              </div>

              {/* Filhos recursivos */}
              {hasChildren && (
                <Tree nodes={nodes} parentId={child.id} onEdit={onEdit} level={level + 1} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function UNVProfileOrgChartPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Node | null>(null);
  const [managerSearch, setManagerSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [orphanSearch, setOrphanSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fitToWidth = () => {
    const cont = containerRef.current, inner = contentRef.current;
    if (!cont || !inner) return;
    const unscaledW = inner.scrollWidth / (zoom || 1);
    const z = Math.min(1, (cont.clientWidth - 32) / unscaledW);
    setZoom(Math.max(0.35, Number.isFinite(z) ? z : 1));
  };
  const zoomIn = () => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.35, +(z - 0.1).toFixed(2)));

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profile_employees")
      .select("id, full_name, avatar_url, manager_id, staff_id, contract_type, profile_positions(title)")
      .eq("status", "active")
      .neq("employee_type", "external")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar: " + error.message);
      setLoading(false);
      return;
    }
    // Deduplica por staff_id mantendo o mais recente (created_at DESC já aplicado)
    const seen = new Set<string>();
    const deduped = (data || []).filter((d: any) => {
      const key = d.staff_id || d.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setNodes(
      deduped.map((d: any) => ({
        id: d.id,
        full_name: d.full_name,
        avatar_url: d.avatar_url,
        manager_id: d.manager_id,
        position: d.profile_positions?.title,
        contract_type: d.contract_type,
        outsourced: d.contract_type === "terceirizado",
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Auto-ajusta o zoom pra caber todo mundo quando carrega
  useEffect(() => {
    if (loading || !nodes.length) return;
    const t = setTimeout(fitToWidth, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, nodes.length]);

  // Considera "raiz" todo nó cujo manager_id é null OU aponta para alguém não-ativo
  const idsSet = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const normalizedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        manager_id: n.manager_id && idsSet.has(n.manager_id) ? n.manager_id : null,
      })),
    [nodes, idsSet],
  );
  // Terceirizados ficam FORA da árvore (sem líder, desconexos).
  const outsourcedList = normalizedNodes.filter((n) => n.outsourced);
  const treeNodes = normalizedNodes.filter((n) => !n.outsourced).map((n) => ({
    ...n,
    manager_id: n.manager_id && normalizedNodes.some((m) => m.id === n.manager_id && !m.outsourced) ? n.manager_id : null,
  }));
  const roots = treeNodes.filter((n) => !n.manager_id);
  const orphansWithoutChildrenAndManager = treeNodes.filter(
    (n) => !n.manager_id && !treeNodes.some((c) => c.manager_id === n.id),
  );

  // Detecta ciclo simples (subir até a raiz; se reencontrar, é ciclo)
  const wouldCreateCycle = (employeeId: string, newManagerId: string): boolean => {
    if (employeeId === newManagerId) return true;
    let cursor: string | null | undefined = newManagerId;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === employeeId) return true;
      if (seen.has(cursor)) return true;
      seen.add(cursor);
      cursor = nodes.find((n) => n.id === cursor)?.manager_id || null;
    }
    return false;
  };

  const handleSetManager = async (newManagerId: string | null) => {
    if (!editing) return;
    if (newManagerId && wouldCreateCycle(editing.id, newManagerId)) {
      toast.error("Não é possível: isso cria um ciclo na hierarquia.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profile_employees")
      .update({ manager_id: newManagerId })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(
      newManagerId
        ? "Hierarquia atualizada com sucesso."
        : "Colaborador movido para o topo (sem gestor).",
    );
    setEditing(null);
    setManagerSearch("");
    load();
  };

  const uploadPhoto = async (file: File) => {
    if (!editing) return;
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem (JPG ou PNG)."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx. 5MB)."); return; }
    setUploading(true);
    try {
      // O bucket avatars exige que a 1ª pasta do caminho seja o auth.uid() (RLS).
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) throw new Error("Sessão expirada — recarregue a página.");
      const ext = file.name.split(".").pop();
      const path = `${uid}/employees/${editing.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error } = await supabase.from("profile_employees").update({ avatar_url: urlData.publicUrl }).eq("id", editing.id);
      if (error) throw error;
      setEditing((p) => p ? { ...p, avatar_url: urlData.publicUrl } : p);
      toast.success("Foto atualizada");
      load();
    } catch (e: any) {
      toast.error("Erro ao enviar foto: " + (e?.message || e));
    } finally {
      setUploading(false);
    }
  };

  const toggleOutsourced = async () => {
    if (!editing) return;
    const next = !editing.outsourced;
    setSaving(true);
    // Terceirizado fica sem líder (desconexo da árvore).
    const patch: any = { contract_type: next ? "terceirizado" : null };
    if (next) patch.manager_id = null;
    const { error } = await supabase.from("profile_employees").update(patch).eq("id", editing.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(next ? "Marcado como terceirizado (fora da hierarquia)" : "Terceirizado removido");
    setEditing(null);
    load();
  };

  const deleteEmployee = async () => {
    if (!editing) return;
    if (!confirm(`Excluir o cadastro de "${editing.full_name}"? Use isso pra remover duplicados. Não apaga o usuário do sistema, só o registro do organograma.`)) return;
    setSaving(true);
    const { error } = await supabase.from("profile_employees").delete().eq("id", editing.id);
    setSaving(false);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Cadastro excluído");
    setEditing(null);
    load();
  };

  const candidateManagers = useMemo(() => {
    if (!editing) return [];
    const q = managerSearch.trim().toLowerCase();
    return nodes
      .filter((n) => n.id !== editing.id && !n.outsourced && !wouldCreateCycle(editing.id, n.id))
      .filter((n) => !q || n.full_name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [nodes, editing, managerSearch]);

  const filteredOrphans = useMemo(() => {
    const q = orphanSearch.trim().toLowerCase();
    return orphansWithoutChildrenAndManager.filter(
      (n) => !q || n.full_name.toLowerCase().includes(q),
    );
  }, [orphansWithoutChildrenAndManager, orphanSearch]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" /> Organograma
          </h1>
          <p className="text-sm text-muted-foreground">
            Clique em qualquer colaborador para definir o gestor, enviar foto ou marcar como terceirizado.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Badge variant="outline">{nodes.length} colaboradores</Badge>
          <Badge variant="outline">{roots.length} sem gestor</Badge>
          {outsourcedList.length > 0 && <Badge variant="outline">{outsourcedList.length} terceirizados</Badge>}
          <div className="flex items-center gap-0.5 rounded-lg border p-0.5 bg-muted/30">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} title="Diminuir"><ZoomOut className="w-4 h-4" /></Button>
            <span className="text-xs font-medium w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} title="Aumentar"><ZoomIn className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fitToWidth} title="Ver tudo"><Maximize2 className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : nodes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Sem colaboradores ativos. Cadastre na aba <strong>Colaboradores</strong> para começar.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Árvore */}
          <div ref={containerRef} className="overflow-auto pb-6 rounded-2xl border bg-gradient-to-b from-muted/20 via-transparent to-transparent">
            <div ref={contentRef} className="inline-block min-w-full p-8" style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.15s ease" }}>
              <Tree nodes={treeNodes} parentId={null} onEdit={setEditing} isRoot={true} />
            </div>
          </div>

          {/* Terceirizados — fora da hierarquia */}
          {outsourcedList.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <UserMinus className="w-4 h-4 text-amber-500" />Terceirizados
                  </h3>
                  <p className="text-xs text-muted-foreground">Colaboradores terceirizados — não fazem parte da hierarquia. Clique pra editar foto ou desmarcar.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {outsourcedList.map((n) => (
                    <button key={n.id} onClick={() => setEditing(n)}
                      className="flex items-center gap-2 border rounded-xl px-3 py-2 hover:bg-muted transition-colors bg-gradient-to-br from-amber-500/10 to-transparent">
                      <Avatar className="h-8 w-8 ring-2 ring-amber-500/30">
                        <AvatarImage src={n.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-gradient-to-br from-amber-400 to-orange-600 text-white">{n.full_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <p className="text-xs font-medium">{n.full_name}</p>
                        <p className="text-[10px] text-amber-500">Terceirizado</p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Painel de não-vinculados (sem subordinados e sem gestor) */}
          {orphansWithoutChildrenAndManager.length > 1 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <UserMinus className="w-4 h-4 text-muted-foreground" />
                      Sem hierarquia definida
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Colaboradores sem gestor e sem subordinados — clique para vincular a alguém.
                    </p>
                  </div>
                  <div className="relative w-56">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={orphanSearch}
                      onChange={(e) => setOrphanSearch(e.target.value)}
                      placeholder="Buscar"
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filteredOrphans.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setEditing(n)}
                      className="flex items-center gap-2 border border-border rounded-full px-2.5 py-1 hover:bg-muted transition-colors"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={n.avatar_url || undefined} />
                        <AvatarFallback className="text-[9px]">{n.full_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs">{n.full_name}</span>
                      <Plus className="w-3 h-3 text-muted-foreground" />
                    </button>
                  ))}
                  {filteredOrphans.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum colaborador encontrado.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Diálogo: definir gestor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && (setEditing(null), setManagerSearch(""))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="w-4 h-4" /> Editar colaborador
            </DialogTitle>
            <DialogDescription>
              Foto, hierarquia e tipo de <strong>{editing?.full_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.currentTarget.value = ""; }} />
              <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/40">
                <button className="relative group/av shrink-0" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Enviar foto">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={editing.avatar_url || undefined} />
                    <AvatarFallback>{editing.full_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <span className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-opacity">
                    {uploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{editing.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {editing.outsourced
                      ? "Terceirizado (fora da hierarquia)"
                      : editing.manager_id
                        ? `Gestor atual: ${nodes.find((n) => n.id === editing.manager_id)?.full_name || "—"}`
                        : "Sem gestor (topo)"}
                  </p>
                  <button className="text-[11px] text-primary hover:underline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {editing.avatar_url ? "Trocar foto" : "Enviar foto"}
                  </button>
                </div>
              </div>

              <button
                onClick={toggleOutsourced}
                disabled={saving}
                className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border text-left transition-colors ${editing.outsourced ? "bg-amber-500/15 border-amber-500/40" : "hover:bg-muted/50"}`}
              >
                <div>
                  <p className="text-sm font-medium flex items-center gap-2"><UserMinus className="w-4 h-4 text-amber-500" />Colaborador terceirizado</p>
                  <p className="text-[11px] text-muted-foreground">Fica fora da hierarquia, sem líder.</p>
                </div>
                <span className={`text-xs font-semibold ${editing.outsourced ? "text-amber-500" : "text-muted-foreground"}`}>{editing.outsourced ? "SIM" : "não"}</span>
              </button>

              {!editing.outsourced && (
              <Command className="border rounded-lg">
                <CommandInput
                  placeholder="Buscar gestor..."
                  value={managerSearch}
                  onValueChange={setManagerSearch}
                />
                <CommandList className="max-h-[260px]">
                  <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                  <CommandGroup>
                    {candidateManagers.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.full_name}
                        onSelect={() => handleSetManager(c.id)}
                        disabled={saving}
                      >
                        <Avatar className="h-6 w-6 mr-2">
                          <AvatarImage src={c.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {c.full_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1">{c.full_name}</span>
                        {c.position && (
                          <span className="text-[10px] text-muted-foreground ml-2">
                            {c.position}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2 flex-wrap sm:justify-between">
            <Button variant="ghost" size="sm" className="text-rose-500 gap-1.5" onClick={deleteEmployee} disabled={saving}>
              <Trash2 className="w-4 h-4" /> Excluir cadastro
            </Button>
            <div className="flex gap-2 flex-wrap">
              {editing?.manager_id && !editing.outsourced && (
                <Button variant="outline" onClick={() => handleSetManager(null)} disabled={saving} className="gap-1.5">
                  <X className="w-4 h-4" /> Remover gestor (topo)
                </Button>
              )}
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Fechar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
