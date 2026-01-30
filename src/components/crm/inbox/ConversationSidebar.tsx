import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Phone, 
  Calendar, 
  ListTodo, 
  ChevronRight,
  UserPlus,
  Pencil,
  MessageSquare,
  History,
  Flag,
  User
} from "lucide-react";
import { WhatsAppConversation } from "@/hooks/useWhatsAppConversations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCRMContext } from "@/pages/crm/CRMLayout";

interface CRMStaff {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
}

interface ConversationSidebarProps {
  conversation: WhatsAppConversation;
  projectId?: string;
  onLeadCreated?: (leadId: string) => void;
  onContactUpdated?: () => void;
  onAssignmentChanged?: () => void;
}

export function ConversationSidebar({ 
  conversation, 
  projectId,
  onLeadCreated,
  onContactUpdated,
  onAssignmentChanged
}: ConversationSidebarProps) {
  const { staffId } = useCRMContext();
  const [showAddDealDialog, setShowAddDealDialog] = useState(false);
  const [showEditContactDialog, setShowEditContactDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [assignedOpen, setAssignedOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // CRM Staff for assignment
  const [crmStaff, setCrmStaff] = useState<CRMStaff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Fetch CRM staff (commercial roles)
  useEffect(() => {
    const fetchCRMStaff = async () => {
      setLoadingStaff(true);
      try {
        const crmRoles = ['master', 'admin', 'head_comercial', 'closer', 'sdr', 'social_setter', 'bdr'];
        const { data, error } = await supabase
          .from("onboarding_staff")
          .select("id, name, avatar_url, role")
          .in("role", crmRoles)
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        setCrmStaff(data || []);
      } catch (error) {
        console.error("Error fetching CRM staff:", error);
      } finally {
        setLoadingStaff(false);
      }
    };
    fetchCRMStaff();
  }, []);

  const handleAssignStaff = async (staffIdToAssign: string | null) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("crm_whatsapp_conversations")
        .update({ assigned_to: staffIdToAssign })
        .eq("id", conversation.id);

      if (error) throw error;

      toast.success(staffIdToAssign ? "Atendente atribuído!" : "Atribuição removida!");
      onAssignmentChanged?.();
    } catch (error) {
      console.error("Error assigning staff:", error);
      toast.error("Erro ao atribuir atendente");
    } finally {
      setLoading(false);
    }
  };

  // Form states
  const [dealData, setDealData] = useState({
    name: conversation.contact?.name || "",
    email: "",
    phone: conversation.contact?.phone || "",
    company: "",
    value: "",
    origin_group_id: "",
    pipeline_id: "",
    stage_id: "",
  });

  // Origin groups and pipelines
  const [originGroups, setOriginGroups] = useState<any[]>([]);
  const [pipelinesForGroup, setPipelinesForGroup] = useState<any[]>([]);
  const [stagesForPipeline, setStagesForPipeline] = useState<any[]>([]);

  // Load origin groups
  useEffect(() => {
    const loadOriginGroups = async () => {
      const { data } = await supabase
        .from("crm_origin_groups")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order");
      setOriginGroups(data || []);
    };
    loadOriginGroups();
  }, []);

  // Load pipelines when origin group changes
  useEffect(() => {
    const loadPipelines = async () => {
      if (!dealData.origin_group_id) {
        setPipelinesForGroup([]);
        return;
      }
      try {
        // @ts-ignore - Deep type instantiation issue with Supabase types
        const { data, error } = await supabase
          .from("crm_origins")
          .select("id, name")
          .eq("is_active", true)
          .eq("origin_group_id", dealData.origin_group_id)
          .order("sort_order");
        if (!error) setPipelinesForGroup(data || []);
      } catch (e) {
        console.error("Error loading pipelines:", e);
      }
    };
    loadPipelines();
  }, [dealData.origin_group_id]);

  // Load stages when pipeline changes
  useEffect(() => {
    const loadStages = async () => {
      if (!dealData.pipeline_id) {
        setStagesForPipeline([]);
        return;
      }
      try {
        // @ts-ignore - Deep type instantiation issue with Supabase types
        const { data, error } = await supabase
          .from("crm_stages")
          .select("id, name")
          .eq("pipeline_id", dealData.pipeline_id)
          .order("sort_order");
        if (!error) {
          setStagesForPipeline(data || []);
          // Auto-select first stage
          if (data && data.length > 0) {
            setDealData(prev => ({ ...prev, stage_id: data[0].id }));
          }
        }
      } catch (e) {
        console.error("Error loading stages:", e);
      }
    };
    loadStages();
  }, [dealData.pipeline_id]);

  const [contactData, setContactData] = useState({
    name: conversation.contact?.name || "",
    phone: conversation.contact?.phone || "",
  });

  const [scheduleData, setScheduleData] = useState({
    title: `Reunião com ${conversation.contact?.name || conversation.contact?.phone}`,
    date: "",
    time: "",
    notes: "",
  });

  const [taskData, setTaskData] = useState({
    title: "",
    description: "",
    dueDate: "",
  });

  const handleAddDeal = async () => {
    if (!dealData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!dealData.pipeline_id) {
      toast.error("Selecione um funil");
      return;
    }

    if (!dealData.stage_id) {
      toast.error("Selecione uma etapa");
      return;
    }

    setLoading(true);
    try {
      // Create lead in CRM with pipeline and stage
      const { data: lead, error } = await supabase
        .from("crm_leads")
        .insert({
          name: dealData.name.trim(),
          email: dealData.email || null,
          phone: dealData.phone || null,
          company: dealData.company || null,
          opportunity_value: dealData.value ? parseFloat(dealData.value.replace(/\D/g, "")) / 100 : 0,
          created_by: staffId,
          owner_staff_id: staffId,
          pipeline_id: dealData.pipeline_id,
          stage_id: dealData.stage_id,
          entered_pipeline_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Link conversation to lead
      if (lead) {
        await supabase
          .from("crm_whatsapp_conversations")
          .update({ lead_id: lead.id })
          .eq("id", conversation.id);

        toast.success("Negócio criado e vinculado!");
        onLeadCreated?.(lead.id);
      }

      setShowAddDealDialog(false);
      // Reset form
      setDealData(prev => ({
        ...prev,
        name: conversation.contact?.name || "",
        email: "",
        company: "",
        value: "",
      }));
    } catch (error: any) {
      console.error("Error creating deal:", error);
      toast.error(error.message || "Erro ao criar negócio");
    } finally {
      setLoading(false);
    }
  };

  const handleEditContact = async () => {
    if (!conversation.contact?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("crm_whatsapp_contacts")
        .update({ 
          name: contactData.name,
          phone: contactData.phone,
        })
        .eq("id", conversation.contact.id);

      if (error) throw error;

      toast.success("Contato atualizado!");
      onContactUpdated?.();
      setShowEditContactDialog(false);
    } catch (error) {
      console.error("Error updating contact:", error);
      toast.error("Erro ao atualizar contato");
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleMeeting = async () => {
    if (!scheduleData.title || !scheduleData.date || !scheduleData.time) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      // Create activity linked to lead if exists, or just as standalone
      const activityData: any = {
        type: "meeting",
        title: scheduleData.title,
        description: scheduleData.notes,
        due_date: `${scheduleData.date}T${scheduleData.time}:00`,
        status: "pending",
        created_by: staffId,
      };

      if (conversation.lead_id) {
        activityData.lead_id = conversation.lead_id;
      }

      const { error } = await supabase
        .from("crm_activities")
        .insert(activityData);

      if (error) throw error;

      toast.success("Reunião agendada!");
      setShowScheduleDialog(false);
      setScheduleData({
        title: `Reunião com ${conversation.contact?.name || conversation.contact?.phone}`,
        date: "",
        time: "",
        notes: "",
      });
    } catch (error) {
      console.error("Error scheduling meeting:", error);
      toast.error("Erro ao agendar reunião");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskData.title) {
      toast.error("Título é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const activityData: any = {
        type: "task",
        title: taskData.title,
        description: taskData.description,
        due_date: taskData.dueDate ? `${taskData.dueDate}T23:59:59` : null,
        status: "pending",
        created_by: staffId,
      };

      if (conversation.lead_id) {
        activityData.lead_id = conversation.lead_id;
      }

      const { error } = await supabase
        .from("crm_activities")
        .insert(activityData);

      if (error) throw error;

      toast.success("Tarefa criada!");
      setShowTaskDialog(false);
      setTaskData({ title: "", description: "", dueDate: "" });
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[320px] border-l border-border bg-card flex flex-col">
      {/* Header with Lead/Deal info */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1">
            <Flag className="h-3 w-3" />
            Próximo Negócio
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={conversation.contact?.profile_picture_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {(conversation.contact?.name || conversation.contact?.phone || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {conversation.contact?.name || "Sem nome"}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {conversation.contact?.phone}
            </p>
          </div>
        </div>

        {/* Quick action icons */}
        <div className="flex items-center gap-2 mt-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ligar">
            <Phone className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            title="Agendar reunião"
            onClick={() => setShowScheduleDialog(true)}
          >
            <Calendar className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            title="Criar tarefa"
            onClick={() => setShowTaskDialog(true)}
          >
            <ListTodo className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Assignment Section */}
      <Collapsible open={assignedOpen} onOpenChange={setAssignedOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 border-b border-border flex items-center justify-between hover:bg-muted/50 transition-colors">
            <span className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              Atribuído a
            </span>
            <ChevronRight className={`h-4 w-4 transition-transform ${assignedOpen ? "rotate-90" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-b border-border">
          <div className="p-4 space-y-3">
            {conversation.assigned_staff ? (
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={conversation.assigned_staff.avatar_url || undefined} />
                  <AvatarFallback>
                    {conversation.assigned_staff.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{conversation.assigned_staff.name}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mb-2">Nenhum atendente atribuído</p>
            )}
            
            <Select
              value={conversation.assigned_to || "none"}
              onValueChange={(value) => handleAssignStaff(value === "none" ? null : value)}
              disabled={loading || loadingStaff}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar atendente..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Sem atribuição</span>
                </SelectItem>
                {crmStaff.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={staff.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {staff.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{staff.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">({staff.role})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Add Deal Button */}
      <div className="p-4 border-b border-border">
        <Button 
          variant="outline" 
          className="w-full justify-between"
          onClick={() => setShowAddDealDialog(true)}
        >
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Adicionar negócio
          </span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Contact Section */}
      <Collapsible open={contactOpen} onOpenChange={setContactOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 border-b border-border flex items-center justify-between hover:bg-muted/50 transition-colors">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Pencil className="h-4 w-4" />
              Contato
            </span>
            <ChevronRight className={`h-4 w-4 transition-transform ${contactOpen ? "rotate-90" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-b border-border">
          <div className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <p className="text-sm">{conversation.contact?.name || "-"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Telefone</Label>
              <p className="text-sm">{conversation.contact?.phone || "-"}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-2"
              onClick={() => {
                setContactData({
                  name: conversation.contact?.name || "",
                  phone: conversation.contact?.phone || "",
                });
                setShowEditContactDialog(true);
              }}
            >
              <Pencil className="h-3 w-3 mr-2" />
              Editar contato
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* History Section */}
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 border-b border-border flex items-center justify-between hover:bg-muted/50 transition-colors">
            <span className="flex items-center gap-2 text-sm font-medium">
              <History className="h-4 w-4" />
              Histórico
            </span>
            <ChevronRight className={`h-4 w-4 transition-transform ${historyOpen ? "rotate-90" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-b border-border">
          <div className="p-4">
            <p className="text-xs text-muted-foreground text-center py-2">
              Histórico de interações aparecerá aqui
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Conversations Count */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4" />
          Conversas
        </span>
        <span className="text-sm text-primary font-medium">1</span>
        <ChevronRight className="h-4 w-4" />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Dialogs */}
      
      {/* Add Deal Dialog */}
      <Dialog open={showAddDealDialog} onOpenChange={setShowAddDealDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Negócio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {/* Grupo de Origem */}
            <div>
              <Label>Grupo de Origem *</Label>
              <Select
                value={dealData.origin_group_id}
                onValueChange={(value) => setDealData({ 
                  ...dealData, 
                  origin_group_id: value,
                  pipeline_id: "",
                  stage_id: ""
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o grupo" />
                </SelectTrigger>
                <SelectContent>
                  {originGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Funil */}
            <div>
              <Label>Funil *</Label>
              <Select
                value={dealData.pipeline_id}
                onValueChange={(value) => setDealData({ 
                  ...dealData, 
                  pipeline_id: value,
                  stage_id: ""
                })}
                disabled={!dealData.origin_group_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={dealData.origin_group_id ? "Selecione o funil" : "Selecione um grupo primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {pipelinesForGroup.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Etapa */}
            <div>
              <Label>Etapa *</Label>
              <Select
                value={dealData.stage_id}
                onValueChange={(value) => setDealData({ ...dealData, stage_id: value })}
                disabled={!dealData.pipeline_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={dealData.pipeline_id ? "Selecione a etapa" : "Selecione um funil primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {stagesForPipeline.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border pt-4">
              <Label>Nome *</Label>
              <Input
                value={dealData.name}
                onChange={(e) => setDealData({ ...dealData, name: e.target.value })}
                placeholder="Nome do contato"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={dealData.email}
                onChange={(e) => setDealData({ ...dealData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={dealData.phone}
                onChange={(e) => setDealData({ ...dealData, phone: e.target.value })}
                placeholder="+55 31 99999-9999"
              />
            </div>
            <div>
              <Label>Empresa</Label>
              <Input
                value={dealData.company}
                onChange={(e) => setDealData({ ...dealData, company: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>
            <div>
              <Label>Valor do negócio</Label>
              <Input
                value={dealData.value}
                onChange={(e) => setDealData({ ...dealData, value: e.target.value })}
                placeholder="R$ 0,00"
              />
            </div>
            <Button onClick={handleAddDeal} className="w-full" disabled={loading}>
              {loading ? "Criando..." : "Criar Negócio"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={showEditContactDialog} onOpenChange={setShowEditContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={contactData.name}
                onChange={(e) => setContactData({ ...contactData, name: e.target.value })}
                placeholder="Nome do contato"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={contactData.phone}
                onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                placeholder="+55 31 99999-9999"
              />
            </div>
            <Button onClick={handleEditContact} className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Meeting Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Reunião</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={scheduleData.title}
                onChange={(e) => setScheduleData({ ...scheduleData, title: e.target.value })}
                placeholder="Título da reunião"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={scheduleData.date}
                  onChange={(e) => setScheduleData({ ...scheduleData, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Horário *</Label>
                <Input
                  type="time"
                  value={scheduleData.time}
                  onChange={(e) => setScheduleData({ ...scheduleData, time: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={scheduleData.notes}
                onChange={(e) => setScheduleData({ ...scheduleData, notes: e.target.value })}
                placeholder="Detalhes adicionais..."
              />
            </div>
            <Button onClick={handleScheduleMeeting} className="w-full" disabled={loading}>
              <Calendar className="h-4 w-4 mr-2" />
              {loading ? "Agendando..." : "Agendar Reunião"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={taskData.title}
                onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
                placeholder="O que precisa ser feito?"
              />
            </div>
            <div>
              <Label>Data de vencimento</Label>
              <Input
                type="date"
                value={taskData.dueDate}
                onChange={(e) => setTaskData({ ...taskData, dueDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={taskData.description}
                onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                placeholder="Detalhes adicionais..."
              />
            </div>
            <Button onClick={handleCreateTask} className="w-full" disabled={loading}>
              <ListTodo className="h-4 w-4 mr-2" />
              {loading ? "Criando..." : "Criar Tarefa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
