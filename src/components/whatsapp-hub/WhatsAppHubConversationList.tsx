import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
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

  const fetchAllowedInstanceIds = async () => {
    if (isMaster) {
      const { data } = await supabase.from("whatsapp_instances").select("id");
      return (data || []).map((item) => item.id);
    }

    const { data } = await supabase
      .from("whatsapp_instance_access")
      .select("instance_id")
      .eq("staff_id", staffId)
      .eq("can_view", true);

    return (data || []).map((item) => item.instance_id);
  };

  const fetchConversations = async () => {
    if (!staffId) return;
    setLoading(true);

    try {
      const allowedInstanceIds = await fetchAllowedInstanceIds();

      if (!isMaster && allowedInstanceIds.length === 0) {
        setConversations([]);
        return;
      }

      let query = supabase
        .from("crm_whatsapp_conversations")
        .select(`
          id,
          instance_id,
          lead_id,
          last_message,
          last_message_at,
          unread_count,
          status,
          created_at,
          contact:crm_whatsapp_contacts(name, phone, profile_picture_url),
          assigned_staff:onboarding_staff(id, name),
          instance:whatsapp_instances(id, instance_name, display_name, status)
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (!isMaster) {
        query = query.in("instance_id", allowedInstanceIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const leadIds = Array.from(
        new Set((data || []).map((item: any) => item.lead_id).filter(Boolean))
      );

      let projectQuery = supabase
        .from("onboarding_projects")
        .select("id, product_name, crm_lead_id")
        .neq("status", "closed");

      if (filterProjectId) {
        projectQuery = projectQuery.eq("id", filterProjectId);
      } else if (leadIds.length > 0) {
        projectQuery = projectQuery.in("crm_lead_id", leadIds);
      }

      const { data: projects } = await projectQuery;
      const projectByLeadId = new Map(
        (projects || [])
          .filter((project: any) => project.crm_lead_id)
          .map((project: any) => [project.crm_lead_id, { id: project.id, product_name: project.product_name }])
      );

      const mapped = (data || [])
        .map((conv: any) => {
          const project = conv.lead_id ? projectByLeadId.get(conv.lead_id) || null : null;
          return {
            id: conv.id,
            instance_id: conv.instance_id,
            lead_id: conv.lead_id,
            contact_name: conv.contact?.name || null,
            contact_phone: conv.contact?.phone || "",
            contact_photo_url: conv.contact?.profile_picture_url || null,
            project_id: project?.id || null,
            last_message: conv.last_message || null,
            last_message_at: conv.last_message_at || null,
            unread_count: conv.unread_count || 0,
            status: conv.status || "open",
            created_at: conv.created_at || new Date().toISOString(),
            project,
            staff: conv.assigned_staff || null,
            instance: conv.instance || null,
          } satisfies HubConversation;
        })
        .filter((conv) => (filterProjectId ? conv.project_id === filterProjectId : true));

      setConversations(mapped);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel("crm_wa_conv_list_hub")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crm_whatsapp_conversations",
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId, isMaster, filterProjectId]);

  const filtered = conversations.filter((conversation) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      conversation.contact_name?.toLowerCase().includes(term) ||
      conversation.contact_phone.toLowerCase().includes(term)
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
            {filtered.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50",
                  selectedId === conversation.id && "bg-muted"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {(conversation.contact_name || conversation.contact_phone)[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">
                      {conversation.contact_name || conversation.contact_phone}
                    </p>
                    {conversation.last_message_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(conversation.last_message_at), "HH:mm")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conversation.last_message || "Sem mensagens"}
                  </p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {conversation.unread_count > 0 && (
                      <Badge className="text-[10px] px-1.5 py-0 h-4">
                        {conversation.unread_count}
                      </Badge>
                    )}
                    {conversation.project && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {conversation.project.product_name}
                      </Badge>
                    )}
                    {isMaster && conversation.staff && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        {conversation.staff.name}
                      </Badge>
                    )}
                    {conversation.instance && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {conversation.instance.display_name || conversation.instance.instance_name}
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
