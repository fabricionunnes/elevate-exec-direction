import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar as RRadar, ResponsiveContainer,
} from "recharts";

const LEVERS = [
  { key: "estrategico", label: "Estratégico" },
  { key: "marketing", label: "Marketing" },
  { key: "vendas", label: "Vendas" },
  { key: "pessoas", label: "Pessoas" },
  { key: "financeiro", label: "Financeiro" },
];

interface MaturityRow {
  estrategico: number; marketing: number; vendas: number;
  pessoas: number; financeiro: number; total: number;
  notes: string | null; created_at: string;
}

export function LeadMaturityTab({ leadId }: { leadId: string }) {
  const [rows, setRows] = useState<MaturityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      // cast: tabela nova ainda não está nos tipos gerados do Supabase
      const { data } = await (supabase as any)
        .from("crm_lead_maturity")
        .select("estrategico,marketing,vendas,pessoas,financeiro,total,notes,created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(12);
      if (active) { setRows((data as MaturityRow[]) || []); setLoading(false); }
    })();
    return () => { active = false; };
  }, [leadId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;

  if (!rows.length) {
    return (
      <div className="p-6 text-sm text-muted-foreground max-w-md">
        Nenhum Teste de Maturidade ainda. Durante a reunião, faça o teste na extensão
        <strong className="text-foreground"> UNV Copilot</strong> — ao salvar, o gráfico de
        teia com as 5 alavancas aparece aqui.
      </div>
    );
  }

  const latest = rows[0];
  const chartData = LEVERS.map((l) => ({ pilar: l.label, nota: (latest as any)[l.key] as number }));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col md:flex-row gap-6 md:items-center">
        <div className="w-full md:w-[380px] h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} outerRadius="72%">
              <PolarGrid />
              <PolarAngleAxis dataKey="pilar" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
              <RRadar dataKey="nota" stroke="#cc1b1b" fill="#cc1b1b" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4 flex-1">
          <div>
            <div className="text-3xl font-bold tabular-nums">
              {latest.total}<span className="text-lg text-muted-foreground">/50</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Maturidade {latest.total * 2}/100 · {new Date(latest.created_at).toLocaleDateString("pt-BR")}
            </div>
          </div>
          <div className="space-y-1.5">
            {LEVERS.map((l) => {
              const v = (latest as any)[l.key] as number;
              return (
                <div key={l.key} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-muted-foreground shrink-0">{l.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${v * 10}%` }} />
                  </div>
                  <span className="w-10 text-right font-semibold tabular-nums">{v}/10</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {latest.notes && (
        <div className="text-sm bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">{latest.notes}</div>
      )}

      {rows.length > 1 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Histórico</div>
          <div className="space-y-1">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-border/40 py-1.5">
                <span>{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                <span className="font-semibold tabular-nums">{r.total}/50 · {r.total * 2}/100</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
