import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface ExecutiveKPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label?: string;
  };
  colorClass?: string;
  onClick?: () => void;
}

export function ExecutiveKPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  colorClass = "text-primary",
  onClick,
}: ExecutiveKPICardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp className="h-4 w-4 text-emerald-400" />;
    if (trend.value < 0) return <TrendingDown className="h-4 w-4 text-rose-400" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (!trend) return "";
    if (trend.value > 0) return "text-emerald-400";
    if (trend.value < 0) return "text-rose-400";
    return "text-muted-foreground";
  };

  // Map color classes to gradient backgrounds
  const getGradientBg = () => {
    if (colorClass?.includes("green")) return "from-emerald-500/10 via-emerald-500/5 to-transparent";
    if (colorClass?.includes("red")) return "from-rose-500/10 via-rose-500/5 to-transparent";
    if (colorClass?.includes("yellow")) return "from-amber-500/10 via-amber-500/5 to-transparent";
    if (colorClass?.includes("blue")) return "from-blue-500/10 via-blue-500/5 to-transparent";
    return "from-primary/10 via-primary/5 to-transparent";
  };

  const getIconBg = () => {
    if (colorClass?.includes("green")) return "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30";
    if (colorClass?.includes("red")) return "bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/30";
    if (colorClass?.includes("yellow")) return "bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30";
    if (colorClass?.includes("blue")) return "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/30";
    return "bg-gradient-to-br from-primary to-primary/80 shadow-primary/30";
  };

  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        "bg-gradient-to-br from-background via-background to-muted/30",
        "border border-border/50 backdrop-blur-sm",
        "hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:opacity-50",
        getGradientBg(),
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      
      {/* Decorative elements */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl" />
      <div className="absolute -bottom-8 -left-8 w-16 h-16 bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-xl" />
      
      <CardContent className="p-5 relative z-10">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground/80 tracking-wide uppercase">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <span className={cn(
                "text-3xl font-bold tracking-tight",
                "bg-gradient-to-br bg-clip-text",
                colorClass?.includes("green") && "from-emerald-500 to-emerald-600 text-transparent",
                colorClass?.includes("red") && "from-rose-500 to-rose-600 text-transparent",
                colorClass?.includes("yellow") && "from-amber-500 to-amber-600 text-transparent",
                colorClass?.includes("blue") && "from-blue-500 to-blue-600 text-transparent",
                !colorClass?.includes("green") && !colorClass?.includes("red") && !colorClass?.includes("yellow") && !colorClass?.includes("blue") && colorClass
              )}>
                {value}
              </span>
              {trend && (
                <div className={cn("flex items-center gap-1 text-sm font-medium", getTrendColor())}>
                  {getTrendIcon()}
                  <span>{Math.abs(trend.value).toFixed(1)}%</span>
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground/70">{subtitle}</p>
            )}
            {trend?.label && (
              <p className="text-xs text-muted-foreground/70">{trend.label}</p>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-xl shadow-lg transform rotate-3 transition-transform",
            "hover:rotate-6 hover:scale-110",
            getIconBg()
          )}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
