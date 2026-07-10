import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Flag, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlagRow {
  salesperson_id: string;
  salesperson_name: string;
  flag: "red" | "yellow" | "green" | "none";
  pct: number | null;
  target_value: number | null;
  achieved: number | null;
  kpi_name: string | null;
  ref_month: string | null;
}

const FLAG_STYLE: Record<string, { label: string; dot: string; cls: string }> = {
  red: { label: "Red Flag", dot: "bg-red-500", cls: "bg-red-500/10 text-red-600 border-red-500/30" },
  yellow: { label: "Yellow Flag", dot: "bg-amber-400", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  green: { label: "Green Flag", dot: "bg-emerald-500", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  none: { label: "Sem meta anterior", dot: "bg-slate-300", cls: "bg-muted text-muted-foreground border-border" },
};

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const fmtVal = (v: number | null, kpi: string | null) => {
  if (v == null) return "—";
  const monetary = kpi ? /faturamento|receita|valor/i.test(kpi) : v > 5000;
  return monetary ? brl(Number(v)) : Number(v).toLocaleString("pt-BR");
};
const monthLabel = (my: string | null) => {
  if (!my) return "mês anterior";
  const [y, m] = my.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1] || m}/${y}`;
};

/**
 * Flags de performance dos vendedores do cliente, calculadas sobre a META DO
 * MÊS ANTERIOR: <70% = Red · 70–100% = Yellow · >100% = Green.
 * Vendedor (isSalespersonView) vê só a própria flag.
 */
export const SalespersonFlagsPanel = ({
  companyId,
  salespersonId,
  isSalespersonView = false,
}: {
  companyId: string;
  salespersonId?: string | null;
  isSalespersonView?: boolean;
}) => {
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase.rpc as any)("get_salesperson_flags", { p_company_id: companyId });
      if (!alive) return;
      if (!error && Array.isArray(data)) {
        let list = data as FlagRow[];
        if (isSalespersonView && salespersonId) list = list.filter((r) => r.salesperson_id === salespersonId);
        setRows(list);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [companyId, salespersonId, isSalespersonView]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
        <Loader2 className="h-4 w-4 animate-spin" /> Calculando flags dos vendedores...
      </div>
    );
  }
  if (!rows.length) return null;

  const refMonth = rows.find((r) => r.ref_month)?.ref_month || null;
  const counts = {
    red: rows.filter((r) => r.flag === "red").length,
    yellow: rows.filter((r) => r.flag === "yellow").length,
    green: rows.filter((r) => r.flag === "green").length,
  };

  // ordem: red primeiro (quem precisa de atenção), depois yellow, green, none
  const rank: Record<string, number> = { red: 0, yellow: 1, green: 2, none: 3 };
  const sorted = [...rows].sort((a, b) => rank[a.flag] - rank[b.flag] || (a.pct ?? 999) - (b.pct ?? 999));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" />
          Flags do time {!isSalespersonView && <span className="text-xs font-normal text-muted-foreground">· base: meta de {monthLabel(refMonth)}</span>}
        </CardTitle>
        {!isSalespersonView && (
          <CardDescription className="text-xs flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> {counts.red} red</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> {counts.yellow} yellow</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> {counts.green} green</span>
            <span className="text-muted-foreground/70">&lt;70% red · 70–100% yellow · &gt;100% green</span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-1.5">
        {sorted.map((r) => {
          const st = FLAG_STYLE[r.flag] || FLAG_STYLE.none;
          return (
            <div key={r.salesperson_id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <span className={cn("h-3 w-3 rounded-full shrink-0", st.dot, r.flag === "red" && "animate-pulse")} />
              <span className="font-medium text-sm flex-1 min-w-0 truncate">{r.salesperson_name}</span>
              {r.flag !== "none" ? (
                <>
                  <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                    {fmtVal(r.achieved, r.kpi_name)} de {fmtVal(r.target_value, r.kpi_name)}
                    {r.kpi_name ? ` · ${r.kpi_name}` : ""}
                  </span>
                  <span className={cn("text-sm font-bold tabular-nums", r.flag === "red" ? "text-red-600" : r.flag === "yellow" ? "text-amber-600" : "text-emerald-600")}>
                    {r.pct}%
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">sem meta no mês anterior</span>
              )}
              <Badge variant="outline" className={cn("shrink-0 text-[10px]", st.cls)}>{st.label}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
