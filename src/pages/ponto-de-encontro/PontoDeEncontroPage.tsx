import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play, BookOpen, Trophy, Award, Search, Plus, RefreshCw,
  LogOut, Settings, Users, BarChart3, Eye, EyeOff, Trash2, KeyRound,
  Edit3, ChevronRight, CheckCircle2, Lock, Clock, Star,
  GraduationCap, ArrowLeft, Video, List, Building2, X,
  Mail, Calendar, Loader2, Link2, Copy, Radio, StopCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
type UserRole = "aluno" | "consultant" | "cs" | "admin" | "master"
  | "closer" | "sdr" | "social_setter" | "bdr" | "head_comercial"
  | "rh" | "financeiro" | "marketing" | "juridico" | null;

const INSTRUCTOR_ROLES = ["master", "admin", "cs", "consultant"];
const VIEWER_ROLES = ["closer", "sdr", "social_setter", "bdr", "head_comercial", "rh", "financeiro", "marketing", "juridico"];

interface Track {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "active" | "hidden";
  cover_url: string | null;
  created_at: string;
  lessons?: Lesson[];
  completedCount?: number;
  totalCount?: number;
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_minutes: number;
  lesson_date: string | null;
  status: "draft" | "active" | "hidden";
  video_state: "live" | "recorded";
  track_id: string | null;
  position: number;
  progress?: number;
  completed?: boolean;
  locked?: boolean;
  meet_link: string | null;
  calendar_event_id: string | null;
  scheduled_at: string | null;
  host_staff_id: string | null;
  extra_attendee_emails: string | null;
  checkin_code: string | null;
  min_watch_minutes: number;
}

interface StaffMember {
  id: string;
  name: string;
  user_id: string;
  hasCalendar: boolean;
}

interface StaffInfo {
  id: string;
  name: string;
  role: string;
  email: string;
}

interface Company {
  id: string;
  name: string;
}

