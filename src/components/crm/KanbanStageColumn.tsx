import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
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
      className="w-[270px] sm:w-[290px] h-full flex-shrink-0 flex flex-col rounded-lg bg-[hsl(var(--crm-column))] border border-border/40 overflow-hidden"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      {/* Faixa de cor da etapa (hierarquia visual sem poluir) */}
      <div className="h-[3px] shrink-0" style={{ backgroundColor: stage.color }} />

      {/* Stage Header */}
      <div className="px-3 pt-2 pb-1.5 shrink-0">
        <div className="flex items-center gap-2">
          {isMaster && leads.length > 0 && (
            <Checkbox
              checked={allStageSelected}
              onCheckedChange={() => onSelectAllInStage(stage.id)}
              className="cursor-pointer h-3.5 w-3.5"
              title={allStageSelected ? "Desmarcar todos" : "Selecionar todos"}
            />
          )}

          <span className="font-semibold text-[13px] flex-1 truncate text-foreground">{stage.name}</span>

          <span className="text-[11px] text-muted-foreground font-medium tabular-nums shrink-0">
            {leads.length}
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => onAddLead(stage.id)}
            title="Adicionar negócio nesta etapa"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {stageTotal > 0 && (
          <p className="text-[10px] text-muted-foreground/80 tabular-nums mt-0.5">
            {formatCurrency(stageTotal)}
          </p>
        )}
      </div>

      {/* Lead Cards */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 kanban-scroll px-2 pb-2 pt-1"
      >
        <div className="space-y-1.5">
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
