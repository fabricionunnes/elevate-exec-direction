import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Gauge } from "lucide-react";
import { format } from "date-fns";
import { BoardNps, fetchCompanyNameMap } from "./boardTypes";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "border-yellow-500 text-yellow-600" },
  sent: { label: "Enviado", className: "border-blue-500 text-blue-600" },
  answered: { label: "Respondido", className: "border-green-500 text-green-600" },
  skipped: { label: "Pulado", className: "border-muted-foreground text-muted-foreground" },
};

function scoreClass(score: number): string {
  if (score <= 6) return "bg-red-500/15 text-red-600 border-red-500";
  if (score <= 8) return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500";
  return "bg-green-500/15 text-green-600 border-green-500";
}

export function BoardNpsTab() {
  const [rows, setRows] = useState<BoardNps[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNps = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("unv_board_nps")
        .select("*")
        .order("due_date", { ascending: false });
      if (error) throw error;
      const list = (data || []) as BoardNps[];
      const nameMap = await fetchCompanyNameMap(supabase, list.map((n) => n.company_id));
      setRows(list.map((n) => ({ ...n, company_name: nameMap[n.company_id] || "—" })));
    } catch (err) {
      console.error("Erro ao carregar NPS:", err);
      toast.error("Erro ao carregar NPS");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNps();
  }, [fetchNps]);

  if (loading) {
    return <Skeleton className="h-64" />;
  }

  const answered = rows.filter((r) => r.score != null);
  const avg =
    answered.length > 0
      ? (answered.reduce((sum, r) => sum + (r.score || 0), 0) / answered.length).toFixed(1)
      : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Gauge className="h-4 w-4" />
        <span>
          {rows.length} ciclo(s) de NPS · {answered.length} respondido(s) · média{" "}
          <span className="font-semibold text-foreground">{avg}</span>
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gauge className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum ciclo de NPS registrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((n) => {
                  const badge = STATUS_BADGE[n.status] || { label: n.status, className: "" };
                  const cycleMonths = Math.round((n.cycle_days || 0) / 30);
                  return (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">{n.company_name}</TableCell>
                      <TableCell className="text-sm">
                        {cycleMonths > 0 ? `Mês ${cycleMonths}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {n.due_date
                          ? format(new Date(`${n.due_date.slice(0, 10)}T12:00:00`), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {n.score != null ? (
                          <Badge variant="outline" className={scoreClass(n.score)}>
                            {n.score}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {n.feedback || "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
