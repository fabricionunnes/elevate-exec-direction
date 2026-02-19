import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronRight, 
  Briefcase, 
  ExternalLink,
  Building2,
  DollarSign,
  ArrowRightLeft,
  Plus,
} from "lucide-react";
import { LinkedLead } from "@/hooks/useLinkedLeads";
import { cn } from "@/lib/utils";

interface LinkedLeadsSectionProps {
  leads: LinkedLead[];
  loading: boolean;
  defaultOpen?: boolean;
  onAddToFunnel?: (lead: LinkedLead) => void;
  onChangeFunnel?: (lead: LinkedLead) => void;
}

const formatCurrency = (value: number | null) => {
  if (!value) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);
};

export function LinkedLeadsSection({ 
  leads, 
  loading, 
  defaultOpen = true,
  onAddToFunnel,
  onChangeFunnel,
}: LinkedLeadsSectionProps) {
  if (loading) {
    return (
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="h-4 w-4" />
          <span className="text-sm font-medium">Negócios Vinculados</span>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (leads.length === 0) {
    return null;
  }

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full p-4 border-b border-border flex items-center justify-between hover:bg-muted/50 transition-colors">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Briefcase className="h-4 w-4" />
            Negócios Vinculados
            <Badge variant="secondary" className="ml-1 text-xs">
              {leads.length}
            </Badge>
          </span>
          <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-b border-border">
        <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
          {leads.map((lead) => (
            <LinkedLeadCard 
              key={lead.id} 
              lead={lead} 
              onAddToFunnel={onAddToFunnel}
              onChangeFunnel={onChangeFunnel}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function LinkedLeadCard({ 
  lead, 
  onAddToFunnel,
  onChangeFunnel,
}: { 
  lead: LinkedLead;
  onAddToFunnel?: (lead: LinkedLead) => void;
  onChangeFunnel?: (lead: LinkedLead) => void;
}) {
  const value = formatCurrency(lead.opportunity_value);
  const hasPipeline = !!lead.pipeline?.id;

  return (
    <div className="block p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group">
      <Link to={`/crm/leads/${lead.id}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{lead.name}</p>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
            </div>
            
            {lead.company && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3" />
                {lead.company}
              </p>
            )}
          </div>

          {lead.stage && (
            <Badge 
              variant="secondary"
              className="text-[10px] shrink-0"
              style={{ 
                backgroundColor: `${lead.stage.color}20`,
                color: lead.stage.color,
                borderColor: lead.stage.color 
              }}
            >
              {lead.stage.name}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>{lead.pipeline?.name || "Sem funil"}</span>
          {value && (
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <DollarSign className="h-3 w-3" />
              {value}
            </span>
          )}
        </div>
      </Link>

      {/* Action button: Add to funnel or Change funnel */}
      <div className="mt-2 pt-2 border-t border-border">
        {hasPipeline ? (
          onChangeFunnel && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onChangeFunnel(lead);
              }}
            >
              <ArrowRightLeft className="h-3 w-3 mr-1" />
              Mudar de funil
            </Button>
          )
        ) : (
          onAddToFunnel && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAddToFunnel(lead);
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Adicionar ao funil
            </Button>
          )
        )}
      </div>
    </div>
  );
}