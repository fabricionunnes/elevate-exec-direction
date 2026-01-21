import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Building2,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Save,
  Loader2,
  ClipboardList,
  StickyNote,
  Video,
  Send,
  Trash2,
  ExternalLink,
  Sparkles,
  MessageSquare,
  Bot,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScheduleMeetingDialog } from "@/components/onboarding-tasks/ScheduleMeetingDialog";
import ReactMarkdown from "react-markdown";

interface HotseatResponse {
  id: string;
  respondent_name: string;
  company_name: string;
  subjects: string[];
  description: string | null;
  linked_company_id: string | null;
  linked_project_id: string | null;
  scheduled_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Company {
  id: string;
  name: string;
}

interface Project {
  id: string;
  product_name: string;
  onboarding_company_id: string | null;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
  created_by_staff_id: string | null;
  staff_name?: string;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface HotseatResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  response: HotseatResponse;
  onUpdated: () => void;
}

export function HotseatResponseDialog({
  open,
  onOpenChange,
  response,
  onUpdated,
}: HotseatResponseDialogProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [currentStaffRole, setCurrentStaffRole] = useState<string | null>(null);
  
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(response.linked_company_id);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(response.linked_project_id);
  const [scheduledAt, setScheduledAt] = useState<string>(
    response.scheduled_at ? format(new Date(response.scheduled_at), "yyyy-MM-dd'T'HH:mm") : ""
  );
  const [status, setStatus] = useState<string>(response.status);
  
  const [newNote, setNewNote] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [companySearchOpen, setCompanySearchOpen] = useState(false);
  
  // Meeting dialog
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  
  // AI Summary states
  const [companySummary, setCompanySummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);

  const isAdmin = currentStaffRole === "admin";

  useEffect(() => {
    if (open) {
      fetchData();
      fetchNotes();
      setSelectedCompanyId(response.linked_company_id);
      setSelectedProjectId(response.linked_project_id);
      setScheduledAt(response.scheduled_at ? format(new Date(response.scheduled_at), "yyyy-MM-dd'T'HH:mm") : "");
      setStatus(response.status);
      setCompanySummary(null);
      setChatMessages([]);
    }
  }, [open, response]);

  // Auto-load summary when company is linked
  useEffect(() => {
    if (selectedCompanyId && activeTab === "ai") {
      loadCompanySummary();
    }
  }, [selectedCompanyId, activeTab]);

  const fetchData = async () => {
    try {
      // Fetch current staff
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id, role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        if (staff) {
          setCurrentStaffId(staff.id);
          setCurrentStaffRole(staff.role);
        }
      }

      // Fetch companies
      const { data: companiesData } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      setCompanies(companiesData || []);

      // Fetch projects
      const { data: projectsData } = await supabase
        .from("onboarding_projects")
        .select("id, product_name, onboarding_company_id")
        .eq("status", "active")
        .order("product_name");
      setProjects(projectsData || []);

      // Fetch staff
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("is_active", true)
        .order("name");
      setStaffList(staffData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from("hotseat_notes")
        .select(`
          id,
          content,
          created_at,
          created_by_staff_id,
          onboarding_staff:created_by_staff_id (name)
        `)
        .eq("hotseat_response_id", response.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const notesWithStaff = (data || []).map((note: any) => ({
        ...note,
        staff_name: note.onboarding_staff?.name || "Sistema",
      }));
      setNotes(notesWithStaff);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  };

  const loadCompanySummary = async () => {
    if (!selectedCompanyId || isLoadingSummary) return;
    
    setIsLoadingSummary(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const { data, error } = await supabase.functions.invoke("hotseat-company-summary", {
        body: { 
          companyId: selectedCompanyId,
          projectId: selectedProjectId,
        },
      });

      if (error) throw error;
      setCompanySummary(data.content);
    } catch (error: any) {
      console.error("Error loading summary:", error);
      if (error.message?.includes("429")) {
        toast.error("Limite de requisições atingido. Tente novamente em alguns minutos.");
      } else if (error.message?.includes("402")) {
        toast.error("Créditos de IA esgotados.");
      } else {
        toast.error("Erro ao carregar resumo da empresa");
      }
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedCompanyId || isSendingChat) return;
    
    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsSendingChat(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const { data, error } = await supabase.functions.invoke("hotseat-company-summary", {
        body: { 
          companyId: selectedCompanyId,
          projectId: selectedProjectId,
          message: userMessage,
        },
      });

      if (error) throw error;
      setChatMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    } catch (error: any) {
      console.error("Error sending message:", error);
      setChatMessages(prev => [...prev, { role: "assistant", content: "Desculpe, ocorreu um erro ao processar sua mensagem." }]);
      if (error.message?.includes("429")) {
        toast.error("Limite de requisições atingido.");
      } else if (error.message?.includes("402")) {
        toast.error("Créditos de IA esgotados.");
      }
    } finally {
      setIsSendingChat(false);
    }
  };

  const filteredProjects = selectedCompanyId
    ? projects.filter((p) => p.onboarding_company_id === selectedCompanyId)
    : projects;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updateData: any = {
        linked_company_id: selectedCompanyId || null,
        linked_project_id: selectedProjectId || null,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        status,
      };

      // If scheduling, auto-set status to "scheduled"
      if (scheduledAt && status === "pending") {
        updateData.status = "scheduled";
        setStatus("scheduled");
      }

      const { error } = await supabase
        .from("hotseat_responses")
        .update(updateData)
        .eq("id", response.id);

      if (error) throw error;

      toast.success("Dados salvos com sucesso!");
      onUpdated();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setIsAddingNote(true);
    try {
      const { error } = await supabase
        .from("hotseat_notes")
        .insert({
          hotseat_response_id: response.id,
          content: newNote.trim(),
          created_by_staff_id: currentStaffId,
        });

      if (error) throw error;

      toast.success("Anotação adicionada!");
      setNewNote("");
      fetchNotes();
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Erro ao adicionar anotação");
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      toast.error("Informe o título da tarefa");
      return;
    }

    if (!selectedProjectId) {
      toast.error("Vincule a um projeto primeiro");
      return;
    }

    setIsCreatingTask(true);
    try {
      const { error } = await supabase
        .from("onboarding_tasks")
        .insert({
          project_id: selectedProjectId,
          title: `[Hotseat] ${newTaskTitle.trim()}`,
          description: `Tarefa criada a partir do Hotseat de ${response.respondent_name} (${response.company_name})`,
          status: "pending",
          priority: "high",
          responsible_staff_id: newTaskAssignee || null,
        });

      if (error) throw error;

      toast.success("Tarefa criada com sucesso!");
      setNewTaskTitle("");
      setNewTaskAssignee("");
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Erro ao criar tarefa");
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir esta resposta do Hotseat? Esta ação não pode ser desfeita.")) {
      return;
    }

    setIsDeleting(true);
    try {
      // First delete related notes
      await supabase
        .from("hotseat_notes")
        .delete()
        .eq("hotseat_response_id", response.id);

      // Then delete the response
      const { error } = await supabase
        .from("hotseat_responses")
        .delete()
        .eq("id", response.id);

      if (error) throw error;

      toast.success("Resposta excluída com sucesso!");
      onOpenChange(false);
      onUpdated();
    } catch (error) {
      console.error("Error deleting response:", error);
      toast.error("Erro ao excluir resposta");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGoToProject = () => {
    if (selectedProjectId) {
      window.open(`/#/onboarding-tasks/${selectedProjectId}`, "_blank");
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case "pending": return "border-yellow-500 text-yellow-600";
      case "scheduled": return "border-blue-500 text-blue-600";
      case "completed": return "border-green-500 text-green-600";
      case "cancelled": return "border-red-500 text-red-600";
      default: return "";
    }
  };

  const selectedCompanyName = companies.find(c => c.id === selectedCompanyId)?.name;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {response.respondent_name}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {selectedProjectId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGoToProject}
                  className="gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ir ao Projeto
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Excluir resposta"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-2">
                <StickyNote className="h-4 w-4" />
                Anotações
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-2">
                <Plus className="h-4 w-4" />
                Ações
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-2" disabled={!selectedCompanyId}>
                <Sparkles className="h-4 w-4" />
                IA
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="max-h-[60vh] mt-4">
              <TabsContent value="details" className="space-y-4 mt-0">
                {/* Response Info */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{response.company_name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {response.subjects.map((subject, idx) => (
                      <Badge key={idx} variant="secondary">{subject}</Badge>
                    ))}
                  </div>
                  {response.description && (
                    <p className="text-sm text-muted-foreground">{response.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Recebido em {format(new Date(response.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>

                <Separator />

                {/* Link to Company */}
                <div className="space-y-2">
                  <Label>Vincular à Empresa</Label>
                  <Popover open={companySearchOpen} onOpenChange={setCompanySearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={companySearchOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedCompanyId
                          ? companies.find((c) => c.id === selectedCompanyId)?.name || "Selecione..."
                          : "Nenhuma"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar empresa..." />
                        <CommandList>
                          <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                setSelectedCompanyId(null);
                                setSelectedProjectId(null);
                                setCompanySearchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  !selectedCompanyId ? "opacity-100" : "opacity-0"
                                )}
                              />
                              Nenhuma
                            </CommandItem>
                            {companies.map((company) => (
                              <CommandItem
                                key={company.id}
                                value={company.name}
                                onSelect={() => {
                                  setSelectedCompanyId(company.id);
                                  setSelectedProjectId(null);
                                  setCompanySearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCompanyId === company.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {company.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Link to Project */}
                <div className="space-y-2">
                  <Label>Vincular ao Projeto</Label>
                  <Select
                    value={selectedProjectId || "none"}
                    onValueChange={(v) => setSelectedProjectId(v === "none" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {filteredProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.product_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Schedule */}
                <div className="space-y-2">
                  <Label>Agendar para</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-500" />
                          Pendente
                        </div>
                      </SelectItem>
                      <SelectItem value="scheduled">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-500" />
                          Agendado
                        </div>
                      </SelectItem>
                      <SelectItem value="completed">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Concluído
                        </div>
                      </SelectItem>
                      <SelectItem value="cancelled">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          Cancelado
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Save */}
                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Alterações
                </Button>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4 mt-0">
                {/* Add Note */}
                <div className="space-y-2">
                  <Label>Nova Anotação</Label>
                  <Textarea
                    placeholder="Digite uma anotação que ficará visível para consultores..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={handleAddNote}
                    disabled={isAddingNote || !newNote.trim()}
                    size="sm"
                  >
                    {isAddingNote ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Adicionar
                  </Button>
                </div>

                <Separator />

                {/* Notes List */}
                <div className="space-y-3">
                  {notes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma anotação ainda
                    </p>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="bg-muted/50 rounded-lg p-3">
                        <p className="text-sm">{note.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>{note.staff_name}</span>
                          <span>•</span>
                          <span>{format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="actions" className="space-y-4 mt-0">
                {/* Create Task */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Criar Tarefa
                  </Label>
                  <Input
                    placeholder="Título da tarefa..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                  />
                  <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Atribuir a..." />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.name} ({staff.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleCreateTask}
                    disabled={isCreatingTask || !newTaskTitle.trim() || !selectedProjectId}
                    size="sm"
                    className="w-full"
                  >
                    {isCreatingTask ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Criar Tarefa
                  </Button>
                  {!selectedProjectId && (
                    <p className="text-xs text-muted-foreground">
                      Vincule a um projeto na aba "Detalhes" para criar tarefas
                    </p>
                  )}
                </div>

                <Separator />

                {/* Schedule Meeting */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Agendar Reunião
                  </Label>
                  <Button
                    variant="outline"
                    onClick={() => setShowScheduleDialog(true)}
                    disabled={!selectedProjectId}
                    className="w-full"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Agendar Reunião no Google Calendar
                  </Button>
                  {!selectedProjectId && (
                    <p className="text-xs text-muted-foreground">
                      Vincule a um projeto na aba "Detalhes" para agendar reuniões
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="ai" className="space-y-4 mt-0">
                {!selectedCompanyId ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Vincule uma empresa na aba "Detalhes" para usar a IA</p>
                  </div>
                ) : (
                  <>
                    {/* Summary Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Resumo da Empresa
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={loadCompanySummary}
                          disabled={isLoadingSummary}
                        >
                          {isLoadingSummary ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Atualizar"
                          )}
                        </Button>
                      </div>
                      
                      <div className="bg-muted/50 rounded-lg p-4 min-h-[150px]">
                        {isLoadingSummary ? (
                          <div className="flex items-center justify-center h-[150px]">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : companySummary ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{companySummary}</ReactMarkdown>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-[150px] text-muted-foreground">
                            <p>Clique em "Atualizar" para gerar o resumo</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Chat Section */}
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Pergunte sobre a empresa
                      </Label>
                      
                      {/* Chat Messages */}
                      {chatMessages.length > 0 && (
                        <div className="space-y-3 max-h-[200px] overflow-y-auto">
                          {chatMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "rounded-lg p-3 text-sm",
                                msg.role === "user"
                                  ? "bg-primary text-primary-foreground ml-8"
                                  : "bg-muted mr-8"
                              )}
                            >
                              {msg.role === "assistant" ? (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                              ) : (
                                msg.content
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Chat Input */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ex: Qual é o histórico de NPS dessa empresa?"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendChatMessage();
                            }
                          }}
                          disabled={isSendingChat}
                        />
                        <Button
                          onClick={sendChatMessage}
                          disabled={isSendingChat || !chatInput.trim()}
                          size="icon"
                        >
                          {isSendingChat ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Schedule Meeting Dialog */}
      {selectedProjectId && (
        <ScheduleMeetingDialog
          open={showScheduleDialog}
          onOpenChange={setShowScheduleDialog}
          projectId={selectedProjectId}
          companyName={selectedCompanyName}
          defaultTitle={`Hotseat - ${response.respondent_name}`}
          defaultDescription={`Reunião de Hotseat com ${response.respondent_name} (${response.company_name})\n\nAssuntos: ${response.subjects.join(", ")}\n\n${response.description || ""}`}
          onMeetingCreated={() => {
            toast.success("Reunião agendada com sucesso!");
            setShowScheduleDialog(false);
          }}
        />
      )}
    </>
  );
}
