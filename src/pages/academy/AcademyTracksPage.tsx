import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Play,
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

// Default cover images for tracks without custom covers
const DEFAULT_COVERS = [
  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1560472355-536de3962603?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop",
];

export const AcademyTracksPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [hoveredTrack, setHoveredTrack] = useState<string | null>(null);

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
          tracksData.map(async (track, index) => {
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
              cover_image_url: track.cover_image_url || DEFAULT_COVERS[index % DEFAULT_COVERS.length],
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
      gestao: "bg-purple-600",
      vendas: "bg-blue-600",
      rh: "bg-pink-600",
      financeiro: "bg-green-600",
      marketing: "bg-orange-600",
      geral: "bg-gray-600",
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

  // Group tracks by category for Netflix-style rows
  const tracksByCategory = filteredTracks.reduce((acc, track) => {
    if (!acc[track.category]) {
      acc[track.category] = [];
    }
    acc[track.category].push(track);
    return acc;
  }, {} as Record<string, Track[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-black to-black text-white">
      {/* Hero Section */}
      {filteredTracks.length > 0 && (
        <div className="relative h-[50vh] overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${filteredTracks[0].cover_image_url})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
          
          <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
            <Badge className={`${getCategoryColor(filteredTracks[0].category)} mb-4`}>
              {filteredTracks[0].category.toUpperCase()}
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 max-w-2xl">
              {filteredTracks[0].name}
            </h1>
            <p className="text-lg text-gray-300 mb-6 max-w-xl line-clamp-2">
              {filteredTracks[0].description}
            </p>
            <div className="flex items-center gap-4">
              <Button
                size="lg"
                className="bg-white text-black hover:bg-gray-200 font-semibold"
                asChild={!filteredTracks[0].is_locked}
                disabled={filteredTracks[0].is_locked}
              >
                {filteredTracks[0].is_locked ? (
                  <span><Lock className="h-5 w-5 mr-2" /> Bloqueada</span>
                ) : (
                  <Link to={`/academy/track/${filteredTracks[0].id}`}>
                    <Play className="h-5 w-5 mr-2 fill-black" /> Assistir
                  </Link>
                )}
              </Button>
              <div className="flex items-center gap-2 text-gray-300">
                <BookOpen className="h-5 w-5" />
                <span>{filteredTracks[0].lessons_count} aulas</span>
                <span className="mx-2">•</span>
                <span className="flex items-center gap-1">{getLevelStars(filteredTracks[0].level)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 md:px-12 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar trilhas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-400"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-zinc-800 border-zinc-700 text-white">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value} className="text-white hover:bg-zinc-700">
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-full sm:w-36 bg-zinc-800 border-zinc-700 text-white">
              <Star className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Nível" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="all" className="text-white hover:bg-zinc-700">Todos</SelectItem>
              {[1, 2, 3, 4, 5].map(l => (
                <SelectItem key={l} value={l.toString()} className="text-white hover:bg-zinc-700">
                  Nível {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Netflix-style Rows */}
      <div className="px-6 md:px-12 pb-12 space-y-10">
        {Object.entries(tracksByCategory).map(([category, categoryTracks]) => (
          <div key={category}>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className={`w-1 h-6 rounded-full ${getCategoryColor(category)}`} />
              {CATEGORIES.find(c => c.value === category)?.label || category}
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {categoryTracks.map((track) => {
                const progress = track.lessons_count > 0
                  ? (track.completed_lessons / track.lessons_count) * 100
                  : 0;
                const isCompleted = progress === 100;
                const isHovered = hoveredTrack === track.id;

                return (
                  <Link
                    key={track.id}
                    to={track.is_locked ? "#" : `/academy/track/${track.id}`}
                    className={`group relative aspect-[2/3] rounded-lg overflow-hidden transition-all duration-300 ${
                      track.is_locked ? "cursor-not-allowed" : "cursor-pointer"
                    } ${isHovered ? "scale-105 z-10 shadow-2xl shadow-black/50" : ""}`}
                    onMouseEnter={() => !track.is_locked && setHoveredTrack(track.id)}
                    onMouseLeave={() => setHoveredTrack(null)}
                    onClick={(e) => track.is_locked && e.preventDefault()}
                  >
                    {/* Cover Image */}
                    <div 
                      className={`absolute inset-0 bg-cover bg-center transition-transform duration-500 ${
                        isHovered ? "scale-110" : ""
                      }`}
                      style={{ backgroundImage: `url(${track.cover_image_url})` }}
                    />
                    
                    {/* Gradient Overlay */}
                    <div className={`absolute inset-0 transition-opacity duration-300 ${
                      isHovered 
                        ? "bg-gradient-to-t from-black via-black/70 to-transparent" 
                        : "bg-gradient-to-t from-black/90 via-black/30 to-transparent"
                    }`} />

                    {/* Locked Overlay */}
                    {track.is_locked && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="text-center">
                          <Lock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-xs text-gray-400 px-2">
                            Complete: {track.prerequisite_track_name}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Completed Badge */}
                    {isCompleted && !track.is_locked && (
                      <div className="absolute top-2 right-2 bg-green-500 p-1 rounded-full">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      {/* Level Stars */}
                      <div className="flex gap-0.5 mb-1">
                        {getLevelStars(track.level)}
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-sm leading-tight mb-1 line-clamp-2">
                        {track.name}
                      </h3>

                      {/* Description on hover */}
                      <p className={`text-xs text-gray-300 line-clamp-2 transition-all duration-300 ${
                        isHovered ? "opacity-100 max-h-10" : "opacity-0 max-h-0"
                      }`}>
                        {track.description}
                      </p>

                      {/* Progress Bar */}
                      {progress > 0 && !track.is_locked && (
                        <div className="mt-2">
                          <Progress value={progress} className="h-1 bg-gray-700" />
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-gray-400">
                              {track.completed_lessons}/{track.lessons_count} aulas
                            </span>
                            {!isCompleted && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {Math.round(progress)}%
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Play Button on hover */}
                      {!track.is_locked && isHovered && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" className="w-full bg-white text-black hover:bg-gray-200 h-8">
                            <Play className="h-4 w-4 mr-1 fill-black" />
                            {isCompleted ? "Revisar" : progress > 0 ? "Continuar" : "Começar"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {filteredTracks.length === 0 && (
          <div className="text-center py-20">
            <BookOpen className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">Nenhuma trilha encontrada</h3>
            <p className="text-gray-500">
              Tente ajustar os filtros ou aguarde novas trilhas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcademyTracksPage;
