import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  FileText,
  ExternalLink,
  Lock,
  Play,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { issueLessonCertificate, maybeIssueTrackCertificate } from "@/lib/academy/certificates";
import type { AcademyUserContext } from "./AcademyLayout";

// Declaração global para a YouTube IFrame Player API
declare global {
  interface Window {
    YT: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: Record<string, (event: unknown) => void>;
        }
      ) => { destroy: () => void };
      PlayerState: Record<string, number>;
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

/**
 * YouTubePlayer via IFrame API.
 * - Carrega o vídeo PAUSADO (autoplay: 0) para que o primeiro play
 *   seja sempre um gesto direto do usuário — isso é o que permite
 *   reprodução inline no iOS em vez de abrir o app.
 * - Mostra overlay de play sobre o player até o usuário tocar.
 * - Fallback "Abrir no YouTube" para casos onde Universal Links
 *   do iOS impedem a reprodução inline mesmo assim.
 */
const YouTubePlayer = ({
  videoId,
  title,
  watchUrl,
  startSeconds,
  onTick,
  onEnded,
  onApiFallback,
}: {
  videoId: string;
  title: string;
  watchUrl: string;
  /** retomar do ponto onde parou (salvo em academy_progress.last_position_seconds) */
  startSeconds?: number;
  /** chamado a cada segundo de reprodução REAL (anti-burla + salvar posição) */
  onTick?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  /** API do YouTube não carregou (iOS/PWA) → caímos pro embed simples */
  onApiFallback?: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [useFallbackIframe, setUseFallbackIframe] = useState(false);
  const playingRef = useRef(false);
  const onTickRef = useRef(onTick);
  const onEndedRef = useRef(onEnded);
  const onApiFallbackRef = useRef(onApiFallback);
  onTickRef.current = onTick;
  onEndedRef.current = onEnded;
  onApiFallbackRef.current = onApiFallback;

  // Se a IFrame API não ficar pronta em 6s (ou der erro),
  // troca pro embed simples (playsinline) — desbloqueio volta pra regra de tempo.
  useEffect(() => {
    if (useFallbackIframe) return;
    const t = setTimeout(() => {
      setPlayerReady((ready) => {
        if (!ready) {
          setUseFallbackIframe(true);
          onApiFallbackRef.current?.();
        }
        return ready;
      });
    }, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Tick de reprodução real: só conta quando o vídeo está TOCANDO
  useEffect(() => {
    const iv = setInterval(() => {
      const p = playerRef.current;
      if (!playingRef.current || !p?.getCurrentTime) return;
      try {
        onTickRef.current?.(p.getCurrentTime() || 0, p.getDuration?.() || 0);
      } catch { /* player em transição */ }
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (useFallbackIframe) return; // já caiu pro embed simples
    let destroyed = false;

    const initPlayer = () => {
      if (destroyed || !containerRef.current) return;
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          playsinline: 1,  // inline no iOS
          autoplay: 0,     // NÃO autoplay — play deve ser gesto direto do usuário
          rel: 0,
          controls: 1,
          modestbranding: 1,
          iv_load_policy: 3,
          // Retomar de onde parou (2s de folga pra recontextualizar)
          ...(startSeconds && startSeconds > 5 ? { start: Math.max(0, Math.floor(startSeconds) - 2) } : {}),
        },
        events: {
          onReady: () => {
            if (!destroyed) setPlayerReady(true);
          },
          onStateChange: (e: any) => {
            // 1 = playing · 0 = ended
            playingRef.current = e?.data === 1;
            if (e?.data === 0) onEndedRef.current?.();
          },
          onError: () => {
            // vídeo bloqueado pra embed / erro de carregamento → embed simples
            setUseFallbackIframe(true);
            onApiFallbackRef.current?.();
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === "function") prev();
        initPlayer();
      };
    }

    return () => {
      destroyed = true;
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, [videoId]);

  const handlePlay = () => {
    if (playerRef.current && playerReady) {
      playerRef.current.playVideo();
      setPlaying(true);
    }
  };

  if (useFallbackIframe) {
    const startParam = startSeconds && startSeconds > 5 ? `&start=${Math.max(0, Math.floor(startSeconds) - 2)}` : "";
    return (
      <div className="flex flex-col gap-2">
        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-xl">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1${startParam}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            // Erro 153: o YouTube exige referer; o app instalado (standalone)
            // pode suprimi-lo — forçamos enviar ao menos a origem
            referrerPolicy="strict-origin-when-cross-origin"
            title={title}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Vídeo não abriu?{" "}
          <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="underline text-primary">
            Assistir no YouTube
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-xl relative">
        {/* Player YT (inicia pausado) */}
        <div ref={containerRef} className="w-full h-full" title={title} />

        {/* Overlay de play — visível até o usuário tocar */}
        {!playing && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
            onClick={handlePlay}
          >
            {playerReady ? (
              <div className="h-16 w-16 rounded-full bg-red-600 flex items-center justify-center shadow-2xl ring-4 ring-white/30 hover:scale-110 transition-transform">
                <Play className="h-7 w-7 text-white ml-1" fill="white" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-full border-4 border-white/40 border-t-white animate-spin" />
            )}
          </div>
        )}
      </div>

      {/* Fallback para iOS com app do YouTube instalado */}
      <p className="text-center text-xs text-muted-foreground">
        Vídeo não abriu?{" "}
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-primary"
        >
          Assistir no YouTube
        </a>
      </p>
    </div>
  );
};

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_provider: string;
  transcript: string | null;
  estimated_duration_minutes: number | null;
  points_on_complete: number;
  track_id: string;
  track_name: string;
  sort_order: number;
}

interface Asset {
  id: string;
  name: string;
  asset_type: string;
  asset_url: string;
}

interface NavigationLesson {
  id: string;
  title: string;
  sort_order: number;
  is_completed: boolean;
}

interface TrackConfig {
  require_sequential_lessons: boolean;
}

const MIN_TIME_TO_COMPLETE = 60; // 1 minute in seconds
// Fração REAL do vídeo que precisa ser assistida pra liberar a conclusão
const WATCH_FRACTION_TO_COMPLETE = 0.2; // 20%

export const AcademyLessonPage = () => {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const userContext = useOutletContext<AcademyUserContext>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [prevLesson, setPrevLesson] = useState<NavigationLesson | null>(null);
  const [nextLesson, setNextLesson] = useState<NavigationLesson | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [issuingCert, setIssuingCert] = useState(false);
  const [trackConfig, setTrackConfig] = useState<TrackConfig>({ require_sequential_lessons: true });
  
  // Timer state
  const [timeSpent, setTimeSpent] = useState(0);
  const [canComplete, setCanComplete] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  // Anti-burla (YouTube): tempo REAL de reprodução + posição pra retomar depois
  const watchedRealRef = useRef(0);
  const videoDurationRef = useRef(0);
  const videoEndedRef = useRef(false);
  const lastPosSaveRef = useRef(0);
  const nativeTickRef = useRef(0);
  const [resumeFrom, setResumeFrom] = useState(0);
  const [watchedPct, setWatchedPct] = useState(0);
  // player caiu pro embed simples (iOS/PWA) → não dá pra medir % assistido
  const [playerApiFailed, setPlayerApiFailed] = useState(false);
  // certificado pronto: link direto (window.open pós-async é bloqueado no iOS)
  const [certUrl, setCertUrl] = useState<string | null>(null);

  const isYouTubeLesson = (() => {
    const u = (lesson?.video_url || "").toLowerCase();
    return u.includes("youtu.be") || u.includes("youtube.com");
  })();

  /** Salva a posição atual do vídeo (retomar de onde parou). Throttled ~10s. */
  const savePosition = (seconds: number, force = false) => {
    if (!userContext.onboardingUserId || !lessonId) return;
    const now = Date.now();
    if (!force && now - lastPosSaveRef.current < 10_000) return;
    lastPosSaveRef.current = now;
    void (supabase as any)
      .from("academy_progress")
      .update({ last_position_seconds: Math.floor(seconds) })
      .eq("onboarding_user_id", userContext.onboardingUserId)
      .eq("lesson_id", lessonId);
  };

  /** Tick de reprodução REAL do YouTube: acumula, atualiza % e libera a
   * conclusão só com a fração mínima assistida (ou vídeo terminado). */
  const handleVideoTick = (currentTime: number, duration: number) => {
    watchedRealRef.current += 1;
    if (duration > 0) videoDurationRef.current = duration;
    const dur = videoDurationRef.current;
    if (dur > 0) {
      const pct = Math.min(100, Math.round((watchedRealRef.current / dur) * 100));
      setWatchedPct(pct);
      if (!isCompleted && !canComplete && (videoEndedRef.current || watchedRealRef.current >= dur * WATCH_FRACTION_TO_COMPLETE)) {
        setCanComplete(true);
      }
    }
    savePosition(currentTime);
  };

  const handleVideoEnded = () => {
    videoEndedRef.current = true;
    setWatchedPct(100);
    if (!isCompleted) setCanComplete(true);
    savePosition(0, true); // terminou → próxima visita começa do início
  };

  // Start timer when lesson loads
  useEffect(() => {
    if (lesson && !isCompleted) {
      startTimeRef.current = new Date();
      
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((new Date().getTime() - startTimeRef.current.getTime()) / 1000);
          setTimeSpent(elapsed);
          
          // Anti-burla: em aula do YouTube, quem libera a conclusão é o
          // progresso REAL do vídeo (fração mínima assistida) — não o tempo de página.
          // Exceção: player caiu pro embed simples (sem medição) → regra de tempo.
          const isTrackedVideo = isYouTubeLesson || (lesson?.video_url || "").toLowerCase().includes(".mp4");
          if ((!isTrackedVideo || playerApiFailed) && elapsed >= MIN_TIME_TO_COMPLETE && !canComplete) {
            setCanComplete(true);
          }
        }
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [lesson, isCompleted, playerApiFailed, isYouTubeLesson, canComplete]);

  // Reset timer when lesson changes
  useEffect(() => {
    setTimeSpent(0);
    setCanComplete(false);
    setVideoPlaying(false);
    startTimeRef.current = null;
    watchedRealRef.current = 0;
    videoDurationRef.current = 0;
    videoEndedRef.current = false;
    setWatchedPct(0);
    setResumeFrom(0);
    setPlayerApiFailed(false);
    setCertUrl(null);
  }, [lessonId]);

  useEffect(() => {
    if (lessonId) loadLesson();
  }, [lessonId, userContext]);

  const loadLesson = async () => {
    try {
      // Load lesson with track info
      const { data: lessonData } = await supabase
        .from("academy_lessons")
        .select(`
          *,
          academy_tracks!inner(id, name, require_sequential_lessons)
        `)
        .eq("id", lessonId)
        .single();

      if (!lessonData) {
        navigate("/academy/tracks");
        return;
      }

      const trackData = lessonData.academy_tracks as any;
      setTrackConfig({ require_sequential_lessons: trackData.require_sequential_lessons });
      
      setLesson({
        id: lessonData.id,
        title: lessonData.title,
        description: lessonData.description,
        video_url: lessonData.video_url,
        video_provider: lessonData.video_provider,
        transcript: lessonData.transcript,
        estimated_duration_minutes: lessonData.estimated_duration_minutes,
        points_on_complete: lessonData.points_on_complete,
        track_id: trackData.id,
        track_name: trackData.name,
        sort_order: lessonData.sort_order,
      });

      // Load assets
      const { data: assetsData } = await supabase
        .from("academy_lesson_assets")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("sort_order", { ascending: true });

      setAssets(assetsData || []);

      // Load all lessons in track with completion status
      const { data: trackLessons } = await supabase
        .from("academy_lessons")
        .select("id, title, sort_order")
        .eq("track_id", trackData.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (trackLessons && userContext.onboardingUserId) {
        // Get completion status for all lessons
        const { data: progressData } = await supabase
          .from("academy_progress")
          .select("lesson_id, status, last_position_seconds")
          .eq("onboarding_user_id", userContext.onboardingUserId)
          .in("lesson_id", trackLessons.map(l => l.id));

        const completedLessons = new Set(
          progressData?.filter(p => p.status === "completed").map(p => p.lesson_id) || []
        );

        const lessonsWithStatus = trackLessons.map(l => ({
          ...l,
          is_completed: completedLessons.has(l.id),
        }));

        const currentIndex = lessonsWithStatus.findIndex(l => l.id === lessonId);
        
        if (currentIndex > 0) {
          setPrevLesson(lessonsWithStatus[currentIndex - 1]);
        } else {
          setPrevLesson(null);
        }
        
        if (currentIndex < lessonsWithStatus.length - 1) {
          setNextLesson(lessonsWithStatus[currentIndex + 1]);
        } else {
          setNextLesson(null);
        }

        // Check current lesson completion
        const currentProgress = progressData?.find(p => p.lesson_id === lessonId);
        const isCurrentCompleted = currentProgress?.status === "completed";
        setIsCompleted(isCurrentCompleted);
        // Retomar de onde parou (só em aula ainda não concluída)
        if (!isCurrentCompleted && (currentProgress as any)?.last_position_seconds > 0) {
          setResumeFrom((currentProgress as any).last_position_seconds);
        }
        
        if (isCurrentCompleted) {
          setCanComplete(true);
        }

        // Mark as in_progress if not started
        if (!currentProgress) {
          await supabase.from("academy_progress").insert({
            onboarding_user_id: userContext.onboardingUserId,
            lesson_id: lessonId,
            status: "in_progress",
            started_at: new Date().toISOString(),
          });
        } else if (currentProgress.status === "not_started") {
          await supabase
            .from("academy_progress")
            .update({ status: "in_progress", started_at: new Date().toISOString() })
            .eq("onboarding_user_id", userContext.onboardingUserId)
            .eq("lesson_id", lessonId);
        }
      }
    } catch (error) {
      console.error("Error loading lesson:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!lesson) return;
    if (!userContext.onboardingUserId) {
      toast.error("Sua conta não tem perfil de aluno — recarregue a página; se persistir, fale com o suporte.");
      return;
    }

    setCompleting(true);
    try {
      // Update progress
      // % REAL assistido no momento da conclusão (vai estampado no certificado)
      const watchedPctFinal = videoEndedRef.current
        ? 100
        : videoDurationRef.current > 0
          ? Math.min(100, Math.round((watchedRealRef.current / videoDurationRef.current) * 100))
          : null;
      await supabase
        .from("academy_progress")
        .upsert({
          onboarding_user_id: userContext.onboardingUserId,
          lesson_id: lesson.id,
          status: "completed",
          completed_at: new Date().toISOString(),
          time_spent_seconds: timeSpent,
          watched_pct: watchedPctFinal,
        } as any, {
          onConflict: "onboarding_user_id,lesson_id",
        });

      // Award points
      await supabase.from("academy_points_ledger").insert({
        onboarding_user_id: userContext.onboardingUserId,
        points: lesson.points_on_complete,
        action_type: "lesson_complete",
        description: `Aula concluída: ${lesson.title}`,
        reference_id: lesson.id,
        reference_type: "lesson",
      });

      setIsCompleted(true);
      toast.success(`Aula concluída! +${lesson.points_on_complete} pontos`);

      // Certificados (best-effort): emite o da aula e, se a trilha fechou, o da trilha
      void (async () => {
        try {
          const lessonCert = await issueLessonCertificate({
            onboardingUserId: userContext.onboardingUserId!,
            userName: userContext.userName,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            trackName: lesson.track_name,
            durationMinutes: lesson.estimated_duration_minutes,
          });
          setCertUrl(lessonCert.pdf_url);
          const trackCert = await maybeIssueTrackCertificate({
            onboardingUserId: userContext.onboardingUserId!,
            userName: userContext.userName,
            trackId: lesson.track_id,
            trackName: lesson.track_name,
          });
          if (trackCert) {
            toast.success("🎓 Trilha concluída! Certificado da trilha emitido — veja em Meu Progresso.");
          }
        } catch (e) {
          console.error("certificado:", e);
        }
      })();

      // Navigate to next lesson if available
      if (nextLesson) {
        setTimeout(() => {
          navigate(`/academy/lesson/${nextLesson.id}`);
        }, 1500);
      }
    } catch (error) {
      console.error("Error completing lesson:", error);
      toast.error("Erro ao marcar aula como concluída");
    } finally {
      setCompleting(false);
    }
  };


  const isNextLessonLocked = () => {
    if (!trackConfig.require_sequential_lessons) return false;
    if (!nextLesson) return false;
    return !isCompleted;
  };

  const getVideoEmbed = () => {
    if (!lesson?.video_url) return null;

    const url = lesson.video_url.trim();
    const lowerUrl = url.toLowerCase();

    const inferredProvider =
      lowerUrl.includes(".mp4") || lowerUrl.includes("/storage/v1/object/public/academy-videos/")
        ? "mp4"
        : lowerUrl.includes("youtu.be") || lowerUrl.includes("youtube.com")
        ? "youtube"
        : lowerUrl.includes("vimeo.com")
          ? "vimeo"
          : lowerUrl.includes("player.pandavideo.com")
            ? "panda"
            : lowerUrl.includes("drive.google.com")
              ? "google_drive"
              : null;

    const provider = inferredProvider ?? lesson.video_provider;

    // MP4 próprio (Supabase Storage): player HTML5 nativo — toca DENTRO do
    // app instalado sem restrição do YouTube, com % real e retomada exatas.
    if (provider === "mp4") {
      return (
        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-xl">
          <video
            key={url}
            src={url}
            controls
            playsInline
            preload="metadata"
            controlsList="nodownload"
            className="w-full h-full"
            ref={(el) => {
              if (el && resumeFrom > 5 && !el.dataset.resumed) {
                el.dataset.resumed = "1";
                el.currentTime = Math.max(0, resumeFrom - 2);
              }
            }}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (!v.paused && !v.seeking) {
                nativeTickRef.current += 1;
                // onTimeUpdate dispara ~4x/s — converte pra ~1s de reprodução real
                if (nativeTickRef.current % 4 === 0) {
                  handleVideoTick(v.currentTime, v.duration || 0);
                }
              }
            }}
            onEnded={handleVideoEnded}
          />
        </div>
      );
    }

    // YouTube: usa IFrame Player API (não iframe simples) para garantir
    // reprodução inline no iOS. iframe simples é interceptado pelo app.
    if (provider === "youtube") {
      const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/);
      if (match) {
        const videoId = match[1];
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        const thumbnailFallback = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        if (!videoPlaying) {
          return (
            <div
              className="aspect-video w-full rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 shadow-xl relative cursor-pointer group"
              onClick={() => setVideoPlaying(true)}
            >
              <img
                src={thumbnailUrl}
                alt={lesson.title}
                className="w-full h-full object-cover opacity-90 group-hover:opacity-75 transition-opacity"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src !== thumbnailFallback) {
                    img.src = thumbnailFallback;
                  }
                }}
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/35 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-red-600 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform ring-4 ring-white/30">
                  <Play className="h-7 w-7 text-white ml-1" fill="white" />
                </div>
              </div>
              {lesson.estimated_duration_minutes && (
                <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-0.5 rounded font-medium">
                  {lesson.estimated_duration_minutes} min
                </div>
              )}
            </div>
          );
        }

        // Player via IFrame API — toca inline no iOS sem abrir app
        return (
          <YouTubePlayer
            videoId={videoId}
            title={lesson?.title || "Video"}
            watchUrl={`https://www.youtube.com/watch?v=${videoId}`}
            startSeconds={resumeFrom}
            onTick={handleVideoTick}
            onEnded={handleVideoEnded}
            onApiFallback={() => setPlayerApiFailed(true)}
          />
        );
      }
    }

    let embedUrl = url;

    if (provider === "vimeo") {
      const match = url.match(/vimeo\.com\/(\d+)/);
      if (match) {
        embedUrl = `https://player.vimeo.com/video/${match[1]}`;
      }
    } else if (provider === "panda") {
      if (!url.includes("embed")) {
        embedUrl = url.replace("player.pandavideo.com", "player.pandavideo.com.br/embed");
      }
    } else if (provider === "google_drive") {
      const fileIdFromPath = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
      const fileIdFromQuery = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
      const fileId = fileIdFromPath ?? fileIdFromQuery;

      if (fileId) {
        embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      } else if (!url.includes("/preview")) {
        embedUrl = url.replace(/\/(view|edit).*$|$/, "/preview");
      }
    }

    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-xl">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          title={lesson?.title || "Video"}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <h3 className="font-semibold mb-2">Aula não encontrada</h3>
          <Button asChild>
            <Link to="/academy/tracks">Voltar às trilhas</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link to={`/academy/track/${lesson.track_id}`}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            {lesson.track_name}
          </Link>
        </Button>
        
        <div className="flex items-center gap-2">
          {prevLesson && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/academy/lesson/${prevLesson.id}`}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          )}
          {nextLesson && (
            <Button 
              variant="outline" 
              size="sm" 
              asChild={!isNextLessonLocked()}
              disabled={isNextLessonLocked()}
            >
              {isNextLessonLocked() ? (
                <span className="flex items-center gap-1 opacity-50 cursor-not-allowed px-3">
                  <Lock className="h-4 w-4" />
                </span>
              ) : (
                <Link to={`/academy/lesson/${nextLesson.id}`}>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Video Player */}
      {lesson.video_url ? (
        getVideoEmbed()
      ) : (
        <Card className="aspect-video flex items-center justify-center bg-muted">
          <p className="text-muted-foreground">Nenhum vídeo disponível</p>
        </Card>
      )}

      {/* Lesson Info */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{lesson.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
              <Badge variant="outline">{lesson.track_name}</Badge>
              {lesson.estimated_duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {lesson.estimated_duration_minutes} min
                </span>
              )}
              {isCompleted && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Concluída
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
          {isCompleted && certUrl && (
            /* Link DIRETO: window.open depois de operação assíncrona é bloqueado
               pelo iOS (popup blocker) — o certificado "sumia" depois de gerar */
            <Button asChild variant="outline" className="border-emerald-500/50 text-emerald-600">
              <a href={certUrl} target="_blank" rel="noopener noreferrer">
                <Award className="h-4 w-4 mr-2" />
                Abrir certificado
              </a>
            </Button>
          )}
          {isCompleted && !certUrl && (
            <Button
              variant="outline"
              disabled={issuingCert}
              onClick={async () => {
                if (!userContext.onboardingUserId || !lesson) return;
                setIssuingCert(true);
                try {
                  const cert = await issueLessonCertificate({
                    onboardingUserId: userContext.onboardingUserId,
                    userName: userContext.userName,
                    lessonId: lesson.id,
                    lessonTitle: lesson.title,
                    trackName: lesson.track_name,
                    durationMinutes: lesson.estimated_duration_minutes,
                  });
                  setCertUrl(cert.pdf_url);
                  toast.success("Certificado pronto! Toque em \"Abrir certificado\".");
                } catch (e) {
                  console.error(e);
                  toast.error("Não consegui gerar o certificado agora");
                } finally {
                  setIssuingCert(false);
                }
              }}
            >
              <Award className="h-4 w-4 mr-2" />
              {issuingCert ? "Gerando..." : "Certificado"}
            </Button>
          )}
          {(isYouTubeLesson || (lesson?.video_url || "").toLowerCase().includes(".mp4")) && !playerApiFailed && !isCompleted && !canComplete && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {watchedPct}% assistido · precisa de 20%
            </span>
          )}
          <Button
            onClick={handleComplete}
            disabled={isCompleted || completing || !canComplete}
            className={isCompleted ? "bg-green-600 hover:bg-green-700" : ""}
            title={!canComplete && isYouTubeLesson ? "Assista pelo menos 20% do vídeo para concluir" : undefined}
          >
            {completing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Salvando...
              </>
            ) : isCompleted ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Concluída
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Marcar como concluída
              </>
            )}
          </Button>
          </div>
        </div>

        {lesson.description && (
          <p className="text-muted-foreground">{lesson.description}</p>
        )}
      </div>

      {/* Assets */}
      {assets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Materiais Complementares
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assets.map((asset) => (
              <a
                key={asset.id}
                href={asset.asset_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {asset.asset_type === "pdf" ? (
                      <FileText className="h-4 w-4 text-primary" />
                    ) : (
                      <ExternalLink className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <span className="font-medium">{asset.name}</span>
                </div>
                <Badge variant="outline">{asset.asset_type.toUpperCase()}</Badge>
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-4 border-t">
        {prevLesson ? (
          <Button variant="outline" asChild>
            <Link to={`/academy/lesson/${prevLesson.id}`}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Aula anterior
            </Link>
          </Button>
        ) : (
          <div />
        )}
        
        {nextLesson ? (
          isNextLessonLocked() ? (
            <Button disabled className="opacity-50">
              <Lock className="h-4 w-4 mr-2" />
              Conclua esta aula primeiro
            </Button>
          ) : (
            <Button asChild>
              <Link to={`/academy/lesson/${nextLesson.id}`}>
                Próxima aula
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          )
        ) : (
          <Button asChild>
            <Link to={`/academy/track/${lesson.track_id}`}>
              Voltar à trilha
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export default AcademyLessonPage;
