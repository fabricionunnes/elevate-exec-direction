import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TrustConfig {
  min_score_post_links: number;
  min_score_create_listings: number;
  min_score_create_communities: number;
  min_score_boost_posts: number;
}

export function useCircleTrustConfig() {
  return useQuery({
    queryKey: ["circle-trust-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_trust_config")
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;
      return data as TrustConfig;
    },
  });
}

export function useCircleTrustEvents(profileId?: string) {
  return useQuery({
    queryKey: ["circle-trust-events", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("circle_trust_events")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });
}

export function checkTrustScorePermission(
  userScore: number,
  config: TrustConfig | undefined,
  action: "post_links" | "create_listings" | "create_communities" | "boost_posts"
): { allowed: boolean; minRequired: number } {
  if (!config) {
    return { allowed: true, minRequired: 0 };
  }

  const minScores = {
    post_links: config.min_score_post_links,
    create_listings: config.min_score_create_listings,
    create_communities: config.min_score_create_communities,
    boost_posts: config.min_score_boost_posts,
  };

  const minRequired = minScores[action];
  return {
    allowed: userScore >= minRequired,
    minRequired,
  };
}
