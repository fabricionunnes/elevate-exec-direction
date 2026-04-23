import { useState, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AVAILABLE_VARIABLES = [
  { key: '{{nome_cliente}}', label: 'Nome' },
  { key: '{{empresa}}', label: 'Empresa' },
  { key: '{{email}}', label: 'E-mail' },
  { key: '{{telefone}}', label: 'Telefone' },
  { key: '{{responsavel}}', label: 'Responsável' },
  { key: '{{link_agendamento}}', label: 'Link Agendamento' },
  { key: '{{data_hora_agendamento}}', label: 'Data/Hora Agend.' },
];

interface LeadContext {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  ownerName?: string;
  meetingLink?: string;
  meetingDateTime?: string;
}

export interface WhatsAppInstanceOption {
  id: string;
  instance_name: string;
  display_name?: string | null;
}

interface WhatsAppMessageDialogProps {
  phone: string;
  recipientName?: string;
  defaultMessage?: string;
  onClose: () => void;
  onSend: (message: string, instanceId?: string) => Promise<void>;
  sending: boolean;
  leadContext?: LeadContext;
  instances?: WhatsAppInstanceOption[];
  defaultInstanceId?: string;
}

const MESSAGE_TEMPLATES = [
  {
    label: "Lembrete de Reunião",
    message: "Olá, {{nome_cliente}}! 👋 Passando para lembrar da nossa reunião agendada. Confirma sua presença?",
  },
  {
    label: "Follow-up",
    message: "Olá, {{nome_cliente}}! Como estão as coisas por aí? Gostaria de saber se posso ajudar em algo. 🚀",
  },
  {
    label: "Boas Vindas",
    message: "Olá, {{nome_cliente}}! Seja muito bem-vindo(a)! Estamos prontos para ajudá-lo(a) a alcançar seus objetivos. 🎯",
  },
  {
    label: "Atualização",
    message: "Olá, {{nome_cliente}}! Passando para compartilhar uma atualização importante sobre seu projeto. Podemos conversar?",
  },
];

function resolveVariables(text: string, ctx?: LeadContext): string {
  if (!text || !ctx) return text;
  return text
    .replace(/\{\{nome_cliente\}\}/g, ctx.name || '')
    .replace(/\{\{empresa\}\}/g, ctx.company || '')
    .replace(/\{\{email\}\}/g, ctx.email || '')
    .replace(/\{\{telefone\}\}/g, ctx.phone || '')
    .replace(/\{\{responsavel\}\}/g, ctx.ownerName || '')
    .replace(/\{\{link_agendamento\}\}/g, ctx.meetingLink || '')
    .replace(/\{\{data_hora_agendamento\}\}/g, ctx.meetingDateTime || '');
}

export const WhatsAppMessageDialog = ({
  phone,
  recipientName,
  defaultMessage = "",
  onClose,
  onSend,
  sending,
  leadContext,
  instances,
  defaultInstanceId,
}: WhatsAppMessageDialogProps) => {
  const [message, setMessage] = useState(defaultMessage);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(
    defaultInstanceId || instances?.[0]?.id || ""
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!message.trim()) return;
    if (instances && instances.length > 0 && !selectedInstanceId) return;
    const resolved = resolveVariables(message.trim(), leadContext);
    await onSend(resolved, selectedInstanceId || undefined);
  };

  const applyTemplate = (template: string) => {
    setMessage(template);
  };

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessage((prev) => prev + variable);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = message.substring(0, start) + variable + message.substring(end);
    setMessage(newText);
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + variable.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  // Preview of what message will look like after variable resolution
  const previewMessage = resolveVariables(message, leadContext);
  const hasVariables = /\{\{.+?\}\}/.test(message);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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

          {/* Instance selector */}
          {instances && instances.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Instância de envio:
              </Label>
              {instances.length === 1 ? (
                <div className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm">
                  {instances[0].display_name || instances[0].instance_name}
                </div>
              ) : (
                <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.display_name || inst.instance_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

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

          {/* Variables */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Variáveis Dinâmicas:</Label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_VARIABLES.map((v) => (
                <Button
                  key={v.key}
                  variant="secondary"
                  size="sm"
                  onClick={() => insertVariable(v.key)}
                  className="text-xs h-7 px-2"
                >
                  {v.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              ref={textareaRef}
              id="message"
              placeholder="Digite sua mensagem... Use {{nome_cliente}} para variáveis"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length} caracteres
            </p>
          </div>

          {/* Preview */}
          {hasVariables && previewMessage && (
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Pré-visualização:</Label>
              <div className="bg-muted/30 rounded-lg p-3 text-sm whitespace-pre-wrap border border-border">
                {previewMessage}
              </div>
            </div>
          )}
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
