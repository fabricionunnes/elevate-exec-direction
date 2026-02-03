import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Phone, 
  Mail, 
  Building2, 
  MessageSquare 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { LeadMeetingActions } from "@/components/crm/LeadMeetingActions";
import { OwnerSelector } from "@/components/crm/lead-detail/OwnerSelector";
import { LeadCardNotes } from "@/components/crm/LeadCardNotes";

interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  stage_id: string;
  origin_id: string | null;
  owner_staff_id: string | null;
  opportunity_value: number | null;
  last_activity_at: string | null;
  urgency: string | null;
  origin?: { name: string } | null;
  owner?: { name: string } | null;
  tags?: { tag: { id: string; name: string; color: string } }[];
}

interface KanbanLeadCardProps {
  lead: Lead;
  pipelineId: string;
  isDragging: boolean;
  isSelected: boolean;
  isSelectionMode: boolean;
  onSelect: (leadId: string, selected: boolean) => void;
  onDragStart: (e: React.DragEvent, lead: Lead) => void;
  onOpenChat: (e: React.MouseEvent, lead: Lead) => void;
  onRefresh: () => void;
}

export const KanbanLeadCard = ({
  lead,
  pipelineId,
  isDragging,
  isSelected,
  isSelectionMode,
  onSelect,
  onDragStart,
  onOpenChat,
  onRefresh,
}: KanbanLeadCardProps) => {
  const formatCurrency = (value: number | null) => {
    if (!value) return null;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(lead.id, !isSelected);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // If in selection mode and clicking the card (not a button), toggle selection
    if (isSelectionMode) {
      e.preventDefault();
      onSelect(lead.id, !isSelected);
    }
  };

  const CardContent = (
    <div
      className={cn(
        "bg-card border rounded-lg p-3 transition-all shadow-sm",
        isDragging && "opacity-50",
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
      )}
    >
      {/* Selection Checkbox + Origin Tag */}
      <div className="flex items-start gap-2 mb-2">
        <div 
          onClick={handleCheckboxClick}
          className="pt-0.5"
        >
          <Checkbox 
            checked={isSelected}
            className="cursor-pointer"
          />
        </div>
        <div className="flex-1">
          {lead.origin?.name && (
            <Badge variant="secondary" className="text-[10px] bg-pink-100 text-pink-700 border-0">
              novo contato via {lead.origin.name}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{lead.name}</p>
            {lead.urgency === "high" && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                URGENTE
              </Badge>
            )}
          </div>

          {lead.company && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{lead.company}</span>
            </div>
          )}

          {/* Tags */}
          {lead.tags && lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {lead.tags.slice(0, 2).map(t => (
                <Badge
                  key={t.tag.id}
                  variant="outline"
                  className="text-[10px] px-1.5"
                  style={{ borderColor: t.tag.color, color: t.tag.color }}
                >
                  {t.tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Meeting Actions */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
            <LeadMeetingActions
              leadId={lead.id}
              pipelineId={pipelineId}
              stageId={lead.stage_id}
              ownerStaffId={lead.owner_staff_id}
              onEventTracked={onRefresh}
            />
            
            <div className="flex items-center gap-1">
              {lead.opportunity_value && (
                <span className="text-xs text-green-600">
                  {formatCurrency(lead.opportunity_value)}
                </span>
              )}
            </div>
          </div>

          {/* Footer with icons */}
          <div className="flex items-center gap-2 mt-1.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <OwnerSelector
                leadId={lead.id}
                currentOwnerId={lead.owner_staff_id}
                currentOwnerName={lead.owner?.name}
                onOwnerChange={onRefresh}
              />
              <LeadCardNotes
                leadId={lead.id}
                onNotesChange={onRefresh}
              />
              {lead.phone && <Phone className="h-3 w-3 text-muted-foreground" />}
              {lead.email && <Mail className="h-3 w-3 text-muted-foreground" />}
              {lead.phone && (
                <button
                  onClick={(e) => onOpenChat(e, lead)}
                  className="p-1 rounded hover:bg-primary/10 transition-colors group"
                  title="Abrir conversa no WhatsApp"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                </button>
              )}
              {!lead.phone && <MessageSquare className="h-3 w-3 text-muted-foreground/50" />}
            </div>

            {lead.last_activity_at && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {formatDistanceToNow(new Date(lead.last_activity_at), { 
                  locale: ptBR, 
                  addSuffix: false 
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // If in selection mode, don't wrap with Link
  if (isSelectionMode) {
    return (
      <div
        onClick={handleCardClick}
        className="cursor-pointer"
      >
        {CardContent}
      </div>
    );
  }

  return (
    <Link
      to={`/crm/leads/${lead.id}`}
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      className="block cursor-grab active:cursor-grabbing"
    >
      {CardContent}
    </Link>
  );
};
