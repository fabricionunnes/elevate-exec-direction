import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, LogOut, ListTodo, GripVertical, Copy, EyeOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface TaskTemplate {
  id: string;
  product_id: string;
  title: string;
  description: string | null;
  phase: string | null;
  phase_order: number | null;
  sort_order: number;
  priority: string | null;
  default_days_offset: number | null;
  duration_days: number | null;
  responsible_role: string | null;
  recurrence: string | null;
  checklist: any;
  created_at: string;
  is_internal: boolean;
}

interface Service {
  id: string;
  name: string;
  slug: string;
}

const PRIORITIES = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' }
];

const ROLES = [
  { value: 'cs', label: 'CS' },
  { value: 'consultant', label: 'Consultor' },
  { value: 'admin', label: 'Administrador' },
  { value: 'client', label: 'Cliente' }
];

const RECURRENCE_OPTIONS = [
  { value: null, label: 'Única' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' }
];

export default function OnboardingServiceTemplatesPage() {
  const navigate = useNavigate();
  const { serviceSlug } = useParams<{ serviceSlug: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    phase: '',
    phase_order: 1,
    sort_order: 1,
    priority: 'medium',
    default_days_offset: 0,
    duration_days: 1,
    responsible_role: 'consultant',
    recurrence: '',
    is_internal: false
  });

  useEffect(() => {
    checkAuth();
  }, [serviceSlug]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/onboarding-tasks/login');
      return;
    }

    // Check if admin in onboarding_staff
    const { data: staffData } = await supabase
      .from('onboarding_staff')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!staffData || staffData.role !== 'admin') {
      toast.error('Acesso negado. Apenas administradores.');
      navigate('/onboarding-tasks');
      return;
    }

    fetchService();
  };

  const fetchService = async () => {
    try {
      const { data: serviceData, error: serviceError } = await supabase
        .from('onboarding_services')
        .select('*')
        .eq('slug', serviceSlug)
        .single();

      if (serviceError) throw serviceError;
      setService(serviceData);

      fetchTemplates(serviceData.id, serviceData.slug);
    } catch (error) {
      console.error('Error fetching service:', error);
      toast.error('Serviço não encontrado');
      navigate('/onboarding-tasks/services');
    }
  };

  const fetchTemplates = async (serviceId: string, serviceSlug: string) => {
    setLoading(true);
    try {
      // Fetch templates by both ID and slug (legacy data uses slug)
      const { data, error } = await supabase
        .from('onboarding_task_templates')
        .select('*')
        .or(`product_id.eq.${serviceId},product_id.eq.${serviceSlug}`)
        .order('phase_order', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Erro ao carregar tarefas');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/onboarding-tasks/login');
  };

  const openCreateDialog = (phase?: string) => {
    const maxSortOrder = templates
      .filter(t => t.phase === phase)
      .reduce((max, t) => Math.max(max, t.sort_order), 0);
    
    const existingPhaseOrder = templates.find(t => t.phase === phase)?.phase_order || 1;

    setEditingTemplate(null);
    setFormData({
      title: '',
      description: '',
      phase: phase || '',
      phase_order: existingPhaseOrder,
      sort_order: maxSortOrder + 1,
      priority: 'medium',
      default_days_offset: 0,
      duration_days: 1,
      responsible_role: 'consultant',
      recurrence: '',
      is_internal: false
    });
    setDialogOpen(true);
  };

  const openEditDialog = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setFormData({
      title: template.title,
      description: template.description || '',
      phase: template.phase || '',
      phase_order: template.phase_order || 1,
      sort_order: template.sort_order,
      priority: template.priority || 'medium',
      default_days_offset: template.default_days_offset || 0,
      duration_days: template.duration_days || 1,
      responsible_role: template.responsible_role || 'consultant',
      recurrence: template.recurrence || '',
      is_internal: template.is_internal || false
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      toast.error('Título é obrigatório');
      return;
    }

    try {
      // Get phase order from existing templates or use formData value
      const existingPhaseOrder = templates.find(t => t.phase === formData.phase)?.phase_order || formData.phase_order;
      
      const templateData = {
        product_id: service!.id,
        title: formData.title,
        description: formData.description || null,
        phase: formData.phase || null,
        phase_order: existingPhaseOrder,
        sort_order: formData.sort_order,
        priority: formData.priority,
        default_days_offset: formData.default_days_offset,
        duration_days: formData.duration_days,
        responsible_role: formData.responsible_role,
        recurrence: formData.recurrence || null,
        is_internal: formData.is_internal
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('onboarding_task_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('Tarefa atualizada');
      } else {
        const { error } = await supabase
          .from('onboarding_task_templates')
          .insert(templateData);

        if (error) throw error;
        toast.success('Tarefa criada');
      }

      setDialogOpen(false);
      fetchTemplates(service!.id, service!.slug);
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Erro ao salvar tarefa');
    }
  };

  const handleDuplicate = async (template: TaskTemplate) => {
    try {
      const { error } = await supabase
        .from('onboarding_task_templates')
        .insert({
          product_id: template.product_id,
          title: `${template.title} (cópia)`,
          description: template.description,
          phase: template.phase,
          phase_order: template.phase_order,
          sort_order: template.sort_order + 1,
          priority: template.priority,
          default_days_offset: template.default_days_offset,
          duration_days: template.duration_days,
          responsible_role: template.responsible_role,
          recurrence: template.recurrence,
          checklist: template.checklist,
          is_internal: template.is_internal
        });

      if (error) throw error;
      toast.success('Tarefa duplicada');
      fetchTemplates(service!.id, service!.slug);
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast.error('Erro ao duplicar tarefa');
    }
  };

  const handleDelete = async (template: TaskTemplate) => {
    if (!confirm(`Tem certeza que deseja excluir a tarefa "${template.title}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('onboarding_task_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;
      toast.success('Tarefa excluída');
      fetchTemplates(service!.id, service!.slug);
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Erro ao excluir tarefa');
    }
  };

  // Extract unique phases from templates, ordered by phase_order
  const uniquePhases = [...new Set(templates.map(t => t.phase).filter(Boolean))]
    .sort((a, b) => {
      const orderA = templates.find(t => t.phase === a)?.phase_order || 999;
      const orderB = templates.find(t => t.phase === b)?.phase_order || 999;
      return orderA - orderB;
    }) as string[];

  const groupedTemplates = uniquePhases.reduce((acc, phase) => {
    acc[phase] = templates.filter(t => t.phase === phase).sort((a, b) => a.sort_order - b.sort_order);
    return acc;
  }, {} as Record<string, TaskTemplate[]>);

  // Templates without phase
  const unassignedTemplates = templates.filter(t => !t.phase);

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">Alta</Badge>;
      case 'medium':
        return <Badge variant="secondary">Média</Badge>;
      case 'low':
        return <Badge variant="outline">Baixa</Badge>;
      default:
        return null;
    }
  };

  const getRoleBadge = (role: string | null) => {
    const roleObj = ROLES.find(r => r.value === role);
    return roleObj ? <Badge variant="outline">{roleObj.label}</Badge> : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/onboarding-tasks/services')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{service?.name}</h1>
              <p className="text-sm text-muted-foreground">Gerenciar Templates de Tarefas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => openCreateDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-muted-foreground">
            {templates.length} tarefa(s) cadastrada(s)
          </p>
        </div>

        <Accordion type="multiple" defaultValue={uniquePhases} className="space-y-4">
          {uniquePhases.map(phase => (
            <AccordionItem key={phase} value={phase} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{phase}</span>
                  <Badge variant="secondary">{groupedTemplates[phase]?.length || 0}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-4">
                  {groupedTemplates[phase]?.map(template => (
                    <div
                      key={template.id}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{template.title}</span>
                          {template.is_internal && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <EyeOff className="h-3 w-3" />
                              Interna
                            </Badge>
                          )}
                          {getPriorityBadge(template.priority)}
                          {getRoleBadge(template.responsible_role)}
                          {template.recurrence && (
                            <Badge variant="outline" className="text-xs">
                              {RECURRENCE_OPTIONS.find(r => r.value === template.recurrence)?.label}
                            </Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {template.description}
                          </p>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          Dia {template.default_days_offset || 0} • Duração: {template.duration_days || 1} dia(s)
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(template)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(template)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {(!groupedTemplates[phase] || groupedTemplates[phase].length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma tarefa nesta fase
                    </p>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => openCreateDialog(phase)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar tarefa em {phase}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}

          {unassignedTemplates.length > 0 && (
            <AccordionItem value="unassigned" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-muted-foreground">Sem Fase</span>
                  <Badge variant="secondary">{unassignedTemplates.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-4">
                  {unassignedTemplates.map(template => (
                    <div
                      key={template.id}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{template.title}</span>
                          {template.is_internal && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <EyeOff className="h-3 w-3" />
                              Interna
                            </Badge>
                          )}
                          {getPriorityBadge(template.priority)}
                          {getRoleBadge(template.responsible_role)}
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {template.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(template)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {templates.length === 0 && (
          <div className="text-center py-12">
            <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma tarefa cadastrada</h3>
            <p className="text-muted-foreground mb-4">
              Crie as tarefas template para este serviço
            </p>
            <Button onClick={() => openCreateDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Tarefa' : 'Nova Tarefa'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Atualize as informações da tarefa template'
                : 'Crie uma nova tarefa template para este serviço'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Reunião de Kickoff"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva o que deve ser feito nesta tarefa..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fase</Label>
                {uniquePhases.length > 0 ? (
                  <>
                    <Select
                      value={formData.phase && uniquePhases.includes(formData.phase) ? formData.phase : '__new__'}
                      onValueChange={value => {
                        if (value === '__new__') {
                          setFormData(prev => ({ ...prev, phase: '' }));
                        } else {
                          setFormData(prev => ({ ...prev, phase: value }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma fase..." />
                      </SelectTrigger>
                      <SelectContent>
                        {uniquePhases.map(phase => (
                          <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                        ))}
                        <SelectItem value="__new__" className="text-primary font-medium">
                          + Criar nova fase
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {(formData.phase === '' || (formData.phase && !uniquePhases.includes(formData.phase))) && (
                      <Input
                        placeholder="Nome da nova fase..."
                        value={formData.phase}
                        onChange={e => setFormData(prev => ({ ...prev, phase: e.target.value }))}
                        className="mt-2"
                        autoFocus
                      />
                    )}
                  </>
                ) : (
                  <>
                    <Input
                      placeholder="Digite o nome da fase..."
                      value={formData.phase}
                      onChange={e => setFormData(prev => ({ ...prev, phase: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nenhuma fase existente. Digite o nome da primeira fase.
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={formData.priority}
                  onValueChange={value => setFormData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select
                  value={formData.responsible_role}
                  onValueChange={value => setFormData(prev => ({ ...prev, responsible_role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select
                  value={formData.recurrence || 'none'}
                  onValueChange={value => setFormData(prev => ({ 
                    ...prev, 
                    recurrence: value === 'none' ? '' : value 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Única</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quinzenal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="days_offset">Dia de Início</Label>
                <Input
                  id="days_offset"
                  type="number"
                  min="0"
                  value={formData.default_days_offset}
                  onChange={e => setFormData(prev => ({ 
                    ...prev, 
                    default_days_offset: parseInt(e.target.value) || 0 
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  Dias úteis após início do projeto
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duração (dias)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={formData.duration_days}
                  onChange={e => setFormData(prev => ({ 
                    ...prev, 
                    duration_days: parseInt(e.target.value) || 1 
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort_order">Ordem</Label>
                <Input
                  id="sort_order"
                  type="number"
                  min="1"
                  value={formData.sort_order}
                  onChange={e => setFormData(prev => ({ 
                    ...prev, 
                    sort_order: parseInt(e.target.value) || 1 
                  }))}
                />
              </div>
            </div>

            {/* Tarefa Interna */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="font-medium flex items-center gap-2">
                  <EyeOff className="h-4 w-4" />
                  Tarefa Interna
                </Label>
                <p className="text-sm text-muted-foreground">
                  Visível apenas para CS, Consultores e Administradores. Clientes não verão esta tarefa.
                </p>
              </div>
              <Switch
                checked={formData.is_internal}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_internal: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingTemplate ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
