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
} from "lucide-react";
import { format, startOfDay, addDays, isSameDay, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AddActivityDialog } from "@/components/crm/AddActivityDialog";
import { ScheduleLeadMeetingDialog } from "./ScheduleLeadMeetingDialog";
import { WhatsAppQuickSendButton } from "@/components/crm/WhatsAppQuickSendButton";
import { ScheduleMeetingQuickButton } from "@/components/crm/ScheduleMeetingQuickButton";
import { OwnerSelector } from "./OwnerSelector";

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
      {/* Left side - Activities */}
      <div className="flex-1 min-w-0">
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

          {/* Owner Avatar */}
          <div className="flex items-center gap-2 mt-2">
            <OwnerSelector
              leadId={leadId}
              currentOwnerId={ownerId}
              currentOwnerName={ownerName}
              onOwnerChange={onRefresh}
            />
          </div>
        </div>

        {/* Days Navigation */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-muted-foreground">Dias</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary">Próximas atividades</span>
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Activities and Checklist List */}
        <ScrollArea className="flex-1">
          {/* Checklist Items from Stage */}
          {!checklistLoading && checklistItems.length > 0 && (
            <div className="border-b border-border">
              {checklistItems.map((item, index) => (
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
              ))}
            </div>
          )}

          {/* Activities Table */}
          <div className="flex">
            {/* Day numbers column */}
            <div className="w-12 border-r border-border flex-shrink-0">
              {activitiesPerDay.map(({ day, count }, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-10 flex items-center justify-center text-sm font-medium",
                    count > 0 ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {index + 1}
                </div>
              ))}
            </div>

            {/* Activities table */}
            <div className="flex-1">
              <div className="grid grid-cols-4 gap-0 text-xs text-muted-foreground border-b border-border">
                <div className="px-3 py-2">Data</div>
                <div className="px-3 py-2">Atividade</div>
                <div className="px-3 py-2">Ação</div>
                <div className="px-3 py-2">Concluído</div>
              </div>

              {sortedDates.map(dateStr => (
                <div key={dateStr}>
                  {groupedActivities[dateStr].map(activity => {
                    const config = activity.automation_config as AutomationConfig | null;
                    const isWhatsAppSend = activity.is_automation && config?.mode === 'whatsapp_send';
                    const isScheduleMeeting = activity.is_automation && config?.mode === 'schedule_meeting';

                    return (
                      <div
                        key={activity.id}
                        className="grid grid-cols-4 gap-0 items-center hover:bg-muted/30 transition-colors"
                      >
                        <div className="px-3 py-2 text-sm text-primary">
                          {activity.scheduled_at && 
                            format(new Date(activity.scheduled_at), "dd/MM", { locale: ptBR })
                          }
                        </div>
                        <div className="px-3 py-2 flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {getActivityIcon(activity.type)}
                          </span>
                          <span className="text-sm truncate">{activity.title}</span>
                        </div>
                        <div className="px-3 py-2">
                          {isWhatsAppSend && activity.status !== "completed" && config && (
                            <WhatsAppQuickSendButton
                              activityId={activity.id}
                              automationConfig={config}
                              lead={{
                                id: leadId,
                                name: leadName,
                                email: leadEmail,
                                phone: leadPhone,
                                company: leadCompany,
                              }}
                              stageName={stageName}
                              pipelineName={pipelineName}
                              onSuccess={onRefresh}
                            />
                          )}
                          {isScheduleMeeting && activity.status !== "completed" && config && (
                            <ScheduleMeetingQuickButton
                              activityId={activity.id}
                              automationConfig={config}
                              leadId={leadId}
                              leadName={leadName}
                              leadEmail={leadEmail}
                              onSuccess={onRefresh}
                            />
                          )}
                        </div>
                        <div className="px-3 py-2">
                          <Checkbox
                            checked={activity.status === "completed"}
                            onCheckedChange={() => onActivityComplete(activity.id)}
                            disabled={activity.status === "completed"}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {activities.length === 0 && checklistItems.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhuma atividade
                </div>
              )}
            </div>
          </div>

          {/* Add Activity Button */}
          <div className="p-4 border-t border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start text-muted-foreground">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova atividade
                  <ChevronDown className="h-4 w-4 ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => setShowAddActivityDialog(true)}>
                  <Phone className="h-4 w-4 mr-2" />
                  Atividade (Ligação, Email, etc)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowScheduleMeetingDialog(true)}>
                  <Video className="h-4 w-4 mr-2" />
                  Agendar Reunião (Google Calendar)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ScrollArea>
      </div>

      {/* Right side - Selected Checklist Item Details */}
      <div className="w-[350px] border-l border-border bg-card flex flex-col">
        {selectedChecklistItem ? (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-border flex items-center gap-2">
              {getChecklistItemIcon(selectedChecklistItem.item_type)}
              <span className="font-medium text-sm">{selectedChecklistItem.title}</span>
            </div>
            
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
                  onClick={() => {
                    const message = processWhatsAppTemplate(selectedChecklistItem.whatsapp_template);
                    const phone = leadPhone.replace(/\D/g, '');
                    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
                    toggleChecklist(selectedChecklistItem.id);
                    setSelectedChecklistItem({ ...selectedChecklistItem, completed: true });
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Enviar mensagem
                </Button>
              </div>
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
