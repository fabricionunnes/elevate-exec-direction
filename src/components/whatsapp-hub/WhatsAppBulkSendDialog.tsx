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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Loader2, Users, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { HubConversation } from "@/pages/onboarding-tasks/WhatsAppHubPage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
}

const normalizePhoneDigits = (phoneRaw: string) => {
  let digits = (phoneRaw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = `55${digits}`;
  if (digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    digits = `55${ddd}9${number}`;
  }
  return digits;
};

export const WhatsAppBulkSendDialog = ({ open, onOpenChange, staffId }: Props) => {
  const [conversations, setConversations] = useState<HubConversation[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [interval, setInterval] = useState(5);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) fetchConversations();
  }, [open, staffId]);

  const fetchSendableInstanceIds = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return [] as string[];

    const { data: staff } = await supabase
      .from("onboarding_staff")
      .select("id, role")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!staff) return [] as string[];

    if (staff.role === "master") {
      const { data } = await supabase.from("whatsapp_instances").select("id").eq("status", "connected");
      return (data || []).map((item) => item.id);
    }

    const { data } = await supabase
      .from("whatsapp_instance_access")
      .select("instance_id, instance:whatsapp_instances(id, status)")
      .eq("staff_id", staff.id)
      .eq("can_send", true);

    return (data || [])
      .filter((item: any) => item.instance?.status === "connected")
      .map((item: any) => item.instance_id);
  };

  const fetchConversations = async () => {
    const instanceIds = await fetchSendableInstanceIds();
    if (instanceIds.length === 0) {
      setConversations([]);
      return;
    }

    const { data } = await supabase
      .from("crm_whatsapp_conversations")
      .select(`
        id,
        instance_id,
        last_message,
        last_message_at,
        unread_count,
        status,
        created_at,
        contact:crm_whatsapp_contacts(name, phone, profile_picture_url)
      `)
      .in("instance_id", instanceIds)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    const mapped = (data || []).map((conversation: any) => ({
      id: conversation.id,
      instance_id: conversation.instance_id,
      lead_id: null,
      contact_name: conversation.contact?.name || null,
      contact_phone: conversation.contact?.phone || "",
      contact_photo_url: conversation.contact?.profile_picture_url || null,
      project_id: null,
      last_message: conversation.last_message || null,
      last_message_at: conversation.last_message_at || null,
      unread_count: conversation.unread_count || 0,
      status: conversation.status || "open",
      created_at: conversation.created_at || new Date().toISOString(),
      project: null,
      staff: null,
      instance: null,
    })) as HubConversation[];

    setConversations(mapped);
  };

  const toggleAll = () => {
    if (selected.length === filtered.length) setSelected([]);
    else setSelected(filtered.map((conversation) => conversation.id));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const filtered = conversations.filter((conversation) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      conversation.contact_name?.toLowerCase().includes(term) ||
      conversation.contact_phone.toLowerCase().includes(term)
    );
  });

  const handleSend = async () => {
    if (!message.trim() || selected.length === 0) return;

    setSending(true);
    setProgress({ sent: 0, total: selected.length });

    const selectedConversations = conversations.filter((conversation) => selected.includes(conversation.id));

    for (let i = 0; i < selectedConversations.length; i += 1) {
      const conversation = selectedConversations[i];
      try {
        if (!conversation.instance_id) throw new Error("Instância ausente");

        const phone = normalizePhoneDigits(conversation.contact_phone);
        if (!phone) throw new Error("Telefone inválido");

        const { data: inserted, error: insertError } = await supabase
          .from("crm_whatsapp_messages")
          .insert({
            conversation_id: conversation.id,
            content: message.trim(),
            type: "text",
            direction: "outbound",
            status: "pending",
            sent_by: staffId,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        const { data: sendData, error: sendError } = await supabase.functions.invoke("evolution-api", {
          body: {
            action: "sendText",
            instanceId: conversation.instance_id,
            phone,
            message: message.trim(),
          },
        });

        if (sendError || sendData?.error) {
          await supabase
            .from("crm_whatsapp_messages")
            .update({ status: "failed" })
            .eq("id", inserted.id);
          throw sendError || new Error(sendData?.error || "Erro ao enviar mensagem");
        }

        await supabase
          .from("crm_whatsapp_messages")
          .update({ status: "sent", remote_id: sendData?.key?.id ?? null })
          .eq("id", inserted.id);

        await supabase
          .from("crm_whatsapp_conversations")
          .update({
            last_message: message.trim(),
            last_message_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);

        setProgress({ sent: i + 1, total: selected.length });

        if (i < selectedConversations.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, interval * 1000));
        }
      } catch (error) {
        console.warn(`Erro ao enviar para ${conversation.contact_name || conversation.contact_phone}:`, error);
      }
    }

    toast.success(`${selectedConversations.length} mensagens processadas!`);
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
          <div className="flex items-start gap-2 p-3 bg-muted rounded-lg text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Envie com intervalos para evitar bloqueios. Recomendado: 5-10 segundos entre mensagens.</p>
          </div>

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
              {filtered.map((conversation) => (
                <label
                  key={conversation.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm border-b border-border/50 last:border-0"
                >
                  <Checkbox
                    checked={selected.includes(conversation.id)}
                    onCheckedChange={() => toggleOne(conversation.id)}
                    disabled={sending}
                  />
                  <span className="truncate">{conversation.contact_name || conversation.contact_phone}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{conversation.contact_phone}</span>
                </label>
              ))}
            </ScrollArea>
          </div>

          {sending && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Enviando {progress.sent}/{progress.total}...</span>
              <div className="flex-1 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress.total ? (progress.sent / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          <Button onClick={handleSend} disabled={sending || !message.trim() || selected.length === 0} className="w-full">
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {sending ? "Enviando..." : `Enviar para ${selected.length} contatos`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
