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

  // Generate initials for avatar
  const initials = lead.name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();

  // Simple hash for avatar color
  const hashCode = lead.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const avatarColors = [
    { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
    { bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-700 dark:text-violet-300" },
    { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
    { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
    { bg: "bg-rose-100 dark:bg-rose-900/40", text: "text-rose-700 dark:text-rose-300" },
    { bg: "bg-cyan-100 dark:bg-cyan-900/40", text: "text-cyan-700 dark:text-cyan-300" },
  ];
  const avatarColor = avatarColors[hashCode % avatarColors.length];

  const CardContent = (
    <div
      className={cn(
        "bg-card rounded-xl p-3 transition-all duration-200 border select-none",
        isDragging && "opacity-40 scale-95",
        isSelected 
          ? "border-primary ring-2 ring-primary/20 shadow-md" 
          : "border-border/60 hover:border-primary/40 hover:shadow-md shadow-sm"
      )}
    >
      {/* Origin Badge */}
      {lead.origin?.name && (
        <div className="flex items-center gap-2 mb-2">
          {isMaster && (
            <div onClick={handleCheckboxClick} className="shrink-0">
              <Checkbox checked={isSelected} className="cursor-pointer" />
            </div>
          )}
          <Badge 
            variant="secondary" 
            className="text-[10px] px-2 py-0.5 bg-primary/8 text-primary border-0 font-medium"
          >
            novo contato via {lead.origin.name}
          </Badge>
        </div>
      )}

      {/* Name + Avatar row */}
      <div className="flex items-start gap-2.5">
        {!lead.origin?.name && isMaster && (
          <div onClick={handleCheckboxClick} className="pt-1 shrink-0">
            <Checkbox checked={isSelected} className="cursor-pointer" />
          </div>
        )}
        
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
          avatarColor.bg,
          avatarColor.text
        )}>
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm truncate text-foreground">{lead.name}</p>
            {lead.urgency === "high" && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-destructive/10 text-destructive uppercase tracking-wide">
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

          {lead.stage_entered_at && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 mt-0.5">
              <Clock className="h-2.5 w-2.5 shrink-0" />
              <span className="tabular-nums">
                Na etapa há {formatTimeInStage(lead.stage_entered_at)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {lead.tags.slice(0, 3).map(t => (
            <Badge
              key={t.tag.id}
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 rounded-md font-medium"
              style={{ 
                borderColor: `${t.tag.color}50`, 
                color: t.tag.color, 
                backgroundColor: `${t.tag.color}10`,
              }}
            >
              {t.tag.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Origem do anúncio (Meta Ads) */}
      {(lead.utm_content || lead.utm_campaign) && (
        <div className="flex items-center gap-1 mt-2 px-1.5 py-1 rounded-md bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-500/20">
          <Megaphone className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-[10px] text-blue-700 dark:text-blue-300 font-medium truncate" title={`${lead.utm_campaign || ""}${lead.utm_content ? " / " + lead.utm_content : ""}`}>
            {lead.utm_content || lead.utm_campaign}
          </span>
        </div>
      )}

      {/* Meeting Actions */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/50">
        <LeadMeetingActions
          leadId={lead.id}
          pipelineId={pipelineId}
          stageId={lead.stage_id}
          ownerStaffId={lead.owner_staff_id}
          initialEvents={lead.meeting_events?.map((event) => event.event_type) || []}
          onEventTracked={onRefresh}
        />
        
        {lead.opportunity_value ? (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(lead.opportunity_value)}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">0</span>
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
