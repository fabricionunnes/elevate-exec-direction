import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  Building2,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  Target,
  Trophy,
  XCircle,
  Plus,
  MessageSquare,
  FileText,
  History,
  Save,
  Loader2,
  CheckCircle,
  PhoneCall,
  Video,
  Send
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AddActivityDialog } from "@/components/crm/AddActivityDialog";
import { createStageActivities } from "@/hooks/useStageActions";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  role: string | null;
  city: string | null;
  state: string | null;
  origin: string | null;
  owner_staff_id: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  opportunity_value: number | null;
  probability: number | null;
  entered_pipeline_at: string | null;
  last_activity_at: string | null;
  next_activity_at: string | null;
  closed_at: string | null;
  loss_reason_id: string | null;
  segment: string | null;
  estimated_revenue: string | null;
  employee_count: string | null;
  main_pain: string | null;
  urgency: string | null;
  fit_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  stage?: { name: string; color: string; is_final: boolean; final_type: string | null };
  pipeline?: { name: string };
  owner?: { name: string };
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  status: string;
  notes: string | null;
  responsible?: { name: string };
  created_at: string;
}

interface HistoryItem {
  id: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  staff?: { name: string };
  created_at: string;
}

export const CRMLeadDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useOutletContext<{ staffRole: string; isAdmin: boolean }>();
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lossReasons, setLossReasons] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [wonDialogOpen, setWonDialogOpen] = useState(false);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [selectedLossReason, setSelectedLossReason] = useState("");
  const [quickNote, setQuickNote] = useState("");

  const [formData, setFormData] = useState<Partial<Lead>>({});

  const loadLead = useCallback(async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("crm_leads")
        .select(`
          *,
          stage:crm_stages(name, color, is_final, final_type),
          pipeline:crm_pipelines(name),
          owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setLead(data);
      setFormData(data);

      // Load stages for this pipeline
      if (data.pipeline_id) {
        const { data: stagesData } = await supabase
          .from("crm_stages")
          .select("*")
          .eq("pipeline_id", data.pipeline_id)
          .order("sort_order");
        setStages(stagesData || []);
      }

      // Load activities
      const { data: activitiesData } = await supabase
        .from("crm_activities")
        .select(`
          *,
          responsible:onboarding_staff!crm_activities_responsible_staff_id_fkey(name)
        `)
        .eq("lead_id", id)
        .order("scheduled_at", { ascending: false });
      setActivities(activitiesData || []);

      // Load history
      const { data: historyData } = await supabase
        .from("crm_lead_history")
        .select(`
          *,
          staff:onboarding_staff(name)
        `)
        .eq("lead_id", id)
        .order("created_at", { ascending: false });
      setHistory(historyData || []);

      // Load loss reasons
      const { data: reasonsData } = await supabase
        .from("crm_loss_reasons")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      setLossReasons(reasonsData || []);

      // Load staff for owner selection
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("is_active", true)
        .in("role", ["admin", "head_comercial", "closer", "sdr"])
        .order("name");
      setStaffList(staffData || []);

    } catch (error) {
      console.error("Error loading lead:", error);
      toast.error("Erro ao carregar lead");
      navigate("/crm/leads");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadLead();
  }, [loadLead]);

  const handleSave = async () => {
    if (!lead) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          company: formData.company,
          role: formData.role,
          city: formData.city,
          state: formData.state,
          origin: formData.origin,
          opportunity_value: formData.opportunity_value,
          probability: formData.probability,
          segment: formData.segment,
          main_pain: formData.main_pain,
          urgency: formData.urgency,
          fit_score: formData.fit_score,
          notes: formData.notes,
          owner_staff_id: formData.owner_staff_id,
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Lead salvo com sucesso");
      setEditMode(false);
      loadLead();
    } catch (error) {
      console.error("Error saving lead:", error);
      toast.error("Erro ao salvar lead");
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (stageId: string) => {
    if (!lead) return;

    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ stage_id: stageId })
        .eq("id", lead.id);

      if (error) throw error;

      // Create automatic activities for this stage
      await createStageActivities(lead.id, stageId);

      toast.success("Etapa atualizada");
      loadLead();
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Erro ao atualizar etapa");
    }
  };

  const handleMarkWon = async () => {
    if (!lead) return;

    const wonStage = stages.find(s => s.final_type === "won");
    if (!wonStage) {
      toast.error("Etapa 'Ganho' não encontrada");
      return;
    }

    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ 
          stage_id: wonStage.id,
          closed_at: new Date().toISOString()
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("🎉 Lead marcado como GANHO!");
      setWonDialogOpen(false);
      loadLead();
    } catch (error) {
      console.error("Error marking as won:", error);
      toast.error("Erro ao marcar como ganho");
    }
  };

  const handleMarkLost = async () => {
    if (!lead || !selectedLossReason) {
      toast.error("Selecione um motivo de perda");
      return;
    }

    const lostStage = stages.find(s => s.final_type === "lost");
    if (!lostStage) {
      toast.error("Etapa 'Perdido' não encontrada");
      return;
    }

    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ 
          stage_id: lostStage.id,
          loss_reason_id: selectedLossReason,
          closed_at: new Date().toISOString()
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Lead marcado como perdido");
      setLostDialogOpen(false);
      loadLead();
    } catch (error) {
      console.error("Error marking as lost:", error);
      toast.error("Erro ao marcar como perdido");
    }
  };

  const handleAddNote = async () => {
    if (!lead || !quickNote.trim()) return;

    try {
      // Get staff id
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      const { error } = await supabase
        .from("crm_lead_history")
        .insert({
          lead_id: lead.id,
          action: "note",
          notes: quickNote,
          staff_id: staff?.id,
        });

      if (error) throw error;

      toast.success("Nota adicionada");
      setQuickNote("");
      loadLead();
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Erro ao adicionar nota");
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call": return <PhoneCall className="h-4 w-4" />;
      case "meeting": return <Video className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      case "whatsapp": return <MessageSquare className="h-4 w-4" />;
      case "proposal": return <FileText className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Lead não encontrado</p>
      </div>
    );
  }

  const isClosed = lead.stage?.is_final;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{lead.name}</h1>
            {lead.stage && (
              <Badge style={{ backgroundColor: lead.stage.color }} className="text-white">
                {lead.stage.name}
              </Badge>
            )}
            {lead.urgency === "high" && (
              <Badge variant="destructive">URGENTE</Badge>
            )}
          </div>
          {lead.company && (
            <p className="text-muted-foreground flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {lead.company}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {!isClosed && (
            <>
              <Button variant="outline" onClick={() => setLostDialogOpen(true)}>
                <XCircle className="h-4 w-4 mr-2 text-red-500" />
                Perdido
              </Button>
              <Button onClick={() => setWonDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
                <Trophy className="h-4 w-4 mr-2" />
                Ganho
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Lead Details */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Dados do Lead</CardTitle>
                {!editMode ? (
                  <Button variant="ghost" size="sm" onClick={() => setEditMode(true)}>
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editMode ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Nome</Label>
                      <Input
                        value={formData.name || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input
                        value={formData.phone || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>E-mail</Label>
                      <Input
                        value={formData.email || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Empresa</Label>
                      <Input
                        value={formData.company || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Cargo</Label>
                      <Input
                        value={formData.role || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Valor (R$)</Label>
                      <Input
                        type="number"
                        value={formData.opportunity_value || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, opportunity_value: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Probabilidade (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.probability || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, probability: parseInt(e.target.value) }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Responsável</Label>
                      <Select
                        value={formData.owner_staff_id || ""}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, owner_staff_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {staffList.map(staff => (
                            <SelectItem key={staff.id} value={staff.id}>
                              {staff.name} ({staff.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Dor Principal</Label>
                    <Textarea
                      value={formData.main_pain || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, main_pain: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      value={formData.notes || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
                        <Phone className="h-4 w-4" />
                        {lead.phone}
                      </a>
                    )}
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
                        <Mail className="h-4 w-4" />
                        {lead.email}
                      </a>
                    )}
                    {(lead.city || lead.state) && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {[lead.city, lead.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p className="font-medium text-green-600">{formatCurrency(lead.opportunity_value)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Probabilidade</p>
                      <p className="font-medium">{lead.probability || 0}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Responsável</p>
                      <p className="font-medium">{lead.owner?.name || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Origem</p>
                      <p className="font-medium">{lead.origin || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Segmento</p>
                      <p className="font-medium">{lead.segment || "-"}</p>
                    </div>
                  </div>

                  {lead.main_pain && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Dor Principal</p>
                        <p className="text-sm">{lead.main_pain}</p>
                      </div>
                    </>
                  )}

                  {lead.notes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Observações</p>
                        <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Stage Selector */}
          {!isClosed && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Etapa</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={lead.stage_id || ""} onValueChange={handleStageChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.filter(s => !s.is_final).map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setAddActivityOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Atividade
              </Button>
              {lead.phone && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  asChild
                >
                  <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    WhatsApp
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center Column - Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="activities">Atividades</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4">
              {/* Quick Note */}
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Adicionar nota rápida..."
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      rows={2}
                      className="flex-1"
                    />
                    <Button onClick={handleAddNote} disabled={!quickNote.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* History Timeline */}
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {history.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        Nenhum histórico ainda
                      </p>
                    ) : (
                      history.map(item => (
                        <div key={item.id} className="flex gap-3 pb-4 border-b border-border last:border-0">
                          <div className="mt-1">
                            <History className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">{item.staff?.name || "Sistema"}</span>
                              <span className="text-muted-foreground">
                                {item.action === "stage_change" && "moveu para"}
                                {item.action === "note" && "adicionou nota"}
                                {item.action === "created" && "criou o lead"}
                              </span>
                              {item.new_value && (
                                <Badge variant="secondary">{item.new_value}</Badge>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-sm mt-1 text-muted-foreground">{item.notes}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activities" className="mt-4">
              <div className="mb-4">
                <Button onClick={() => setAddActivityOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Atividade
                </Button>
              </div>

              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {activities.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        Nenhuma atividade ainda
                      </p>
                    ) : (
                      activities.map(activity => (
                        <div key={activity.id} className="flex gap-3 pb-4 border-b border-border last:border-0">
                          <div className="mt-1 p-2 bg-muted rounded-lg">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{activity.title}</span>
                              <Badge 
                                variant={activity.status === "completed" ? "default" : "secondary"}
                              >
                                {activity.status === "completed" ? "Concluída" : 
                                 activity.status === "pending" ? "Pendente" : activity.status}
                              </Badge>
                            </div>
                            {activity.description && (
                              <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {activity.scheduled_at && format(new Date(activity.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              {activity.responsible && ` • ${activity.responsible.name}`}
                            </p>
                          </div>
                          {activity.status === "pending" && (
                            <Button variant="ghost" size="icon">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Won Dialog */}
      <AlertDialog open={wonDialogOpen} onOpenChange={setWonDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🎉 Marcar como Ganho?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma que este lead foi convertido em venda?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkWon} className="bg-green-600 hover:bg-green-700">
              Confirmar Ganho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lost Dialog */}
      <AlertDialog open={lostDialogOpen} onOpenChange={setLostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como Perdido</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o motivo da perda deste lead:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={selectedLossReason} onValueChange={setSelectedLossReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {lossReasons.map(reason => (
                  <SelectItem key={reason.id} value={reason.id}>{reason.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkLost} className="bg-red-600 hover:bg-red-700">
              Marcar como Perdido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddActivityDialog
        open={addActivityOpen}
        onOpenChange={setAddActivityOpen}
        leadId={id!}
        onSuccess={loadLead}
      />
    </div>
  );
};
