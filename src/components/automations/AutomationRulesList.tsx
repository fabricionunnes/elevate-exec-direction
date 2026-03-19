import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Zap, ArrowRight, Trash2, Pencil, Loader2 } from "lucide-react";
import { getTriggerDefinition, getActionDefinition } from "./triggerConfig";
import { AutomationRuleDialog } from "./AutomationRuleDialog";
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

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: any;
  conditions: any;
  action_type: string;
  action_config: any;
  is_active: boolean;
  created_at: string;
}

export function AutomationRulesList() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchRules = async () => {
    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar regras");
      console.error(error);
    } else {
      setRules((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("automation_rules")
      .update({ is_active: !current })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar regra");
    } else {
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_active: !current } : r))
      );
      toast.success(!current ? "Regra ativada" : "Regra desativada");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase
      .from("automation_rules")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Erro ao excluir regra");
    } else {
      setRules((prev) => prev.filter((r) => r.id !== deleteId));
      toast.success("Regra excluída");
    }
    setDeleteId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rules.length} regra{rules.length !== 1 ? "s" : ""} configurada{rules.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={() => { setEditingRule(null); setDialogOpen(true); }} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Automação
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">Nenhuma automação configurada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie regras para automatizar ações entre os módulos do sistema.
            </p>
            <Button onClick={() => { setEditingRule(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira automação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rules.map((rule) => {
            const trigger = getTriggerDefinition(rule.trigger_type);
            const action = getActionDefinition(rule.action_type);

            return (
              <Card key={rule.id} className={`transition-opacity ${!rule.is_active ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium truncate">{rule.name}</h4>
                        <Badge variant={rule.is_active ? "default" : "secondary"} className="shrink-0">
                          {rule.is_active ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>

                      {rule.description && (
                        <p className="text-sm text-muted-foreground mb-3">{rule.description}</p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        <Badge variant="outline" className={trigger?.moduleColor || ""}>
                          {trigger?.moduleLabel || rule.trigger_type}
                        </Badge>
                        <span className="font-medium">{trigger?.label || rule.trigger_type}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{action?.label || rule.action_type}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleActive(rule.id, rule.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setEditingRule(rule); setDialogOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteId(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AutomationRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingRule={editingRule}
        onSaved={fetchRules}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O histórico de execuções também será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
