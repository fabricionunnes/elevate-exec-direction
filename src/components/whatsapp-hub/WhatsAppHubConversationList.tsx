import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { HubConversation } from "@/pages/onboarding-tasks/WhatsAppHubPage";

interface Props {
  staffId: string;
  isMaster: boolean;
  onSelect: (conv: HubConversation) => void;
  selectedId?: string;
  filterProjectId?: string;
}

export const WhatsAppHubConversationList = ({ staffId, isMaster, onSelect, selectedId, filterProjectId }: Props) => {
  const [conversations, setConversations] = useState<HubConversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    setLoading(true);
    let query = supabase
      .from("staff_whatsapp_conversations")
      .select(`
        *,
        project:onboarding_projects(id, product_name),
        staff:onboarding_staff(id, name),
        tags:staff_whatsapp_conversation_tags(id, tag:staff_whatsapp_tags(id, name, color))
      `)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (filterProjectId) {
      query = query.eq("project_id", filterProjectId);
    }

    const { data, error } = await query;
    if (!error && data) {
      setConversations(data as unknown as HubConversation[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel("staff_wa_conv_list")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "staff_whatsapp_conversations",
      }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [staffId]);

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.contact_name?.toLowerCase().includes(q) ||
      c.contact_phone.includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome ou número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div>
            {filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50",
                  selectedId === conv.id && "bg-muted"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 font-bold text-sm shrink-0">
                  {(conv.contact_name || conv.contact_phone)[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">
                      {conv.contact_name || conv.contact_phone}
                    </p>
                    {conv.last_message_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(conv.last_message_at), "HH:mm")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.last_message || "Sem mensagens"}
                  </p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {conv.unread_count > 0 && (
                      <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 h-4">
                        {conv.unread_count}
                      </Badge>
                    )}
                    {conv.project && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {conv.project.product_name}
                      </Badge>
                    )}
                    {isMaster && conv.staff && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        {conv.staff.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
