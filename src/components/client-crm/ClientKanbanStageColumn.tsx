import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientKanbanLeadCard } from "./ClientKanbanLeadCard";
import type { ClientCRMLead, ClientCRMStageData } from "./hooks/useClientCRMPipeline";

interface ClientKanbanStageColumnProps {
  stage: ClientCRMStageData;
  leads: ClientCRMLead[];
  projectId: string;
  selectedLeads: string[];
  isSelectionMode: boolean;
  draggedLeadId: string | null;
  onSelectLead: (leadId: string, selected: boolean) => void;
  onSelectAllInStage: (stageId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragStart: (e: React.DragEvent, lead: ClientCRMLead) => void;
  onRefresh: () => void;
  onAddLead: (stageId: string) => void;
}

const LEADS_PER_PAGE = 10;

export const ClientKanbanStageColumn = ({
  stage,
  leads,
  projectId,
  selectedLeads,
  isSelectionMode,
  draggedLeadId,
  onSelectLead,
  onSelectAllInStage,
  onDragOver,
  onDrop,
  onDragStart,
  onRefresh,
  onAddLead,
}: ClientKanbanStageColumnProps) => {
  const [visibleCount, setVisibleCount] = useState(LEADS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(LEADS_PER_PAGE);
  }, [leads.length, stage.id]);

  const visibleLeads = leads.slice(0, visibleCount);
  const hasMore = visibleCount < leads.length;
  const stageLeadIds = leads.map(l => l.id);
  const allStageSelected = stageLeadIds.length > 0 && stageLeadIds.every(id => selectedLeads.includes(id));

  const formatCurrency = (value: number | null) => {
    if (!value) return null;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const stageTotal = leads.reduce((sum, lead) => sum + (lead.opportunity_value || 0), 0);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + LEADS_PER_PAGE, leads.length));
            setIsLoadingMore(false);
          }, 150);
        }
      },
      { root: scrollRef.current, rootMargin: "100px", threshold: 0 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, leads.length]);

  const headerBg = `${stage.color}12`;

  return (
    <div
      className="w-[270px] sm:w-[290px] h-full flex-shrink-0 flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      {/* Stage Header */}
      <div className="px-3 py-2.5 flex items-center gap-2" style={{ backgroundColor: headerBg }}>
        {leads.length > 0 && (
          <Checkbox
            checked={allStageSelected}
            onCheckedChange={() => onSelectAllInStage(stage.id)}
            className="cursor-pointer"
          />
        )}
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
        <span className="font-semibold text-sm flex-1 truncate text-foreground">{stage.name}</span>
        <Badge
          variant="secondary"
          className="text-[10px] h-5 min-w-[24px] justify-center font-bold tabular-nums"
          style={{
            backgroundColor: `${stage.color}20`,
            color: stage.color,
            borderColor: `${stage.color}30`,
          }}
        >
          {leads.length}
        </Badge>
        {stageTotal > 0 && (
          <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline tabular-nums">
            {formatCurrency(stageTotal)}
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Add Lead Button */}
      <div className="px-2.5 py-2">
        <button
          onClick={() => onAddLead(stage.id)}
          className="w-full py-1.5 text-xs font-medium text-primary/60 hover:text-primary border border-dashed border-primary/20 rounded-lg hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Adicionar negócio
        </button>
      </div>

      {/* Lead Cards */}
      <div ref={scrollRef} className="flex-1 min-h-0 kanban-scroll px-2.5 pb-2.5">
        <div className="space-y-2">
          {visibleLeads.map(lead => (
            <ClientKanbanLeadCard
              key={lead.id}
              lead={lead}
              projectId={projectId}
              isDragging={draggedLeadId === lead.id}
              isSelected={selectedLeads.includes(lead.id)}
              isSelectionMode={isSelectionMode}
              onSelect={onSelectLead}
              onDragStart={onDragStart}
              onRefresh={onRefresh}
            />
          ))}

          {hasMore && (
            <div ref={loadMoreRef} className="py-2 flex justify-center">
              {isLoadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <span className="text-[10px] text-muted-foreground font-medium">
                  +{leads.length - visibleCount} leads
                </span>
              )}
            </div>
          )}

          {leads.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground/60 italic">
              Arraste leads para cá
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
