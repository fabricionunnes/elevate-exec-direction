import { Badge } from "@/components/ui/badge";
import { Shield, Loader2, CheckCircle2 } from "lucide-react";

interface RescuePlaybookBadgeProps {
  status?: string | null;
  onClick?: () => void;
}

export const RescuePlaybookBadge = ({ status, onClick }: RescuePlaybookBadgeProps) => {
  if (!status) return null;

  const getConfig = () => {
    switch (status) {
      case 'completed':
        return {
          label: 'Playbook Concluído',
          icon: CheckCircle2,
          className: 'bg-green-500/10 text-green-600 border-green-500/20',
        };
      case 'in_progress':
        return {
          label: 'Playbook em Andamento',
          icon: Loader2,
          className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        };
      default:
        return {
          label: 'Playbook Pendente',
          icon: Shield,
          className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} text-xs ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
    >
      <Icon className={`h-3 w-3 mr-1 ${status === 'in_progress' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
};
