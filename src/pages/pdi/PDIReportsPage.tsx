import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Search, Download, TrendingUp, User } from "lucide-react";
import jsPDF from "jspdf";

interface ParticipantReport {
  id: string;
  full_name: string;
  email: string | null;
  company: string | null;
  cohort_id: string;
  cohort_name: string;
  tasksCompleted: number;
  totalTasks: number;
  entryScore: number | null;
  exitScore: number | null;
  evolution: number | null;
  avgAiScore: number | null;
}

export default function PDIReportsPage() {
  const [reports, setReports] = useState<ParticipantReport[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCohort, setFilterCohort] = useState("all");

  const fetchData = useCallback(async () => {
    const [participantsRes, cohortsRes, submissionsRes, responsesRes] = await Promise.all([
      supabase.from("pdi_participants").select("*").eq("status", "active"),
      supabase.from("pdi_cohorts").select("id, name"),
      supabase.from("pdi_task_submissions").select("participant_id, status, ai_score"),
      supabase.from("pdi_assessment_responses").select("participant_id, assessment_id, total_score"),
    ]);

    const cohortsList = (cohortsRes.data as any[]) || [];
    setCohorts(cohortsList);
    const cMap = new Map(cohortsList.map((c) => [c.id, c.name]));
    const submissions = (submissionsRes.data as any[]) || [];
    const responses = (responsesRes.data as any[]) || [];

    // Get assessments to know entry vs exit
    const { data: assessmentsData } = await supabase.from("pdi_assessments").select("id, assessment_type");
    const assessments = (assessmentsData as any[]) || [];
    const entryIds = new Set(assessments.filter((a) => a.assessment_type === "entry").map((a) => a.id));
    const exitIds = new Set(assessments.filter((a) => a.assessment_type === "exit").map((a) => a.id));

    const participants = (participantsRes.data as any[]) || [];
    const reportData: ParticipantReport[] = participants.map((p) => {
      const pSubs = submissions.filter((s) => s.participant_id === p.id);
      const completed = pSubs.filter((s) => s.status === "reviewed" || s.status === "completed").length;
      const aiScores = pSubs.filter((s) => s.ai_score != null).map((s) => Number(s.ai_score));
      const avgAi = aiScores.length > 0 ? aiScores.reduce((a, b) => a + b, 0) / aiScores.length : null;

      const pResponses = responses.filter((r) => r.participant_id === p.id);
      const entryResp = pResponses.find((r) => entryIds.has(r.assessment_id));
      const exitResp = pResponses.find((r) => exitIds.has(r.assessment_id));
      const entryScore = entryResp ? Number(entryResp.total_score) : null;
      const exitScore = exitResp ? Number(exitResp.total_score) : null;
      const evolution = entryScore != null && exitScore != null && entryScore > 0
        ? Math.round(((exitScore - entryScore) / entryScore) * 100) : null;

      return {
        id: p.id, full_name: p.full_name, email: p.email, company: p.company,
        cohort_id: p.cohort_id, cohort_name: cMap.get(p.cohort_id) || "—",
        tasksCompleted: completed, totalTasks: pSubs.length,
        entryScore, exitScore, evolution, avgAiScore: avgAi ? Math.round(avgAi * 10) / 10 : null,
      };
    });

    setReports(reportData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exportPDF = (report: ParticipantReport) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Relatório de Evolução PDI", 20, 20);
    doc.setFontSize(12);
    doc.text(`Participante: ${report.full_name}`, 20, 35);
    doc.text(`Empresa: ${report.company || "—"}`, 20, 43);
    doc.text(`Turma: ${report.cohort_name}`, 20, 51);
    doc.text("", 20, 60);
    doc.text(`Tarefas Concluídas: ${report.tasksCompleted}/${report.totalTasks}`, 20, 68);
    doc.text(`Score Entrada: ${report.entryScore ?? "—"}`, 20, 76);
    doc.text(`Score Saída: ${report.exitScore ?? "—"}`, 20, 84);
    doc.text(`Evolução: ${report.evolution != null ? `${report.evolution}%` : "—"}`, 20, 92);
    doc.text(`Nota Média IA: ${report.avgAiScore ?? "—"}`, 20, 100);
    doc.setFontSize(8);
    doc.text("Universidade Nacional de Vendas — PDI", 20, 280);
    doc.save(`relatorio-pdi-${report.full_name.replace(/\s+/g, "-")}.pdf`);
    toast.success("PDF exportado!");
  };

  const filtered = reports.filter((r) => {
    const matchSearch = r.full_name.toLowerCase().includes(search.toLowerCase());
    const matchCohort = filterCohort === "all" || r.cohort_id === filterCohort;
    return matchSearch && matchCohort;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios de Evolução</h1>
        <p className="text-sm text-muted-foreground">Acompanhe a evolução de cada participante</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar participante..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCohort} onValueChange={setFilterCohort}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas as turmas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as turmas</SelectItem>
            {cohorts.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Nenhum relatório disponível.</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{r.full_name}</h3>
                      <p className="text-xs text-muted-foreground">{r.cohort_name} {r.company && `• ${r.company}`}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => exportPDF(r)}>
                    <Download className="h-3 w-3 mr-1" />PDF
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Tarefas</p>
                    <p className="font-bold text-foreground">{r.tasksCompleted}/{r.totalTasks}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Score Entrada</p>
                    <p className="font-bold text-foreground">{r.entryScore ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Score Saída</p>
                    <p className="font-bold text-foreground">{r.exitScore ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Evolução</p>
                    <p className={`font-bold ${r.evolution != null && r.evolution > 0 ? "text-emerald-600" : "text-foreground"}`}>
                      {r.evolution != null ? `${r.evolution > 0 ? "+" : ""}${r.evolution}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Nota IA</p>
                    <p className="font-bold text-foreground">{r.avgAiScore ?? "—"}</p>
                  </div>
                </div>
                {r.totalTasks > 0 && (
                  <div className="mt-3">
                    <Progress value={(r.tasksCompleted / r.totalTasks) * 100} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
