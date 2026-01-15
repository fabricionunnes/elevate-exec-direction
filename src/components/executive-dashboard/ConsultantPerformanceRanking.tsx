import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, TrendingUp, CheckCircle, Trophy, Medal, Award } from "lucide-react";
import { motion } from "framer-motion";

interface ConsultantPerformance {
  id: string;
  name: string;
  avatar?: string;
  avgHealthScore: number;
  retentionRate: number;
  taskCompletionRate: number;
  projectCount: number;
}

interface ConsultantPerformanceRankingProps {
  consultants: ConsultantPerformance[];
  maxItems?: number;
}

export function ConsultantPerformanceRanking({ consultants, maxItems = 5 }: ConsultantPerformanceRankingProps) {
  const sortedConsultants = [...consultants]
    .sort((a, b) => b.avgHealthScore - a.avgHealthScore)
    .slice(0, maxItems);

  const getScoreColor = (score: number) => {
    if (score >= 80) return { gradient: "from-emerald-400 to-emerald-600", text: "text-emerald-600" };
    if (score >= 60) return { gradient: "from-amber-400 to-amber-600", text: "text-amber-600" };
    return { gradient: "from-rose-400 to-rose-600", text: "text-rose-600" };
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <div className="p-1 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg"><Trophy className="h-3 w-3 text-white" /></div>;
    if (index === 1) return <div className="p-1 rounded-full bg-gradient-to-br from-slate-300 to-slate-400"><Medal className="h-3 w-3 text-white" /></div>;
    if (index === 2) return <div className="p-1 rounded-full bg-gradient-to-br from-amber-600 to-amber-700"><Award className="h-3 w-3 text-white" /></div>;
    return <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>;
  };

  return (
    <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background via-background to-blue-500/5">
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-3xl" />
      
      <CardHeader className="pb-3 relative z-10">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10">
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          Top Consultores
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        {sortedConsultants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum consultor encontrado</p>
          </div>
        ) : (
          <ScrollArea className="h-[320px] pr-2">
            <div className="space-y-3">
              {sortedConsultants.map((consultant, index) => {
                const colors = getScoreColor(consultant.avgHealthScore);
                return (
                  <motion.div
                    key={consultant.id}
                    className="relative overflow-hidden p-4 rounded-xl border border-border/50 bg-gradient-to-r from-white/50 to-transparent dark:from-white/5"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <div className="absolute top-2 left-2 text-5xl font-black text-muted/10">{index + 1}</div>
                    
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
                          <AvatarImage src={consultant.avatar} />
                          <AvatarFallback className={`bg-gradient-to-br ${colors.gradient} text-white font-semibold`}>
                            {consultant.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -top-1 -right-1">{getRankBadge(index)}</div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold truncate">{consultant.name}</span>
                          <div className={`text-lg font-bold bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent`}>
                            {consultant.avgHealthScore.toFixed(0)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50">
                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                            <span className="text-muted-foreground">{(consultant.retentionRate * 100).toFixed(0)}% ret.</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50">
                            <CheckCircle className="h-3 w-3 text-blue-500" />
                            <span className="text-muted-foreground">{(consultant.taskCompletionRate * 100).toFixed(0)}% tarefas</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30">
                      <motion.div className={`h-full bg-gradient-to-r ${colors.gradient}`} initial={{ width: 0 }} animate={{ width: `${consultant.avgHealthScore}%` }} transition={{ duration: 1 }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
