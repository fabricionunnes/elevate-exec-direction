import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, LogOut, Layers, Save } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface TaskToCreate {
  id: string;
  title: string;
  description: string;
  priority: string;
  default_days_offset: number;
  duration_days: number;
  responsible_role: string;
  recurrence: string;
  sort_order: number;
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
  { value: 'none', label: 'Sem recorrência' },
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'bimonthly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' }
];

export default function OnboardingBulkTemplatesPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [phaseName, setPhaseName] = useState('');
  const [phaseOrder, setPhaseOrder] = useState(1);
  const [tasks, setTasks] = useState<TaskToCreate[]>([]);

  useEffect(() => {
    checkAdmin();
    fetchServices();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/onboarding-tasks/login');
      return;
    }

    const { data: staff } = await supabase
      .from('onboarding_staff')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!staff || staff.role !== 'admin') {
      toast.error('Acesso restrito a administradores');
      navigate('/onboarding-tasks');
      return;
    }

    setIsAdmin(true);
    setLoading(false);
  };

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('onboarding_services')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast.error('Erro ao carregar serviços');
      return;
    }

    setServices(data || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/onboarding-tasks/login');
  };

  const toggleService = (slug: string) => {
    setSelectedServices(prev =>
      prev.includes(slug)
        ? prev.filter(s => s !== slug)
        : [...prev, slug]
    );
  };

  const selectAllServices = () => {
    if (selectedServices.length === services.length) {
      setSelectedServices([]);
    } else {
      setSelectedServices(services.map(s => s.slug));
    }
  };

  const addTask = () => {
    const newTask: TaskToCreate = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      priority: 'medium',
      default_days_offset: 0,
      duration_days: 1,
      responsible_role: 'consultant',
      recurrence: 'none',
      sort_order: tasks.length + 1
    };
    setTasks(prev => [...prev, newTask]);
  };

  const updateTask = (id: string, field: keyof TaskToCreate, value: any) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleSave = async () => {
    if (!phaseName.trim()) {
      toast.error('Digite o nome da fase');
      return;
    }

    if (selectedServices.length === 0) {
      toast.error('Selecione pelo menos um serviço');
      return;
    }

    if (tasks.length === 0) {
      toast.error('Adicione pelo menos uma tarefa');
      return;
    }

    const emptyTasks = tasks.filter(t => !t.title.trim());
    if (emptyTasks.length > 0) {
      toast.error('Preencha o título de todas as tarefas');
      return;
    }

    setSaving(true);

    try {
      // Create templates for each selected service
      const templatesToInsert = selectedServices.flatMap(serviceSlug =>
        tasks.map(task => ({
          product_id: serviceSlug,
          title: task.title,
          description: task.description || null,
          phase: phaseName,
          phase_order: phaseOrder,
          sort_order: task.sort_order,
          priority: task.priority,
          default_days_offset: task.default_days_offset,
          duration_days: task.duration_days,
          responsible_role: task.responsible_role,
          recurrence: task.recurrence === 'none' ? null : task.recurrence
        }))
      );

      const { error } = await supabase
        .from('onboarding_task_templates')
        .insert(templatesToInsert);

      if (error) throw error;

      toast.success(`${tasks.length} tarefa(s) adicionada(s) a ${selectedServices.length} serviço(s)`);
      
      // Reset form
      setPhaseName('');
      setPhaseOrder(1);
      setTasks([]);
      setSelectedServices([]);
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/onboarding-tasks/services')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Adicionar em Lote</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="space-y-6">
          {/* Services Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Selecione os Serviços</CardTitle>
              <CardDescription>
                Escolha em quais serviços as tarefas serão adicionadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedServices.length === services.length && services.length > 0}
                    onCheckedChange={selectAllServices}
                  />
                  <Label htmlFor="select-all" className="font-medium cursor-pointer">
                    Selecionar todos ({services.length})
                  </Label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {services.map(service => (
                    <div
                      key={service.id}
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedServices.includes(service.slug)
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card hover:bg-muted/50'
                      }`}
                      onClick={() => toggleService(service.slug)}
                    >
                      <Checkbox
                        checked={selectedServices.includes(service.slug)}
                        onCheckedChange={() => toggleService(service.slug)}
                      />
                      <span className="text-sm font-medium truncate">{service.name}</span>
                    </div>
                  ))}
                </div>
                {selectedServices.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {selectedServices.length} serviço(s) selecionado(s)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Phase Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Configure a Fase</CardTitle>
              <CardDescription>
                Defina o nome e a ordem da fase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phase-name">Nome da Fase *</Label>
                  <Input
                    id="phase-name"
                    value={phaseName}
                    onChange={e => setPhaseName(e.target.value)}
                    placeholder="Ex: Diagnóstico, Implementação..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phase-order">Ordem da Fase</Label>
                  <Input
                    id="phase-order"
                    type="number"
                    min={1}
                    value={phaseOrder}
                    onChange={e => setPhaseOrder(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Define a posição da fase na trilha (1 = primeira)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">3. Adicione as Tarefas</CardTitle>
                  <CardDescription>
                    Crie as tarefas que serão adicionadas a todos os serviços selecionados
                  </CardDescription>
                </div>
                <Button onClick={addTask} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Tarefa
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma tarefa adicionada</p>
                  <Button variant="outline" className="mt-4" onClick={addTask}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar primeira tarefa
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task, index) => (
                    <div key={task.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Tarefa {index + 1}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeTask(task.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Título *</Label>
                        <Input
                          value={task.title}
                          onChange={e => updateTask(task.id, 'title', e.target.value)}
                          placeholder="Nome da tarefa..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Textarea
                          value={task.description}
                          onChange={e => updateTask(task.id, 'description', e.target.value)}
                          placeholder="Descrição opcional..."
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Prioridade</Label>
                          <Select
                            value={task.priority}
                            onValueChange={v => updateTask(task.id, 'priority', v)}
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

                        <div className="space-y-2">
                          <Label>Responsável</Label>
                          <Select
                            value={task.responsible_role}
                            onValueChange={v => updateTask(task.id, 'responsible_role', v)}
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
                          <Label>Dias após início</Label>
                          <Input
                            type="number"
                            min={0}
                            value={task.default_days_offset}
                            onChange={e => updateTask(task.id, 'default_days_offset', parseInt(e.target.value) || 0)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Recorrência</Label>
                          <Select
                            value={task.recurrence}
                            onValueChange={v => updateTask(task.id, 'recurrence', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {RECURRENCE_OPTIONS.map(r => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate('/onboarding-tasks/services')}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !phaseName || selectedServices.length === 0 || tasks.length === 0}
            >
              {saving ? (
                'Salvando...'
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar em {selectedServices.length} serviço(s)
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
