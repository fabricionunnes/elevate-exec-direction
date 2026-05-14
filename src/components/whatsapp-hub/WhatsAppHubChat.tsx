import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, Paperclip, Image, Mic, MicOff, User, Check, CheckCheck, ClipboardCheck, FileText, ExternalLink, AtSign } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CreateActionFromConversation } from "./CreateActionFromConversation";
import type { HubConversation, HubMessage, StaffInstance } from "@/pages/onboarding-tasks/WhatsAppHubPage";

interface Props {
  conversation: HubConversation;
  staffId: string;
  instance?: StaffInstance | null;
  onShowContact: () => void;
}

const isGroupJid = (phoneRaw: string) => {
  const digits = (phoneRaw || "").replace(/\D/g, "");
  // Group LID JIDs start with 120363 and are very long, or contain @g.us
  return phoneRaw.includes("@g.us") || (digits.startsWith("120363") && digits.length > 15);
};

const normalizePhoneDigits = (phoneRaw: string) => {
  let digits = (phoneRaw || "").replace(/\D/g, "");
  if (!digits) return "";
  // Don't normalize group JIDs
  if (isGroupJid(phoneRaw)) return digits;
  if (!digits.startsWith("55")) digits = `55${digits}`;
  if (digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    digits = `55${ddd}9${number}`;
  }
  return digits;
};

const normalizeMessage = (message: any): HubMessage => ({
  id: message.id,
  conversation_id: message.conversation_id,
  content: message.content ?? null,
  media_url: message.media_url ?? null,
  media_type: message.media_mimetype ?? message.type ?? null,
  direction: message.direction === "outbound" ? "outgoing" : "incoming",
  status: message.status ?? "sent",
  created_at: message.created_at,
  remote_id: message.remote_id ?? null,
  sent_by: message.sent_by ?? null,
  sender_phone: message.sender_phone ?? null,
  sender_name: message.sender_name ?? null,
});

