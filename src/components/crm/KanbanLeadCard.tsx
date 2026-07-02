import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Mail, 
  Building2, 
  MessageSquare,
  Clock,
  Megaphone,
} from "lucide-react";
import { TwilioCallButton } from "@/components/crm/TwilioCallButton";
import { useMetaAdNames } from "@/components/crm/useMetaAdNames";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { LeadMeetingActions } from "@/components/crm/LeadMeetingActions";
import { OwnerSelector } from "@/components/crm/lead-detail/OwnerSelector";
import { LeadCardNotes } from "@/components/crm/LeadCardNotes";
import { formatTimeInStage } from "@/lib/timeInStage";

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
  stage_entered_at?: string | null;
  urgency: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  meta_campaign_id?: string | null;
  meta_adset_id?: string | null;
  meta_ad_id?: string | null;
  origin?: { name: string } | null;
  owner?: { name: string; avatar_url?: string | null } | null;
  tags?: { tag: { id: string; name: string; color: string } }[];
  meeting_events?: { event_type: string }[];
}

interface KanbanLeadCardProps {
  lead: Lead;
  pipelineId: string;
  isDragging: boolean;
  isSelected: boolean;
  isSelectionMode: boolean;
  isMaster: boolean;
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
  isMaster,
  onSelect,
  onDragStart,
  onOpenChat,
  onRefresh,
}: KanbanLeadCardProps) => {
  const adNames = useMetaAdNames();
  // Resolve o ID guardado no lead para o nome legível (fallback = o próprio valor).
  const campaignLabel = lead.utm_campaign ? (adNames.campaigns[lead.utm_campaign] || lead.utm_campaign) : null;
  const adsetLabel = lead.utm_term ? (adNames.adsets[lead.utm_term] || lead.utm_term) : null;
  const adLabel = lead.utm_content ? (adNames.ads[lead.utm_content] || lead.utm_content) : null;

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
    if (isSelectionMode && isMaster) {
      e.preventDefault();
      onSelect(lead.id, !isSelected);
    }
  };

  // Uma linha só de contexto de anúncio (detalhe completo no tooltip)
  const adTooltip = [
    campaignLabel ? `Campanha: ${campaignLabel}` : null,
    adsetLabel ? `Conjunto: ${adsetLabel}` : null,
    adLabel ? `Anúncio: ${adLabel}` : null,
  ].filter(Boolean).join("\n");
  const adLine = adLabel || campaignLabel || adsetLabel;

  const CardContent = (
    <div
      className={cn(
        "group bg-card rounded-lg p-2.5 transition-all duration-150 border select-none",
        "shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
        isDragging && "opacity-40 scale-95",
        isSelected
          ? "border-primary ring-2 ring-primary/15"
          : "border-border/60 hover:border-border hover:shadow-md"
      )}
    >
      {/* Nome + checkbox (checkbox só aparece no hover/seleção) */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-[13px] leading-snug truncate text-foreground">{lead.name}</p>
            {lead.urgency === "high" && (
              <span className="inline-flex items-center px-1 rounded text-[9px] font-bold bg-destructive/10 text-destructive shrink-0">
                !
              </span>
            )}
          </div>

          {lead.company && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{lead.company}</span>
            </div>
          )}
        </div>

        {isMaster && (
          <div
            onClick={handleCheckboxClick}
            className={cn(
              "shrink-0 pt-0.5 transition-opacity",
              isSelected || isSelectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <Checkbox checked={isSelected} className="cursor-pointer h-3.5 w-3.5" />
          </div>
        )}
      </div>

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {lead.tags.slice(0, 3).map(t => (
            <Badge
              key={t.tag.id}
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 rounded font-medium border-0"
              style={{ color: t.tag.color, backgroundColor: `${t.tag.color}14` }}
            >
              {t.tag.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Contexto: anúncio (1 linha) · tempo na etapa · origem */}
      {adLine && (
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground" title={adTooltip}>
          <Megaphone className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{adLine}</span>
        </div>
      )}
      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/70 min-w-0">
        {lead.stage_entered_at && (
          <span className="inline-flex items-center gap-1 shrink-0 tabular-nums">
            <Clock className="h-2.5 w-2.5" />
            {formatTimeInStage(lead.stage_entered_at)}
          </span>
        )}
        {lead.origin?.name && (
          <span className="truncate">
            {lead.stage_entered_at ? "· " : ""}via {lead.origin.name}
          </span>
        )}
      </div>

      {/* Ações de reunião + valor */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40">
        <LeadMeetingActions
          leadId={lead.id}
          pipelineId={pipelineId}
          stageId={lead.stage_id}
          ownerStaffId={lead.owner_staff_id}
          initialEvents={lead.meeting_events?.map((event) => event.event_type) || []}
          onEventTracked={onRefresh}
        />

        {lead.opportunity_value ? (
          <span className="text-xs font-semibold text-[hsl(var(--crm-positive))] tabular-nums">
            {formatCurrency(lead.opportunity_value)}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/40 tabular-nums">—</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
        <OwnerSelector
          leadId={lead.id}
          currentOwnerId={lead.owner_staff_id}
          currentOwnerName={lead.owner?.name}
          currentOwnerAvatarUrl={lead.owner?.avatar_url}
          onOwnerChange={onRefresh}
        />
        <LeadCardNotes
          leadId={lead.id}
          onNotesChange={onRefresh}
        />
        
        <div className="flex items-center gap-0.5 ml-auto">
          {lead.phone && (
            <TwilioCallButton
              leadId={lead.id}
              leadName={lead.name}
              leadPhone={lead.phone}
              variant="icon"
              onCallStarted={onRefresh}
            />
          )}
          {lead.phone && (
            <button
              onClick={(e) => onOpenChat(e, lead)}
              className="p-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors group"
              title="Abrir conversa no WhatsApp"
            >
              <MessageSquare className="h-3 w-3 text-muted-foreground group-hover:text-emerald-600" />
            </button>
          )}
        </div>

        {lead.last_activity_at && (
          <span className="text-[9px] text-muted-foreground/70 tabular-nums">
            {formatDistanceToNow(new Date(lead.last_activity_at), { 
              locale: ptBR, 
              addSuffix: false 
            })}
          </span>
        )}
      </div>
    </div>
  );

  if (isSelectionMode && isMaster) {
    return (
      <div onClick={handleCardClick} className="cursor-pointer">
        {CardContent}
      </div>
    );
  }

  return (
    <Link
      to={`/crm/leads/${lead.id}`}
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      className="block cursor-grab active:cursor-grabbing select-none"
    >
      {CardContent}
    </Link>
  );
};
