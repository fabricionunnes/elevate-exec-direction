import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Check, Loader2, ListChecks, Sparkles, Plus, Video, Calendar, User } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { addBusinessDays, ensureBusinessDay } from "@/lib/businessDays";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TemplateTask = {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  sort_order: number;
  default_days_offset: number | null;
  duration_days: number | null;
  phase?: string | null;
  phase_order?: number | null;
  recurrence?: string | null;
  is_internal?: boolean;
};

type AISuggestedTask = {
  title: string;
  description: string;
  priority: string;
  phase: string;
  reasoning: string;
};

type MeetingAction = {
  id: string;
  title: string;
  description: string;
  due_days: number;
  priority: string;
  selected: boolean;
};

type Meeting = {
  id: string;
  meeting_title: string | null;
  subject: string | null;
  meeting_date: string;
  notes: string | null;
  transcript: string | null;
};

type StaffMember = {
  id: string;
  name: string;
};

interface GenerateTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  productId: string;
  onTasksGenerated: () => void;
}

export const GenerateTasksDialog = ({
  open,
  onOpenChange,
  projectId,
  productId,
  onTasksGenerated,
}: GenerateTasksDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateTask[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [activeTab, setActiveTab] = useState<"template" | "ai" | "meeting">("ai");
  
  // AI generation state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTasks, setAiTasks] = useState<AISuggestedTask[]>([]);
  const [selectedAiTasks, setSelectedAiTasks] = useState<Set<number>>(new Set());
  const [aiContext, setAiContext] = useState<{ completedCount: number; pendingCount: number; companyName: string } | null>(null);
  const [userSuggestion, setUserSuggestion] = useState("");

  // Meeting-based generation state
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [meetingActions, setMeetingActions] = useState<MeetingAction[]>([]);
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedResponsible, setSelectedResponsible] = useState<string>("");

  const templatesCount = templates.length;
  const titlePreview = useMemo(() => templates.slice(0, 5).map((t) => t.title), [templates]);

  useEffect(() => {
    if (!open) {
      // Reset AI state when dialog closes
      setAiTasks([]);
      setSelectedAiTasks(new Set());
      setAiContext(null);
      setUserSuggestion("");
      // Reset meeting state
      setSelectedMeetingId("");
      setMeetingActions([]);
      setSelectedResponsible("");
      return;
    }

    // Load meetings and staff when dialog opens
    loadMeetingsAndStaff();

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("onboarding_task_templates")
          .select("id,title,description,priority,sort_order,default_days_offset,duration_days,phase,phase_order,recurrence,is_internal")
          .eq("product_id", productId)
          .order("phase_order", { ascending: true })
          .order("sort_order", { ascending: true });

        if (error) throw error;
        if (!cancelled) setTemplates((data || []) as TemplateTask[]);
      } catch (err: any) {
        console.error(err);
        toast.error("Erro ao carregar templates do serviço");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  // Load meetings with transcripts and staff members
  const loadMeetingsAndStaff = async () => {
    try {
      // Load meetings with transcripts or notes
      const { data: meetingsData } = await supabase
        .from("onboarding_meeting_notes")
        .select("id, meeting_title, subject, meeting_date, notes, transcript")
        .eq("project_id", projectId)
        .eq("is_finalized", true)
        .order("meeting_date", { ascending: false })
        .limit(20);

      // Filter meetings that have content (transcript or notes)
      const filteredMeetings = (meetingsData || []).filter(
        (m) => (m.transcript && m.transcript.length > 50) || (m.notes && m.notes.length > 50)
      );
      setMeetings(filteredMeetings);

      // Load staff members
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name")
        .eq("is_active", true)
        .in("role", ["master", "admin", "cs", "consultant"])
        .order("name");

      setStaffMembers(staffData || []);

      // Try to get the project's consultant as default responsible
      const { data: projectData } = await supabase
        .from("onboarding_projects")
        .select("consultant_id, cs_id")
        .eq("id", projectId)
        .single();

      if (projectData?.consultant_id) {
        setSelectedResponsible(projectData.consultant_id);
      } else if (projectData?.cs_id) {
        setSelectedResponsible(projectData.cs_id);
      }
    } catch (error) {
      console.error("Error loading meetings and staff:", error);
    }
  };

  const handleClose = () => onOpenChange(false);

  const handleGenerateAI = async () => {
    setAiLoading(true);
    setAiTasks([]);
    setSelectedAiTasks(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-tasks", {
        body: { projectId, userSuggestion: userSuggestion.trim() || undefined },
      });

      if (error) throw error;

      if (data?.success && data?.tasks) {
        setAiTasks(data.tasks);
        setAiContext(data.context);
        // Select all tasks by default
        setSelectedAiTasks(new Set(data.tasks.map((_: AISuggestedTask, i: number) => i)));
        toast.success(`${data.tasks.length} tarefas sugeridas pela IA`);
      } else {
        throw new Error(data?.error || "Erro ao gerar tarefas");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao gerar tarefas com IA");
    } finally {
      setAiLoading(false);
    }
  };

  const toggleAiTask = (index: number) => {
    setSelectedAiTasks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Generate tasks from meeting
  const handleGenerateFromMeeting = async () => {
    if (!selectedMeetingId) {
      toast.error("Selecione uma reunião");
      return;
    }

    setMeetingLoading(true);
    setMeetingActions([]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-meeting-actions", {
        body: { meetingId: selectedMeetingId, projectId },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.actions || data.actions.length === 0) {
        throw new Error("Nenhuma ação identificada na reunião");
      }

      setMeetingActions(data.actions);
      toast.success(`${data.actions.length} ações identificadas!`);
    } catch (err) {
      console.error("Error generating from meeting:", err);
      const message = err instanceof Error ? err.message : "Erro ao gerar ações";
      toast.error(message);
    } finally {
      setMeetingLoading(false);
    }
  };

  const toggleMeetingAction = (id: string) => {
    setMeetingActions((prev) =>
      prev.map((action) =>
        action.id === id ? { ...action, selected: !action.selected } : action
      )
    );
  };

  const handleApplyMeetingTasks = async () => {
    const selectedActions = meetingActions.filter((a) => a.selected);
    if (selectedActions.length === 0) {
      toast.error("Selecione pelo menos uma tarefa");
      return;
    }

    setMeetingLoading(true);

    try {
      const today = ensureBusinessDay(new Date());
      const tasksToInsert = selectedActions.map((action, index) => {
        const dueDate = action.due_days > 0 ? addBusinessDays(today, action.due_days) : today;
        
        return {
          project_id: projectId,
          title: action.title,
          description: action.description,
          priority: action.priority || "medium",
          status: "pending" as const,
          due_date: dueDate.toISOString().split("T")[0],
          tags: ["Reunião", "IA"],
          sort_order: index,
          responsible_staff_id: selectedResponsible || null,
        };
      });

      const { error: insertError } = await supabase.from("onboarding_tasks").insert(tasksToInsert);
      if (insertError) throw insertError;

      toast.success(`${tasksToInsert.length} tarefas criadas com sucesso!`);
      onTasksGenerated();
      handleClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao criar tarefas");
    } finally {
      setMeetingLoading(false);
    }
  };

  const handleApplyAITasks = async () => {
    if (selectedAiTasks.size === 0) {
      toast.error("Selecione pelo menos uma tarefa");
      return;
    }

    setAiLoading(true);

    try {
      // Ensure base date is a business day before calculating offsets
      const today = ensureBusinessDay(new Date());
      const tasksToInsert = Array.from(selectedAiTasks).map((index, i) => {
        const task = aiTasks[index];
        // Use business days: start 7 business days from now, stagger by 3 business days
        const dueDate = addBusinessDays(today, 7 + i * 3);

        return {
          project_id: projectId,
          title: task.title,
          description: `${task.description}\n\n---\n💡 **Por que esta tarefa?** ${task.reasoning}`,
          priority: task.priority || "medium",
          status: "pending" as const,
          due_date: dueDate.toISOString().split("T")[0],
          tags: task.phase ? [task.phase, "IA"] : ["IA"],
          sort_order: i,
        };
      });

      const { error: insertError } = await supabase.from("onboarding_tasks").insert(tasksToInsert);
      if (insertError) throw insertError;

      toast.success(`${tasksToInsert.length} tarefas criadas com sucesso!`);
      onTasksGenerated();
      handleClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao criar tarefas");
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (templatesCount === 0) {
      toast.error("Nenhum template encontrado para este serviço");
      return;
    }

    setLoading(true);

    try {
      // Ensure base date is a business day before calculating offsets
      const today = ensureBusinessDay(new Date());

      if (replaceExisting) {
        const { error: delError } = await supabase
          .from("onboarding_tasks")
          .delete()
          .eq("project_id", projectId);
        if (delError) throw delError;
      }

      let baseSortOrder = 0;
      if (!replaceExisting) {
        const { data: existing } = await supabase
          .from("onboarding_tasks")
          .select("sort_order")
          .eq("project_id", projectId)
          .order("sort_order", { ascending: false })
          .limit(1);

        baseSortOrder = (existing?.[0]?.sort_order ?? -1) + 1;
      }

      const tasksToInsert = templates.map((tpl, idx) => {
        const offset = (tpl.default_days_offset ?? 0) + (tpl.duration_days ?? 0);
        // Always calculate due date using business days (even for offset 0, use today which is guaranteed to be a business day)
        const due = offset > 0 ? addBusinessDays(today, offset) : today;
        const dueDate = due.toISOString().split("T")[0];

        return {
          project_id: projectId,
          template_id: tpl.id,
          title: tpl.title,
          description: tpl.description,
          priority: tpl.priority || "medium",
          status: "pending" as const,
          due_date: dueDate,
          start_date: null,
          sort_order: baseSortOrder + (tpl.sort_order ?? idx),
          recurrence: tpl.recurrence ?? null,
          tags: tpl.phase ? [tpl.phase, String(tpl.phase_order ?? 99)] : null,
          estimated_hours: null,
          is_internal: tpl.is_internal ?? false,
        };
      });

      const { error: insertError } = await supabase.from("onboarding_tasks").insert(tasksToInsert);
      if (insertError) throw insertError;

      toast.success(`${templatesCount} tarefas aplicadas a partir do template!`);
      onTasksGenerated();
      handleClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao aplicar template de tarefas");
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">Alta</Badge>;
      case "low":
        return <Badge variant="secondary">Baixa</Badge>;
      default:
        return <Badge variant="outline">Média</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Gerar Tarefas
          </DialogTitle>
          <DialogDescription>
            Escolha entre gerar tarefas com IA, a partir de uma reunião ou aplicar o template padrão.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "template" | "ai" | "meeting")} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Gerar com IA
            </TabsTrigger>
            <TabsTrigger value="meeting" className="gap-2">
              <Video className="h-4 w-4" />
              A partir de Reunião
            </TabsTrigger>
            <TabsTrigger value="template" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Template
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            {aiTasks.length === 0 ? (
              <div className="flex-1 flex flex-col p-4 border rounded-lg border-dashed space-y-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-8 w-8 text-primary/70" />
                  <div>
                    <h3 className="font-semibold">Gerar tarefas inteligentes</h3>
                    <p className="text-sm text-muted-foreground">
                      Descreva o que você gostaria de focar ou deixe em branco para sugestões gerais.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="user-suggestion">O que você gostaria de trabalhar? (opcional)</Label>
                  <Textarea
                    id="user-suggestion"
                    placeholder="Ex: Quero focar em prospecção ativa, melhorar o processo de follow-up, treinar a equipe para lidar com objeções..."
                    value={userSuggestion}
                    onChange={(e) => setUserSuggestion(e.target.value)}
                    className="min-h-[100px] resize-none"
                    disabled={aiLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    A IA também considerará o contexto do cliente e tarefas já realizadas.
                  </p>
                </div>

                <Button onClick={handleGenerateAI} disabled={aiLoading} className="w-full">
                  {aiLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Analisando contexto...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Gerar sugestões
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <>
                {aiContext && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>📊 {aiContext.completedCount} tarefas analisadas</span>
                    <span>📋 {aiContext.pendingCount} pendentes</span>
                  </div>
                )}
                <div className="flex-1 overflow-hidden min-h-0">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3 pr-4 pb-2">
                      {aiTasks.map((task, index) => (
                        <Card 
                          key={index} 
                          className={`cursor-pointer transition-all ${
                            selectedAiTasks.has(index) 
                              ? "ring-2 ring-primary bg-primary/5" 
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => toggleAiTask(index)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Checkbox 
                                checked={selectedAiTasks.has(index)} 
                                onCheckedChange={() => toggleAiTask(index)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1"
                              />
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{task.title}</span>
                                  {getPriorityBadge(task.priority)}
                                  {task.phase && (
                                    <Badge variant="outline" className="text-xs">
                                      {task.phase}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {task.description}
                                </p>
                                <p className="text-xs text-primary/80 italic">
                                  💡 {task.reasoning}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={handleGenerateAI} disabled={aiLoading}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar novamente
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedAiTasks.size} de {aiTasks.length} selecionadas
                  </span>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="template" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                checked={replaceExisting}
                onCheckedChange={(v) => setReplaceExisting(Boolean(v))}
                className="mt-1"
              />
              <div className="space-y-1">
                <Label className="font-medium">Substituir tarefas atuais</Label>
                <p className="text-sm text-muted-foreground">
                  Recomendado apenas para projetos novos ou resetar o cronograma.
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-3 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Templates encontrados</p>
                  <p className="text-sm text-muted-foreground">Serviço: {productId}</p>
                </div>
                <Badge variant="secondary">{loading ? "..." : templatesCount}</Badge>
              </div>

              {templatesCount > 0 && (
                <ScrollArea className="mt-3 flex-1">
                  <div className="space-y-2 pr-4">
                    {titlePreview.map((t) => (
                      <div key={t} className="text-sm">
                        {t}
                      </div>
                    ))}
                    {templatesCount > titlePreview.length && (
                      <div className="text-xs text-muted-foreground">
                        +{templatesCount - titlePreview.length} outras
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}

              {!loading && templatesCount === 0 && (
                <p className="mt-3 text-sm text-destructive">
                  Nenhum template cadastrado para este serviço.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Meeting Tab */}
          <TabsContent value="meeting" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            {meetingActions.length === 0 ? (
              <div className="flex-1 flex flex-col p-4 border rounded-lg border-dashed space-y-4">
                <div className="flex items-center gap-3">
                  <Video className="h-8 w-8 text-primary/70" />
                  <div>
                    <h3 className="font-semibold">Gerar tarefas a partir de reunião</h3>
                    <p className="text-sm text-muted-foreground">
                      Selecione uma reunião para extrair ações e criar tarefas.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selecione a reunião</Label>
                    <Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha uma reunião..." />
                      </SelectTrigger>
                      <SelectContent>
                        {meetings.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            Nenhuma reunião com transcrição/notas encontrada
                          </div>
                        ) : (
                          meetings.map((meeting) => (
                            <SelectItem key={meeting.id} value={meeting.id}>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                <span>
                                  {format(new Date(meeting.meeting_date), "dd/MM/yyyy", { locale: ptBR })} -{" "}
                                  {meeting.meeting_title || meeting.subject || "Reunião"}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Responsável pelas tarefas</Label>
                    <Select value={selectedResponsible} onValueChange={setSelectedResponsible}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o responsável..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staffMembers.map((staff) => (
                          <SelectItem key={staff.id} value={staff.id}>
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3" />
                              {staff.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Este responsável será atribuído a todas as tarefas geradas.
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={handleGenerateFromMeeting} 
                  disabled={meetingLoading || !selectedMeetingId} 
                  className="w-full"
                >
                  {meetingLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Analisando reunião...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Extrair ações da reunião
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Video className="h-4 w-4" />
                    Ações extraídas da reunião
                  </div>
                  {selectedResponsible && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">
                        Responsável: {staffMembers.find((s) => s.id === selectedResponsible)?.name}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-hidden min-h-0">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3 pr-4 pb-2">
                      {meetingActions.map((action) => {
                        const dueDate = action.due_days > 0 
                          ? addBusinessDays(ensureBusinessDay(new Date()), action.due_days) 
                          : ensureBusinessDay(new Date());
                        
                        return (
                          <Card 
                            key={action.id} 
                            className={`cursor-pointer transition-all ${
                              action.selected 
                                ? "ring-2 ring-primary bg-primary/5" 
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() => toggleMeetingAction(action.id)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <Checkbox 
                                  checked={action.selected} 
                                  onCheckedChange={() => toggleMeetingAction(action.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-1"
                                />
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{action.title}</span>
                                    {getPriorityBadge(action.priority)}
                                    <Badge variant="outline" className="text-xs">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      {format(dueDate, "dd/MM/yyyy", { locale: ptBR })}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {action.description}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={handleGenerateFromMeeting} disabled={meetingLoading}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar novamente
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {meetingActions.filter((a) => a.selected).length} de {meetingActions.length} selecionadas
                  </span>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading || aiLoading || meetingLoading}>
            Cancelar
          </Button>
          {activeTab === "ai" ? (
            <Button 
              onClick={handleApplyAITasks} 
              disabled={aiLoading || selectedAiTasks.size === 0}
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Criar {selectedAiTasks.size} tarefa{selectedAiTasks.size !== 1 ? "s" : ""}
            </Button>
          ) : activeTab === "meeting" ? (
            <Button 
              onClick={handleApplyMeetingTasks} 
              disabled={meetingLoading || meetingActions.filter((a) => a.selected).length === 0}
            >
              {meetingLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Criar {meetingActions.filter((a) => a.selected).length} tarefa{meetingActions.filter((a) => a.selected).length !== 1 ? "s" : ""}
            </Button>
          ) : (
            <Button onClick={handleApplyTemplate} disabled={loading || templatesCount === 0}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Aplicar template
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
