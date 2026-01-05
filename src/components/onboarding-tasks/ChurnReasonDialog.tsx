import { useState } from "react";
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

interface ChurnReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, notes: string) => void;
  isLoading?: boolean;
}

export function ChurnReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: ChurnReasonDialogProps) {
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const handleConfirm = () => {
    if (!reason || !notes.trim()) return;
    onConfirm(reason, notes.trim());
    // Reset form after confirm
    setReason("");
    setNotes("");
  };

  const handleCancel = () => {
    setReason("");
    setNotes("");
    onOpenChange(false);
  };

  const isValid = reason && notes.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Motivo do Encerramento</DialogTitle>
          <DialogDescription>
            Informe o motivo do encerramento do projeto. Ambos os campos são obrigatórios.
          </DialogDescription>
        </DialogHeader>

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
              placeholder="Descreva com detalhes o motivo do encerramento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || isLoading}>
            {isLoading ? "Salvando..." : "Confirmar Encerramento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
