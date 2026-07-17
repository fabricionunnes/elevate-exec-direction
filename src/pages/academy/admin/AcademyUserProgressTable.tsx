// Acompanhamento POR USUÁRIO — o que cada um assistiu, quando e por quanto tempo.
// Linha por usuário (aulas concluídas/total, tempo, certificados, última atividade);
// expandir mostra AULA a AULA com status, tempo assistido e data de conclusão.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Search, UserCheck, GraduationCap, Clock } from "lucide-react";

interface LessonProgressRow {
  lesson_id: string;
  lesson_title: string;
  track_name: string;
  status: string;
  time_spent_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
}

interface UserRow {
  user_id: string;
  name: string;
  email: string | null;
  completed: number;
  inProgress: number;
  timeSpent: number;
  certificates: number;
  lastActivity: string | null;
  lessons: LessonProgressRow[];
}

const fmtTime = (secs: number) => {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ""}`;
  return `${m || 1}min`;
};

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
      " " +
      new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";

export const AcademyUserProgressTable = ({ totalLessons }: { totalLessons: number }) => {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: progress }, { data: certs }] = await Promise.all([
          (supabase as any)
            .from("academy_progress")
            .select(`
              onboarding_user_id, lesson_id, status, time_spent_seconds, started_at, completed_at, updated_at,
              user:onboarding_users(id, name, email),
              lesson:academy_lessons(id, title, track:academy_tracks(name))
            `)
            .order("updated_at", { ascending: false }),
          (supabase as any)
            .from("academy_certificates")
            .select("onboarding_user_id"),
        ]);

        const certCount = new Map<string, number>();
        (certs || []).forEach((c: any) => {
          certCount.set(c.onboarding_user_id, (certCount.get(c.onboarding_user_id) || 0) + 1);
        });

        const byUser = new Map<string, UserRow>();
        (progress || []).forEach((p: any) => {
          if (!p.user) return;
          let u = byUser.get(p.onboarding_user_id);
          if (!u) {
            u = {
              user_id: p.onboarding_user_id,
              name: p.user.name || "Usuário",
              email: p.user.email || null,
              completed: 0,
              inProgress: 0,
              timeSpent: 0,
              certificates: certCount.get(p.onboarding_user_id) || 0,
              lastActivity: null,
              lessons: [],
            };
            byUser.set(p.onboarding_user_id, u);
          }
          if (p.status === "completed") u.completed++;
          else if (p.status === "in_progress") u.inProgress++;
          u.timeSpent += p.time_spent_seconds || 0;
          const activity = p.completed_at || p.updated_at || p.started_at;
          if (activity && (!u.lastActivity || activity > u.lastActivity)) u.lastActivity = activity;
          u.lessons.push({
            lesson_id: p.lesson_id,
            lesson_title: p.lesson?.title || "Aula",
            track_name: p.lesson?.track?.name || "—",
            status: p.status,
            time_spent_seconds: p.time_spent_seconds,
            started_at: p.started_at,
            completed_at: p.completed_at,
          });
        });

        setRows(
          Array.from(byUser.values()).sort(
            (a, b) => (b.lastActivity || "").localeCompare(a.lastActivity || "")
          )
        );
      } catch (e) {
        console.error("user progress:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.email || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="h-5 w-5 text-primary" />
            Progresso por Usuário
          </CardTitle>
          <div className="relative w-64 max-w-full">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou email"
              className="pl-8 h-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum usuário com atividade na Academy ainda.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Usuário</TableHead>
                <TableHead>Aulas concluídas</TableHead>
                <TableHead className="hidden md:table-cell">Tempo assistido</TableHead>
                <TableHead className="hidden md:table-cell">Certificados</TableHead>
                <TableHead>Última atividade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const isOpen = expanded === u.user_id;
                const pct = totalLessons > 0 ? Math.round((u.completed / totalLessons) * 100) : 0;
                return (
                  <>
                    <TableRow
                      key={u.user_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpanded(isOpen ? null : u.user_id)}
                    >
                      <TableCell className="pr-0">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{u.name}</p>
                        {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Progress value={pct} className="h-2 w-20" />
                          <span className="text-sm whitespace-nowrap">
                            {u.completed}/{totalLessons}
                            {u.inProgress > 0 && (
                              <span className="text-xs text-muted-foreground"> · {u.inProgress} em andamento</span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="flex items-center gap-1 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {fmtTime(u.timeSpent)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="flex items-center gap-1 text-sm">
                          <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                          {u.certificates}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(u.lastActivity)}</TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={`${u.user_id}-detail`} className="hover:bg-transparent">
                        <TableCell colSpan={6} className="bg-muted/30 p-0">
                          <div className="px-6 py-3 space-y-1.5">
                            {u.lessons
                              .slice()
                              .sort((a, b) => (b.completed_at || b.started_at || "").localeCompare(a.completed_at || a.started_at || ""))
                              .map((l) => (
                                <div
                                  key={l.lesson_id}
                                  className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-border/40 last:border-0"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{l.lesson_title}</p>
                                    <p className="text-xs text-muted-foreground">{l.track_name}</p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                                    <span>{fmtTime(l.time_spent_seconds || 0)}</span>
                                    <span className="hidden sm:inline">
                                      {l.status === "completed"
                                        ? `Concluída ${fmtDate(l.completed_at)}`
                                        : `Iniciada ${fmtDate(l.started_at)}`}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={
                                        l.status === "completed"
                                          ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                                          : "border-amber-500/40 text-amber-600 bg-amber-500/10"
                                      }
                                    >
                                      {l.status === "completed" ? "Concluída" : "Em andamento"}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
