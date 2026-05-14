import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Smartphone, User, FolderOpen, Users } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HubConversation } from "@/pages/onboarding-tasks/WhatsAppHubPage";

interface Props {
  staffId: string;
  isMaster: boolean;
  staffRole?: string | null;
  onSelect: (conv: HubConversation) => void;
  selectedId?: string;
  filterProjectId?: string;
}

interface InstanceOption {
  id: string;
  display_name: string | null;
  instance_name: string;
}

interface StaffOption {
  id: string;
  name: string;
}

interface AllowedAccess {
  allowedInstanceIds: string[];
  allowedOfficialInstanceIds: string[];
}

interface FetchConversationOptions {
  syncGroupsInBackground?: boolean;
  silent?: boolean;
}

const MAX_CONVERSATIONS_FETCH = 5000;

const buildVisibilityFilter = ({ allowedInstanceIds, allowedOfficialInstanceIds }: AllowedAccess) => {
  const clauses: string[] = [];

  if (allowedInstanceIds.length > 0) {
    clauses.push(`instance_id.in.(${allowedInstanceIds.join(",")})`);
  }

  if (allowedOfficialInstanceIds.length > 0) {
    clauses.push(`official_instance_id.in.(${allowedOfficialInstanceIds.join(",")})`);
  }

  clauses.push("and(instance_id.is.null,official_instance_id.is.null)");

  return clauses.join(",");
};

