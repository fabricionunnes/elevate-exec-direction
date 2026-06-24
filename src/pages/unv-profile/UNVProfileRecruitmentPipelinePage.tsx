import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      const firstName = (cand.full_name || "").trim().split(" ")[0] || "";
      const msg = `Olá ${firstName}! Recebemos sua candidatura para a vaga de ${job?.title || ""}. Para avançar no processo seletivo, faça seu teste de perfil comportamental DISC (leva ~7 min): ${discLink(cand)}`;
      const { data, error } = await supabase.functions.invoke("profile-send-whatsapp", {
        body: { instanceId, phone: cand.phone, message: msg },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success("Link do DISC enviado no WhatsApp");
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e?.message || e));
    } finally {
      setSending(false);
    }
  };

  const openCand = (c: any) => { setFreshAnalysis(null); setSelected(c); };

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
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              Nota geral = 60% aderência IA + 40% match do DISC com a vaga. {!target && "Defina o DISC ideal na vaga pra ativar o match."}
            </p>
            <Button size="sm" className="gap-2" disabled={analyzingAll || !cands.length} onClick={analyzeAll}>
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
              <Card>
                <CardContent className="p-4">
                  <ResponsiveContainer width="100%" height={Math.max(160, ranking.length * 46)}>
                    <BarChart data={ranking.map(r => ({ nome: r.cand.full_name, nota: r.overall }))} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11 }} />
                      <RTooltip formatter={(v: any) => [`${v}`, "Nota geral"]} />
                      <Bar dataKey="nota" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11 }}>
                        {ranking.map((r, i) => <Cell key={i} fill={scoreColor(r.overall as number)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="space-y-2">
                {ranking.map((r, i) => (
                  <Card key={r.cand.id} className="cursor-pointer hover:shadow-md transition" onClick={() => openCand(r.cand)}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <span className="w-6 text-center font-bold text-muted-foreground">{i + 1}</span>
                      <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{r.cand.full_name?.[0]}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.cand.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          IA: {r.ai != null ? `${r.ai}%` : "—"} • DISC match: {r.dm != null ? `${r.dm}%` : "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold" style={{ color: scoreColor(r.overall as number) }}>{r.overall}</div>
                        <div className="text-[10px] text-muted-foreground">nota geral</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {view === "pipeline" && (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PROFILE_PIPELINE_STAGES.map(stage => {
          const list = cands.filter(c => c.stage === stage.key);
          return (
            <div
              key={stage.key}
              className="min-w-[280px] w-[280px]"
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragId) moveTo(dragId, stage.key); setDragId(null); }}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${stage.color}`} />
                  <p className="text-xs font-semibold uppercase tracking-wider">{stage.label}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[120px] bg-muted/30 rounded-lg p-2">
                {list.map(c => (
                  <Card
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onClick={() => openCand(c)}
                    className="cursor-pointer hover:shadow-md transition"
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{c.full_name?.[0]}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.full_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); toggleFav(c); }}>
                          <Star className={`w-4 h-4 ${c.is_favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {c.ai_score != null && (
                          <div className="flex items-center gap-1 text-[10px]">
                            <Sparkles className="w-3 h-3 text-primary" />
                            <span className="font-semibold">{c.ai_score}%</span> aderência IA
                          </div>
                        )}
                        {discByCand[c.id] && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Brain className="w-3 h-3 text-primary" /> DISC: <span className="font-semibold">{discByCand[c.id].dominant}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {list.length === 0 && <p className="text-[10px] text-center text-muted-foreground py-4">Vazio</p>}
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
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10"><AvatarFallback>{selected.full_name?.[0]}</AvatarFallback></Avatar>
                  <div>
                    <div>{selected.full_name}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      Inscrito em {selected.created_at ? new Date(selected.created_at).toLocaleDateString("pt-BR") : "—"}
                      {selected.source ? ` • origem: ${selected.source}` : ""}
                    </div>
                  </div>
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
                      <p className="text-xs text-muted-foreground">Candidato ainda não fez o teste DISC. Envie o link:</p>
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
