import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar, CheckCircle, XCircle, Loader2, FileSignature, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SendContractButton } from "./SendContractButton";

export type MeetingEventType = "scheduled" | "realized" | "no_show" | "out_of_icp";

interface LeadMeetingActionsProps {
  leadId: string;
  pipelineId: string;
  stageId: string;
  ownerStaffId: string | null;
  onEventTracked?: () => void;
  variant?: "icons" | "compact";
  showContractButton?: boolean;
  className?: string;
}

const trackMeetingEvent = async (
  leadId: string,
  pipelineId: string,
  stageId: string,
  eventType: MeetingEventType,
  creditedStaffId: string,
  triggeredByStaffId: string
): Promise<boolean> => {
  try {
    // Check if event already exists
    const { data: existing } = await supabase
      .from("crm_meeting_events")
      .select("id")
      .eq("lead_id", leadId)
      .eq("event_type", eventType)
      .limit(1);

    if (existing && existing.length > 0) {
      return false; // Already tracked - return false to indicate it wasn't newly created
    }

    // If scheduling, update lead with scheduler info (use triggeredBy as they are the one scheduling)
    if (eventType === "scheduled") {
      await supabase
        .from("crm_leads")
        .update({
          scheduled_by_staff_id: triggeredByStaffId,
          scheduled_at: new Date().toISOString(),
        })
        .eq("id", leadId);
    }

    const eventDate = new Date().toISOString();
    const eventsToInsert: Array<{
      lead_id: string;
      pipeline_id: string;
      event_type: string;
      credited_staff_id: string;
      triggered_by_staff_id: string;
      stage_id: string;
      event_date: string;
    }> = [{
      lead_id: leadId,
      pipeline_id: pipelineId,
      event_type: eventType,
      credited_staff_id: creditedStaffId,
      triggered_by_staff_id: triggeredByStaffId,
      stage_id: stageId,
      event_date: eventDate,
    }];

    // For realized/no_show: also credit the SDR who scheduled if different
    if (eventType === "realized" || eventType === "no_show") {
      const { data: leadData } = await supabase
        .from("crm_leads")
        .select("scheduled_by_staff_id")
        .eq("id", leadId)
        .single();

      const sdrId = leadData?.scheduled_by_staff_id;
      if (sdrId && sdrId !== creditedStaffId) {
        eventsToInsert.push({
          lead_id: leadId,
          pipeline_id: pipelineId,
          event_type: eventType,
          credited_staff_id: sdrId,
          triggered_by_staff_id: triggeredByStaffId,
          stage_id: stageId,
          event_date: eventDate,
        });
      }
    }

    const { error } = await supabase.from("crm_meeting_events").insert(eventsToInsert);

    if (error) {
      console.error("Error tracking meeting event:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in trackMeetingEvent:", error);
    return false;
  }
};

const getCurrentStaffId = async (): Promise<string | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("onboarding_staff")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  return staff?.id || null;
};

export function LeadMeetingActions({
  leadId,
  pipelineId,
  stageId,
  ownerStaffId,
  onEventTracked,
  variant = "icons",
  showContractButton = true,
  className,
}: LeadMeetingActionsProps) {
  const [loading, setLoading] = useState<MeetingEventType | null>(null);
  const [trackedEvents, setTrackedEvents] = useState<Set<MeetingEventType>>(
    new Set()
  );

  // Load existing events on mount
  useEffect(() => {
    const loadExistingEvents = async () => {
      const { data } = await supabase
        .from("crm_meeting_events")
        .select("event_type")
        .eq("lead_id", leadId);

      if (data && data.length > 0) {
        const existingTypes = new Set<MeetingEventType>(
          data.map((e) => e.event_type as MeetingEventType)
        );
        setTrackedEvents(existingTypes);
      }
    };

    loadExistingEvents();
  }, [leadId]);

  const handleTrackEvent = async (
    e: React.MouseEvent,
    eventType: MeetingEventType
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading || trackedEvents.has(eventType)) {
      if (trackedEvents.has(eventType)) {
        toast.info("Este evento já foi registrado para este lead");
      }
      return;
    }

    setLoading(eventType);

    try {
      const triggeredByStaffId = await getCurrentStaffId();
      if (!triggeredByStaffId) {
        toast.error("Erro: usuário não identificado");
        return;
      }

      // Always credit the owner (closer) for scheduled and realized events
      // The owner is the person responsible for the lead's meetings
      const creditedStaffId = ownerStaffId || triggeredByStaffId;

      const success = await trackMeetingEvent(
        leadId,
        pipelineId,
        stageId,
        eventType,
        creditedStaffId,
        triggeredByStaffId
      );

      if (success) {
        setTrackedEvents((prev) => new Set(prev).add(eventType));
        const labels: Record<MeetingEventType, string> = {
          scheduled: "Reunião agendada registrada!",
          realized: "Reunião realizada registrada!",
          no_show: "No show registrado!",
        };
        toast.success(labels[eventType]);
        onEventTracked?.();
      } else {
        // Already tracked by someone else
        setTrackedEvents((prev) => new Set(prev).add(eventType));
        toast.info("Este evento já foi registrado para este lead");
      }
    } catch (error) {
      console.error("Error tracking event:", error);
      toast.error("Erro ao registrar evento");
    } finally {
      setLoading(null);
    }
  };

  if (variant === "compact") {
    return (
      <div
        className={cn("flex items-center gap-1", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 rounded-full",
            trackedEvents.has("scheduled") && "text-blue-500 bg-blue-50"
          )}
          onClick={(e) => handleTrackEvent(e, "scheduled")}
          disabled={loading !== null}
          title="Reunião Agendada"
        >
          {loading === "scheduled" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Calendar className="h-3 w-3" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 rounded-full",
            trackedEvents.has("realized") && "text-green-500 bg-green-50"
          )}
          onClick={(e) => handleTrackEvent(e, "realized")}
          disabled={loading !== null}
          title="Reunião Realizada"
        >
          {loading === "realized" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle className="h-3 w-3" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 rounded-full",
            trackedEvents.has("no_show") && "text-red-500 bg-red-50"
          )}
          onClick={(e) => handleTrackEvent(e, "no_show")}
          disabled={loading !== null}
          title="No Show"
        >
          {loading === "no_show" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
        </Button>
        {showContractButton && (
          <SendContractButton
            leadId={leadId}
            variant="icon"
            className="h-6 w-6"
            onSuccess={onEventTracked}
          />
        )}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className={cn("flex items-center gap-0.5", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-md hover:bg-blue-100 hover:text-blue-600",
                trackedEvents.has("scheduled") &&
                  "text-blue-500 bg-blue-50 border border-blue-200"
              )}
              onClick={(e) => handleTrackEvent(e, "scheduled")}
              disabled={loading !== null}
            >
              {loading === "scheduled" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Calendar className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Reunião Agendada
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-md hover:bg-green-100 hover:text-green-600",
                trackedEvents.has("realized") &&
                  "text-green-500 bg-green-50 border border-green-200"
              )}
              onClick={(e) => handleTrackEvent(e, "realized")}
              disabled={loading !== null}
            >
              {loading === "realized" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Reunião Realizada
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-md hover:bg-red-100 hover:text-red-600",
                trackedEvents.has("no_show") &&
                  "text-red-500 bg-red-50 border border-red-200"
              )}
              onClick={(e) => handleTrackEvent(e, "no_show")}
              disabled={loading !== null}
            >
              {loading === "no_show" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            No Show
          </TooltipContent>
        </Tooltip>

        {showContractButton && (
          <SendContractButton
            leadId={leadId}
            variant="icon"
            onSuccess={onEventTracked}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
