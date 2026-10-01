import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Filter, Loader2, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LeadList, LIST_COLORS, createLeadList, exportLeadListCsv, fetchLeadLists } from "./leadLists";

interface LeadListsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string | null;
  /** master/admin: alteram e apagam lista de qualquer pessoa */
  canManageAll?: boolean;
  /** exportar é dado sensível: mesma regra do exportar do funil */
  canExport?: boolean;
  /** "Ver leads": a tela filtra por esta lista */
  onOpenList?: (list: LeadList) => void;
  /** avisa a tela que as listas mudaram (pra recarregar o filtro "Lista") */
  onChanged?: () => void;
}

type Form = { id: string | null; name: string; description: string; color: string; is_shared: boolean };
const emptyForm: Form = { id: null, name: "", description: "", color: LIST_COLORS[0], is_shared: true };

/** Gestão das listas de leads: criar, editar, ver quantidade, exportar CSV e excluir. */
export function LeadListsDialog({
  open, onOpenChange, staffId, canManageAll = false, canExport = false, onOpenList, onChanged,
}: LeadListsDialogProps) {
  const [lists, setLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<LeadList | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const db = supabase as any;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLists(await fetchLeadLists());
    } catch (e) {
      console.error("crm_lead_lists_overview:", e);
      toast.error("Não consegui carregar as listas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) { setSearch(""); setForm(null); load(); }
  }, [open, load]);

  const canEdit = (l: LeadList) => l.created_by === staffId || canManageAll;

  const save = async () => {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await db.from("crm_lead_lists")
          .update({ name: form.name.trim(), description: form.description.trim() || null, color: form.color, is_shared: form.is_shared })
          .eq("id", form.id);
        if (error) throw error;
        toast.success("Lista atualizada");
      } else {
        await createLeadList({ name: form.name, description: form.description, color: form.color, is_shared: form.is_shared });
        toast.success("Lista criada");
      }
      setForm(null);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Não consegui salvar a lista");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await db.from("crm_lead_lists").delete().eq("id", toDelete.id);
    if (error) { toast.error(error.message || "Não consegui excluir a lista"); return; }
    toast.success(`Lista "${toDelete.name}" excluída`);
    setToDelete(null);
    await load();
    onChanged?.();
  };

  const exportCsv = async (l: LeadList) => {
    setExportingId(l.id);
    try {
      const n = await exportLeadListCsv(l);
      if (n) toast.success(`${n.toLocaleString("pt-BR")} lead(s) exportado(s)`);
      else toast.error("Esta lista não tem leads que você possa ver");
    } catch (e: any) {
      console.error("export list:", e);
      toast.error(e?.message || "Não consegui exportar a lista");
    } finally {
      setExportingId(null);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = q ? lists.filter((l) => l.name.toLowerCase().includes(q) || (l.description || "").toLowerCase().includes(q)) : lists;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Listas de leads</DialogTitle>
            <DialogDescription>
              Agrupe leads à mão, de qualquer funil, pra filtrar, exportar ou trabalhar em cima do grupo.
            </DialogDescription>
          </DialogHeader>

          {form ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="list-name">Nome</Label>
                <Input id="list-name" autoFocus maxLength={80} value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex.: Convidados da Imersão de outubro" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="list-desc">Descrição</Label>
                <Textarea id="list-desc" rows={2} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Pra que serve esta lista (opcional)" />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex gap-1.5">
                  {LIST_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} title="Cor da lista"
                      className={cn("h-6 w-6 rounded-full border-2 transition-transform", form.color === c ? "border-foreground scale-110" : "border-transparent")}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="list-shared" checked={form.is_shared} onCheckedChange={(c) => setForm({ ...form, is_shared: !!c })} />
                <Label htmlFor="list-shared" className="text-sm font-normal cursor-pointer">Compartilhar com o time</Label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>Voltar</Button>
                <Button onClick={save} disabled={saving || !form.name.trim()}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {form.id ? "Salvar" : "Criar lista"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar lista..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
                </div>
                <Button size="sm" className="h-9" onClick={() => setForm({ ...emptyForm })}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nova lista
                </Button>
              </div>

              <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border divide-y divide-border">
                {loading ? (
                  <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : lists.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6 text-center">
                    Nenhuma lista ainda. Crie uma aqui ou selecione leads e use "Adicionar à lista".
                  </p>
                ) : shown.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6 text-center">Nenhuma lista com esse nome.</p>
                ) : shown.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color || "#64748b" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">
                        <span className="truncate">{l.name}</span>
                        {l.is_shared && <Users className="h-3 w-3 shrink-0 text-muted-foreground" />}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {l.lead_count.toLocaleString("pt-BR")} lead{l.lead_count === 1 ? "" : "s"}
                        {l.owner_name ? `, criada por ${l.created_by === staffId ? "você" : l.owner_name}` : ""}
                        {l.description ? `. ${l.description}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {onOpenList && (
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { onOpenList(l); onOpenChange(false); }} title="Filtrar a tela por esta lista">
                          <Filter className="h-3.5 w-3.5 mr-1" />
                          Ver leads
                        </Button>
                      )}
                      {canExport && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => exportCsv(l)} disabled={exportingId === l.id || l.lead_count === 0} title="Exportar CSV">
                          {exportingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                      )}
                      {canEdit(l) && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar lista"
                            onClick={() => setForm({ id: l.id, name: l.name, description: l.description || "", color: l.color || LIST_COLORS[0], is_shared: l.is_shared })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir lista" onClick={() => setToDelete(l)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a lista "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A lista some{toDelete?.is_shared ? " pra todo o time" : ""}. Os {toDelete?.lead_count.toLocaleString("pt-BR")} lead(s) continuam no CRM, só deixam de estar agrupados aqui.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
              Excluir lista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
