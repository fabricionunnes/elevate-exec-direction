import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { formatPhone } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface WhatsAppMessageDialogProps {
  phone: string;
  recipientName?: string;
  defaultMessage?: string;
  onClose: () => void;
  onSend: (message: string) => Promise<void>;
  sending: boolean;
}

const MESSAGE_TEMPLATES = [
  {
    label: "Lembrete de Reunião",
    message: "Olá! 👋 Passando para lembrar da nossa reunião agendada. Confirma sua presença?",
  },
  {
    label: "Follow-up",
    message: "Olá! Como estão as coisas por aí? Gostaria de saber se posso ajudar em algo. 🚀",
  },
  {
    label: "Boas Vindas",
    message: "Olá! Seja muito bem-vindo(a) à Universidade das Vendas! Estamos prontos para ajudá-lo(a) a alcançar seus objetivos. 🎯",
  },
  {
    label: "Atualização",
    message: "Olá! Passando para compartilhar uma atualização importante sobre seu projeto. Podemos conversar?",
  },
];

export const WhatsAppMessageDialog = ({
  phone,
  recipientName,
  defaultMessage = "",
  onClose,
  onSend,
  sending,
}: WhatsAppMessageDialogProps) => {
  const [message, setMessage] = useState(defaultMessage);

  const handleSend = async () => {
    if (!message.trim()) return;
    await onSend(message.trim());
  };

  const applyTemplate = (template: string) => {
    if (recipientName) {
      setMessage(template.replace("Olá!", `Olá, ${recipientName}!`));
    } else {
      setMessage(template);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            Enviar WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipient Info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Enviando para:</p>
            <p className="font-medium">
              {recipientName ? `${recipientName} • ` : ""}
              {formatPhone(phone)}
            </p>
          </div>

          {/* Quick Templates */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Templates Rápidos:</Label>
            <div className="flex flex-wrap gap-2">
              {MESSAGE_TEMPLATES.map((template, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(template.message)}
                  className="text-xs"
                >
                  {template.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length} caracteres
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={!message.trim() || sending}
            className="bg-green-600 hover:bg-green-700"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
