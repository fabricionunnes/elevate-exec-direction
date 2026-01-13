import { useEffect, useState, useCallback } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  Building2, 
  Clock,
  AlertTriangle,
  DollarSign,
  GripVertical
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AddLeadDialog } from "@/components/crm/AddLeadDialog";

interface Stage {
  id: string;
  name: string;
  sort_order: number;
  is_final: boolean;
  final_type: string | null;
  color: string;
  pipeline_id: string;
}

interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  stage_id: string;
  opportunity_value: number | null;
  probability: number | null;
  last_activity_at: string | null;
  next_activity_at: string | null;
  urgency: string | null;
  created_at: string;
}

export const CRMPipelinePage = () => {
  const { isAdmin } = useOutletContext<{ staffRole: string; isAdmin: boolean }>();
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

  const loadPipelines = async () => {
    const { data } = await supabase
      .from("crm_pipelines")
      .select("*")
      .eq("is_active", true)
      .order("is_default", { ascending: false });
    
    setPipelines(data || []);
    if (data && data.length > 0 && !selectedPipeline) {
      setSelectedPipeline(data[0].id);
    }
  };

  const loadStagesAndLeads = useCallback(async () => {
    if (!selectedPipeline) return;

    setLoading(true);
    try {
      // Load stages
      const { data: stagesData } = await supabase
        .from("crm_stages")
        .select("*")
        .eq("pipeline_id", selectedPipeline)
        .order("sort_order");

      setStages(stagesData || []);

      // Load leads
      const { data: leadsData } = await supabase
        .from("crm_leads")
        .select("*")
        .eq("pipeline_id", selectedPipeline)
        .order("created_at", { ascending: false });

      setLeads(leadsData || []);
    } catch (error) {
      console.error("Error loading pipeline data:", error);
      toast.error("Erro ao carregar dados do pipeline");
    } finally {
      setLoading(false);
    }
  }, [selectedPipeline]);

  useEffect(() => {
    loadPipelines();
  }, []);

  useEffect(() => {
    loadStagesAndLeads();
  }, [loadStagesAndLeads]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedPipeline) return;

    const channel = supabase
      .channel("crm-leads-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crm_leads",
          filter: `pipeline_id=eq.${selectedPipeline}`,
        },
        () => {
          loadStagesAndLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedPipeline, loadStagesAndLeads]);

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    
    if (!draggedLead || draggedLead.stage_id === stageId) {
      setDraggedLead(null);
      return;
    }

    // Optimistic update
    setLeads(prev =>
      prev.map(l =>
        l.id === draggedLead.id ? { ...l, stage_id: stageId } : l
      )
    );

    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ stage_id: stageId })
        .eq("id", draggedLead.id);

      if (error) throw error;
      toast.success("Lead movido com sucesso");
    } catch (error) {
      console.error("Error moving lead:", error);
      toast.error("Erro ao mover lead");
      loadStagesAndLeads(); // Revert
    } finally {
      setDraggedLead(null);
    }
  };

  const filteredLeads = leads.filter(lead => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      lead.name.toLowerCase().includes(search) ||
      lead.company?.toLowerCase().includes(search) ||
      lead.email?.toLowerCase().includes(search) ||
      lead.phone?.includes(search)
    );
  });

  const getLeadsByStage = (stageId: string) => {
    return filteredLeads.filter(lead => lead.stage_id === stageId);
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return null;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const isOverdue = (lead: Lead) => {
    if (!lead.last_activity_at) return true;
    const lastActivity = new Date(lead.last_activity_at);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return lastActivity < sevenDaysAgo;
  };

  const getStageTotal = (stageId: string) => {
    const stageLeads = getLeadsByStage(stageId);
    return stageLeads.reduce((sum, lead) => sum + (lead.opportunity_value || 0), 0);
  };

  if (loading && !stages.length) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione um pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
        </div>

        <div className="sm:ml-auto">
          <Button onClick={() => setAddLeadOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {stages.map(stage => {
            const stageLeads = getLeadsByStage(stage.id);
            const stageTotal = getStageTotal(stage.id);

            return (
              <div
                key={stage.id}
                className="w-[300px] flex-shrink-0 flex flex-col bg-muted/30 rounded-lg"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Stage Header */}
                <div 
                  className="p-3 border-b border-border flex items-center gap-2"
                  style={{ borderTopColor: stage.color, borderTopWidth: 3 }}
                >
                  <span className="font-medium flex-1">{stage.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {stageLeads.length}
                  </Badge>
                  {stageTotal > 0 && (
                    <Badge variant="outline" className="text-xs text-green-600">
                      {formatCurrency(stageTotal)}
                    </Badge>
                  )}
                </div>

                {/* Lead Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {stageLeads.map(lead => (
                    <Link
                      key={lead.id}
                      to={`/crm/leads/${lead.id}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead)}
                      className={cn(
                        "block bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all",
                        draggedLead?.id === lead.id && "opacity-50"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
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
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Building2 className="h-3 w-3" />
                              <span className="truncate">{lead.company}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-3 mt-2">
                            {lead.opportunity_value && (
                              <div className="flex items-center gap-1 text-xs text-green-600">
                                <DollarSign className="h-3 w-3" />
                                {formatCurrency(lead.opportunity_value)}
                              </div>
                            )}

                            {isOverdue(lead) && (
                              <div className="flex items-center gap-1 text-xs text-red-500">
                                <AlertTriangle className="h-3 w-3" />
                                Atrasado
                              </div>
                            )}
                          </div>

                          {lead.next_activity_at && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(lead.next_activity_at), "dd/MM HH:mm", { locale: ptBR })}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}

                  {stageLeads.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Arraste leads para cá
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AddLeadDialog
        open={addLeadOpen}
        onOpenChange={setAddLeadOpen}
        pipelineId={selectedPipeline}
        onSuccess={loadStagesAndLeads}
      />
    </div>
  );
};
