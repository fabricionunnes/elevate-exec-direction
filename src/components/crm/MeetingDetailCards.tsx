import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Calendar, AlertTriangle, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface MeetingEventDetail {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_company?: string;
  event_type: string;
  event_date: string;
  credited_staff_name?: string;
  sdr_name?: string;
  attributed_sdr_id?: string;
}

interface MeetingDetailCardsProps {
  events: MeetingEventDetail[];
  className?: string;
}

const CardSection = ({
  title,
  icon: Icon,
  gradient,
  glow,
  borderColor,
  events,
}: {
  title: string;
  icon: any;
  gradient: string;
  glow: string;
  borderColor: string;
  events: MeetingEventDetail[];
}) => {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl bg-card border shadow-lg hover:shadow-xl transition-all",
      borderColor
    )}>
      <div className={cn("h-1.5 w-full", gradient)} />
      <div className={cn("absolute -bottom-12 -right-12 h-32 w-32 rounded-full blur-3xl", glow)} />
      
      <div className="p-4 pb-2 relative z-10">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg text-white shadow-lg", gradient)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          {title}
          <Badge variant="secondary" className="ml-auto text-xs font-bold">
            {events.length}
          </Badge>
        </h3>
      </div>

      <div className="px-4 pb-3 relative z-10">
        <div className={cn("space-y-0.5", events.length > 5 && "max-h-[240px] overflow-y-auto pr-1 scrollbar-thin")}>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro</p>
          ) : (
            events.map(event => (
              <Link
                key={event.id}
                to={`/crm/leads/${event.lead_id}`}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-all group"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                    {event.lead_name}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {event.lead_company && <span className="truncate">{event.lead_company}</span>}
                    <span>•</span>
                    <span>{format(new Date(event.event_date), "dd/MM HH:mm", { locale: ptBR })}</span>
                    {event.credited_staff_name && (
                      <>
                        <span>•</span>
                        <span className="truncate">{event.credited_staff_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-primary transition-all" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export function MeetingDetailCards({ events, className }: MeetingDetailCardsProps) {
  const realized = events.filter(e => e.event_type === "realized");
  const noShow = events.filter(e => e.event_type === "no_show");
  const scheduled = events.filter(e => e.event_type === "scheduled");
  const outOfIcp = events.filter(e => e.event_type === "out_of_icp");

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      <CardSection
        title="Agendadas"
        icon={Calendar}
        gradient="bg-gradient-to-r from-sky-500 to-blue-500"
        glow="bg-sky-500/10"
        borderColor="border-sky-500/20"
        events={scheduled}
      />
      <CardSection
        title="Realizadas"
        icon={CheckCircle}
        gradient="bg-gradient-to-r from-emerald-500 to-teal-500"
        glow="bg-emerald-500/10"
        borderColor="border-emerald-500/20"
        events={realized}
      />
      <CardSection
        title="No Show"
        icon={XCircle}
        gradient="bg-gradient-to-r from-rose-500 to-pink-500"
        glow="bg-rose-500/10"
        borderColor="border-rose-500/20"
        events={noShow}
      />
      <CardSection
        title="Fora do ICP"
        icon={AlertTriangle}
        gradient="bg-gradient-to-r from-amber-500 to-orange-500"
        glow="bg-amber-500/10"
        borderColor="border-amber-500/20"
        events={outOfIcp}
      />
    </div>
  );
}
