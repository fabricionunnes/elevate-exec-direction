import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Save, Users, BarChart3, ListTodo, MessageSquare, Calendar,
  Briefcase, Search, GraduationCap, Share2, DollarSign, Building2,
} from "lucide-react";

/**
 * Catálogo de módulos disponíveis na plataforma.
 * As chaves devem corresponder ao JSONB `enabled_modules` em whitelabel_tenants.
 */
const MODULE_CATALOG: Array<{
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  { key: "onboarding", label: "Onboarding", description: "Empresas, projetos e jornada do cliente", icon: Building2 },
  { key: "crm", label: "CRM Comercial", description: "Funil, leads, atividades e fechamentos", icon: BarChart3 },
  { key: "tasks", label: "Tarefas", description: "Gestão de tarefas internas e da equipe", icon: ListTodo },
  { key: "meetings", label: "Reuniões", description: "Agenda integrada e atas", icon: Calendar },
  { key: "financial", label: "Financeiro", description: "Contas a pagar, receber e cobranças", icon: DollarSign },
  { key: "kpis", label: "KPIs / Resultados", description: "Painéis de performance e metas", icon: BarChart3 },
  { key: "whatsapp", label: "WhatsApp Hub", description: "Atendimento centralizado e instâncias", icon: MessageSquare },
  { key: "social", label: "Social / Posts", description: "Publicação de conteúdo nas redes", icon: Share2 },
  { key: "academy", label: "Academy", description: "Trilhas de aprendizagem e quizzes", icon: GraduationCap },
  { key: "hr", label: "Recursos Humanos", description: "Vagas, candidatos e contratos", icon: Users },
  { key: "b2b", label: "Prospecção B2B", description: "Captura de leads via Google Places", icon: Search },
];

interface Props {
  tenantId: string;
  tenantName: string;
  initialModules: Record<string, boolean> | null;
  onSaved?: () => void;
}

export function TenantModulesManager({ tenantId, tenantName, initialModules, onSaved }: Props) {
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Garante que todas as chaves do catálogo existam (default false)
    const merged: Record<string, boolean> = {};
    MODULE_CATALOG.forEach((m) => {
      merged[m.key] = Boolean(initialModules?.[m.key]);
    });
    setModules(merged);
  }, [initialModules, tenantId]);

  const enabledCount = useMemo(
    () => Object.values(modules).filter(Boolean).length,
    [modules],
  );

  const toggle = (key: string, value: boolean) => {
    setModules((prev) => ({ ...prev, [key]: value }));
  };

  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    MODULE_CATALOG.forEach((m) => (next[m.key] = value));
    setModules(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log("[TenantModulesManager] Salvando módulos:", { tenantId, modules });
      const { data, error } = await supabase
        .from("whitelabel_tenants")
        .update({
          enabled_modules: modules,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId)
        .select("id, enabled_modules");
      if (error) throw error;
      if (!data || data.length === 0) {
        // RLS bloqueou silenciosamente — UPDATE não retornou linhas
        throw new Error(
          "Você não tem permissão para alterar este tenant (RLS). Verifique se está logado como master/admin UNV.",
        );
      }
      console.log("[TenantModulesManager] Salvo com sucesso. Retorno:", data);
      toast.success(`Módulos atualizados para "${tenantName}"`);
      onSaved?.();
    } catch (err: any) {
      console.error("[TenantModulesManager] Erro ao salvar:", err);
      toast.error("Erro ao salvar: " + (err.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <p className="text-sm text-muted-foreground">
            {enabledCount} de {MODULE_CATALOG.length} módulos habilitados
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAll(true)}>
            Habilitar todos
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAll(false)}>
            Desabilitar todos
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
        {MODULE_CATALOG.map((m) => {
          const Icon = m.icon;
          const enabled = modules[m.key] ?? false;
          return (
            <Card
              key={m.key}
              className={`transition-colors ${enabled ? "border-primary/40 bg-primary/5" : ""}`}
            >
              <CardContent className="p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${
                      enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <Label className="text-sm font-medium text-foreground cursor-pointer">
                      {m.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                  </div>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => toggle(m.key, v)}
                  className="shrink-0 mt-1"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Salvando..." : "Salvar Permissões"}
      </Button>
    </div>
  );
}