export const WhatsAppHubChat = ({ conversation, staffId, instance, onShowContact }: Props) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [groupParticipants, setGroupParticipants] = useState<{ phone: string; name: string }[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isGroup = isGroupJid(conversation.contact_phone);

  // Build participant list: prefer fetched group participants, fallback to senders from history
  const participants = useMemo(() => {
    if (groupParticipants.length > 0) return groupParticipants;
    const map = new Map<string, string>();
    for (const m of messages) {
      if (m.sender_phone) {
        const existing = map.get(m.sender_phone);
        if (!existing || (m.sender_name && !existing)) {
          map.set(m.sender_phone, m.sender_name || m.sender_phone);
        }
      }
    }
    return Array.from(map.entries()).map(([phone, name]) => ({ phone, name }));
  }, [messages, groupParticipants]);

  const activeInstance = instance ?? (conversation.instance_id && conversation.instance
    ? {
        id: conversation.instance.id,
        instance_name: conversation.instance.instance_name,
        display_name: conversation.instance.display_name,
        phone_number: null,
        status: conversation.instance.status ?? "connected",
        qr_code: null,
      }
    : null);

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    setMessages((data || []).map(normalizeMessage));
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();

    if ((conversation.unread_count || 0) > 0) {
      supabase
        .from("crm_whatsapp_conversations")
        .update({ unread_count: 0 })
        .eq("id", conversation.id)
        .then(() => {});
    }

    const channel = supabase
      .channel(`crm_wa_msgs_${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crm_whatsapp_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages((prev) => {
              const normalized = normalizeMessage(payload.new);
              if (prev.some((message) => message.id === normalized.id)) return prev;
              return [...prev, normalized];
            });
          }

          if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === payload.new.id ? normalizeMessage(payload.new) : message
              )
            );
          }

          if (payload.eventType === "DELETE") {
            setMessages((prev) => prev.filter((message) => message.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const ensureSendable = () => {
    if (!activeInstance?.id) {
      toast.error("Nenhuma instância disponível para esta conversa");
      return null;
    }

    if (activeInstance.status && activeInstance.status !== "connected") {
      toast.error("A instância desta conversa não está conectada");
      return null;
    }

    const phone = normalizePhoneDigits(conversation.contact_phone);
    if (!phone) {
      toast.error("Telefone inválido");
      return null;
    }

    return { instanceId: activeInstance.id, phone };
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    const sendTarget = ensureSendable();
    if (!sendTarget) return;

    setSending(true);
    try {
      const { data: inserted, error: insertError } = await supabase
        .from("crm_whatsapp_messages")
        .insert({
          conversation_id: conversation.id,
          content: newMessage.trim(),
          type: "text",
          direction: "outbound",
          status: "pending",
          sent_by: staffId,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      const validMentioned = mentioned.filter((p) => newMessage.includes(`@${p}`));

      const { data: sendData, error: sendError } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "sendText",
          instanceId: sendTarget.instanceId,
          phone: sendTarget.phone,
          message: newMessage.trim(),
          mentioned: isGroup && validMentioned.length > 0 ? validMentioned : undefined,
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
          last_message: newMessage.trim(),
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        })
        .eq("id", conversation.id);

      setNewMessage("");
      setMentioned([]);
      // Realtime subscription handles new message display
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const sendMediaMessage = async (file: File) => {
    const sendTarget = ensureSendable();
    if (!sendTarget) return;

    setSending(true);
    try {
      const fileExt = file.name.split(".").pop() || "bin";
      const storagePath = `outbound/hub/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("whatsapp-media")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(storagePath);
      const mediaUrl = urlData.publicUrl;

      const mediaType = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : "document";

      const content = mediaType === "document" ? file.name : `[${mediaType}]`;

      const { data: inserted, error: insertError } = await supabase
        .from("crm_whatsapp_messages")
        .insert({
          conversation_id: conversation.id,
          content,
          type: mediaType,
          direction: "outbound",
          status: "pending",
          sent_by: staffId,
          media_url: mediaUrl,
          media_mimetype: file.type,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      const { data: sendData, error: sendError } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "sendMedia",
          instanceId: sendTarget.instanceId,
          phone: sendTarget.phone,
          mediaType,
          mediaUrl,
          fileName: file.name,
          caption: "",
        },
      });

      if (sendError || sendData?.error) {
        await supabase
          .from("crm_whatsapp_messages")
          .update({ status: "failed" })
          .eq("id", inserted.id);
        throw sendError || new Error(sendData?.error || "Erro ao enviar arquivo");
      }

      await supabase
        .from("crm_whatsapp_messages")
        .update({ status: "sent", remote_id: sendData?.key?.id ?? null })
        .eq("id", inserted.id);

      await supabase
        .from("crm_whatsapp_conversations")
        .update({
          last_message: content,
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        })
        .eq("id", conversation.id);

      toast.success("Arquivo enviado");
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) sendMediaMessage(file);
    e.target.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: "audio/webm" });
        sendMediaMessage(file);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-3 border-b shrink-0 bg-background">
        <button onClick={onShowContact} className="flex items-center gap-2 hover:opacity-80">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
            {(conversation.contact_name || conversation.contact_phone)[0]?.toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">{conversation.contact_name || conversation.contact_phone}</p>
            <p className="text-xs text-muted-foreground">{conversation.contact_phone}</p>
          </div>
        </button>
        <div className="ml-auto flex items-center gap-1">
          {conversation.project_id && conversation.project && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => navigate(`/onboarding-tasks/${conversation.project_id}`)}
              title="Ir para o projeto"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline max-w-[120px] truncate">{conversation.project?.product_name}</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setShowActionDialog(true)} title="Criar ação/tarefa">
            <ClipboardCheck className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onShowContact}>
            <User className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">Carregando mensagens...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem ainda</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.direction === "outgoing" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                  msg.direction === "outgoing"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-background border rounded-bl-sm"
                )}
              >
                {isGroup && msg.direction === "incoming" && (msg.sender_name || msg.sender_phone) && (
                  <p className="text-[11px] font-semibold text-primary mb-0.5">
                    {msg.sender_name || msg.sender_phone}
                  </p>
                )}
                {msg.media_url && (
                  <div className="mb-1">
                    {msg.media_type?.startsWith("image") ? (
                      <img src={msg.media_url} alt="Mídia enviada" className="rounded max-w-full max-h-48 object-cover" />
                    ) : msg.media_type?.startsWith("audio") ? (
                      <audio controls className="max-w-full" src={msg.media_url} />
                    ) : (
                      <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs underline">
                        <FileText className="h-3 w-3" /> {msg.content || "Arquivo"}
                      </a>
                    )}
                  </div>
                )}
                {msg.content && !msg.media_type?.startsWith("audio") && (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                )}
                <div className={cn("flex items-center gap-1 mt-1", msg.direction === "outgoing" ? "justify-end" : "justify-start")}>
                  <span className={cn("text-[10px]", msg.direction === "outgoing" ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {format(new Date(msg.created_at), "HH:mm")}
                  </span>
                  {msg.direction === "outgoing" && (
                    msg.status === "read" ? (
                      <CheckCheck className="h-3 w-3 text-primary-foreground/80" />
                    ) : (
                      <Check className="h-3 w-3 text-primary-foreground/80" />
                    )
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

      <div className="p-3 border-t bg-background shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-1.5">
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => imageInputRef.current?.click()} disabled={sending}>
            <Image className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => fileInputRef.current?.click()} disabled={sending}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("shrink-0", isRecording && "text-destructive")}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={sending}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          {isGroup && (
            <Popover open={mentionPickerOpen} onOpenChange={setMentionPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="shrink-0" disabled={sending} title="Marcar pessoa">
                  <AtSign className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <p className="text-xs text-muted-foreground mb-2 px-2">Marcar participante</p>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {participants.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                      Aguarde mensagens do grupo para listar participantes.
                    </p>
                  ) : (
                    participants.map((p) => (
                      <button
                        key={p.phone}
                        type="button"
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm flex items-center justify-between gap-2"
                        onClick={() => {
                          setNewMessage((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}@${p.phone} `);
                          setMentioned((prev) => Array.from(new Set([...prev, p.phone])));
                          setMentionPickerOpen(false);
                        }}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">@{p.phone.slice(-4)}</span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Input
            placeholder="Digite uma mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
            disabled={sending || isRecording}
          />
          <Button type="submit" size="icon" disabled={sending || !newMessage.trim() || isRecording} className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
        {isRecording && (
          <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            Gravando... Clique no ícone para parar
          </div>
        )}
      </div>

      <CreateActionFromConversation
        open={showActionDialog}
        onOpenChange={setShowActionDialog}
        conversation={conversation}
        staffId={staffId}
      />
    </div>
  );
};
