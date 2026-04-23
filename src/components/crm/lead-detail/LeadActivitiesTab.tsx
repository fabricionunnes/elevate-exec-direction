import { useState, useEffect, useRef } from "react";
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
  Pencil,
  Paperclip,
  Image,
  Film,
  File as FileIcon,
  X,
} from "lucide-react";
import { format, startOfDay, addDays, isSameDay, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AddActivityDialog } from "@/components/crm/AddActivityDialog";
import { EditActivityDialog } from "@/components/crm/EditActivityDialog";
import { ScheduleLeadMeetingDialog } from "./ScheduleLeadMeetingDialog";
import { WhatsAppQuickSendButton } from "@/components/crm/WhatsAppQuickSendButton";
import { ScheduleMeetingQuickButton } from "@/components/crm/ScheduleMeetingQuickButton";
import { sendLoggedWhatsAppText } from "@/lib/whatsapp/sendLoggedWhatsAppText";
import { ChecklistMeetingScheduler } from "./ChecklistMeetingScheduler";
import { ReunionPanel } from "./ReunionPanel";


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

interface ChecklistAttachment {
  url: string;
  name: string;
  type: string;
  mimeType: string;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string | null;
  item_type: string;
  whatsapp_template: string | null;
  whatsapp_attachments: ChecklistAttachment[];
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
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [extraAttachments, setExtraAttachments] = useState<ChecklistAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const sendFileInputRef = useRef<HTMLInputElement>(null);

