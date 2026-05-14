import { useEffect, useState } from "react";
import { useParams, Link, useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  ChevronLeft,
  Play,
  CheckCircle,
  Lock,
  Clock,
  FileText,
  Award,
  Star,
} from "lucide-react";
import type { AcademyUserContext } from "./AcademyLayout";

// Default cover images for tracks without custom covers
const DEFAULT_COVERS = [
  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1560472355-536de3962603?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop",
];

// Generate consistent index from track name
const getDefaultCoverIndex = (name: string): number => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % DEFAULT_COVERS.length;
};

interface Track {
  id: string;
  name: string;
  description: string;
  category: string;
  cover_image_url: string | null;
  level: number;
  require_sequential_lessons: boolean;
  require_quiz_to_advance: boolean;
  min_quiz_score: number;
}

interface Module {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  video_provider: string;
  estimated_duration_minutes: number | null;
  sort_order: number;
  module_id: string | null;
  status: "not_started" | "in_progress" | "completed";
  is_locked: boolean;
}

interface Quiz {
  id: string;
  title: string;
  quiz_type: string;
  min_score: number;
  passed: boolean;
  best_score: number | null;
}

export const AcademyTrackDetailPage = () => {
  const { trackId } = useParams();
  const userContext = useOutletContext<AcademyUserContext>();
  const [track, setTrack] = useState<Track | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessonsWithoutModule, setLessonsWithoutModule] = useState<Lesson[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedLessons, setCompletedLessons] = useState(0);
  const [totalLessons, setTotalLessons] = useState(0);

  useEffect(() => {
    if (trackId) loadTrackData();
  }, [trackId, userContext]);

  const loadTrackData = async () => {
    try {
      // Load track
      const { data: trackData } = await supabase
        .from("academy_tracks")
        .select("*")
        .eq("id", trackId)
        .single();

      if (!trackData) return;
      setTrack(trackData);

      // Load modules
      const { data: modulesData } = await supabase
        .from("academy_modules")
        .select("*")
        .eq("track_id", trackId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      // Load lessons
      const { data: lessonsData } = await supabase
        .from("academy_lessons")
        .select("*")
        .eq("track_id", trackId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      // Load user progress
      let progressMap = new Map<string, string>();
      if (userContext.onboardingUserId && lessonsData) {
        const { data: progressData } = await supabase
          .from("academy_progress")
          .select("lesson_id, status")
          .eq("onboarding_user_id", userContext.onboardingUserId)
          .in("lesson_id", lessonsData.map(l => l.id));

        progressData?.forEach(p => progressMap.set(p.lesson_id, p.status));
      }

      // Map lessons with progress and lock status
      const allLessons = lessonsData || [];
      let lastCompletedIndex = -1;

      // Find last completed lesson
      allLessons.forEach((lesson, index) => {
        if (progressMap.get(lesson.id) === "completed") {
          lastCompletedIndex = index;
        }
      });

      const lessonsWithStatus: Lesson[] = allLessons.map((lesson, index) => {
        const status = (progressMap.get(lesson.id) || "not_started") as Lesson["status"];
        const isLocked = trackData.require_sequential_lessons && 
          index > lastCompletedIndex + 1;

        return {
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          video_provider: lesson.video_provider,
          estimated_duration_minutes: lesson.estimated_duration_minutes,
          sort_order: lesson.sort_order,
          module_id: lesson.module_id,
          status,
          is_locked: isLocked,
        };
      });

      // Organize lessons by module
      const moduleMap = new Map<string, Lesson[]>();
      const noModuleLessons: Lesson[] = [];

      lessonsWithStatus.forEach(lesson => {
        if (lesson.module_id) {
          const existing = moduleMap.get(lesson.module_id) || [];
          existing.push(lesson);
          moduleMap.set(lesson.module_id, existing);
        } else {
          noModuleLessons.push(lesson);
        }
      });

      const modulesWithLessons = (modulesData || []).map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        sort_order: m.sort_order,
        lessons: moduleMap.get(m.id) || [],
      }));

      setModules(modulesWithLessons);
      setLessonsWithoutModule(noModuleLessons);

      // Calculate progress
      const completed = lessonsWithStatus.filter(l => l.status === "completed").length;
      setCompletedLessons(completed);
      setTotalLessons(lessonsWithStatus.length);

      // Load final quiz
      const { data: quizData } = await supabase
        .from("academy_quizzes")
        .select("*")
        .eq("track_id", trackId)
        .eq("quiz_type", "track_final")
        .eq("is_active", true)
        .maybeSingle();

      if (quizData && userContext.onboardingUserId) {
        const { data: attempts } = await supabase
          .from("academy_quiz_attempts")
          .select("score, passed")
          .eq("quiz_id", quizData.id)
          .eq("onboarding_user_id", userContext.onboardingUserId)
          .order("score", { ascending: false })
          .limit(1);

        setQuiz({
          id: quizData.id,
          title: quizData.title,
          quiz_type: quizData.quiz_type,
          min_score: quizData.min_score,
          passed: attempts?.[0]?.passed || false,
          best_score: attempts?.[0]?.score || null,
        });
      } else if (quizData) {
        setQuiz({
          id: quizData.id,
          title: quizData.title,
          quiz_type: quizData.quiz_type,
          min_score: quizData.min_score,
          passed: false,
          best_score: null,
        });
      }
    } catch (error) {
      console.error("Error loading track:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      gestao: "bg-purple-100 text-purple-800",
      vendas: "bg-blue-100 text-blue-800",
      rh: "bg-pink-100 text-pink-800",
      financeiro: "bg-green-100 text-green-800",
      marketing: "bg-orange-100 text-orange-800",
      geral: "bg-gray-100 text-gray-800",
    };
    return colors[category] || colors.geral;
  };

  const getLevelStars = (level: number) => {
    return Array.from({ length: Math.min(level, 5) }).map((_, i) => (
      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
    ));
  };

  const renderLesson = (lesson: Lesson) => (
    <div
      key={lesson.id}
      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
        lesson.is_locked
          ? "bg-muted/50 opacity-60"
          : lesson.status === "completed"
          ? "bg-green-50 border-green-200"
          : "hover:bg-muted/50"
      }`}
    >
      <div className={`p-2 rounded-lg ${
        lesson.status === "completed"
          ? "bg-green-100"
          : lesson.is_locked
          ? "bg-muted"
          : "bg-primary/10"
      }`}>
        {lesson.is_locked ? (
          <Lock className="h-5 w-5 text-muted-foreground" />
        ) : lesson.status === "completed" ? (
          <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
          <Play className="h-5 w-5 text-primary" />
        )}
      </div>

      <div className="flex-1">
        <p className="font-medium">{lesson.title}</p>
        {lesson.description && (
          <p className="text-sm text-muted-foreground line-clamp-1">
            {lesson.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="capitalize">{lesson.video_provider}</span>
          {lesson.estimated_duration_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lesson.estimated_duration_minutes} min
            </span>
          )}
        </div>
      </div>

      {!lesson.is_locked && (
        <Button
          variant={lesson.status === "completed" ? "outline" : "default"}
          size="sm"
          asChild
        >
          <Link to={`/academy/lesson/${lesson.id}`}>
            {lesson.status === "completed" ? "Revisar" : 
             lesson.status === "in_progress" ? "Continuar" : "Assistir"}
          </Link>
        </Button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!track) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Trilha não encontrada</h3>
          <Button asChild>
            <Link to="/academy/tracks">Voltar às trilhas</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  const canTakeQuiz = completedLessons === totalLessons && totalLessons > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link to="/academy/tracks">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar às trilhas
        </Link>
      </Button>

      {/* Track Header */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <img 
            src={track.cover_image_url || DEFAULT_COVERS[getDefaultCoverIndex(track.name)]} 
            alt={track.name}
            className="w-full h-48 md:h-64 object-cover rounded-xl shadow-lg"
          />
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getCategoryColor(track.category)}>
              {track.category}
            </Badge>
            <span className="flex items-center gap-0.5">
              {getLevelStars(track.level)}
            </span>
            <span className="text-sm text-muted-foreground">
              Nível {track.level}
            </span>
          </div>

          <h1 className="text-3xl font-bold">{track.name}</h1>
          
          {track.description && (
            <p className="text-muted-foreground">{track.description}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              {totalLessons} aulas
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              {completedLessons} concluídas
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progresso da trilha</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </div>
      </div>

      {/* Lessons */}
      <div className="space-y-6">
        {/* Modules with lessons */}
        {modules.map(module => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {module.name}
              </CardTitle>
              {module.description && (
                <p className="text-sm text-muted-foreground">{module.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {module.lessons.length > 0 ? (
                module.lessons.map(renderLesson)
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  Nenhuma aula neste módulo
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Lessons without module */}
        {lessonsWithoutModule.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Aulas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lessonsWithoutModule.map(renderLesson)}
            </CardContent>
          </Card>
        )}

        {/* Final Quiz */}
        {quiz && (
          <Card className={quiz.passed ? "border-green-200 bg-green-50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Prova Final
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{quiz.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Nota mínima: {quiz.min_score}%
                    {quiz.best_score !== null && (
                      <> • Sua melhor nota: {quiz.best_score}%</>
                    )}
                  </p>
                </div>
                
                {quiz.passed ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Aprovado!</span>
                  </div>
                ) : canTakeQuiz ? (
                  <Button asChild>
                    <Link to={`/academy/quiz/${quiz.id}`}>
                      {quiz.best_score !== null ? "Tentar novamente" : "Fazer prova"}
                    </Link>
                  </Button>
                ) : (
                  <Button disabled>
                    <Lock className="h-4 w-4 mr-2" />
                    Complete as aulas
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {modules.length === 0 && lessonsWithoutModule.length === 0 && (
          <Card className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Nenhuma aula disponível</h3>
            <p className="text-muted-foreground">
              Em breve novas aulas serão adicionadas a esta trilha.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AcademyTrackDetailPage;
