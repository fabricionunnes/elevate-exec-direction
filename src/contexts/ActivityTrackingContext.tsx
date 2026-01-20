import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useClientActivityTracking } from "@/hooks/useClientActivityTracking";

interface ActivityTrackingContextType {
  trackActivity: ReturnType<typeof useClientActivityTracking>['trackActivity'];
  trackPageView: ReturnType<typeof useClientActivityTracking>['trackPageView'];
  trackTaskCompleted: ReturnType<typeof useClientActivityTracking>['trackTaskCompleted'];
  trackTaskCreated: ReturnType<typeof useClientActivityTracking>['trackTaskCreated'];
  trackMeetingScheduled: ReturnType<typeof useClientActivityTracking>['trackMeetingScheduled'];
  trackTicketCreated: ReturnType<typeof useClientActivityTracking>['trackTicketCreated'];
  trackFileUploaded: ReturnType<typeof useClientActivityTracking>['trackFileUploaded'];
  trackFormSubmitted: ReturnType<typeof useClientActivityTracking>['trackFormSubmitted'];
  trackNpsSubmitted: ReturnType<typeof useClientActivityTracking>['trackNpsSubmitted'];
  trackTabChanged: ReturnType<typeof useClientActivityTracking>['trackTabChanged'];
  trackButtonClicked: ReturnType<typeof useClientActivityTracking>['trackButtonClicked'];
  trackJobOpeningCreated: ReturnType<typeof useClientActivityTracking>['trackJobOpeningCreated'];
  trackCandidateAdded: ReturnType<typeof useClientActivityTracking>['trackCandidateAdded'];
  setTrackingOptions: (options: { userId: string; projectId: string; accessLogId?: string | null }) => void;
}

const defaultNoOp = async () => {};

const ActivityTrackingContext = createContext<ActivityTrackingContextType>({
  trackActivity: defaultNoOp,
  trackPageView: defaultNoOp,
  trackTaskCompleted: defaultNoOp,
  trackTaskCreated: defaultNoOp,
  trackMeetingScheduled: defaultNoOp,
  trackTicketCreated: defaultNoOp,
  trackFileUploaded: defaultNoOp,
  trackFormSubmitted: defaultNoOp,
  trackNpsSubmitted: defaultNoOp,
  trackTabChanged: defaultNoOp,
  trackButtonClicked: defaultNoOp,
  trackJobOpeningCreated: defaultNoOp,
  trackCandidateAdded: defaultNoOp,
  setTrackingOptions: () => {},
});

export const useActivityTracking = () => useContext(ActivityTrackingContext);

interface ActivityTrackingProviderProps {
  children: React.ReactNode;
}

export const ActivityTrackingProvider: React.FC<ActivityTrackingProviderProps> = ({ children }) => {
  const [options, setOptions] = useState<{ userId: string; projectId: string; accessLogId?: string | null } | null>(null);

  const tracking = useClientActivityTracking(options);

  const setTrackingOptions = useCallback((newOptions: { userId: string; projectId: string; accessLogId?: string | null }) => {
    setOptions(newOptions);
  }, []);

  return (
    <ActivityTrackingContext.Provider
      value={{
        ...tracking,
        setTrackingOptions,
      }}
    >
      {children}
    </ActivityTrackingContext.Provider>
  );
};
