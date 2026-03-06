import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  companyId: string;
}

export function BillingBlockToggle({ companyId }: Props) {
  const [blocked, setBlocked] = useState(false);
  const [blockedAt, setBlockedAt] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchStatus = async () => {
    const { data } = await supabase
      .from("onboarding_companies")
      .select("is_billing_blocked, billing_blocked_at, billing_blocked_reason")
      .eq("id", companyId)
      .single();

    if (data) {
      setBlocked((data as any).is_billing_blocked || false);
      setBlockedAt((data as any).billing_blocked_at || null);
      setBlockedReason((data as any).billing_blocked_reason || null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, [companyId]);

  const toggleBlock = async () => {
    setToggling(true);
    const newBlocked = !blocked;

    const { error } = await supabase
      .from("onboarding_companies")
      .update({
        is_billing_blocked: newBlocked,
        billing_blocked_at: newBlocked ? new Date().toISOString() : null,
        billing_blocked_reason: newBlocked ? "Bloqueio manual pelo administrador" : null,
      } as any)
      .eq("id", companyId);

    if (error) {
      toast.error("Erro ao atualizar bloqueio");
    } else {
      setBlocked(newBlocked);
      setBlockedAt(newBlocked ? new Date().toISOString() : null);
      setBlockedReason(newBlocked ? "Bloqueio manual pelo administrador" : null);
      toast.success(newBlocked ? "Acesso do cliente bloqueado" : "Acesso do cliente liberado");
    }
    setToggling(false);
  };

  if (loading) return null;

  return (
    <Card className={`border ${blocked ? "border-destructive/30 bg-destructive/5" : "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10"}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {blocked ? (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-green-600" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">Acesso do Portal</p>
                <Badge variant={blocked ? "destructive" : "default"} className="text-xs">
                  {blocked ? "Bloqueado" : "Liberado"}
                </Badge>
              </div>
              {blocked && blockedAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {blockedReason || "Bloqueado"} em {format(new Date(blockedAt), "dd/MM/yyyy HH:mm")}
                </p>
              )}
            </div>
          </div>
          <Button
            variant={blocked ? "default" : "destructive"}
            size="sm"
            onClick={toggleBlock}
            disabled={toggling}
          >
            {toggling && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {blocked ? "Liberar Acesso" : "Bloquear Acesso"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
