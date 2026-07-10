import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Flag, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlagRow {
  salesperson_id: string;
  salesperson_name: string;
  ref_month: string; // YYYY-MM
  flag: "red" | "yellow" | "green" | "none";
  pct: number | null;
  target_value: number | null;
  achieved: number | null;
  kpi_name: string | null;
}

const DOT: Record<string, string> = {
  red: "bg-red-500",
  yellow: "bg-amber-400",
  green: "bg-emerald-500",
  none: "bg-slate-300 dark:bg-slate-600",
};
const TXT: Record<string, string> = {
  red: "text-red-600",
  yellow: "text-amber-600",
  green: "text-emerald-600",
  none: "text-muted-foreground",
};

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const monthShort = (my: string) => {
  const [y, m] = my.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1] || m}/${y.slice(2)}`;
};

/**
 * Flags de performance dos vendedores do cliente nos 3 ÚLTIMOS MESES FECHADOS
 * (em julho: junho, maio e abril). Regra por mês, sobre a meta daquele mês:
 * <70% = Red · 70–100% = Yellow · >100% = Green. Sem meta = sem flag.
 * Vendedor (isSalespersonView) vê só a própria linha.
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

  // meses (recente → antigo) e vendedores agrupados
  const months = useMemo(
    () => Array.from(new Set(rows.map((r) => r.ref_month))).sort().reverse(),
    [rows],
  );
  const people = useMemo(() => {
    const map = new Map<string, { name: string; byMonth: Map<string, FlagRow> }>();
    rows.forEach((r) => {
      if (!map.has(r.salesperson_id)) map.set(r.salesperson_id, { name: r.salesperson_name, byMonth: new Map() });
      map.get(r.salesperson_id)!.byMonth.set(r.ref_month, r);
    });
    const latest = months[0];
    const rank: Record<string, number> = { red: 0, yellow: 1, green: 2, none: 3 };
    return Array.from(map, ([id, p]) => ({ id, ...p }))
      .sort((a, b) => {
        const fa = a.byMonth.get(latest)?.flag || "none";
        const fb = b.byMonth.get(latest)?.flag || "none";
        return rank[fa] - rank[fb] || (a.byMonth.get(latest)?.pct ?? 999) - (b.byMonth.get(latest)?.pct ?? 999);
      });
  }, [rows, months]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
        <Loader2 className="h-4 w-4 animate-spin" /> Calculando flags dos vendedores...
      </div>
    );
  }
  if (!people.length || !months.length) return null;

  const latest = months[0];
  const counts = {
    red: people.filter((p) => p.byMonth.get(latest)?.flag === "red").length,
    yellow: people.filter((p) => p.byMonth.get(latest)?.flag === "yellow").length,
    green: people.filter((p) => p.byMonth.get(latest)?.flag === "green").length,
  };
  // se ninguém tem flag nenhuma em nenhum mês, não ocupa espaço na tela
  if (!rows.some((r) => r.flag !== "none")) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" />
          Flags do time
          <span className="text-xs font-normal text-muted-foreground">· últimos 3 meses fechados</span>
        </CardTitle>
        {!isSalespersonView && (
          <CardDescription className="text-xs flex flex-wrap items-center gap-3">
            <span className="font-medium">{monthShort(latest)}:</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> {counts.red} red</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> {counts.yellow} yellow</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> {counts.green} green</span>
            <span className="text-muted-foreground/70">&lt;70% red · 70–100% yellow · &gt;100% green</span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="p-0 sm:p-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="text-left font-medium px-3 py-1.5">Vendedor</th>
                {months.map((m, i) => (
                  <th key={m} className={cn("text-center font-medium px-3 py-1.5", i === 0 && "text-foreground")}>{monthShort(m)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 font-medium max-w-[180px] truncate">{p.name}</td>
                  {months.map((m, i) => {
                    const r = p.byMonth.get(m);
                    const flag = r?.flag || "none";
                    return (
                      <td key={m} className="px-3 py-2 text-center">
                        <div
                          className="inline-flex items-center gap-1.5"
                          title={
                            r && flag !== "none"
                              ? `${r.kpi_name || "Meta"}: ${brl(Number(r.achieved || 0))} de ${brl(Number(r.target_value || 0))}`
                              : "sem meta nesse mês"
                          }
                        >
                          <span className={cn("h-3 w-3 rounded-full inline-block", DOT[flag], i === 0 && flag === "red" && "animate-pulse")} />
                          <span className={cn("tabular-nums text-xs", TXT[flag], i === 0 && "font-bold text-sm")}>
                            {flag !== "none" && r?.pct != null ? `${r.pct}%` : "—"}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
