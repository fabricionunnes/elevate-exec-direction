import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fetchCompanyNameMap } from "./boardTypes";

// Valor mensal do UNV Board (12x de R$ 1.666,67) — base do múltiplo de ROI
const BOARD_MONTHLY_BRL = 1666.67;

interface BoardResult {
  id: string;
  member_id: string;
  company_id: string;
  description: string;
  value_brl: number | null;
  metric_text: string | null;
  reported_at: string;
  company_name?: string;
}

interface MemberRoi {
  member_id: string;
  company_id: string;
  company_name: string;
  entry_date: string;
  total_brl: number;
  results_count: number;
  months_active: number;
  invested_brl: number;
}

export function BoardResultsTab() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<BoardResult[]>([]);
  const [rois, setRois] = useState<MemberRoi[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const { data: rows, error } = await (supabase as any)
        .from("unv_board_results")
        .select("*")
        .order("reported_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const { data: members } = await (supabase as any)
        .from("unv_board_members")
        .select("id, company_id, entry_date")
        .eq("status", "active");

      const nameMap = await fetchCompanyNameMap(
        supabase,
        Array.from(new Set([...(rows || []).map((r: any) => r.company_id), ...(members || []).map((m: any) => m.company_id)]))
      );

      setResults(
        (rows || []).map((r: any) => ({ ...r, company_name: nameMap[r.company_id] || "—" }))
      );

      const now = new Date();
      const roiList: MemberRoi[] = (members || []).map((m: any) => {
        const memberResults = (rows || []).filter((r: any) => r.member_id === m.id);
        const totalBrl = memberResults.reduce((s: number, r: any) => s + (Number(r.value_brl) || 0), 0);
        const monthsActive = Math.max(
          1,
          Math.ceil((now.getTime() - new Date(m.entry_date + "T12:00:00").getTime()) / (30 * 86400000))
        );
        return {
          member_id: m.id,
          company_id: m.company_id,
          company_name: nameMap[m.company_id] || "—",
          entry_date: m.entry_date,
          total_brl: totalBrl,
          results_count: memberResults.length,
          months_active: monthsActive,
          invested_brl: monthsActive * BOARD_MONTHLY_BRL,
        };
      });
      setRois(roiList.sort((a, b) => b.total_brl - a.total_brl));
    } catch (err) {
      console.error("Erro ao carregar resultados do Board:", err);
      toast.error("Erro ao carregar resultados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const grandTotal = rois.reduce((s, r) => s + r.total_brl, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Resultado total atribuído</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{brl(grandTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Resultados reportados</p>
            <p className="text-2xl font-bold mt-1">{results.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Membros com resultado</p>
            <p className="text-2xl font-bold mt-1">{rois.filter((r) => r.results_count > 0).length}/{rois.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            ROI por membro (resultado atribuído vs investimento no Board)
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Meses</TableHead>
                <TableHead>Investido</TableHead>
                <TableHead>Resultado atribuído</TableHead>
                <TableHead>Múltiplo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rois.map((r) => (
                <TableRow key={r.member_id}>
                  <TableCell className="font-medium">{r.company_name}</TableCell>
                  <TableCell>{r.months_active}</TableCell>
                  <TableCell>{brl(r.invested_brl)}</TableCell>
                  <TableCell className={r.total_brl > 0 ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                    {r.total_brl > 0 ? brl(r.total_brl) : "—"}
                  </TableCell>
                  <TableCell>
                    {r.total_brl > 0 ? (
                      <span className="font-semibold">{(r.total_brl / r.invested_brl).toFixed(1)}x</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!rois.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nenhum membro ativo com plano publicado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold mb-3">Últimos resultados reportados</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Métrica</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.slice(0, 50).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(r.reported_at), "dd/MM/yy")}
                  </TableCell>
                  <TableCell>{r.company_name}</TableCell>
                  <TableCell className="max-w-md">{r.description}</TableCell>
                  <TableCell className="whitespace-nowrap text-green-600 font-medium">
                    {r.value_brl ? brl(Number(r.value_brl)) : "—"}
                  </TableCell>
                  <TableCell className="max-w-xs text-muted-foreground">{r.metric_text || "—"}</TableCell>
                </TableRow>
              ))}
              {!results.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nenhum resultado reportado ainda — eles nascem quando o cliente executa ações pelo formulário.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
