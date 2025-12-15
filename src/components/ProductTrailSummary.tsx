import { CheckCircle, Calendar, Users, Target, Clock } from "lucide-react";

interface ScheduleItem {
  period: string;
  description: string;
}

interface ProductTrailSummaryProps {
  color: "blue" | "red" | "yellow" | "green" | "purple" | "pink" | "gold";
  productNumber: number;
  productName: string;
  tagline: string;
  whatItDoes: string;
  keyPoints: string[];
  arrow: string;
  targetAudience: {
    revenue: string;
    team?: string;
  };
  schedule: ScheduleItem[];
  scheduleType?: "weeks" | "recurring" | "phases" | "days";
}

const colorClasses = {
  blue: {
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: "text-blue-400",
    accent: "text-blue-400",
    bgAccent: "bg-blue-500/10 border-blue-500/20"
  },
  red: {
    badge: "bg-primary/20 text-primary border-primary/30",
    icon: "text-primary",
    accent: "text-primary",
    bgAccent: "bg-primary/10 border-primary/20"
  },
  yellow: {
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    icon: "text-amber-400",
    accent: "text-amber-400",
    bgAccent: "bg-amber-500/10 border-amber-500/20"
  },
  green: {
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    icon: "text-emerald-400",
    accent: "text-emerald-400",
    bgAccent: "bg-emerald-500/10 border-emerald-500/20"
  },
  purple: {
    badge: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    icon: "text-purple-400",
    accent: "text-purple-400",
    bgAccent: "bg-purple-500/10 border-purple-500/20"
  },
  pink: {
    badge: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    icon: "text-pink-400",
    accent: "text-pink-400",
    bgAccent: "bg-pink-500/10 border-pink-500/20"
  },
  gold: {
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    icon: "text-amber-400",
    accent: "text-amber-400",
    bgAccent: "bg-amber-500/10 border-amber-500/20"
  }
};

export function ProductTrailSummary({
  color,
  productNumber,
  productName,
  tagline,
  whatItDoes,
  keyPoints,
  arrow,
  targetAudience,
  schedule,
  scheduleType = "weeks"
}: ProductTrailSummaryProps) {
  const colors = colorClasses[color];

  const getScheduleHeader = () => {
    switch (scheduleType) {
      case "weeks":
        return "Cronograma típico";
      case "recurring":
        return "Cadência";
      case "phases":
        return "Cronograma (12 meses)";
      case "days":
        return "Cronograma";
      default:
        return "Cronograma";
    }
  };

  return (
    <section className="section-padding bg-secondary/50">
      <div className="container-premium">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${colors.badge} text-sm font-bold`}>
              {productNumber}. {productName}
            </div>
            <span className={`font-medium ${colors.accent}`}>{tagline}</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column - What it does */}
            <div className="space-y-6">
              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Target className={`h-5 w-5 ${colors.icon}`} />
                  O que faz de fato
                </h3>
                <p className="text-muted-foreground mb-4">{whatItDoes}</p>
                <ul className="space-y-2">
                  {keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className={`h-4 w-4 ${colors.icon} mt-0.5 flex-shrink-0`} />
                      {point}
                    </li>
                  ))}
                </ul>
                <div className={`mt-4 p-3 rounded-lg border ${colors.bgAccent}`}>
                  <p className={`text-sm font-medium ${colors.accent}`}>
                    👉 {arrow}
                  </p>
                </div>
              </div>

              {/* Target Audience */}
              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Users className={`h-5 w-5 ${colors.icon}`} />
                  Para quem
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center`}>
                      <Target className={`h-5 w-5 ${colors.icon}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Faturamento</p>
                      <p className="font-semibold text-foreground">{targetAudience.revenue}</p>
                    </div>
                  </div>
                  {targetAudience.team && (
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center`}>
                        <Users className={`h-5 w-5 ${colors.icon}`} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Time</p>
                        <p className="font-semibold text-foreground">{targetAudience.team}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Schedule */}
            <div className="card-premium p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className={`h-5 w-5 ${colors.icon}`} />
                {getScheduleHeader()}
              </h3>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider p-3">
                        {scheduleType === "weeks" ? "Semana" : 
                         scheduleType === "recurring" ? "Frequência" :
                         scheduleType === "phases" ? "Fase" :
                         scheduleType === "days" ? "Período" : "Período"}
                      </th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider p-3">
                        O que acontece
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {schedule.map((item, i) => (
                      <tr key={i} className="hover:bg-secondary/50 transition-colors">
                        <td className={`p-3 font-medium ${colors.accent} text-sm whitespace-nowrap`}>
                          {item.period}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {item.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
