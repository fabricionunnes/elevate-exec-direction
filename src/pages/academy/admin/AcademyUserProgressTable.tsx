// Acompanhamento POR PESSOA — quem está (e quem NÃO está) assistindo.
// Fonte: RPC academy_team_overview (security definer, escopada):
//   staff → todas as empresas · gestor do cliente → só a empresa dele.
// Inclui quem nunca acessou; expandir mostra AULA a AULA; exporta CSV.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Search, UserCheck, GraduationCap, Clock, Download } from "lucide-react";

interface OverviewRow {
  person_key: string;
  person_name: string;
  person_email: string | null;
  source: string;
  company_id: string | null;
  company_name: string | null;
  onboarding_user_id: string | null;
  lesson_id: string | null;
  lesson_title: string | null;
  track_name: string | null;
  status: string | null;
  time_spent_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
}

interface LessonProgressRow {
  lesson_id: string;
  lesson_title: string;
  track_name: string;
  status: string;
  time_spent_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
}

interface PersonRow {
  key: string;
  name: string;
  email: string | null;
  source: string;
  company: string | null;
  onboardingUserId: string | null;
  completed: number;
  inProgress: number;
  timeSpent: number;
  certificates: number;
  lastActivity: string | null;
  lessons: LessonProgressRow[];
}

const SOURCE_LABEL: Record<string, string> = {
  vendedor: "Vendedor",
  client: "Proprietário",
  gerente: "Gerente",
  rh_client: "RH",
  estoque: "Estoque",
  financeiro: "Financeiro",
};

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

