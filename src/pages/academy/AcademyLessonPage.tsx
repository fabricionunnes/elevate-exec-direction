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
} from "lucide-react";
import { toast } from "sonner";
import type { AcademyUserContext } from "./AcademyLayout";

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
  const [trackConfig, setTrackConfig] = useState<TrackConfig>({ require_sequential_lessons: true });
  
  // Timer state
  const [timeSpent, setTimeSpent] = useState(0);
  const [canComplete, setCanComplete] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Start timer when lesson loads
  useEffect(() => {
    if (lesson && !isCompleted) {
      startTimeRef.current = new Date();
      
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((new Date().getTime() - startTimeRef.current.getTime()) / 1000);
          setTimeSpent(elapsed);
          
          if (elapsed >= MIN_TIME_TO_COMPLETE && !canComplete) {
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
  }, [lesson, isCompleted]);

  // Reset timer when lesson changes
  useEffect(() => {
    setTimeSpent(0);
    setCanComplete(false);
    startTimeRef.current = null;
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
          .select("lesson_id, status")
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
    if (!userContext.onboardingUserId || !lesson) return;

    setCompleting(true);
    try {
      // Update progress
      await supabase
        .from("academy_progress")
        .upsert({
          onboarding_user_id: userContext.onboardingUserId,
          lesson_id: lesson.id,
          status: "completed",
          completed_at: new Date().toISOString(),
          time_spent_seconds: timeSpent,
        }, {
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
      lowerUrl.includes("youtu.be") || lowerUrl.includes("youtube.com")
        ? "youtube"
        : lowerUrl.includes("vimeo.com")
          ? "vimeo"
          : lowerUrl.includes("player.pandavideo.com")
            ? "panda"
            : lowerUrl.includes("drive.google.com")
              ? "google_drive"
              : null;

    const provider = inferredProvider ?? lesson.video_provider;
    let embedUrl = url;

    if (provider === "youtube") {
      const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/);
      if (match) {
        embedUrl = `https://www.youtube.com/embed/${match[1]}`;
      }
    } else if (provider === "vimeo") {
      const match = url.match(/vimeo\.com\/(\d+)/);
      if (match) {
        embedUrl = `https://player.vimeo.com/video/${match[1]}`;
      }
    } else if (provider === "panda") {
      if (!url.includes("embed")) {
        embedUrl = url.replace("player.pandavideo.com", "player.pandavideo.com.br/embed");
      }
    } else if (provider === "google_drive") {
      // Google Drive: aceita /file/d/{id}/view e links com ?id={id}
      const fileIdFromPath = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
      const fileIdFromQuery = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
      const fileId = fileIdFromPath ?? fileIdFromQuery;

      if (fileId) {
        embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      } else if (!url.includes("/preview")) {
        const previewUrl = url.replace(/\/(view|edit).*$|$/, "/preview");
        embedUrl = previewUrl;
      }
    }

    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
          referrerPolicy="no-referrer"
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

          <Button
            onClick={handleComplete}
            disabled={isCompleted || completing || !canComplete}
            className={isCompleted ? "bg-green-600 hover:bg-green-700" : ""}
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
