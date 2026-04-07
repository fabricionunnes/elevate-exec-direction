import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Paperclip, Image, Mic, MicOff, User, Check, CheckCheck, ClipboardCheck, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CreateActionFromConversation } from "./CreateActionFromConversation";
import type { HubConversation, HubMessage, StaffInstance } from "@/pages/onboarding-tasks/WhatsAppHubPage";

interface Props {
  conversation: HubConversation;
  staffId: string;
  instance: StaffInstance | null;
  onShowContact: () => void;
}

export const WhatsAppHubChat = ({ conversation, staffId, instance, onShowContact }: Props) => {
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("staff_whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();

    if (conversation.unread_count > 0) {
      supabase
        .from("staff_whatsapp_conversations")
        .update({ unread_count: 0 })
        .eq("id", conversation.id)
        .then(() => {});
    }

    const channel = supabase
      .channel(`staff_wa_msgs_${conversation.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "staff_whatsapp_messages",
        filter: `conversation_id=eq.${conversation.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as HubMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversation.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    if (!instance || instance.status !== "connected") {
      toast.error("WhatsApp não está conectado");
      return;
    }

    setSending(true);
    try {
      await supabase.from("staff_whatsapp_messages").insert({
        conversation_id: conversation.id,
        staff_id: staffId,
        content: newMessage.trim(),
        direction: "outgoing",
        status: "sent",
      });

      await supabase.from("staff_whatsapp_conversations").update({
        last_message: newMessage.trim(),
        last_message_at: new Date().toISOString(),
      }).eq("id", conversation.id);

      try {
        await supabase.functions.invoke("evolution-api", {
          body: {
            action: "send-text",
            instance_name: instance.instance_name,
            phone: conversation.contact_phone.replace(/\D/g, ""),
            message: newMessage.trim(),
          },
        });
      } catch (e) {
        console.warn("Failed to send via API:", e);
      }

      setNewMessage("");
    } catch (err) {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const sendMediaMessage = async (file: File, mediaType: string) => {
    if (!instance || instance.status !== "connected") {
      toast.error("WhatsApp não está conectado");
      return;
    }

    setSending(true);
    try {
      // Upload to storage
      const fileName = `whatsapp/${staffId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("whatsapp-media")
        .upload(fileName, file);

      let mediaUrl = "";
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(fileName);
        mediaUrl = urlData.publicUrl;
      }

      await supabase.from("staff_whatsapp_messages").insert({
        conversation_id: conversation.id,
        staff_id: staffId,
        content: file.name,
        media_url: mediaUrl,
        media_type: mediaType,
        direction: "outgoing",
        status: "sent",
      });

      await supabase.from("staff_whatsapp_conversations").update({
        last_message: `📎 ${file.name}`,
        last_message_at: new Date().toISOString(),
      }).eq("id", conversation.id);

      // Send via API
      try {
        const action = "send-media";
        await supabase.functions.invoke("evolution-api", {
          body: {
            action,
            instance_name: instance.instance_name,
            phone: conversation.contact_phone.replace(/\D/g, ""),
            media_url: mediaUrl,
            media_type: mediaType,
            file_name: file.name,
          },
        });
      } catch (e) {
        console.warn("Failed to send media via API:", e);
      }

      toast.success("Arquivo enviado");
    } catch (err) {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (file) {
      sendMediaMessage(file, type === "image" ? file.type : file.type);
    }
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
        sendMediaMessage(file, "audio/webm");
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
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
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-3 border-b shrink-0 bg-background">
        <button onClick={onShowContact} className="flex items-center gap-2 hover:opacity-80">
          <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 text-sm font-bold">
            {(conversation.contact_name || conversation.contact_phone)[0]?.toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">{conversation.contact_name || conversation.contact_phone}</p>
            <p className="text-xs text-muted-foreground">{conversation.contact_phone}</p>
          </div>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShowActionDialog(true)} title="Criar ação/tarefa">
            <ClipboardCheck className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onShowContact}>
            <User className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">Carregando mensagens...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem ainda</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex", msg.direction === "outgoing" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                  msg.direction === "outgoing"
                    ? "bg-green-500 text-white rounded-br-sm"
                    : "bg-background border rounded-bl-sm"
                )}
              >
                {msg.media_url && (
                  <div className="mb-1">
                    {msg.media_type?.startsWith("image") ? (
                      <img src={msg.media_url} alt="" className="rounded max-w-full max-h-48 object-cover" />
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
                <div className={cn(
                  "flex items-center gap-1 mt-1",
                  msg.direction === "outgoing" ? "justify-end" : "justify-start"
                )}>
                  <span className={cn(
                    "text-[10px]",
                    msg.direction === "outgoing" ? "text-green-100" : "text-muted-foreground"
                  )}>
                    {format(new Date(msg.created_at), "HH:mm")}
                  </span>
                  {msg.direction === "outgoing" && (
                    msg.status === "read" ? (
                      <CheckCheck className="h-3 w-3 text-blue-200" />
                    ) : (
                      <Check className="h-3 w-3 text-green-200" />
                    )
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, "image")} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e, "file")} />

      {/* Input */}
      <div className="p-3 border-t bg-background shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-1.5"
        >
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
            className={cn("shrink-0", isRecording && "text-red-500")}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={sending}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Input
            placeholder="Digite uma mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
            disabled={sending || isRecording}
          />
          <Button type="submit" size="icon" disabled={sending || !newMessage.trim() || isRecording} className="bg-green-500 hover:bg-green-600 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
        {isRecording && (
          <div className="flex items-center gap-2 mt-2 text-sm text-red-500">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Gravando... Clique no ícone para parar
          </div>
        )}
      </div>

      {/* Create Action Dialog */}
      <CreateActionFromConversation
        open={showActionDialog}
        onOpenChange={setShowActionDialog}
        conversation={conversation}
        staffId={staffId}
      />
    </div>
  );
};
