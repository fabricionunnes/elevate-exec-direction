import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Briefcase, UserCheck, Brain, Rocket, Target, TrendingUp, FileText,
  MessageSquare, GraduationCap, Network, Heart, BarChart3, Users, Sparkles
} from "lucide-react";

const CARDS = [
  { to: "/unv-profile/recruitment", title: "Recrutamento", desc: "Vagas, pipeline e candidatos com IA", icon: Briefcase, gradient: "from-blue-500 to-cyan-500" },
  { to: "/unv-profile/talent-pool", title: "Banco de Talentos", desc: "Reuso e curadoria de candidatos", icon: UserCheck, gradient: "from-amber-500 to-orange-500" },
  { to: "/unv-profile/disc", title: "Perfil DISC", desc: "Mapa comportamental individual e do time", icon: Brain, gradient: "from-purple-500 to-fuchsia-500" },
  { to: "/unv-profile/onboarding", title: "Onboarding", desc: "Trilhas de admissão e feedbacks 7/15/30/45/90", icon: Rocket, gradient: "from-emerald-500 to-teal-500" },
  { to: "/unv-profile/pdi", title: "PDI", desc: "Planos de Desenvolvimento Individual + IA", icon: Target, gradient: "from-rose-500 to-pink-500" },
  { to: "/unv-profile/career", title: "Plano de Carreira", desc: "Trilhas de evolução por cargo e área", icon: TrendingUp, gradient: "from-indigo-500 to-blue-500" },
  { to: "/unv-profile/evaluations", title: "Avaliações", desc: "Auto / Gestor / 90 / 180 / 360", icon: FileText, gradient: "from-violet-500 to-purple-500" },
  { to: "/unv-profile/feedbacks", title: "Feedbacks & 1:1", desc: "Cultura de feedback contínuo", icon: MessageSquare, gradient: "from-sky-500 to-blue-500" },
  { to: "/unv-profile/trainings", title: "Treinamentos", desc: "Trilhas, conteúdos e certificados", icon: GraduationCap, gradient: "from-lime-500 to-green-500" },
  { to: "/unv-profile/org-chart", title: "Organograma", desc: "Estrutura visual hierárquica", icon: Network, gradient: "from-orange-500 to-red-500" },
  { to: "/unv-profile/climate", title: "Clima & Engajamento", desc: "Pulse surveys e eNPS interno", icon: Heart, gradient: "from-pink-500 to-rose-500" },
  { to: "/unv-profile/reports", title: "Relatórios", desc: "Recrutamento, turnover, retenção e mais", icon: BarChart3, gradient: "from-slate-500 to-slate-700" },
];

export default function UNVProfileHomePage() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">UNV Profile</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-3 w-3" /> Gestão de pessoas, performance e cultura — com inteligência UNV
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {CARDS.map(card => (
          <Link key={card.to} to={card.to}>
            <Card className="group hover:shadow-lg hover:-translate-y-0.5 transition-all border-border h-full">
              <CardContent className="p-5">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-foreground">{card.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
