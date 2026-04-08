import { useState, useEffect, useCallback } from "react";
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
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientCRMOriginGroup, ClientCRMOriginData, ClientCRMPipelineInfo } from "./hooks/useClientCRMPipeline";

const db = supabase as any;

const iconMap: Record<string, any> = {
  target: Target,
  megaphone: Megaphone,
  "shopping-cart": ShoppingCart,
  folder: Folder,
};

interface ClientCRMOriginsSidebarProps {
  projectId: string;
  originGroups: ClientCRMOriginGroup[];
  origins: ClientCRMOriginData[];
  pipelines: ClientCRMPipelineInfo[];
  selectedOrigin: string | null;
  selectedPipeline: string | null;
  onSelectOrigin: (originId: string | null) => void;
  onSelectPipeline: (pipelineId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const ClientCRMOriginsSidebar = ({
  projectId,
  originGroups,
  origins,
  pipelines,
  selectedOrigin,
  selectedPipeline,
  onSelectOrigin,
  onSelectPipeline,
  collapsed,
  onToggleCollapse,
}: ClientCRMOriginsSidebarProps) => {
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    originGroups.forEach(g => { initial[g.id] = true; });
    setOpenGroups(initial);
  }, [originGroups]);

  const handleSelectOrigin = (origin: ClientCRMOriginData) => {
    onSelectOrigin(origin.id === selectedOrigin ? null : origin.id);
    if (origin.pipeline_id && origin.pipeline_id !== selectedPipeline) {
      onSelectPipeline(origin.pipeline_id);
    }
  };

  const handleSelectAll = () => {
    onSelectOrigin(null);
  };

  const filteredOrigins = search.trim()
    ? origins.filter(o => o.name.toLowerCase().includes(search.toLowerCase()))
    : origins;

  const groupedOrigins = originGroups.map(group => ({
    ...group,
    origins: filteredOrigins.filter(o => o.group_id === group.id),
    pipeline: pipelines.find(p => {
      const groupOrigins = origins.filter(o => o.group_id === group.id);
      return groupOrigins.length > 0 && p.id === groupOrigins[0]?.pipeline_id;
    }),
  })).filter(g => g.origins.length > 0);

  const ungroupedOrigins = filteredOrigins.filter(o => !o.group_id);

  if (collapsed) {
    return (
      <div className="w-10 border-r border-border bg-card flex flex-col items-center py-3 gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleCollapse}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-[220px] border-r border-border bg-card flex flex-col shrink-0">
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5" />
          Origens
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar origens..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* All leads */}
          <button
            onClick={handleSelectAll}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
              !selectedOrigin
                ? "bg-primary/10 text-primary font-medium"
                : "text-foreground hover:bg-accent"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="truncate">Todos os Leads</span>
          </button>

          {/* Grouped origins */}
          {groupedOrigins.map(group => {
            const GroupIcon = iconMap[group.icon || ""] || Folder;
            return (
              <Collapsible
                key={group.id}
                open={openGroups[group.id] !== false}
                onOpenChange={(open) =>
                  setOpenGroups(prev => ({ ...prev, [group.id]: open }))
                }
              >
                <CollapsibleTrigger className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:bg-accent transition-colors">
                  {openGroups[group.id] !== false ? (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  )}
                  <GroupIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate flex-1 text-left">{group.name}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                    {group.origins.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-0.5 mt-0.5">
                  {group.origins.map(origin => (
                    <button
                      key={origin.id}
                      onClick={() => handleSelectOrigin(origin)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                        selectedOrigin === origin.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-accent"
                      )}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: origin.color || group.color || "#888" }}
                      />
                      <span className="truncate">{origin.name}</span>
                    </button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {/* Ungrouped */}
          {ungroupedOrigins.map(origin => (
            <button
              key={origin.id}
              onClick={() => handleSelectOrigin(origin)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                selectedOrigin === origin.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-accent"
              )}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: origin.color || "#888" }}
              />
              <span className="truncate">{origin.name}</span>
            </button>
          ))}

          {filteredOrigins.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma origem</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
