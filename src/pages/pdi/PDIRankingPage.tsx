import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, Medal, TrendingUp } from "lucide-react";

interface RankingEntry {
  id: string;
  full_name: string;
  company: string | null;
  cohort_id: string;
  cohort_name: string;
  tasksCompleted: number;
  avgAiScore: number;
  entryScore: number | null;
  exitScore: number | null;
  evolution: number | null;
  attendancePoints: number;
  totalPoints: number;
}

export default function PDIRankingPage() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCohort, setFilterCohort] = useState("all");

  const fetchData = useCallback(async () => {
    const [partRes, cohRes, subsRes, respRes, assessRes, attendRes] = await Promise.all([
      supabase.from("pdi_participants").select("*").eq("status", "active"),
      supabase.from("pdi_cohorts").select("id, name"),
      supabase.from("pdi_task_submissions").select("participant_id, status, ai_score"),
      supabase.from("pdi_assessment_responses").select("participant_id, assessment_id, total_score"),
      supabase.from("pdi_assessments").select("id, assessment_type"),
      supabase.from("pdi_attendance").select("participant_id, is_present, points_awarded"),
    ]);

    const cohs = (cohRes.data as any[]) || [];
    setCohorts(cohs);
    const cMap = new Map(cohs.map((c) => [c.id, c.name]));
    const subs = (subsRes.data as any[]) || [];
    const resps = (respRes.data as any[]) || [];
    const assessments = (assessRes.data as any[]) || [];
    const attendances = (attendRes.data as any[]) || [];
    const entryIds = new Set(assessments.filter((a) => a.assessment_type === "entry").map((a) => a.id));
    const exitIds = new Set(assessments.filter((a) => a.assessment_type === "exit").map((a) => a.id));

    const entries: RankingEntry[] = ((partRes.data as any[]) || []).map((p) => {
      const pSubs = subs.filter((s) => s.participant_id === p.id);
      const completed = pSubs.filter((s) => s.status === "reviewed" || s.status === "completed").length;
      const aiScores = pSubs.filter((s) => s.ai_score != null).map((s) => Number(s.ai_score));
      const avgAi = aiScores.length > 0 ? aiScores.reduce((a, b) => a + b, 0) / aiScores.length : 0;

      const pResps = resps.filter((r) => r.participant_id === p.id);
      const entryResp = pResps.find((r) => entryIds.has(r.assessment_id));
      const exitResp = pResps.find((r) => exitIds.has(r.assessment_id));
      const entryScore = entryResp ? Number(entryResp.total_score) : null;
      const exitScore = exitResp ? Number(exitResp.total_score) : null;
      const evolution = entryScore != null && exitScore != null && entryScore > 0
        ? Math.round(((exitScore - entryScore) / entryScore) * 100) : null;

      // Points: tasks completed * 10 + avg AI score * 5 + evolution bonus
      const totalPoints = completed * 10 + Math.round(avgAi * 5) + (evolution != null && evolution > 0 ? evolution : 0);

      return {
        id: p.id, full_name: p.full_name, company: p.company,
        cohort_id: p.cohort_id, cohort_name: cMap.get(p.cohort_id) || "—",
        tasksCompleted: completed, avgAiScore: Math.round(avgAi * 10) / 10,
        entryScore, exitScore, evolution, totalPoints,
      };
    });

    entries.sort((a, b) => b.totalPoints - a.totalPoints);
    setRanking(entries);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = ranking.filter((r) => filterCohort === "all" || r.cohort_id === filterCohort);

  const getMedalIcon = (pos: number) => {
    if (pos === 0) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (pos === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (pos === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{pos + 1}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ranking de Desenvolvimento</h1>
          <p className="text-sm text-muted-foreground">Classificação baseada em desempenho</p>
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
        <div className="text-center text-muted-foreground py-12">Nenhum participante encontrado.</div>
      ) : (
        <div className="space-y-3">
          {/* Top 3 highlight */}
          {filtered.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {filtered.slice(0, 3).map((r, i) => (
                <Card key={r.id} className={`${i === 0 ? "border-amber-500/50 bg-amber-500/5" : ""}`}>
                  <CardContent className="p-4 text-center">
                    <div className="flex justify-center mb-2">{getMedalIcon(i)}</div>
                    <h3 className="font-bold text-sm text-foreground">{r.full_name}</h3>
                    <p className="text-xs text-muted-foreground">{r.cohort_name}</p>
                    <p className="text-lg font-bold text-primary mt-1">{r.totalPoints} pts</p>
                    <div className="flex justify-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">{r.tasksCompleted} tarefas</Badge>
                      {r.evolution != null && (
                        <Badge variant="outline" className="text-[10px] text-emerald-600">
                          <TrendingUp className="h-2 w-2 mr-0.5" />{r.evolution}%
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Full list */}
          {filtered.map((r, i) => (
            <Card key={r.id} className={`${i < 3 ? "border-primary/20" : ""}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 flex justify-center">{getMedalIcon(i)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-foreground">{r.full_name}</h3>
                      <span className="text-xs text-muted-foreground">{r.cohort_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{r.tasksCompleted} tarefas</span>
                      <span>IA: {r.avgAiScore}</span>
                      {r.evolution != null && <span className="text-emerald-600">Evolução: +{r.evolution}%</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{r.totalPoints}</p>
                    <p className="text-[10px] text-muted-foreground">pontos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