export const WhatsAppHubConversationList = ({ staffId, isMaster, staffRole, onSelect, selectedId, filterProjectId }: Props) => {
  const [conversations, setConversations] = useState<HubConversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterInstance, setFilterInstance] = useState<string>("all");
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const lastGroupSyncStaffIdRef = useRef<string | null>(null);

  const fetchAllowedAccess = async (): Promise<AllowedAccess> => {
    if (isMaster) {
      const { data } = await supabase.from("whatsapp_instances").select("id, instance_name, display_name");
      setInstances((data || []).map((i: any) => ({ id: i.id, display_name: i.display_name, instance_name: i.instance_name })));

      return {
        allowedInstanceIds: (data || []).map((item: any) => item.id),
        allowedOfficialInstanceIds: [],
      };
    }

    const [{ data: evolutionAccess }, { data: officialAccess }] = await Promise.all([
      supabase
        .from("whatsapp_instance_access")
        .select("instance_id, instance:whatsapp_instances(id, instance_name, display_name)")
        .eq("staff_id", staffId)
        .eq("can_view", true),
      supabase
        .from("whatsapp_official_instance_access")
        .select("instance_id")
        .eq("staff_id", staffId)
        .eq("can_view", true),
    ]);

    const instancesList = (evolutionAccess || [])
      .filter((item: any) => item.instance)
      .map((item: any) => ({
        id: item.instance.id,
        display_name: item.instance.display_name,
        instance_name: item.instance.instance_name,
      }));

    setInstances(instancesList);

    return {
      allowedInstanceIds: (evolutionAccess || []).map((item: any) => item.instance_id),
      allowedOfficialInstanceIds: (officialAccess || []).map((item: any) => item.instance_id),
    };
  };

  const fetchAllStaff = async () => {
    const { data } = await supabase
      .from("onboarding_staff")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    setStaffList((data || []).map((s: any) => ({ id: s.id, name: s.name })));
  };

  const syncMissingGroupConversations = async (instanceIds: string[]) => {
    if (instanceIds.length === 0) return;

    await Promise.allSettled(
      instanceIds.map(async (instanceId) => {
        const { error } = await supabase.functions.invoke("evolution-api", {
          body: {
            action: "syncGroups",
            instanceId,
          },
        });

        if (error) throw error;
      })
    );
  };

  const fetchConversations = async ({ syncGroupsInBackground = false, silent = false }: FetchConversationOptions = {}) => {
    if (!staffId) return;
    if (!silent) setLoading(true);

    try {
      const access = await fetchAllowedAccess();

      if (syncGroupsInBackground && access.allowedInstanceIds.length > 0) {
        void syncMissingGroupConversations(access.allowedInstanceIds).then(() => {
          void fetchConversations();
        });
      }

      let query = supabase
        .from("crm_whatsapp_conversations")
        .select(`
          id,
          instance_id,
          official_instance_id,
          lead_id,
          project_id,
          last_message,
          last_message_at,
          unread_count,
          status,
          created_at,
          contact:crm_whatsapp_contacts(name, phone, profile_picture_url),
          assigned_staff:onboarding_staff(id, name),
          instance:whatsapp_instances(id, instance_name, display_name, status)
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .range(0, MAX_CONVERSATIONS_FETCH - 1);

      if (!isMaster) {
        query = query.or(buildVisibilityFilter(access));
      }

      // Consultor: vê apenas conversas vinculadas a projetos onde ele é o consultor.
      // Conversas sem projeto e projetos de outros consultores ficam ocultos.
      if (!isMaster && staffRole === "consultant") {
        const { data: ownedProjects } = await supabase
          .from("onboarding_projects")
          .select("id")
          .eq("consultant_id", staffId);
        const ownedIds = (ownedProjects || []).map((p: any) => p.id);
        if (ownedIds.length === 0) {
          setConversations([]);
          setLoading(false);
          return;
        }
        query = query.in("project_id", ownedIds);
      }

      if (filterProjectId) {
        query = query.eq("project_id", filterProjectId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const projectIds = Array.from(
        new Set((data || []).map((item: any) => item.project_id).filter(Boolean))
      );

      const projectMap = new Map<string, { id: string; product_name: string }>();
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from("onboarding_projects")
          .select("id, product_name")
          .in("id", projectIds);

        (projects || []).forEach((project: any) => {
          projectMap.set(project.id, { id: project.id, product_name: project.product_name });
        });
      }

      const mapped = (data || []).map((conv: any) => {
        const project = conv.project_id ? projectMap.get(conv.project_id) || null : null;

        return {
          id: conv.id,
          instance_id: conv.instance_id,
          official_instance_id: conv.official_instance_id,
          lead_id: conv.lead_id,
          contact_name: conv.contact?.name || null,
          contact_phone: conv.contact?.phone || "",
          contact_photo_url: conv.contact?.profile_picture_url || null,
          project_id: conv.project_id || null,
          last_message: conv.last_message || null,
          last_message_at: conv.last_message_at || null,
          unread_count: conv.unread_count || 0,
          status: conv.status || "open",
          created_at: conv.created_at || new Date().toISOString(),
          project,
          staff: conv.assigned_staff || null,
          instance: conv.instance || null,
        } satisfies HubConversation;
      });

      setConversations(mapped);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMaster) {
      void fetchAllStaff();
    } else {
      setStaffList([]);
    }

    const shouldSyncGroupsInBackground = !filterProjectId && lastGroupSyncStaffIdRef.current !== staffId;
    if (shouldSyncGroupsInBackground) {
      lastGroupSyncStaffIdRef.current = staffId;
    }

    void fetchConversations({ syncGroupsInBackground: shouldSyncGroupsInBackground });

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
          void fetchConversations({ silent: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId, isMaster, filterProjectId]);

  const filtered = useMemo(() => {
    return conversations.filter((conversation) => {
      if (search) {
        const term = search.toLowerCase();
        const matchesSearch =
          conversation.contact_name?.toLowerCase().includes(term) ||
          conversation.contact_phone.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      if (filterInstance !== "all") {
        if (filterInstance === "none") {
          if (conversation.instance_id) return false;
        } else if (conversation.instance_id !== filterInstance) {
          return false;
        }
      }

      if (filterStaff !== "all") {
        if (filterStaff === "none") {
          if (conversation.staff) return false;
        } else if (conversation.staff?.id !== filterStaff) {
          return false;
        }
      }

      if (filterProject !== "all") {
        if (filterProject === "with") {
          if (!conversation.project_id) return false;
        } else if (filterProject === "without" && conversation.project_id) {
          return false;
        }
      }

      if (filterType !== "all") {
        const isGroup = conversation.contact_phone.includes("-");
        if (filterType === "group" && !isGroup) return false;
        if (filterType === "individual" && isGroup) return false;
      }

      return true;
    });
  }, [conversations, search, filterInstance, filterStaff, filterProject, filterType]);

  const hasActiveFilters =
    filterInstance !== "all" ||
    filterStaff !== "all" ||
    filterProject !== "all" ||
    filterType !== "all";

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

        {/* Filters row */}
        <div className="flex gap-2">
          <Select value={filterInstance} onValueChange={setFilterInstance}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <Smartphone className="h-3 w-3 mr-1 shrink-0" />
              <SelectValue placeholder="Instância" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas instâncias</SelectItem>
              <SelectItem value="none">Sem instância</SelectItem>
              {instances.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.display_name || inst.instance_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isMaster && (
            <Select value={filterStaff} onValueChange={(v) => { setFilterStaff(v); setStaffSearch(""); }}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <User className="h-3 w-3 mr-1 shrink-0" />
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar usuário..."
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      className="h-8 pl-8 text-xs"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <SelectItem value="all">Todos usuários</SelectItem>
                <SelectItem value="none">Sem responsável</SelectItem>
                {staffList
                  .filter((s) => !staffSearch || s.name.toLowerCase().includes(staffSearch.toLowerCase()))
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Second filters row */}
        <div className="flex gap-2">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <FolderOpen className="h-3 w-3 mr-1 shrink-0" />
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="with">Com projeto</SelectItem>
              <SelectItem value="without">Sem projeto</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <Users className="h-3 w-3 mr-1 shrink-0" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="group">Grupo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => { setFilterInstance("all"); setFilterStaff("all"); setFilterProject("all"); setFilterType("all"); }}
            className="text-[10px] text-primary hover:underline"
          >
            Limpar filtros
          </button>
        )}
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
