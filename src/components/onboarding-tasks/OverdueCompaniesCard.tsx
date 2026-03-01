import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Building2, Calendar, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OverdueCompany {
  company_id: string;
  company_name: string;
  consultant_id: string | null;
  cs_id: string | null;
  overdue_count: number;
  max_days_late: number;
  total_overdue_cents: number;
}

interface Props {
  currentUserRole: string | null;
  currentStaffId: string | null;
}

export function OverdueCompaniesCard({ currentUserRole, currentStaffId }: Props) {
  const [overdueCompanies, setOverdueCompanies] = useState<OverdueCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    fetchOverdueData();
  }, []);

  const fetchOverdueData = async () => {
    try {
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

      const { data: invoices } = await supabase
        .from("company_invoices")
        .select("company_id, due_date, amount_cents")
        .eq("status", "pending")
        .lt("due_date", todayStr);

      if (!invoices || invoices.length === 0) {
        setOverdueCompanies([]);
        setLoading(false);
        return;
      }

      // Get unique company IDs
      const companyIds = [...new Set(invoices.map((i) => i.company_id))];

      const { data: companies } = await supabase
        .from("onboarding_companies")
        .select("id, name, consultant_id, cs_id")
        .in("id", companyIds);

      // Also check project-level consultant assignments
      const { data: projects } = await supabase
        .from("onboarding_projects")
        .select("onboarding_company_id, consultant_id, cs_id")
        .in("onboarding_company_id", companyIds)
        .eq("status", "active");

      const companyMap = new Map(
        (companies || []).map((c) => [c.id, c])
      );

      // Build project consultant map
      const projectConsultantMap = new Map<string, Set<string>>();
      (projects || []).forEach((p) => {
        if (!p.onboarding_company_id) return;
        if (!projectConsultantMap.has(p.onboarding_company_id)) {
          projectConsultantMap.set(p.onboarding_company_id, new Set());
        }
        const set = projectConsultantMap.get(p.onboarding_company_id)!;
        if (p.consultant_id) set.add(p.consultant_id);
        if (p.cs_id) set.add(p.cs_id);
      });

      const today = new Date(todayStr + "T12:00:00");

      // Group by company
      const grouped = new Map<string, { count: number; maxDays: number; totalCents: number }>();
      invoices.forEach((inv) => {
        const existing = grouped.get(inv.company_id) || { count: 0, maxDays: 0, totalCents: 0 };
        const dueDate = new Date(inv.due_date + "T12:00:00");
        const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        existing.count++;
        existing.maxDays = Math.max(existing.maxDays, daysLate);
        existing.totalCents += inv.amount_cents || 0;
        grouped.set(inv.company_id, existing);
      });

      const result: OverdueCompany[] = [];
      grouped.forEach((data, companyId) => {
        const company = companyMap.get(companyId);
        if (!company) return;
        result.push({
          company_id: companyId,
          company_name: company.name,
          consultant_id: company.consultant_id,
          cs_id: company.cs_id,
          overdue_count: data.count,
          max_days_late: data.maxDays,
          total_overdue_cents: data.totalCents,
        });
      });

      // Attach project-level staff info for filtering
      result.forEach((r) => {
        const projStaff = projectConsultantMap.get(r.company_id);
        if (projStaff) {
          (r as any)._projectStaffIds = projStaff;
        }
      });

      result.sort((a, b) => b.max_days_late - a.max_days_late);
      setOverdueCompanies(result);
    } catch (err) {
      console.error("Error fetching overdue companies:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    const isMasterOrAdmin = currentUserRole === "master" || currentUserRole === "admin";
    if (isMasterOrAdmin) return overdueCompanies;

    // Consultants/CS: filter to their companies
    if (!currentStaffId) return [];
    return overdueCompanies.filter((c) => {
      if (c.consultant_id === currentStaffId || c.cs_id === currentStaffId) return true;
      const projStaff = (c as any)._projectStaffIds as Set<string> | undefined;
      return projStaff?.has(currentStaffId) || false;
    });
  }, [overdueCompanies, currentUserRole, currentStaffId]);

  if (loading || filteredCompanies.length === 0) return null;

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const getUrgencyColor = (days: number) => {
    if (days >= 60) return "text-red-600 bg-red-500/10 border-red-500/20";
    if (days >= 30) return "text-orange-600 bg-orange-500/10 border-orange-500/20";
    if (days >= 15) return "text-amber-600 bg-amber-500/10 border-amber-500/20";
    return "text-yellow-600 bg-yellow-500/10 border-yellow-500/20";
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          className="border-red-500/30 bg-red-500/5 cursor-pointer hover:bg-red-500/10 transition-colors"
          onClick={() => setShowDialog(true)}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/15 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Empresas Inadimplentes
                </p>
                <p className="text-xs text-muted-foreground">
                  {filteredCompanies.length} {filteredCompanies.length === 1 ? "empresa" : "empresas"} com parcelas em atraso
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-lg px-3 py-1">
                {filteredCompanies.length}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Empresas Inadimplentes ({filteredCompanies.length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 pr-2">
              <AnimatePresence>
                {filteredCompanies.map((company, i) => (
                  <motion.div
                    key={company.company_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`p-3 rounded-lg border ${getUrgencyColor(company.max_days_late)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span className="font-medium text-sm truncate">
                          {company.company_name}
                        </span>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {company.overdue_count} {company.overdue_count === 1 ? "parcela" : "parcelas"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Até {company.max_days_late} {company.max_days_late === 1 ? "dia" : "dias"} de atraso
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(company.total_overdue_cents)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
