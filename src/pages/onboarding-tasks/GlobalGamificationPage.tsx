import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Users, Building2, Medal, Gamepad2, TrendingUp, Crown, Star, Zap, Filter, RefreshCw, Target, Percent, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { useGlobalGamification, type GlobalParticipant, type LeagueEntry, type CompanySummary } from "@/hooks/useGlobalGamification";
import { motion, AnimatePresence } from "framer-motion";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Stats Cards ────────────────────────────────────────────────────────
function StatsCards({ stats }: { stats: { total: number; avgPercent: number; activeCompanies: number; above100: number } }) {
  const cards = [
    { label: "Vendedores", value: stats.total, icon: Users, color: "text-blue-600" },
    { label: "Média Geral", value: `${stats.avgPercent.toFixed(1)}%`, icon: Percent, color: "text-emerald-600" },
    { label: "Empresas", value: stats.activeCompanies, icon: Building2, color: "text-violet-600" },
    { label: "Bateram Meta", value: stats.above100, icon: Target, color: "text-amber-500" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-lg font-bold">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Global Ranking Table ───────────────────────────────────────────────
function RankingTable({ participants }: { participants: GlobalParticipant[] }) {
  const getMedalIcon = (pos: number) => {
    if (pos === 0) return <span className="text-2xl">🥇</span>;
    if (pos === 1) return <span className="text-2xl">🥈</span>;
    if (pos === 2) return <span className="text-2xl">🥉</span>;
    return <span className="text-sm font-bold text-muted-foreground w-8 text-center">{pos + 1}º</span>;
  };

  const getPercentColor = (percent: number) => {
    if (percent >= 120) return "text-cyan-600 bg-cyan-50";
    if (percent >= 100) return "text-emerald-600 bg-emerald-50";
    if (percent >= 80) return "text-amber-600 bg-amber-50";
    if (percent >= 50) return "text-orange-600 bg-orange-50";
    return "text-red-600 bg-red-50";
  };

  if (!participants.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Nenhum vendedor com metas configuradas</p>
        <p className="text-xs mt-1">Configure KPIs como "Meta Principal" nos projetos</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {participants.slice(0, 50).map((p, idx) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.02 }}
          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
            idx < 3 ? "bg-gradient-to-r from-amber-50/50 to-transparent border-amber-200/50" : ""
          }`}
        >
          <div className="flex items-center justify-center w-10">
            {getMedalIcon(idx)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{p.salesperson_name}</p>
            <p className="text-xs text-muted-foreground truncate">{p.company_name}</p>
          </div>
          <div className="text-right shrink-0 hidden sm:block">
            <p className="text-xs text-muted-foreground">
              {p.total_achieved.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} / {p.total_target.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <Badge className={`shrink-0 ${getPercentColor(p.achievement_percent)}`}>
            {p.achievement_percent.toFixed(1)}%
          </Badge>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Leagues View ───────────────────────────────────────────────────────
function LeaguesView({ leagues }: { leagues: LeagueEntry[] }) {
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {leagues.map((league) => (
        <Card key={league.league} className="overflow-hidden border-none shadow-sm">
          <button
            onClick={() => setExpandedLeague(expandedLeague === league.league ? null : league.league)}
            className="w-full"
          >
            <CardHeader className={`bg-gradient-to-r ${league.color} text-white py-3 px-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{league.icon}</span>
                  <CardTitle className="text-base text-white">{league.league}</CardTitle>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-white/20 text-white border-none">
                    {league.participants.length} vendedor{league.participants.length !== 1 ? "es" : ""}
                  </Badge>
                  <span className="text-xs opacity-80">
                    {league.min_percent}%+
                  </span>
                </div>
              </div>
            </CardHeader>
          </button>
          <AnimatePresence>
            {expandedLeague === league.league && league.participants.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <CardContent className="p-3 space-y-1">
                  {league.participants.slice(0, 20).map((p, idx) => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                      <span className="text-xs font-bold text-muted-foreground w-6 text-center">{idx + 1}º</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.salesperson_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.company_name}</p>
                      </div>
                      <p className="text-sm font-bold">{p.achievement_percent.toFixed(1)}%</p>
                    </div>
                  ))}
                  {league.participants.length > 20 && (
                    <p className="text-xs text-center text-muted-foreground py-2">
                      +{league.participants.length - 20} vendedores
                    </p>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      ))}
    </div>
  );
}