interface PointsTotal {
  total: number;
  rank?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = { draft: "Rascunho", active: "Ativa", hidden: "Oculta" };
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  hidden: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

function fmtDuration(mins: number): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ""}`;
  return `${m}min`;
}

// ── Main Page ──────────────────────────────────────────────────────────────
const PontoDeEncontroPage = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/onboarding-tasks/login"); return; }

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, name, role, email")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!staff) { navigate("/onboarding-tasks/login"); return; }

      const role = staff.role as UserRole;
      const allowed = [...INSTRUCTOR_ROLES, ...VIEWER_ROLES, "aluno"];
      if (!allowed.includes(role || "")) {
        toast.error("Sem acesso ao Ponto de Encontro.");
        navigate("/onboarding-tasks");
        return;
      }

      setStaffInfo(staff);
      setUserRole(role);
      setLoading(false);
    })();
  }, [navigate]);

  const isInstructor = INSTRUCTOR_ROLES.includes(userRole || "");
  const isViewer = VIEWER_ROLES.includes(userRole || "");

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f1e" }}>
      <RefreshCw className="h-6 w-6 animate-spin text-violet-400" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#0a0f1e" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/10"
        style={{ background: "rgba(10,15,30,0.9)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/onboarding-tasks")}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl shrink-0"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 0 16px rgba(168,85,247,0.4)" }}>
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-sm leading-tight text-white">Ponto de Encontro</h1>
                <p className="text-[11px] leading-tight" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {isInstructor ? "Gestão de treinamentos" : "Treinamentos"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {staffInfo && (
              <span className="text-xs text-white/50 hidden sm:block">{staffInfo.name}</span>
            )}
            <button onClick={async () => { await supabase.auth.signOut(); navigate("/onboarding-tasks/login"); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      {isInstructor
        ? <InstructorView staffInfo={staffInfo!} userRole={userRole!} />
        : isViewer
          ? <ViewerView />
          : <StudentView staffInfo={staffInfo!} />
      }
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// VIEWER VIEW — vendedores e outras roles internas (somente leitura)
// ══════════════════════════════════════════════════════════════════════════════
const ViewerView = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("trilhas");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [standaloneLessons, setStandaloneLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: tracksData } = await supabase
        .from("pe_tracks").select("*").eq("status", "active").order("created_at");

      const trackIds = (tracksData || []).map((t: any) => t.id);
      let lessonsInTracks: any[] = [];
      if (trackIds.length > 0) {
        const { data: tl } = await supabase.from("pe_lessons")
          .select("*").in("track_id", trackIds).eq("status", "active").order("position");
        lessonsInTracks = tl || [];
      }

      const builtTracks: Track[] = (tracksData || []).map((t: any) => ({
        ...t,
        lessons: lessonsInTracks.filter((l: any) => l.track_id === t.id),
        completedCount: 0,
        totalCount: lessonsInTracks.filter((l: any) => l.track_id === t.id).length,
      }));
      setTracks(builtTracks);

      const { data: slData } = await supabase.from("pe_lessons")
        .select("*").is("track_id", null).eq("status", "active").order("lesson_date", { ascending: false });
      setStandaloneLessons(slData || []);
    } catch (err: any) {
      toast.error("Erro ao carregar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTracks = useMemo(() =>
    tracks.filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase())),
    [tracks, search]);
  const filteredLessons = useMemo(() =>
    standaloneLessons.filter(l => !search || l.title.toLowerCase().includes(search.toLowerCase())),
    [standaloneLessons, search]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="h-5 w-5 animate-spin text-violet-400" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
        <Input placeholder="Buscar trilhas ou aulas..." value={search} onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/30" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 border border-white/10 mb-5">
          <TabsTrigger value="trilhas" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white/60">
            <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Trilhas
          </TabsTrigger>
          <TabsTrigger value="avulsas" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white/60">
            <Video className="h-3.5 w-3.5 mr-1.5" /> Aulas Avulsas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trilhas">
          {filteredTracks.length === 0 ? (
            <p className="text-center text-white/40 py-16 text-sm">Nenhuma trilha disponível.</p>
          ) : (
            <div className="space-y-4">
              {filteredTracks.map(track => (
                <div key={track.id} className="rounded-xl border border-white/10 overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white truncate">{track.title}</p>
                      {track.description && <p className="text-xs text-white/40 truncate">{track.description}</p>}
                    </div>
                    <span className="text-[11px] text-white/40 shrink-0">{track.totalCount} aula{track.totalCount !== 1 ? "s" : ""}</span>
                  </div>
                  {(track.lessons || []).length === 0 ? (
                    <p className="text-xs text-white/30 px-4 py-3">Nenhuma aula disponível.</p>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {(track.lessons || []).map((lesson, idx) => (
                        <button key={lesson.id} onClick={() => navigate(`/ponto-de-encontro/aula/${lesson.id}`)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left">
                          <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                            <Play className="h-3 w-3 text-violet-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/80 truncate">{lesson.title}</p>
                            <p className="text-[11px] text-white/40">{fmtDuration(lesson.duration_minutes)}{lesson.lesson_date ? ` · ${format(new Date(lesson.lesson_date), "dd/MM/yyyy", { locale: ptBR })}` : ""}</p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-white/20 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="avulsas">
          {filteredLessons.length === 0 ? (
            <p className="text-center text-white/40 py-16 text-sm">Nenhuma aula avulsa disponível.</p>
          ) : (
            <div className="space-y-2">
              {filteredLessons.map(lesson => (
                <button key={lesson.id} onClick={() => navigate(`/ponto-de-encontro/aula/${lesson.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 hover:border-violet-500/30 hover:bg-violet-500/5 transition-colors text-left"
                  style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                    <Play className="h-4 w-4 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 font-medium truncate">{lesson.title}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">{fmtDuration(lesson.duration_minutes)}{lesson.lesson_date ? ` · ${format(new Date(lesson.lesson_date), "dd/MM/yyyy", { locale: ptBR })}` : ""} · {lesson.video_state === "live" ? "🔴 Ao vivo" : "🎬 Gravada"}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-white/20 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT VIEW
// ══════════════════════════════════════════════════════════════════════════════
const StudentView = ({ staffInfo }: { staffInfo: StaffInfo }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("trilhas");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [standaloneLessons, setStandaloneLessons] = useState<Lesson[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [points, setPoints] = useState<PointsTotal>({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Tracks with lessons
      const { data: tracksData } = await supabase
        .from("pe_tracks").select("*").eq("status", "active").order("created_at");

      // Progress map
      const { data: progressData } = await supabase
        .from("pe_progress").select("*").eq("staff_id", staffInfo.id);
      const progressMap = new Map((progressData || []).map((p: any) => [p.lesson_id, p]));

      // Lessons in tracks
      const trackIds = (tracksData || []).map((t: any) => t.id);
      let lessonsInTracks: any[] = [];
      if (trackIds.length > 0) {
        const { data: tl } = await supabase.from("pe_lessons")
          .select("*").in("track_id", trackIds).eq("status", "active").order("position");
        lessonsInTracks = tl || [];
      }

      // Build tracks with lessons + progress + locking
      const builtTracks: Track[] = (tracksData || []).map((t: any) => {
        const lessons = lessonsInTracks.filter(l => l.track_id === t.id).map((l, idx, arr) => {
          const prog = progressMap.get(l.id);
          const completed = prog?.completed ?? false;
          // locked if previous lesson not completed (first is always unlocked)
          const locked = idx > 0 && !(progressMap.get(arr[idx - 1]?.id)?.completed);
          return { ...l, progress: prog?.percent_watched ?? 0, completed, locked };
        });
        const completedCount = lessons.filter(l => l.completed).length;
        return { ...t, lessons, completedCount, totalCount: lessons.length };
      });

      setTracks(builtTracks);

      // Standalone lessons
      const { data: slData } = await supabase.from("pe_lessons")
        .select("*").is("track_id", null).eq("status", "active").order("lesson_date", { ascending: false });
      const standalone = (slData || []).map((l: any) => {
        const prog = progressMap.get(l.id);
        return { ...l, progress: prog?.percent_watched ?? 0, completed: prog?.completed ?? false };
      });
      setStandaloneLessons(standalone);

      // Certificates
      const { data: certs } = await supabase.from("pe_certificates")
        .select("*, pe_lessons(title, duration_minutes), pe_tracks(title)")
        .eq("staff_id", staffInfo.id).order("issued_at", { ascending: false });
      setCertificates(certs || []);

      // Points total
      const { data: ptData } = await supabase.from("pe_points_log")
        .select("points").eq("staff_id", staffInfo.id);
      const total = (ptData || []).reduce((sum: number, r: any) => sum + (r.points || 0), 0);
      setPoints({ total });

    } catch (err: any) {
      toast.error("Erro ao carregar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTracks = useMemo(() =>
    tracks.filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase())),
    [tracks, search]);

  const filteredLessons = useMemo(() =>
    standaloneLessons.filter(l => !search || l.title.toLowerCase().includes(search.toLowerCase())),
    [standaloneLessons, search]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Points banner */}
      <div className="mb-5 p-4 rounded-xl border border-violet-500/30 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(168,85,247,0.08))" }}>
        <div>
          <p className="text-xs text-white/50 mb-0.5">Seus pontos</p>
          <p className="text-2xl font-bold text-white">{points.total.toLocaleString("pt-BR")}</p>
        </div>
        <Trophy className="h-8 w-8 text-violet-400/60" />
      </div>

      {/* Search + Tabs */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
        <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/30" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 border border-white/10 mb-5">
          <TabsTrigger value="trilhas" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white/60">
            <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Trilhas
          </TabsTrigger>
          <TabsTrigger value="avulsas" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white/60">
            <Video className="h-3.5 w-3.5 mr-1.5" /> Aulas Avulsas
          </TabsTrigger>
          <TabsTrigger value="certificados" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white/60">
            <Award className="h-3.5 w-3.5 mr-1.5" /> Certificados
            {certificates.length > 0 && (
              <Badge className="ml-1.5 h-4 px-1.5 text-[10px] bg-violet-500 text-white border-0">{certificates.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TRILHAS */}
        <TabsContent value="trilhas">
          {loading ? <Spinner /> : filteredTracks.length === 0 ? (
            <EmptyState icon={BookOpen} text="Nenhuma trilha disponível no momento." />
          ) : (
            <div className="space-y-4">
              {filteredTracks.map(track => (
                <TrackCard key={track.id} track={track} onSelectLesson={lessonId =>
                  navigate(`/ponto-de-encontro/aula/${lessonId}`)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* AULAS AVULSAS */}
        <TabsContent value="avulsas">
          {loading ? <Spinner /> : filteredLessons.length === 0 ? (
            <EmptyState icon={Video} text="Nenhuma aula avulsa disponível." />
          ) : (
            <div className="grid gap-3">
              {filteredLessons.map(lesson => (
                <LessonCard key={lesson.id} lesson={lesson} onClick={() =>
                  navigate(`/ponto-de-encontro/aula/${lesson.id}`)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* CERTIFICADOS */}
        <TabsContent value="certificados">
          {loading ? <Spinner /> : certificates.length === 0 ? (
            <EmptyState icon={Award} text="Nenhum certificado ainda. Conclua aulas para ganhar!" />
          ) : (
            <div className="grid gap-3">
              {certificates.map((cert: any) => (
                <CertificateCard key={cert.id} cert={cert} staffName={staffInfo.name} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ── Track Card (student) ───────────────────────────────────────────────────
const TrackCard = ({ track, onSelectLesson }: { track: Track; onSelectLesson: (id: string) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const progress = track.totalCount ? Math.round(((track.completedCount || 0) / track.totalCount) * 100) : 0;

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)" }}>
      {/* Track header */}
      <button className="w-full text-left p-4 hover:bg-white/5 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm">{track.title}</h3>
            {track.description && (
              <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{track.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-white/40">{track.completedCount}/{track.totalCount} aulas</span>
              {track.totalCount && track.totalCount > 0 && (
                <div className="flex-1 max-w-32 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-violet-500 transition-all"
                    style={{ width: `${progress}%` }} />
                </div>
              )}
              <span className="text-xs text-violet-400">{progress}%</span>
            </div>
          </div>
          <ChevronRight className={cn("h-4 w-4 text-white/40 transition-transform shrink-0 mt-0.5", expanded && "rotate-90")} />
        </div>
      </button>

      {/* Lessons list */}
      {expanded && track.lessons && (
        <div className="border-t border-white/10 divide-y divide-white/5">
          {track.lessons.map((lesson, idx) => (
            <button
              key={lesson.id}
              disabled={lesson.locked}
              onClick={() => !lesson.locked && onSelectLesson(lesson.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                lesson.locked ? "opacity-50 cursor-not-allowed" : "hover:bg-white/5"
              )}>
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                lesson.completed ? "bg-emerald-500/20 text-emerald-400" :
                lesson.locked ? "bg-white/10 text-white/30" : "bg-violet-500/20 text-violet-400"
              )}>
                {lesson.completed ? <CheckCircle2 className="h-4 w-4" /> :
                 lesson.locked ? <Lock className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", lesson.locked ? "text-white/40" : "text-white")}>{lesson.title}</p>
                <p className="text-[11px] text-white/40 mt-0.5">{fmtDuration(lesson.duration_minutes)} · {lesson.video_state === "live" ? "🔴 Ao vivo" : "🎬 Gravada"}</p>
              </div>
              {!lesson.locked && lesson.progress > 0 && !lesson.completed && (
                <div className="shrink-0 text-xs text-violet-400">{lesson.progress}%</div>
              )}
              {!lesson.locked && <Play className="h-3.5 w-3.5 text-white/30 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Lesson Card ────────────────────────────────────────────────────────────
const LessonCard = ({ lesson, onClick }: { lesson: Lesson; onClick: () => void }) => (
  <button onClick={onClick}
    className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-white/10 hover:border-violet-500/40 hover:bg-white/5 transition-all text-left group"
    style={{ background: "rgba(255,255,255,0.02)" }}>
    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
      lesson.completed ? "bg-emerald-500/20" : "bg-violet-500/20")}>
      {lesson.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> :
        <Play className="h-5 w-5 text-violet-400" />}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm text-white truncate">{lesson.title}</p>
      <p className="text-[11px] text-white/40 mt-0.5">
        {fmtDuration(lesson.duration_minutes)}
        {lesson.lesson_date && ` · ${format(new Date(lesson.lesson_date), "dd/MM/yyyy", { locale: ptBR })}`}
        {" · "}{lesson.video_state === "live" ? "🔴 Ao vivo" : "🎬 Gravada"}
      </p>
    </div>
    {lesson.progress > 0 && !lesson.completed && (
      <div className="shrink-0 w-12">
        <div className="h-1 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-violet-500" style={{ width: `${lesson.progress}%` }} />
        </div>
        <p className="text-[10px] text-violet-400 text-right mt-0.5">{lesson.progress}%</p>
      </div>
    )}
    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-white/60 shrink-0 transition-colors" />
  </button>
);

// ── Certificate Card ───────────────────────────────────────────────────────
const CertificateCard = ({ cert, staffName }: { cert: any; staffName: string }) => {
  const navigate = useNavigate();
  const title = cert.cert_type === "lesson" ? cert.pe_lessons?.title : cert.pe_tracks?.title;
  const duration = cert.cert_type === "lesson" ? cert.pe_lessons?.duration_minutes : null;

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/20 hover:border-yellow-500/40 transition-colors"
      style={{ background: "rgba(234,179,8,0.05)" }}>
      <Award className="h-8 w-8 text-yellow-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-white truncate">{title}</p>
        <p className="text-xs text-white/40 mt-0.5">
          {cert.cert_type === "lesson" ? "Certificado de Aula" : "Certificado de Trilha"}
          {duration ? ` · ${fmtDuration(duration)}` : ""}
          {" · "}{format(new Date(cert.issued_at), "dd/MM/yyyy", { locale: ptBR })}
        </p>
        <p className="text-[10px] text-white/30 font-mono mt-0.5">Código: {cert.code}</p>
      </div>
      <Button size="sm" variant="outline"
        className="shrink-0 text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300"
        onClick={() => navigate(`/ponto-de-encontro/certificado/${cert.id}`)}>
        Ver
      </Button>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// INSTRUCTOR VIEW
// ══════════════════════════════════════════════════════════════════════════════
const InstructorView = ({ staffInfo, userRole }: { staffInfo: StaffInfo; userRole: UserRole }) => {
  const [tab, setTab] = useState("trilhas");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [showTrackDialog, setShowTrackDialog] = useState(false);
  const [showLessonDialog, setShowLessonDialog] = useState(false);
  const [editTrack, setEditTrack] = useState<Track | null>(null);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingMeet, setLoadingMeet] = useState(false);
  const [searchingRecording, setSearchingRecording] = useState(false);
  const [foundRecordings, setFoundRecordings] = useState<{ id: string; name: string; link: string; createdTime: string }[]>([]);
  const [attendanceLesson, setAttendanceLesson] = useState<Lesson | null>(null);
  const [attendanceList, setAttendanceList] = useState<{ name: string; completed_at: string }[]>([]);

  // Forms
  const [trackForm, setTrackForm] = useState({ title: "", description: "", status: "draft" as const });

  const emptyLessonForm = {
    title: "", description: "", video_url: "", duration_minutes: 60,
    lesson_date: "", status: "draft" as "draft" | "active" | "hidden",
    video_state: "live" as "live" | "recorded",
    track_id: "", position: 0,
    conferencing_type: "meet" as "meet" | "youtube" | "none",
    scheduled_at: "",
    host_staff_id: "",
    host_external_email: "",
    extra_attendee_emails: "",
    meet_link: "",
    calendar_event_id: "",
    checkin_code: "",
    min_watch_minutes: 0,
  };
  const [lessonForm, setLessonForm] = useState(emptyLessonForm);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: tr }, { data: ls }, { data: co }] = await Promise.all([
        supabase.from("pe_tracks").select("*").order("created_at", { ascending: false }),
        supabase.from("pe_lessons").select("*").order("track_id, position"),
        supabase.from("onboarding_companies").select("id, name").eq("status", "active").order("name"),
      ]);
      setTracks(tr || []);
      setLessons(ls || []);
      setCompanies(co || []);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  // ── Track CRUD ─────────────────────────────────────────────────────────
  const openNewTrack = () => {
    setEditTrack(null);
    setTrackForm({ title: "", description: "", status: "draft" });
    setShowTrackDialog(true);
  };
  const openEditTrack = (t: Track) => {
    setEditTrack(t);
    setTrackForm({ title: t.title, description: t.description || "", status: t.status });
    setShowTrackDialog(true);
  };
  const saveTrack = async () => {
    if (!trackForm.title.trim()) { toast.error("Título obrigatório"); return; }
    if (editTrack) {
      const { error } = await supabase.from("pe_tracks")
        .update({ ...trackForm, updated_at: new Date().toISOString() }).eq("id", editTrack.id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      toast.success("Trilha atualizada");
    } else {
      const { error } = await supabase.from("pe_tracks")
        .insert({ ...trackForm, created_by: staffInfo.id });
      if (error) { toast.error("Erro ao criar trilha: " + error.message); return; }
      toast.success("Trilha criada");
    }
    setShowTrackDialog(false);
    loadAll();
  };
  const deleteTrack = async (id: string) => {
    if (!confirm("Excluir trilha? As aulas serão desvinculadas.")) return;
    const { error } = await supabase.from("pe_tracks").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Trilha excluída");
    loadAll();
  };
  const cycleTrackStatus = async (t: Track) => {
    const next = t.status === "draft" ? "active" : t.status === "active" ? "hidden" : "draft";
    const { error } = await supabase.from("pe_tracks")
      .update({ status: next, updated_at: new Date().toISOString() }).eq("id", t.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    loadAll();
  };

  // ── Staff + Calendar ───────────────────────────────────────────────────
  const loadStaffWithCalendar = async () => {
    const { data: all } = await supabase
      .from("onboarding_staff").select("id, name, user_id").eq("is_active", true).order("name");
    if (!all) { setStaffList([]); return; }
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session?.access_token) { setStaffList(all.map(s => ({ ...s, hasCalendar: false }))); return; }
    try {
      const res = await supabase.functions.invoke("google-calendar?action=list-connected-staff", {
        headers: { Authorization: `Bearer ${sess.session.access_token}` },
      });
      const ids: string[] = res.data?.staff?.map((s: any) => s.id) || [];
      setStaffList(all.map(s => ({ ...s, hasCalendar: ids.includes(s.id) })));
    } catch {
      setStaffList(all.map(s => ({ ...s, hasCalendar: false })));
    }
  };

  const fetchRecording = async () => {
    const scheduledStr = lessonForm.scheduled_at || editLesson?.scheduled_at;
    if (!scheduledStr) { toast.error("Aula sem data/hora agendada"); return; }
    const hostStaff = lessonForm.host_staff_id ? staffList.find(s => s.id === lessonForm.host_staff_id) : null;
    setSearchingRecording(true);
    setFoundRecordings([]);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session?.access_token) return;
      const params = hostStaff?.user_id
        ? `action=fetch-recordings&target_user_id=${hostStaff.user_id}`
        : `action=fetch-recordings`;
      const res = await supabase.functions.invoke(`google-calendar?${params}`, {
        headers: { Authorization: `Bearer ${sess.session.access_token}` },
      });
      if (res.data?.needsDriveAuth) {
        toast.warning(res.data.message || "Reconecte o Google com permissão do Drive");
        return;
      }
      const all: { id: string; name: string; link: string; createdTime: string }[] = res.data?.recordings || [];
      const scheduled = new Date(scheduledStr);
      const windowStart = new Date(scheduled.getTime() - 30 * 60000);
      const windowEnd = new Date(scheduled.getTime() + ((Number(lessonForm.duration_minutes) || 60) + 90) * 60000);
      const matched = all.filter(r => {
        const t = new Date(r.createdTime);
        return t >= windowStart && t <= windowEnd;
      });
      if (matched.length > 0) {
        setFoundRecordings(matched);
      } else {
        setFoundRecordings(all.slice(0, 8));
        toast.info("Nenhuma gravação no horário da aula — exibindo as mais recentes");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao buscar gravações no Drive");
    } finally {
      setSearchingRecording(false);
    }
  };

  const openAttendance = async (lesson: Lesson) => {
    setAttendanceLesson(lesson);
    const { data } = await supabase
      .from("pe_progress")
      .select("completed_at, onboarding_staff!inner(name)")
      .eq("lesson_id", lesson.id)
      .eq("completed", true)
      .order("completed_at", { ascending: false });
    setAttendanceList((data || []).map((r: any) => ({
      name: r.onboarding_staff?.name || "—",
      completed_at: r.completed_at || "",
    })));
  };

  // ── Lesson CRUD ────────────────────────────────────────────────────────
  const openNewLesson = () => {
    setEditLesson(null);
    // default scheduled_at = tomorrow 09:00
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const localDt = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setLessonForm({ ...emptyLessonForm, scheduled_at: localDt });
    loadStaffWithCalendar();
    setShowLessonDialog(true);
  };
  const openEditLesson = (l: Lesson) => {
    setEditLesson(l);
    const localDt = l.scheduled_at
      ? (() => { const d = new Date(l.scheduled_at); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; })()
      : "";
    setLessonForm({
      title: l.title, description: l.description || "", video_url: l.video_url || "",
      duration_minutes: l.duration_minutes, lesson_date: l.lesson_date || "",
      status: l.status, video_state: l.video_state, track_id: l.track_id || "", position: l.position,
      conferencing_type: l.meet_link ? "meet" : l.video_url ? "youtube" : "none",
      scheduled_at: localDt,
      host_staff_id: l.host_staff_id || "",
      host_external_email: "",
      extra_attendee_emails: l.extra_attendee_emails || "",
      meet_link: l.meet_link || "",
      calendar_event_id: l.calendar_event_id || "",
      checkin_code: l.checkin_code || "",
      min_watch_minutes: l.min_watch_minutes || 0,
    });
    loadStaffWithCalendar();
    setShowLessonDialog(true);
  };
  const saveLesson = async () => {
    if (!lessonForm.title.trim()) { toast.error("Título obrigatório"); return; }

    let meetLink = lessonForm.meet_link || "";
    let calEventId = lessonForm.calendar_event_id || "";

    // Create Google Calendar event with Meet link if needed
    if (lessonForm.conferencing_type === "meet" && lessonForm.scheduled_at && !editLesson) {
      setLoadingMeet(true);
      try {
        const host = lessonForm.host_staff_id ? staffList.find(s => s.id === lessonForm.host_staff_id) : null;
        const startDate = new Date(lessonForm.scheduled_at);
        const endDate = new Date(startDate.getTime() + (Number(lessonForm.duration_minutes) || 60) * 60000);
        const attendees = [
          ...(lessonForm.host_external_email.trim() ? [lessonForm.host_external_email.trim()] : []),
          ...lessonForm.extra_attendee_emails.split(/[\n,]/).map(e => e.trim()).filter(Boolean),
        ];
        const { data: sess } = await supabase.auth.getSession();
        if (sess?.session?.access_token) {
          const targetUserId = host?.user_id || staffInfo?.id ? (
            host?.hasCalendar ? host?.user_id : staffInfo?.id
          ) : null;
          if (targetUserId) {
            const res = await supabase.functions.invoke("google-calendar?action=create-event", {
              body: {
                title: lessonForm.title.trim(),
                description: lessonForm.description || `Aula ao vivo — Ponto de Encontro`,
                startDateTime: startDate.toISOString(),
                endDateTime: endDate.toISOString(),
                target_user_id: targetUserId,
                attendees,
              },
              headers: { Authorization: `Bearer ${sess.session.access_token}` },
            });
            if (res.data?.event) {
              meetLink = res.data.event.hangoutLink || res.data.event.conferenceData?.entryPoints?.[0]?.uri || "";
              calEventId = res.data.event.id || "";
            }
          }
        }
      } catch (e) {
        console.error(e);
        toast.warning("Evento criado sem Google Calendar — verifique a integração");
      } finally {
        setLoadingMeet(false);
      }
    }

    const scheduledDate = lessonForm.scheduled_at ? lessonForm.scheduled_at.split("T")[0] : lessonForm.lesson_date || null;
    const payload: Record<string, unknown> = {
      title: lessonForm.title.trim(),
      description: lessonForm.description || null,
      video_url: lessonForm.conferencing_type === "youtube" ? (lessonForm.video_url || null) : (editLesson?.video_url ?? null),
      duration_minutes: Number(lessonForm.duration_minutes) || 0,
      lesson_date: scheduledDate,
      status: lessonForm.status,
      video_state: lessonForm.video_state,
      track_id: lessonForm.track_id || null,
      position: Number(lessonForm.position) || 0,
      updated_at: new Date().toISOString(),
      meet_link: meetLink || null,
      calendar_event_id: calEventId || null,
      scheduled_at: lessonForm.scheduled_at ? new Date(lessonForm.scheduled_at).toISOString() : null,
      host_staff_id: lessonForm.host_staff_id || null,
      extra_attendee_emails: lessonForm.extra_attendee_emails.trim() || null,
      checkin_code: lessonForm.checkin_code.trim() || null,
      min_watch_minutes: Number(lessonForm.min_watch_minutes) || 0,
    };

    if (editLesson) {
      const { error } = await supabase.from("pe_lessons").update(payload).eq("id", editLesson.id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      toast.success("Aula atualizada");
    } else {
      const { error } = await supabase.from("pe_lessons").insert({ ...payload, created_by: staffInfo!.id });
      if (error) { toast.error("Erro ao criar aula: " + error.message); return; }
      if (meetLink) {
        navigator.clipboard.writeText(meetLink).catch(() => {});
        toast.success("Aula criada · link Meet copiado");
      } else {
        toast.success("Aula criada");
      }
    }
    setShowLessonDialog(false);
    loadAll();
  };
  const deleteLesson = async (id: string) => {
    if (!confirm("Excluir aula? Progresso e certificados vinculados serão removidos.")) return;
    await supabase.from("pe_lessons").delete().eq("id", id);
    toast.success("Aula excluída");
    loadAll();
  };
  const cycleLessonStatus = async (l: Lesson) => {
    const next = l.status === "draft" ? "active" : l.status === "active" ? "hidden" : "draft";
    await supabase.from("pe_lessons").update({ status: next, updated_at: new Date().toISOString() }).eq("id", l.id);
    loadAll();
  };

  const startLesson = async (l: Lesson) => {
    const { error } = await supabase.from("pe_lessons")
      .update({ status: "active", video_state: "live", updated_at: new Date().toISOString() })
      .eq("id", l.id);
    if (error) { toast.error("Erro ao iniciar aula"); return; }
    toast.success("Aula iniciada · alunos já podem acessar");
    loadAll();
  };

  const endLesson = async (l: Lesson) => {
    if (!confirm("Encerrar aula ao vivo? O video_state será marcado como 'gravada'.")) return;
    const { error } = await supabase.from("pe_lessons")
      .update({ video_state: "recorded", updated_at: new Date().toISOString() })
      .eq("id", l.id);
    if (error) { toast.error("Erro ao encerrar aula"); return; }
    toast.success("Aula encerrada · edite para adicionar a gravação");
    loadAll();
  };

  const trackMap = useMemo(() => new Map(tracks.map(t => [t.id, t.title])), [tracks]);
  const trackLessons = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const l of lessons) {
      if (l.track_id) {
        if (!map.has(l.track_id)) map.set(l.track_id, []);
        map.get(l.track_id)!.push(l);
      }
    }
    return map;
  }, [lessons]);
  const standaloneLessons = useMemo(() => lessons.filter(l => !l.track_id), [lessons]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="trilhas" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white/60">
              <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Trilhas
            </TabsTrigger>
            <TabsTrigger value="aulas" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white/60">
              <Video className="h-3.5 w-3.5 mr-1.5" /> Aulas
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-white/60">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Dashboard
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button size="sm" variant="outline"
              className="border-white/20 text-white/70 hover:bg-white/10"
              onClick={openNewLesson}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova Aula
            </Button>
            <Button size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={openNewTrack}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova Trilha
            </Button>
          </div>
        </div>

        {/* TRILHAS */}
        <TabsContent value="trilhas">
          {loading ? <Spinner /> : tracks.length === 0 ? (
            <EmptyState icon={BookOpen} text="Nenhuma trilha criada ainda." action={{ label: "Criar Trilha", onClick: openNewTrack }} />
          ) : (
            <div className="space-y-4">
              {tracks.map(track => {
                const tLessons = trackLessons.get(track.id) || [];
                return (
                  <div key={track.id} className="rounded-xl border border-white/10 overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-white text-sm">{track.title}</h3>
                          <Badge className={cn("text-[10px] h-4 px-1.5 border", STATUS_COLORS[track.status])}>
                            {STATUS_LABELS[track.status]}
                          </Badge>
                        </div>
                        {track.description && <p className="text-xs text-white/50 mt-1">{track.description}</p>}
                        <p className="text-[11px] text-white/40 mt-1.5">{tLessons.length} aula{tLessons.length !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => cycleTrackStatus(track)}
                          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="Alterar status">
                          {track.status === "active" ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => openEditTrack(track)}
                          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteTrack(track.id)}
                          className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {tLessons.length > 0 && (
                      <div className="border-t border-white/10 divide-y divide-white/5">
                        {tLessons.map((l, idx) => (
                          <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                            <span className="w-5 text-xs text-white/30 text-center">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white/80 truncate">{l.title}</p>
                              <p className="text-[11px] text-white/40">{fmtDuration(l.duration_minutes)} · {l.video_state === "live" ? "🔴 Ao vivo" : "🎬 Gravada"}</p>
                            </div>
                            <Badge className={cn("text-[10px] h-4 px-1.5 border shrink-0", STATUS_COLORS[l.status])}>
                              {STATUS_LABELS[l.status]}
                            </Badge>
                            <button onClick={() => openEditLesson(l)}
                              className="p-1 rounded text-white/30 hover:text-white/70 transition-colors">
                              <Edit3 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* AULAS */}
        <TabsContent value="aulas">
          {loading ? <Spinner /> : (
            <div className="space-y-2">
              {/* Standalone */}
              {standaloneLessons.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Aulas Avulsas</p>
                  <div className="space-y-1.5">
                    {standaloneLessons.map(l => (
                      <InstructorLessonRow key={l.id} lesson={l} onEdit={openEditLesson}
                        onDelete={deleteLesson} onCycleStatus={cycleLessonStatus} onAttendance={openAttendance}
                        onStartLesson={startLesson} onEndLesson={endLesson} />
                    ))}
                  </div>
                </div>
              )}
              {/* In tracks */}
              {tracks.map(track => {
                const tl = trackLessons.get(track.id) || [];
                if (!tl.length) return null;
                return (
                  <div key={track.id} className="mb-2">
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-2">📚 {track.title}</p>
                    <div className="space-y-1.5">
                      {tl.map(l => (
                        <InstructorLessonRow key={l.id} lesson={l} onEdit={openEditLesson}
                          onDelete={deleteLesson} onCycleStatus={cycleLessonStatus} onAttendance={openAttendance}
                          onStartLesson={startLesson} onEndLesson={endLesson} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {lessons.length === 0 && (
                <EmptyState icon={Video} text="Nenhuma aula criada ainda." action={{ label: "Criar Aula", onClick: openNewLesson }} />
              )}
            </div>
          )}
        </TabsContent>

        {/* DASHBOARD */}
        <TabsContent value="dashboard">
          <InstructorDashboard />
        </TabsContent>
      </Tabs>

      {/* Attendance Dialog */}
      <Dialog open={!!attendanceLesson} onOpenChange={v => !v && setAttendanceLesson(null)}>
        <DialogContent className="bg-[#0f1629] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-400" /> Presenças — {attendanceLesson?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 max-h-[60vh] overflow-y-auto space-y-1">
            {attendanceList.length === 0 ? (
              <p className="text-center text-white/40 py-8 text-sm">Nenhuma presença confirmada ainda.</p>
            ) : (
              <>
                <p className="text-xs text-white/40 mb-3">{attendanceList.length} presença{attendanceList.length !== 1 ? "s" : ""} confirmada{attendanceList.length !== 1 ? "s" : ""}</p>
                {attendanceList.map((a, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-sm text-white/80">{a.name}</span>
                    </div>
                    {a.completed_at && (
                      <span className="text-[11px] text-white/30">
                        {format(new Date(a.completed_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAttendanceLesson(null)} className="text-white/60">Fechar</Button>
            <Button variant="outline" className="border-white/10 text-white/70" onClick={() => openAttendance(attendanceLesson!)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Track Dialog */}
      <Dialog open={showTrackDialog} onOpenChange={setShowTrackDialog}>
        <DialogContent className="bg-[#0f1629] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editTrack ? "Editar Trilha" : "Nova Trilha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-white/70">Título *</Label>
              <Input value={trackForm.title} onChange={e => setTrackForm(f => ({ ...f, title: e.target.value }))}
                className="bg-white/5 border-white/10 text-white" placeholder="Ex: Técnicas de Fechamento" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Descrição</Label>
              <Textarea value={trackForm.description} onChange={e => setTrackForm(f => ({ ...f, description: e.target.value }))}
                className="bg-white/5 border-white/10 text-white resize-none" rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Status</Label>
              <Select value={trackForm.status} onValueChange={v => setTrackForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="hidden">Oculta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTrackDialog(false)} className="text-white/60">Cancelar</Button>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={saveTrack}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={showLessonDialog} onOpenChange={setShowLessonDialog}>
        <DialogContent className="bg-[#0f1629] border-white/10 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle>{editLesson ? "Editar Aula" : "Nova Aula"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-1">

            {/* Basic info */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-white/70">Título *</Label>
                <Input value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">Descrição</Label>
                <Textarea value={lessonForm.description} onChange={e => setLessonForm(f => ({ ...f, description: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white resize-none" rows={2} />
              </div>
            </div>

            {/* Conferencing type */}
            <div className="space-y-2">
              <Label className="text-white/70">Formato</Label>
              <div className="flex gap-2">
                {([["meet", "Google Meet", "🎥"], ["youtube", "YouTube / Vimeo", "▶️"], ["none", "Sem vídeo", "—"]] as const).map(([v, lbl, ic]) => (
                  <button key={v} onClick={() => setLessonForm(f => ({
                    ...f, conferencing_type: v,
                    video_state: v === "youtube" ? "recorded" : v === "meet" ? "live" : f.video_state,
                  }))}
                    className={cn("flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors",
                      lessonForm.conferencing_type === v
                        ? "border-violet-500 bg-violet-500/20 text-violet-300"
                        : "border-white/10 bg-white/5 text-white/50 hover:border-white/20")}>
                    {ic} {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Google Meet section */}
            {lessonForm.conferencing_type === "meet" && (
              <div className="space-y-3 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                <p className="text-xs text-violet-300 font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Agendamento — Google Meet
                </p>

                {/* Host */}
                <div className="space-y-1.5">
                  <Label className="text-white/60 text-xs">Apresentador / Host</Label>
                  <Select value={lessonForm.host_staff_id || "external"} onValueChange={v => setLessonForm(f => ({ ...f, host_staff_id: v === "external" ? "" : v }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm"><SelectValue placeholder="Selecionar usuário..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="external">— Externo (informar e-mail abaixo)</SelectItem>
                      {staffList.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} {s.hasCalendar ? "📅" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!lessonForm.host_staff_id && (
                    <Input value={lessonForm.host_external_email}
                      onChange={e => setLessonForm(f => ({ ...f, host_external_email: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white text-sm" placeholder="email@externo.com" />
                  )}
                  {lessonForm.host_staff_id && !staffList.find(s => s.id === lessonForm.host_staff_id)?.hasCalendar && (
                    <p className="text-[11px] text-amber-400">⚠️ Este usuário não tem Google Calendar conectado — o evento será criado na sua agenda</p>
                  )}
                </div>

                {/* Date + Time + Duration */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-white/60 text-xs">Data e Hora</Label>
                    <Input type="datetime-local" value={lessonForm.scheduled_at}
                      onChange={e => setLessonForm(f => ({ ...f, scheduled_at: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/60 text-xs">Duração (min)</Label>
                    <Input type="number" value={lessonForm.duration_minutes}
                      onChange={e => setLessonForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}
                      className="bg-white/5 border-white/10 text-white text-sm" min={15} step={15} />
                  </div>
                </div>

                {/* Attendees */}
                <div className="space-y-1.5">
                  <Label className="text-white/60 text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Convidados adicionais (e-mails, um por linha)</Label>
                  <Textarea value={lessonForm.extra_attendee_emails}
                    onChange={e => setLessonForm(f => ({ ...f, extra_attendee_emails: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white text-sm resize-none" rows={3}
                    placeholder={"aluno@empresa.com\nfulano@gmail.com"} />
                </div>

                {/* Existing meet link (edit mode) */}
                {editLesson && lessonForm.meet_link && (
                  <div className="space-y-1.5">
                    <Label className="text-white/60 text-xs">Link Google Meet</Label>
                    <div className="flex gap-2">
                      <Input value={lessonForm.meet_link} readOnly className="bg-white/5 border-white/10 text-emerald-400 text-sm" />
                      <button onClick={() => { navigator.clipboard.writeText(lessonForm.meet_link); toast.success("Copiado!"); }}
                        className="px-2 rounded border border-white/10 text-white/50 hover:text-white transition-colors">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Recording URL (edit mode — paste or fetch after meeting) */}
                {editLesson && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-white/60 text-xs flex items-center gap-1"><Link2 className="h-3 w-3" /> URL da gravação</Label>
                      <button onClick={fetchRecording} disabled={searchingRecording}
                        className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50">
                        {searchingRecording
                          ? <><Loader2 className="h-3 w-3 animate-spin" /> Buscando...</>
                          : <><RefreshCw className="h-3 w-3" /> Buscar no Drive</>}
                      </button>
                    </div>
                    <Input value={lessonForm.video_url}
                      onChange={e => setLessonForm(f => ({ ...f, video_url: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white text-sm"
                      placeholder="https://drive.google.com/... ou cole após a reunião" />
                    {foundRecordings.length > 0 && (
                      <div className="rounded-lg border border-violet-500/20 bg-[#0a0f20] divide-y divide-white/5">
                        <p className="text-[10px] text-white/40 px-3 py-1.5">Selecione a gravação:</p>
                        {foundRecordings.map(r => (
                          <button key={r.id} onClick={async () => {
                            setLessonForm(f => ({ ...f, video_url: r.link }));
                            setFoundRecordings([]);
                            // Auto-share: make the recording visible to anyone with the link
                            try {
                              const { data: sess } = await supabase.auth.getSession();
                              const hostStaff = lessonForm.host_staff_id ? staffList.find(s => s.id === lessonForm.host_staff_id) : null;
                              const params = hostStaff?.user_id
                                ? `action=set-drive-permission&target_user_id=${hostStaff.user_id}`
                                : `action=set-drive-permission`;
                              const res = await supabase.functions.invoke(`google-calendar?${params}`, {
                                body: { fileId: r.id },
                                headers: { Authorization: `Bearer ${sess?.session?.access_token}` },
                              });
                              if (res.data?.needsReauth) {
                                toast.warning("Reconecte o Google Calendar para liberar permissões automáticas no Drive");
                              } else if (res.data?.success) {
                                toast.success("Gravação selecionada e compartilhada automaticamente");
                              } else {
                                toast.success("Gravação selecionada");
                              }
                            } catch {
                              toast.success("Gravação selecionada");
                            }
                          }} className="w-full flex items-start gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left">
                            <Video className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs text-white/80 truncate">{r.name}</p>
                              <p className="text-[10px] text-white/40">
                                {new Date(r.createdTime).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* YouTube/Vimeo URL */}
            {lessonForm.conferencing_type === "youtube" && (
              <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-white/60 text-xs">Data</Label>
                    <Input type="date" value={lessonForm.lesson_date}
                      onChange={e => setLessonForm(f => ({ ...f, lesson_date: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/60 text-xs">Duração (min)</Label>
                    <Input type="number" value={lessonForm.duration_minutes}
                      onChange={e => setLessonForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}
                      className="bg-white/5 border-white/10 text-white text-sm" min={0} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/60 text-xs">Link do Vídeo</Label>
                  <Input value={lessonForm.video_url}
                    onChange={e => setLessonForm(f => ({ ...f, video_url: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white text-sm"
                    placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..." />
                </div>
              </div>
            )}

            {/* No video: just date + duration */}
            {lessonForm.conferencing_type === "none" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs">Data</Label>
                  <Input type="date" value={lessonForm.lesson_date}
                    onChange={e => setLessonForm(f => ({ ...f, lesson_date: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs">Duração (min)</Label>
                  <Input type="number" value={lessonForm.duration_minutes}
                    onChange={e => setLessonForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}
                    className="bg-white/5 border-white/10 text-white text-sm" min={0} />
                </div>
              </div>
            )}

            {/* Check-in code */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
              <p className="text-xs text-white/60 font-medium flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Check-in de presença
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-white/60 text-xs">Código de check-in (backup)</Label>
                  <div className="flex gap-2">
                    <Input value={lessonForm.checkin_code}
                      onChange={e => setLessonForm(f => ({ ...f, checkin_code: e.target.value.toUpperCase() }))}
                      className="bg-white/5 border-white/10 text-white text-sm font-mono tracking-widest"
                      placeholder="Ex: UNV-482" maxLength={10} />
                    <button type="button"
                      onClick={() => {
                        const code = "UNV-" + Math.random().toString(36).substring(2, 6).toUpperCase();
                        setLessonForm(f => ({ ...f, checkin_code: code }));
                      }}
                      className="px-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-violet-500/50 transition-colors text-xs whitespace-nowrap">
                      Gerar
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/60 text-xs">Tempo mínimo p/ presença (min)</Label>
                  <Input type="number" value={lessonForm.min_watch_minutes}
                    onChange={e => setLessonForm(f => ({ ...f, min_watch_minutes: Number(e.target.value) }))}
                    className="bg-white/5 border-white/10 text-white text-sm" min={0}
                    placeholder="0 = 50% da duração" />
                </div>
              </div>
              {lessonForm.checkin_code && (
                <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 px-3 py-2 flex items-center justify-between">
                  <p className="text-xs text-white/50">Código para exibir na aula:</p>
                  <p className="font-mono font-bold text-violet-300 tracking-widest text-lg">{lessonForm.checkin_code}</p>
                </div>
              )}
            </div>

            {/* Status + Track */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Status</Label>
                <Select value={lessonForm.status} onValueChange={v => setLessonForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="hidden">Oculta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Trilha (opcional)</Label>
                <Select value={lessonForm.track_id || "none"} onValueChange={v => setLessonForm(f => ({ ...f, track_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Avulsa (sem trilha)</SelectItem>
                    {tracks.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Posição na trilha</Label>
              <Input type="number" value={lessonForm.position}
                onChange={e => setLessonForm(f => ({ ...f, position: Number(e.target.value) }))}
                className="bg-white/5 border-white/10 text-white text-sm" min={0} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLessonDialog(false)} className="text-white/60">Cancelar</Button>
            <Button className="bg-violet-600 hover:bg-violet-700 gap-2" onClick={saveLesson} disabled={loadingMeet}>
              {loadingMeet ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Criando evento...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Instructor Lesson Row ──────────────────────────────────────────────────
const InstructorLessonRow = ({ lesson, onEdit, onDelete, onCycleStatus, onAttendance, onStartLesson, onEndLesson }: {
  lesson: Lesson;
  onEdit: (l: Lesson) => void;
  onDelete: (id: string) => void;
  onCycleStatus: (l: Lesson) => void;
  onAttendance: (l: Lesson) => void;
  onStartLesson: (l: Lesson) => void;
  onEndLesson: (l: Lesson) => void;
}) => {
  const navigate = useNavigate();
  const isLiveType = lesson.video_state === "live";
  const isCurrentlyLive = isLiveType && lesson.status === "active";
  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-colors",
      isCurrentlyLive
        ? "border-red-500/40 bg-red-500/5"
        : "border-white/10 hover:border-white/20"
    )} style={isCurrentlyLive ? {} : { background: "rgba(255,255,255,0.02)" }}>
      <button onClick={() => navigate(`/ponto-de-encontro/aula/${lesson.id}`)}
        className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors shrink-0" title="Assistir aula">
        <Play className="h-3.5 w-3.5" />
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/ponto-de-encontro/aula/${lesson.id}`)}>
        <p className="text-sm text-white/80 truncate">{lesson.title}</p>
        <p className="text-[11px] text-white/40">{fmtDuration(lesson.duration_minutes)} · {isLiveType ? (isCurrentlyLive ? "🔴 Em andamento" : "🔴 Ao vivo") : "🎬 Gravada"}</p>
      </div>
      <Badge className={cn("text-[10px] h-4 px-1.5 border shrink-0", STATUS_COLORS[lesson.status])}>
        {STATUS_LABELS[lesson.status]}
      </Badge>
      <div className="flex items-center gap-1 shrink-0">
        {/* Iniciar / Encerrar — only for live-type lessons */}
        {isLiveType && !isCurrentlyLive && (
          <button onClick={() => onStartLesson(lesson)} title="Iniciar aula ao vivo"
            className="p-1 rounded text-white/30 hover:text-red-400 transition-colors">
            <Radio className="h-3.5 w-3.5" />
          </button>
        )}
        {isCurrentlyLive && (
          <button onClick={() => onEndLesson(lesson)} title="Encerrar aula"
            className="p-1 rounded text-red-400 hover:text-red-300 transition-colors">
            <StopCircle className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={() => onAttendance(lesson)} title="Ver presenças"
          className="p-1 rounded text-white/30 hover:text-emerald-400 transition-colors">
          <Users className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onCycleStatus(lesson)} title="Alterar status"
          className="p-1 rounded text-white/30 hover:text-white/70 transition-colors">
          {lesson.status === "active" ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <button onClick={() => onEdit(lesson)}
          className="p-1 rounded text-white/30 hover:text-white/70 transition-colors">
          <Edit3 className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onDelete(lesson.id)}
          className="p-1 rounded text-white/30 hover:text-red-400 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

// ── Instructor Dashboard ──────────────────────────────────────────────────
const InstructorDashboard = () => {
  const [stats, setStats] = useState({ students: 0, completions: 0, activeTracks: 0, activeLessons: 0 });
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ count: students }, { count: completions }, { data: tracks }, { data: lessons }, { data: pts }] = await Promise.all([
          supabase.from("onboarding_staff").select("*", { count: "exact", head: true }).eq("role", "aluno").eq("is_active", true),
          supabase.from("pe_progress").select("*", { count: "exact", head: true }).eq("completed", true),
          supabase.from("pe_tracks").select("id").eq("status", "active"),
          supabase.from("pe_lessons").select("id").eq("status", "active"),
          supabase.from("pe_points_log").select("staff_id, points"),
        ]);
        setStats({
          students: students || 0,
          completions: completions || 0,
          activeTracks: (tracks || []).length,
          activeLessons: (lessons || []).length,
        });
        // Build ranking from points log
        const pointsMap = new Map<string, number>();
        for (const p of (pts || []) as any[]) {
          pointsMap.set(p.staff_id, (pointsMap.get(p.staff_id) || 0) + p.points);
        }
        const rankArr = Array.from(pointsMap.entries())
          .sort((a, b) => b[1] - a[1]).slice(0, 20);
        if (rankArr.length > 0) {
          const ids = rankArr.map(r => r[0]);
          const { data: staffNames } = await supabase.from("onboarding_staff").select("id, name, email").in("id", ids);
          const nameMap = new Map((staffNames || []).map((s: any) => [s.id, s.name || s.email]));
          setRanking(rankArr.map(([id, pts], idx) => ({ id, name: nameMap.get(id) || id, points: pts, rank: idx + 1 })));
        }
      } catch (err: any) { toast.error(err.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <Spinner />;

  const STAT_CARDS = [
    { label: "Alunos ativos", value: stats.students, color: "text-violet-400" },
    { label: "Aulas concluídas", value: stats.completions, color: "text-emerald-400" },
    { label: "Trilhas ativas", value: stats.activeTracks, color: "text-blue-400" },
    { label: "Aulas ativas", value: stats.activeLessons, color: "text-yellow-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_CARDS.map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-white/40 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {ranking.length > 0 && (
        <div className="rounded-xl border border-white/10 overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            <h3 className="font-semibold text-sm text-white">Ranking de Pontuação</h3>
          </div>
          <div className="divide-y divide-white/5">
            {ranking.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn("w-6 text-center text-sm font-bold shrink-0",
                  r.rank === 1 ? "text-yellow-400" : r.rank === 2 ? "text-zinc-300" : r.rank === 3 ? "text-amber-600" : "text-white/40")}>
                  {r.rank}
                </span>
                <span className="flex-1 text-sm text-white/80 truncate">{r.name}</span>
                <span className="text-sm font-semibold text-violet-400 shrink-0">{r.points.toLocaleString("pt-BR")} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Shared mini-components ─────────────────────────────────────────────────
const Spinner = () => (
  <div className="flex items-center justify-center py-16">
    <RefreshCw className="h-5 w-5 animate-spin text-violet-400" />
  </div>
);

const EmptyState = ({ icon: Icon, text, action }: {
  icon: React.ElementType; text: string; action?: { label: string; onClick: () => void };
}) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
    <Icon className="h-8 w-8 text-white/20" />
    <p className="text-sm text-white/40">{text}</p>
    {action && (
      <Button size="sm" className="bg-violet-600 hover:bg-violet-700 mt-1" onClick={action.onClick}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />{action.label}
      </Button>
    )}
  </div>
);

export default PontoDeEncontroPage;
