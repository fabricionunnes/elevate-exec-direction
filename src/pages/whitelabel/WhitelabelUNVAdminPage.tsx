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
  AlertTriangle, Pause, BarChart3, Globe, Search, Power, PowerOff,
  KeyRound, Copy, SlidersHorizontal, Package, History, CreditCard,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TenantModulesManager } from "@/components/whitelabel/TenantModulesManager";
import { PlansManagement } from "@/components/whitelabel/PlansManagement";
import { ChangeTenantPlanDialog } from "@/components/whitelabel/ChangeTenantPlanDialog";
import { TenantPlanHistoryDialog } from "@/components/whitelabel/TenantPlanHistoryDialog";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  platform_name: string;
  status: string;
  max_active_projects: number;
  max_users: number | null;
  plan_slug: string | null;
  is_dark_mode: boolean;
  created_at: string;
  updated_at: string;
  enabled_modules: Record<string, boolean> | null;
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
  const [modulesTenant, setModulesTenant] = useState<TenantRow | null>(null);
  const [deleteTenant, setDeleteTenant] = useState<TenantRow | null>(null);
  const [planTenant, setPlanTenant] = useState<TenantRow | null>(null);
  const [historyTenant, setHistoryTenant] = useState<TenantRow | null>(null);
  const [activeTab, setActiveTab] = useState<"tenants" | "plans">("tenants");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{
    tenantName: string; email: string | null; password: string;
  } | null>(null);

  const handleResetPassword = async (t: TenantRow) => {
    setResettingId(t.id);
    try {
      const { data, error } = await supabase.functions.invoke(
        "whitelabel-reset-admin-password",
        { body: { tenant_id: t.id } },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResetResult({
        tenantName: t.name,
        email: data.admin.email,
        password: data.admin.new_password,
      });
      toast.success("Senha resetada com sucesso");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "falha ao resetar senha"));
    } finally {
      setResettingId(null);
    }
  };

  const handleToggleStatus = async (t: TenantRow) => {
    const newStatus = t.status === "inactive" || t.status === "suspended" ? "active" : "inactive";
    setTogglingId(t.id);
    try {
      const { error } = await supabase
        .from("whitelabel_tenants")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", t.id);
      if (error) throw error;
      toast.success(newStatus === "active" ? "Tenant reativado" : "Tenant inativado");
      queryClient.invalidateQueries({ queryKey: ["unv-whitelabel-tenants"] });
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "falha ao atualizar"));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTenant) return;
    setDeletingId(deleteTenant.id);
    try {
      const { data: deleted, error } = await supabase
        .from("whitelabel_tenants")
        .delete()
        .eq("id", deleteTenant.id)
        .select("id");
      if (error) throw error;
      if (!deleted || deleted.length === 0) {
        throw new Error("Você não tem permissão para excluir este tenant (apenas o CEO pode excluir).");
      }
      toast.success(`Tenant "${deleteTenant.name}" excluído`);
      setDeleteTenant(null);
      queryClient.invalidateQueries({ queryKey: ["unv-whitelabel-tenants"] });
    } catch (err: any) {
      toast.error("Erro ao excluir: " + (err.message || "verifique dependências"));
    } finally {
      setDeletingId(null);
    }
  };

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

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "tenants" | "plans")} className="space-y-4">
          <TabsList>
            <TabsTrigger value="tenants" className="gap-1.5">
              <Building2 className="h-4 w-4" />
              Tenants
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-1.5">
              <Package className="h-4 w-4" />
              Planos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tenants" className="space-y-4">
        <div className="relative">
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
                          onClick={() => setPlanTenant(tenant)}
                          title="Mudar plano"
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setHistoryTenant(tenant)}
                          title="Histórico de planos"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditTenant(tenant)}
                          title="Editar dados do tenant"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setModulesTenant(tenant)}
                          title="Permissões de módulos"
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={resettingId === tenant.id}
                          onClick={() => handleResetPassword(tenant)}
                          title="Resetar senha do admin"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={togglingId === tenant.id}
                          onClick={() => handleToggleStatus(tenant)}
                          title={tenant.status === "active" || tenant.status === "trial" ? "Inativar" : "Reativar"}
                        >
                          {tenant.status === "active" || tenant.status === "trial" ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTenant(tenant)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="plans">
            <PlansManagement />
          </TabsContent>
        </Tabs>

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

        {/* Modules / Permissions Dialog */}
        <Dialog open={!!modulesTenant} onOpenChange={open => !open && setModulesTenant(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-primary" />
                Permissões de Módulos: {modulesTenant?.name}
              </DialogTitle>
            </DialogHeader>
            {modulesTenant && (
              <TenantModulesManager
                tenantId={modulesTenant.id}
                tenantName={modulesTenant.name}
                initialModules={modulesTenant.enabled_modules}
                onSaved={() => {
                  setModulesTenant(null);
                  queryClient.invalidateQueries({ queryKey: ["unv-whitelabel-tenants"] });
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Reset Password Result */}
        <Dialog open={!!resetResult} onOpenChange={open => !open && setResetResult(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nova senha gerada</DialogTitle>
            </DialogHeader>
            {resetResult && (
              <div className="space-y-4">
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Tenant:</span>{" "}
                    <span className="font-medium text-foreground">{resetResult.tenantName}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Email:</span>{" "}
                    <code className="text-foreground">{resetResult.email || "—"}</code>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Nova senha:</span>
                    <code className="text-foreground bg-muted px-2 py-1 rounded font-mono text-sm flex-1">
                      {resetResult.password}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        navigator.clipboard.writeText(resetResult.password);
                        toast.success("Senha copiada");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Anote ou copie agora — esta senha não será exibida novamente.
                </p>
                <Button onClick={() => setResetResult(null)} className="w-full">Fechar</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTenant} onOpenChange={open => !open && setDeleteTenant(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir tenant "{deleteTenant?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é irreversível. O tenant e seus dados vinculados (assinatura, pipelines criados pelo provisionamento, etc.) serão removidos permanentemente. O usuário admin no Auth NÃO será excluído automaticamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deletingId === deleteTenant?.id}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingId === deleteTenant?.id ? "Excluindo..." : "Excluir definitivamente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ChangeTenantPlanDialog
          open={!!planTenant}
          onOpenChange={(o) => !o && setPlanTenant(null)}
          tenant={planTenant}
          onShowHistory={() => {
            const t = planTenant;
            setPlanTenant(null);
            setHistoryTenant(t);
          }}
        />

        <TenantPlanHistoryDialog
          open={!!historyTenant}
          onOpenChange={(o) => !o && setHistoryTenant(null)}
          tenantId={historyTenant?.id || null}
          tenantName={historyTenant?.name}
        />
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
  const [maxUsers, setMaxUsers] = useState<string>(
    tenant?.max_users != null ? String(tenant.max_users) : ""
  );
  const [status, setStatus] = useState(tenant?.status || "trial");
  const [logoUrl, setLogoUrl] = useState(tenant?.logo_url || "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 5MB)");
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const folder = tenant?.id || "_pending";
      const filePath = `whitelabel/${folder}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("whitelabel-assets")
        .upload(filePath, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage
        .from("whitelabel-assets")
        .getPublicUrl(filePath);
      setLogoUrl(data.publicUrl);
      toast.success("Logo carregada");
    } catch (err: any) {
      toast.error("Erro no upload: " + (err.message || "tente novamente"));
    } finally {
      setUploadingLogo(false);
    }
  };

  // Provisionamento (somente novo tenant)
  const [planSlug, setPlanSlug] = useState<"starter" | "pro" | "enterprise">(
    (tenant?.plan_slug as "starter" | "pro" | "enterprise") || "pro"
  );
  const [enableTrial, setEnableTrial] = useState(false);
  const [trialDays, setTrialDays] = useState(7);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [resultInfo, setResultInfo] = useState<{ url: string; email: string; password: string | null } | null>(null);

  // Plans are needed both for new tenants and edit mode
  const { data: plans } = useQuery({
    queryKey: ["whitelabel-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whitelabel_plans")
        .select("slug,name,price_monthly,max_projects,max_users")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const selectedPlan = plans?.find((x: any) => x.slug === planSlug);
  const planUserLimit = selectedPlan?.max_users ?? null;
  const planProjectLimit = selectedPlan?.max_projects ?? null;

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
      if (isEdit) {
        const parsedMaxUsers = maxUsers.trim() === "" ? null : Number(maxUsers);
        if (parsedMaxUsers !== null && (!Number.isFinite(parsedMaxUsers) || parsedMaxUsers < 1)) {
          toast.error("Máx. usuários deve ser um número maior que 0 ou vazio");
          setSaving(false);
          return;
        }
        const { error } = await supabase
          .from("whitelabel_tenants")
          .update({
            name: name.trim(),
            slug: slug.trim(),
            platform_name: platformName.trim() || name.trim(),
            custom_domain: customDomain.trim() || null,
            max_active_projects: maxProjects,
            max_users: parsedMaxUsers,
            plan_slug: planSlug,
            status,
            logo_url: logoUrl.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tenant!.id);
        if (error) throw error;
        toast.success("Tenant atualizado!");
        onSuccess();
        return;
      }

      // Novo tenant via Edge Function (cria admin + plano + estrutura padrão)
      if (!adminEmail.trim() || !adminName.trim()) {
        toast.error("Email e nome do administrador são obrigatórios");
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("whitelabel-provision", {
        body: {
          name: name.trim(),
          slug: slug.trim(),
          platform_name: platformName.trim() || name.trim(),
          custom_domain: customDomain.trim() || null,
          logo_url: logoUrl.trim() || null,
          plan_slug: planSlug,
          enable_trial: enableTrial,
          trial_days: trialDays,
          admin_email: adminEmail.trim(),
          admin_name: adminName.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Tenant provisionado com sucesso!");
      setResultInfo({
        url: data.access_url,
        email: data.admin.email,
        password: data.admin.temp_password,
      });
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "falha ao provisionar"));
    } finally {
      setSaving(false);
    }
  };

  if (resultInfo) {
    return (
      <div className="space-y-4 py-2">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
          <p className="font-medium text-foreground flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            Tenant criado com sucesso
          </p>
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">URL de acesso:</span> <code className="text-foreground">{resultInfo.url}</code></p>
            <p><span className="text-muted-foreground">Email admin:</span> <code className="text-foreground">{resultInfo.email}</code></p>
            {resultInfo.password ? (
              <p>
                <span className="text-muted-foreground">Senha temporária:</span>{" "}
                <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{resultInfo.password}</code>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Usuário já existia — senha mantida.
              </p>
            )}
          </div>
        </div>
        <Button onClick={onSuccess} className="w-full">Concluir</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
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
          <Label>Logomarca</Label>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="h-12 w-12 rounded-lg object-contain bg-muted p-1 border border-border"
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-muted/40 border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground">
                Sem logo
              </div>
            )}
            <div className="flex-1 space-y-1">
              <Input
                type="file"
                accept="image/*"
                disabled={uploadingLogo}
                onChange={handleLogoFile}
                className="text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {uploadingLogo ? "Enviando..." : "PNG, JPG ou SVG. Fundo transparente recomendado."}
              </p>
            </div>
          </div>
          {logoUrl && (
            <Input
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              placeholder="Ou cole uma URL"
              className="text-xs"
            />
          )}
        </div>
      </div>

      {!isEdit && (
        <>
          <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
            <p className="text-sm font-medium text-foreground">Plano e Trial</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={planSlug} onValueChange={(v) => setPlanSlug(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {plans?.map((p: any) => (
                      <SelectItem key={p.slug} value={p.slug}>
                        {p.name} — R$ {Number(p.price_monthly).toFixed(0)}/mês
                      </SelectItem>
                    )) || (
                      <>
                        <SelectItem value="starter">Starter — R$ 297/mês</SelectItem>
                        <SelectItem value="pro">Pro — R$ 597/mês</SelectItem>
                        <SelectItem value="enterprise">Enterprise — R$ 1.497/mês</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  Trial gratuito
                  <Switch checked={enableTrial} onCheckedChange={setEnableTrial} />
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  disabled={!enableTrial}
                  value={trialDays}
                  onChange={e => setTrialDays(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Dias de teste antes de cobrar</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Administrador do tenant
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Nome do admin" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="admin@empresa.com.br"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Geramos uma senha temporária automaticamente. Ela aparece após a criação.
            </p>
          </div>
        </>
      )}

      {isEdit && (
        <div className="space-y-4">
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
              <Label>Máx. Usuários</Label>
              <Input
                type="number"
                min={1}
                value={maxUsers}
                onChange={e => setMaxUsers(e.target.value)}
                placeholder={
                  planUserLimit != null
                    ? `Plano: ${planUserLimit}`
                    : "Ilimitado (plano)"
                }
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para usar o limite do plano
                {tenant?.plan_slug ? ` (${tenant.plan_slug})` : ""}.
              </p>
            </div>
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
      )}

      <Button onClick={handleSubmit} disabled={saving} className="w-full">
        {saving ? "Provisionando..." : isEdit ? "Salvar Alterações" : "Criar Tenant"}
      </Button>
    </div>
  );
}
