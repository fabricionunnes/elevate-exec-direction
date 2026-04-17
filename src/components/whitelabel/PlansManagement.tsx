import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Crown, Package, Users, FolderKanban, DollarSign, Star } from "lucide-react";

interface PlanRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  enabled_modules: Record<string, boolean>;
  max_users: number | null;
  max_companies: number | null;
  max_projects: number | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  tenant_id: string | null;
  tenant_name?: string | null;
}

const MODULE_LABELS: Record<string, string> = {
  crm: "CRM Comercial",
  financial: "Financeiro",
  tasks: "Tarefas",
  kpis: "KPIs",
  onboarding: "Onboarding",
  hr: "RH/Recrutamento",
  social: "UNV Social",
  whatsapp: "WhatsApp",
  meetings: "Reuniões",
  academy: "Academy",
  b2b: "B2B Prospecção",
};

export function PlansManagement() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<PlanRow | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["whitelabel-plans-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whitelabel_plans")
        .select("*, tenant:whitelabel_tenants(name)")
        .order("tenant_id", { nullsFirst: true })
        .order("sort_order");
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        tenant_name: p.tenant?.name ?? null,
      })) as PlanRow[];
    },
  });

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("whitelabel_plans").delete().eq("id", deleting.id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }
    toast.success("Plano excluído");
    setDeleting(null);
    queryClient.invalidateQueries({ queryKey: ["whitelabel-plans-admin"] });
    queryClient.invalidateQueries({ queryKey: ["whitelabel-plans"] });
  };

  const standardPlans = plans?.filter(p => !p.tenant_id) || [];
  const customPlans = plans?.filter(p => p.tenant_id) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Planos Padrão
            </CardTitle>
            <CardDescription>
              Disponíveis para todos os tenants. Defina preços, limites e módulos inclusos.
            </CardDescription>
          </div>
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo Plano
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Plano</DialogTitle>
              </DialogHeader>
              <PlanForm
                onSuccess={() => {
                  setCreating(false);
                  queryClient.invalidateQueries({ queryKey: ["whitelabel-plans-admin"] });
                  queryClient.invalidateQueries({ queryKey: ["whitelabel-plans"] });
                }}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-6">Carregando...</p>
          ) : standardPlans.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhum plano padrão cadastrado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {standardPlans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onEdit={() => setEditing(plan)}
                  onDelete={() => setDeleting(plan)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {customPlans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Planos Personalizados
            </CardTitle>
            <CardDescription>
              Planos dedicados a tenants específicos com condições negociadas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {customPlans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onEdit={() => setEditing(plan)}
                  onDelete={() => setDeleting(plan)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Plano: {editing?.name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <PlanForm
              plan={editing}
              onSuccess={() => {
                setEditing(null);
                queryClient.invalidateQueries({ queryKey: ["whitelabel-plans-admin"] });
                queryClient.invalidateQueries({ queryKey: ["whitelabel-plans"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tenants atualmente neste plano não serão alterados, mas o plano deixará de aparecer nas opções.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PlanCard({ plan, onEdit, onDelete }: { plan: PlanRow; onEdit: () => void; onDelete: () => void }) {
  const enabledCount = Object.values(plan.enabled_modules || {}).filter(Boolean).length;
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground truncate">{plan.name}</p>
            {plan.is_featured && (
              <Badge variant="secondary" className="text-[10px]">
                <Star className="h-2.5 w-2.5 mr-1" />
                Destaque
              </Badge>
            )}
            {!plan.is_active && (
              <Badge variant="outline" className="text-[10px]">Inativo</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono">{plan.slug}</p>
          {plan.tenant_name && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Exclusivo: {plan.tenant_name}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="text-2xl font-bold text-foreground">
        R$ {Number(plan.price_monthly).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        <span className="text-xs text-muted-foreground font-normal">/mês</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <FolderKanban className="h-3 w-3" />
          {plan.max_projects ?? "∞"}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-3 w-3" />
          {plan.max_users ?? "∞"}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Package className="h-3 w-3" />
          {enabledCount} mód.
        </div>
      </div>
    </div>
  );
}

function PlanForm({ plan, onSuccess }: { plan?: PlanRow; onSuccess: () => void }) {
  const isEdit = !!plan;
  const [name, setName] = useState(plan?.name || "");
  const [slug, setSlug] = useState(plan?.slug || "");
  const [description, setDescription] = useState(plan?.description || "");
  const [priceMonthly, setPriceMonthly] = useState<string>(String(plan?.price_monthly ?? 0));
  const [maxProjects, setMaxProjects] = useState<string>(plan?.max_projects?.toString() || "");
  const [maxUsers, setMaxUsers] = useState<string>(plan?.max_users?.toString() || "");
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);
  const [isFeatured, setIsFeatured] = useState(plan?.is_featured ?? false);
  const [tenantId, setTenantId] = useState<string | null>(plan?.tenant_id || null);
  const [modules, setModules] = useState<Record<string, boolean>>(
    plan?.enabled_modules || Object.keys(MODULE_LABELS).reduce((acc, k) => ({ ...acc, [k]: false }), {})
  );
  const [saving, setSaving] = useState(false);

  const { data: tenants } = useQuery({
    queryKey: ["tenants-for-plan-form"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whitelabel_tenants")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }
    const price = Number(priceMonthly.replace(",", "."));
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Preço inválido");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        price_monthly: price,
        max_projects: maxProjects.trim() === "" ? null : Number(maxProjects),
        max_users: maxUsers.trim() === "" ? null : Number(maxUsers),
        is_active: isActive,
        is_featured: isFeatured,
        tenant_id: tenantId,
        enabled_modules: modules,
      };
      if (isEdit) {
        const { error } = await supabase.from("whitelabel_plans").update(payload).eq("id", plan!.id);
        if (error) throw error;
        toast.success("Plano atualizado");
      } else {
        const { error } = await supabase.from("whitelabel_plans").insert(payload);
        if (error) throw error;
        toast.success("Plano criado");
      }
      onSuccess();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "falha ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pro Plus" />
        </div>
        <div className="space-y-2">
          <Label>Slug (identificador)</Label>
          <Input
            value={slug}
            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            placeholder="pro-plus"
            disabled={isEdit && ["starter", "pro", "enterprise"].includes(plan?.slug || "")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="O que está incluso neste plano..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" /> Preço Mensal
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={priceMonthly}
            onChange={e => setPriceMonthly(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <FolderKanban className="h-3.5 w-3.5" /> Máx. Projetos
          </Label>
          <Input
            type="number"
            min="1"
            value={maxProjects}
            onChange={e => setMaxProjects(e.target.value)}
            placeholder="Ilimitado"
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> Máx. Usuários
          </Label>
          <Input
            type="number"
            min="1"
            value={maxUsers}
            onChange={e => setMaxUsers(e.target.value)}
            placeholder="Ilimitado"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tenant Exclusivo (opcional)</Label>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={tenantId || ""}
          onChange={e => setTenantId(e.target.value || null)}
        >
          <option value="">— Plano padrão (visível a todos) —</option>
          {tenants?.map((t: any) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Selecione um tenant para criar um plano personalizado exclusivo.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Módulos Inclusos</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 rounded-lg border border-border p-3">
          {Object.entries(MODULE_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!modules[key]}
                onChange={e => setModules({ ...modules, [key]: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-foreground">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 pt-2">
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label className="cursor-pointer">Ativo</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
          <Label className="cursor-pointer">Destacar</Label>
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={saving} className="w-full">
        {saving ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Plano"}
      </Button>
    </div>
  );
}
