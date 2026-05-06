import { useEffect, useMemo, useState } from "react";
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
import { Network, Pencil, Plus, Loader2, Search, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Node {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  manager_id?: string | null;
  position?: string;
}

function NodeCard({
  node,
  onEdit,
  highlight = false,
}: {
  node: Node;
  onEdit: (n: Node) => void;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "w-44 mb-3 group cursor-pointer transition-all hover:shadow-md hover:border-primary/40",
        highlight && "border-primary/60 ring-1 ring-primary/30",
      )}
      onClick={() => onEdit(node)}
    >
      <CardContent className="p-3 flex flex-col items-center text-center relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(node);
          }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Avatar className="h-12 w-12 mb-2">
          <AvatarImage src={node.avatar_url || undefined} />
          <AvatarFallback>{node.full_name?.[0]}</AvatarFallback>
        </Avatar>
        <p className="text-xs font-semibold truncate w-full">{node.full_name}</p>
        {node.position && (
          <p className="text-[10px] text-muted-foreground truncate w-full">{node.position}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Tree({
  nodes,
  parentId = null,
  onEdit,
  isRoot = false,
}: {
  nodes: Node[];
  parentId?: string | null;
  onEdit: (n: Node) => void;
  isRoot?: boolean;
}) {
  const children = nodes.filter((n) => (n.manager_id || null) === parentId);
  if (children.length === 0) return null;

  return (
    <div className="flex flex-col items-center">
      {/* Linha descendo do pai */}
      {!isRoot && <div className="w-px h-6 bg-border" />}

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
                  <div
                    className={`h-px bg-border flex-1 ${isFirst ? "invisible" : ""}`}
                    style={{ minWidth: 32 }}
                  />
                  <div className="w-px h-6 bg-border" />
                  <div
                    className={`h-px bg-border flex-1 ${isLast ? "invisible" : ""}`}
                    style={{ minWidth: 32 }}
                  />
                </div>
              )}

              {/* Card */}
              <div className="px-3">
                <NodeCard node={child} onEdit={onEdit} />
              </div>

              {/* Filhos recursivos */}
              {hasChildren && (
                <Tree nodes={nodes} parentId={child.id} onEdit={onEdit} />
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

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profile_employees")
      .select("id, full_name, avatar_url, manager_id, staff_id, profile_positions(title)")
      .eq("status", "active")
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
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

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
  const roots = normalizedNodes.filter((n) => !n.manager_id);
  const orphansWithoutChildrenAndManager = normalizedNodes.filter(
    (n) => !n.manager_id && !normalizedNodes.some((c) => c.manager_id === n.id),
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

  const candidateManagers = useMemo(() => {
    if (!editing) return [];
    const q = managerSearch.trim().toLowerCase();
    return nodes
      .filter((n) => n.id !== editing.id && !wouldCreateCycle(editing.id, n.id))
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
            Clique em qualquer colaborador para definir o gestor dele e montar a hierarquia.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant="outline">{nodes.length} colaboradores</Badge>
          <Badge variant="outline">{roots.length} sem gestor</Badge>
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
          <div className="overflow-auto pb-6">
            <Tree nodes={normalizedNodes} parentId={null} onEdit={setEditing} isRoot={true} />
          </div>

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
              <Network className="w-4 h-4" /> Definir gestor
            </DialogTitle>
            <DialogDescription>
              Escolha quem será o gestor direto de <strong>{editing?.full_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/40">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={editing.avatar_url || undefined} />
                  <AvatarFallback>{editing.full_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{editing.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {editing.manager_id
                      ? `Gestor atual: ${nodes.find((n) => n.id === editing.manager_id)?.full_name || "—"}`
                      : "Atualmente sem gestor (topo)"}
                  </p>
                </div>
              </div>

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
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
            {editing?.manager_id && (
              <Button
                variant="outline"
                onClick={() => handleSetManager(null)}
                disabled={saving}
                className="gap-1.5"
              >
                <X className="w-4 h-4" /> Remover gestor (topo)
              </Button>
            )}
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
