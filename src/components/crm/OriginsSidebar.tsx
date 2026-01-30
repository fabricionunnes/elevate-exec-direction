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
  Search,
  Target,
  Megaphone,
  ShoppingCart,
  Folder,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OriginGroup {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Origin {
  id: string;
  name: string;
  group_id: string | null;
  pipeline_id: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
}

interface OriginsSidebarProps {
  selectedOrigin: string | null;
  onSelectOrigin: (originId: string | null) => void;
  onSelectPipeline?: (pipelineId: string | null) => void;
  isAdmin?: boolean;
  onManageClick?: () => void;
}

const iconMap: Record<string, any> = {
  target: Target,
  megaphone: Megaphone,
  "shopping-cart": ShoppingCart,
  folder: Folder,
};

export const OriginsSidebar = ({
  selectedOrigin,
  onSelectOrigin,
  onSelectPipeline,
  isAdmin,
  onManageClick,
}: OriginsSidebarProps) => {
  const [groups, setGroups] = useState<OriginGroup[]>([]);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsRes, originsRes] = await Promise.all([
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
      ]);

      setGroups(groupsRes.data || []);
      setOrigins(originsRes.data || []);

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

  const handleOriginClick = (origin: Origin) => {
    onSelectOrigin(origin.id);
    if (onSelectPipeline && origin.pipeline_id) {
      onSelectPipeline(origin.pipeline_id);
    }
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

  if (loading) {
    return (
      <div className="w-64 border-r border-border bg-card p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-9 bg-muted rounded" />
          <div className="h-6 bg-muted rounded w-3/4" />
          <div className="h-6 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Target className="h-4 w-4" />
            Origens
          </h3>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Search className="h-4 w-4" />
            </Button>
            {isAdmin && onManageClick && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onManageClick}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <Input
          placeholder="Buscar origens..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* All origins option */}
      <div className="px-2 py-2 border-b border-border">
        <button
          onClick={() => {
            onSelectOrigin(null);
            if (onSelectPipeline) onSelectPipeline(null);
          }}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
            selectedOrigin === null
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          )}
        >
          <Target className="h-4 w-4" />
          <span className="font-medium">Todos os Leads</span>
        </button>
      </div>

      {/* Groups and Origins */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
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
                <CollapsibleTrigger className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted text-sm font-medium">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Icon
                    className="h-4 w-4"
                    style={{ color: group.color || undefined }}
                  />
                  <span className="flex-1 text-left">{group.name}</span>
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">
                    {groupOrigins.length}
                  </Badge>
                </CollapsibleTrigger>

                <CollapsibleContent className="ml-6 space-y-0.5 mt-0.5">
                  {groupOrigins.map((origin) => (
                    <button
                      key={origin.id}
                      onClick={() => handleOriginClick(origin)}
                      className={cn(
                        "w-full flex items-center px-3 py-1.5 rounded-md text-sm transition-colors text-left",
                        selectedOrigin === origin.id
                          ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="truncate">{origin.name}</span>
                    </button>
                  ))}

                  {groupOrigins.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
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
              <p className="px-2 py-1 text-xs text-muted-foreground uppercase tracking-wide">
                Sem Grupo
              </p>
              {ungroupedOrigins.map((origin) => (
                <button
                  key={origin.id}
                  onClick={() => handleOriginClick(origin)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors text-left",
                    selectedOrigin === origin.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="truncate">{origin.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {groups.length === 0 && ungroupedOrigins.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <p>Nenhuma origem cadastrada</p>
              {isAdmin && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={onManageClick}
                >
                  Criar primeira origem
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
