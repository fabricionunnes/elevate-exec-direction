import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  HelpCircle,
  Settings,
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
  const [qualificationExpanded, setQualificationExpanded] = useState(true);

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

        {/* Activities List by Day */}
        <ScrollArea className="flex-1">
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

              {activities.length === 0 && (
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

      {/* Right side - Checklist */}
      <div className="w-[350px] border-l border-border bg-card">
        <Collapsible open={qualificationExpanded} onOpenChange={setQualificationExpanded}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full p-4 hover:bg-muted/50 transition-colors">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{currentStage?.name || "Qualificação"}</span>
            <HelpCircle className="h-4 w-4 text-muted-foreground ml-auto" />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-3">
              {checklistLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Carregando...
                </p>
              ) : checklistItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum item de checklist configurado para esta etapa.
                </p>
              ) : (
                checklistItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3"
                  >
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-4 h-4 rounded-full border-2 border-red-400 flex items-center justify-center shrink-0">
                        {item.completed && (
                          <div className="w-2 h-2 rounded-full bg-red-400" />
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleChecklist(item.id)}
                      className={cn(
                        "flex-1 text-left",
                        item.completed && "line-through text-muted-foreground"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {getChecklistItemIcon(item.item_type)}
                        <div className="flex-1">
                          <span className="text-sm">{item.title}</span>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.description}
                            </p>
                          )}
                          {item.item_type === 'whatsapp' && item.whatsapp_template && (
                            <p className="text-xs text-emerald-600 mt-1 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded">
                              {processWhatsAppTemplate(item.whatsapp_template)}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                ))
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
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
