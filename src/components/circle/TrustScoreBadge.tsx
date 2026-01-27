import { cn } from "@/lib/utils";
import { Shield, ShieldCheck, ShieldAlert, Star } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TrustScoreBadgeProps {
  score: number;
  isVerified?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function TrustScoreBadge({ 
  score, 
  isVerified = false,
  size = "md", 
  showLabel = false,
  className 
}: TrustScoreBadgeProps) {
  const getScoreConfig = (score: number) => {
    if (score >= 80) {
      return {
        label: "Excelente",
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        borderColor: "border-green-500/20",
        icon: ShieldCheck,
      };
    } else if (score >= 60) {
      return {
        label: "Bom",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/20",
        icon: Shield,
      };
    } else if (score >= 40) {
      return {
        label: "Regular",
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
        borderColor: "border-yellow-500/20",
        icon: Shield,
      };
    } else {
      return {
        label: "Baixo",
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/20",
        icon: ShieldAlert,
      };
    }
  };

  const config = getScoreConfig(score);
  const Icon = config.icon;

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const containerSizes = {
    sm: "px-1.5 py-0.5 text-xs gap-1",
    md: "px-2 py-1 text-sm gap-1.5",
    lg: "px-3 py-1.5 text-base gap-2",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center rounded-full border font-medium",
              config.bgColor,
              config.borderColor,
              config.color,
              containerSizes[size],
              className
            )}
          >
            <Icon className={sizeClasses[size]} />
            <span>{score}</span>
            {isVerified && (
              <Star className={cn(sizeClasses[size], "fill-current")} />
            )}
            {showLabel && (
              <span className="hidden sm:inline">{config.label}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-medium">Trust Score: {score}/100</p>
            <p className="text-xs text-muted-foreground">
              {config.label} • {isVerified ? "Conta verificada" : "Conta não verificada"}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
