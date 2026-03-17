import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Building2, Plus, Edit, Trash2, Users, Eye, CheckCircle,
  AlertTriangle, Pause, BarChart3, Globe, Search
} from "lucide-react";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  platform_name: string;
  status: string;
  max_active_projects: number;
  is_dark_mode: boolean;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  active: { label: "Ativo", variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
  trial: { label: "Trial", variant: "secondary", icon: <BarChart3 className="h-3 w-3" /> },
  suspended: { label: "Suspenso", variant: "destructive", icon: <Pause className="h-3 w-3" /> },
  inactive: { label: "Inativo", variant: "outline", icon: <AlertTriangle className="h-3 w-3" /> },
};

export default function WhitelabelUNVAdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantRow | null>(null);

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["unv-whitelabel-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whitelabel_tenants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TenantRow[];
    },
  });

  const filtered = tenants?.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    (t.custom_domain || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Gestão White-Label
            </h1>
            <p className="text-muted-foreground mt-1">
              Cadastre e gerencie todos os tenants white-label
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Tenant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Novo Tenant</DialogTitle>
              </DialogHeader>
              <TenantForm
                onSuccess={() => {
                  setCreateOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["unv-whitelabel-tenants"] });
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, slug ou domínio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {["active", "trial", "suspended", "inactive"].map(status => {
            const count = tenants?.filter(t => t.status === status).length || 0;
            const cfg = statusConfig[status];
            return (
              <Card key={status}>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{cfg.label}</p>
                      <p className="text-2xl font-bold text-foreground">{count}</p>
                    </div>
                    <div className="text-muted-foreground/40">{cfg.icon}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tenants List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenants ({filtered?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : !filtered?.length ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum tenant encontrado. Clique em "Novo Tenant" para começar.
              </p>
            ) : (
              <div className="space-y-3">
                {filtered.map(tenant => {
                  const cfg = statusConfig[tenant.status] || statusConfig.inactive;
                  return (
                    <div
                      key={tenant.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {tenant.logo_url ? (
                          <img src={tenant.logo_url} alt="" className="h-10 w-10 rounded-lg object-contain bg-muted p-1" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {tenant.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{tenant.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <code className="text-xs text-muted-foreground">{tenant.slug}</code>
                            {tenant.custom_domain && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {tenant.custom_domain}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={cfg.variant} className="gap-1 text-xs">
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {tenant.max_active_projects} proj
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditTenant(tenant)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editTenant} onOpenChange={open => !open && setEditTenant(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Tenant: {editTenant?.name}</DialogTitle>
            </DialogHeader>
            {editTenant && (
              <TenantForm
                tenant={editTenant}
                onSuccess={() => {
                  setEditTenant(null);
                  queryClient.invalidateQueries({ queryKey: ["unv-whitelabel-tenants"] });
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function TenantForm({
  tenant,
  onSuccess,
}: {
  tenant?: TenantRow;
  onSuccess: () => void;
}) {
  const isEdit = !!tenant;
  const [name, setName] = useState(tenant?.name || "");
  const [slug, setSlug] = useState(tenant?.slug || "");
  const [platformName, setPlatformName] = useState(tenant?.platform_name || "");
  const [customDomain, setCustomDomain] = useState(tenant?.custom_domain || "");
  const [maxProjects, setMaxProjects] = useState(tenant?.max_active_projects || 5);
  const [status, setStatus] = useState(tenant?.status || "trial");
  const [logoUrl, setLogoUrl] = useState(tenant?.logo_url || "");
  const [saving, setSaving] = useState(false);

  const handleSlugify = (val: string) => {
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        platform_name: platformName.trim() || name.trim(),
        custom_domain: customDomain.trim() || null,
        max_active_projects: maxProjects,
        status,
        logo_url: logoUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (isEdit) {
        const { error } = await supabase
          .from("whitelabel_tenants")
          .update(payload)
          .eq("id", tenant.id);
        if (error) throw error;
        toast.success("Tenant atualizado!");
      } else {
        const { error } = await supabase
          .from("whitelabel_tenants")
          .insert(payload);
        if (error) throw error;
        toast.success("Tenant criado com sucesso!");
      }
      onSuccess();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome da Empresa</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Empresa XYZ" />
        </div>
        <div className="space-y-2">
          <Label>Slug (subdomínio)</Label>
          <Input
            value={slug}
            onChange={e => handleSlugify(e.target.value)}
            placeholder="empresa-xyz"
          />
          <p className="text-xs text-muted-foreground">{slug || "slug"}.nexus.com.br</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Nome da Plataforma</Label>
        <Input
          value={platformName}
          onChange={e => setPlatformName(e.target.value)}
          placeholder="Nome que aparece no sistema (ex: Gestão XYZ)"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Domínio Customizado</Label>
          <Input
            value={customDomain}
            onChange={e => setCustomDomain(e.target.value)}
            placeholder="app.empresa.com.br"
          />
        </div>
        <div className="space-y-2">
          <Label>URL do Logo</Label>
          <Input
            value={logoUrl}
            onChange={e => setLogoUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Máx. Projetos Ativos</Label>
          <Input
            type="number"
            min={1}
            value={maxProjects}
            onChange={e => setMaxProjects(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="suspended">Suspenso</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={saving} className="w-full">
        {saving ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Tenant"}
      </Button>
    </div>
  );
}
