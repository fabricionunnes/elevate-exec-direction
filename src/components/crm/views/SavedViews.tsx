import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bookmark, ChevronDown, Loader2, MoreHorizontal, Pencil, Pin, PinOff, Plus, RefreshCw, Search,
  Star, StarOff, Trash2, Users, UserX,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SavedView, SavedViewScope, viewSignature } from "./savedViews";

interface SavedViewsProps {
  scope: SavedViewScope;
  staffId: string | null;
  /** master/admin: também alteram e apagam as visões compartilhadas dos outros */
  canManageShared?: boolean;
  /** só no funil: funil aberto (a visão guarda o funil em que foi criada) */
  pipelineId?: string | null;
  /** estado atual da tela, já em formato JSON (datas como texto) */
  current: Record<string, any>;
  onApply: (payload: Record<string, any>, view: SavedView) => void;
  /** coluna estreita (Atendimento): botão menor e chips quebrando linha */
  compact?: boolean;
  className?: string;
}

type NameDialog = { mode: "create" } | { mode: "rename"; view: SavedView };

/**
 * Visões salvas: botão "Visões" com lista pesquisável + chips das fixadas.
 * A tela dona dos filtros passa o estado atual (`current`) e recebe de volta o
 * conteúdo da visão em `onApply`. A visão padrão é aplicada uma vez ao abrir
 * (no funil, uma vez por funil).
 */
