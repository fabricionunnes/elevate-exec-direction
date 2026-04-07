import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Loader2, Users, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { StaffInstance, HubConversation } from "@/pages/onboarding-tasks/WhatsAppHubPage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
  instance: StaffInstance | null;
}

export const WhatsAppBulkSendDialog = ({ open, onOpenChange, staffId, instance }: Props) => {
  const [conversations, setConversations] = useState<HubConversation[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [interval, setInterval] = useState(5);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) fetchConversations();
  }, [open]);

  const fetchConversations = async () => {
    const { data } = await supabase
      .from("staff_whatsapp_conversations")
      .select("*")
      .eq("staff_id", staffId)
      .order("contact_name");
    setConversations(data as unknown as HubConversation[] || []);
  };

  const toggleAll = () => {
    if (selected.length === filtered.length) {
      setSelected([]);
    } else {
      setSelected(filtered.map(c => c.id));
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.contact_name?.toLowerCase().includes(q) || c.contact_phone.includes(q);
  });

  const handleSend = async () => {
    if (!message.trim() || selected.length === 0) return;
    if (!instance || instance.status !== "connected") {
      toast.error("WhatsApp não está conectado");
      return;
    }

    setSending(true);
    setProgress({ sent: 0, total: selected.length });

    const selectedConvs = conversations.filter(c => selected.includes(c.id));

    for (let i = 0; i < selectedConvs.length; i++) {
      const conv = selectedConvs[i];
      try {
        // Save message
        await supabase.from("staff_whatsapp_messages").insert({
          conversation_id: conv.id,
          staff_id: staffId,
          content: message.trim(),
          direction: "outgoing",
          status: "sent",
        });

        // Update conversation
        await supabase.from("staff_whatsapp_conversations").update({
          last_message: message.trim(),
          last_message_at: new Date().toISOString(),
        }).eq("id", conv.id);

        // Send via API
        await supabase.functions.invoke("evolution-api", {
          body: {
            action: "send-text",
            instanceName: instance.instance_name,
            phone: conv.contact_phone.replace(/\D/g, ""),
            message: message.trim(),
          },
        });

        setProgress({ sent: i + 1, total: selected.length });

        // Wait between messages
        if (i < selectedConvs.length - 1) {
          await new Promise(r => setTimeout(r, interval * 1000));
        }
      } catch (err) {
        console.warn(`Erro ao enviar para ${conv.contact_name}:`, err);
      }
    }

    toast.success(`${selectedConvs.length} mensagens enviadas!`);
    setSending(false);
    setProgress({ sent: 0, total: 0 });
    setSelected([]);
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={sending ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Envio em Massa
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Envie com intervalos para evitar bloqueios. Recomendado: 5-10 segundos entre mensagens.</p>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea
              placeholder="Digite a mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              disabled={sending}
            />
          </div>

          {/* Interval */}
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Intervalo (segundos):</Label>
            <Input
              type="number"
              min={2}
              max={60}
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              className="w-20 h-8"
              disabled={sending}
            />
          </div>

          {/* Contact Selection */}
          <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <Label>Contatos ({selected.length}/{filtered.length})</Label>
              <Button variant="ghost" size="sm" onClick={toggleAll} disabled={sending}>
                {selected.length === filtered.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>
            <Input
              placeholder="Buscar contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
              disabled={sending}
            />
            <ScrollArea className="flex-1 max-h-40 border rounded-md">
              {filtered.map(conv => (
                <label
                  key={conv.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm border-b border-border/50 last:border-0"
                >
                  <Checkbox
                    checked={selected.includes(conv.id)}
                    onCheckedChange={() => toggleOne(conv.id)}
                    disabled={sending}
                  />
                  <span className="truncate">{conv.contact_name || conv.contact_phone}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{conv.contact_phone}</span>
                </label>
              ))}
            </ScrollArea>
          </div>

          {/* Progress */}
          {sending && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-green-500" />
              <span className="text-sm font-medium">
                Enviando {progress.sent}/{progress.total}...
              </span>
              <div className="flex-1 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${(progress.sent / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={sending || !message.trim() || selected.length === 0}
            className="w-full bg-green-500 hover:bg-green-600"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {sending ? "Enviando..." : `Enviar para ${selected.length} contatos`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
