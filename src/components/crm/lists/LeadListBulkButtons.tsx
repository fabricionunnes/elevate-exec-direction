import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ListMinus, ListPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AddToListDialog } from "./AddToListDialog";
import { removeLeadsFromList } from "./leadLists";

interface LeadListBulkButtonsProps {
  /** leads selecionados */
  leadIds: string[];
  /** depois de incluir ou tirar (limpar seleção, recarregar) */
  onDone?: () => void;
  /** quando a tela está filtrada por UMA lista, aparece também o "Tirar da lista" */
  removeFrom?: { id: string; name: string } | null;
  disabled?: boolean;
  size?: "sm" | "default";
}

/**
 * Botões de lista pra uma barra de ações em massa: "Adicionar à lista" (abre o
 * AddToListDialog) e, se a tela estiver filtrada por uma lista, "Tirar da lista".
 */
export function LeadListBulkButtons({ leadIds, onDone, removeFrom = null, disabled = false, size = "sm" }: LeadListBulkButtonsProps) {
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    if (!removeFrom || !leadIds.length) return;
    setRemoving(true);
    try {
      const n = await removeLeadsFromList(removeFrom.id, leadIds);
      toast.success(`${n} lead(s) tirado(s) da lista "${removeFrom.name}"`);
      onDone?.();
    } catch (e: any) {
      console.error("remove from list:", e);
      toast.error(e?.message || "Não consegui tirar da lista");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)} disabled={disabled || leadIds.length === 0} title="Adicionar os selecionados a uma lista de leads">
        <ListPlus className="h-4 w-4 mr-2" />
        Adicionar à lista
      </Button>
      {removeFrom && (
        <Button variant="outline" size={size} onClick={remove} disabled={disabled || removing || leadIds.length === 0} title={`Tirar os selecionados da lista "${removeFrom.name}"`}>
          {removing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ListMinus className="h-4 w-4 mr-2" />}
          Tirar da lista
        </Button>
      )}
      <AddToListDialog open={open} onOpenChange={setOpen} leadIds={leadIds} onSuccess={() => onDone?.()} />
    </>
  );
}
