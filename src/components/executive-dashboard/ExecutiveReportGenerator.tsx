import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import logoUnv from "@/assets/logo-unv.png";
import { format, startOfMonth, endOfMonth, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StaffOption {
  id: string;
  name: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface TaskData {
  title: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  description: string | null;
  responsible_staff_name: string | null;
  assignee_name: string | null;
  observations: string | null;
}

interface MeetingData {
  title: string | null;
  meeting_date: string | null;
  ai_summary: string | null;
  notes: string | null;
  is_finalized: boolean;
}

interface GoalData {
  kpi_name: string;
  target_value: number;
  actual_value: number | null;
  unit: string | null;
}

export function ExecutiveReportGenerator() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [consultants, setConsultants] = useState<StaffOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedConsultant, setSelectedConsultant] = useState<string>("all");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));

  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [reportReady, setReportReady] = useState(false);
  const [reportCompanyName, setReportCompanyName] = useState("");
  const [reportConsultantName, setReportConsultantName] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  // Load filter options
  useEffect(() => {
    if (!open) return;
    const loadOptions = async () => {
      const [staffRes, companyRes] = await Promise.all([
        supabase.from("onboarding_staff").select("id, name").eq("is_active", true).order("name"),
        supabase.from("onboarding_companies").select("id, name").eq("status", "active").order("name"),
      ]);
      setConsultants(staffRes.data || []);
      setCompanies(companyRes.data || []);
    };
    loadOptions();
  }, [open]);

  // Filter companies by selected consultant
  useEffect(() => {
    if (!open) return;
    const loadFilteredCompanies = async () => {
      if (selectedConsultant === "all") {
        const { data } = await supabase.from("onboarding_companies").select("id, name").eq("status", "active").order("name");
        setCompanies(data || []);
      } else {
        const { data } = await supabase
          .from("onboarding_companies")
          .select("id, name")
          .eq("status", "active")
          .or(`consultant_id.eq.${selectedConsultant},cs_id.eq.${selectedConsultant}`)
          .order("name");
        setCompanies(data || []);
      }
      setSelectedCompany("all");
    };
    loadFilteredCompanies();
  }, [selectedConsultant, open]);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2026, i, 1);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ptBR }) };
  });

  const generateReport = async () => {
    setLoading(true);
    setReportReady(false);
    try {
      const monthDate = parse(selectedMonth, "yyyy-MM", new Date());
      const mStart = startOfMonth(monthDate);
      const mEnd = endOfMonth(monthDate);
      const mStartStr = format(mStart, "yyyy-MM-dd");
      const mEndStr = format(mEnd, "yyyy-MM-dd");

      // Find the project IDs matching filters
      let projectQuery = supabase
        .from("onboarding_projects")
        .select("id, onboarding_company_id, onboarding_companies(name), consultant:onboarding_staff!onboarding_projects_consultant_id_fkey(name)")
        .eq("status", "active");

      if (selectedCompany !== "all") {
        projectQuery = projectQuery.eq("onboarding_company_id", selectedCompany);
      }

      const { data: projects } = await projectQuery;
      if (!projects || projects.length === 0) {
        toast.error("Nenhum projeto encontrado com os filtros selecionados");
        setLoading(false);
        return;
      }

      // Filter by consultant if needed
      let filteredProjects = projects;
      if (selectedConsultant !== "all") {
        // Need to check consultant_id on company or project
        const { data: companyIds } = await supabase
          .from("onboarding_companies")
          .select("id")
          .or(`consultant_id.eq.${selectedConsultant},cs_id.eq.${selectedConsultant}`);
        const validCompanyIds = new Set((companyIds || []).map(c => c.id));
        filteredProjects = projects.filter(p => p.onboarding_company_id && validCompanyIds.has(p.onboarding_company_id));
      }

      if (filteredProjects.length === 0) {
        toast.error("Nenhum projeto encontrado com os filtros selecionados");
        setLoading(false);
        return;
      }

      const projectIds = filteredProjects.map(p => p.id);

      // Set report metadata
      if (selectedCompany !== "all") {
        const comp = companies.find(c => c.id === selectedCompany);
        setReportCompanyName(comp?.name || "");
      } else {
        setReportCompanyName("Todas as empresas");
      }
      if (selectedConsultant !== "all") {
        const cons = consultants.find(c => c.id === selectedConsultant);
        setReportConsultantName(cons?.name || "");
      } else {
        setReportConsultantName("Todos os consultores");
      }

      // Fetch tasks completed in the month
      const { data: tasksData } = await (supabase
        .from("onboarding_tasks")
        .select("title, status, due_date, completed_at, description, observations, responsible_staff:onboarding_staff!onboarding_tasks_responsible_staff_id_fkey(name), assignee:onboarding_users!onboarding_tasks_assignee_id_fkey(name)") as any)
        .in("project_id", projectIds)
        .eq("status", "completed")
        .gte("completed_at", mStartStr)
        .lte("completed_at", mEndStr + "T23:59:59")
        .order("completed_at", { ascending: true });

      const mappedTasks: TaskData[] = (tasksData || []).map((t: any) => ({
        title: t.title,
        status: t.status,
        due_date: t.due_date,
        completed_at: t.completed_at,
        description: t.description,
        responsible_staff_name: t.responsible_staff?.name || null,
        assignee_name: t.assignee?.name || null,
        observations: t.observations,
      }));

      // Fetch meetings in the month
      const { data: meetingsData } = await (supabase as any)
        .from("onboarding_meetings")
        .select("title, meeting_date, ai_summary, notes, is_finalized")
        .in("project_id", projectIds)
        .gte("meeting_date", mStartStr)
        .lte("meeting_date", mEndStr)
        .order("meeting_date", { ascending: true });

      const mappedMeetings: MeetingData[] = (meetingsData || []).map((m: any) => ({
        title: m.title,
        meeting_date: m.meeting_date,
        ai_summary: m.ai_summary,
        notes: m.notes,
        is_finalized: m.is_finalized,
      }));

      // Fetch KPI goals for the month - use correct field names
      const companyIds = filteredProjects.map(p => p.onboarding_company_id).filter(Boolean) as string[];
      
      let mappedGoals: GoalData[] = [];
      if (companyIds.length > 0) {
        // Get company-level KPIs (not individual salesperson KPIs)
        const { data: kpis } = await supabase
          .from("company_kpis")
          .select("id, name, kpi_type, target_value")
          .in("company_id", companyIds)
          .eq("is_active", true);

        const kpiList = kpis || [];
        const kpiIdList = kpiList.map(k => k.id);

        if (kpiIdList.length > 0) {
          // Fetch monthly targets using correct field name: month_year
          const { data: kpiTargets } = await supabase
            .from("kpi_monthly_targets")
            .select("kpi_id, target_value, level_name, level_order")
            .in("kpi_id", kpiIdList)
            .eq("month_year", mStartStr)
            .is("unit_id", null)
            .is("team_id", null)
            .is("sector_id", null)
            .is("salesperson_id", null);

          // Fetch actual entries for the month to calculate realized values
          const { data: entries } = await supabase
            .from("kpi_entries")
            .select("kpi_id, value, entry_date")
            .in("kpi_id", kpiIdList)
            .gte("entry_date", mStartStr)
            .lte("entry_date", mEndStr);

          // Aggregate actual values per KPI
          const actualByKpi: Record<string, number> = {};
          (entries || []).forEach((e: any) => {
            actualByKpi[e.kpi_id] = (actualByKpi[e.kpi_id] || 0) + (e.value || 0);
          });

          // Build targets map (use Base level target, or first available)
          const targetByKpi: Record<string, number> = {};
          (kpiTargets || []).forEach((t: any) => {
            // Prefer "Base" level or lowest level_order
            if (!targetByKpi[t.kpi_id] || t.level_order === 0 || t.level_name === 'Base') {
              targetByKpi[t.kpi_id] = t.target_value;
            }
          });

          mappedGoals = kpiList
            .filter(k => targetByKpi[k.id] || actualByKpi[k.id])
            .map(k => ({
              kpi_name: k.name,
              target_value: targetByKpi[k.id] || k.target_value || 0,
              actual_value: actualByKpi[k.id] !== undefined ? actualByKpi[k.id] : null,
              unit: k.kpi_type === 'monetary' ? 'R$' : null,
            }));
        }
      }


      setTasks(mappedTasks);
      setMeetings(mappedMeetings);
      setGoals(mappedGoals);
      setReportReady(true);
    } catch (err) {
      console.error("Error generating report:", err);
      toast.error("Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const monthLabel = format(parse(selectedMonth, "yyyy-MM", new Date()), "MMMM_yyyy", { locale: ptBR });
      pdf.save(`Relatorio_Executivo_${reportCompanyName.replace(/\s+/g, "_")}_${monthLabel}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try {
      return format(new Date(d), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return d;
    }
  };

  const monthLabel = format(parse(selectedMonth, "yyyy-MM", new Date()), "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          Relatório Mensal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Relatório Mensal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Consultor</Label>
              <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {consultants.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Empresa</Label>
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Mês</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={generateReport} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Gerar Relatório
            </Button>
            {reportReady && (
              <Button onClick={downloadPDF} disabled={generating} variant="outline" className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Baixar PDF
              </Button>
            )}
          </div>

          {reportReady && (
            <div className="border rounded-lg p-3 bg-muted/30 text-center text-sm text-muted-foreground">
              ✅ Relatório gerado com sucesso! Clique em "Baixar PDF" para fazer o download.
              <p className="text-xs mt-1">
                {tasks.length} tarefa(s) • {meetings.length} reunião(ões) • {goals.length} meta(s)
              </p>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Hidden full-size report for PDF generation */}
      {reportReady && (
        <div className="fixed left-[-9999px] top-0">
          <ReportContent
            ref={reportRef}
            monthLabel={monthLabel}
            companyName={reportCompanyName}
            consultantName={reportConsultantName}
            tasks={tasks}
            meetings={meetings}
            goals={goals}
            formatDate={formatDate}
          />
        </div>
      )}
    </Dialog>
  );
}

interface ReportContentProps {
  monthLabel: string;
  companyName: string;
  consultantName: string;
  tasks: TaskData[];
  meetings: MeetingData[];
  goals: GoalData[];
  formatDate: (d: string | null) => string;
}

import { forwardRef } from "react";

const ReportContent = forwardRef<HTMLDivElement, ReportContentProps>(
  ({ monthLabel, companyName, consultantName, tasks, meetings, goals, formatDate }, ref) => {
    return (
      <div ref={ref} className="bg-white text-slate-900 p-10" style={{ width: "794px", fontFamily: "system-ui, sans-serif" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#C41E3A] pb-4 mb-6">
          <div className="flex items-center gap-4">
            <img src={logoUnv} alt="Universidade Vendas" className="h-14" crossOrigin="anonymous" />
            <div>
              <h1 className="text-xl font-bold text-[#0f172a]">Relatório Mensal Executivo</h1>
              <p className="text-sm text-slate-500">Universidade Vendas</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-[#0f172a] capitalize">{monthLabel}</p>
            <p className="text-xs text-slate-500">Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Empresa:</span>{" "}
              <span className="font-semibold">{companyName}</span>
            </div>
            <div>
              <span className="text-slate-500">Consultor:</span>{" "}
              <span className="font-semibold">{consultantName}</span>
            </div>
          </div>
        </div>

        {/* Goals Section */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-[#0f172a] mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-[#C41E3A] rounded-full inline-block"></span>
            Metas do Mês ({goals.length})
          </h2>
          {goals.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Nenhuma meta registrada para este período.</p>
          ) : (
            <>
              {/* Visual Bar Chart - Meta vs Realizado */}
              <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">Meta vs Realizado</p>
                <div className="space-y-3">
                  {goals.map((g, i) => {
                    const pct = g.actual_value !== null && g.target_value > 0 ? Math.min(Math.round((g.actual_value / g.target_value) * 100), 150) : 0;
                    const achieved = g.actual_value !== null && g.actual_value >= g.target_value;
                    const barColor = achieved ? "#22c55e" : pct >= 70 ? "#eab308" : "#ef4444";
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-700 truncate max-w-[60%]">{g.kpi_name}</span>
                          <span className="text-xs font-bold" style={{ color: barColor }}>
                            {g.actual_value !== null ? `${pct}%` : "Pendente"}
                          </span>
                        </div>
                        <div className="relative h-5 bg-slate-200 rounded-full overflow-hidden">
                          {/* Meta line at 100% */}
                          <div className="absolute top-0 bottom-0 w-px bg-slate-500 z-10" style={{ left: `${Math.min(100 / 1.5, 100)}%` }} />
                          {/* Actual bar */}
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(pct / 1.5, 100)}%`,
                              backgroundColor: barColor,
                              minWidth: g.actual_value !== null && g.actual_value > 0 ? "8px" : "0",
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-0.5 text-[10px] text-slate-400">
                          <span>Realizado: {g.actual_value !== null ? g.actual_value.toLocaleString("pt-BR") : "—"} {g.unit || ""}</span>
                          <span>Meta: {g.target_value.toLocaleString("pt-BR")} {g.unit || ""}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Summary */}
                <div className="mt-4 pt-3 border-t border-slate-200 flex gap-6 text-xs">
                  <div>
                    <span className="text-slate-500">Total de metas: </span>
                    <span className="font-bold text-slate-700">{goals.length}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Atingidas: </span>
                    <span className="font-bold text-green-600">
                      {goals.filter(g => g.actual_value !== null && g.actual_value >= g.target_value).length}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Não atingidas: </span>
                    <span className="font-bold text-red-600">
                      {goals.filter(g => g.actual_value !== null && g.actual_value < g.target_value).length}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Pendentes: </span>
                    <span className="font-bold text-slate-500">
                      {goals.filter(g => g.actual_value === null).length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detail Table */}
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#0f172a] text-white">
                    <th className="text-left p-2 rounded-tl-md">Indicador</th>
                    <th className="text-right p-2">Meta</th>
                    <th className="text-right p-2">Realizado</th>
                    <th className="text-center p-2">%</th>
                    <th className="text-center p-2 rounded-tr-md">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {goals.map((g, i) => {
                    const achieved = g.actual_value !== null && g.actual_value >= g.target_value;
                    const pct = g.actual_value !== null && g.target_value > 0 ? Math.round((g.actual_value / g.target_value) * 100) : 0;
                    return (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="p-2 font-medium">{g.kpi_name}</td>
                        <td className="p-2 text-right">{g.target_value.toLocaleString("pt-BR")} {g.unit || ""}</td>
                        <td className="p-2 text-right">{g.actual_value !== null ? g.actual_value.toLocaleString("pt-BR") : "—"} {g.unit || ""}</td>
                        <td className="p-2 text-center font-semibold" style={{ color: achieved ? "#22c55e" : pct >= 70 ? "#eab308" : "#ef4444" }}>
                          {g.actual_value !== null ? `${pct}%` : "—"}
                        </td>
                        <td className="p-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${achieved ? "bg-green-100 text-green-700" : g.actual_value === null ? "bg-slate-100 text-slate-500" : "bg-red-100 text-red-700"}`}>
                            {g.actual_value === null ? "Pendente" : achieved ? "Atingida ✓" : "Não atingida"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Tasks Section */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-[#0f172a] mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-[#C41E3A] rounded-full inline-block"></span>
            Tarefas Realizadas ({tasks.length})
          </h2>
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Nenhuma tarefa concluída neste período.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-3 bg-white">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-[#0f172a]">{t.title}</p>
                      {t.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</p>
                      )}
                      {t.observations && (
                        <p className="text-xs text-slate-600 mt-1 italic">📝 {t.observations}</p>
                      )}
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-xs text-slate-500">Concluída em</p>
                      <p className="text-xs font-medium">{formatDate(t.completed_at)}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-slate-500">
                    {t.responsible_staff_name && <span>Responsável: <span className="font-medium text-slate-700">{t.responsible_staff_name}</span></span>}
                    {t.assignee_name && <span>Atribuído a: <span className="font-medium text-slate-700">{t.assignee_name}</span></span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Meetings Section */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-[#0f172a] mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-[#C41E3A] rounded-full inline-block"></span>
            Reuniões Realizadas ({meetings.length})
          </h2>
          {meetings.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Nenhuma reunião registrada neste período.</p>
          ) : (
            <div className="space-y-3">
              {meetings.map((m, i) => {
                // Extract first 2 sentences or max 150 chars for a short summary
                const rawSummary = m.ai_summary || m.notes || null;
                let truncatedSummary: string | null = null;
                if (rawSummary) {
                  // Take first 2 sentences
                  const sentences = rawSummary.split(/[.!?]\s+/).slice(0, 2).join('. ');
                  truncatedSummary = sentences.length > 150 ? sentences.substring(0, 150).trim() + "..." : sentences + (sentences.endsWith('.') ? '' : '.');
                }
                return (
                  <div key={i} className="border border-slate-200 rounded-lg p-3 bg-white">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-sm text-[#0f172a]">{m.title || "Reunião"}</p>
                      <p className="text-xs text-slate-500">{formatDate(m.meeting_date)}</p>
                    </div>
                    {truncatedSummary && (
                      <div className="bg-slate-50 rounded p-2 text-xs text-slate-700">
                        <p className="font-semibold text-slate-500 mb-1">Resumo:</p>
                        <p className="whitespace-pre-line">{truncatedSummary}</p>
                      </div>
                    )}
                    {!truncatedSummary && (
                      <p className="text-xs text-slate-400 italic">Sem resumo disponível</p>
                    )}
                    {!m.is_finalized && (
                      <p className="text-xs text-amber-600 mt-1">⚠ Reunião não finalizada</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t-2 border-[#C41E3A] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoUnv} alt="UNV" className="h-8 opacity-60" crossOrigin="anonymous" />
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Universidade Vendas. Todos os direitos reservados.
            </p>
          </div>
          <p className="text-xs text-slate-400">Documento confidencial</p>
        </div>
      </div>
    );
  }
);

ReportContent.displayName = "ReportContent";
