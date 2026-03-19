import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getTriggerDefinition, getActionDefinition } from "./triggerConfig";

interface Execution {
  id: string;
  rule_id: string;
  status: string;
  trigger_data: any;
  action_result: any;
  error_message: string | null;
  executed_at: string;
  rule_name?: string;
  trigger_type?: string;
  action_type?: string;
}

export function AutomationExecutionLog() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExecutions = async () => {
      // Fetch executions with rule info
      const { data: execs, error } = await supabase
        .from("automation_executions")
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      // Fetch rule names
      const ruleIds = [...new Set((execs || []).map((e: any) => e.rule_id))];
      if (ruleIds.length > 0) {
        const { data: rules } = await supabase
          .from("automation_rules")
          .select("id, name, trigger_type, action_type")
          .in("id", ruleIds);

        const rulesMap = new Map((rules || []).map((r: any) => [r.id, r]));
        
        setExecutions(
          (execs || []).map((e: any) => {
            const rule = rulesMap.get(e.rule_id);
            return {
              ...e,
              rule_name: rule?.name || "Regra excluída",
              trigger_type: rule?.trigger_type,
              action_type: rule?.action_type,
            };
          })
        );
      } else {
        setExecutions([]);
      }

      setLoading(false);
    };

    fetchExecutions();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">Nenhuma execução registrada</h3>
          <p className="text-sm text-muted-foreground">
            As execuções aparecerão aqui quando as automações forem disparadas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {executions.map((exec) => {
        const trigger = getTriggerDefinition(exec.trigger_type || "");
        const action = getActionDefinition(exec.action_type || "");
        const isSuccess = exec.status === "success";

        return (
          <Card key={exec.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {isSuccess ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{exec.rule_name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>{trigger?.label || exec.trigger_type}</span>
                      <span>→</span>
                      <span>{action?.label || exec.action_type}</span>
                    </div>
                    {exec.error_message && (
                      <p className="text-xs text-destructive mt-1 truncate">
                        {exec.error_message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={isSuccess ? "default" : "destructive"} className="text-xs">
                    {isSuccess ? "Sucesso" : "Erro"}
                  </Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(exec.executed_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