export const AcademyUserProgressTable = ({
  totalLessons,
  title = "Quem está assistindo (e quem não está)",
}: {
  totalLessons: number;
  title?: string;
}) => {
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: overview }, { data: certs }] = await Promise.all([
          (supabase.rpc as any)("academy_team_overview"),
          (supabase as any).from("academy_certificates").select("onboarding_user_id"),
        ]);

        const certCount = new Map<string, number>();
        (certs || []).forEach((c: any) => {
          certCount.set(c.onboarding_user_id, (certCount.get(c.onboarding_user_id) || 0) + 1);
        });

        const byPerson = new Map<string, PersonRow>();
        ((overview || []) as OverviewRow[]).forEach((r) => {
          let p = byPerson.get(r.person_key);
          if (!p) {
            p = {
              key: r.person_key,
              name: r.person_name || "Usuário",
              email: r.person_email,
              source: r.source,
              company: r.company_name,
              onboardingUserId: r.onboarding_user_id,
              completed: 0,
              inProgress: 0,
              timeSpent: 0,
              certificates: r.onboarding_user_id ? certCount.get(r.onboarding_user_id) || 0 : 0,
              lastActivity: null,
              lessons: [],
            };
            byPerson.set(r.person_key, p);
          }
          if (!r.lesson_id) return; // pessoa sem nenhuma atividade
          if (r.status === "completed") p.completed++;
          else if (r.status === "in_progress") p.inProgress++;
          p.timeSpent += r.time_spent_seconds || 0;
          const activity = r.completed_at || r.started_at;
          if (activity && (!p.lastActivity || activity > p.lastActivity)) p.lastActivity = activity;
          p.lessons.push({
            lesson_id: r.lesson_id,
            lesson_title: r.lesson_title || "Aula",
            track_name: r.track_name || "—",
            status: r.status || "in_progress",
            time_spent_seconds: r.time_spent_seconds,
            started_at: r.started_at,
            completed_at: r.completed_at,
          });
        });

        setRows(
          Array.from(byPerson.values()).sort((a, b) => {
            // com atividade primeiro (mais recente no topo); depois os "nunca acessou"
            if (!!a.lastActivity !== !!b.lastActivity) return a.lastActivity ? -1 : 1;
            return (b.lastActivity || "").localeCompare(a.lastActivity || "") || a.name.localeCompare(b.name);
          })
        );
      } catch (e) {
        console.error("team overview:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const companies = useMemo(
    () => Array.from(new Set(rows.map((r) => r.company).filter(Boolean))).sort() as string[],
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !(r.email || "").toLowerCase().includes(q)) return false;
      if (companyFilter !== "all" && r.company !== companyFilter) return false;
      if (activityFilter === "watching" && r.lessons.length === 0) return false;
      if (activityFilter === "never" && r.lessons.length > 0) return false;
      return true;
    });
  }, [rows, search, companyFilter, activityFilter]);

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = [
      "Nome", "Email", "Papel", "Empresa", "Aulas concluídas", "Total de aulas",
      "Em andamento", "Tempo assistido (min)", "Certificados", "Última atividade", "Situação",
    ];
    const summary = filtered.map((r) =>
      [
        r.name, r.email || "", SOURCE_LABEL[r.source] || r.source, r.company || "",
        r.completed, totalLessons, r.inProgress, Math.round(r.timeSpent / 60),
        r.certificates, r.lastActivity ? fmtDate(r.lastActivity) : "",
        r.lessons.length === 0 ? "Nunca acessou" : r.completed >= totalLessons && totalLessons > 0 ? "Completou tudo" : "Assistindo",
      ].map(esc).join(";")
    );
    const detailHeader = ["", "Nome", "Aula", "Trilha", "Status", "Tempo (min)", "Iniciada", "Concluída"];
    const details = filtered.flatMap((r) =>
      r.lessons.map((l) =>
        [
          "", r.name, l.lesson_title, l.track_name,
          l.status === "completed" ? "Concluída" : "Em andamento",
          Math.round((l.time_spent_seconds || 0) / 60), fmtDate(l.started_at),
          l.status === "completed" ? fmtDate(l.completed_at) : "",
        ].map(esc).join(";")
      )
    );
    const csv = [
      "RELATÓRIO UNV ACADEMY — " + new Date().toLocaleDateString("pt-BR"),
      "",
      header.map(esc).join(";"),
      ...summary,
      "",
      "DETALHE POR AULA",
      detailHeader.map(esc).join(";"),
      ...details,
    ].join("\r\n");
    // BOM pro Excel abrir acentuação certa
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unv-academy-relatorio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showCompanyCol = companies.length > 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-52 max-w-full">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome ou email"
                className="pl-8 h-9"
              />
            </div>
            {showCompanyCol && (
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="watching">Assistindo</SelectItem>
                <SelectItem value="never">Nunca acessou</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
            </Button>
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
            Ninguém encontrado com esses filtros.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Pessoa</TableHead>
                {showCompanyCol && <TableHead className="hidden lg:table-cell">Empresa</TableHead>}
                <TableHead>Aulas concluídas</TableHead>
                <TableHead className="hidden md:table-cell">Tempo</TableHead>
                <TableHead className="hidden md:table-cell">Certificados</TableHead>
                <TableHead>Última atividade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const isOpen = expanded === u.key;
                const never = u.lessons.length === 0;
                const pct = totalLessons > 0 ? Math.round((u.completed / totalLessons) * 100) : 0;
                return (
                  <>
                    <TableRow
                      key={u.key}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => !never && setExpanded(isOpen ? null : u.key)}
                    >
                      <TableCell className="pr-0">
                        {never ? null : isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {SOURCE_LABEL[u.source] || u.source}
                          {u.email ? ` · ${u.email}` : ""}
                        </p>
                      </TableCell>
                      {showCompanyCol && (
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {u.company || "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        {never ? (
                          <Badge variant="outline" className="border-red-500/40 text-red-500 bg-red-500/10">
                            Nunca acessou
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-2 min-w-[140px]">
                            <Progress value={pct} className="h-2 w-20" />
                            <span className="text-sm whitespace-nowrap">
                              {u.completed}/{totalLessons}
                              {u.inProgress > 0 && (
                                <span className="text-xs text-muted-foreground"> · {u.inProgress} em andamento</span>
                              )}
                            </span>
                          </div>
                        )}
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
                      <TableRow key={`${u.key}-detail`} className="hover:bg-transparent">
                        <TableCell colSpan={showCompanyCol ? 7 : 6} className="bg-muted/30 p-0">
                          <div className="px-6 py-3 space-y-1.5">
                            {u.lessons
                              .slice()
                              .sort((a, b) =>
                                (b.completed_at || b.started_at || "").localeCompare(a.completed_at || a.started_at || "")
                              )
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
