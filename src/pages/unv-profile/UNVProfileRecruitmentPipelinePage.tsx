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
import { Input } from "@/components/ui/input";
import { ArrowLeft, Star, Sparkles, FileText, Trash2, Brain, Copy, Mail, Phone, MapPin, Linkedin, ExternalLink, Target, Loader2, ThumbsUp, AlertTriangle, MessageCircle, Scale, Search, Compass, Users, CheckCircle2, X } from "lucide-react";
import { CULTURE_PILLARS } from "@/data/cultureQuestions";
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
  approved: { dot: "bg-green-500", head: "from-green-500/15 to-transparent", text: "text-green-400", bar: "bg-green-500" },
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
  const [cultureByCand, setCultureByCand] = useState<Record<string, any>>({});
  const [selected, setSelected] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [freshAnalysis, setFreshAnalysis] = useState<any>(null);
  const [instances, setInstances] = useState<any[]>([]);
  const [instanceId, setInstanceId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [waCultureMessage, setWaCultureMessage] = useState("");
  const [ivForm, setIvForm] = useState<{ rh: string; rhNotes: string; mgr: string; mgrNotes: string }>({ rh: "", rhNotes: "", mgr: "", mgrNotes: "" });
  const [savingIv, setSavingIv] = useState(false);
  const [blockedByEmail, setBlockedByEmail] = useState<Record<string, string>>({});
  const [recruiterNotes, setRecruiterNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [editData, setEditData] = useState(false);
  const [dataForm, setDataForm] = useState<any>({});
  const [savingData, setSavingData] = useState(false);
  const [waApproval, setWaApproval] = useState("");
  const [view, setView] = useState<"pipeline" | "ranking">("pipeline");
  const [rkName, setRkName] = useState("");
  const [rkStage, setRkStage] = useState("all");
  const [rkDisc, setRkDisc] = useState("all");
  const [rkFit, setRkFit] = useState("0");
  const [rkNota, setRkNota] = useState("0");
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
    // Blocklist (segue a pessoa por email entre vagas)
    const emails = [...new Set(list.map((x: any) => (x.email || "").toLowerCase()).filter(Boolean))] as string[];
    if (emails.length) {
      const { data: bl } = await supabase.from("profile_candidate_blocklist").select("email,reason").in("email", emails);
      const bmap: Record<string, string> = {};
      (bl || []).forEach((b: any) => { bmap[(b.email || "").toLowerCase()] = b.reason || ""; });
      setBlockedByEmail(bmap);
    } else {
      setBlockedByEmail({});
    }
    const ids = list.map((x: any) => x.id);
    if (ids.length) {
      const [{ data: disc }, { data: culture }] = await Promise.all([
        supabase.from("profile_disc_results").select("candidate_id,d_score,i_score,s_score,c_score,dominant,taken_at").in("candidate_id", ids),
        supabase.from("profile_culture_results").select("candidate_id,pillar_scores,fit_score,ai_score,ai_summary,taken_at").in("candidate_id", ids).order("taken_at", { ascending: false }),
      ]);
      const dmap: Record<string, any> = {};
      (disc || []).forEach((d: any) => { if (d.candidate_id) dmap[d.candidate_id] = d; });
      setDiscByCand(dmap);
      const cmap: Record<string, any> = {};
      (culture || []).forEach((x: any) => { if (x.candidate_id && !cmap[x.candidate_id]) cmap[x.candidate_id] = x; });
      setCultureByCand(cmap);
    } else {
      setDiscByCand({});
      setCultureByCand({});
    }
  };

  useEffect(() => { load(); }, [jobId]);

  const moveTo = async (candId: string, stage: string) => {
    const { error } = await supabase.from("profile_candidates").update({ stage }).eq("id", candId);
    if (error) return toast.error(error.message);
    setCands(prev => prev.map(c => c.id === candId ? { ...c, stage } : c));
    setSelected((prev: any) => prev && prev.id === candId ? { ...prev, stage } : prev);
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

  // Link ÚNICO de avaliação: DISC + Fit Cultural em sequência (/avaliacao)
  const assessmentLink = (cand: any) => {
    const tenant = cand?.tenant_id || job?.tenant_id || "";
    const params = new URLSearchParams();
    if (tenant) params.set("tenant", tenant);
    params.set("candidate", cand.id);
    return `${getPublicBaseUrl()}/#/avaliacao-candidato?${params.toString()}`;
  };
  // aliases mantidos (DISC e Cultura usam o mesmo link combinado)
  const discLink = assessmentLink;
  const cultureLink = assessmentLink;

  const copyAssessmentLink = (cand: any) => {
    navigator.clipboard.writeText(assessmentLink(cand))
      .then(() => toast.success("Link da avaliação (DISC + cultural) copiado."))
      .catch(() => toast.error("Não consegui copiar o link"));
  };
  const copyDiscLink = copyAssessmentLink;
  const copyCultureLink = copyAssessmentLink;

  const buildAssessmentMessage = (cand: any) => {
    const firstName = (cand.full_name || "").trim().split(" ")[0] || "";
    return `Olá ${firstName}! Aqui é da equipe do Fabrício Nunnes, da Universidade Nacional de Vendas. Recebemos sua candidatura para a vaga de ${job?.title || ""}. Para avançar no processo, faça nossa avaliação — perfil comportamental (DISC) + fit cultural, num link só (leva ~12 min): ${assessmentLink(cand)}`;
  };
  const buildDiscMessage = buildAssessmentMessage;
  const buildCultureMessage = buildAssessmentMessage;

  // Link de cadastro de contratação (candidato preenche dados pra virar colaborador)
  const registrationLink = (cand: any) => {
    const tenant = cand?.tenant_id || job?.tenant_id || "";
    const params = new URLSearchParams();
    if (tenant) params.set("tenant", tenant);
    params.set("candidate", cand.id);
    return `${getPublicBaseUrl()}/#/cadastro-contratacao?${params.toString()}`;
  };
  const buildApprovalMessage = (cand: any) => {
    const firstName = (cand.full_name || "").trim().split(" ")[0] || "";
    return `*Parabéns, ${firstName}!* 🎉\n\nVocê foi *aprovado(a)* no processo seletivo da vaga de *${job?.title || ""}* na *Universidade Nacional de Vendas*.\n\nPra darmos início à sua contratação, preencha seu cadastro com os dados (CPF, CNPJ, endereço, conta PJ, PIX e foto):\n${registrationLink(cand)}\n\nQualquer dúvida, é só chamar. Seja bem-vindo(a) ao time! 🚀`;
  };
  const copyRegistrationLink = (cand: any) => navigator.clipboard.writeText(registrationLink(cand)).then(() => toast.success("Link de cadastro copiado")).catch(() => toast.error("Não consegui copiar"));
  const sendApprovalWhatsapp = (cand: any) => sendWhatsappMsg(cand, (waApproval || "").trim() || buildApprovalMessage(cand), "Mensagem de aprovação enviada");

  const saveData = async () => {
    if (!selected) return;
    setSavingData(true);
    const patch = {
      full_name: dataForm.full_name?.trim() || selected.full_name,
      email: dataForm.email?.trim() || null,
      phone: dataForm.phone?.trim() || null,
      cpf: dataForm.cpf?.trim() || null,
      cnpj: dataForm.cnpj?.trim() || null,
      address: dataForm.address?.trim() || null,
      neighborhood: dataForm.neighborhood?.trim() || null,
      city: dataForm.city?.trim() || null,
      state: dataForm.state?.trim() || null,
    };
    const { error } = await supabase.from("profile_candidates").update(patch).eq("id", selected.id);
    setSavingData(false);
    if (error) return toast.error(error.message);
    setSelected((prev: any) => prev && prev.id === selected.id ? { ...prev, ...patch } : prev);
    setCands(prev => prev.map(c => c.id === selected.id ? { ...c, ...patch } : c));
    setEditData(false);
    toast.success("Dados atualizados");
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

  const sendWhatsappMsg = async (cand: any, message: string, okMsg: string) => {
    if (!instanceId) return toast.error("Selecione uma instância conectada");
    if (!cand.phone) return toast.error("Candidato sem telefone cadastrado");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("profile-send-whatsapp", {
        body: { instanceId, phone: cand.phone, message: message.trim() },
      });
      if (error) {
        let detail = error.message;
        try { const body = await (error as any).context?.json?.(); if (body?.error) detail = body.error; } catch { /* noop */ }
        throw new Error(detail);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(okMsg);
      return true;
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e?.message || e));
      return false;
    } finally {
      setSending(false);
    }
  };
  // Funil principal (off-funnel: rejected, talent_pool). Só avança pra frente.
  const FUNNEL = ["applied", "screening", "test", "hr_interview", "manager_interview", "juridico", "offer", "approved", "hired"];
  const advanceTo = (cand: any, target: string) => {
    const cur = FUNNEL.indexOf(cand.stage);
    const tgt = FUNNEL.indexOf(target);
    if (cur >= 0 && tgt > cur) moveTo(cand.id, target);
  };
  const sendAssessmentWhatsapp = async (cand: any) => {
    const ok = await sendWhatsappMsg(cand, (waMessage || "").trim() || buildAssessmentMessage(cand), "Avaliação enviada no WhatsApp");
    if (ok) advanceTo(cand, "test");
  };

  const isBlocked = (cand: any) => !!blockedByEmail[(cand?.email || "").toLowerCase()];

  const saveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    const { error } = await supabase.from("profile_candidates").update({ recruiter_notes: recruiterNotes.trim() || null }).eq("id", selected.id);
    setSavingNotes(false);
    if (error) return toast.error(error.message);
    setSelected((prev: any) => prev && prev.id === selected.id ? { ...prev, recruiter_notes: recruiterNotes.trim() || null } : prev);
    setCands(prev => prev.map(c => c.id === selected.id ? { ...c, recruiter_notes: recruiterNotes.trim() || null } : c));
    toast.success("Observações salvas");
  };

  const toggleBlock = async (cand: any) => {
    const email = (cand?.email || "").toLowerCase();
    if (!email) return toast.error("Candidato sem e-mail — não dá pra bloquear (a tag segue pelo e-mail).");
    const currentlyBlocked = isBlocked(cand);
    if (currentlyBlocked) {
      const { error } = await supabase.from("profile_candidate_blocklist").delete().eq("email", email);
      if (error) return toast.error(error.message);
      setBlockedByEmail(prev => { const n = { ...prev }; delete n[email]; return n; });
      toast.success("Bloqueio removido");
    } else {
      const { error } = await supabase.from("profile_candidate_blocklist").upsert({
        email, full_name: cand.full_name || null, reason: blockReason.trim() || null, tenant_id: cand.tenant_id || job?.tenant_id || null,
      }, { onConflict: "email" });
      if (error) return toast.error(error.message);
      setBlockedByEmail(prev => ({ ...prev, [email]: blockReason.trim() }));
      toast.success("Marcado: não participar de mais vagas");
    }
  };

  const openCand = (c: any) => {
    setFreshAnalysis(null);
    setEditData(false);
    setDataForm({ full_name: c.full_name || "", email: c.email || "", phone: c.phone || "", cpf: c.cpf || "", cnpj: c.cnpj || "", address: c.address || "", neighborhood: c.neighborhood || "", city: c.city || "", state: c.state || "" });
    setWaApproval(buildApprovalMessage(c));
    setRecruiterNotes(c.recruiter_notes || "");
    setBlockReason(blockedByEmail[(c.email || "").toLowerCase()] || "");
    setWaMessage(buildDiscMessage(c));
    setWaCultureMessage(buildCultureMessage(c));
    setIvForm({
      rh: c.interview_rh_score != null ? String(c.interview_rh_score) : "",
      rhNotes: c.interview_rh_notes || "",
      mgr: c.interview_manager_score != null ? String(c.interview_manager_score) : "",
      mgrNotes: c.interview_manager_notes || "",
    });
    setSelected(c);
  };

  const setCadastral = async (status: "approved" | "rejected") => {
    if (!selected) return;
    const next = selected.cadastral_status === status ? null : status;
    // Aprovar -> avança pra Proposta; Reprovar -> move pra Reprovado.
    const patch: any = { cadastral_status: next };
    if (next === "approved") patch.stage = "offer";
    else if (next === "rejected") patch.stage = "rejected";
    const { error } = await supabase.from("profile_candidates").update(patch).eq("id", selected.id);
    if (error) return toast.error(error.message);
    setSelected((prev: any) => prev && prev.id === selected.id ? { ...prev, ...patch } : prev);
    setCands(prev => prev.map(c => c.id === selected.id ? { ...c, ...patch } : c));
    toast.success(next === "approved" ? "Aprovado — movido para Proposta" : next === "rejected" ? "Reprovado — movido para Reprovado" : "Status removido");
  };

  const saveInterviews = async () => {
    if (!selected) return;
    const clamp = (s: string) => { if (s === "") return null; const n = Math.max(0, Math.min(10, Number(s))); return Number.isFinite(n) ? n : null; };
    const patch = {
      interview_rh_score: clamp(ivForm.rh),
      interview_rh_notes: ivForm.rhNotes.trim() || null,
      interview_manager_score: clamp(ivForm.mgr),
      interview_manager_notes: ivForm.mgrNotes.trim() || null,
    };
    setSavingIv(true);
    const { error } = await supabase.from("profile_candidates").update(patch).eq("id", selected.id);
    setSavingIv(false);
    if (error) return toast.error(error.message);
    setSelected((prev: any) => prev && prev.id === selected.id ? { ...prev, ...patch } : prev);
    setCands(prev => prev.map(c => c.id === selected.id ? { ...c, ...patch } : c));
    toast.success("Notas das entrevistas salvas");
  };

  // perfil DISC ideal da vaga (0-100) e quanto o candidato bate com ele
  const target = job?.target_disc && typeof job.target_disc === "object" ? job.target_disc : null;
  const discMatch = (candId: string): number | null => {
    const d = discByCand[candId];
    if (!d || !target) return null;
    // Match afiado: erro ponderado por quanto a vaga valoriza cada eixo (quanto mais
    // longe de 50 o ideal, mais peso) + penalização maior pra erros grandes (RMSE).
    const axes = [
      { c: d.d_score || 0, t: target.D || 0 },
      { c: d.i_score || 0, t: target.I || 0 },
      { c: d.s_score || 0, t: target.S || 0 },
      { c: d.c_score || 0, t: target.C || 0 },
    ];
    let wSum = 0, wErr = 0;
    for (const a of axes) {
      const w = 1 + Math.abs(a.t - 50) / 50; // 1..2
      const diff = a.c - a.t;
      wErr += w * diff * diff;
      wSum += w;
    }
    const rmse = Math.sqrt(wErr / wSum); // 0..100
    return Math.max(0, Math.min(100, Math.round(100 - rmse)));
  };
  // fit cultural: combina o quiz (fit_score) com a IA da resposta aberta (ai_score)
  const cultureFit = (candId: string): number | null => {
    const k = cultureByCand[candId];
    if (!k) return null;
    const quiz = k.fit_score != null ? Number(k.fit_score) : null;
    const ai = k.ai_score != null ? Number(k.ai_score) : null;
    if (quiz != null && ai != null) return Math.round(quiz * 0.7 + ai * 0.3);
    return quiz ?? ai ?? null;
  };
  // Nota geral = média ponderada dos sinais presentes.
  // Ordem de impacto: Currículo (IA) > Fit Cultural > DISC > Entrevista Gestor > Entrevista RH.
  const WEIGHTS = { ai: 4, cultura: 3, disc: 2, gestor: 2, rh: 1.5 };
  const overall = (cand: any): number | null => {
    const parts: { v: number; w: number }[] = [];
    if (cand.ai_score != null) parts.push({ v: Number(cand.ai_score), w: WEIGHTS.ai });
    const cf = cultureFit(cand.id); if (cf != null) parts.push({ v: cf, w: WEIGHTS.cultura });
    const dm = discMatch(cand.id); if (dm != null) parts.push({ v: dm, w: WEIGHTS.disc });
    if (cand.interview_manager_score != null) parts.push({ v: Number(cand.interview_manager_score) * 10, w: WEIGHTS.gestor });
    if (cand.interview_rh_score != null) parts.push({ v: Number(cand.interview_rh_score) * 10, w: WEIGHTS.rh });
    if (!parts.length) return null;
    const totW = parts.reduce((s, p) => s + p.w, 0);
    return Math.round(parts.reduce((s, p) => s + p.v * p.w, 0) / totW);
  };

  const ranking = cands
    .map((c) => ({ cand: c, ai: c.ai_score != null ? Number(c.ai_score) : null, dm: discMatch(c.id), cf: cultureFit(c.id), rh: c.interview_rh_score, mgr: c.interview_manager_score, overall: overall(c) }))
    .filter((r) => r.overall != null)
    .sort((a, b) => (b.overall as number) - (a.overall as number));
  const filteredRanking = ranking.filter((r) =>
    (!rkName || r.cand.full_name?.toLowerCase().includes(rkName.toLowerCase())) &&
    (rkStage === "all" || r.cand.stage === rkStage) &&
    (rkDisc === "all" || discByCand[r.cand.id]?.dominant === rkDisc) &&
    ((r.overall ?? 0) >= Number(rkNota)) &&
    (Number(rkFit) === 0 || (r.cf != null && r.cf >= Number(rkFit)))
  );

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
  const kult = selected ? cultureByCand[selected.id] : null;
  const selCultureFit = selected ? cultureFit(selected.id) : null;
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
              Nota geral = média ponderada por impacto: Currículo (IA) &gt; Fit Cultural &gt; DISC &gt; Entrevista Gestor &gt; Entrevista RH. Usa os sinais que cada candidato tem. {!target && "Defina o DISC ideal na vaga pra ativar o match do DISC."}
            </p>
            <Button size="sm" className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/20" disabled={analyzingAll || !cands.length} onClick={analyzeAll}>
              {analyzingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {analyzingAll && progress ? `Analisando ${progress.done}/${progress.total}` : "Analisar todos com IA"}
            </Button>
          </div>

          {ranking.length > 0 && (
            <div className="flex items-end gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={rkName} onChange={(e) => setRkName(e.target.value)} placeholder="Buscar por nome" className="h-9 pl-8" />
              </div>
              <Select value={rkStage} onValueChange={setRkStage}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Etapa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as etapas</SelectItem>
                  {PROFILE_PIPELINE_STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={rkDisc} onValueChange={setRkDisc}>
                <SelectTrigger className="h-9 w-[120px]"><SelectValue placeholder="DISC" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">DISC: todos</SelectItem>
                  <SelectItem value="D">D — Dominância</SelectItem>
                  <SelectItem value="I">I — Influência</SelectItem>
                  <SelectItem value="S">S — Estabilidade</SelectItem>
                  <SelectItem value="C">C — Conformidade</SelectItem>
                </SelectContent>
              </Select>
              <Select value={rkFit} onValueChange={setRkFit}>
                <SelectTrigger className="h-9 w-[120px]"><SelectValue placeholder="Fit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Fit: todos</SelectItem>
                  <SelectItem value="70">Fit ≥ 70%</SelectItem>
                  <SelectItem value="50">Fit ≥ 50%</SelectItem>
                </SelectContent>
              </Select>
              <Select value={rkNota} onValueChange={setRkNota}>
                <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Nota" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Nota: todas</SelectItem>
                  <SelectItem value="70">Nota ≥ 70</SelectItem>
                  <SelectItem value="50">Nota ≥ 50</SelectItem>
                  <SelectItem value="40">Nota ≥ 40</SelectItem>
                </SelectContent>
              </Select>
              {(rkName || rkStage !== "all" || rkDisc !== "all" || rkFit !== "0" || rkNota !== "0") && (
                <Button variant="ghost" size="sm" onClick={() => { setRkName(""); setRkStage("all"); setRkDisc("all"); setRkFit("0"); setRkNota("0"); }}>Limpar</Button>
              )}
            </div>
          )}

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
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ranking por nota geral {filteredRanking.length !== ranking.length && `(${filteredRanking.length} de ${ranking.length})`}</p>
                  <ResponsiveContainer width="100%" height={Math.max(120, filteredRanking.length * 52)}>
                    <BarChart data={filteredRanking.map(r => ({ nome: r.cand.full_name, nota: r.overall }))} layout="vertical" margin={{ left: 8, right: 36 }} barCategoryGap="22%">
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
                        {filteredRanking.map((r, i) => <Cell key={i} fill={`url(#g-${scoreBand(r.overall as number)})`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Lista premium */}
              <div className="space-y-2.5">
                {filteredRanking.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum candidato com esse filtro.</CardContent></Card>
                )}
                {filteredRanking.map((r, i) => {
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
                            <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-teal-500/10 text-teal-400 px-2 py-0.5"><Compass className="w-3 h-3" />Cultura {r.cf != null ? `${r.cf}%` : "—"}</span>
                            {(r.rh != null || r.mgr != null) && (
                              <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-purple-500/10 text-purple-400 px-2 py-0.5"><Users className="w-3 h-3" />RH {r.rh != null ? r.rh : "—"} · Gestor {r.mgr != null ? r.mgr : "—"}</span>
                            )}
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
      <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 h-[calc(100vh-220px)] min-h-[420px]">
        {PROFILE_PIPELINE_STAGES.map(stage => {
          const list = cands.filter(c => c.stage === stage.key);
          const st = STAGE_STYLE[stage.key] || { dot: "bg-slate-500", head: "from-slate-500/15 to-transparent", text: "text-slate-400", bar: "bg-slate-500" };
          const isDrop = dragId != null;
          return (
            <div
              key={stage.key}
              className="min-w-[290px] w-[290px] flex flex-col h-full"
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragId) moveTo(dragId, stage.key); setDragId(null); }}
            >
              <div className={`flex items-center justify-between mb-2 px-3 py-2 rounded-lg bg-gradient-to-r ${st.head} border-l-[3px] shrink-0`} style={{ borderColor: "transparent" }}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${st.dot} shadow`} />
                  <p className={`text-xs font-bold uppercase tracking-wider ${st.text}`}>{stage.label}</p>
                </div>
                <span className={`flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold text-white ${st.bar}`}>{list.length}</span>
              </div>
              <div className={`space-y-2 flex-1 overflow-y-auto rounded-xl p-2 transition-colors ${isDrop ? "bg-primary/5 ring-1 ring-dashed ring-primary/30" : "bg-muted/30"}`}>
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
                          {cultureByCand[c.id] && (
                            <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-teal-500/10 text-teal-400 px-2 py-0.5"><Compass className="w-3 h-3" />{cultureFit(c.id)}%</span>
                          )}
                          {isBlocked(c) && (
                            <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-rose-500/15 text-rose-400 px-2 py-0.5"><X className="w-3 h-3" />Não participar</span>
                          )}
                          {c.cadastral_status === "approved" && (
                            <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-emerald-500/15 text-emerald-400 px-2 py-0.5"><CheckCircle2 className="w-3 h-3" />Cadastro OK</span>
                          )}
                          {c.cadastral_status === "rejected" && (
                            <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-rose-500/15 text-rose-400 px-2 py-0.5"><X className="w-3 h-3" />Reprovado</span>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden [&_*]:break-words">
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
                <div className="flex items-center gap-2 rounded-lg border p-2.5 bg-muted/30">
                  <span className="text-xs font-medium text-muted-foreground shrink-0">Etapa:</span>
                  <Select value={selected.stage} onValueChange={(v) => moveTo(selected.id, v)}>
                    <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROFILE_PIPELINE_STAGES.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          <span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${s.color}`} />{s.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Observações + bloqueio */}
                <div className={`rounded-lg border p-3 space-y-2 ${isBlocked(selected) ? "border-rose-500/40 bg-rose-500/5" : "bg-muted/20"}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" />Observações</p>
                    {isBlocked(selected) && <Badge className="bg-rose-500 text-white gap-1"><X className="w-3 h-3" />Não participar de vagas</Badge>}
                  </div>
                  <Textarea value={recruiterNotes} onChange={(e) => setRecruiterNotes(e.target.value)} rows={3} className="text-xs" placeholder="Anotações internas sobre o candidato (visível só pra equipe)" />
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={savingNotes} onClick={saveNotes}>
                    {savingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}Salvar observações
                  </Button>

                  <div className="pt-2 border-t mt-1 space-y-2">
                    <p className="text-xs font-medium">Não participar de mais vagas</p>
                    <p className="text-[11px] text-muted-foreground">A tag segue o candidato pelo e-mail — se ele se inscrever em outra vaga, você é avisado.</p>
                    {!isBlocked(selected) && (
                      <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="h-8 text-xs" placeholder="Motivo (opcional)" />
                    )}
                    {isBlocked(selected) && blockedByEmail[(selected.email || "").toLowerCase()] && (
                      <p className="text-[11px] text-rose-400">Motivo: {blockedByEmail[(selected.email || "").toLowerCase()]}</p>
                    )}
                    <Button size="sm" variant={isBlocked(selected) ? "outline" : "default"} className={`gap-1.5 ${isBlocked(selected) ? "" : "bg-rose-600 hover:bg-rose-700"}`} onClick={() => toggleBlock(selected)}>
                      {isBlocked(selected) ? <><CheckCircle2 className="w-4 h-4" />Liberar candidato</> : <><X className="w-4 h-4" />Bloquear de futuras vagas</>}
                    </Button>
                  </div>
                </div>

                {(!disc || !kult) && (
                  <div className="rounded-lg border p-3 space-y-2 bg-gradient-to-br from-emerald-500/10 to-transparent">
                    <p className="font-semibold flex items-center gap-2"><MessageCircle className="w-4 h-4 text-emerald-500" />Enviar avaliação (DISC + Fit Cultural)</p>
                    <p className="text-[11px] text-muted-foreground">
                      Um link só, com os dois testes em sequência. {disc && !kult ? "Falta o fit cultural." : !disc && kult ? "Falta o DISC." : "Faltam os dois testes."} Edite a mensagem se quiser.
                    </p>
                    <Textarea value={waMessage} onChange={(e) => setWaMessage(e.target.value)} rows={4} className="text-xs" placeholder="Mensagem a enviar" />
                    <div className="flex items-center gap-2 flex-wrap">
                      {instances.length > 0 && (
                        <Select value={instanceId} onValueChange={setInstanceId}>
                          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Instância" /></SelectTrigger>
                          <SelectContent>
                            {instances.map((i) => (
                              <SelectItem key={i.id} value={i.id} className="text-xs">{i.display_name || i.instance_name}{i.is_default ? " (padrão)" : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button variant="default" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={sending || !selected.phone || !instanceId} onClick={() => sendAssessmentWhatsapp(selected)}>
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}Enviar no WhatsApp
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => copyAssessmentLink(selected)}>
                        <Copy className="w-4 h-4" />Copiar link
                      </Button>
                    </div>
                    {!selected.phone && <p className="text-[11px] text-amber-600">Candidato sem telefone — só dá pra copiar o link.</p>}
                    {instances.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhuma instância de WhatsApp conectada.</p>}
                  </div>
                )}

                {selected.stage === "approved" && (
                  <div className="rounded-lg border p-3 space-y-2 bg-gradient-to-br from-green-500/10 to-transparent">
                    <p className="font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />Aprovado — enviar parabéns + cadastro</p>
                    <p className="text-[11px] text-muted-foreground">Mensagem de parabéns com o link de cadastro de contratação. Ao preencher, o candidato vira <strong>Contratado</strong> e entra como colaborador. (No WhatsApp, *texto entre asteriscos* fica em negrito.)</p>
                    <Textarea value={waApproval} onChange={(e) => setWaApproval(e.target.value)} rows={7} className="text-xs" placeholder="Mensagem de aprovação" />
                    <div className="flex items-center gap-2 flex-wrap">
                      {instances.length > 0 && (
                        <Select value={instanceId} onValueChange={setInstanceId}>
                          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Instância" /></SelectTrigger>
                          <SelectContent>
                            {instances.map((i) => (<SelectItem key={i.id} value={i.id} className="text-xs">{i.display_name || i.instance_name}{i.is_default ? " (padrão)" : ""}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button variant="default" size="sm" className="gap-2 bg-green-600 hover:bg-green-700" disabled={sending || !selected.phone || !instanceId} onClick={() => sendApprovalWhatsapp(selected)}>
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}Enviar no WhatsApp
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => copyRegistrationLink(selected)}><Copy className="w-4 h-4" />Copiar link</Button>
                    </div>
                    {!selected.phone && <p className="text-[11px] text-amber-600">Candidato sem telefone — só dá pra copiar o link.</p>}
                  </div>
                )}

                <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">Dados do candidato</p>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setEditData(v => !v)}>
                      {editData ? "Cancelar" : "Editar"}
                    </Button>
                  </div>
                  {!editData ? (
                    <div className="space-y-1.5">
                      {selected.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{selected.email}</p>}
                      {selected.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{selected.phone}</p>}
                      {(selected.city || selected.state || selected.address || selected.neighborhood) && (
                        <p className="flex items-start gap-2"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />{[selected.address, selected.neighborhood, [selected.city, selected.state].filter(Boolean).join("/")].filter(Boolean).join(" · ")}</p>
                      )}
                      {selected.cpf && <p className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" />CPF: {selected.cpf}</p>}
                      {selected.cnpj && <p className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" />CNPJ: {selected.cnpj}</p>}
                      {selected.linkedin_url && (
                        <p className="flex items-center gap-2"><Linkedin className="w-4 h-4 text-muted-foreground" /><a href={selected.linkedin_url} target="_blank" rel="noopener" className="text-primary underline truncate">{selected.linkedin_url}</a></p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Input className="h-8 text-xs col-span-2" placeholder="Nome completo" value={dataForm.full_name} onChange={e => setDataForm({ ...dataForm, full_name: e.target.value })} />
                      <Input className="h-8 text-xs" placeholder="E-mail" value={dataForm.email} onChange={e => setDataForm({ ...dataForm, email: e.target.value })} />
                      <Input className="h-8 text-xs" placeholder="Telefone" value={dataForm.phone} onChange={e => setDataForm({ ...dataForm, phone: e.target.value })} />
                      <Input className="h-8 text-xs" placeholder="CPF" value={dataForm.cpf} onChange={e => setDataForm({ ...dataForm, cpf: e.target.value })} />
                      <Input className="h-8 text-xs" placeholder="CNPJ" value={dataForm.cnpj} onChange={e => setDataForm({ ...dataForm, cnpj: e.target.value })} />
                      <Input className="h-8 text-xs col-span-2" placeholder="Endereço (rua, nº)" value={dataForm.address} onChange={e => setDataForm({ ...dataForm, address: e.target.value })} />
                      <Input className="h-8 text-xs" placeholder="Bairro" value={dataForm.neighborhood} onChange={e => setDataForm({ ...dataForm, neighborhood: e.target.value })} />
                      <Input className="h-8 text-xs" placeholder="Cidade" value={dataForm.city} onChange={e => setDataForm({ ...dataForm, city: e.target.value })} />
                      <Input className="h-8 text-xs" placeholder="Estado (UF)" value={dataForm.state} onChange={e => setDataForm({ ...dataForm, state: e.target.value })} />
                      <Button size="sm" className="col-span-2 gap-1.5" disabled={savingData} onClick={saveData}>
                        {savingData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}Salvar dados
                      </Button>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border p-3 space-y-2 bg-gradient-to-br from-cyan-500/10 to-transparent">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold flex items-center gap-2"><Scale className="w-4 h-4 text-cyan-500" />Análise Cadastral</p>
                    {selected.cadastral_status === "approved" && <Badge className="bg-emerald-500 text-white gap-1"><CheckCircle2 className="w-3 h-3" />Aprovado</Badge>}
                    {selected.cadastral_status === "rejected" && <Badge className="bg-rose-500 text-white gap-1"><X className="w-3 h-3" />Reprovado</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Consulta pública (1 clique) de processos do candidato — confira reclamações trabalhistas em que ele foi reclamante.{selected.cpf ? ` Use o CPF ${selected.cpf} pra confirmar a pessoa certa.` : " Sem CPF cadastrado — confira pelo nome (cuidado com homônimos)."}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <a href={`https://www.jusbrasil.com.br/busca?q=${encodeURIComponent(selected.full_name || "")}`} target="_blank" rel="noopener"><Scale className="w-3.5 h-3.5" />JusBrasil <ExternalLink className="w-3 h-3" /></a>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <a href={`https://www.escavador.com/busca?q=${encodeURIComponent(selected.full_name || "")}&qo=t`} target="_blank" rel="noopener"><Scale className="w-3.5 h-3.5" />Escavador <ExternalLink className="w-3 h-3" /></a>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(`"${selected.full_name || ""}" reclamação trabalhista`)}`} target="_blank" rel="noopener"><Search className="w-3.5 h-3.5" />Google <ExternalLink className="w-3 h-3" /></a>
                    </Button>
                    {selected.cpf && (
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(selected.cpf).then(() => toast.success("CPF copiado")); }}>
                        <Copy className="w-3.5 h-3.5" />Copiar CPF
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t mt-1">
                    <span className="text-[11px] text-muted-foreground">Resultado:</span>
                    <Button size="sm" variant={selected.cadastral_status === "approved" ? "default" : "outline"} className={`gap-1.5 ${selected.cadastral_status === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`} onClick={() => setCadastral("approved")}>
                      <CheckCircle2 className="w-4 h-4" />Aprovar
                    </Button>
                    <Button size="sm" variant={selected.cadastral_status === "rejected" ? "default" : "outline"} className={`gap-1.5 ${selected.cadastral_status === "rejected" ? "bg-rose-600 hover:bg-rose-700" : "text-rose-500"}`} onClick={() => setCadastral("rejected")}>
                      <X className="w-4 h-4" />Reprovar
                    </Button>
                  </div>
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
                    <p className="text-xs text-muted-foreground">Candidato ainda não fez o DISC — envie a avaliação acima.</p>
                  )}
                </div>

                <div className="rounded-lg border p-3 space-y-2 bg-gradient-to-br from-teal-500/10 to-transparent">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold flex items-center gap-2"><Compass className="w-4 h-4 text-teal-500" />Fit Cultural</p>
                    {selCultureFit != null && (
                      <Badge style={{ backgroundColor: scoreColor(selCultureFit), color: "#fff" }}>{selCultureFit}% de fit</Badge>
                    )}
                  </div>
                  {kult ? (
                    <div className="space-y-2">
                      {CULTURE_PILLARS.map((p) => {
                        const v = kult.pillar_scores?.[p.key] ?? 0;
                        return (
                          <div key={p.key} className="flex items-center gap-2 text-xs">
                            <span className="w-36 text-muted-foreground truncate" title={p.desc}>{p.label}</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full" style={{ width: `${v}%`, background: scoreColor(v) }} />
                            </div>
                            <span className="w-8 text-right font-medium">{v}</span>
                          </div>
                        );
                      })}
                      {kult.ai_summary && (
                        <p className="text-[11px] flex items-start gap-1 pt-1"><Sparkles className="w-3 h-3 mt-0.5 text-teal-500 shrink-0" />{kult.ai_summary}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Candidato ainda não fez o fit cultural — envie a avaliação acima.</p>
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

                <div className="rounded-lg border p-3 space-y-3 bg-gradient-to-br from-purple-500/10 to-transparent">
                  <p className="font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-purple-500" />Notas das entrevistas <span className="text-[11px] font-normal text-muted-foreground">(0 a 10)</span></p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Entrevista RH</label>
                      <Input type="number" min={0} max={10} step={0.5} value={ivForm.rh} onChange={(e) => setIvForm((f) => ({ ...f, rh: e.target.value }))} placeholder="—" className="h-8" />
                      <Textarea value={ivForm.rhNotes} onChange={(e) => setIvForm((f) => ({ ...f, rhNotes: e.target.value }))} rows={2} className="text-xs" placeholder="Observações do RH (opcional)" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Entrevista Gestor</label>
                      <Input type="number" min={0} max={10} step={0.5} value={ivForm.mgr} onChange={(e) => setIvForm((f) => ({ ...f, mgr: e.target.value }))} placeholder="—" className="h-8" />
                      <Textarea value={ivForm.mgrNotes} onChange={(e) => setIvForm((f) => ({ ...f, mgrNotes: e.target.value }))} rows={2} className="text-xs" placeholder="Observações do gestor (opcional)" />
                    </div>
                  </div>
                  <Button size="sm" className="gap-2" disabled={savingIv} onClick={saveInterviews}>
                    {savingIv ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Salvar notas
                  </Button>
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
