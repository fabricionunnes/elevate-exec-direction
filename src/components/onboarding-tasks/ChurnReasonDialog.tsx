import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CHURN_REASONS = [
  "Inadimplência",
  "Insatisfação durante a entrega",
  "Insatisfação no onboarding",
  "Não renovação",
  "Perfil incompatível",
  "Problemas financeiros",
  "Problemas internos do cliente",
  "Repassou a empresa",
  "Sem informação",
] as const;

type DialogMode = "churn" | "cancellation_signal";

interface ChurnReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, notes: string) => void;
  isLoading?: boolean;
  mode?: DialogMode;
  /** Cliente que já sinalizou cancelamento (16/11/2026, Fabrício: "o motivo tem que ser o mesmo de quando
   *  sinalizou cancelamento" e "não tem que dar opção de escolher, só de confirmar"): o encerramento usa o
   *  motivo e a observação gravados na sinalização, sem campo pra editar. */
  fixo?: { reason: string; notes: string } | null;
}

const DIALOG_CONFIG: Record<DialogMode, { title: string; description: string; confirmLabel: string }> = {
  churn: {
    title: "Motivo do Encerramento",
    description: "Informe o motivo do encerramento do projeto. Ambos os campos são obrigatórios.",
    confirmLabel: "Confirmar Encerramento",
  },
  cancellation_signal: {
    title: "Motivo da Sinalização de Cancelamento",
    description: "Informe o motivo pelo qual o cliente sinalizou cancelamento. Ambos os campos são obrigatórios.",
    confirmLabel: "Confirmar Sinalização",
  },
};

export function ChurnReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  mode = "churn",
  fixo = null,
}: ChurnReasonDialogProps) {
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const config = DIALOG_CONFIG[mode];

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setReason("");
      setNotes("");
    }
  }, [open]);

  const handleConfirm = () => {
    if (fixo) { onConfirm(fixo.reason, (fixo.notes || "").trim()); return; }
    if (!reason || !notes.trim()) return;
    onConfirm(reason, notes.trim());
  };

  const handleCancel = () => {
    setReason("");
    setNotes("");
    onOpenChange(false);
  };

  const isValid = fixo ? !!fixo.reason : reason && notes.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>
            {fixo
              ? "Este cliente já sinalizou cancelamento. O encerramento usa o mesmo motivo informado na sinalização."
              : config.description}
          </DialogDescription>
        </DialogHeader>

        {fixo ? (
          <div className="space-y-3 py-4">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Motivo</p>
                <p className="text-sm font-medium">{fixo.reason}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Observação</p>
                <p className="text-sm whitespace-pre-wrap">{fixo.notes?.trim() || "Sem observação registrada na sinalização."}</p>
              </div>
            </div>
          </div>
        ) : (
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="churn-reason">Motivo *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="churn-reason">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {CHURN_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="churn-notes">Observação detalhada *</Label>
            <Textarea
              id="churn-notes"
              placeholder={mode === "cancellation_signal" 
                ? "Descreva com detalhes o que o cliente relatou..."
                : "Descreva com detalhes o motivo do encerramento..."}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || isLoading}>
            {isLoading ? "Salvando..." : config.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
