import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Clock, CheckCircle2, Award, Play, ThumbsUp,
  HelpCircle, RefreshCw, AlertTriangle, ExternalLink, Video,
  KeyRound, Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";

// ── Helpers ────────────────────────────────────────────────────────────────
function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    // YouTube: watch?v= or youtu.be/ or /shorts/
    const ytMatch = url.match(
      /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`;
    // Vimeo: vimeo.com/12345
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0`;
    // Google Drive: /file/d/{id}/view or /open?id={id}
    const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/([^/?\s]+)|open\?id=([^&\s]+))/);
    const driveId = driveMatch?.[1] || driveMatch?.[2];
    if (driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
  } catch { /* noop */ }
  return null;
}

function isDriveUrl(url: string): boolean {
  return url.includes("drive.google.com");
}

function fmtDuration(mins: number): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ""}` : `${m}min`;
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Lesson {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_minutes: number;
  lesson_date: string | null;
  video_state: "live" | "recorded";
  track_id: string | null;
  position: number;
  status: string;
  meet_link: string | null;
  scheduled_at: string | null;
  checkin_code: string | null;
  min_watch_minutes: number;
}

// helpers
function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

interface Poll {
  id: string;
  question: string;
  options: string[];
  is_active: boolean;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  position: number;
}

interface Quiz {
  id: string;
  title: string;
  is_active: boolean;
  questions: QuizQuestion[];
}

// ── Page ───────────────────────────────────────────────────────────────────
const PeLessonPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [staffInfo, setStaffInfo] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollResponses, setPollResponses] = useState<Map<string, number>>(new Map());
  const [pollResults, setPollResults] = useState<Map<string, number[]>>(new Map());

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Map<string, number[]>>(new Map());
  const [quizSubmitted, setQuizSubmitted] = useState<Set<string>>(new Set());
  const [quizScores, setQuizScores] = useState<Map<string, { score: number; total: number }>>(new Map());

  const [trackName, setTrackName] = useState<string>("");
  const [pointsConfig, setPointsConfig] = useState<Map<string, number>>(new Map());

  // Timer for progress simulation
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // YouTube IFrame API
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const watchSecondsRef = useRef(0);
  const watchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check-in code
  const [checkinInput, setCheckinInput] = useState("");
  const [checkinError, setCheckinError] = useState("");
  const [checkinDone, setCheckinDone] = useState(false);

  useEffect(() => {
    load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/onboarding-tasks/login"); return; }

      const { data: staff } = await supabase.from("onboarding_staff")
        .select("id, name, email, role").eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (!staff) { navigate("/onboarding-tasks/login"); return; }
      setStaffInfo(staff);

      // Load lesson
      const { data: les, error: lesErr } = await supabase.from("pe_lessons").select("*").eq("id", id).maybeSingle();
      if (lesErr || !les) { toast.error("Aula não encontrada"); navigate("/ponto-de-encontro"); return; }
      setLesson(les);

      // Track name
      if (les.track_id) {
        const { data: tr } = await supabase.from("pe_tracks").select("title").eq("id", les.track_id).maybeSingle();
        if (tr) setTrackName(tr.title);
      }

      // Progress
      const { data: prog } = await supabase.from("pe_progress")
        .select("*").eq("staff_id", staff.id).eq("lesson_id", id).maybeSingle();
      if (prog) { setProgress(prog.percent_watched); setCompleted(prog.completed); }

      // Polls
      const { data: pollsData } = await supabase.from("pe_polls")
        .select("*").eq("lesson_id", id).eq("is_active", true);
      const parsedPolls: Poll[] = (pollsData || []).map((p: any) => ({
        ...p, options: Array.isArray(p.options) ? p.options : JSON.parse(p.options || "[]"),
      }));
      setPolls(parsedPolls);

      // Poll responses by this user
      if (parsedPolls.length > 0) {
        const pollIds = parsedPolls.map(p => p.id);
        const { data: myResponses } = await supabase.from("pe_poll_responses")
          .select("poll_id, option_index").eq("staff_id", staff.id).in("poll_id", pollIds);
        const respMap = new Map<string, number>();
        (myResponses || []).forEach((r: any) => respMap.set(r.poll_id, r.option_index));
        setPollResponses(respMap);

        // Poll results (all responses)
        const { data: allResponses } = await supabase.from("pe_poll_responses")
          .select("poll_id, option_index").in("poll_id", pollIds);
        const resultsMap = new Map<string, number[]>();
        for (const p of parsedPolls) {
          const counts = new Array(p.options.length).fill(0);
          (allResponses || []).filter((r: any) => r.poll_id === p.id)
            .forEach((r: any) => { if (r.option_index < counts.length) counts[r.option_index]++; });
          resultsMap.set(p.id, counts);
        }
        setPollResults(resultsMap);
      }

      // Quizzes
      const { data: quizzesData } = await supabase.from("pe_quizzes")
        .select("*").eq("lesson_id", id).eq("is_active", true);
      if (quizzesData?.length) {
        const quizIds = quizzesData.map((q: any) => q.id);
        const { data: questions } = await supabase.from("pe_quiz_questions")
          .select("*").in("quiz_id", quizIds).order("position");
        const parsedQuizzes: Quiz[] = quizzesData.map((q: any) => ({
          ...q,
          questions: (questions || [])
            .filter((qs: any) => qs.quiz_id === q.id)
            .map((qs: any) => ({ ...qs, options: Array.isArray(qs.options) ? qs.options : JSON.parse(qs.options || "[]") })),
        }));
        setQuizzes(parsedQuizzes);

        // Previous responses
        const { data: prevResponses } = await supabase.from("pe_quiz_responses")
          .select("quiz_id, answers, score, total").eq("staff_id", staff.id).in("quiz_id", quizIds);
        const submittedSet = new Set<string>();
        const scoresMap = new Map<string, { score: number; total: number }>();
        (prevResponses || []).forEach((r: any) => {
          submittedSet.add(r.quiz_id);
          scoresMap.set(r.quiz_id, { score: r.score, total: r.total });
        });
        setQuizSubmitted(submittedSet);
        setQuizScores(scoresMap);
      }

      // Points config
      const { data: pc } = await supabase.from("pe_points_config").select("*");
      const pcMap = new Map<string, number>();
      (pc || []).forEach((p: any) => pcMap.set(p.event_type, p.points));
      setPointsConfig(pcMap);

    } catch (err: any) { toast.error("Erro: " + err.message); }
    finally { setLoading(false); }
  };

  // ── YouTube IFrame API ────────────────────────────────────────────────
  useEffect(() => {
    const videoId = lesson?.video_url ? getYouTubeId(lesson.video_url) : null;
    if (!videoId || !lesson) return;

    const initPlayer = () => {
      if (!ytContainerRef.current || ytPlayerRef.current) return;
      ytPlayerRef.current = new (window as any).YT.Player(ytContainerRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, origin: window.location.origin },
        events: {
          onReady: () => startTimer(),
          onStateChange: (e: any) => {
            const YTState = (window as any).YT?.PlayerState;
            if (e.data === YTState?.PLAYING) {
              startTimer();
              if (!watchIntervalRef.current) {
                watchIntervalRef.current = setInterval(() => {
                  watchSecondsRef.current += 1;
                  checkYTAttendance();
                }, 1000);
              }
            } else {
              if (watchIntervalRef.current) {
                clearInterval(watchIntervalRef.current);
                watchIntervalRef.current = null;
              }
            }
          },
        },
      });
    };

    if ((window as any).YT?.Player) {
      initPlayer();
    } else {
      const prev = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => { prev?.(); initPlayer(); };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
    }

    return () => {
      if (watchIntervalRef.current) { clearInterval(watchIntervalRef.current); watchIntervalRef.current = null; }
      ytPlayerRef.current?.destroy?.();
      ytPlayerRef.current = null;
    };
  }, [lesson?.video_url]);

  const checkYTAttendance = useCallback(async () => {
    if (!lesson || completed) return;
    const minSecs = ((lesson.min_watch_minutes > 0
      ? lesson.min_watch_minutes
      : Math.ceil((lesson.duration_minutes || 0) * 0.5)) * 60);
    if (minSecs > 0 && watchSecondsRef.current >= minSecs) {
      if (watchIntervalRef.current) { clearInterval(watchIntervalRef.current); watchIntervalRef.current = null; }
      await saveProgress(100, true);
      setProgress(100);
      setCompleted(true);
      await onLessonComplete();
    }
  }, [lesson, completed]);

  // ── Check-in code ─────────────────────────────────────────────────────
  const submitCheckin = async () => {
    if (!lesson?.checkin_code) return;
    if (checkinInput.trim().toUpperCase() !== lesson.checkin_code.toUpperCase()) {
      setCheckinError("Código incorreto. Tente novamente.");
      return;
    }
    setCheckinError("");
    setCheckinDone(true);
    await saveProgress(100, true);
    setProgress(100);
    setCompleted(true);
    await onLessonComplete();
  };

  // ── Timer-based progress (simulates watching — 1% per (duration*0.6)s) ──
  const startTimer = useCallback(() => {
    if (completed || !lesson) return;
    if (timerRef.current) return;
    const totalSeconds = (lesson.duration_minutes || 1) * 60;
    const interval = Math.max(1000, (totalSeconds * 1000) / 100); // 1% per interval
    timerRef.current = setInterval(async () => {
      const cur = progressRef.current;
      if (cur >= 100) { clearInterval(timerRef.current!); return; }
      const next = Math.min(100, cur + 1);
      setProgress(next);
      // Save to DB every 10%
      if (next % 10 === 0 || next >= 90) {
        const isCompleted = next >= 90;
        await saveProgress(next, isCompleted);
        if (isCompleted && !completed) {
          setCompleted(true);
          clearInterval(timerRef.current!);
          timerRef.current = null;
          await onLessonComplete();
        }
      }
    }, interval);
  }, [lesson, completed]);

  const saveProgress = async (pct: number, isCompleted: boolean) => {
    if (!staffInfo || !id) return;
    await supabase.from("pe_progress").upsert({
      staff_id: staffInfo.id, lesson_id: id,
      percent_watched: pct, completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
      last_watched_at: new Date().toISOString(),
    }, { onConflict: "staff_id,lesson_id" });
  };

  const onLessonComplete = async () => {
    if (!staffInfo || !lesson) return;
    toast.success("🎉 Aula concluída! Certificado disponível.");

    // Award points
    const pts = pointsConfig.get("lesson_complete") || 50;
    await supabase.from("pe_points_log").insert({
      staff_id: staffInfo.id, event_type: "lesson_complete",
      reference_id: lesson.id, points: pts,
    });

    // Generate lesson certificate
    const code = Math.random().toString(36).substring(2, 14).toUpperCase();
    await supabase.from("pe_certificates").upsert({
      staff_id: staffInfo.id, lesson_id: lesson.id,
      track_id: null, cert_type: "lesson", code,
    }, { onConflict: "staff_id,lesson_id" }).select().maybeSingle();

    // Check if track complete
    if (lesson.track_id) {
      await checkTrackComplete(lesson.track_id);
    }
  };

  const checkTrackComplete = async (trackId: string) => {
    const { data: allLessons } = await supabase.from("pe_lessons")
      .select("id").eq("track_id", trackId).eq("status", "active");
    if (!allLessons?.length) return;
    const lessonIds = allLessons.map(l => l.id);
    const { data: completedLessons } = await supabase.from("pe_progress")
      .select("lesson_id").eq("staff_id", staffInfo.id).eq("completed", true).in("lesson_id", lessonIds);
    if ((completedLessons?.length || 0) >= lessonIds.length) {
      // All done
      toast.success("🏆 Trilha concluída! Certificado de trilha emitido!");
      const pts = pointsConfig.get("track_complete") || 200;
      await supabase.from("pe_points_log").insert({
        staff_id: staffInfo.id, event_type: "track_complete",
        reference_id: trackId, points: pts,
      });
      const code = Math.random().toString(36).substring(2, 14).toUpperCase();
      await supabase.from("pe_certificates").upsert({
        staff_id: staffInfo.id, lesson_id: null,
        track_id: trackId, cert_type: "track", code,
      }, { onConflict: "staff_id,track_id" }).select().maybeSingle();
    }
  };

  // ── Manual mark complete ───────────────────────────────────────────────
  const markComplete = async () => {
    setProgress(100);
    setCompleted(true);
    await saveProgress(100, true);
    await onLessonComplete();
  };

  // ── Poll response ──────────────────────────────────────────────────────
  const submitPollResponse = async (pollId: string, optionIndex: number) => {
    if (pollResponses.has(pollId)) return;
    try {
      await supabase.from("pe_poll_responses").insert({
        poll_id: pollId, staff_id: staffInfo.id, option_index: optionIndex,
      });
      // Award points
      const pts = pointsConfig.get("poll_response") || 10;
      await supabase.from("pe_points_log").insert({
        staff_id: staffInfo.id, event_type: "poll_response", reference_id: pollId, points: pts,
      });
      setPollResponses(prev => new Map(prev).set(pollId, optionIndex));
      // Update local results
      setPollResults(prev => {
        const map = new Map(prev);
        const cur = map.get(pollId) || [];
        const next = [...cur];
        next[optionIndex] = (next[optionIndex] || 0) + 1;
        return map.set(pollId, next);
      });
      toast.success(`+${pts} pontos pela enquete!`);
    } catch (err: any) { toast.error(err.message); }
  };

  // ── Quiz submit ────────────────────────────────────────────────────────
  const submitQuiz = async (quiz: Quiz) => {
    const answers = quizAnswers.get(quiz.id) || [];
    if (answers.length < quiz.questions.length) {
      toast.error("Responda todas as perguntas antes de enviar.");
      return;
    }
    let score = 0;
    quiz.questions.forEach((q, i) => {
      if (answers[i] === q.correct_index) score++;
    });
    try {
      await supabase.from("pe_quiz_responses").insert({
        quiz_id: quiz.id, staff_id: staffInfo.id,
        answers, score, total: quiz.questions.length,
      });
      // Award points
      const perCorrect = pointsConfig.get("quiz_correct") || 15;
      const completion = pointsConfig.get("quiz_complete") || 20;
      const totalPts = completion + score * perCorrect;
      await supabase.from("pe_points_log").insert({
        staff_id: staffInfo.id, event_type: "quiz_complete",
        reference_id: quiz.id, points: totalPts,
      });
      setQuizSubmitted(prev => new Set(prev).add(quiz.id));
      setQuizScores(prev => new Map(prev).set(quiz.id, { score, total: quiz.questions.length }));
      toast.success(`Quiz enviado! ${score}/${quiz.questions.length} acertos · +${totalPts} pontos`);
    } catch (err: any) { toast.error(err.message); }
  };

  // ── Certificate download — layout fiel ao modelo UNV ─────────────────
  const downloadCertificate = async (type: "lesson" | "track") => {
    if (!lesson || !staffInfo) return;

    const topic = type === "lesson" ? lesson.title : trackName;
    const duration = type === "lesson" ? fmtDuration(lesson.duration_minutes) : "";
    const studentName = staffInfo.name || staffInfo.email;
    const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const code = Math.random().toString(36).substring(2, 14).toUpperCase();

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, H = 210;

    // ── Cores ─────────────────────────────────────────────────────────────
    const NAVY  = [13, 43, 94]   as [number, number, number]; // #0D2B5E
    const RED   = [204, 27, 27]  as [number, number, number]; // #CC1B1B
    const WHITE = [255, 255, 255] as [number, number, number];
    const GRAY  = [80, 80, 80]   as [number, number, number];

    // ── Fundo branco ──────────────────────────────────────────────────────
    doc.setFillColor(...WHITE);
    doc.rect(0, 0, W, H, "F");

    // ── Cantos decorativos ────────────────────────────────────────────────
    // Função helper para triângulo preenchido
    const fillTriangle = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: [number, number, number]) => {
      doc.setFillColor(...color);
      doc.setDrawColor(...color);
      doc.lines([[x2 - x1, y2 - y1], [x3 - x2, y3 - y2], [x1 - x3, y1 - y3]], x1, y1, [1, 1], "FD", true);
    };

    const C = 52; // tamanho dos cantos

    // Topo-esquerdo: azul (camada maior + menor)
    fillTriangle(0, 0, C + 8, 0, 0, C + 8, NAVY);
    fillTriangle(0, 0, C - 4, 0, 0, C - 4, WHITE); // recorte para criar efeito de moldura

    // Topo-direito: vermelho
    fillTriangle(W - C - 8, 0, W, 0, W, C + 8, RED);
    fillTriangle(W - C + 4, 0, W, 0, W, C - 4, WHITE);

    // Baixo-esquerdo: vermelho
    fillTriangle(0, H - C - 8, C + 8, H, 0, H, RED);
    fillTriangle(0, H - C + 4, C - 4, H, 0, H, WHITE);

    // Baixo-direito: azul
    fillTriangle(W - C - 8, H, W, H - C - 8, W, H, NAVY);
    fillTriangle(W - C + 4, H, W, H - C + 4, W, H, WHITE);

    // ── Borda dupla ───────────────────────────────────────────────────────
    // Linha externa (vermelha)
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.6);
    doc.rect(10, 10, W - 20, H - 20);
    // Linha interna (azul)
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.3);
    doc.rect(13, 13, W - 26, H - 26);

    // ── Logo UNV ──────────────────────────────────────────────────────────
    try {
      const resp = await fetch("/images/unv-logo-contract.png");
      const blob = await resp.blob();
      const b64: string = await new Promise(res => {
        const reader = new FileReader();
        reader.onloadend = () => res((reader.result as string).split(",")[1]);
        reader.readAsDataURL(blob);
      });
      // Logo centralizado no topo
      const logoW = 28, logoH = 14;
      doc.addImage(b64, "PNG", W / 2 - logoW / 2, 18, logoW, logoH);
    } catch {
      // Fallback texto se logo não carregar
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(...NAVY);
      doc.text("UNV", W / 2, 27, { align: "center" });
    }

    // ── "CERTIFICADO" ─────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(...NAVY);
    doc.text("CERTIFICADO", W / 2, 44, { align: "center" });

    // ── Subtítulo (tema/conclusão) ────────────────────────────────────────
    const subtitleText = `CONCLUSÃO DE CONTEÚDO "${topic.toUpperCase()}"`;
    const subtitleLines = doc.splitTextToSize(subtitleText, 200) as string[];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    // Adiciona espaçamento entre letras simulado com texto normal
    doc.text(subtitleLines, W / 2, 51, { align: "center" });

    // ── "Este Certificado é concedido a:" ─────────────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text("Este Certificado \xe9 concedido a:", W / 2, 68, { align: "center" });

    // ── Nome do aluno (itálico grande, estilo cursivo) ────────────────────
    doc.setFont("times", "bolditalic");
    doc.setFontSize(30);
    doc.setTextColor(...NAVY);
    // Ajusta tamanho se nome for muito longo
    const nameWidth = doc.getTextWidth(studentName);
    if (nameWidth > 220) doc.setFontSize(22);
    doc.text(studentName, W / 2, 85, { align: "center" });

    // ── Linha decorativa sob o nome ───────────────────────────────────────
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.4);
    const lineW = Math.min(180, doc.getTextWidth(studentName) + 20);
    doc.line(W / 2 - lineW / 2, 88, W / 2 + lineW / 2, 88);

    // ── Corpo do texto ────────────────────────────────────────────────────
    const bodyText =
      `Como forma de reconhecimento pela conclus\xe3o do conte\xfado, desenvolvida pela Universidade` +
      ` Nacional de Vendas, com foco no aprimoramento de compet\xeancias em "${topic}",` +
      ` o participante demonstrou comprometimento com sua evolu\xe7\xe3o, participa\xe7\xe3o ativa` +
      ` nas etapas propostas e dedica\xe7\xe3o \xe0 constru\xe7\xe3o de resultados.` +
      (duration ? ` Carga hor\xe1ria: ${duration}.` : "");

    const bodyLines = doc.splitTextToSize(bodyText, 210) as string[];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text(bodyLines, W / 2, 100, { align: "center" });

    // ── Linha de assinatura ───────────────────────────────────────────────
    const sigY = 163;
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.4);
    doc.line(W / 2 - 35, sigY, W / 2 + 35, sigY);

    // ── Nome do assinante ────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text("Fabr\xedcio Nunnes", W / 2, sigY + 6, { align: "center" });

    // ── Data + código ─────────────────────────────────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(today, W / 2, sigY + 13, { align: "center" });
    doc.text(`C\xf3digo de valida\xe7\xe3o: ${code}`, W / 2, H - 17, { align: "center" });

    // ── Salvar ────────────────────────────────────────────────────────────
    doc.save(`certificado-${topic.slice(0, 25).replace(/\s/g, "-")}.pdf`);
    toast.success("Certificado baixado!");
  };

  // Must be before early returns to respect Rules of Hooks
  const minWatchLabel = lesson
    ? (lesson.min_watch_minutes > 0 ? lesson.min_watch_minutes : Math.ceil((lesson.duration_minutes || 0) * 0.5))
    : 0;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f1e" }}>
      <RefreshCw className="h-6 w-6 animate-spin text-violet-400" />
    </div>
  );

  if (!lesson) return null;

  const isYT = lesson.video_url ? getYouTubeId(lesson.video_url) !== null : false;
  const embedUrl = (!isYT && lesson.video_url) ? getEmbedUrl(lesson.video_url) : null;

  return (
    <div className="min-h-screen" style={{ background: "#0a0f1e" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/10"
        style={{ background: "rgba(10,15,30,0.9)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/ponto-de-encontro")}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            {trackName && <p className="text-[10px] text-violet-400 mb-0.5 truncate">📚 {trackName}</p>}
            <h1 className="font-bold text-sm leading-tight text-white truncate">{lesson.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={cn("text-[10px] border",
              lesson.video_state === "live"
                ? "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
                : "bg-white/10 text-white/50 border-white/20")}>
              {lesson.video_state === "live" ? "🔴 AO VIVO" : "🎬 Gravada"}
            </Badge>
          </div>
        </div>
        {/* Progress bar */}
        {progress > 0 && (
          <div className="h-0.5 bg-white/10">
            <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Video Player */}
        <div className="rounded-xl overflow-hidden border border-white/10"
          style={{ background: "rgba(0,0,0,0.5)" }}>
          {isYT ? (
            /* YouTube IFrame API — real watch-time tracking */
            <>
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <div ref={ytContainerRef} className="absolute inset-0 w-full h-full" />
              </div>
              {lesson.video_state === "live" && !completed && (
                <div className="px-4 py-2 border-t border-white/10 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <p className="text-xs text-white/50">
                    Ao vivo · presença confirmada automaticamente após {minWatchLabel} min assistidos
                  </p>
                </div>
              )}
              {completed && (
                <div className="px-4 py-2.5 border-t border-emerald-500/20 bg-emerald-500/5 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-300 font-medium">Presença confirmada!</p>
                </div>
              )}
            </>
          ) : embedUrl ? (
            <>
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={embedUrl}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  title={lesson.title}
                  onLoad={startTimer}
                />
              </div>
              {lesson.video_url && isDriveUrl(lesson.video_url) && (
                <div className="px-4 py-2.5 border-t border-white/10 flex items-center justify-between">
                  <p className="text-[11px] text-white/40">Gravação via Google Drive</p>
                  <a href={lesson.video_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                    <ExternalLink className="h-3 w-3" /> Abrir no Drive
                  </a>
                </div>
              )}
            </>
          ) : lesson.meet_link && lesson.video_state === "live" ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Video className="h-7 w-7 text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold">Aula ao vivo</p>
                {lesson.scheduled_at && (
                  <p className="text-sm text-white/50 mt-1">
                    {format(new Date(lesson.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
                <p className="text-xs text-white/40 mt-1">A gravação ficará disponível aqui após a reunião.</p>
              </div>
              <a href={lesson.meet_link} target="_blank" rel="noopener noreferrer">
                <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                  <Video className="h-4 w-4" /> Entrar no Google Meet
                </Button>
              </a>
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 gap-3">
              <AlertTriangle className="h-6 w-6 text-yellow-400" />
              <p className="text-white/60 text-sm">Nenhum vídeo disponível para esta aula.</p>
            </div>
          )}
        </div>

        {/* Check-in code — backup for external sessions */}
        {lesson.checkin_code && !completed && lesson.video_state === "live" && (
          <div className="rounded-xl border border-violet-500/20 p-4"
            style={{ background: "rgba(124,58,237,0.06)" }}>
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="h-4 w-4 text-violet-400" />
              <p className="text-sm font-semibold text-white">Código de presença</p>
            </div>
            <p className="text-xs text-white/50 mb-3">Digite o código exibido pelo instrutor para confirmar sua presença.</p>
            <div className="flex gap-2">
              <input
                value={checkinInput}
                onChange={e => { setCheckinInput(e.target.value.toUpperCase()); setCheckinError(""); }}
                onKeyDown={e => e.key === "Enter" && submitCheckin()}
                placeholder="Ex: UNV-482"
                maxLength={10}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono tracking-widest placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
              />
              <Button onClick={submitCheckin} className="bg-violet-600 hover:bg-violet-700 px-5">
                Confirmar
              </Button>
            </div>
            {checkinError && <p className="text-xs text-red-400 mt-2">{checkinError}</p>}
          </div>
        )}
        {(checkinDone || (completed && lesson.checkin_code && lesson.video_state === "live")) && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <p className="text-sm text-emerald-300 font-medium">Presença confirmada via código!</p>
          </div>
        )}

        {/* Info + actions */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-bold text-lg text-white">{lesson.title}</h2>
            {lesson.description && <p className="text-sm text-white/60 mt-1">{lesson.description}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs text-white/40 flex-wrap">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDuration(lesson.duration_minutes)}</span>
              {lesson.lesson_date && <span>{format(new Date(lesson.lesson_date), "dd/MM/yyyy", { locale: ptBR })}</span>}
              {progress > 0 && <span className="text-violet-400">{progress}% assistido</span>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!completed && (embedUrl || lesson.meet_link) && (
              <Button size="sm" variant="outline"
                className="border-violet-500/40 text-violet-400 hover:bg-violet-500/20"
                onClick={markComplete}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Marcar como concluída
              </Button>
            )}
            {completed && (
              <>
                <Button size="sm"
                  className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30"
                  disabled>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Concluída
                </Button>
                <Button size="sm"
                  className="bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-600/30"
                  onClick={() => downloadCertificate("lesson")}>
                  <Award className="h-3.5 w-3.5 mr-1.5" /> Certificado
                </Button>
                {trackName && (
                  <Button size="sm" variant="outline"
                    className="border-white/20 text-white/60 hover:bg-white/10"
                    onClick={() => downloadCertificate("track")}>
                    <Award className="h-3.5 w-3.5 mr-1.5" /> Cert. Trilha
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Polls */}
        {polls.length > 0 && polls.map(poll => {
          const myResp = pollResponses.get(poll.id);
          const results = pollResults.get(poll.id) || [];
          const total = results.reduce((s, c) => s + c, 0);
          return (
            <div key={poll.id} className="p-5 rounded-xl border border-blue-500/20"
              style={{ background: "rgba(59,130,246,0.05)" }}>
              <div className="flex items-center gap-2 mb-4">
                <ThumbsUp className="h-4 w-4 text-blue-400" />
                <h3 className="font-semibold text-sm text-white">Enquete</h3>
              </div>
              <p className="text-sm text-white/80 mb-3">{poll.question}</p>
              <div className="space-y-2">
                {poll.options.map((opt, idx) => {
                  const count = results[idx] || 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const selected = myResp === idx;
                  return (
                    <button
                      key={idx}
                      disabled={myResp !== undefined}
                      onClick={() => submitPollResponse(poll.id, idx)}
                      className={cn("w-full text-left p-3 rounded-lg border transition-all relative overflow-hidden",
                        selected ? "border-blue-500/60 bg-blue-500/15" :
                        myResp !== undefined ? "border-white/10 bg-white/3 cursor-default" :
                        "border-white/10 hover:border-blue-500/40 hover:bg-blue-500/10")}>
                      {myResp !== undefined && (
                        <div className="absolute inset-0 bg-blue-500/10 origin-left transition-all"
                          style={{ width: `${pct}%` }} />
                      )}
                      <div className="relative flex items-center justify-between gap-2">
                        <span className="text-sm text-white/80">{opt}</span>
                        {myResp !== undefined && (
                          <span className="text-xs text-blue-400 shrink-0">{pct}% ({count})</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {myResp === undefined && <p className="text-xs text-white/30 mt-2">Clique para votar</p>}
            </div>
          );
        })}

        {/* Quizzes */}
        {quizzes.length > 0 && quizzes.map(quiz => {
          const submitted = quizSubmitted.has(quiz.id);
          const score = quizScores.get(quiz.id);
          const myAnswers = quizAnswers.get(quiz.id) || [];
          return (
            <div key={quiz.id} className="p-5 rounded-xl border border-violet-500/20"
              style={{ background: "rgba(124,58,237,0.05)" }}>
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="h-4 w-4 text-violet-400" />
                <h3 className="font-semibold text-sm text-white">{quiz.title}</h3>
                {submitted && score && (
                  <Badge className="ml-auto text-[10px] bg-violet-500/20 text-violet-400 border-violet-500/30">
                    {score.score}/{score.total} acertos
                  </Badge>
                )}
              </div>
              <div className="space-y-5">
                {quiz.questions.map((q, qi) => (
                  <div key={q.id}>
                    <p className="text-sm font-medium text-white/90 mb-2">{qi + 1}. {q.question}</p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, oi) => {
                        const chosen = myAnswers[qi] === oi;
                        const isCorrect = submitted && oi === q.correct_index;
                        const isWrong = submitted && chosen && oi !== q.correct_index;
                        return (
                          <button
                            key={oi}
                            disabled={submitted}
                            onClick={() => {
                              if (submitted) return;
                              setQuizAnswers(prev => {
                                const map = new Map(prev);
                                const arr = [...(map.get(quiz.id) || new Array(quiz.questions.length).fill(-1))];
                                arr[qi] = oi;
                                return map.set(quiz.id, arr);
                              });
                            }}
                            className={cn("w-full text-left px-3 py-2 rounded-lg border text-sm transition-all",
                              isCorrect ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300" :
                              isWrong ? "border-red-500/60 bg-red-500/15 text-red-300" :
                              chosen ? "border-violet-500/60 bg-violet-500/15 text-white" :
                              submitted ? "border-white/10 text-white/40" :
                              "border-white/10 hover:border-violet-500/40 hover:bg-violet-500/10 text-white/80"
                            )}>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {!submitted && (
                <Button className="mt-4 bg-violet-600 hover:bg-violet-700"
                  onClick={() => submitQuiz(quiz)}
                  disabled={myAnswers.length < quiz.questions.length || myAnswers.some(a => a === -1 || a === undefined)}>
                  Enviar Respostas
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PeLessonPage;
