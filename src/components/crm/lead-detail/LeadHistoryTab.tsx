import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle,
  XCircle,
  Phone,
  PhoneMissed,
  MessageSquare,
  FileText,
  Clock,
  ListFilter,
  ChevronDown,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface HistoryItem {
  id: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  staff?: { name: string } | null;
  created_at: string;
}

interface LeadHistoryTabProps {
  leadId: string;
  originName?: string;
  pipelineName?: string;
}

export const LeadHistoryTab = ({ leadId, originName, pipelineName }: LeadHistoryTabProps) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    loadHistory();
  }, [leadId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_lead_history")
        .select(`
          *,
          staff:onboarding_staff(name)
        `)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "stage_changed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "call_completed":
        return <Phone className="h-5 w-5 text-green-500" />;
      case "call_missed":
        return <PhoneMissed className="h-5 w-5 text-red-500" />;
      case "note":
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case "activity_completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "lost":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "stage_changed":
        return "Status da atividade";
      case "call_completed":
        return "Chamada realizada";
      case "call_missed":
        return "Chamada recusada";
      case "note":
        return "Nota adicionada";
      case "activity_completed":
        return "Atividade concluída";
      case "created":
        return "Lead criado";
      case "lost":
        return "Marcado como perdido";
      default:
        return action;
    }
  };

  const getStatusText = (item: HistoryItem) => {
    if (item.action === "stage_changed") {
      return (
        <span>
          Atividade <strong>{item.old_value || "Inicial"}</strong> Do tipo{" "}
          <strong>Whatsapp</strong> Mudou para <strong>Resolvido</strong>{" "}
          Na etapa <strong>{item.new_value}</strong>.{" "}
          <span className="text-muted-foreground">
            (Tempo de status: <span className="text-red-500">Atrasado</span>)
          </span>
        </span>
      );
    }
    if (item.action === "call_missed") {
      return "Chamada não atendida";
    }
    return item.notes || item.new_value || "";
  };

  const filteredHistory = history.filter(item => {
    if (filterType === "all") return true;
    if (filterType === "stage_changes") return item.action === "stage_changed";
    if (filterType === "calls") return item.action.includes("call");
    if (filterType === "notes") return item.action === "note";
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filter */}
      <div className="px-6 py-4 border-b border-border">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <ListFilter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="stage_changes">Mudanças de etapa</SelectItem>
            <SelectItem value="calls">Chamadas</SelectItem>
            <SelectItem value="notes">Notas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {filteredHistory.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum histórico encontrado
            </div>
          )}

          {filteredHistory.map((item, index) => (
            <div key={item.id} className="flex gap-4">
              {/* Icon */}
              <div className="flex-shrink-0 mt-1">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  {getActionIcon(item.action)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{getActionLabel(item.action)}</p>
                    <p className="text-xs text-muted-foreground">
                      ORIGEM: {originName?.toUpperCase() || "FUNIS COMERCIAIS"} {">"} {pipelineName || "FUNIL"}
                    </p>
                  </div>
                </div>

                <div className="mt-2">
                  <p className="text-sm">{getStatusText(item)}</p>
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(item.created_at), { locale: ptBR, addSuffix: true })}
                  </span>
                  {item.staff?.name && (
                    <>
                      <span>por</span>
                      <span className="font-medium">{item.staff.name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
