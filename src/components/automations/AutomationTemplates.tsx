import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Zap, ArrowRight, Plus } from "lucide-react";
import { getTriggerDefinition, getActionDefinition } from "./triggerConfig";

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  trigger_type: string;
  trigger_config: any;
  conditions: any;
  action_type: string;
  action_config: any;
  icon: string | null;
}

interface AutomationTemplatesProps {
  onActivated: () => void;
}

export function AutomationTemplates({ onActivated }: AutomationTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data, error } = await supabase
        .from("automation_templates")
        .select("*")
        .eq("is_active", true)
        .order("created_at");

      if (error) {
        console.error(error);
      } else {
        setTemplates((data as any[]) || []);
      }
      setLoading(false);
    };

    fetchTemplates();
  }, []);

  const activateTemplate = async (template: Template) => {
    setActivating(template.id);

    // Get staff id
    const { data: { user } } = await supabase.auth.getUser();
    const { data: staff } = await supabase
      .from("onboarding_staff")
      .select("id")
      .eq("user_id", user?.id || "")
      .eq("is_active", true)
      .maybeSingle();

    const { error } = await supabase.from("automation_rules").insert({
      name: template.name,
      description: template.description,
      trigger_type: template.trigger_type,
      trigger_config: template.trigger_config,
      conditions: template.conditions,
      action_type: template.action_type,
      action_config: template.action_config,
      is_active: true,
      created_by: staff?.id || null,
    });

    setActivating(null);

    if (error) {
      toast.error("Erro ao ativar modelo");
      console.error(error);
    } else {
      toast.success("Modelo ativado como nova regra!");
      onActivated();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Zap className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">Nenhum modelo disponível</h3>
          <p className="text-sm text-muted-foreground">
            Modelos prontos aparecerão aqui para ativação com 1 clique.
          </p>
        </CardContent>
      </Card>
    );
  }

  const categoryLabels: Record<string, string> = {
    crm: "CRM",
    onboarding: "Onboarding",
    financial: "Financeiro",
    general: "Geral",
  };

  const grouped = templates.reduce((acc, t) => {
    const cat = t.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            {categoryLabels[category] || category}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((template) => {
              const trigger = getTriggerDefinition(template.trigger_type);
              const action = getActionDefinition(template.action_type);

              return (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm">{template.name}</h4>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {template.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs">
                        <Badge variant="outline" className={trigger?.moduleColor || ""}>
                          {trigger?.moduleLabel || template.trigger_type}
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span>{action?.label || template.action_type}</span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={activating === template.id}
                        onClick={() => activateTemplate(template)}
                      >
                        {activating === template.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Ativar este modelo
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
