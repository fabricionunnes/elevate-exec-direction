import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Search,
  Filter,
  Star,
  Lock,
  CheckCircle,
  Clock,
} from "lucide-react";
import type { AcademyUserContext } from "./AcademyLayout";

interface Track {
  id: string;
  name: string;
  description: string;
  category: string;
  cover_image_url: string | null;
  level: number;
  lessons_count: number;
  completed_lessons: number;
  is_locked: boolean;
  prerequisite_track_name: string | null;
}

const CATEGORIES = [
  { value: "all", label: "Todas as categorias" },
  { value: "gestao", label: "Gestão" },
  { value: "vendas", label: "Vendas" },
  { value: "rh", label: "RH" },
  { value: "financeiro", label: "Financeiro" },
  { value: "marketing", label: "Marketing" },
  { value: "geral", label: "Geral" },
];

export const AcademyTracksPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");

  useEffect(() => {
    loadTracks();
  }, [userContext]);

  const loadTracks = async () => {
    try {
      const { data: tracksData } = await supabase
        .from("academy_tracks")
        .select(`
          id, name, description, category, cover_image_url, level,
          prerequisite_track_id,
          academy_lessons(id)
        `)
        .eq("is_active", true)
        .order("level", { ascending: true })
        .order("sort_order", { ascending: true });

      if (tracksData) {
        // Get completed tracks to check prerequisites
        const completedTrackIds = new Set<string>();
        
        if (userContext.onboardingUserId) {
          const { data: certificates } = await supabase
            .from("academy_certificates")
            .select("track_id")
            .eq("onboarding_user_id", userContext.onboardingUserId);
          
          certificates?.forEach(c => completedTrackIds.add(c.track_id));
        }

        // Map track IDs to names for prerequisites
        const trackIdToName = new Map<string, string>();
        tracksData.forEach(t => trackIdToName.set(t.id, t.name));

        const tracksWithProgress = await Promise.all(
          tracksData.map(async (track) => {
            let completedLessons = 0;
            
            if (userContext.onboardingUserId) {
              const lessonIds = (track.academy_lessons as any[]).map(l => l.id);
              if (lessonIds.length > 0) {
                const { count } = await supabase
                  .from("academy_progress")
                  .select("id", { count: "exact" })
                  .eq("onboarding_user_id", userContext.onboardingUserId)
                  .eq("status", "completed")
                  .in("lesson_id", lessonIds);
                
                completedLessons = count || 0;
              }
            }

            // Check if locked
            const isLocked = track.prerequisite_track_id 
              ? !completedTrackIds.has(track.prerequisite_track_id)
              : false;

            return {
              id: track.id,
              name: track.name,
              description: track.description || "",
              category: track.category,
              cover_image_url: track.cover_image_url,
              level: track.level,
              lessons_count: (track.academy_lessons as any[]).length,
              completed_lessons: completedLessons,
              is_locked: isLocked,
              prerequisite_track_name: track.prerequisite_track_id 
                ? trackIdToName.get(track.prerequisite_track_id) || null
                : null,
            };
          })
        );

        setTracks(tracksWithProgress);
      }
    } catch (error) {
      console.error("Error loading tracks:", error);
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
      <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
    ));
  };

  const filteredTracks = tracks.filter(track => {
    const matchesSearch = track.name.toLowerCase().includes(search.toLowerCase()) ||
      track.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || track.category === categoryFilter;
    const matchesLevel = levelFilter === "all" || track.level.toString() === levelFilter;
    return matchesSearch && matchesCategory && matchesLevel;
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trilhas de Aprendizado</h1>
        <p className="text-muted-foreground mt-1">
          Explore nossas trilhas e avance em sua jornada
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar trilhas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <Star className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            <SelectItem value="1">Nível 1</SelectItem>
            <SelectItem value="2">Nível 2</SelectItem>
            <SelectItem value="3">Nível 3</SelectItem>
            <SelectItem value="4">Nível 4</SelectItem>
            <SelectItem value="5">Nível 5</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tracks Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTracks.map((track) => {
          const progress = track.lessons_count > 0
            ? (track.completed_lessons / track.lessons_count) * 100
            : 0;
          const isCompleted = progress === 100;

          return (
            <Card 
              key={track.id} 
              className={`overflow-hidden transition-all ${
                track.is_locked 
                  ? "opacity-60 grayscale" 
                  : "hover:shadow-lg hover:-translate-y-1"
              }`}
            >
              <div
                className="h-40 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative"
                style={track.cover_image_url ? {
                  backgroundImage: `url(${track.cover_image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                } : {}}
              >
                {!track.cover_image_url && (
                  <BookOpen className="h-16 w-16 text-primary/40" />
                )}
                {track.is_locked && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Lock className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm font-medium">Bloqueada</p>
                      {track.prerequisite_track_name && (
                        <p className="text-xs opacity-80">
                          Complete: {track.prerequisite_track_name}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {isCompleted && !track.is_locked && (
                  <div className="absolute top-3 right-3 bg-green-500 text-white p-1 rounded-full">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getCategoryColor(track.category)}>
                    {track.category}
                  </Badge>
                  <span className="flex items-center gap-0.5">
                    {getLevelStars(track.level)}
                  </span>
                </div>

                <h3 className="font-semibold text-lg mb-1">{track.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {track.description}
                </p>

                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {track.lessons_count} aulas
                  </span>
                  <span className="flex items-center gap-1">
                    {isCompleted ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Concluída
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4" />
                        {Math.round(progress)}%
                      </>
                    )}
                  </span>
                </div>

                <Progress value={progress} className="h-2 mb-4" />

                <Button 
                  className="w-full" 
                  disabled={track.is_locked}
                  asChild={!track.is_locked}
                >
                  {track.is_locked ? (
                    <span className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Bloqueada
                    </span>
                  ) : (
                    <Link to={`/academy/track/${track.id}`}>
                      {isCompleted ? "Revisar" : progress > 0 ? "Continuar" : "Começar"}
                    </Link>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTracks.length === 0 && (
        <Card className="p-12 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Nenhuma trilha encontrada</h3>
          <p className="text-muted-foreground">
            Tente ajustar os filtros ou aguarde novas trilhas.
          </p>
        </Card>
      )}
    </div>
  );
};

export default AcademyTracksPage;
