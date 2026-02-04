import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, Loader2 } from "lucide-react";
import { KanbanLeadCard } from "./KanbanLeadCard";

interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  document: string | null;
  stage_id: string;
  origin_id: string | null;
  owner_staff_id: string | null;
  opportunity_value: number | null;
  probability: number | null;
  last_activity_at: string | null;
  next_activity_at: string | null;
  urgency: string | null;
  notes: string | null;
  created_at: string;
  origin?: { name: string } | null;
  owner?: { name: string } | null;
  tags?: { tag: { id: string; name: string; color: string } }[];
}

interface Stage {
  id: string;
  name: string;
  sort_order: number;
  is_final: boolean;
  final_type: string | null;
  color: string;
  pipeline_id: string;
}

interface KanbanStageColumnProps {
  stage: Stage;
  leads: Lead[];
  pipelineId: string;
  selectedLeads: string[];
  isSelectionMode: boolean;
  isMaster: boolean;
  draggedLeadId: string | null;
  onSelectLead: (leadId: string, selected: boolean) => void;
  onSelectAllInStage: (stageId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragStart: (e: React.DragEvent, lead: Lead) => void;
  onOpenChat: (e: React.MouseEvent, lead: Lead) => void;
  onRefresh: () => void;
  onAddLead: (stageId: string) => void;
}

const LEADS_PER_PAGE = 10;

export const KanbanStageColumn = ({
  stage,
  leads,
  pipelineId,
  selectedLeads,
  isSelectionMode,
  isMaster,
  draggedLeadId,
  onSelectLead,
  onSelectAllInStage,
  onDragOver,
  onDrop,
  onDragStart,
  onOpenChat,
  onRefresh,
  onAddLead,
}: KanbanStageColumnProps) => {
  const [visibleCount, setVisibleCount] = useState(LEADS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset visible count when leads change (e.g., filter applied)
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

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setIsLoadingMore(true);
          // Small delay to show loading indicator
          setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + LEADS_PER_PAGE, leads.length));
            setIsLoadingMore(false);
          }, 150);
        }
      },
      {
        root: scrollRef.current,
        rootMargin: "100px",
        threshold: 0,
      }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, leads.length]);

  return (
    <div
      className="w-[260px] sm:w-[280px] h-full flex-shrink-0 flex flex-col bg-muted/30 rounded-lg"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      {/* Stage Header */}
      <div 
        className="p-2 sm:p-3 flex items-center gap-2 rounded-t-lg"
        style={{ borderTop: `3px solid ${stage.color}` }}
      >
        {/* Select All Checkbox (Master only) */}
        {isMaster && leads.length > 0 && (
          <Checkbox
            checked={allStageSelected}
            onCheckedChange={() => onSelectAllInStage(stage.id)}
            className="cursor-pointer"
            title={allStageSelected ? "Desmarcar todos" : "Selecionar todos"}
          />
        )}
        <span className="font-medium text-xs sm:text-sm flex-1 truncate">{stage.name}</span>
        <Badge variant="secondary" className="text-[10px] sm:text-xs h-4 sm:h-5">
          {leads.length}
        </Badge>
        {stageTotal > 0 && (
          <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
            {formatCurrency(stageTotal)}
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-5 w-5 sm:h-6 sm:w-6">
          <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      </div>

      {/* Add Deal Button */}
      <div className="px-2 py-1.5">
        <button 
          onClick={() => onAddLead(stage.id)}
          className="w-full py-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md hover:border-primary/50 transition-colors"
        >
          + Adicionar negócio
        </button>
      </div>

      {/* Lead Cards with virtual scroll */}
      <div 
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-scroll px-2 pb-2"
      >
        <div className="space-y-2">
          {visibleLeads.map(lead => (
            <KanbanLeadCard
              key={lead.id}
              lead={lead}
              pipelineId={pipelineId}
              isDragging={draggedLeadId === lead.id}
              isSelected={selectedLeads.includes(lead.id)}
              isSelectionMode={isSelectionMode}
              isMaster={isMaster}
              onSelect={onSelectLead}
              onDragStart={onDragStart}
              onOpenChat={onOpenChat}
              onRefresh={onRefresh}
            />
          ))}

          {/* Load more trigger */}
          {hasMore && (
            <div ref={loadMoreRef} className="py-2 flex justify-center">
              {isLoadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  +{leads.length - visibleCount} leads
                </span>
              )}
            </div>
          )}

          {leads.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Arraste leads para cá
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
