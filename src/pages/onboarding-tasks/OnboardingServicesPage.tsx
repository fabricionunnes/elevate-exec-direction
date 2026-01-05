import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, ListTodo, LogOut, Package, Layers } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface TaskTemplateCount {
  product_id: string;
  count: number;
}

export default function OnboardingServicesPage() {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [templateCounts, setTemplateCounts] = useState<TaskTemplateCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    checkAuth();
  }, []);

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
      toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
      navigate('/onboarding-tasks');
      return;
    }

    setIsAdmin(true);
    fetchServices();
  };

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data: servicesData, error: servicesError } = await supabase
        .from('onboarding_services')
        .select('*')
        .order('name');

      if (servicesError) throw servicesError;
      setServices(servicesData || []);

      // Get template counts per service
      const { data: templates, error: templatesError } = await supabase
        .from('onboarding_task_templates')
        .select('product_id');

      if (templatesError) throw templatesError;

      const counts: { [key: string]: number } = {};
      templates?.forEach(t => {
        counts[t.product_id] = (counts[t.product_id] || 0) + 1;
      });

      setTemplateCounts(
        Object.entries(counts).map(([product_id, count]) => ({ product_id, count }))
      );
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Erro ao carregar serviços');
    } finally {
      setLoading(false);
    }
  };

  const getTemplateCount = (serviceId: string, serviceSlug: string) => {
    const byId = templateCounts.find(tc => tc.product_id === serviceId)?.count || 0;
    const bySlug = templateCounts.find(tc => tc.product_id === serviceSlug)?.count || 0;
    return byId + bySlug;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/onboarding-tasks/login');
  };

  const openCreateDialog = () => {
    setEditingService(null);
    setFormData({ name: '', slug: '', description: '', is_active: true });
    setDialogOpen(true);
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      slug: service.slug,
      description: service.description || '',
      is_active: service.is_active
    });
    setDialogOpen(true);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/unv\s*/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: editingService ? prev.slug : generateSlug(name)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.slug) {
      toast.error('Nome e slug são obrigatórios');
      return;
    }

    try {
      if (editingService) {
        const { error } = await supabase
          .from('onboarding_services')
          .update({
            name: formData.name,
            slug: formData.slug,
            description: formData.description || null,
            is_active: formData.is_active
          })
          .eq('id', editingService.id);

        if (error) throw error;
        toast.success('Serviço atualizado com sucesso');
      } else {
        const { error } = await supabase
          .from('onboarding_services')
          .insert({
            name: formData.name,
            slug: formData.slug,
            description: formData.description || null,
            is_active: formData.is_active
          });

        if (error) throw error;
        toast.success('Serviço criado com sucesso');
      }

      setDialogOpen(false);
      fetchServices();
    } catch (error: any) {
      console.error('Error saving service:', error);
      if (error.code === '23505') {
        toast.error('Já existe um serviço com este slug');
      } else {
        toast.error('Erro ao salvar serviço');
      }
    }
  };

  const handleDelete = async (service: Service) => {
    const count = getTemplateCount(service.id, service.slug);
    if (count > 0) {
      toast.error(`Não é possível excluir. Este serviço possui ${count} tarefas cadastradas.`);
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o serviço "${service.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('onboarding_services')
        .delete()
        .eq('id', service.id);

      if (error) throw error;
      toast.success('Serviço excluído com sucesso');
      fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Erro ao excluir serviço');
    }
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
            <Button variant="ghost" size="icon" onClick={() => navigate('/onboarding-tasks')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Gerenciar Serviços</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/onboarding-tasks/services/bulk')}>
              <Layers className="h-4 w-4 mr-2" />
              Adicionar em Lote
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Serviço
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(service => (
            <Card key={service.id} className={!service.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <CardDescription className="text-xs font-mono">{service.slug}</CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {!service.is_active && (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                    <Badge variant="outline">
                      {getTemplateCount(service.id, service.slug)} tarefas
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {service.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {service.description}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/onboarding-tasks/services/${service.slug}/templates`)}
                  >
                    <ListTodo className="h-4 w-4 mr-2" />
                    Tarefas
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(service)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(service)}
                    disabled={getTemplateCount(service.id, service.slug) > 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {services.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum serviço cadastrado</h3>
            <p className="text-muted-foreground mb-4">Crie seu primeiro serviço para começar</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Serviço
            </Button>
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Editar Serviço' : 'Novo Serviço'}
            </DialogTitle>
            <DialogDescription>
              {editingService 
                ? 'Atualize as informações do serviço'
                : 'Preencha os dados para criar um novo serviço'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="Ex: UNV Core"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="Ex: core"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Identificador único usado internamente (sem espaços ou caracteres especiais)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Breve descrição do serviço..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Serviço Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Serviços inativos não aparecem na criação de projetos
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={checked => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingService ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
