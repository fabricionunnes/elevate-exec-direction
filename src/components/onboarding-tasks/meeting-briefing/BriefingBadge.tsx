import { Badge } from "@/components/ui/badge";
import { FileText, Check } from "lucide-react";

interface BriefingBadgeProps {
  hasBriefing: boolean;
}

export const BriefingBadge = ({ hasBriefing }: BriefingBadgeProps) => {
  if (!hasBriefing) return null;

  return (
    <Badge 
      variant="outline" 
      className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs"
    >
      <FileText className="h-3 w-3 mr-1" />
      Briefing
      <Check className="h-3 w-3 ml-1" />
    </Badge>
  );
};
