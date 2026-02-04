import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileSignature, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useSendLeadContract } from "@/hooks/useSendLeadContract";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SendContractButtonProps {
  leadId: string;
  variant?: "icon" | "full";
  className?: string;
  onSuccess?: () => void;
}

export function SendContractButton({
  leadId,
  variant = "icon",
  className,
  onSuccess,
}: SendContractButtonProps) {
  const { sendContract, isSending } = useSendLeadContract();
  const [missingFieldsDialog, setMissingFieldsDialog] = useState(false);
  const [missingFields, setMissingFields] = useState<{ field: string; label: string }[]>([]);
  const [successDialog, setSuccessDialog] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const result = await sendContract(leadId);

    if (result.success) {
      setDocumentUrl(result.documentUrl || null);
      setSuccessDialog(true);
      toast.success("Contrato enviado para assinatura!");
      onSuccess?.();
    } else if (result.missingFields && result.missingFields.length > 0) {
      setMissingFields(result.missingFields);
      setMissingFieldsDialog(true);
    } else {
      toast.error(result.error || "Erro ao enviar contrato");
    }
  };

  if (variant === "full") {
    return (
      <>
        <Button
          onClick={handleClick}
          disabled={isSending}
          className={cn("gap-2", className)}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSignature className="h-4 w-4" />
          )}
          Enviar Contrato
        </Button>

        <MissingFieldsDialog
          open={missingFieldsDialog}
          onOpenChange={setMissingFieldsDialog}
          missingFields={missingFields}
        />

        <SuccessDialog
          open={successDialog}
          onOpenChange={setSuccessDialog}
          documentUrl={documentUrl}
        />
      </>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md hover:bg-purple-100 hover:text-purple-600",
              className
            )}
            onClick={handleClick}
            disabled={isSending}
          >
            {isSending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSignature className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Enviar Contrato
        </TooltipContent>
      </Tooltip>

      <MissingFieldsDialog
        open={missingFieldsDialog}
        onOpenChange={setMissingFieldsDialog}
        missingFields={missingFields}
      />

      <SuccessDialog
        open={successDialog}
        onOpenChange={setSuccessDialog}
        documentUrl={documentUrl}
      />
    </TooltipProvider>
  );
}

function MissingFieldsDialog({
  open,
  onOpenChange,
  missingFields,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingFields: { field: string; label: string }[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-5 w-5" />
            Campos Obrigatórios Faltando
          </DialogTitle>
          <DialogDescription>
            Para enviar o contrato, preencha os seguintes campos no lead:
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ul className="space-y-2">
            {missingFields.map((field) => (
              <li
                key={field.field}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {field.label}
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuccessDialog({
  open,
  onOpenChange,
  documentUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentUrl: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            Contrato Enviado!
          </DialogTitle>
          <DialogDescription>
            O contrato foi enviado para assinatura. O cliente receberá um e-mail
            com o link para assinar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          {documentUrl && (
            <Button
              variant="outline"
              onClick={() => window.open(documentUrl, "_blank")}
            >
              Ver no ZapSign
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