export function SavedViews({
  scope, staffId, canManageShared = false, pipelineId = null, current, onApply, compact = false, className,
}: SavedViewsProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [shareValue, setShareValue] = useState(false);
  const [allPipelines, setAllPipelines] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<SavedView | null>(null);
  const db = supabase as any;

  const load = useCallback(async () => {
    if (!staffId) return;
    const [{ data: rows, error }, { data: prefs }] = await Promise.all([
      db.from("crm_saved_views")
        .select("id, staff_id, scope, name, filters, pipeline_id, is_shared, sort_order, created_at, owner:onboarding_staff!crm_saved_views_staff_id_fkey(name)")
        .eq("scope", scope)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      db.from("crm_saved_view_prefs").select("view_id, is_pinned, is_default").eq("staff_id", staffId),
    ]);
    if (error) { console.error("crm_saved_views:", error); setLoaded(true); return; }
    const prefMap = new Map<string, { is_pinned: boolean; is_default: boolean }>();
    for (const p of (prefs || []) as any[]) prefMap.set(p.view_id, p);
    setViews(((rows || []) as any[]).map((r) => ({
      ...r,
      filters: r.filters || {},
      is_pinned: !!prefMap.get(r.id)?.is_pinned,
      is_default: !!prefMap.get(r.id)?.is_default,
    })));
    setLoaded(true);
  }, [db, scope, staffId]);

  useEffect(() => { load(); }, [load]);

  // No funil, só entram as visões deste funil e as que valem pra qualquer funil.
  const visible = useMemo(
    () => (scope === "pipeline" ? views.filter((v) => !v.pipeline_id || v.pipeline_id === pipelineId) : views),
    [views, scope, pipelineId],
  );

  const applyView = useCallback((v: SavedView) => {
    setActiveId(v.id);
    onApply(v.filters || {}, v);
  }, [onApply]);

  // Visão padrão: aplica uma vez ao abrir (no funil, uma vez por funil). A do próprio
  // funil ganha da que vale pra todos.
  const appliedDefaultFor = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (scope === "pipeline" && !pipelineId) return;
    const key = `${scope}:${pipelineId || ""}`;
    if (appliedDefaultFor.current === key) return;
    appliedDefaultFor.current = key;
    const defaults = visible.filter((v) => v.is_default);
    const def = defaults.find((v) => v.pipeline_id) || defaults[0];
    if (def) applyView(def);
    else setActiveId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, scope, pipelineId]);

  const active = visible.find((v) => v.id === activeId) || null;
  const currentSig = useMemo(() => viewSignature(current), [current]);
  const activeChanged = !!active && viewSignature(active.filters) !== currentSig;

  const canEdit = (v: SavedView) => v.staff_id === staffId || (canManageShared && v.is_shared);

  const openCreate = () => {
    setNameValue("");
    setShareValue(false);
    setAllPipelines(false);
    setNameDialog({ mode: "create" });
    setOpen(false);
  };
  const openRename = (v: SavedView) => {
    setNameValue(v.name);
    setNameDialog({ mode: "rename", view: v });
    setOpen(false);
  };

  const submitName = async () => {
    const name = nameValue.trim();
    if (!name || !nameDialog || !staffId) return;
    setSaving(true);
    try {
      if (nameDialog.mode === "create") {
        const { data, error } = await db.from("crm_saved_views").insert({
          staff_id: staffId,
          scope,
          name,
          filters: current,
          pipeline_id: scope === "pipeline" && !allPipelines ? pipelineId : null,
          is_shared: shareValue,
        }).select("id").single();
        if (error) throw error;
        toast.success(`Visão "${name}" salva`);
        await load();
        setActiveId(data?.id || null);
      } else {
        const { error } = await db.from("crm_saved_views").update({ name }).eq("id", nameDialog.view.id);
        if (error) throw error;
        toast.success("Visão renomeada");
        await load();
      }
      setNameDialog(null);
    } catch (e: any) {
      toast.error(e?.message || "Não consegui salvar a visão");
    } finally {
      setSaving(false);
    }
  };

  const updateWithCurrent = async (v: SavedView) => {
    const { error } = await db.from("crm_saved_views").update({ filters: current }).eq("id", v.id);
    if (error) { toast.error(error.message || "Não consegui atualizar a visão"); return; }
    toast.success(`Visão "${v.name}" atualizada com os filtros atuais`);
    setActiveId(v.id);
    load();
  };

  const toggleShare = async (v: SavedView) => {
    const { error } = await db.from("crm_saved_views").update({ is_shared: !v.is_shared }).eq("id", v.id);
    if (error) { toast.error(error.message || "Não consegui alterar o compartilhamento"); return; }
    toast.success(v.is_shared ? "Visão voltou a ser só sua" : "Visão compartilhada com o time");
    load();
  };

  const togglePin = async (v: SavedView) => {
    if (!staffId) return;
    const { error } = await db.from("crm_saved_view_prefs")
      .upsert({ staff_id: staffId, view_id: v.id, is_pinned: !v.is_pinned, is_default: v.is_default }, { onConflict: "staff_id,view_id" });
    if (error) { toast.error(error.message || "Não consegui fixar a visão"); return; }
    setViews((prev) => prev.map((x) => (x.id === v.id ? { ...x, is_pinned: !v.is_pinned } : x)));
  };

  const toggleDefault = async (v: SavedView) => {
    const { error } = await db.rpc("crm_saved_view_set_default", { p_view: v.id, p_on: !v.is_default });
    if (error) { toast.error(error.message || "Não consegui definir a visão padrão"); return; }
    toast.success(v.is_default ? "Visão deixou de ser a padrão" : `"${v.name}" agora abre como padrão`);
    load();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await db.from("crm_saved_views").delete().eq("id", toDelete.id);
    if (error) { toast.error(error.message || "Não consegui excluir a visão"); return; }
    toast.success("Visão excluída");
    if (activeId === toDelete.id) setActiveId(null);
    setToDelete(null);
    load();
  };

  const q = search.trim().toLowerCase();
  const shown = q ? visible.filter((v) => v.name.toLowerCase().includes(q)) : visible;
  const mine = shown.filter((v) => v.staff_id === staffId);
  const shared = shown.filter((v) => v.staff_id !== staffId);
  const pinned = visible.filter((v) => v.is_pinned);

  const renderRow = (v: SavedView) => (
    <div
      key={v.id}
      className={cn(
        "group flex items-center gap-1 rounded-md pl-2 pr-1 py-1 hover:bg-muted/60",
        v.id === activeId && "bg-primary/10",
      )}
    >
      <button
        type="button"
        className="flex-1 min-w-0 text-left"
        onClick={() => { applyView(v); setOpen(false); }}
        title="Abrir esta visão"
      >
        <span className="flex items-center gap-1.5 text-sm">
          <span className="truncate">{v.name}</span>
          {v.is_default && <Star className="h-3 w-3 shrink-0 text-amber-500 fill-amber-500" />}
          {v.is_pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
          {v.is_shared && <Users className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </span>
        {(v.staff_id !== staffId || (scope === "pipeline" && !v.pipeline_id)) && (
          <span className="block text-[11px] text-muted-foreground truncate">
            {v.staff_id !== staffId ? `de ${v.owner?.name || "outra pessoa"}` : ""}
            {v.staff_id !== staffId && scope === "pipeline" && !v.pipeline_id ? ", " : ""}
            {scope === "pipeline" && !v.pipeline_id ? "todos os funis" : ""}
          </span>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" title="Opções da visão">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={() => togglePin(v)}>
            {v.is_pinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
            {v.is_pinned ? "Tirar dos atalhos" : "Fixar nos atalhos"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleDefault(v)}>
            {v.is_default ? <StarOff className="h-4 w-4 mr-2" /> : <Star className="h-4 w-4 mr-2" />}
            {v.is_default ? "Deixar de ser a padrão" : "Definir como padrão"}
          </DropdownMenuItem>
          {canEdit(v) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => updateWithCurrent(v)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar com os filtros atuais
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openRename(v)}>
                <Pencil className="h-4 w-4 mr-2" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleShare(v)}>
                {v.is_shared ? <UserX className="h-4 w-4 mr-2" /> : <Users className="h-4 w-4 mr-2" />}
                {v.is_shared ? "Parar de compartilhar" : "Compartilhar com o time"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setToDelete(v); setOpen(false); }}>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (!staffId) return null;

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap min-w-0", className)}>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5 font-normal", compact ? "h-7 px-2 text-[11px]" : "h-7 px-2.5 text-xs", active && "border-primary/50")}
            title="Visões salvas: filtros guardados com nome"
          >
            <Bookmark className={cn("h-3.5 w-3.5", active && "text-primary fill-primary/20")} />
            <span className="truncate max-w-[160px]">{active ? active.name : "Visões"}</span>
            {activeChanged && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" title="Os filtros mudaram desde que a visão foi aberta" />}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar visão..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 h-8 text-sm"
              />
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-2">
            {!loaded ? (
              <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : visible.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-4">
                Nenhuma visão salva ainda. Monte os filtros do jeito que você usa e clique em "Salvar visão atual".
              </p>
            ) : shown.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-4">Nenhuma visão com esse nome.</p>
            ) : (
              <>
                {mine.length > 0 && (
                  <div>
                    <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Minhas</p>
                    {mine.map(renderRow)}
                  </div>
                )}
                {shared.length > 0 && (
                  <div>
                    <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Compartilhadas pelo time</p>
                    {shared.map(renderRow)}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="p-2 border-t border-border space-y-1">
            {active && activeChanged && canEdit(active) && (
              <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start" onClick={() => { updateWithCurrent(active); setOpen(false); }}>
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                Atualizar "{active.name}" com os filtros atuais
              </Button>
            )}
            <Button size="sm" className="w-full h-8 text-xs justify-start" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-2" />
              Salvar visão atual
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Atalhos: visões fixadas */}
      {pinned.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => applyView(v)}
          title={v.id === activeId && activeChanged ? "Os filtros mudaram. Clique para voltar à visão." : "Abrir esta visão"}
          className={cn(
            "rounded-full border whitespace-nowrap transition-colors flex items-center gap-1 max-w-[180px]",
            compact ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
            v.id === activeId
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
          )}
        >
          <span className="truncate">{v.name}</span>
          {v.id === activeId && activeChanged && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />}
        </button>
      ))}

      {/* Salvar / renomear */}
      <Dialog open={!!nameDialog} onOpenChange={(o) => { if (!o && !saving) setNameDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{nameDialog?.mode === "rename" ? "Renomear visão" : "Salvar visão atual"}</DialogTitle>
            <DialogDescription>
              {nameDialog?.mode === "rename"
                ? "Só o nome muda. Os filtros continuam os mesmos."
                : "Guarda os filtros que estão na tela agora, pra reabrir com um clique."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="saved-view-name">Nome</Label>
              <Input
                id="saved-view-name"
                autoFocus
                maxLength={80}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitName(); }}
                placeholder="Ex.: Meus leads parados há 7 dias"
              />
            </div>
            {nameDialog?.mode === "create" && (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox id="saved-view-share" checked={shareValue} onCheckedChange={(c) => setShareValue(!!c)} />
                  <Label htmlFor="saved-view-share" className="text-sm font-normal cursor-pointer">Compartilhar com o time</Label>
                </div>
                {scope === "pipeline" && (
                  <div className="flex items-start gap-2">
                    <Checkbox id="saved-view-all" className="mt-0.5" checked={allPipelines} onCheckedChange={(c) => setAllPipelines(!!c)} />
                    <Label htmlFor="saved-view-all" className="text-sm font-normal cursor-pointer leading-snug">
                      Valer pra todos os funis
                      <span className="block text-[11px] text-muted-foreground">
                        Desmarcado, a visão só aparece neste funil. Filtro por etapa só faz sentido no funil em que foi criado.
                      </span>
                    </Label>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialog(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={submitName} disabled={saving || !nameValue.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {nameDialog?.mode === "rename" ? "Renomear" : "Salvar visão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a visão "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.is_shared
                ? "Ela some pra todo o time. Os leads e conversas não são afetados, só o atalho de filtros."
                : "Os leads e conversas não são afetados, só o atalho de filtros."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
