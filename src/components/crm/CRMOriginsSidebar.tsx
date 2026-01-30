import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  Target,
  Megaphone,
  ShoppingCart,
  Folder,
  Plus,
  Eye,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCRMContext } from "@/pages/crm/CRMLayout";

interface OriginGroup {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

interface Origin {
  id: string;
  name: string;
  group_id: string | null;
  pipeline_id: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  lead_count?: number;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  pipeline_id: string;
  sort_order: number;
}

interface CRMOriginsSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const iconMap: Record<string, any> = {
  target: Target,
  megaphone: Megaphone,
  "shopping-cart": ShoppingCart,
  folder: Folder,
};

export const CRMOriginsSidebar = ({
  collapsed,
  onToggleCollapse,
}: CRMOriginsSidebarProps) => {
  const { selectedOrigin, setSelectedOrigin, selectedPipeline, setSelectedPipeline, isAdmin } = useCRMContext();
  const [groups, setGroups] = useState<OriginGroup[]>([]);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedOrigins, setExpandedOrigins] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsRes, originsRes, stagesRes] = await Promise.all([
        supabase
          .from("crm_origin_groups")
          .select("*")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("crm_origins")
          .select("*")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("crm_stages")
          .select("id, name, color, pipeline_id, sort_order")
          .order("sort_order"),
      ]);

      setGroups(groupsRes.data || []);
      setOrigins(originsRes.data || []);
      setStages(stagesRes.data || []);

      // Expand all groups by default
      if (groupsRes.data) {
        setExpandedGroups(new Set(groupsRes.data.map((g) => g.id)));
      }
    } catch (error) {
      console.error("Error loading origins:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleOrigin = (originId: string) => {
    setExpandedOrigins((prev) => {
      const next = new Set(prev);
      if (next.has(originId)) {
        next.delete(originId);
      } else {
        next.add(originId);
      }
      return next;
    });
  };

  const handleOriginClick = (origin: Origin) => {
    setSelectedOrigin(origin.id);
    if (origin.pipeline_id) {
      setSelectedPipeline(origin.pipeline_id);
    }
    // Toggle expansion when clicking
    toggleOrigin(origin.id);
  };

  // Get stages for a specific origin's pipeline
  const getOriginStages = (origin: Origin) => {
    if (!origin.pipeline_id) return [];
    return stages.filter((s) => s.pipeline_id === origin.pipeline_id);
  };

  const filteredOrigins = origins.filter((o) =>
    o.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGroupOrigins = (groupId: string) =>
    filteredOrigins.filter((o) => o.group_id === groupId);

  const ungroupedOrigins = filteredOrigins.filter((o) => !o.group_id);

  const getIcon = (iconName: string | null) => {
    if (!iconName) return Folder;
    return iconMap[iconName] || Folder;
  };

  if (collapsed) {
    return (
      <div className="w-12 border-r border-border bg-card flex flex-col items-center py-2">
        <Button
          variant="ghost"
          size="icon"
          className="mb-2"
          onClick={onToggleCollapse}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedOrigin === null ? "secondary" : "ghost"}
          size="icon"
          onClick={() => {
            setSelectedOrigin(null);
          }}
          title="Todos os Leads"
        >
          <Target className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-60 border-r border-border bg-card p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-muted rounded" />
          <div className="h-6 bg-muted rounded w-3/4" />
          <div className="h-6 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-60 border-r border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Target className="h-3.5 w-3.5" />
          Origens
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onToggleCollapse}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border">
        <Input
          placeholder="Buscar origens..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-7 text-xs"
        />
      </div>

      {/* All leads option */}
      <div className="px-2 py-1.5 border-b border-border">
        <button
          onClick={() => {
            setSelectedOrigin(null);
          }}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
            selectedOrigin === null
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          )}
        >
          <Target className="h-3.5 w-3.5" />
          <span className="font-medium">Todos os Leads</span>
        </button>
      </div>

      {/* Groups and Origins */}
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {groups.map((group) => {
            const groupOrigins = getGroupOrigins(group.id);
            const Icon = getIcon(group.icon);
            const isExpanded = expandedGroups.has(group.id);

            return (
              <Collapsible
                key={group.id}
                open={isExpanded}
                onOpenChange={() => toggleGroup(group.id)}
              >
                <CollapsibleTrigger className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-muted text-xs font-medium">
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                  <Icon
                    className="h-3.5 w-3.5"
                    style={{ color: group.color || undefined }}
                  />
                  <span className="flex-1 text-left truncate">{group.name}</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    {groupOrigins.length}
                  </Badge>
                </CollapsibleTrigger>

                <CollapsibleContent className="ml-3 space-y-0.5 mt-0.5">
                  {groupOrigins.map((origin) => {
                    const isOriginExpanded = expandedOrigins.has(origin.id);
                    const isSelected = selectedOrigin === origin.id;
                    const originStages = getOriginStages(origin);

                    return (
                      <div key={origin.id}>
                        <button
                          onClick={() => handleOriginClick(origin)}
                          className={cn(
                            "w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors text-left",
                            isSelected
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {originStages.length > 0 ? (
                            isOriginExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )
                          ) : (
                            <span className="w-3" />
                          )}
                          <Target className="h-3 w-3" />
                          <span className="truncate flex-1">{origin.name}</span>
                        </button>

                        {/* Stages inside origin (the funnel stages) */}
                        {isOriginExpanded && originStages.length > 0 && (
                          <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-2">
                            {originStages.map((stage) => (
                              <div
                                key={stage.id}
                                className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground"
                              >
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: stage.color }}
                                />
                                <span className="truncate">{stage.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {groupOrigins.length === 0 && (
                    <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
                      Nenhuma origem
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {/* Ungrouped origins */}
          {ungroupedOrigins.length > 0 && (
            <div className="pt-2 border-t border-border mt-2">
              <p className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                Sem Grupo
              </p>
              {ungroupedOrigins.map((origin) => {
                const isOriginExpanded = expandedOrigins.has(origin.id);
                const originStages = getOriginStages(origin);

                return (
                  <div key={origin.id}>
                    <button
                      onClick={() => handleOriginClick(origin)}
                      className={cn(
                        "w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors text-left",
                        selectedOrigin === origin.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {originStages.length > 0 ? (
                        isOriginExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )
                      ) : (
                        <span className="w-3" />
                      )}
                      <span className="truncate">{origin.name}</span>
                    </button>

                    {isOriginExpanded && originStages.length > 0 && (
                      <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-2">
                        {originStages.map((stage) => (
                          <div
                            key={stage.id}
                            className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground"
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            <span className="truncate">{stage.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {groups.length === 0 && ungroupedOrigins.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground">
              <p>Nenhuma origem</p>
              {isAdmin && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 text-xs h-auto p-0"
                >
                  Criar origem
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Sections */}
      <div className="border-t border-border p-2 space-y-1">
        <Collapsible>
          <CollapsibleTrigger className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-muted text-xs font-medium text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            <span>Visualizações</span>
            <ChevronDown className="h-3 w-3 ml-auto" />
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-5 mt-1 space-y-0.5">
            <button className="w-full text-left px-2 py-1 rounded text-xs hover:bg-muted text-muted-foreground">
              Ganhos este mês
            </button>
            <button className="w-full text-left px-2 py-1 rounded text-xs hover:bg-muted text-muted-foreground">
              Perdidos
            </button>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible>
          <CollapsibleTrigger className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-muted text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Recentes</span>
            <ChevronDown className="h-3 w-3 ml-auto" />
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-5 mt-1 space-y-0.5">
            <button className="w-full text-left px-2 py-1 rounded text-xs hover:bg-muted text-muted-foreground">
              Últimos acessados
            </button>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};
