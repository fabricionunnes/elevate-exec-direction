import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { ScheduleLeadMeetingDialog } from "./lead-detail/ScheduleLeadMeetingDialog";

interface AutomationConfig {
  mode: 'task' | 'whatsapp_send' | 'schedule_meeting';
  whatsapp_template?: string;
  meeting_staff_id?: string;
  meeting_duration_minutes?: number;
}

interface ScheduleMeetingQuickButtonProps {
  activityId: string;
  automationConfig: AutomationConfig;
  leadId: string;
  leadName: string;
  leadEmail?: string | null;
  onSuccess?: () => void;
}

export function ScheduleMeetingQuickButton({
  activityId,
  automationConfig,
  leadId,
  leadName,
  leadEmail,
  onSuccess,
}: ScheduleMeetingQuickButtonProps) {
  const [open, setOpen] = useState(false);

  const handleSuccess = () => {
    setOpen(false);
    onSuccess?.();
  };

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-primary hover:bg-primary/90"
      >
        <Calendar className="h-3.5 w-3.5 mr-1" />
        Agendar
      </Button>

      <ScheduleLeadMeetingDialog
        open={open}
        onOpenChange={setOpen}
        leadId={leadId}
        leadName={leadName}
        leadEmail={leadEmail || undefined}
        onSuccess={handleSuccess}
        defaultDuration={automationConfig.meeting_duration_minutes}
        defaultStaffId={automationConfig.meeting_staff_id}
        activityIdToComplete={activityId}
      />
    </>
  );
}
