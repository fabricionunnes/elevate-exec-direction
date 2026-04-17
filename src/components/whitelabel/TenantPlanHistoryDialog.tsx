import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string | null;
  tenantName?: string;
}

export function TenantPlanHistoryDialog({ open, onOpenChange, tenantId, tenantName }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["tenant-plan-history", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("whitelabel_tenant_plan_history")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Planos: {tenantName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : !data?.length ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhuma mudança de plano registrada.
          </p>
        ) : (
          <div className="space-y-3">
            {data.map((entry: any) => (
              <div key={entry.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="text-muted-foreground">{entry.previous_plan_slug || "—"}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  <span>{entry.new_plan_slug}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                  {entry.changed_by_name && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {entry.changed_by_name}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-muted/40 px-2 py-1">
                    Projetos: {entry.previous_max_projects ?? "—"} →{" "}
                    <span className="font-medium text-foreground">{entry.new_max_projects ?? "—"}</span>
                  </div>
                  <div className="rounded bg-muted/40 px-2 py-1">
                    Usuários: {entry.previous_max_users ?? "∞"} →{" "}
                    <span className="font-medium text-foreground">{entry.new_max_users ?? "∞"}</span>
                  </div>
                </div>
                {entry.reason && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-2">
                    "{entry.reason}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
