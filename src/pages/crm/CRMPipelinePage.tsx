import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { syncLeadToClint } from "@/hooks/useClintSync";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Plus, 
  Loader2,
  MoreHorizontal,
  Upload,
  CheckSquare,
  TrendingUp,
  Handshake,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AddLeadDialog } from "@/components/crm/AddLeadDialog";
import { ImportLeadsDialog } from "@/components/crm/ImportLeadsDialog";
import { createStageActivities } from "@/hooks/useStageActions";
import { createProjectFromWonLead } from "@/hooks/useCreateProjectOnWon";
import { trackMeetingEventOnStageChange } from "@/hooks/useMeetingEventTracker";
import { CRMFiltersBar, CRMFilters } from "@/components/crm/CRMFiltersBar";
import { useCRMContext } from "./CRMLayout";
import { KanbanLeadCard } from "@/components/crm/KanbanLeadCard";
import { KanbanStageColumn } from "@/components/crm/KanbanStageColumn";
import { KanbanBulkActions } from "@/components/crm/KanbanBulkActions";
import { useDragScroll } from "@/hooks/useDragScroll";

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
  owner?: { name: string; avatar_url?: string | null } | null;
  tags?: { tag: { id: string; name: string; color: string } }[];
}

const defaultFilters: CRMFilters = {
  search: "",
  dateRange: undefined,
  fields: [],
  tags: [],
  owners: [],
  status: [],
  stages: [],
  origins: [],
  valueMin: null,
  valueMax: null,
};

