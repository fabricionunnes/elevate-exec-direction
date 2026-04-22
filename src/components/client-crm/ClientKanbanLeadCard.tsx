import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Phone as PhoneIcon, Mail, Clock } from "lucide-react";
import { formatDistanceToNow, formatDistanceToNowStrict, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { ClientCRMLead } from "./hooks/useClientCRMPipeline";
import { formatTimeInStage } from "@/lib/timeInStage";

interface ClientKanbanLeadCardProps {
  lead: ClientCRMLead;
  projectId: string;
  isDragging: boolean;
  isSelected: boolean;
  isSelectionMode: boolean;
  onSelect: (leadId: string, selected: boolean) => void;
  onDragStart: (e: React.DragEvent, lead: ClientCRMLead) => void;
  onRefresh: () => void;
}

export const ClientKanbanLeadCard = ({
  lead,
  projectId,
  isDragging,
  isSelected,
  isSelectionMode,
  onSelect,
  onDragStart,
  onRefresh,
}: ClientKanbanLeadCardProps) => {
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
    if (isSelectionMode) {
      e.preventDefault();
      onSelect(lead.id, !isSelected);
    }
  };

  const initials = lead.name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();

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
          <Checkbox checked={isSelected} className="cursor-pointer shrink-0" onClick={handleCheckboxClick} />
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
        {!lead.origin?.name && (
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

      {/* Footer */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          {lead.owner?.name && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{lead.owner.name}</span>
          )}
          <div className="flex items-center gap-0.5">
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="p-1 rounded-md hover:bg-accent transition-colors" onClick={e => e.stopPropagation()}>
                <PhoneIcon className="h-3 w-3 text-muted-foreground" />
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="p-1 rounded-md hover:bg-accent transition-colors" onClick={e => e.stopPropagation()}>
                <Mail className="h-3 w-3 text-muted-foreground" />
              </a>
            )}
          </div>
        </div>

        {lead.opportunity_value ? (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(lead.opportunity_value)}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">0</span>
        )}
      </div>

      {lead.last_activity_at && (
        <div className="mt-1">
          <span className="text-[9px] text-muted-foreground/70 tabular-nums">
            {formatDistanceToNow(new Date(lead.last_activity_at), { locale: ptBR, addSuffix: true })}
          </span>
        </div>
      )}
    </div>
  );

  if (isSelectionMode) {
    return (
      <div onClick={handleCardClick} className="cursor-pointer">
        {CardContent}
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      className="block cursor-grab active:cursor-grabbing select-none"
    >
      {CardContent}
    </div>
  );
};
