import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function CadenceMessagesLog() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("crm_cadence_messages")
        .select("*, cadence:crm_cadences(name), lead:crm_leads(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (rows.length === 0) return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma mensagem enviada ainda.</CardContent></Card>;

  return (
    <div className="grid gap-2">
      {rows.map((m) => (
        <Card key={m.id}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <Badge variant={m.status === "sent" ? "default" : m.status === "failed" ? "destructive" : "secondary"}>{m.status}</Badge>
                <span className="font-medium text-sm">{m.lead?.name}</span>
                <span className="text-xs text-muted-foreground">• {m.cadence?.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
            </div>
            {m.message_content && <p className="text-sm text-muted-foreground line-clamp-2">{m.message_content}</p>}
            {m.error_message && <p className="text-xs text-destructive mt-1">{m.error_message}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