export const CRMPipelinePage = () => {
  const navigate = useNavigate();
  const { selectedOrigin, selectedPipeline, setSelectedPipeline, isAdmin, isMaster, staffId } = useCRMContext();
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filters, setFilters] = useState<CRMFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [importLeadsOpen, setImportLeadsOpen] = useState(false);
  const [addLeadStageId, setAddLeadStageId] = useState<string | undefined>(undefined);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  
  // Drag scroll for horizontal kanban
  const { ref: dragScrollRef, isDragging: isDraggingScroll, bind: dragScrollBind } = useDragScroll();
  
  // Bulk selection state
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  // Filter options
  const [tagOptions, setTagOptions] = useState<{ id: string; name: string; color: string }[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<{ id: string; name: string }[]>([]);
  const [originOptions, setOriginOptions] = useState<{ id: string; name: string }[]>([]);
  
  // Summary cards state
  const [forecastTotal, setForecastTotal] = useState(0);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [negotiationTotal, setNegotiationTotal] = useState(0);
  const [negotiationData, setNegotiationData] = useState<any[]>([]);

  // Stage move dialog state
  const [stageMoveDialog, setStageMoveDialog] = useState<{
    open: boolean;
    leadId: string;
    targetStageId: string;
    targetStageName: string;
  }>({ open: false, leadId: "", targetStageId: "", targetStageName: "" });
  const [stageNote, setStageNote] = useState("");
  const [movingLead, setMovingLead] = useState(false);

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

  const loadFilterOptions = async () => {
    const [tagsRes, ownersRes, originsRes] = await Promise.all([
      supabase.from("crm_tags").select("id, name, color").eq("is_active", true),
      supabase.from("onboarding_staff").select("id, name").eq("is_active", true)
        .in("role", ["master", "admin", "head_comercial", "closer", "sdr"]),
      supabase.from("crm_origins").select("id, name").eq("is_active", true),
    ]);

    setTagOptions(tagsRes.data || []);
    setOwnerOptions(ownersRes.data || []);
    setOriginOptions(originsRes.data || []);
  };

  const loadSummaryCards = useCallback(async () => {
    try {
      // Find all "Forecast" stages across ALL pipelines
      const { data: forecastStages } = await supabase
        .from("crm_stages")
        .select("id")
        .ilike("name", "%forecast%");

      if (forecastStages && forecastStages.length > 0) {
        const stageIds = forecastStages.map(s => s.id);
        let forecastQuery = supabase
          .from("crm_leads")
          .select("id, opportunity_value, owner_staff_id")
          .in("stage_id", stageIds);
        if (selectedOrigin) {
          forecastQuery = forecastQuery.eq("origin_id", selectedOrigin);
        }
        const { data: forecastLeads } = await forecastQuery;
        setForecastData(forecastLeads || []);
      } else {
        setForecastData([]);
      }

      // Find all "Realizada" stages across ALL pipelines
      const { data: realizadaStages } = await supabase
        .from("crm_stages")
        .select("id")
        .ilike("name", "%realizada%");

      if (realizadaStages && realizadaStages.length > 0) {
        const stageIds = realizadaStages.map(s => s.id);
        let negQuery = supabase
          .from("crm_leads")
          .select("id, opportunity_value, owner_staff_id")
          .in("stage_id", stageIds);
        if (selectedOrigin) {
          negQuery = negQuery.eq("origin_id", selectedOrigin);
        }
        const { data: negotiationLeads } = await negQuery;
        setNegotiationData(negotiationLeads || []);
      } else {
        setNegotiationData([]);
      }
    } catch (error) {
      console.error("Error loading summary cards:", error);
    }
  }, [selectedOrigin]);

  // Compute filtered totals based on owner filter
  const filteredForecastTotal = useMemo(() => {
    const ownerFilter = filters.owners;
    const data = ownerFilter.length > 0
      ? forecastData.filter(f => ownerFilter.includes(f.owner_staff_id))
      : forecastData;
    return data.reduce((sum, f) => sum + (f.opportunity_value || 0), 0);
  }, [forecastData, filters.owners]);

  const filteredNegotiationTotal = useMemo(() => {
    const ownerFilter = filters.owners;
    const data = ownerFilter.length > 0
      ? negotiationData.filter(l => ownerFilter.includes(l.owner_staff_id))
      : negotiationData;
    return data.reduce((sum, l) => sum + (l.opportunity_value || 0), 0);
  }, [negotiationData, filters.owners]);

  const isRealtimeRefresh = useRef(false);

  const loadStagesAndLeads = useCallback(async () => {
    if (!selectedPipeline) return;

    // If an origin is selected, verify it belongs to the current pipeline
    // to avoid mismatched queries during state transitions
    let effectiveOrigin = selectedOrigin;
    if (effectiveOrigin) {
      const { data: originData } = await supabase
        .from("crm_origins")
        .select("pipeline_id")
        .eq("id", effectiveOrigin)
        .single();
      if (originData && originData.pipeline_id !== selectedPipeline) {
        effectiveOrigin = null;
      }
    }

    // Only show loading spinner on manual/initial loads, not realtime refreshes
    if (!isRealtimeRefresh.current) {
      setLoading(true);
    }
    try {
      const { data: stagesData, error: stagesError } = await supabase
        .from("crm_stages")
        .select("*")
        .eq("pipeline_id", selectedPipeline)
        .order("sort_order");

      if (stagesError) {
        console.error("Error loading stages:", stagesError);
        return; // Preserve existing data on error
      }
      setStages(stagesData || []);

      // Fetch leads in batches to bypass the 1000-row limit
      // Cap at 10,000 to avoid browser memory issues on very large pipelines
      const PAGE_SIZE = 500;
      const MAX_LEADS = 10000;
      let allLeads: Lead[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore && allLeads.length < MAX_LEADS) {
        let query = supabase
          .from("crm_leads")
          .select(`
            id, name, company, phone, email, document, stage_id, origin_id, owner_staff_id,
            opportunity_value, probability, last_activity_at, next_activity_at, urgency, notes, created_at,
            origin:crm_origins(name),
            owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name, avatar_url),
            tags:crm_lead_tags(tag:crm_tags(id, name, color))
          `)
          .eq("pipeline_id", selectedPipeline)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (effectiveOrigin) {
          query = query.eq("origin_id", effectiveOrigin);
        }

        const { data: leadsData, error: leadsError } = await query;

        if (leadsError) {
          console.error("Error loading leads:", leadsError);
          // On realtime refresh errors, preserve existing leads
          return;
        }

        if (leadsData && leadsData.length > 0) {
          allLeads = allLeads.concat(leadsData as Lead[]);
          from += PAGE_SIZE;
          hasMore = leadsData.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      // Only update leads if we got results, or if this is NOT a realtime refresh
      // This prevents leads from disappearing due to transient auth/session issues
      if (allLeads.length > 0 || !isRealtimeRefresh.current) {
        setLeads(allLeads);
      }
    } catch (error) {
      console.error("Error loading pipeline data:", error);
      // Don't clear existing data on error - preserve what's on screen
    } finally {
      setLoading(false);
      isRealtimeRefresh.current = false;
    }
  }, [selectedPipeline, selectedOrigin]);

  useEffect(() => {
    loadPipelines();
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadSummaryCards();
  }, [loadSummaryCards]);

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
          isRealtimeRefresh.current = true;
          loadStagesAndLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedPipeline, loadStagesAndLeads]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matchesSearch = 
          lead.name.toLowerCase().includes(search) ||
          lead.company?.toLowerCase().includes(search) ||
          lead.email?.toLowerCase().includes(search) ||
          lead.phone?.includes(search);
        if (!matchesSearch) return false;
      }

      // Tags filter
      if (filters.tags.length > 0) {
        const leadTagIds = lead.tags?.map(t => t.tag.id) || [];
        if (!filters.tags.some(tagId => leadTagIds.includes(tagId))) return false;
      }

      // Owner filter
      if (filters.owners.length > 0) {
        if (!lead.owner_staff_id || !filters.owners.includes(lead.owner_staff_id)) return false;
      }

      // Stage filter
      if (filters.stages.length > 0) {
        if (!filters.stages.includes(lead.stage_id)) return false;
      }

      // Value filter
      if (filters.valueMin !== null && (lead.opportunity_value || 0) < filters.valueMin) return false;
      if (filters.valueMax !== null && (lead.opportunity_value || 0) > filters.valueMax) return false;

      // Date filter
      if (filters.dateRange?.from) {
        const leadDate = new Date(lead.created_at);
        if (leadDate < filters.dateRange.from) return false;
        if (filters.dateRange.to && leadDate > filters.dateRange.to) return false;
      }

      return true;
    });
  }, [leads, filters]);

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

    const targetStage = stages.find(s => s.id === stageId);
    
    setStageMoveDialog({
      open: true,
      leadId: draggedLead.id,
      targetStageId: stageId,
      targetStageName: targetStage?.name || "Nova Etapa"
    });
    setStageNote("");
    setDraggedLead(null);
  };

  const confirmStageMove = async () => {
    if (!stageMoveDialog.leadId || !stageMoveDialog.targetStageId) return;
    
    setMovingLead(true);
    
    setLeads(prev =>
      prev.map(l =>
        l.id === stageMoveDialog.leadId ? { ...l, stage_id: stageMoveDialog.targetStageId } : l
      )
    );

    try {
      // Verificar se a etapa destino é "won"
      const targetStage = stages.find(s => s.id === stageMoveDialog.targetStageId);
      const isWonStage = targetStage?.final_type === "won";

      // Atualizar lead com closed_at se for etapa final
      const updateData: { stage_id: string; closed_at?: string; closer_staff_id?: string } = {
        stage_id: stageMoveDialog.targetStageId,
      };
      
      if (isWonStage) {
        updateData.closed_at = new Date().toISOString();
        // Set closer as the lead's current owner (the person responsible)
        const { data: leadData } = await supabase
          .from("crm_leads")
          .select("owner_staff_id, closer_staff_id")
          .eq("id", stageMoveDialog.leadId)
          .single();
        if (leadData && !leadData.closer_staff_id) {
          updateData.closer_staff_id = leadData.owner_staff_id || staffId;
        }
      }

      const { error } = await supabase
        .from("crm_leads")
        .update(updateData)
        .eq("id", stageMoveDialog.leadId);

      if (error) throw error;

      // Sync stage change to Clint in background
      syncLeadToClint(stageMoveDialog.leadId, "stage_change");
      
      if (stageNote.trim()) {
        await supabase
          .from("crm_lead_history")
          .insert({
            lead_id: stageMoveDialog.leadId,
            action: "note_added",
            notes: stageNote.trim(),
            field_changed: "stage_change_note",
            new_value: stageMoveDialog.targetStageName
          });
      }
      
      await createStageActivities(stageMoveDialog.leadId, stageMoveDialog.targetStageId);
      
      // Track meeting events (scheduled/realized) for CRM metrics
      if (staffId && selectedPipeline) {
        await trackMeetingEventOnStageChange(
          stageMoveDialog.leadId,
          selectedPipeline,
          stageMoveDialog.targetStageId,
          stageMoveDialog.targetStageName,
          staffId
        );
      }
      
      // Se for etapa "won", criar projeto automaticamente
      if (isWonStage) {
        const projectResult = await createProjectFromWonLead(stageMoveDialog.leadId);
        if (projectResult.success) {
          toast.success("🎉 Lead movido para GANHO e projeto criado!");
        } else {
          toast.success("Lead movido para GANHO");
          if (projectResult.error && !projectResult.error.includes("não tem")) {
            console.warn("Projeto não criado:", projectResult.error);
          }
        }
      } else {
        toast.success("Lead movido com sucesso");
      }
      
      setStageMoveDialog({ open: false, leadId: "", targetStageId: "", targetStageName: "" });
    } catch (error) {
      console.error("Error moving lead:", error);
      toast.error("Erro ao mover lead");
      loadStagesAndLeads();
    } finally {
      setMovingLead(false);
    }
  };

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

  // Navigate to inbox with the lead's WhatsApp conversation
  const handleOpenChat = async (e: React.MouseEvent, lead: Lead) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!lead.phone) {
      toast.error("Este lead não possui telefone cadastrado");
      return;
    }
    
    // Clean phone number (remove non-digits)
    const cleanPhone = lead.phone.replace(/\D/g, "");
    
    // Extract core phone parts for flexible matching
    // Brazilian phones can have DDI (55), DDD (2 digits), and phone (8-9 digits)
    // Some systems store with extra 9 digit, others without
    // Use last 8 digits as the most stable identifier
    const phoneSuffix8 = cleanPhone.slice(-8);
    const phoneSuffix9 = cleanPhone.slice(-9);
    
    try {
      // Find contact by phone using flexible matching
      // Search for contacts ending with these digits
      const { data: suffixMatches } = await supabase
        .from("crm_whatsapp_contacts")
        .select("id, phone")
        .or(`phone.ilike.%${phoneSuffix8},phone.ilike.%${phoneSuffix9}`);
      
      let contact: { id: string } | null = null;
      
      if (suffixMatches && suffixMatches.length > 0) {
        // Filter to find valid phone contacts (not groups)
        const validContact = suffixMatches.find(c => {
          const cPhone = c.phone.replace(/\D/g, "");
          // Skip group IDs (too long, contain @, or have special formats)
          if (cPhone.length > 13 || cPhone.length < 8) return false;
          if (c.phone.includes("@") || c.phone.includes("-")) return false;
          // Check if the phone ends with our suffix
          return cPhone.slice(-8) === phoneSuffix8 || cPhone.slice(-9) === phoneSuffix9;
        });
        
        if (validContact) {
          contact = { id: validContact.id };
        }
      }
      
      if (contact) {
        // Find conversation for this contact
        const { data: conversation } = await supabase
          .from("crm_whatsapp_conversations")
          .select("id")
          .eq("contact_id", contact.id)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (conversation) {
          navigate(`/crm/inbox?conversation=${conversation.id}`);
          return;
        }
      }
      
      // No existing conversation found - navigate to inbox anyway
      toast.info("Nenhuma conversa encontrada para este contato");
      navigate("/crm/inbox");
    } catch (error) {
      console.error("Error finding conversation:", error);
      navigate("/crm/inbox");
    }
  };

  const selectedOriginName = selectedOrigin 
    ? originOptions.find(o => o.id === selectedOrigin)?.name 
    : "Negócio";

  const stageOptions = stages.map(s => ({ id: s.id, name: s.name, color: s.color }));

  // Selection handlers
  const handleLeadSelect = (leadId: string, selected: boolean) => {
    setSelectedLeads(prev => 
      selected 
        ? [...prev, leadId]
        : prev.filter(id => id !== leadId)
    );
  };

  const handleClearSelection = () => {
    setSelectedLeads([]);
  };

  const handleSelectAllInStage = (stageId: string) => {
    const stageLeadIds = getLeadsByStage(stageId).map(l => l.id);
    const allSelected = stageLeadIds.every(id => selectedLeads.includes(id));
    
    if (allSelected) {
      // Deselect all from this stage
      setSelectedLeads(prev => prev.filter(id => !stageLeadIds.includes(id)));
    } else {
      // Select all from this stage
      setSelectedLeads(prev => [...new Set([...prev, ...stageLeadIds])]);
    }
  };

  const isSelectionMode = selectedLeads.length > 0;

  if (loading && !stages.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Origin Header */}
      <div className="shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Negócios da origem</p>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-bold truncate">
            {selectedOriginName || "Funil"}
          </h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => setImportLeadsOpen(true)} 
              className="gap-2 shrink-0" 
              size="sm"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button onClick={() => {
              setAddLeadStageId(undefined);
              setAddLeadOpen(true);
            }} className="gap-2 shrink-0" size="sm">
              <span className="hidden sm:inline">Negócio</span> <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="shrink-0">
        <CRMFiltersBar
          filters={filters}
          onFiltersChange={setFilters}
          tagOptions={tagOptions}
          ownerOptions={ownerOptions}
          stageOptions={stageOptions}
          originOptions={originOptions}
          totalCount={filteredLeads.length}
          entityName={selectedOriginName || "Negócio"}
        />
      </div>

      {/* Summary Cards */}
      <div className="shrink-0 px-3 sm:px-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 flex items-center gap-3 border-border/50">
            <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Forecast</p>
              <p className="text-base font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(filteredForecastTotal)}
              </p>
              <p className="text-[10px] text-muted-foreground">{forecastData.length} negócio{forecastData.length !== 1 ? "s" : ""} aberto{forecastData.length !== 1 ? "s" : ""}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3 border-border/50">
            <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
              <Handshake className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Em Negociação</p>
              <p className="text-base font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(filteredNegotiationTotal)}
              </p>
              <p className="text-[10px] text-muted-foreground">{negotiationData.length} negócio{negotiationData.length !== 1 ? "s" : ""}</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          ref={dragScrollRef}
          className="h-full w-full overflow-x-auto overflow-y-hidden kanban-horizontal-scroll"
          style={{ cursor: isDraggingScroll ? 'grabbing' : 'grab' }}
          {...dragScrollBind}
        >
          <div className="h-full px-2 sm:px-4 pb-4">
            <div className="flex gap-2 sm:gap-3 h-full" style={{ minWidth: "max-content" }}>
              {stages.map(stage => {
                const stageLeads = getLeadsByStage(stage.id);

                return (
                  <KanbanStageColumn
                    key={stage.id}
                    stage={stage}
                    leads={stageLeads}
                    pipelineId={selectedPipeline || ""}
                    selectedLeads={selectedLeads}
                    isSelectionMode={isSelectionMode}
                    isMaster={isMaster}
                    draggedLeadId={draggedLead?.id || null}
                    onSelectLead={handleLeadSelect}
                    onSelectAllInStage={handleSelectAllInStage}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragStart={handleDragStart}
                    onOpenChat={handleOpenChat}
                    onRefresh={loadStagesAndLeads}
                    onAddLead={(stageId) => {
                      setAddLeadStageId(stageId);
                      setAddLeadOpen(true);
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar (Master only) */}
      <KanbanBulkActions
        selectedLeads={selectedLeads}
        onClearSelection={handleClearSelection}
        stages={stageOptions}
        owners={ownerOptions}
        onSuccess={loadStagesAndLeads}
        isMaster={isMaster || isAdmin}
        currentPipelineId={selectedPipeline || undefined}
      />

      <AddLeadDialog
        open={addLeadOpen}
        onOpenChange={(open) => {
          setAddLeadOpen(open);
          if (!open) setAddLeadStageId(undefined);
        }}
        pipelineId={selectedPipeline || ""}
        onSuccess={loadStagesAndLeads}
        initialStageId={addLeadStageId}
      />

      {/* Stage Move Confirmation Dialog */}
      <Dialog 
        open={stageMoveDialog.open} 
        onOpenChange={(open) => {
          if (!open && !movingLead) {
            setStageMoveDialog({ open: false, leadId: "", targetStageId: "", targetStageName: "" });
            loadStagesAndLeads();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover para {stageMoveDialog.targetStageName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea
                value={stageNote}
                onChange={(e) => setStageNote(e.target.value)}
                placeholder="Adicione uma observação sobre a mudança de etapa..."
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setStageMoveDialog({ open: false, leadId: "", targetStageId: "", targetStageName: "" });
                loadStagesAndLeads();
              }}
              disabled={movingLead}
            >
              Cancelar
            </Button>
            <Button onClick={confirmStageMove} disabled={movingLead}>
              {movingLead && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Leads Dialog */}
      <ImportLeadsDialog
        open={importLeadsOpen}
        onOpenChange={setImportLeadsOpen}
        onSuccess={loadStagesAndLeads}
        selectedOriginId={selectedOrigin}
      />
    </div>
  );
};
