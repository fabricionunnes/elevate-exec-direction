import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Pause, Play, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function CadenceEnrollmentsList() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_cadence_enrollments")
      .select("*, cadence:crm_cadences(name), lead:crm_leads(name, phone)")
      .in("status", ["active", "paused"])
      .order("next_run_at", { ascending: true })
      .limit(100);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("crm_cadence_enrollments").update({ status }).eq("id", id);
    if (error) toast.error("Erro");
    else { toast.success("Atualizado"); fetch(); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  if (rows.length === 0) return (
    <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum lead em cadência no momento.</CardContent></Card>
  );

  return (
    <div className="grid gap-2">
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium truncate">{r.lead?.name || "Lead"}</span>
                <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Cadência: {r.cadence?.name} • Passo {r.current_step_index + 1}
                {r.next_run_at && ` • Próximo envio ${formatDistanceToNow(new Date(r.next_run_at), { addSuffix: true, locale: ptBR })}`}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              {r.status === "active" ? (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setStatus(r.id, "paused")}><Pause className="h-4 w-4" /></Button>
              ) : (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setStatus(r.id, "active")}><Play className="h-4 w-4" /></Button>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setStatus(r.id, "stopped")}><X className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
