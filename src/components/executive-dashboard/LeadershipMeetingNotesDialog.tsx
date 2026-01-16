import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RichTextarea } from "@/components/ui/rich-textarea";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  FileText, 
  Plus, 
  Save, 
  History, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  ListTodo,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Clock,
  User
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isBefore, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

interface StaffMember {
  id: string;
  name: string;
}

interface ActionItem {
  id: string;
  text: string;
  responsible_id?: string;
  responsible_name?: string;
  due_date?: string;
  done: boolean;
}

interface MeetingNote {
  id: string;
  meeting_date: string;
  meeting_type: 'leadership' | 'one_on_one';
  consultant_id?: string;
  notes: string;
  decisions: string;
  action_items: ActionItem[];
  next_steps: string;
  attendees: string[];
  created_at: string;
  created_by_name?: string;
}

interface Props {
  meetingType: 'leadership' | 'one_on_one';
  consultantId?: string;
  consultantName?: string;
  trigger?: React.ReactNode;
}

export function LeadershipMeetingNotesDialog({ 
  meetingType, 
  consultantId, 
  consultantName,
  trigger 
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  
  // Form state
  const [notes, setNotes] = useState("");
  const [decisions, setDecisions] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newActionText, setNewActionText] = useState("");
  const [newActionResponsibleId, setNewActionResponsibleId] = useState("");
  const [newActionDueDate, setNewActionDueDate] = useState<Date | undefined>();
  const [attendees, setAttendees] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Get previous meeting to show follow-up items
  const [previousMeeting, setPreviousMeeting] = useState<MeetingNote | null>(null);

  const fetchStaffMembers = async () => {
    const { data } = await supabase
      .from("onboarding_staff")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    
    if (data) {
      setStaffMembers(data);
    }
  };

  const fetchMeetingNotes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("leadership_meeting_notes")
        .select(`
          *,
          onboarding_staff!leadership_meeting_notes_created_by_fkey(name)
        `)
        .eq("meeting_type", meetingType)
        .order("meeting_date", { ascending: false })
        .limit(50);

      if (meetingType === 'one_on_one' && consultantId) {
        query = query.eq("consultant_id", consultantId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedNotes: MeetingNote[] = (data || []).map((note: any) => ({
        ...note,
        action_items: Array.isArray(note.action_items) ? note.action_items : [],
        attendees: Array.isArray(note.attendees) ? note.attendees : [],
        created_by_name: note.onboarding_staff?.name
      }));

      setMeetingNotes(formattedNotes);
      
      // Set previous meeting for follow-up
      if (formattedNotes.length > 0) {
        setPreviousMeeting(formattedNotes[0]);
      }
    } catch (error) {
      console.error("Error fetching meeting notes:", error);
      toast.error("Erro ao carregar histórico de reuniões");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMeetingNotes();
      fetchStaffMembers();
    }
  }, [open, meetingType, consultantId]);

  const resetForm = () => {
    setNotes("");
    setDecisions("");
    setNextSteps("");
    setActionItems([]);
    setNewActionText("");
    setNewActionResponsibleId("");
    setNewActionDueDate(undefined);
    setAttendees("");
    setEditingId(null);
  };

  const handleAddAction = () => {
    if (!newActionText.trim()) return;
    
    const staff = staffMembers.find(s => s.id === newActionResponsibleId);
    
    setActionItems(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: newActionText.trim(),
        responsible_id: newActionResponsibleId || undefined,
        responsible_name: staff?.name || undefined,
        due_date: newActionDueDate ? format(newActionDueDate, "yyyy-MM-dd") : undefined,
        done: false
      }
    ]);
    setNewActionText("");
    setNewActionResponsibleId("");
    setNewActionDueDate(undefined);
  };

  const handleRemoveAction = (id: string) => {
    setActionItems(prev => prev.filter(item => item.id !== id));
  };

  const handleToggleAction = (id: string) => {
    setActionItems(prev => prev.map(item => 
      item.id === id ? { ...item, done: !item.done } : item
    ));
  };

  const handleSave = async () => {
    if (!notes.trim()) {
      toast.error("Por favor, adicione as anotações da reunião");
      return;
    }

    setSaving(true);
    try {
      // Get current user's staff ID
      const { data: { user } } = await supabase.auth.getUser();
      let staffId = null;
      
      if (user) {
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", user.id)
          .single();
        staffId = staff?.id;
      }

      // Auto-add pending action item if user forgot to click +
      let finalActionItems = [...actionItems];
      if (newActionText.trim()) {
        const staff = staffMembers.find(s => s.id === newActionResponsibleId);
        finalActionItems.push({
          id: crypto.randomUUID(),
          text: newActionText.trim(),
          responsible_id: newActionResponsibleId || undefined,
          responsible_name: staff?.name || undefined,
          due_date: newActionDueDate ? format(newActionDueDate, "yyyy-MM-dd") : undefined,
          done: false
        });
      }

      const noteData = {
        meeting_date: format(new Date(), "yyyy-MM-dd"),
        meeting_type: meetingType as string,
        consultant_id: meetingType === 'one_on_one' ? consultantId : null,
        notes: notes.trim(),
        decisions: decisions.trim() || null,
        action_items: JSON.parse(JSON.stringify(finalActionItems)) as Json,
        next_steps: nextSteps.trim() || null,
        attendees: attendees.split(',').map(a => a.trim()).filter(Boolean) as Json,
        created_by: staffId
      };

      if (editingId) {
        const { error } = await supabase
          .from("leadership_meeting_notes")
          .update(noteData)
          .eq("id", editingId);
        
        if (error) throw error;
        toast.success("Anotações atualizadas com sucesso!");
      } else {
        const { error } = await supabase
          .from("leadership_meeting_notes")
          .insert([noteData]);
        
        if (error) throw error;
        toast.success("Anotações salvas com sucesso!");
      }

      resetForm();
      fetchMeetingNotes();
      setActiveTab('history');
    } catch (error) {
      console.error("Error saving meeting notes:", error);
      toast.error("Erro ao salvar anotações");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (note: MeetingNote) => {
    setEditingId(note.id);
    setNotes(note.notes || "");
    setDecisions(note.decisions || "");
    setNextSteps(note.next_steps || "");
    setActionItems(note.action_items || []);
    setAttendees(note.attendees?.join(', ') || "");
    setActiveTab('new');
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta anotação?")) return;

    try {
      const { error } = await supabase
        .from("leadership_meeting_notes")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Anotação excluída com sucesso");
      fetchMeetingNotes();
    } catch (error) {
      console.error("Error deleting meeting note:", error);
      toast.error("Erro ao excluir anotação");
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Mark an action as done from the agenda
  const markActionDone = async (noteId: string, actionId: string) => {
    const note = meetingNotes.find(n => n.id === noteId);
    if (!note) return;

    const updatedActions = note.action_items.map(item =>
      item.id === actionId ? { ...item, done: true } : item
    );

    try {
      const { error } = await supabase
        .from("leadership_meeting_notes")
        .update({ action_items: JSON.parse(JSON.stringify(updatedActions)) as Json })
        .eq("id", noteId);

      if (error) throw error;
      toast.success("Tarefa concluída!");
      fetchMeetingNotes();
    } catch (error) {
      console.error("Error marking action done:", error);
      toast.error("Erro ao atualizar tarefa");
    }
  };

  // Get pending action items that should appear on today's agenda
  // Shows items with due_date <= today that are not done
  const todayAgendaItems = meetingNotes
    .flatMap(note => 
      (note.action_items || [])
        .filter(item => {
          if (item.done) return false;
          if (!item.due_date) return false;
          const dueDate = parseISO(item.due_date);
          return isBefore(startOfDay(dueDate), startOfDay(new Date())) || isToday(dueDate);
        })
        .map(item => ({ ...item, noteId: note.id, fromMeeting: note.meeting_date }))
    );

  // Get pending action items from previous meetings (without due date or future dates)
  const pendingActionItems = meetingNotes
    .flatMap(note => 
      (note.action_items || [])
        .filter(item => {
          if (item.done) return false;
          if (!item.due_date) return true;
          const dueDate = parseISO(item.due_date);
          return !isBefore(startOfDay(dueDate), startOfDay(new Date())) && !isToday(dueDate);
        })
        .map(item => ({ ...item, noteId: note.id, fromMeeting: note.meeting_date }))
    )
    .slice(0, 5);

  const title = meetingType === 'leadership' 
    ? "Anotações - Reunião de Liderança" 
    : `Anotações - 1:1 ${consultantName || 'Consultor'}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            Anotações
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'new' | 'history')} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="new" className="gap-2">
              <Plus className="h-4 w-4" />
              {editingId ? 'Editar' : 'Nova Anotação'}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Histórico ({meetingNotes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* Today's Agenda - Pending tasks from previous meetings */}
            {todayAgendaItems.length > 0 && !editingId && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-primary">
                    <ListTodo className="h-4 w-4" />
                    Pauta de Hoje ({todayAgendaItems.length} {todayAgendaItems.length === 1 ? 'item' : 'itens'})
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <ul className="space-y-2">
                    {todayAgendaItems.map((item, i) => (
                      <li key={`${item.id}-${i}`} className="flex items-start gap-2 text-sm p-2 bg-background rounded-lg">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={() => markActionDone(item.noteId, item.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground hover:text-green-500" />
                        </Button>
                        <div className="flex-1">
                          <span className="text-foreground">{item.text}</span>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {item.responsible_name && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <User className="h-3 w-3" />
                                {item.responsible_name}
                              </Badge>
                            )}
                            {item.due_date && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs gap-1",
                                  isBefore(parseISO(item.due_date), startOfDay(new Date())) && "bg-destructive/10 text-destructive border-destructive/30"
                                )}
                              >
                                <CalendarIcon className="h-3 w-3" />
                                {format(parseISO(item.due_date), "dd/MM")}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              Reunião: {format(parseISO(item.fromMeeting), "dd/MM")}
                            </Badge>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Previous meeting follow-up items */}
            {pendingActionItems.length > 0 && !editingId && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <Clock className="h-4 w-4" />
                    Pendências futuras
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <ul className="space-y-2">
                    {pendingActionItems.map((item, i) => (
                      <li key={`${item.id}-${i}`} className="flex items-start gap-2 text-sm">
                        <ArrowRight className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-foreground">{item.text}</span>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {item.responsible_name && (
                              <Badge variant="outline" className="text-xs">{item.responsible_name}</Badge>
                            )}
                            {item.due_date && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {format(parseISO(item.due_date), "dd/MM")}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="attendees">Participantes</Label>
                <Input
                  id="attendees"
                  placeholder="Nomes separados por vírgula (ex: João, Maria, Pedro)"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="notes">Anotações da Reunião *</Label>
                <RichTextarea
                  id="notes"
                  placeholder="O que foi discutido na reunião... (use a barra de ferramentas para formatar)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                />
              </div>

              <div>
                <Label htmlFor="decisions">Decisões Tomadas</Label>
                <RichTextarea
                  id="decisions"
                  placeholder="Quais decisões foram tomadas..."
                  value={decisions}
                  onChange={(e) => setDecisions(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label>Ações / Tarefas</Label>
                <div className="space-y-2">
                  {actionItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg flex-wrap">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleToggleAction(item.id)}
                      >
                        <CheckCircle2 className={`h-4 w-4 ${item.done ? 'text-green-500' : 'text-muted-foreground'}`} />
                      </Button>
                      <span className={`flex-1 text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>
                        {item.text}
                      </span>
                      {item.responsible_name && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <User className="h-3 w-3" />
                          {item.responsible_name}
                        </Badge>
                      )}
                      {item.due_date && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {format(new Date(item.due_date), "dd/MM/yyyy")}
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() => handleRemoveAction(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  
                  <div className="flex gap-2 flex-wrap items-end">
                    <div className="flex-1 min-w-[200px]">
                      <Input
                        placeholder="Nova ação..."
                        value={newActionText}
                        onChange={(e) => setNewActionText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddAction()}
                      />
                    </div>
                    <div className="w-[180px]">
                      <Select value={newActionResponsibleId} onValueChange={setNewActionResponsibleId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          {staffMembers.map(staff => (
                            <SelectItem key={staff.id} value={staff.id}>
                              {staff.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-[140px] justify-start text-left font-normal",
                            !newActionDueDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newActionDueDate ? format(newActionDueDate, "dd/MM/yyyy") : "Data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={newActionDueDate}
                          onSelect={setNewActionDueDate}
                          initialFocus
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <Button type="button" variant="secondary" size="icon" onClick={handleAddAction}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="nextSteps">Próximos Passos</Label>
                <Textarea
                  id="nextSteps"
                  placeholder="O que deve ser feito antes da próxima reunião..."
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              {editingId && (
                <Button variant="ghost" onClick={resetForm}>
                  Cancelar Edição
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar Anotações'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[500px] pr-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : meetingNotes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma anotação registrada ainda
                </div>
              ) : (
                <div className="space-y-4">
                  {meetingNotes.map((note) => {
                    const isExpanded = expandedNotes.has(note.id);
                    const pendingActions = (note.action_items || []).filter(a => !a.done);
                    const completedActions = (note.action_items || []).filter(a => a.done);

                    return (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Card className="border">
                          <CardHeader 
                            className="py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => toggleExpanded(note.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold">
                                  {format(parseISO(note.meeting_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </span>
                                {pendingActions.length > 0 && (
                                  <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300">
                                    {pendingActions.length} pendente{pendingActions.length !== 1 && 's'}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); handleEdit(note); }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </div>
                            </div>
                            {note.attendees && note.attendees.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Participantes: {note.attendees.join(', ')}
                              </p>
                            )}
                          </CardHeader>
                          
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <CardContent className="pt-0 space-y-4">
                                  <Separator />
                                  
                                  {note.notes && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-1 text-muted-foreground">Anotações</h4>
                                      <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown>{note.notes}</ReactMarkdown>
                                      </div>
                                    </div>
                                  )}

                                  {note.decisions && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-1 text-muted-foreground">Decisões</h4>
                                      <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown>{note.decisions}</ReactMarkdown>
                                      </div>
                                    </div>
                                  )}

                                  {note.action_items && note.action_items.length > 0 && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-2 text-muted-foreground flex items-center gap-2">
                                        <ListTodo className="h-4 w-4" />
                                        Ações ({completedActions.length}/{note.action_items.length})
                                      </h4>
                                      <ul className="space-y-2">
                                        {note.action_items.map((item, i) => (
                                          <li 
                                            key={i} 
                                            className={`text-sm flex items-center gap-2 flex-wrap ${item.done ? 'text-muted-foreground' : ''}`}
                                          >
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-5 w-5 p-0"
                                              onClick={() => markActionDone(note.id, item.id)}
                                              disabled={item.done}
                                            >
                                              <CheckCircle2 className={`h-4 w-4 ${item.done ? 'text-green-500' : 'text-muted-foreground hover:text-green-500'}`} />
                                            </Button>
                                            <span className={item.done ? 'line-through' : ''}>{item.text}</span>
                                            {item.responsible_name && (
                                              <Badge variant="secondary" className="text-xs gap-1">
                                                <User className="h-3 w-3" />
                                                {item.responsible_name}
                                              </Badge>
                                            )}
                                            {item.due_date && (
                                              <Badge 
                                                variant="outline" 
                                                className={cn(
                                                  "text-xs gap-1",
                                                  !item.done && isBefore(new Date(item.due_date), startOfDay(new Date())) && "bg-destructive/10 text-destructive border-destructive/30"
                                                )}
                                              >
                                                <CalendarIcon className="h-3 w-3" />
                                                {format(new Date(item.due_date), "dd/MM/yyyy")}
                                              </Badge>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {note.next_steps && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-1 text-muted-foreground">Próximos Passos</h4>
                                      <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown>{note.next_steps}</ReactMarkdown>
                                      </div>
                                    </div>
                                  )}

                                  {note.created_by_name && (
                                    <p className="text-xs text-muted-foreground pt-2 border-t">
                                      Registrado por {note.created_by_name}
                                    </p>
                                  )}
                                </CardContent>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
