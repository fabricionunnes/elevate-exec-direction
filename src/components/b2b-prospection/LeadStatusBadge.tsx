import { Badge } from "@/components/ui/badge";
import { B2B_LEAD_STATUSES } from "@/types/b2bProspection";
import type { B2BLeadStatus } from "@/types/b2bProspection";

interface LeadStatusBadgeProps {
  status: B2BLeadStatus;
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const statusInfo = B2B_LEAD_STATUSES.find((s) => s.value === status);
  if (!statusInfo) return null;

  return (
    <Badge className={`${statusInfo.color} text-xs`}>
      {statusInfo.label}
    </Badge>
  );
}