// ─── Hall of Fame ───────────────────────────────────────────────────────
function HallOfFame({ participants }: { participants: GlobalParticipant[] }) {
  if (!participants.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Crown className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Nenhum campeão ainda</p>
      </div>
    );
  }

  const top3 = participants.slice(0, 3);
  const rest = participants.slice(3);

  return (
    <div className="space-y-6">
      {/* Podium */}
      <div className="flex items-end justify-center gap-3 pt-8">
        {/* 2nd place */}
        {top3[1] && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center"
          >
            <div className="text-center mb-2">
              <p className="text-sm font-semibold truncate max-w-[100px]">{top3[1].salesperson_name}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[100px]">{top3[1].company_name}</p>
            </div>
            <div className="w-24 bg-gradient-to-t from-gray-300 to-gray-200 rounded-t-lg flex flex-col items-center justify-end py-3 h-24">
              <span className="text-2xl">🥈</span>
              <p className="text-xs font-bold">{top3[1].achievement_percent.toFixed(1)}%</p>
            </div>
          </motion.div>
        )}
        {/* 1st place */}
        {top3[0] && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center"
          >
            <div className="text-center mb-2">
              <p className="text-sm font-bold truncate max-w-[120px]">{top3[0].salesperson_name}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[120px]">{top3[0].company_name}</p>
            </div>
            <div className="w-28 bg-gradient-to-t from-amber-400 to-yellow-300 rounded-t-lg flex flex-col items-center justify-end py-3 h-32 shadow-lg">
              <span className="text-3xl">🏆</span>
              <p className="text-sm font-bold">{top3[0].achievement_percent.toFixed(1)}%</p>
            </div>
          </motion.div>
        )}
        {/* 3rd place */}
        {top3[2] && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center"
          >
            <div className="text-center mb-2">
              <p className="text-sm font-semibold truncate max-w-[100px]">{top3[2].salesperson_name}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[100px]">{top3[2].company_name}</p>
            </div>
            <div className="w-24 bg-gradient-to-t from-orange-400 to-orange-300 rounded-t-lg flex flex-col items-center justify-end py-3 h-20">
              <span className="text-2xl">🥉</span>
              <p className="text-xs font-bold">{top3[2].achievement_percent.toFixed(1)}%</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Rest of top 10 */}
      {rest.length > 0 && (
        <div className="space-y-2 mt-6">
          {rest.map((p, idx) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50">
              <span className="text-sm font-bold text-muted-foreground w-8 text-center">{idx + 4}º</span>
              <Star className="h-4 w-4 text-amber-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{p.salesperson_name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.company_name}</p>
              </div>
              <p className="text-sm font-bold">{p.achievement_percent.toFixed(1)}%</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Companies Ranking ──────────────────────────────────────────────────
function CompaniesRanking({ companies }: { companies: CompanySummary[] }) {
  if (!companies.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Nenhuma empresa com metas configuradas</p>
      </div>
    );
  }

  const getPercentColor = (percent: number) => {
    if (percent >= 100) return "text-emerald-600";
    if (percent >= 80) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-2">
      {companies.map((c, idx) => (
        <motion.div
          key={c.company_id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.03 }}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50"
        >
          <span className="text-sm font-bold text-muted-foreground w-8 text-center">{idx + 1}º</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{c.company_name}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{c.participant_count} vendedores</p>
              {c.segment && (
                <Badge variant="outline" className="text-xs py-0">{c.segment}</Badge>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`font-bold text-sm ${getPercentColor(c.avg_percent)}`}>
              {c.avg_percent.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              ⭐ {c.top_salesperson} ({c.top_percent.toFixed(0)}%)
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Month Selector ─────────────────────────────────────────────────────
function MonthSelector({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  return (
    <div className="flex items-center gap-1 border rounded-lg px-2 py-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(subMonths(value, 1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium min-w-[100px] text-center capitalize">
        {format(value, "MMM yyyy", { locale: ptBR })}
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(addMonths(value, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────
export default function GlobalGamificationPage() {
  const navigate = useNavigate();
  const {
    loading,
    participants,
    companies,
    leagues,
    hallOfFame,
    segments,
    stats,
    selectedCompanyId,
    setSelectedCompanyId,
    selectedSegment,
    setSelectedSegment,
    selectedMonth,
    setSelectedMonth,
    refetch,
  } = useGlobalGamification();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <NexusHeader showTitle={false} />
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-primary" />
                Gamificação Geral
              </h1>
              <p className="text-xs text-muted-foreground">Ranking por % de meta atingida</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Month selector */}
            <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
            
            {/* Filters */}
            <Select
              value={selectedCompanyId || "all"}
              onValueChange={(v) => setSelectedCompanyId(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Todas empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas empresas</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.company_id} value={c.company_id}>
                    {c.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedSegment || "all"}
              onValueChange={(v) => setSelectedSegment(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue placeholder="Todos segmentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos segmentos</SelectItem>
                {segments.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={refetch} className="gap-1">
              <RefreshCw className="h-3 w-3" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <StatsCards stats={stats} />

        {/* Tabs */}
        <Tabs defaultValue="ranking" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="ranking" className="gap-1 text-xs">
              <Trophy className="h-3.5 w-3.5" />
              Ranking
            </TabsTrigger>
            <TabsTrigger value="leagues" className="gap-1 text-xs">
              <Medal className="h-3.5 w-3.5" />
              Ligas
            </TabsTrigger>
            <TabsTrigger value="hall" className="gap-1 text-xs">
              <Crown className="h-3.5 w-3.5" />
              Hall da Fama
            </TabsTrigger>
            <TabsTrigger value="companies" className="gap-1 text-xs">
              <Building2 className="h-3.5 w-3.5" />
              Empresas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ranking">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Ranking Global de Vendedores
                </CardTitle>
                <CardDescription>Ordenado por % de meta atingida no mês</CardDescription>
              </CardHeader>
              <CardContent>
                <RankingTable participants={participants} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leagues">
            <LeaguesView leagues={leagues} />
          </TabsContent>

          <TabsContent value="hall">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  Hall da Fama
                </CardTitle>
                <CardDescription>Os 10 maiores % de meta do mês</CardDescription>
              </CardHeader>
              <CardContent>
                <HallOfFame participants={hallOfFame} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="companies">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-violet-500" />
                  Ranking por Empresa
                </CardTitle>
                <CardDescription>Média de % de meta atingida por empresa</CardDescription>
              </CardHeader>
              <CardContent>
                <CompaniesRanking companies={companies} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
