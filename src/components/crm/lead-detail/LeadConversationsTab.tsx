import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  MessageSquare,
  Instagram,
  Loader2,
  Check,
  CheckCheck,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  leadId: string;
  leadPhone?: string | null;
  leadName?: string | null;
}

type Channel = "whatsapp" | "whatsapp_official" | "instagram";

interface ConversationItem {
  id: string;
  channel: Channel;
  instance_id: string | null;
  instance_label: string;
  contact_label: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  raw: any;
}

interface MessageItem {
  id: string;
  content: string | null;
  direction: "inbound" | "outbound" | "incoming" | "outgoing";
  status: string | null;
  media_url?: string | null;
  type?: string | null;
  created_at: string;
}

const normalizePhoneDigits = (phoneRaw: string) => {
  let digits = (phoneRaw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (phoneRaw.includes("@g.us")) return digits;
  if (!digits.startsWith("55")) digits = `55${digits}`;
  if (digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    digits = `55${ddd}9${number}`;
  }
  return digits;
};

export const LeadConversationsTab = ({ leadId, leadPhone, leadName }: Props) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isMaster, setIsMaster] = useState(false);
  const [allowedWaInstanceIds, setAllowedWaInstanceIds] = useState<string[] | null>(null); // null = all (master)

  // Get current staff + permitted whatsapp instances
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: staff } = await (supabase as any)
        .from("onboarding_staff")
        .select("id, role")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const sid = staff?.id ?? null;
      setStaffId(sid);
      const master = staff?.role === "master";
      setIsMaster(master);

      if (!master && sid) {
        const { data: access } = await (supabase as any)
          .from("whatsapp_instance_access")
          .select("instance_id")
          .eq("staff_id", sid)
          .eq("can_view", true);
        setAllowedWaInstanceIds(((access || []) as any[]).map((a) => a.instance_id));
      } else {
        setAllowedWaInstanceIds(null);
      }
    })();
  }, []);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const all: ConversationItem[] = [];

      // 1) WhatsApp Evolution conversations linked to lead
      const { data: waConvs } = await (supabase as any)
        .from("crm_whatsapp_conversations")
        .select(`
          *,
          contact:crm_whatsapp_contacts(id, name, phone, profile_picture_url),
          instance:whatsapp_instances(id, instance_name, display_name, status),
          official_instance:whatsapp_official_instances(id, display_name, phone_number)
        `)
        .eq("lead_id", leadId)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      for (const c of waConvs || []) {
        const contact: any = c.contact;
        const isOfficial = !!c.official_instance_id;
        all.push({
          id: c.id,
          channel: isOfficial ? "whatsapp_official" : "whatsapp",
          instance_id: c.instance_id || c.official_instance_id,
          instance_label: isOfficial
            ? (c as any).official_instance?.display_name || "WhatsApp Oficial"
            : (c as any).instance?.display_name || (c as any).instance?.instance_name || "WhatsApp",
          contact_label: contact?.name || contact?.phone || "Contato",
          last_message: c.last_message,
          last_message_at: c.last_message_at,
          unread_count: c.unread_count || 0,
          raw: { ...c, contact_phone: contact?.phone },
        });
      }

      // 2) Also pull WhatsApp conversations that match the lead phone but aren't linked yet
      if (leadPhone) {
        const normalized = normalizePhoneDigits(leadPhone);
        if (normalized) {
          const { data: phoneConvs } = await (supabase as any)
            .from("crm_whatsapp_conversations")
            .select(`
              *,
              contact:crm_whatsapp_contacts!inner(id, name, phone, profile_picture_url),
              instance:whatsapp_instances(id, instance_name, display_name, status),
              official_instance:whatsapp_official_instances(id, display_name, phone_number)
            `)
            .or(`phone.eq.${normalized},phone.eq.${leadPhone.replace(/\D/g, "")}`, { foreignTable: "crm_whatsapp_contacts" })
            .is("lead_id", null);

          for (const c of phoneConvs || []) {
            if (all.some((x) => x.id === c.id)) continue;
            const contact: any = c.contact;
            const isOfficial = !!c.official_instance_id;
            all.push({
              id: c.id,
              channel: isOfficial ? "whatsapp_official" : "whatsapp",
              instance_id: c.instance_id || c.official_instance_id,
              instance_label: isOfficial
                ? (c as any).official_instance?.display_name || "WhatsApp Oficial"
                : (c as any).instance?.display_name || (c as any).instance?.instance_name || "WhatsApp",
              contact_label: contact?.name || contact?.phone || "Contato",
              last_message: c.last_message,
              last_message_at: c.last_message_at,
              unread_count: c.unread_count || 0,
              raw: { ...c, contact_phone: contact?.phone },
            });
          }
        }
      }

      // 3) Instagram conversations linked to lead
      const { data: igConvs } = await (supabase as any)
        .from("instagram_conversations")
        .select(`
          *,
          contact:instagram_contacts(id, name, username, profile_picture_url),
          instance:instagram_instances(id, account_name, username)
        `)
        .eq("lead_id", leadId)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      for (const c of igConvs || []) {
        const contact: any = c.contact;
        const inst: any = (c as any).instance;
        all.push({
          id: c.id,
          channel: "instagram",
          instance_id: c.instance_id,
          instance_label: inst?.account_name || inst?.username || "Instagram",
          contact_label: contact?.name || contact?.username || "Contato",
          last_message: c.last_message,
          last_message_at: c.last_message_at,
          unread_count: c.unread_count || 0,
          raw: c,
        });
      }

      // Apply WhatsApp Evolution access filter (non-master users only see permitted instances).
      // Official WhatsApp + Instagram are not gated by whatsapp_instance_access.
      const filtered = isMaster || allowedWaInstanceIds === null
        ? all
        : all.filter((c) => {
            if (c.channel !== "whatsapp") return true;
            return c.instance_id ? allowedWaInstanceIds.includes(c.instance_id) : false;
          });

      // Sort by last_message_at
      filtered.sort((a, b) => {
        const da = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const db = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return db - da;
      });

      setConversations(all);
      if (!activeId && all.length > 0) {
        setActiveId(all[0].id);
      }
    } catch (e) {
      console.error("Error loading conversations:", e);
    } finally {
      setLoading(false);
    }
  }, [leadId, leadPhone, activeId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const activeConv = conversations.find((c) => c.id === activeId) || null;

  // Load messages for active conversation
  const fetchMessages = useCallback(async () => {
    if (!activeConv) {
      setMessages([]);
      return;
    }
    setLoadingMsgs(true);
    try {
      if (activeConv.channel === "instagram") {
        const { data } = await (supabase as any)
          .from("instagram_messages")
          .select("*")
          .eq("conversation_id", activeConv.id)
          .order("timestamp", { ascending: true });
        setMessages(
          (data || []).map((m: any) => ({
            id: m.id,
            content: m.is_reaction && m.reaction_emoji ? m.reaction_emoji : m.content,
            direction: m.direction,
            status: m.status,
            media_url: m.media_url,
            type: m.message_type,
            created_at: m.timestamp,
          }))
        );
      } else {
        const { data } = await (supabase as any)
          .from("crm_whatsapp_messages")
          .select("*")
          .eq("conversation_id", activeConv.id)
          .order("created_at", { ascending: true });
        setMessages(
          (data || []).map((m: any) => ({
            id: m.id,
            content: m.content,
            direction: m.direction,
            status: m.status,
            media_url: m.media_url,
            type: m.type,
            created_at: m.created_at,
          }))
        );
      }

      // Mark as read
      if ((activeConv.unread_count || 0) > 0) {
        const table = activeConv.channel === "instagram" ? "instagram_conversations" : "crm_whatsapp_conversations";
        await (supabase as any).from(table).update({ unread_count: 0 }).eq("id", activeConv.id);
      }
    } catch (e) {
      console.error("Error loading messages:", e);
    } finally {
      setLoadingMsgs(false);
    }
  }, [activeConv]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription for active conversation
  useEffect(() => {
    if (!activeConv) return;
    const table = activeConv.channel === "instagram" ? "instagram_messages" : "crm_whatsapp_messages";
    const tsField = activeConv.channel === "instagram" ? "timestamp" : "created_at";
    const channel = supabase
      .channel(`lead-conv-${activeConv.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `conversation_id=eq.${activeConv.id}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConv, fetchMessages]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConv) return;
    const text = newMessage.trim();

    setSending(true);
    try {
      if (activeConv.channel === "whatsapp") {
        const phone = normalizePhoneDigits(activeConv.raw.contact_phone || leadPhone || "");
        if (!phone) {
          toast.error("Telefone inválido");
          return;
        }
        if (!activeConv.instance_id) {
          toast.error("Instância indisponível");
          return;
        }
        const { data: inserted, error: insErr } = await (supabase as any)
          .from("crm_whatsapp_messages")
          .insert({
            conversation_id: activeConv.id,
            content: text,
            type: "text",
            direction: "outbound",
            status: "pending",
            sent_by: staffId,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

        const { data: sendData, error: sendErr } = await supabase.functions.invoke("evolution-api", {
          body: {
            action: "sendText",
            instanceId: activeConv.instance_id,
            phone,
            message: text,
          },
        });
        if (sendErr || sendData?.error) {
          await (supabase as any).from("crm_whatsapp_messages").update({ status: "failed" }).eq("id", inserted.id);
          throw sendErr || new Error(sendData?.error || "Erro ao enviar");
        }
        await (supabase as any)
          .from("crm_whatsapp_messages")
          .update({ status: "sent", remote_id: sendData?.key?.id ?? null })
          .eq("id", inserted.id);
        await (supabase as any)
          .from("crm_whatsapp_conversations")
          .update({ last_message: text, last_message_at: new Date().toISOString(), unread_count: 0 })
          .eq("id", activeConv.id);
      } else if (activeConv.channel === "whatsapp_official") {
        const phone = (activeConv.raw.contact_phone || leadPhone || "").replace(/\D/g, "");
        const { data, error } = await supabase.functions.invoke("whatsapp-official-api", {
          body: {
            action: "sendText",
            instanceId: activeConv.instance_id,
            phone,
            message: text,
          },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        await (supabase as any).from("crm_whatsapp_messages").insert({
          conversation_id: activeConv.id,
          content: text,
          type: "text",
          direction: "outbound",
          status: "sent",
          sent_by: staffId,
          whatsapp_message_id: (data as any)?.messageId,
        });
        await (supabase as any)
          .from("crm_whatsapp_conversations")
          .update({ last_message: text.substring(0, 255), last_message_at: new Date().toISOString() })
          .eq("id", activeConv.id);
      } else if (activeConv.channel === "instagram") {
        toast.error("Envio pelo Instagram não está disponível no momento.");
        return;
      }

      setNewMessage("");
      await fetchMessages();
      await fetchConversations();
    } catch (e: any) {
      console.error("Send error:", e);
      toast.error(e?.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const channelIcon = (ch: Channel) =>
    ch === "instagram" ? (
      <Instagram className="h-3.5 w-3.5 text-pink-500" />
    ) : (
      <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
    );

  const StatusIcon = ({ status }: { status: string | null }) => {
    if (status === "read") return <CheckCheck className="h-3 w-3 text-blue-500" />;
    if (status === "delivered") return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    if (status === "sent") return <Check className="h-3 w-3 text-muted-foreground" />;
    if (status === "failed") return <span className="text-[10px] text-destructive">falhou</span>;
    if (status === "pending") return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
    return null;
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-3 p-3 md:p-4">
      {/* Conversations list */}
      <div className="md:w-72 flex-shrink-0 flex flex-col border border-border rounded-lg overflow-hidden bg-card">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Conversas ({conversations.length})
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchConversations}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
        <ScrollArea className="flex-1 max-h-[140px] md:max-h-none">
          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Carregando...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Nenhuma conversa encontrada para este lead.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors",
                    activeId === c.id && "bg-primary/10 hover:bg-primary/15"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-[10px]">
                        {c.contact_label.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {channelIcon(c.channel)}
                        <span className="text-xs font-medium truncate">{c.instance_label}</span>
                        {c.unread_count > 0 && (
                          <Badge variant="default" className="h-4 px-1.5 text-[9px]">
                            {c.unread_count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {c.last_message || "(sem mensagens)"}
                      </p>
                      {c.last_message_at && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {format(new Date(c.last_message_at), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col border border-border rounded-lg overflow-hidden bg-card min-h-[400px]">
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
            Selecione uma conversa para visualizar.
          </div>
        ) : (
          <>
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              {channelIcon(activeConv.channel)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{activeConv.contact_label}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {activeConv.instance_label}
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/20">
              {loadingMsgs ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Carregando mensagens...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  Sem mensagens nesta conversa.
                </div>
              ) : (
                messages.map((m) => {
                  const isOut = m.direction === "outbound" || m.direction === "outgoing";
                  return (
                    <div
                      key={m.id}
                      className={cn("flex", isOut ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-1.5 text-sm",
                          isOut
                            ? "bg-primary text-primary-foreground"
                            : "bg-background border border-border"
                        )}
                      >
                        {m.media_url && (
                          <a
                            href={m.media_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-[11px] underline mb-1 opacity-80"
                          >
                            [{m.type || "mídia"}]
                          </a>
                        )}
                        {m.content && <div className="whitespace-pre-wrap break-words">{m.content}</div>}
                        <div
                          className={cn(
                            "flex items-center gap-1 justify-end mt-0.5 text-[10px] opacity-70"
                          )}
                        >
                          {format(new Date(m.created_at), "HH:mm", { locale: ptBR })}
                          {isOut && <StatusIcon status={m.status} />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-border p-2 flex items-center gap-2 bg-card">
              <Input
                placeholder="Digite uma mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={sending}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={sending || !newMessage.trim()} size="icon">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