  const handleSendFileUpload = async (files: FileList) => {
    setUploadingAttachment(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `send/${leadId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('checklist-attachments')
          .upload(path, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('checklist-attachments')
          .getPublicUrl(path);

        const type = file.type.startsWith('image/') ? 'image' 
          : file.type.startsWith('video/') ? 'video' 
          : file.type.startsWith('audio/') ? 'audio' 
          : 'document';

        setExtraAttachments(prev => [...prev, {
          url: urlData.publicUrl,
          name: file.name,
          type,
          mimeType: file.type,
        }]);
      }
    } catch (error: any) {
      toast.error("Erro ao fazer upload: " + (error.message || ""));
    } finally {
      setUploadingAttachment(false);
    }
  };

  const getAttachmentIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-3 w-3" />;
      case 'video': return <Film className="h-3 w-3" />;
      default: return <FileIcon className="h-3 w-3" />;
    }
  };
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
          // Master uses the default instance from config
          const { data: defaultConfig } = await supabase
            .from("whatsapp_default_config")
            .select("setting_value")
            .eq("setting_key", "default_instance")
            .maybeSingle();

          const defaultInstanceName = defaultConfig?.setting_value;

          if (defaultInstanceName) {
            const { data: inst } = await supabase
              .from("whatsapp_instances")
              .select("id")
              .eq("instance_name", defaultInstanceName)
              .maybeSingle();
            if (inst) {
              setUserInstanceId(inst.id);
            }
          }

          // Fallback: any connected instance
          if (!defaultInstanceName) {
            const { data: instances } = await supabase
              .from("whatsapp_instances")
              .select("id")
              .eq("status", "connected")
              .limit(1);
            if (instances && instances.length > 0) {
              setUserInstanceId(instances[0].id);
            }
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
          .select("id, title, description, item_type, whatsapp_template, whatsapp_attachments")
          .eq("stage_id", currentStageId)
          .eq("is_active", true)
          .order("sort_order");

        if (error) throw error;

        // Add completed state (stored in localStorage per lead+stage)
        const storageKey = `checklist_${leadId}_${currentStageId}`;
        const completedIds = JSON.parse(localStorage.getItem(storageKey) || "[]");
        
        setChecklistItems((data || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          item_type: item.item_type || 'instruction',
          whatsapp_template: item.whatsapp_template,
          whatsapp_attachments: Array.isArray(item.whatsapp_attachments) ? item.whatsapp_attachments : [],
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

  // Manual activities (added via AddActivityDialog) - show all, completed last
  const manualActivities = activities
    .filter(a => a.type !== "note")
    .sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (a.status !== "completed" && b.status === "completed") return -1;
      return 0;
    });

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
      case 'reunion': return <Video className="h-4 w-4 text-blue-600 shrink-0" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  // Fetch next scheduled meeting for template variables
  const [nextMeetingLink, setNextMeetingLink] = useState<string>('');
  const [nextMeetingDateTime, setNextMeetingDateTime] = useState<string>('');

  useEffect(() => {
    const fetchNextMeeting = async () => {
      const { data } = await supabase
        .from("crm_activities")
        .select("scheduled_at, meeting_link")
        .eq("lead_id", leadId)
        .eq("type", "meeting")
        .eq("status", "pending")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .single();

      if (data) {
        setNextMeetingLink((data as any).meeting_link || '');
        if (data.scheduled_at) {
          setNextMeetingDateTime(
            format(new Date(data.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
          );
        }
      }
    };
    fetchNextMeeting();
  }, [leadId]);

  const processWhatsAppTemplate = (template: string | null) => {
    if (!template) return '';
    const firstName = (leadName || '').split(' ')[0];
    return template
      .replace(/\{\{nome_cliente\}\}/g, leadName || '')
      .replace(/\{\{primeiro_nome\}\}/g, firstName)
      .replace(/\{\{empresa\}\}/g, leadCompany || '')
      .replace(/\{\{email\}\}/g, leadEmail || '')
      .replace(/\{\{telefone\}\}/g, leadPhone || '')
      .replace(/\{\{responsavel\}\}/g, ownerName || '')
      .replace(/\{\{link_agendamento\}\}/g, nextMeetingLink || '')
      .replace(/\{\{data_hora_agendamento\}\}/g, nextMeetingDateTime || '');
  };

  const stagesScrollRef = useRef<HTMLDivElement>(null);
  const scrollStages = (dir: 'left' | 'right') => {
    stagesScrollRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  const completedChecklist = checklistItems.filter(i => i.completed).length;
  const totalChecklist = checklistItems.length;
  const checklistProgress = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Stage Progress Bar - Redesigned */}
      <div className="px-3 py-4 border-b border-border w-full bg-gradient-to-b from-muted/30 to-transparent">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-7 w-7 rounded-full"
            onClick={() => scrollStages('left')}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          
          <div ref={stagesScrollRef} className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex items-center min-w-max px-2 py-1">
              {stages.filter(s => !s.is_final).map((stage, index, arr) => {
                const isActive = stage.id === currentStageId;
                const isPast = index < currentStageIndex;
                const isLast = index === arr.length - 1;
                
                return (
                  <div key={stage.id} className="flex items-center">
                    <button
                      onClick={() => onStageChange(stage.id)}
                      className="flex flex-col items-center gap-1.5 relative group min-w-[60px]"
                    >
                      <div className="relative">
                        <div
                          className={cn(
                            "flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold transition-all duration-200 border-2",
                            isActive
                              ? "text-white shadow-lg scale-110 border-transparent"
                              : isPast
                              ? "bg-primary/10 text-primary border-primary"
                              : "bg-card text-muted-foreground border-border group-hover:border-muted-foreground/40"
                          )}
                          style={isActive ? {
                            backgroundColor: stage.color,
                            boxShadow: `0 0 0 3px ${stage.color}25, 0 4px 12px ${stage.color}30`,
                          } : undefined}
                        >
                          {isPast ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            index + 1
                          )}
                        </div>
                        {isActive && (
                          <div
                            className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                        )}
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium whitespace-nowrap max-w-[80px] truncate leading-tight",
                        isActive 
                          ? "text-foreground font-semibold" 
                          : isPast 
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}>
                        {stage.name}
                      </span>
                    </button>
                    
                    {!isLast && (
                      <div className={cn(
                        "w-8 lg:w-14 xl:w-20 h-[2px] mx-0.5 rounded-full transition-colors",
                        isPast ? "bg-primary" : "bg-border"
                      )} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-7 w-7 rounded-full"
            onClick={() => scrollStages('right')}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content - Two columns on desktop, stacked on mobile */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Left side - Checklist */}
        <div className={cn(
          "w-full md:w-[320px] lg:w-[380px] md:min-w-[280px] shrink-0 md:border-r border-border flex flex-col",
          selectedChecklistItem ? "hidden md:flex" : "flex"
        )}>
          {/* Checklist progress header */}
          {totalChecklist > 0 && (
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted-foreground">Progresso da etapa</span>
                <span className="text-xs font-semibold text-foreground">{completedChecklist}/{totalChecklist}</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${checklistProgress}%` }}
                />
              </div>
            </div>
          )}
          <ScrollArea className="flex-1">
            {checklistLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div>
                {checklistItems.length > 0 ? (
                  <div className="py-1">
                    {checklistItems.map((item, idx) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedChecklistItem(item)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all duration-150 border-l-[3px] group",
                          selectedChecklistItem?.id === item.id
                            ? "bg-primary/5 border-l-primary"
                            : "hover:bg-muted/40 border-l-transparent",
                          item.completed && "opacity-60"
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
                            "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200",
                            item.completed
                              ? "bg-primary border-primary scale-100"
                              : "border-muted-foreground/30 group-hover:border-primary/60"
                          )}
                        >
                          {item.completed && (
                            <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        
                        <span className="shrink-0 opacity-70">
                          {getChecklistItemIcon(item.item_type)}
                        </span>
                        
                        <span className={cn(
                          "text-sm flex-1 leading-snug",
                          item.completed && "line-through text-muted-foreground"
                        )}>
                          {item.title}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 px-6">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Nenhuma atividade configurada para esta etapa</p>
                  </div>
                )}
                
                {/* Manual Activities */}
                {manualActivities.length > 0 && (
                  <>
                    <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-t border-border bg-muted/20">
                      Tarefas adicionadas
                    </div>
                    {manualActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all duration-150 border-l-[3px] hover:bg-muted/40 border-l-transparent group",
                          activity.status === "completed" && "opacity-50"
                        )}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activity.status !== "completed") {
                              onActivityComplete(activity.id);
                            }
                          }}
                          className={cn(
                            "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200",
                            activity.status === "completed"
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30 group-hover:border-primary/60"
                          )}
                        >
                          {activity.status === "completed" && (
                            <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className="shrink-0 opacity-70">
                          {getActivityIcon(activity.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            "text-sm truncate block leading-snug",
                            activity.status === "completed" && "line-through text-muted-foreground"
                          )}>{activity.title}</span>
                          {activity.scheduled_at && (
                            <span className="text-[11px] text-muted-foreground">
                              {format(new Date(activity.scheduled_at), "dd/MM HH:mm")}
                            </span>
                          )}
                        </div>
                        {activity.status !== "completed" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingActivity(activity);
                            }}
                            className="shrink-0 p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* Add Task Button */}
                <button
                  onClick={() => setShowAddActivityDialog(true)}
                  className="flex items-center gap-2 px-4 py-3 w-full text-sm text-primary/70 hover:text-primary hover:bg-primary/5 transition-colors border-t border-border font-medium"
                >
                  <Plus className="h-4 w-4" />
                  <span>Adicionar tarefa</span>
                </button>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right side - Selected Checklist Item Details */}
        <div className={cn(
          "flex-1 min-w-0 bg-muted/10 flex flex-col",
          selectedChecklistItem ? "flex" : "hidden md:flex"
        )}>
        {selectedChecklistItem ? (
          <div className="flex flex-col h-full">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2.5 bg-card">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 md:hidden shrink-0"
                onClick={() => setSelectedChecklistItem(null)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="p-1.5 rounded-lg bg-primary/10">
                {getChecklistItemIcon(selectedChecklistItem.item_type)}
              </div>
              <span className="font-semibold text-sm text-foreground">{selectedChecklistItem.title}</span>
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
            ) : selectedChecklistItem.item_type === 'reunion' ? (
              <ReunionPanel
                leadId={leadId}
                leadName={leadName}
                leadEmail={leadEmail}
                onNoShowToggle={() => {
                  toggleChecklist(selectedChecklistItem.id);
                  setSelectedChecklistItem({ ...selectedChecklistItem, completed: true });
                }}
                onRefresh={onRefresh}
              />
            ) : (
              <>
                <div className="flex-1 p-4 overflow-auto">
                  {selectedChecklistItem.description && (
                    <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap break-words">
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

                  {/* Show configured attachments */}
                  {selectedChecklistItem.item_type === 'whatsapp' && selectedChecklistItem.whatsapp_attachments?.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <p className="text-xs font-medium text-muted-foreground">Anexos configurados:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedChecklistItem.whatsapp_attachments.map((att, i) => (
                          <div key={i} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1 text-xs">
                            {getAttachmentIcon(att.type)}
                            <span className="max-w-[100px] truncate">{att.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extra attachments added at send time */}
                  {selectedChecklistItem.item_type === 'whatsapp' && (
                    <div className="space-y-2 mt-3">
                      {extraAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {extraAttachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1 text-xs">
                              {getAttachmentIcon(att.type)}
                              <span className="max-w-[100px] truncate">{att.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 p-0"
                                onClick={() => setExtraAttachments(prev => prev.filter((_, idx) => idx !== i))}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <input
                        ref={sendFileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) handleSendFileUpload(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={uploadingAttachment}
                        onClick={() => sendFileInputRef.current?.click()}
                      >
                        {uploadingAttachment ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Paperclip className="h-3.5 w-3.5 mr-1" />}
                        Anexar arquivo
                      </Button>
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
                          
                          // Send text message first
                          await sendLoggedWhatsAppText({
                            instanceId: userInstanceId,
                            phoneRaw: leadPhone,
                            message,
                            leadId,
                            leadName,
                            staffId: userStaffId || undefined,
                          });

                          // Send all attachments (configured + extra)
                          const allAttachments = [
                            ...(selectedChecklistItem.whatsapp_attachments || []),
                            ...extraAttachments,
                          ];

                          const phone = leadPhone.replace(/\D/g, '');
                          const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;

                          for (const att of allAttachments) {
                            await supabase.functions.invoke("evolution-api", {
                              body: {
                                action: "sendMedia",
                                instanceId: userInstanceId,
                                phone: formattedPhone,
                                mediaType: att.type,
                                mediaUrl: att.url,
                                caption: "",
                                fileName: att.name,
                              },
                            });
                          }

                          toast.success("Mensagem enviada com sucesso!");
                          toggleChecklist(selectedChecklistItem.id);
                          setSelectedChecklistItem({ ...selectedChecklistItem, completed: true });
                          setExtraAttachments([]);
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
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Selecione uma atividade do checklist<br />para ver os detalhes
              </p>
            </div>
          </div>
        )}
        </div>
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

      <EditActivityDialog
        open={!!editingActivity}
        onOpenChange={(open) => { if (!open) setEditingActivity(null); }}
        activity={editingActivity}
        onSuccess={onRefresh}
      />
    </div>
  );
};
