import { useState, useRef, useEffect, forwardRef } from "react";
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
  completed_at: string | null;
  responsible_staff_name: string | null;
  assignee_name: string | null;
}

interface MeetingData {
  id: string;
  title: string | null;
  subject: string | null;
  meeting_date: string | null;
  transcript: string | null;
  notes: string | null;
  briefing_content: string | null;
  is_finalized: boolean;
}

interface GoalData {
  kpi_name: string;
  target_value: number;
  actual_value: number | null;
  unit: string | null;
}

const normalizeText = (value: unknown): string => {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(" ");
  return String(value).trim();
};

const normalizeList = (value: unknown): string[] => {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(/\r?\n|•|- /)
    .map((item) => item.trim())
    .filter(Boolean);
};

const clampText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
};

const sanitizeMeetingText = (value: string): string =>
  value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\btactiq\.io\/\S*/gi, " ")
    .replace(/\b\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?(?:,\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)?\b/g, " ")
    .replace(/^\s*[A-Za-zÀ-ÿ0-9 _.'-]{2,60}:\s*/gm, "")
    .replace(/olá,\s*estou\s*transcrevendo[^.\n]*\.?/gi, " ")
    .replace(/[#>*_`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitSentences = (value: string): string[] =>
  (value.match(/[^.!?]+[.!?]?/g) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const extractMeetingBriefing = (meeting: MeetingData) => {
  let summarySource = "";
  let alignments: string[] = [];

  if (meeting.briefing_content) {
    try {
      const parsed = JSON.parse(meeting.briefing_content) as Record<string, unknown>;
      summarySource =
        normalizeText(parsed.executive_summary) ||
        normalizeText(parsed.goal_status) ||
        normalizeText(parsed.pending_items);

      alignments = [
        ...normalizeList(parsed.talking_points),
        ...normalizeList(parsed.suggested_agenda),
      ];
    } catch {
      summarySource = meeting.briefing_content;
    }
  }

  if (!summarySource) {
    // Prioriza notas (normalmente mais úteis) antes da transcrição
    summarySource = meeting.notes || meeting.transcript || "";
  }

  const cleanedSource = sanitizeMeetingText(summarySource);
  const sentenceCandidates = splitSentences(cleanedSource).filter((sentence) => sentence.length > 25);
  const summaryFromSentences = sentenceCandidates.slice(0, 2).join(" ");

  const summary = summaryFromSentences
    ? clampText(summaryFromSentences, 320)
    : "Resumo curto indisponível para esta reunião.";

  if (alignments.length === 0) {
    const rawAlignmentSource = sanitizeMeetingText(meeting.notes || meeting.transcript || "");
    alignments = splitSentences(rawAlignmentSource)
      .filter((item) => item.length > 30)
      .slice(1, 4);
  }

  const normalizedAlignments = alignments
    .map((item) => clampText(sanitizeMeetingText(item), 160))
    .filter((item) => item.length > 10 && item !== summary)
    .slice(0, 3);

  return {
    summary,
    alignments:
      normalizedAlignments.length > 0
        ? normalizedAlignments
        : ["Manter acompanhamento dos combinados definidos na reunião."],
  };
};

const buildNextSteps = (tasks: TaskData[], meetings: MeetingData[], goals: GoalData[]): string[] => {
  const nextSteps: string[] = [];

  const pendingGoals = goals
    .filter((goal) => goal.actual_value === null || goal.actual_value < goal.target_value)
    .slice(0, 2);

  pendingGoals.forEach((goal) => {
    nextSteps.push(
      `Priorizar plano de recuperação do indicador ${goal.kpi_name} para atingir a meta de ${goal.target_value.toLocaleString("pt-BR")} ${goal.unit || ""}.`
    );
  });

  meetings.slice(0, 2).forEach((meeting) => {
    const briefing = extractMeetingBriefing(meeting);
    if (briefing.alignments[0]) {
      nextSteps.push(`Executar alinhamento: ${briefing.alignments[0]}`);
    }
  });

  if (tasks.length > 0) {
    nextSteps.push("Desdobrar as entregas concluídas em novas ações com responsáveis e prazos para o próximo ciclo.");
  }

  if (nextSteps.length === 0) {
    nextSteps.push("Manter rotina semanal de acompanhamento de metas, reuniões e execução operacional.");
  }

  return Array.from(new Set(nextSteps)).slice(0, 5);
};

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
  const [nextSteps, setNextSteps] = useState<string[]>([]);
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

      // Fetch only completed tasks (somente o que foi feito)
      const { data: tasksData } = await (supabase
        .from("onboarding_tasks")
        .select("title, completed_at, responsible_staff:onboarding_staff!onboarding_tasks_responsible_staff_id_fkey(name), assignee:onboarding_users!onboarding_tasks_assignee_id_fkey(name)") as any)
        .in("project_id", projectIds)
        .eq("status", "completed")
        .gte("completed_at", `${mStartStr}T00:00:00`)
        .lte("completed_at", `${mEndStr}T23:59:59`)
        .order("completed_at", { ascending: true });

      const mappedTasks: TaskData[] = (tasksData || []).map((t: any) => ({
        title: t.title,
        completed_at: t.completed_at,
        responsible_staff_name: t.responsible_staff?.name || null,
        assignee_name: t.assignee?.name || null,
      }));

      // Fetch only finalized meetings from project meetings menu + AI briefing content
      const { data: meetingsData, error: meetingsError } = await (supabase
        .from("onboarding_meeting_notes")
        .select(`
          id,
          meeting_title,
          subject,
          meeting_date,
          transcript,
          notes,
          is_finalized,
          onboarding_meeting_briefings (briefing_content)
        `) as any)
        .in("project_id", projectIds)
        .eq("is_finalized", true)
        .gte("meeting_date", `${mStartStr}T00:00:00`)
        .lte("meeting_date", `${mEndStr}T23:59:59`)
        .order("meeting_date", { ascending: true });

      if (meetingsError) {
        console.error("Erro ao buscar reuniões finalizadas:", meetingsError);
      }

      const mappedMeetings: MeetingData[] = (meetingsData || []).map((m: any) => {
        const relation = m.onboarding_meeting_briefings;
        const briefingContent = Array.isArray(relation)
          ? relation[0]?.briefing_content || null
          : relation?.briefing_content || null;

        return {
          id: m.id,
          title: m.meeting_title,
          subject: m.subject,
          meeting_date: m.meeting_date,
          transcript: m.transcript,
          notes: m.notes,
          briefing_content: briefingContent,
          is_finalized: Boolean(m.is_finalized),
        };
      });

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


      const plannedNextSteps = buildNextSteps(mappedTasks, mappedMeetings, mappedGoals);

      setTasks(mappedTasks);
      setMeetings(mappedMeetings);
      setGoals(mappedGoals);
      setNextSteps(plannedNextSteps);
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
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      const sectionGap = 3;
      let currentY = margin;

      const sections = Array.from(
        reportRef.current.querySelectorAll<HTMLElement>("[data-pdf-section='true']")
      );

      if (sections.length === 0) {
        throw new Error("Nenhuma seção do relatório encontrada para exportar.");
      }

      for (const section of sections) {
        const canvas = await html2canvas(section, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });

        const pxPerMm = canvas.width / contentWidth;
        let renderedPx = 0;

        while (renderedPx < canvas.height) {
          const remainingMm = pageHeight - margin - currentY;

          if (remainingMm < 10) {
            pdf.addPage();
            currentY = margin;
          }

          const availableMm = pageHeight - margin - currentY;
          const availablePx = Math.max(1, Math.floor(availableMm * pxPerMm));
          const slicePx = Math.min(availablePx, canvas.height - renderedPx);
          const sliceHeightMm = slicePx / pxPerMm;

          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = slicePx;
          const ctx = sliceCanvas.getContext("2d");

          if (!ctx) {
            throw new Error("Não foi possível renderizar a seção do relatório.");
          }

          ctx.drawImage(
            canvas,
            0,
            renderedPx,
            canvas.width,
            slicePx,
            0,
            0,
            canvas.width,
            slicePx
          );

          const imgData = sliceCanvas.toDataURL("image/png");
          pdf.addImage(imgData, "PNG", margin, currentY, contentWidth, sliceHeightMm);

          renderedPx += slicePx;
          currentY += sliceHeightMm;

          if (renderedPx < canvas.height) {
            pdf.addPage();
            currentY = margin;
          }
        }

        currentY += sectionGap;
        if (currentY > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }
      }

      const safeCompanyName = reportCompanyName ? reportCompanyName.replace(/\s+/g, "_") : "geral";
      const fileMonthLabel = format(parse(selectedMonth, "yyyy-MM", new Date()), "MMMM_yyyy", { locale: ptBR });
      pdf.save(`Relatorio_Executivo_${safeCompanyName}_${fileMonthLabel}.pdf`);
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
            nextSteps={nextSteps}
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
  nextSteps: string[];
  formatDate: (d: string | null) => string;
}

const ReportContent = forwardRef<HTMLDivElement, ReportContentProps>(
  ({ monthLabel, companyName, consultantName, tasks, meetings, goals, nextSteps, formatDate }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-background text-foreground p-10"
        style={{ width: "794px", fontFamily: "'Lora', Georgia, serif", lineHeight: 1.5 }}
      >
        <section data-pdf-section="true" className="mb-5 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
            <div className="flex items-center gap-4">
              <img src={logoUnv} alt="Universidade Vendas" className="h-14" crossOrigin="anonymous" />
              <div>
                <h1 className="text-xl font-bold text-foreground">Relatório Mensal Executivo</h1>
                <p className="text-sm text-muted-foreground">Universidade Vendas</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold capitalize text-foreground">{monthLabel}</p>
              <p className="text-xs text-muted-foreground">
                Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <p>
              <strong>Empresa:</strong> {companyName}
            </p>
            <p>
              <strong>Consultor:</strong> {consultantName}
            </p>
            <p>
              <strong>Tarefas concluídas:</strong> {tasks.length}
            </p>
            <p>
              <strong>Reuniões finalizadas:</strong> {meetings.length}
            </p>
          </div>
        </section>

        <section data-pdf-section="true" className="mb-5 rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold text-foreground mb-3">Metas do mês</h2>
          {goals.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">Nenhuma meta registrada para este período.</p>
          ) : (
            <div className="space-y-3">
              {goals.map((goal, index) => {
                const percentage =
                  goal.actual_value !== null && goal.target_value > 0
                    ? Math.round((goal.actual_value / goal.target_value) * 100)
                    : 0;
                const statusLabel =
                  goal.actual_value === null
                    ? "Pendente"
                    : goal.actual_value >= goal.target_value
                      ? "Meta atingida"
                      : "Abaixo da meta";

                return (
                  <div key={`${goal.kpi_name}-${index}`} className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="font-semibold text-sm text-foreground">{goal.kpi_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <strong>Meta:</strong> {goal.target_value.toLocaleString("pt-BR")} {goal.unit || ""} •{" "}
                      <strong>Realizado:</strong> {goal.actual_value !== null ? goal.actual_value.toLocaleString("pt-BR") : "—"} {goal.unit || ""}
                    </p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      <strong>Desempenho:</strong> {goal.actual_value !== null ? `${percentage}%` : "—"} ({statusLabel})
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section data-pdf-section="true" className="mb-3">
          <h2 className="text-lg font-bold text-foreground">Tarefas realizadas</h2>
          <p className="text-xs text-muted-foreground">Abaixo, somente o que foi efetivamente concluído no período.</p>
        </section>

        {tasks.length === 0 ? (
          <section data-pdf-section="true" className="mb-5 rounded-xl border border-border bg-card p-4">
            <p className="text-sm italic text-muted-foreground">Nenhuma tarefa concluída neste período.</p>
          </section>
        ) : (
          tasks.map((task, index) => (
            <section key={`${task.title}-${index}`} data-pdf-section="true" className="mb-3 rounded-xl border border-border bg-card p-4">
              <p className="font-semibold text-sm text-foreground">{task.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>Concluída em:</strong> {formatDate(task.completed_at)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>Responsável:</strong> {task.responsible_staff_name || "—"} • <strong>Atribuído a:</strong> {task.assignee_name || "—"}
              </p>
            </section>
          ))
        )}

        <section data-pdf-section="true" className="mb-3 mt-5">
          <h2 className="text-lg font-bold text-foreground">Reuniões realizadas</h2>
          <p className="text-xs text-muted-foreground">
            Reuniões finalizadas no menu de reuniões do projeto, com briefing curto baseado em transcrição/briefing.
          </p>
        </section>

        {meetings.length === 0 ? (
          <section data-pdf-section="true" className="mb-5 rounded-xl border border-border bg-card p-4">
            <p className="text-sm italic text-muted-foreground">Nenhuma reunião finalizada neste período.</p>
          </section>
        ) : (
          meetings.map((meeting) => {
            const briefing = extractMeetingBriefing(meeting);
            return (
              <section key={meeting.id} data-pdf-section="true" className="mb-3 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-semibold text-sm text-foreground">{meeting.subject || meeting.title || "Reunião"}</p>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(meeting.meeting_date)}</p>
                </div>

                <p className="text-xs text-muted-foreground mb-1 font-semibold">Briefing curto</p>
                <p className="text-sm text-foreground mb-3">{briefing.summary}</p>

                <p className="text-xs text-muted-foreground mb-1 font-semibold">Principais alinhamentos</p>
                <ul className="list-disc pl-4 space-y-1">
                  {briefing.alignments.map((alignment, index) => (
                    <li key={`${meeting.id}-alignment-${index}`} className="text-sm text-foreground">
                      {alignment}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}

        <section data-pdf-section="true" className="mb-5 rounded-xl border border-border bg-muted/30 p-5">
          <h2 className="text-lg font-bold text-foreground mb-2">Próximos passos (próximo mês)</h2>
          <p className="text-xs text-muted-foreground mb-2">
            Direcionamentos recomendados com base nas entregas, reuniões e desempenho do período.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            {nextSteps.map((step, index) => (
              <li key={`next-step-${index}`} className="text-sm text-foreground">
                <strong>Passo {index + 1}:</strong> {step}
              </li>
            ))}
          </ul>
        </section>

        <section data-pdf-section="true" className="pt-2 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoUnv} alt="UNV" className="h-8 opacity-70" crossOrigin="anonymous" />
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Universidade Vendas. Documento confidencial.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Relatório interno</p>
        </section>
      </div>
    );
  }
);

ReportContent.displayName = "ReportContent";
