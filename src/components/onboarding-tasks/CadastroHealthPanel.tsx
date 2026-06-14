import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardCheck, Phone, User, Tag, UserCog, Target, ListChecks, PenLine } from "lucide-react";
import { motion } from "framer-motion";

interface Company {
  id: string;
  name: string;
  owner_phone: string | null;
  owner_name: string | null;
  phone: string | null;
  segment: string | null;
  cs_id: string | null;
  consultant_id: string | null;
  goal_not_required: boolean | null;
}

interface CheckDef {
  key: string;
  label: string;
  icon: any;
  weight: number;
}

// Dimensões do cadastro saudável — o teto da inteligência do sistema depende disso
const CHECKS: CheckDef[] = [
  { key: "phone", label: "Telefone do dono", icon: Phone, weight: 1 },
  { key: "owner", label: "Nome do dono", icon: User, weight: 1 },
  { key: "segment", label: "Segmento", icon: Tag, weight: 1 },
  { key: "responsible", label: "CS/consultor", icon: UserCog, weight: 1 },
  { key: "kpi", label: "KPI configurado", icon: ListChecks, weight: 1 },
  { key: "goal", label: "Meta lançada", icon: Target, weight: 1 },
  { key: "launching", label: "Lançando", icon: PenLine, weight: 1 },
];

function validPhone(p: string | null): boolean {
  return !!p && p.replace(/\D/g, "").length >= 10;
}

