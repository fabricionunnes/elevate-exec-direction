import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LeadList, LIST_COLORS, addLeadsToList, createLeadList, fetchLeadLists } from "./leadLists";

interface AddToListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** leads selecionados; o diálogo mesmo grava na lista */
  leadIds: string[];
  /** depois de gravar (limpar seleção, recarregar) */
  onSuccess?: (list: { id: string; name: string }) => void;
  /**
   * Quando informado, o diálogo só escolhe (ou cria) a lista e entrega pra quem chamou
   * aplicar. É o caso de "todos do filtro", em que quem inclui é a RPC crm_leads_bulk.
   */
  onPick?: (list: { id: string; name: string }) => Promise<void> | void;
  /** texto da contagem quando onPick é usado (ex.: "1.240 leads do filtro") */
  countLabel?: string;
}

/**
 * Adicionar leads a uma lista: escolhe uma lista existente (com busca) ou cria uma nova
 * na hora. Usado na barra de ações em massa do kanban e de Contatos.
 */
export function AddToListDialog({ open, onOpenChange, leadIds, onSuccess, onPick, countLabel }: AddToListDialogProps) {
  const [lists, setLists] = useState<LeadList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [listId, setListId] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(LIST_COLORS[0]);
  const [shared, setShared] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setListId("");
    setName("");
    setColor(LIST_COLORS[0]);
    setShared(true);
    setLoadingLists(true);
    fetchLeadLists()
      .then((ls) => { setLists(ls); setMode(ls.length ? "existing" : "new"); })
      .catch((e) => { console.error("crm_lead_lists_overview:", e); toast.error("Não consegui carregar as listas"); })
      .finally(() => setLoadingLists(false));
  }, [open]);

  const quantos = countLabel || `${leadIds.length} lead(s) selecionado(s)`;
  const canSubmit = mode === "existing" ? !!listId : !!name.trim();

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const list = mode === "existing"
        ? { id: listId, name: lists.find((l) => l.id === listId)?.name || "lista" }
        : await createLeadList({ name, color, is_shared: shared });
      if (onPick) {
        await onPick(list);
      } else {
        const added = await addLeadsToList(list.id, leadIds);
        const jaEstavam = leadIds.length - added;
        toast.success(
          `${added} lead(s) adicionado(s) à lista "${list.name}"` + (jaEstavam > 0 ? `. ${jaEstavam} já estava(m) nela.` : ""),
        );
        onSuccess?.(list);
      }
      onOpenChange(false);
    } catch (e: any) {
      console.error("add to list:", e);
      toast.error(e?.message || "Não consegui adicionar à lista");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar à lista</DialogTitle>
          <DialogDescription>{quantos}. Quem já está na lista não entra de novo.</DialogDescription>
        </DialogHeader>

        <div className="flex rounded-md border border-border overflow-hidden text-sm">
          {(["existing", "new"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              disabled={m === "existing" && lists.length === 0}
              className={cn(
                "flex-1 h-8 px-3 transition-colors disabled:opacity-50",
                mode === m ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
                m === "new" && "border-l border-border",
              )}
            >
              {m === "existing" ? "Lista existente" : "Nova lista"}
            </button>
          ))}
        </div>

        {loadingLists ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : mode === "existing" ? (
          <div className="space-y-1.5">
            <Label>Lista</Label>
            <SearchableSelect
              value={listId}
              onValueChange={setListId}
              options={lists.map((l) => ({ value: l.id, label: l.name, hint: `${l.lead_count.toLocaleString("pt-BR")} leads` }))}
              placeholder="Escolha a lista..."
              emptyMessage="Nenhuma lista com esse nome."
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-list-name">Nome da lista</Label>
              <Input
                id="new-list-name"
                autoFocus
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="Ex.: Convidados da Imersão de outubro"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex gap-1.5">
                {LIST_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    title="Cor da lista"
                    className={cn("h-6 w-6 rounded-full border-2 transition-transform", color === c ? "border-foreground scale-110" : "border-transparent")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="new-list-shared" checked={shared} onCheckedChange={(c) => setShared(!!c)} />
              <Label htmlFor="new-list-shared" className="text-sm font-normal cursor-pointer">Compartilhar com o time</Label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !canSubmit}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
