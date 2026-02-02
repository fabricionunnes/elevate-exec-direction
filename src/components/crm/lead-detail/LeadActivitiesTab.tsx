import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  Mail,
  MessageSquare,
  Video,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Settings,
  Send,
  Loader2,
} from "lucide-react";
import { format, startOfDay, addDays, isSameDay, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AddActivityDialog } from "@/components/crm/AddActivityDialog";
import { ScheduleLeadMeetingDialog } from "./ScheduleLeadMeetingDialog";
import { WhatsAppQuickSendButton } from "@/components/crm/WhatsAppQuickSendButton";
import { ScheduleMeetingQuickButton } from "@/components/crm/ScheduleMeetingQuickButton";
import { sendLoggedWhatsAppText } from "@/lib/whatsapp/sendLoggedWhatsAppText";
import { ChecklistMeetingScheduler } from "./ChecklistMeetingScheduler";


interface Stage {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_final: boolean;
}

interface AutomationConfig {
  mode: 'task' | 'whatsapp_send' | 'schedule_meeting';
  whatsapp_template?: string;
  meeting_staff_id?: string;
  meeting_duration_minutes?: number;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  status: string;
  responsible?: { name: string } | null;
  created_at: string;
  is_automation?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  automation_config?: any;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string | null;
  item_type: string;
  whatsapp_template: string | null;
  completed: boolean;
}

interface LeadActivitiesTabProps {
  leadId: string;
  leadName: string;
  leadEmail?: string;
  leadPhone?: string;
  leadCompany?: string;
  stages: Stage[];
  currentStageId: string | null;
  stageName?: string;
  pipelineName?: string;
  ownerId?: string | null;
  ownerName?: string | null;
  activities: Activity[];
  onActivityComplete: (activityId: string) => void;
  onStageChange: (stageId: string) => void;
  onRefresh: () => void;
}