export const CadastroHealthPanel = () => {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [kpiByCompany, setKpiByCompany] = useState<Record<string, { hasKpi: boolean; hasDaily: boolean; hasTarget: boolean }>>({});
  const [monthlyTargetCompanies, setMonthlyTargetCompanies] = useState<Set<string>>(new Set());
  const [launchingCompanies, setLaunchingCompanies] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const monthYear = new Date().toISOString().slice(0, 7);
        const since = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];

        const [{ data: comps }, { data: kpis }, { data: targets }, { data: entries }] = await Promise.all([
          supabase
            .from("onboarding_companies")
            .select("id, name, owner_phone, owner_name, phone, segment, cs_id, consultant_id, goal_not_required, is_simulator, status")
            .eq("status", "active"),
          supabase.from("company_kpis").select("company_id, periodicity, target_value, is_active").eq("is_active", true),
          supabase.from("kpi_monthly_targets").select("company_id, target_value").eq("month_year", monthYear),
          supabase.from("kpi_entries").select("company_id").gte("entry_date", since).lte("entry_date", new Date().toISOString().split("T")[0]),
        ]);

        const activeComps = (comps || []).filter((c: any) => !c.is_simulator);
        setCompanies(activeComps);

        const kpiMap: Record<string, { hasKpi: boolean; hasDaily: boolean; hasTarget: boolean }> = {};
        (kpis || []).forEach((k: any) => {
          const cur = kpiMap[k.company_id] || { hasKpi: false, hasDaily: false, hasTarget: false };
          cur.hasKpi = true;
          if (k.periodicity === "daily") cur.hasDaily = true;
          if (Number(k.target_value) > 0) cur.hasTarget = true;
          kpiMap[k.company_id] = cur;
        });
        setKpiByCompany(kpiMap);

        setMonthlyTargetCompanies(new Set((targets || []).filter((t: any) => Number(t.target_value) > 0).map((t: any) => t.company_id)));
        setLaunchingCompanies(new Set((entries || []).map((e: any) => e.company_id)));
      } catch (err) {
        console.error("Error fetching cadastro health:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const analysis = useMemo(() => {
    const rows = companies.map((c) => {
      const kpi = kpiByCompany[c.id] || { hasKpi: false, hasDaily: false, hasTarget: false };
      const hasGoal = kpi.hasTarget || monthlyTargetCompanies.has(c.id) || !!c.goal_not_required;
      const results: Record<string, boolean | null> = {
        phone: validPhone(c.owner_phone) || validPhone(c.phone),
        owner: !!c.owner_name && c.owner_name.trim().length > 1,
        segment: !!c.segment && c.segment.trim().length > 1,
        responsible: !!c.cs_id || !!c.consultant_id,
        kpi: kpi.hasKpi,
        goal: hasGoal,
        // "Lançando" só se aplica a quem tem KPI diário; senão N/A (null)
        launching: kpi.hasDaily ? launchingCompanies.has(c.id) : null,
      };
      const applicable = CHECKS.filter((ch) => results[ch.key] !== null);
      const passed = applicable.filter((ch) => results[ch.key] === true);
      const score = applicable.length > 0 ? Math.round((passed.length / applicable.length) * 100) : 100;
      const missing = applicable.filter((ch) => results[ch.key] === false).map((ch) => ch);
      return { company: c, score, missing, results };
    });

    rows.sort((a, b) => a.score - b.score);
    const avg = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0;
    const complete = rows.filter((r) => r.score === 100).length;

    // Lacunas mais comuns no portfólio
    const gapCount: Record<string, number> = {};
    rows.forEach((r) => r.missing.forEach((m) => { gapCount[m.key] = (gapCount[m.key] || 0) + 1; }));
    const topGaps = CHECKS
      .map((ch) => ({ ...ch, count: gapCount[ch.key] || 0 }))
      .filter((g) => g.count > 0)
      .sort((a, b) => b.count - a.count);

    return { rows, avg, complete, total: rows.length, topGaps };
  }, [companies, kpiByCompany, monthlyTargetCompanies, launchingCompanies]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const scoreColor = (s: number) => (s >= 85 ? "text-emerald-500" : s >= 60 ? "text-amber-500" : "text-red-500");
  const barColor = (s: number) => (s >= 85 ? "bg-emerald-500" : s >= 60 ? "bg-amber-500" : "bg-red-500");

  return (
    <div className="space-y-3">
      {/* Resumo do portfólio */}
      <Card className="relative overflow-hidden border-0 shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent" />
        <CardContent className="relative p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-blue-600 text-white shadow-lg shadow-primary/20">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Saúde do Cadastro</p>
              <p className="text-xs text-muted-foreground">A qualidade do cadastro é o teto da inteligência do sistema</p>
            </div>
            <div className="ml-auto text-right">
              <p className={`text-2xl font-bold ${scoreColor(analysis.avg)}`}>{analysis.avg}%</p>
              <p className="text-[10px] text-muted-foreground">{analysis.complete}/{analysis.total} completos</p>
            </div>
          </div>

          {/* Lacunas mais comuns */}
          <div className="flex flex-wrap gap-1.5">
            {analysis.topGaps.map((g) => (
              <Badge key={g.key} variant="outline" className="text-[10px] gap-1 border-red-500/20 bg-red-500/[0.04] text-red-600">
                <g.icon className="h-3 w-3" />
                {g.label}: {g.count}
              </Badge>
            ))}
            {analysis.topGaps.length === 0 && (
              <span className="text-xs text-emerald-600">Cadastro completo em todo o portfólio.</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Empresas com lacunas */}
      <div className="space-y-1.5">
        {analysis.rows.filter((r) => r.score < 100).map((r, idx) => (
          <motion.div
            key={r.company.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.02, 0.3) }}
          >
            <Card className="border-0 bg-card/60">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className={`text-sm font-bold w-10 shrink-0 ${scoreColor(r.score)}`}>{r.score}%</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate mb-1">{r.company.name}</p>
                    <div className="relative h-1.5 rounded-full bg-muted/60 overflow-hidden mb-1.5">
                      <div className={`h-full rounded-full ${barColor(r.score)}`} style={{ width: `${r.score}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {r.missing.map((m) => (
                        <Badge key={m.key} variant="outline" className="text-[9px] gap-1 px-1.5 py-0 border-red-500/20 text-red-600">
                          <m.icon className="h-2.5 w-2.5" />
                          {m.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {analysis.rows.filter((r) => r.score < 100).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">Nenhuma empresa com cadastro incompleto.</p>
        )}
      </div>
    </div>
  );
};

export default CadastroHealthPanel;
