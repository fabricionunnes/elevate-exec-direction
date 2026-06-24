import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Star, Sparkles, FileText, Trash2, Brain, Copy, Mail, Phone, MapPin, Linkedin, ExternalLink, Target, Loader2, ThumbsUp, AlertTriangle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { PROFILE_PIPELINE_STAGES } from "./types";
import { getPublicBaseUrl } from "@/lib/publicDomain";
import {
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip as RTooltip,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";

const DISC_LABELS: Record<string, string> = { D: "Dominância", I: "Influência", S: "Estabilidade", C: "Conformidade" };
const scoreColor = (n: number) => (n >= 70 ? "#10b981" : n >= 45 ? "#f59e0b" : "#f43f5e");
const scoreBand = (n: number) => (n >= 70 ? "g" : n >= 45 ? "a" : "r");
const MEDALS: Record<number, { ring: string; label: string }> = {
  0: { ring: "from-amber-300 to-yellow-500", label: "🥇" },
  1: { ring: "from-slate-200 to-slate-400", label: "🥈" },
  2: { ring: "from-orange-300 to-amber-600", label: "🥉" },
};
const STAGE_STYLE: Record<string, { dot: string; head: string; text: string; bar: string }> = {
  applied: { dot: "bg-blue-500", head: "from-blue-500/15 to-transparent", text: "text-blue-400", bar: "bg-blue-500" },
  screening: { dot: "bg-indigo-500", head: "from-indigo-500/15 to-transparent", text: "text-indigo-400", bar: "bg-indigo-500" },
  test: { dot: "bg-violet-500", head: "from-violet-500/15 to-transparent", text: "text-violet-400", bar: "bg-violet-500" },
  hr_interview: { dot: "bg-purple-500", head: "from-purple-500/15 to-transparent", text: "text-purple-400", bar: "bg-purple-500" },
  manager_interview: { dot: "bg-fuchsia-500", head: "from-fuchsia-500/15 to-transparent", text: "text-fuchsia-400", bar: "bg-fuchsia-500" },
  juridico: { dot: "bg-cyan-500", head: "from-cyan-500/15 to-transparent", text: "text-cyan-400", bar: "bg-cyan-500" },
  offer: { dot: "bg-pink-500", head: "from-pink-500/15 to-transparent", text: "text-pink-400", bar: "bg-pink-500" },
  hired: { dot: "bg-emerald-500", head: "from-emerald-500/15 to-transparent", text: "text-emerald-400", bar: "bg-emerald-500" },
  rejected: { dot: "bg-rose-500", head: "from-rose-500/15 to-transparent", text: "text-rose-400", bar: "bg-rose-500" },
  talent_pool: { dot: "bg-amber-500", head: "from-amber-500/15 to-transparent", text: "text-amber-400", bar: "bg-amber-500" },
};
const DISC_COLORS: Record<string, string> = { D: "bg-rose-500", I: "bg-amber-500", S: "bg-emerald-500", C: "bg-blue-500" };

export default function UNVProfileRecruitmentPipelinePage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<any>(null);
  const [cands, setCands] = useState<any[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [discByCand, setDiscByCand] = useState<Record<string, any>>({});
  const [selected, setSelected] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [freshAnalysis, setFreshAnalysis] = useState<any>(null);
  const [instances, setInstances] = useState<any[]>([]);
  const [instanceId, setInstanceId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [view, setView] = useState<"pipeline" | "ranking">("pipeline");
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("id, display_name, instance_name, phone_number, status, is_default")
        .eq("status", "connected")
        .order("is_default", { ascending: false });
      const list = data || [];
      setInstances(list);
      const def = list.find((i: any) => i.is_default) || list[0];
      if (def) setInstanceId(def.id);
    })();
  }, []);

  const load = async () => {
    if (!jobId) return;
    const [j, c] = await Promise.all([
      supabase.from("profile_jobs").select("*").eq("id", jobId).maybeSingle(),
      supabase.from("profile_candidates").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
    ]);
    setJob(j.data);
    const list = c.data || [];
    setCands(list);
    const ids = list.map((x: any) => x.id);
    if (ids.length) {
      const { data: disc } = await supabase
        .from("profile_disc_results")
        .select("candidate_id,d_score,i_score,s_score,c_score,dominant,taken_at")
        .in("candidate_id", ids);
      const map: Record<string, any> = {};
      (disc || []).forEach((d: any) => { if (d.candidate_id) map[d.candidate_id] = d; });
      setDiscByCand(map);
    } else {
      setDiscByCand({});
    }
  };

  useEffect(() => { load(); }, [jobId]);

  const moveTo = async (candId: string, stage: string) => {
    const { error } = await supabase.from("profile_candidates").update({ stage }).eq("id", candId);
    if (error) return toast.error(error.message);
    setCands(prev => prev.map(c => c.id === candId ? { ...c, stage } : c));
  };

  const toggleFav = async (cand: any) => {
    const next = !cand.is_favorite;
    await supabase.from("profile_candidates").update({ is_favorite: next }).eq("id", cand.id);
    setCands(prev => prev.map(c => c.id === cand.id ? { ...c, is_favorite: next } : c));
    setSelected(prev => prev && prev.id === cand.id ? { ...prev, is_favorite: next } : prev);
  };

  const removeCand = async (cand: any) => {
    if (!confirm(`Excluir o candidato "${cand.full_name}"? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("profile_candidates").delete().eq("id", cand.id);
    if (error) return toast.error(error.message);
    toast.success("Candidato excluído");
    setSelected(null);
    load();
  };

  const discLink = (cand: any) => {
    const tenant = cand?.tenant_id || job?.tenant_id || "";
    const params = new URLSearchParams();
    if (tenant) params.set("tenant", tenant);
    params.set("candidate", cand.id);
    return `${getPublicBaseUrl()}/#/disc-publico?${params.toString()}`;
  };

  const copyDiscLink = (cand: any) => {
    navigator.clipboard.writeText(discLink(cand))
      .then(() => toast.success("Link do teste DISC copiado. Envie pro candidato."))
      .catch(() => toast.error("Não consegui copiar o link"));
  };

  const buildDiscMessage = (cand: any) => {
    const firstName = (cand.full_name || "").trim().split(" ")[0] || "";
    return `Olá ${firstName}! Aqui é da equipe do Fabrício Nunnes, da Universidade Nacional de Vendas. Recebemos sua candidatura para a vaga de ${job?.title || ""}. Para avançar no processo seletivo, faça seu teste de perfil comportamental DISC (leva ~7 min): ${discLink(cand)}`;
  };

  const analyze = async (cand: any) => {
    setAnalyzing(true);
    setFreshAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("profile-candidate-analyze", { body: { candidateId: cand.id } });
      if (error) throw error;
      const a = (data as any)?.analysis;
      if (!a) throw new Error("Sem retorno da análise");
      setFreshAnalysis(a);
      const patch = { ai_score: a.score, ai_summary: a.veredito, ai_strengths: a.pontos_fortes, ai_concerns: a.pontos_atencao };
      setSelected((prev: any) => prev && prev.id === cand.id ? { ...prev, ...patch } : prev);
      setCands(prev => prev.map(c => c.id === cand.id ? { ...c, ...patch } : c));
      toast.success("Análise concluída");
    } catch (e: any) {
      toast.error("Erro ao analisar: " + (e?.message || e));
    } finally {
      setAnalyzing(false);
    }
  };

  const sendDiscWhatsapp = async (cand: any) => {
    if (!instanceId) return toast.error("Selecione uma instância conectada");
    if (!cand.phone) return toast.error("Candidato sem telefone cadastrado");
    setSending(true);
    try {
      const msg = (waMessage || "").trim() || buildDiscMessage(cand);
      const { data, error } = await supabase.functions.invoke("profile-send-whatsapp", {
        body: { instanceId, phone: cand.phone, message: msg },
      });
      if (error) {
        let detail = error.message;
        try { const body = await (error as any).context?.json?.(); if (body?.error) detail = body.error; } catch { /* noop */ }
        throw new Error(detail);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Link do DISC enviado no WhatsApp");
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e?.message || e));
    } finally {
      setSending(false);
    }
  };

  const openCand = (c: any) => { setFreshAnalysis(null); setWaMessage(buildDiscMessage(c)); setSelected(c); };

  // perfil DISC ideal da vaga (0-100) e quanto o candidato bate com ele
  const target = job?.target_disc && typeof job.target_disc === "object" ? job.target_disc : null;
  const discMatch = (candId: string): number | null => {
    const d = discByCand[candId];
    if (!d || !target) return null;
    const diff = Math.abs((d.d_score || 0) - (target.D || 0)) + Math.abs((d.i_score || 0) - (target.I || 0)) +
      Math.abs((d.s_score || 0) - (target.S || 0)) + Math.abs((d.c_score || 0) - (target.C || 0));
    return Math.max(0, Math.min(100, Math.round(100 - diff / 4)));
  };
  const overall = (cand: any): number | null => {
    const ai = cand.ai_score != null ? Number(cand.ai_score) : null;
    const dm = discMatch(cand.id);
    if (ai != null && dm != null) return Math.round(ai * 0.6 + dm * 0.4);
    if (ai != null) return ai;
    if (dm != null) return dm;
    return null;
  };

  const ranking = cands
    .map((c) => ({ cand: c, ai: c.ai_score != null ? Number(c.ai_score) : null, dm: discMatch(c.id), overall: overall(c) }))
    .filter((r) => r.overall != null)
    .sort((a, b) => (b.overall as number) - (a.overall as number));

  const analyzeAll = async () => {
    if (!cands.length) return;
    setAnalyzingAll(true);
    setProgress({ done: 0, total: cands.length });
    try {
      for (let i = 0; i < cands.length; i++) {
        try {
          await supabase.functions.invoke("profile-candidate-analyze", { body: { candidateId: cands[i].id } });
        } catch { /* segue */ }
        setProgress({ done: i + 1, total: cands.length });
      }
      toast.success("Análise concluída para todos os candidatos");
      await load();
    } finally {
      setAnalyzingAll(false);
      setProgress(null);
    }
  };

  const disc = selected ? discByCand[selected.id] : null;
  const selMatch = selected ? discMatch(selected.id) : null;
  const radarData = (selected && disc && target)
    ? (["D", "I", "S", "C"] as const).map((k) => ({
        eixo: k, Candidato: disc[`${k.toLowerCase()}_score`] || 0, Vaga: target[k] || 0,
      }))
    : [];
  const recColors: Record<string, string> = { avancar: "bg-emerald-500", avaliar: "bg-amber-500", descartar: "bg-rose-500" };
  const recLabels: Record<string, string> = { avancar: "Avançar", avaliar: "Avaliar", descartar: "Descartar" };

  return (
    <div className="p-6 md:p-8 space-y-4">
      <Link to="/unv-profile/recruitment" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Vagas
      </Link>
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{job?.title || "Pipeline"}</h1>
          <p className="text-sm text-muted-foreground">{cands.length} candidatos • Clique para ver detalhes • Arraste entre colunas</p>
        </div>
        <div className="inline-flex rounded-lg border p-0.5 bg-muted/30">
          <Button variant={view === "pipeline" ? "default" : "ghost"} size="sm" onClick={() => setView("pipeline")}>Pipeline</Button>
          <Button variant={view === "ranking" ? "default" : "ghost"} size="sm" className="gap-1" onClick={() => setView("ranking")}>
            <Target className="w-4 h-4" />Ranking
          </Button>
        </div>
      </div>
      {view === "ranking" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              Nota geral = 60% aderência IA + 40% match do DISC com a vaga. {!target && "Defina o DISC ideal na vaga pra ativar o match."}
            </p>
            <Button size="sm" className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/20" disabled={analyzingAll || !cands.length} onClick={analyzeAll}>
              {analyzingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {analyzingAll && progress ? `Analisando ${progress.done}/${progress.total}` : "Analisar todos com IA"}
            </Button>
          </div>

          {ranking.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
              Nenhum candidato com nota ainda. Clique em "Analisar todos com IA" (e/ou colete o DISC) pra montar o ranking.
            </CardContent></Card>
          ) : (
            <>
              {/* KPIs resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Avaliados", value: `${ranking.length}/${cands.length}`, grad: "from-indigo-500/15 to-indigo-500/5", ring: "text-indigo-400", icon: <Target className="w-4 h-4" /> },
                  { label: "Melhor nota", value: `${ranking[0].overall}`, grad: "from-emerald-500/15 to-emerald-500/5", ring: "text-emerald-400", icon: <ThumbsUp className="w-4 h-4" /> },
                  { label: "Nota média", value: `${Math.round(ranking.reduce((s, r) => s + (r.overall as number), 0) / ranking.length)}`, grad: "from-amber-500/15 to-amber-500/5", ring: "text-amber-400", icon: <Sparkles className="w-4 h-4" /> },
                  { label: "Com DISC", value: `${ranking.filter(r => r.dm != null).length}`, grad: "from-fuchsia-500/15 to-fuchsia-500/5", ring: "text-fuchsia-400", icon: <Brain className="w-4 h-4" /> },
                ].map((k, i) => (
                  <div key={i} className={`rounded-xl border bg-gradient-to-br ${k.grad} p-4 backdrop-blur-sm`}>
                    <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider ${k.ring}`}>{k.icon}{k.label}</div>
                    <div className="text-2xl font-bold mt-1">{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Gráfico com profundidade */}
              <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-900/60 to-slate-800/30 shadow-xl">
                <CardContent className="p-4 md:p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ranking por nota geral</p>
                  <ResponsiveContainer width="100%" height={Math.max(180, ranking.length * 52)}>
                    <BarChart data={ranking.map(r => ({ nome: r.cand.full_name, nota: r.overall }))} layout="vertical" margin={{ left: 8, right: 36 }} barCategoryGap="22%">
                      <defs>
                        <linearGradient id="g-g" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6ee7b7" /><stop offset="45%" stopColor="#10b981" /><stop offset="100%" stopColor="#047857" />
                        </linearGradient>
                        <linearGradient id="g-a" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fcd34d" /><stop offset="45%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" />
                        </linearGradient>
                        <linearGradient id="g-r" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fda4af" /><stop offset="45%" stopColor="#f43f5e" /><stop offset="100%" stopColor="#be123c" />
                        </linearGradient>
                        <filter id="barShadow" x="-10%" y="-20%" width="130%" height="140%">
                          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.35" />
                        </filter>
                      </defs>
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11, fill: "#cbd5e1" }} axisLine={false} tickLine={false} />
                      <RTooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${v}`, "Nota geral"]} />
                      <Bar dataKey="nota" radius={[6, 10, 10, 6]} barSize={24} style={{ filter: "url(#barShadow)" }} label={{ position: "right", fontSize: 12, fontWeight: 700, fill: "#e2e8f0" }} isAnimationActive>
                        {ranking.map((r, i) => <Cell key={i} fill={`url(#g-${scoreBand(r.overall as number)})`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Lista premium */}
              <div className="space-y-2.5">
                {ranking.map((r, i) => {
                  const c = scoreColor(r.overall as number);
                  const medal = MEDALS[i];
                  return (
                    <div key={r.cand.id} onClick={() => openCand(r.cand)}
                      className="group relative cursor-pointer rounded-xl border bg-card/60 hover:bg-card transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
                      <span className="absolute left-0 top-0 h-full w-1.5" style={{ background: c }} />
                      <div className="flex items-center gap-3 p-3 pl-5">
                        {medal ? (
                          <div className={`flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br ${medal.ring} text-base shadow`}>{medal.label}</div>
                        ) : (
                          <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted font-bold text-muted-foreground">{i + 1}</div>
                        )}
                        <Avatar className="h-9 w-9 ring-2 ring-background"><AvatarFallback className="text-xs">{r.cand.full_name?.[0]}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{r.cand.full_name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-indigo-500/10 text-indigo-400 px-2 py-0.5"><Sparkles className="w-3 h-3" />IA {r.ai != null ? `${r.ai}%` : "—"}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-fuchsia-500/10 text-fuchsia-400 px-2 py-0.5"><Brain className="w-3 h-3" />DISC {r.dm != null ? `${r.dm}%` : "—"}</span>
                          </div>
                        </div>
                        <div className="relative flex items-center justify-center h-14 w-14 shrink-0">
                          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" className="text-border" strokeWidth="3" />
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round"
                              strokeDasharray={`${(r.overall as number) / 100 * 97.4} 97.4`} />
                          </svg>
                          <div className="text-center leading-none">
                            <div className="text-lg font-extrabold" style={{ color: c }}>{r.overall}</div>
                            <div className="text-[8px] text-muted-foreground uppercase">nota</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {view === "pipeline" && (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PROFILE_PIPELINE_STAGES.map(stage => {
          const list = cands.filter(c => c.stage === stage.key);
          const st = STAGE_STYLE[stage.key] || { dot: "bg-slate-500", head: "from-slate-500/15 to-transparent", text: "text-slate-400", bar: "bg-slate-500" };
          const isDrop = dragId != null;
          return (
            <div
              key={stage.key}
              className="min-w-[290px] w-[290px]"
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragId) moveTo(dragId, stage.key); setDragId(null); }}
            >
              <div className={`flex items-center justify-between mb-2 px-3 py-2 rounded-lg bg-gradient-to-r ${st.head} border-l-[3px]`} style={{ borderColor: "transparent" }}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${st.dot} shadow`} />
                  <p className={`text-xs font-bold uppercase tracking-wider ${st.text}`}>{stage.label}</p>
                </div>
                <span className={`flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold text-white ${st.bar}`}>{list.length}</span>
              </div>
              <div className={`space-y-2 min-h-[120px] rounded-xl p-2 transition-colors ${isDrop ? "bg-primary/5 ring-1 ring-dashed ring-primary/30" : "bg-muted/30"}`}>
                {list.map(c => {
                  const ov = overall(c);
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => openCand(c)}
                      className="group relative cursor-pointer rounded-xl border bg-card/70 hover:bg-card hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden"
                    >
                      {ov != null && <span className="absolute left-0 top-0 h-full w-1" style={{ background: scoreColor(ov) }} />}
                      <div className="p-3 pl-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <Avatar className="h-8 w-8 ring-2 ring-background"><AvatarFallback className="text-xs">{c.full_name?.[0]}</AvatarFallback></Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{c.full_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                          </div>
                          {ov != null && (
                            <div className="flex flex-col items-center justify-center h-9 w-9 rounded-lg shrink-0 text-white font-bold text-sm shadow" style={{ background: scoreColor(ov) }}>
                              {ov}
                            </div>
                          )}
                          <button className="self-start" onClick={(e) => { e.stopPropagation(); toggleFav(c); }}>
                            <Star className={`w-4 h-4 ${c.is_favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50 hover:text-amber-400"}`} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {c.ai_score != null && (
                            <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-indigo-500/10 text-indigo-400 px-2 py-0.5"><Sparkles className="w-3 h-3" />IA {c.ai_score}%</span>
                          )}
                          {discByCand[c.id] && (
                            <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-fuchsia-500/10 text-fuchsia-400 px-2 py-0.5"><Brain className="w-3 h-3" />{discByCand[c.id].dominant}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {list.length === 0 && <p className="text-[10px] text-center text-muted-foreground/60 py-6">Arraste candidatos aqui</p>}
              </div>
            </div>
          );
        })}
      </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader className="-mx-6 -mt-6 px-6 pt-6 pb-4 bg-gradient-to-br from-indigo-500/15 via-fuchsia-500/10 to-transparent border-b">
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 ring-2 ring-background shadow"><AvatarFallback className="bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">{selected.full_name?.[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{selected.full_name}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      Inscrito em {selected.created_at ? new Date(selected.created_at).toLocaleDateString("pt-BR") : "—"}
                      {selected.source ? ` • origem: ${selected.source}` : ""}
                    </div>
                  </div>
                  {overall(selected) != null && (
                    <div className="flex flex-col items-center justify-center h-12 w-12 rounded-xl shrink-0 text-white shadow-lg" style={{ background: scoreColor(overall(selected) as number) }}>
                      <span className="text-base font-extrabold leading-none">{overall(selected)}</span>
                      <span className="text-[8px] uppercase opacity-90">nota</span>
                    </div>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="space-y-1.5">
                  {selected.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{selected.email}</p>}
                  {selected.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{selected.phone}</p>}
                  {(selected.city || selected.state) && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" />{[selected.city, selected.state].filter(Boolean).join("/")}</p>}
                  {selected.linkedin_url && (
                    <p className="flex items-center gap-2">
                      <Linkedin className="w-4 h-4 text-muted-foreground" />
                      <a href={selected.linkedin_url} target="_blank" rel="noopener" className="text-primary underline truncate">{selected.linkedin_url}</a>
                    </p>
                  )}
                </div>

                {selected.cover_letter && (
                  <div>
                    <p className="font-semibold mb-1">Mensagem do candidato</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{selected.cover_letter}</p>
                  </div>
                )}

                <div>
                  <p className="font-semibold mb-1">Currículo</p>
                  {selected.resume_url ? (
                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <a href={selected.resume_url} target="_blank" rel="noopener"><FileText className="w-4 h-4" />Abrir currículo <ExternalLink className="w-3 h-3" /></a>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum currículo enviado.</p>
                  )}
                </div>

                <div>
                  <p className="font-semibold mb-1 flex items-center gap-2"><Brain className="w-4 h-4 text-primary" />Perfil DISC</p>
                  {disc ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        Dominante: <Badge className={`${DISC_COLORS[disc.dominant]} text-white`}>{disc.dominant} — {DISC_LABELS[disc.dominant]}</Badge>
                      </div>
                      {(["D", "I", "S", "C"] as const).map(k => (
                        <div key={k} className="flex items-center gap-2 text-xs">
                          <span className="w-24 text-muted-foreground">{DISC_LABELS[k]}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${DISC_COLORS[k]}`} style={{ width: `${disc[`${k.toLowerCase()}_score`] || 0}%` }} />
                          </div>
                          <span className="w-8 text-right font-medium">{disc[`${k.toLowerCase()}_score`] ?? 0}</span>
                        </div>
                      ))}

                      {target ? (
                        <div className="mt-2 pt-2 border-t">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold">Candidato x perfil da vaga</p>
                            {selMatch != null && (
                              <Badge style={{ backgroundColor: scoreColor(selMatch), color: "#fff" }}>{selMatch}% de match</Badge>
                            )}
                          </div>
                          <ResponsiveContainer width="100%" height={200}>
                            <RadarChart data={radarData} outerRadius={70}>
                              <PolarGrid />
                              <PolarAngleAxis dataKey="eixo" tick={{ fontSize: 11 }} />
                              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                              <Radar name="Vaga (ideal)" dataKey="Vaga" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                              <Radar name="Candidato" dataKey="Candidato" stroke="#10b981" fill="#10b981" fillOpacity={0.35} />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                            </RadarChart>
                          </ResponsiveContainer>
                          <p className="text-[11px] text-muted-foreground">Quanto mais as áreas se sobrepõem, mais o perfil dele bate com o que a vaga pede.</p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground mt-1">Defina o DISC ideal na vaga (editar vaga) pra ver o match.</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-muted-foreground">Candidato ainda não fez o teste DISC. Edite a mensagem se quiser e envie:</p>
                      <Textarea value={waMessage} onChange={(e) => setWaMessage(e.target.value)} rows={4} className="text-xs" placeholder="Mensagem a enviar" />
                      <div className="flex items-center gap-2 flex-wrap">
                        {instances.length > 0 && (
                          <Select value={instanceId} onValueChange={setInstanceId}>
                            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Instância" /></SelectTrigger>
                            <SelectContent>
                              {instances.map((i) => (
                                <SelectItem key={i.id} value={i.id} className="text-xs">
                                  {i.display_name || i.instance_name}{i.is_default ? " (padrão)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button variant="default" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={sending || !selected.phone || !instanceId} onClick={() => sendDiscWhatsapp(selected)}>
                          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                          Enviar no WhatsApp
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => copyDiscLink(selected)}>
                          <Copy className="w-4 h-4" />Copiar link
                        </Button>
                      </div>
                      {!selected.phone && <p className="text-[11px] text-amber-600">Candidato sem telefone — só dá pra copiar o link.</p>}
                      {instances.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhuma instância de WhatsApp conectada.</p>}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Aderência à vaga</p>
                    <Button variant="outline" size="sm" className="gap-2" disabled={analyzing} onClick={() => analyze(selected)}>
                      {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {selected.ai_score != null ? "Reanalisar" : "Analisar com IA"}
                    </Button>
                  </div>

                  {selected.ai_score != null ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${selected.ai_score >= 70 ? "bg-emerald-500" : selected.ai_score >= 45 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${selected.ai_score}%` }} />
                        </div>
                        <span className="text-sm font-bold">{selected.ai_score}%</span>
                        {freshAnalysis?.recomendacao && recLabels[freshAnalysis.recomendacao] && (
                          <Badge className={`${recColors[freshAnalysis.recomendacao]} text-white`}>{recLabels[freshAnalysis.recomendacao]}</Badge>
                        )}
                      </div>
                      {selected.ai_summary && <p className="text-xs text-muted-foreground">{selected.ai_summary}</p>}
                      {freshAnalysis?.fit_comportamental && (
                        <p className="text-xs flex items-start gap-1"><Brain className="w-3 h-3 mt-0.5 text-primary shrink-0" />{freshAnalysis.fit_comportamental}</p>
                      )}
                      {Array.isArray(selected.ai_strengths) && selected.ai_strengths.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mb-0.5"><ThumbsUp className="w-3 h-3" />Pontos fortes</p>
                          <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">{selected.ai_strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                        </div>
                      )}
                      {Array.isArray(selected.ai_concerns) && selected.ai_concerns.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-amber-600 flex items-center gap-1 mb-0.5"><AlertTriangle className="w-3 h-3" />Pontos de atenção</p>
                          <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">{selected.ai_concerns.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Rode a análise pra ver se o candidato bate com a vaga. A IA lê o currículo em PDF/imagem, cruza com os requisitos da vaga e com o DISC.</p>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <Button variant="ghost" size="sm" className="text-rose-500 gap-2" onClick={() => removeCand(selected)}>
                    <Trash2 className="w-4 h-4" />Excluir candidato
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleFav(selected)} className="gap-2">
                    <Star className={`w-4 h-4 ${selected.is_favorite ? "fill-amber-400 text-amber-400" : ""}`} />
                    {selected.is_favorite ? "Favorito" : "Favoritar"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