export const LeadActivitiesTab = ({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  leadCompany,
  stages,
  currentStageId,
  stageName,
  pipelineName,
  ownerId,
  ownerName,
  activities,
  onActivityComplete,
  onStageChange,
  onRefresh,
}: LeadActivitiesTabProps) => {
  const [showAddActivityDialog, setShowAddActivityDialog] = useState(false);
  const [showScheduleMeetingDialog, setShowScheduleMeetingDialog] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [selectedChecklistItem, setSelectedChecklistItem] = useState<ChecklistItem | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [userInstanceId, setUserInstanceId] = useState<string | null>(null);
  const [userStaffId, setUserStaffId] = useState<string | null>(null);

  // Fetch user's WhatsApp instance with send permission
  useEffect(() => {
    const fetchUserInstance = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get staff member
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id, role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (!staff) return;

        setUserStaffId(staff.id);

        if (staff.role === "master") {
          // Master gets any connected instance
          const { data: instances } = await supabase
            .from("whatsapp_instances")
            .select("id")
            .eq("status", "connected")
            .limit(1);
          
          if (instances && instances.length > 0) {
            setUserInstanceId(instances[0].id);
          }
        } else {
          // Others get instance with can_send permission
          const { data: access } = await supabase
            .from("whatsapp_instance_access")
            .select("instance_id, instance:whatsapp_instances(id, status)")
            .eq("staff_id", staff.id)
            .eq("can_send", true);

          const connectedAccess = (access || []).find(
            (a: any) => a.instance?.status === "connected"
          );
          
          if (connectedAccess) {
            setUserInstanceId(connectedAccess.instance_id);
          }
        }
      } catch (error) {
        console.error("Error fetching user instance:", error);
      }
    };

    fetchUserInstance();
  }, []);

  // Load checklist items from database
  useEffect(() => {
    const loadChecklist = async () => {
      if (!currentStageId) {
        setChecklistItems([]);
        setChecklistLoading(false);
        return;
      }

      setChecklistLoading(true);
      try {
        const { data, error } = await supabase
          .from("crm_stage_checklists")
          .select("id, title, description, item_type, whatsapp_template")
          .eq("stage_id", currentStageId)
          .eq("is_active", true)
          .order("sort_order");

        if (error) throw error;

        // Add completed state (stored in localStorage per lead+stage)
        const storageKey = `checklist_${leadId}_${currentStageId}`;
        const completedIds = JSON.parse(localStorage.getItem(storageKey) || "[]");
        
        setChecklistItems((data || []).map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          item_type: item.item_type || 'instruction',
          whatsapp_template: item.whatsapp_template,
          completed: completedIds.includes(item.id),
        })));
      } catch (error) {
        console.error("Error loading checklist:", error);
      } finally {
        setChecklistLoading(false);
      }
    };

    loadChecklist();
  }, [currentStageId, leadId]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call": return <Phone className="h-4 w-4" />;
      case "meeting": return <Video className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      case "whatsapp": return <MessageSquare className="h-4 w-4" />;
      case "proposal": return <FileText className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const currentStageIndex = stages.findIndex(s => s.id === currentStageId);

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = activity.scheduled_at 
      ? format(new Date(activity.scheduled_at), "yyyy-MM-dd")
      : "no-date";
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, Activity[]>);

  const sortedDates = Object.keys(groupedActivities).sort();

  // Get next 7 days for the calendar preview
  const today = startOfDay(new Date());
  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const activitiesPerDay = next7Days.map(day => {
    const dayStr = format(day, "yyyy-MM-dd");
    return {
      day,
      count: groupedActivities[dayStr]?.length || 0,
      activities: groupedActivities[dayStr] || [],
    };
  });

  const toggleChecklist = (id: string) => {
    const storageKey = `checklist_${leadId}_${currentStageId}`;
    
    setChecklistItems(prev => {
      const updated = prev.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      );
      
      // Save to localStorage
      const completedIds = updated.filter(i => i.completed).map(i => i.id);
      localStorage.setItem(storageKey, JSON.stringify(completedIds));
      
      return updated;
    });
  };

  const currentStage = stages.find(s => s.id === currentStageId);

  const getChecklistItemIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-4 w-4 text-green-600 shrink-0" />;
      case 'whatsapp': return <MessageSquare className="h-4 w-4 text-emerald-600 shrink-0" />;
      case 'meeting': return <Calendar className="h-4 w-4 text-purple-600 shrink-0" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  const processWhatsAppTemplate = (template: string | null) => {
    if (!template) return '';
    return template
      .replace(/\{\{nome_cliente\}\}/g, leadName || '')
      .replace(/\{\{empresa\}\}/g, leadCompany || '')
      .replace(/\{\{email\}\}/g, leadEmail || '')
      .replace(/\{\{telefone\}\}/g, leadPhone || '');
  };

  return (
    <div className="flex h-full">
      {/* Left side - Activities (narrower) */}
      <div className="w-[350px] min-w-[300px] shrink-0 border-r border-border">
        {/* Stage Progress Bar */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-2">
              {stages.filter(s => !s.is_final).map((stage, index) => {
                const isActive = stage.id === currentStageId;
                const isPast = index < currentStageIndex;
                
                return (
                  <button
                    key={stage.id}
                    onClick={() => onStageChange(stage.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                      isActive
                        ? "text-white"
                        : isPast
                        ? "bg-muted text-muted-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                    style={isActive ? { backgroundColor: stage.color } : undefined}
                  >
                    <span className={cn(
                      "flex items-center justify-center w-5 h-5 rounded-full text-[10px]",
                      isActive 
                        ? "bg-white/20" 
                        : isPast 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted-foreground/20"
                    )}>
                      {index + 1}
                    </span>
                    {stage.name}
                  </button>
                );
              })}
            </div>

            <Button variant="ghost" size="icon" className="shrink-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

        </div>

        {/* Checklist Items from Stage */}
        <ScrollArea className="flex-1">
          {checklistLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <div>
              {checklistItems.length > 0 ? (
                checklistItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedChecklistItem(item)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-l-4",
                      selectedChecklistItem?.id === item.id
                        ? "bg-primary/5 border-l-primary"
                        : "hover:bg-muted/30 border-l-transparent"
                    )}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleChecklist(item.id);
                        if (selectedChecklistItem?.id === item.id) {
                          setSelectedChecklistItem({ ...item, completed: !item.completed });
                        }
                      }}
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                        item.completed
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/50 hover:border-primary"
                      )}
                    >
                      {item.completed && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    
                    <span className="text-muted-foreground shrink-0">
                      {getChecklistItemIcon(item.item_type)}
                    </span>
                    
                    <span className={cn(
                      "text-sm flex-1 truncate",
                      item.completed && "line-through text-muted-foreground"
                    )}>
                      {item.title}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhuma atividade configurada para esta etapa
                </div>
              )}
              
              {/* Add Task Button */}
              <button
                onClick={() => setShowAddActivityDialog(true)}
                className="flex items-center gap-2 px-4 py-3 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar tarefa</span>
              </button>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right side - Selected Checklist Item Details (wider) */}
      <div className="flex-1 min-w-0 bg-card flex flex-col">
        {selectedChecklistItem ? (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-border flex items-center gap-2">
              {getChecklistItemIcon(selectedChecklistItem.item_type)}
              <span className="font-medium text-sm">{selectedChecklistItem.title}</span>
            </div>
            
            {/* Meeting type - show full scheduler */}
            {selectedChecklistItem.item_type === 'meeting' ? (
              <ChecklistMeetingScheduler
                leadId={leadId}
                leadName={leadName}
                leadEmail={leadEmail}
                checklistItemId={selectedChecklistItem.id}
                checklistItemTitle={selectedChecklistItem.title}
                onScheduled={() => {
                  toggleChecklist(selectedChecklistItem.id);
                  setSelectedChecklistItem({ ...selectedChecklistItem, completed: true });
                }}
              />
            ) : (
              <>
                <div className="flex-1 p-4 overflow-auto">
                  {selectedChecklistItem.description && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {selectedChecklistItem.description}
                    </p>
                  )}
                  
                  {selectedChecklistItem.item_type === 'whatsapp' && selectedChecklistItem.whatsapp_template && (
                    <div className="bg-sky-50 dark:bg-sky-950/30 rounded-lg p-4">
                      <p className="text-sm whitespace-pre-wrap">
                        {processWhatsAppTemplate(selectedChecklistItem.whatsapp_template)}
                      </p>
                    </div>
                  )}
                  
                  {selectedChecklistItem.item_type === 'call' && (
                    <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">
                        Ligue para {leadName} {leadPhone ? `no telefone ${leadPhone}` : ''}
                      </p>
                    </div>
                  )}
                  
                  {selectedChecklistItem.item_type === 'instruction' && !selectedChecklistItem.description && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">
                        Execute esta tarefa conforme as instruções.
                      </p>
                    </div>
                  )}
                </div>
                
                {selectedChecklistItem.item_type === 'whatsapp' && leadPhone && (
                  <div className="p-4 border-t border-border flex items-center gap-2">
                    <Button
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                      disabled={sendingMessage || !userInstanceId}
                      onClick={async () => {
                        if (!userInstanceId) {
                          toast.error("Você não tem uma conexão WhatsApp configurada. Solicite acesso ao administrador.");
                          return;
                        }

                        setSendingMessage(true);
                        try {
                          const message = processWhatsAppTemplate(selectedChecklistItem.whatsapp_template);
                          await sendLoggedWhatsAppText({
                            instanceId: userInstanceId,
                            phoneRaw: leadPhone,
                            message,
                            leadId,
                            leadName,
                            staffId: userStaffId || undefined,
                          });

                          toast.success("Mensagem enviada com sucesso!");
                          toggleChecklist(selectedChecklistItem.id);
                          setSelectedChecklistItem({ ...selectedChecklistItem, completed: true });
                        } catch (error: any) {
                          console.error("Error sending WhatsApp:", error);
                          toast.error(error.message || "Erro ao enviar mensagem");
                        } finally {
                          setSendingMessage(false);
                        }
                      }}
                    >
                      {sendingMessage ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4 mr-2" />
                      )}
                      {sendingMessage ? "Enviando..." : "Enviar mensagem"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-sm text-muted-foreground text-center">
              Selecione uma atividade do checklist para ver os detalhes
            </p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddActivityDialog
        open={showAddActivityDialog}
        onOpenChange={setShowAddActivityDialog}
        leadId={leadId}
        onSuccess={onRefresh}
      />
      
      <ScheduleLeadMeetingDialog
        open={showScheduleMeetingDialog}
        onOpenChange={setShowScheduleMeetingDialog}
        leadId={leadId}
        leadName={leadName}
        leadEmail={leadEmail}
        onSuccess={onRefresh}
      />
    </div>
  );
};
