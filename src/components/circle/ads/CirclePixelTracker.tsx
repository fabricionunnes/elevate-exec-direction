import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";

type PixelEventType = 
  | 'page_view' | 'social_view' | 'social_like' | 'social_comment' | 'social_share' | 'story_view'
  | 'community_join' | 'community_post' | 'marketplace_view' | 'marketplace_click' | 'marketplace_whatsapp'
  | 'academy_lesson' | 'academy_quiz' | 'academy_track' | 'ad_impression' | 'ad_click' | 'ad_conversion';

interface PixelEventData {
  [key: string]: any;
}

// Global session ID for tracking
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('circle_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('circle_session_id', sessionId);
  }
  return sessionId;
};

export function useCirclePixel() {
  const { data: profile } = useCircleCurrentProfile();

  const trackEvent = useCallback(async (
    eventType: PixelEventType,
    eventData: PixelEventData = {},
    referenceId?: string,
    referenceType?: string
  ) => {
    if (!profile?.id) return null;

    try {
      const { data, error } = await supabase.rpc('track_circle_pixel_event', {
        p_event_type: eventType,
        p_event_data: eventData,
        p_reference_id: referenceId || null,
        p_reference_type: referenceType || null,
        p_session_id: getSessionId()
      });

      if (error) {
        console.error('Pixel tracking error:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Pixel tracking error:', err);
      return null;
    }
  }, [profile?.id]);

  return { trackEvent, sessionId: getSessionId() };
}

// Hook to auto-track page views
export function usePageViewTracking(pageName: string, pageData?: PixelEventData) {
  const { trackEvent } = useCirclePixel();

  useEffect(() => {
    trackEvent('page_view', { page: pageName, ...pageData });
  }, [pageName, trackEvent]);
}

// Component to track specific events
interface CirclePixelTrackerProps {
  event: PixelEventType;
  data?: PixelEventData;
  referenceId?: string;
  referenceType?: string;
  onTrack?: boolean;
  children?: React.ReactNode;
}

export function CirclePixelTracker({
  event,
  data = {},
  referenceId,
  referenceType,
  onTrack = true,
  children
}: CirclePixelTrackerProps) {
  const { trackEvent } = useCirclePixel();

  useEffect(() => {
    if (onTrack) {
      trackEvent(event, data, referenceId, referenceType);
    }
  }, [onTrack, event, data, referenceId, referenceType, trackEvent]);

  return <>{children}</>;
}
