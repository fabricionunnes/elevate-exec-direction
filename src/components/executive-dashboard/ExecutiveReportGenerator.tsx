import { useState, useRef, useEffect, forwardRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Download, Loader2, PackageOpen } from "lucide-react";
import JSZip from "jszip";
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
  ai_summary?: string | null;
  ai_alignments?: string[] | null;
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

const SUMMARY_KEYWORDS = /(alinh|acord|defin|meta|praz|próxim|acao|ação|estratég|resultado|plano|respons|decid|priorid|implement|encaminh)/i;
const SMALL_TALK_PATTERN = /^(oi|olá|ola|bom dia|boa tarde|boa noite|e aí|e ai|tudo bem|beleza|ok|show|perfeito|certo)\b/i;

const sanitizeMeetingText = (value: string): string =>
  value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\btactiq\.io\/\S*/gi, " ")
    .replace(/\b\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?(?:,\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)?\b/g, " ")
    .replace(/^\s*[A-Za-zÀ-ÿ0-9 _.'-]{2,60}:\s*/gm, "")
    .replace(/olá,\s*estou\s*transcrevendo[^.\n]*\.?/gi, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/[#>*_`~]/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const splitSentences = (value: string): string[] => {
  const normalized = sanitizeMeetingText(value)
    .replace(/\r?\n+/g, ". ")
    .replace(/\s*[•-]\s+/g, ". ")
    .replace(/\s*[;:]\s+/g, ". ")
    .replace(/\s+/g, " ");

  return (normalized.match(/[^.!?]+[.!?]?/g) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
};

const pickSummarySentences = (sentences: string[], maxCount = 3): string[] => {
  const scored = sentences
    .map((sentence, index) => {
      const sentenceLength = sentence.length;
      const keywordBoost = SUMMARY_KEYWORDS.test(sentence) ? 3 : 0;
      const smallTalkPenalty = SMALL_TALK_PATTERN.test(sentence.toLowerCase()) ? -4 : 0;
      const sizeBoost = sentenceLength >= 50 && sentenceLength <= 260 ? 2 : 0;
      const positionPenalty = index === 0 ? -1 : 0;

      return {
        sentence,
        index,
        score: keywordBoost + smallTalkPenalty + sizeBoost + positionPenalty,
      };
    })
    .filter((item) => item.sentence.length > 28)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxCount)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);

  if (scored.length > 0) return scored;

  return sentences.filter((sentence) => sentence.length > 28).slice(0, maxCount);
};

const extractMeetingBriefing = (meeting: MeetingData) => {
  if (meeting.ai_summary && meeting.ai_summary.trim().length > 0) {
    const summary = clampText(meeting.ai_summary.trim(), 460);
    const aiAlignments = (meeting.ai_alignments || [])
      .map((item) => clampText(sanitizeMeetingText(item).replace(/\s+/g, " "), 180))
      .filter((item) => item.length > 12)
      .slice(0, 3);

    return {
      summary,
      alignments:
        aiAlignments.length > 0
          ? aiAlignments
          : ["Manter acompanhamento dos combinados definidos na reunião."],
    };
  }

  let summarySource = "";
  let alignments: string[] = [];

  if (meeting.briefing_content) {
    try {
      const parsed = JSON.parse(meeting.briefing_content) as Record<string, unknown>;
      summarySource =
        normalizeText(parsed.report_summary) ||
        normalizeText(parsed.executive_summary) ||
        normalizeText(parsed.client_history) ||
        normalizeText(parsed.goal_status) ||
        normalizeText(parsed.pending_items);

      alignments = [
        ...normalizeList(parsed.report_alignments),
        ...normalizeList(parsed.talking_points),
        ...normalizeList(parsed.suggested_agenda),
        ...normalizeList(parsed.pending_items),
      ];
    } catch {
      const rawBriefing = normalizeText(meeting.briefing_content);
      summarySource = rawBriefing.startsWith("{") ? "" : rawBriefing;
    }
  }

  if (!summarySource) {
    const transcriptText = normalizeText(meeting.transcript);
    const notesText = normalizeText(meeting.notes);

    // Prioriza transcrição para gerar resumo real; usa notas quando não houver transcrição útil
    summarySource = transcriptText.length >= 120 ? transcriptText : notesText || transcriptText;
  }

  const sentenceCandidates = splitSentences(summarySource).filter((sentence) => !SMALL_TALK_PATTERN.test(sentence.toLowerCase()));
  const selectedSentences = pickSummarySentences(sentenceCandidates, 3);
  const summary = selectedSentences.length > 0
    ? clampText(selectedSentences.join(" "), 460)
    : "Resumo curto indisponível para esta reunião.";

  if (alignments.length === 0) {
    const alignmentSource = meeting.notes || meeting.transcript || summarySource;
    const alignmentCandidates = splitSentences(alignmentSource)
      .filter((item) => item.length > 30)
      .filter((item) => !SMALL_TALK_PATTERN.test(item.toLowerCase()));

    const prioritized = alignmentCandidates.filter((item) => SUMMARY_KEYWORDS.test(item));
    alignments = (prioritized.length > 0 ? prioritized : alignmentCandidates).slice(0, 3);
  }

  const normalizedAlignments = alignments
    .map((item) => clampText(sanitizeMeetingText(item).replace(/\s+/g, " "), 180))
    .filter((item) => item.length > 12 && item !== summary)
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
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; companyName: string } | null>(null);

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
      setSelectedCompanies([]);
    };
    loadFilteredCompanies();
  }, [selectedConsultant, open]);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2026, i, 1);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ptBR }) };
  });

  // ── Core data fetch for a single company (or all) ──
  const fetchReportData = async (companyId: string | null, consultantId: string | null) => {
    const monthDate = parse(selectedMonth, "yyyy-MM", new Date());
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);
    const mStartStr = format(mStart, "yyyy-MM-dd");
    const mEndStr = format(mEnd, "yyyy-MM-dd");

    let projectQuery = supabase
      .from("onboarding_projects")
      .select("id, onboarding_company_id, onboarding_companies(name), consultant:onboarding_staff!onboarding_projects_consultant_id_fkey(name)")
      .eq("status", "active");

    if (companyId) {
      projectQuery = projectQuery.eq("onboarding_company_id", companyId);
    }

    const { data: projects } = await projectQuery;
    if (!projects || projects.length === 0) return null;

    let filteredProjects = projects;
    if (consultantId) {
      const { data: companyIds } = await supabase
        .from("onboarding_companies")
        .select("id")
        .or(`consultant_id.eq.${consultantId},cs_id.eq.${consultantId}`);
      const validCompanyIds = new Set((companyIds || []).map(c => c.id));
      filteredProjects = projects.filter(p => p.onboarding_company_id && validCompanyIds.has(p.onboarding_company_id));
    }

    if (filteredProjects.length === 0) return null;

    const projectIds = filteredProjects.map(p => p.id);

    // Tasks
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

    // Meetings
    const { data: meetingsData } = await (supabase
      .from("onboarding_meeting_notes")
      .select(`id, meeting_title, subject, meeting_date, transcript, notes, is_finalized, onboarding_meeting_briefings (briefing_content)`) as any)
      .in("project_id", projectIds)
      .eq("is_finalized", true)
      .gte("meeting_date", `${mStartStr}T00:00:00`)
      .lte("meeting_date", `${mEndStr}T23:59:59`)
      .order("meeting_date", { ascending: true });

    const mappedMeetings: MeetingData[] = (meetingsData || []).map((m: any) => {
      const relation = m.onboarding_meeting_briefings;
      const briefingContent = Array.isArray(relation) ? relation[0]?.briefing_content || null : relation?.briefing_content || null;
      return {
        id: m.id, title: m.meeting_title, subject: m.subject, meeting_date: m.meeting_date,
        transcript: m.transcript, notes: m.notes, briefing_content: briefingContent,
        is_finalized: Boolean(m.is_finalized), ai_summary: null, ai_alignments: null,
      };
    });

    // Enrich with AI summaries
    const enrichedMeetings: MeetingData[] = [];
    for (const meeting of mappedMeetings) {
      const meetingText = (meeting.transcript || meeting.notes || "").trim();
      if (meetingText.length < 180) { enrichedMeetings.push(meeting); continue; }
      let hasCached = false;
      if (meeting.briefing_content) {
        try { hasCached = normalizeText(JSON.parse(meeting.briefing_content).report_summary).length > 0; } catch { hasCached = false; }
      }
      if (hasCached) { enrichedMeetings.push(meeting); continue; }
      try {
        const { data: summaryData, error } = await supabase.functions.invoke("summarize-meeting-transcription", { body: { meetingId: meeting.id } });
        if (error) { enrichedMeetings.push(meeting); continue; }
        enrichedMeetings.push({
          ...meeting,
          ai_summary: typeof summaryData?.summary === "string" ? summaryData.summary : null,
          ai_alignments: Array.isArray(summaryData?.alignments) ? summaryData.alignments.map(String).filter(Boolean) : null,
        });
      } catch { enrichedMeetings.push(meeting); }
    }

    // Goals
    const companyIds = filteredProjects.map(p => p.onboarding_company_id).filter(Boolean) as string[];
    let mappedGoals: GoalData[] = [];
    if (companyIds.length > 0) {
      const { data: kpis } = await supabase.from("company_kpis").select("id, name, kpi_type, target_value").in("company_id", companyIds).eq("is_active", true);
      const kpiList = kpis || [];
      const kpiIdList = kpiList.map(k => k.id);
      if (kpiIdList.length > 0) {
        const { data: kpiTargets } = await supabase.from("kpi_monthly_targets").select("kpi_id, target_value, level_name, level_order").in("kpi_id", kpiIdList).eq("month_year", mStartStr).is("unit_id", null).is("team_id", null).is("sector_id", null).is("salesperson_id", null);
        const { data: entries } = await supabase.from("kpi_entries").select("kpi_id, value, entry_date").in("kpi_id", kpiIdList).gte("entry_date", mStartStr).lte("entry_date", mEndStr);
        const actualByKpi: Record<string, number> = {};
        (entries || []).forEach((e: any) => { actualByKpi[e.kpi_id] = (actualByKpi[e.kpi_id] || 0) + (e.value || 0); });
        const targetByKpi: Record<string, number> = {};
        (kpiTargets || []).forEach((t: any) => { if (!targetByKpi[t.kpi_id] || t.level_order === 0 || t.level_name === 'Base') { targetByKpi[t.kpi_id] = t.target_value; } });
        mappedGoals = kpiList.filter(k => targetByKpi[k.id] || actualByKpi[k.id]).map(k => ({
          kpi_name: k.name, target_value: targetByKpi[k.id] || k.target_value || 0,
          actual_value: actualByKpi[k.id] !== undefined ? actualByKpi[k.id] : null,
          unit: k.kpi_type === 'monetary' ? 'R$' : null,
        }));
      }
    }

    const plannedNextSteps = buildNextSteps(mappedTasks, enrichedMeetings, mappedGoals);
    return { tasks: mappedTasks, meetings: enrichedMeetings, goals: mappedGoals, nextSteps: plannedNextSteps };
  };

  // ── Single report generation (existing behavior) ──
  const generateReport = async () => {
    setLoading(true);
    setReportReady(false);
    try {
      const consultantId = selectedConsultant !== "all" ? selectedConsultant : null;
      const companyId = selectedCompany !== "all" ? selectedCompany : null;

      const data = await fetchReportData(companyId, consultantId);
      if (!data) { toast.error("Nenhum projeto encontrado com os filtros selecionados"); setLoading(false); return; }

      if (selectedCompany !== "all") {
        setReportCompanyName(companies.find(c => c.id === selectedCompany)?.name || "");
      } else {
        setReportCompanyName("Todas as empresas");
      }
      setReportConsultantName(selectedConsultant !== "all" ? (consultants.find(c => c.id === selectedConsultant)?.name || "") : "Todos os consultores");

      setTasks(data.tasks);
      setMeetings(data.meetings);
      setGoals(data.goals);
      setNextSteps(data.nextSteps);
      setReportReady(true);
    } catch (err) {
      console.error("Error generating report:", err);
      toast.error("Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  };

  // ── Render current reportRef to PDF blob ──
  const renderCurrentReportToPDF = async (): Promise<Blob> => {
    if (!reportRef.current) throw new Error("Report ref not available");

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    const sectionGap = 3;
    let currentY = margin;

    const sections = Array.from(reportRef.current.querySelectorAll<HTMLElement>("[data-pdf-section='true']"));
    if (sections.length === 0) throw new Error("Nenhuma seção encontrada.");

    for (const section of sections) {
      const canvas = await html2canvas(section, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" });
      const pxPerMm = canvas.width / contentWidth;
      let renderedPx = 0;

      while (renderedPx < canvas.height) {
        if (pageHeight - margin - currentY < 10) { pdf.addPage(); currentY = margin; }
        const availablePx = Math.max(1, Math.floor((pageHeight - margin - currentY) * pxPerMm));
        const slicePx = Math.min(availablePx, canvas.height - renderedPx);
        const sliceHeightMm = slicePx / pxPerMm;
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = slicePx;
        const ctx = sliceCanvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context failed");
        ctx.drawImage(canvas, 0, renderedPx, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
        pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", margin, currentY, contentWidth, sliceHeightMm);
        renderedPx += slicePx;
        currentY += sliceHeightMm;
        if (renderedPx < canvas.height) { pdf.addPage(); currentY = margin; }
      }
      currentY += sectionGap;
      if (currentY > pageHeight - margin) { pdf.addPage(); currentY = margin; }
    }

    return pdf.output("blob");
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const blob = await renderCurrentReportToPDF();
      const safeCompanyName = reportCompanyName ? reportCompanyName.replace(/\s+/g, "_") : "geral";
      const fileMonthLabel = format(parse(selectedMonth, "yyyy-MM", new Date()), "MMMM_yyyy", { locale: ptBR });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Relatorio_Executivo_${safeCompanyName}_${fileMonthLabel}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  // ── Bulk download: one PDF per company → ZIP ──
  const downloadBulkPDFs = async () => {
    if (selectedCompanies.length === 0) {
      toast.error("Selecione pelo menos uma empresa");
      return;
    }

    setGenerating(true);
    const zip = new JSZip();
    const consultantId = selectedConsultant !== "all" ? selectedConsultant : null;
    const consultantName = selectedConsultant !== "all" ? (consultants.find(c => c.id === selectedConsultant)?.name || "") : "Todos os consultores";
    const fileMonthLabel = format(parse(selectedMonth, "yyyy-MM", new Date()), "MMMM_yyyy", { locale: ptBR });

    let successCount = 0;

    for (let i = 0; i < selectedCompanies.length; i++) {
      const companyId = selectedCompanies[i];
      const company = companies.find(c => c.id === companyId);
      const companyName = company?.name || "Empresa";

      setBulkProgress({ current: i + 1, total: selectedCompanies.length, companyName });

      try {
        const data = await fetchReportData(companyId, consultantId);
        if (!data) continue;

        // Set state so ReportContent renders this company's data
        setReportCompanyName(companyName);
        setReportConsultantName(consultantName);
        setTasks(data.tasks);
        setMeetings(data.meetings);
        setGoals(data.goals);
        setNextSteps(data.nextSteps);
        setReportReady(true);

        // Wait for React to render the updated content
        await new Promise(resolve => setTimeout(resolve, 500));

        const blob = await renderCurrentReportToPDF();
        const safeName = companyName.replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, "").replace(/\s+/g, "_");
        zip.file(`Relatorio_${safeName}_${fileMonthLabel}.pdf`, blob);
        successCount++;
      } catch (err) {
        console.error(`Erro ao gerar PDF para ${companyName}:`, err);
      }
    }

    setBulkProgress(null);

    if (successCount === 0) {
      toast.error("Nenhum relatório pôde ser gerado");
      setGenerating(false);
      return;
    }

    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Relatorios_Executivos_${fileMonthLabel}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${successCount} relatório(s) gerado(s) com sucesso!`);
    } catch (err) {
      console.error("Erro ao gerar ZIP:", err);
      toast.error("Erro ao gerar arquivo ZIP");
    } finally {
      setGenerating(false);
      setReportReady(false);
    }
  };

  const toggleCompanySelection = (companyId: string) => {
    setSelectedCompanies(prev =>
      prev.includes(companyId) ? prev.filter(id => id !== companyId) : [...prev, companyId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedCompanies.length === companies.length) {
      setSelectedCompanies([]);
    } else {
      setSelectedCompanies(companies.map(c => c.id));
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
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
          {/* Mode toggle */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/40 border border-border">
            <Button
              variant={!bulkMode ? "default" : "ghost"}
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              onClick={() => { setBulkMode(false); setSelectedCompanies([]); }}
            >
              <FileText className="h-3.5 w-3.5" />
              Individual
            </Button>
            <Button
              variant={bulkMode ? "default" : "ghost"}
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              onClick={() => { setBulkMode(true); setSelectedCompany("all"); }}
            >
              <PackageOpen className="h-3.5 w-3.5" />
              Em massa
            </Button>
          </div>

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
              {!bulkMode ? (
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
              ) : (
                <div className="space-y-1.5 col-span-1">
                  <Label className="text-xs">Empresas ({selectedCompanies.length} selecionada{selectedCompanies.length !== 1 ? "s" : ""})</Label>
                </div>
              )}

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

          {/* Multi-select companies list (bulk mode) */}
          {bulkMode && (
            <div className="border rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={toggleSelectAll}
              >
                <Checkbox
                  checked={selectedCompanies.length === companies.length && companies.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {selectedCompanies.length === companies.length ? "Desmarcar todas" : "Selecionar todas"} ({companies.length})
                </span>
              </div>
              <ScrollArea className="h-[180px]">
                <div className="divide-y divide-border">
                  {companies.map(c => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => toggleCompanySelection(c.id)}
                    >
                      <Checkbox
                        checked={selectedCompanies.includes(c.id)}
                        onCheckedChange={() => toggleCompanySelection(c.id)}
                      />
                      <span className="text-sm">{c.name}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {!bulkMode ? (
              <>
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
              </>
            ) : (
              <Button
                onClick={downloadBulkPDFs}
                disabled={generating || selectedCompanies.length === 0}
                className="gap-2"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageOpen className="h-4 w-4" />}
                {generating
                  ? bulkProgress
                    ? `Gerando ${bulkProgress.current}/${bulkProgress.total}...`
                    : "Finalizando ZIP..."
                  : `Baixar ${selectedCompanies.length} relatório(s) (ZIP)`}
              </Button>
            )}
          </div>

          {/* Progress indicator for bulk */}
          {bulkProgress && (
            <div className="border rounded-lg p-3 bg-muted/30 text-sm text-muted-foreground space-y-2">
              <div className="flex justify-between text-xs">
                <span>Gerando: <strong>{bulkProgress.companyName}</strong></span>
                <span>{bulkProgress.current}/{bulkProgress.total}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {reportReady && !bulkMode && !bulkProgress && (
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

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "#1a2744",
  letterSpacing: "0.02em",
  textTransform: "uppercase" as const,
  marginBottom: "14px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const sectionDot = (color: string): React.CSSProperties => ({
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  backgroundColor: color,
  display: "inline-block",
  flexShrink: 0,
});

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "10px",
  border: "1px solid #e8ecf1",
  padding: "16px 18px",
  marginBottom: "10px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  color: "#8793a6",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const ReportContent = forwardRef<HTMLDivElement, ReportContentProps>(
  ({ monthLabel, companyName, consultantName, tasks, meetings, goals, nextSteps, formatDate }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: "794px",
          fontFamily: "'Lora', Georgia, serif",
          lineHeight: 1.55,
          backgroundColor: "#f6f8fb",
          color: "#1a2744",
        }}
      >
        {/* ── HEADER ── */}
        <section data-pdf-section="true" style={{ position: "relative", overflow: "hidden" }}>
          {/* Red accent bar */}
          <div
            style={{
              height: "6px",
              background: "linear-gradient(90deg, #c5282e 0%, #e04347 60%, #f1767a 100%)",
            }}
          />
          <div
            style={{
              background: "linear-gradient(135deg, #1a2744 0%, #243556 100%)",
              padding: "28px 32px 24px",
              color: "#ffffff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <img
                  src={logoUnv}
                  alt="University Vendas"
                  style={{ height: "48px", filter: "brightness(0) invert(1)", opacity: 0.95 }}
                  crossOrigin="anonymous"
                />
                <div>
                  <h1
                    style={{
                      fontSize: "22px",
                      fontWeight: 700,
                      margin: 0,
                      letterSpacing: "0.01em",
                    }}
                  >
                    Relatório Mensal Executivo
                  </h1>
                  <p style={{ fontSize: "12px", margin: "4px 0 0", opacity: 0.7 }}>
                    University Vendas — Direção Comercial como Serviço
                  </p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    textTransform: "capitalize",
                    margin: 0,
                  }}
                >
                  {monthLabel}
                </p>
                <p style={{ fontSize: "10px", opacity: 0.6, margin: "3px 0 0" }}>
                  Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>

            {/* Summary strip */}
            <div
              style={{
                display: "flex",
                gap: "24px",
                marginTop: "20px",
                paddingTop: "16px",
                borderTop: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {[
                { label: "Empresa", value: companyName },
                { label: "Consultor", value: consultantName },
                { label: "Tarefas concluídas", value: String(tasks.length) },
                { label: "Reuniões", value: String(meetings.length) },
                { label: "Metas", value: String(goals.length) },
              ].map((item) => (
                <div key={item.label} style={{ flex: 1 }}>
                  <p style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.55, margin: 0 }}>
                    {item.label}
                  </p>
                  <p style={{ fontSize: "13px", fontWeight: 600, margin: "3px 0 0" }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── METAS DO MÊS ── */}
        <section data-pdf-section="true" style={{ padding: "24px 32px 8px" }}>
          <div style={sectionTitleStyle}>
            <span style={sectionDot("#c5282e")} />
            Metas do Mês
          </div>
          {goals.length === 0 ? (
            <div style={{ ...cardStyle, fontStyle: "italic", color: "#8793a6", fontSize: "13px" }}>
              Nenhuma meta registrada para este período.
            </div>
          ) : (
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {goals.map((goal, index) => {
                const pct =
                  goal.actual_value !== null && goal.target_value > 0
                    ? Math.min(Math.round((goal.actual_value / goal.target_value) * 100), 100)
                    : 0;
                const achieved = goal.actual_value !== null && goal.actual_value >= goal.target_value;
                const barColor = achieved ? "#22c55e" : pct >= 70 ? "#eab308" : "#c5282e";

                return (
                  <div
                    key={`${goal.kpi_name}-${index}`}
                    style={{
                      ...cardStyle,
                      flex: "1 1 calc(50% - 6px)",
                      minWidth: "280px",
                      borderLeft: `4px solid ${barColor}`,
                    }}
                  >
                    <p style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 6px", color: "#1a2744" }}>
                      {goal.kpi_name}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={labelStyle}>
                        Meta: {goal.target_value.toLocaleString("pt-BR")} {goal.unit || ""}
                      </span>
                      <span style={labelStyle}>
                        Realizado: {goal.actual_value !== null ? goal.actual_value.toLocaleString("pt-BR") : "—"} {goal.unit || ""}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div
                      style={{
                        height: "7px",
                        borderRadius: "4px",
                        backgroundColor: "#e8ecf1",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          borderRadius: "4px",
                          backgroundColor: barColor,
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                    <p
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: barColor,
                        margin: "6px 0 0",
                        textAlign: "right",
                      }}
                    >
                      {goal.actual_value !== null ? `${pct}%` : "Pendente"}{" "}
                      {achieved ? "✓ Meta atingida" : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── TAREFAS REALIZADAS ── */}
        <section data-pdf-section="true" style={{ padding: "16px 32px 8px" }}>
          <div style={sectionTitleStyle}>
            <span style={sectionDot("#3b82f6")} />
            Tarefas Realizadas
          </div>
          <p style={{ fontSize: "10px", color: "#8793a6", margin: "-8px 0 14px 18px" }}>
            Somente o que foi efetivamente concluído no período.
          </p>
        </section>

        {tasks.length === 0 ? (
          <section data-pdf-section="true" style={{ padding: "0 32px 16px" }}>
            <div style={{ ...cardStyle, fontStyle: "italic", color: "#8793a6", fontSize: "13px" }}>
              Nenhuma tarefa concluída neste período.
            </div>
          </section>
        ) : (
          tasks.map((task, index) => (
            <section key={`${task.title}-${index}`} data-pdf-section="true" style={{ padding: "0 32px 4px" }}>
              <div
                style={{
                  ...cardStyle,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "6px",
                    backgroundColor: "#dbeafe",
                    color: "#3b82f6",
                    fontSize: "12px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  ✓
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 4px", color: "#1a2744" }}>
                    {task.title}
                  </p>
                  <p style={{ fontSize: "10px", color: "#8793a6", margin: 0 }}>
                    Concluída em {formatDate(task.completed_at)} · Responsável: {task.responsible_staff_name || "—"} · Atribuído: {task.assignee_name || "—"}
                  </p>
                </div>
              </div>
            </section>
          ))
        )}

        {/* ── REUNIÕES REALIZADAS ── */}
        <section data-pdf-section="true" style={{ padding: "20px 32px 8px" }}>
          <div style={sectionTitleStyle}>
            <span style={sectionDot("#8b5cf6")} />
            Reuniões Realizadas
          </div>
          <p style={{ fontSize: "10px", color: "#8793a6", margin: "-8px 0 14px 18px" }}>
            Reuniões finalizadas com resumo baseado em transcrição e inteligência artificial.
          </p>
        </section>

        {meetings.length === 0 ? (
          <section data-pdf-section="true" style={{ padding: "0 32px 16px" }}>
            <div style={{ ...cardStyle, fontStyle: "italic", color: "#8793a6", fontSize: "13px" }}>
              Nenhuma reunião finalizada neste período.
            </div>
          </section>
        ) : (
          meetings.map((meeting) => {
            const briefing = extractMeetingBriefing(meeting);
            return (
              <section key={meeting.id} data-pdf-section="true" style={{ padding: "0 32px 4px" }}>
                <div
                  style={{
                    ...cardStyle,
                    borderLeft: "4px solid #8b5cf6",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, margin: 0, color: "#1a2744" }}>
                      {meeting.subject || meeting.title || "Reunião"}
                    </p>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        color: "#8b5cf6",
                        backgroundColor: "#ede9fe",
                        padding: "2px 10px",
                        borderRadius: "20px",
                      }}
                    >
                      {formatDate(meeting.meeting_date)}
                    </span>
                  </div>

                  <p style={{ ...labelStyle, marginBottom: "4px" }}>Resumo Executivo</p>
                  <p style={{ fontSize: "12px", color: "#374151", margin: "0 0 12px", lineHeight: 1.6 }}>
                    {briefing.summary}
                  </p>

                  <p style={{ ...labelStyle, marginBottom: "6px" }}>Principais Alinhamentos</p>
                  <div style={{ paddingLeft: "4px" }}>
                    {briefing.alignments.map((alignment, idx) => (
                      <div
                        key={`${meeting.id}-alignment-${idx}`}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                          marginBottom: "5px",
                        }}
                      >
                        <span
                          style={{
                            width: "5px",
                            height: "5px",
                            borderRadius: "50%",
                            backgroundColor: "#8b5cf6",
                            marginTop: "5px",
                            flexShrink: 0,
                          }}
                        />
                        <p style={{ fontSize: "12px", color: "#374151", margin: 0, lineHeight: 1.5 }}>
                          {alignment}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          })
        )}

        {/* ── PRÓXIMOS PASSOS ── */}
        <section data-pdf-section="true" style={{ padding: "20px 32px 8px" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #1a2744 0%, #2d4066 100%)",
              borderRadius: "10px",
              padding: "20px 24px",
              color: "#ffffff",
            }}
          >
            <div style={{ ...sectionTitleStyle, color: "#ffffff", marginBottom: "6px" }}>
              <span style={sectionDot("#f59e0b")} />
              Próximos Passos
            </div>
            <p style={{ fontSize: "10px", opacity: 0.6, margin: "0 0 14px 18px" }}>
              Direcionamentos recomendados com base nas entregas, reuniões e desempenho do período.
            </p>
            {nextSteps.map((step, index) => (
              <div
                key={`next-step-${index}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  marginBottom: "10px",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(245,158,11,0.2)",
                    border: "1.5px solid rgba(245,158,11,0.5)",
                    color: "#f59e0b",
                    fontSize: "11px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  {index + 1}
                </div>
                <p style={{ fontSize: "12px", margin: 0, lineHeight: 1.55, opacity: 0.92 }}>
                  {step}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER ── */}
        <section data-pdf-section="true" style={{ padding: "20px 32px 16px" }}>
          <div
            style={{
              borderTop: "2px solid #e8ecf1",
              paddingTop: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img src={logoUnv} alt="UNV" style={{ height: "24px", opacity: 0.5 }} crossOrigin="anonymous" />
              <p style={{ fontSize: "9px", color: "#8793a6", margin: 0 }}>
                © {new Date().getFullYear()} University Vendas. Documento confidencial e de uso interno.
              </p>
            </div>
            <p style={{ fontSize: "9px", color: "#8793a6", margin: 0 }}>
              Relatório gerado automaticamente
            </p>
          </div>
        </section>
      </div>
    );
  }
);

ReportContent.displayName = "ReportContent";
