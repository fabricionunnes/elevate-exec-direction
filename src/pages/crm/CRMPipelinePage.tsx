import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Plus, 
  Phone, 
  MessageSquare,
  Mail, 
  Building2, 
  Clock,
  AlertTriangle,
  DollarSign,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Upload,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AddLeadDialog } from "@/components/crm/AddLeadDialog";
import { ImportLeadsDialog } from "@/components/crm/ImportLeadsDialog";
import { createStageActivities } from "@/hooks/useStageActions";
import { createProjectFromWonLead } from "@/hooks/useCreateProjectOnWon";
import { trackMeetingEventOnStageChange } from "@/hooks/useMeetingEventTracker";
import { CRMFiltersBar, CRMFilters } from "@/components/crm/CRMFiltersBar";
import { useCRMContext } from "./CRMLayout";
import { LeadMeetingActions } from "@/components/crm/LeadMeetingActions";
import { OwnerSelector } from "@/components/crm/lead-detail/OwnerSelector";
import { LeadCardNotes } from "@/components/crm/LeadCardNotes";

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
  owner?: { name: string } | null;
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
  const { selectedOrigin, selectedPipeline, setSelectedPipeline, isAdmin, staffId } = useCRMContext();
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filters, setFilters] = useState<CRMFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [importLeadsOpen, setImportLeadsOpen] = useState(false);
  const [addLeadStageId, setAddLeadStageId] = useState<string | undefined>(undefined);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  
  // Filter options
  const [tagOptions, setTagOptions] = useState<{ id: string; name: string; color: string }[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<{ id: string; name: string }[]>([]);
  const [originOptions, setOriginOptions] = useState<{ id: string; name: string }[]>([]);
  
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

  const loadStagesAndLeads = useCallback(async () => {
    if (!selectedPipeline) return;

    setLoading(true);
    try {
      const { data: stagesData } = await supabase
        .from("crm_stages")
        .select("*")
        .eq("pipeline_id", selectedPipeline)
        .order("sort_order");

      setStages(stagesData || []);

      let query = supabase
        .from("crm_leads")
        .select(`
          *,
          origin:crm_origins(name),
          owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name),
          tags:crm_lead_tags(tag:crm_tags(id, name, color))
        `)
        .eq("pipeline_id", selectedPipeline)
        .order("created_at", { ascending: false });

      // Apply origin filter from sidebar
      if (selectedOrigin) {
        query = query.eq("origin_id", selectedOrigin);
      }

      const { data: leadsData } = await query;
      setLeads(leadsData || []);
    } catch (error) {
      console.error("Error loading pipeline data:", error);
      toast.error("Erro ao carregar dados do pipeline");
    } finally {
      setLoading(false);
    }
  }, [selectedPipeline, selectedOrigin]);

  useEffect(() => {
    loadPipelines();
    loadFilterOptions();
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
      const updateData: { stage_id: string; closed_at?: string } = {
        stage_id: stageMoveDialog.targetStageId,
      };
      
      if (isWonStage) {
        updateData.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("crm_leads")
        .update(updateData)
        .eq("id", stageMoveDialog.leadId);

      if (error) throw error;
      
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

  if (loading && !stages.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Origin Header */}
      <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
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

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-scroll px-2 sm:px-4 pb-4" style={{ scrollbarGutter: 'stable' }}>
        <div className="flex gap-2 sm:gap-3 h-full min-w-max">
          {stages.map(stage => {
            const stageLeads = getLeadsByStage(stage.id);
            const stageTotal = getStageTotal(stage.id);

            return (
              <div
                key={stage.id}
                className="w-[260px] sm:w-[280px] flex-shrink-0 flex flex-col bg-muted/30 rounded-lg"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Stage Header */}
                <div 
                  className="p-2 sm:p-3 flex items-center gap-2 rounded-t-lg"
                  style={{ borderTop: `3px solid ${stage.color}` }}
                >
                  <span className="font-medium text-xs sm:text-sm flex-1 truncate">{stage.name}</span>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs h-4 sm:h-5">
                    {stageLeads.length}
                  </Badge>
                  {stageTotal > 0 && (
                    <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                      {formatCurrency(stageTotal)}
                    </span>
                  )}
                  <Button variant="ghost" size="icon" className="h-5 w-5 sm:h-6 sm:w-6">
                    <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>

                {/* Add Deal Button */}
                <button 
                  onClick={() => {
                    setAddLeadStageId(stage.id);
                    setAddLeadOpen(true);
                  }}
                  className="mx-2 py-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md hover:border-primary/50 transition-colors"
                >
                  + Adicionar negócio
                </button>

                {/* Lead Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {stageLeads.map(lead => (
                    <Link
                      key={lead.id}
                      to={`/crm/leads/${lead.id}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead)}
                      className={cn(
                        "block bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all shadow-sm",
                        draggedLead?.id === lead.id && "opacity-50"
                      )}
                    >
                      {/* Origin Tag */}
                      {lead.origin?.name && (
                        <Badge variant="secondary" className="text-[10px] mb-2 bg-pink-100 text-pink-700 border-0">
                          novo contato via {lead.origin.name}
                        </Badge>
                      )}

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
                              pipelineId={selectedPipeline || ""}
                              stageId={lead.stage_id}
                              ownerStaffId={lead.owner_staff_id}
                              onEventTracked={loadStagesAndLeads}
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
                                onOwnerChange={loadStagesAndLeads}
                              />
                              <LeadCardNotes
                                leadId={lead.id}
                                onNotesChange={loadStagesAndLeads}
                              />
                              {lead.phone && <Phone className="h-3 w-3 text-muted-foreground" />}
                              {lead.email && <Mail className="h-3 w-3 text-muted-foreground" />}
                              {lead.phone && (
                                <button
                                  onClick={(e) => handleOpenChat(e, lead)}
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
                    </Link>
                  ))}

                  {stageLeads.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground">
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
      />
    </div>
  );
};
