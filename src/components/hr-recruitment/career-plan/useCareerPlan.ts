import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CareerPlanForm, CareerPlanVersion, CareerTrack, CareerRole } from "./types";

export function useCareerPlan(projectId: string) {
  const [forms, setForms] = useState<CareerPlanForm[]>([]);
  const [versions, setVersions] = useState<CareerPlanVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<CareerPlanVersion | null>(null);
  const [tracks, setTracks] = useState<CareerTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchForms = useCallback(async () => {
    const { data } = await supabase
      .from("career_plan_forms")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setForms((data as any[]) || []);
  }, [projectId]);

  const fetchVersions = useCallback(async () => {
    const { data } = await supabase
      .from("career_plan_versions")
      .select("*")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false });
    const versionsList = (data as any[]) || [];
    setVersions(versionsList);
    const active = versionsList.find((v: any) => v.is_active) || versionsList[0] || null;
    setActiveVersion(active);
    return active;
  }, [projectId]);

  const fetchTracks = useCallback(async (versionId: string) => {
    const { data: tracksData } = await supabase
      .from("career_tracks")
      .select("*")
      .eq("version_id", versionId)
      .order("sort_order");

    const tracksList = (tracksData as any[]) || [];

    // Fetch roles for each track
    const trackIds = tracksList.map((t: any) => t.id);
    if (trackIds.length > 0) {
      const { data: rolesData } = await supabase
        .from("career_roles")
        .select("*")
        .in("track_id", trackIds)
        .order("level_order");

      const roleIds = ((rolesData as any[]) || []).map((r: any) => r.id);
      let criteriaData: any[] = [];
      let goalsData: any[] = [];

      if (roleIds.length > 0) {
        const [criteriaRes, goalsRes] = await Promise.all([
          supabase.from("career_criteria").select("*").in("role_id", roleIds).order("sort_order"),
          supabase.from("career_goals").select("*").in("role_id", roleIds).order("sort_order"),
        ]);
        criteriaData = (criteriaRes.data as any[]) || [];
        goalsData = (goalsRes.data as any[]) || [];
      }

      // Attach criteria and goals to roles
      const rolesWithDetails = ((rolesData as any[]) || []).map((role: any) => ({
        ...role,
        criteria: criteriaData.filter((c: any) => c.role_id === role.id),
        goals: goalsData.filter((g: any) => g.role_id === role.id),
      }));

      // Attach roles to tracks
      tracksList.forEach((track: any) => {
        track.roles = rolesWithDetails.filter((r: any) => r.track_id === track.id);
      });
    }

    setTracks(tracksList);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchForms();
    const active = await fetchVersions();
    if (active) {
      await fetchTracks(active.id);
    }
    setLoading(false);
  }, [fetchForms, fetchVersions, fetchTracks]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    forms,
    versions,
    activeVersion,
    tracks,
    loading,
    refresh,
    fetchTracks,
    setActiveVersion,
  };
}
