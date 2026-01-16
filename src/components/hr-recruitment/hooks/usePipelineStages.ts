import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PIPELINE_STAGES } from "../types";

export interface PipelineStage {
  id: string;
  key: string;
  name: string;
  color: string;
  sort_order: number;
}

export function usePipelineStages(projectId: string) {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStages = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("hiring_pipeline_stages")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order");

    if (error) {
      console.error("Error fetching pipeline stages:", error);
      // Fall back to static stages
      setStages(PIPELINE_STAGES.map((s, i) => ({
        id: `static-${i}`,
        key: s.key,
        name: s.name,
        color: s.color,
        sort_order: i,
      })));
    } else if (data && data.length > 0) {
      setStages(data.map((s) => ({
        id: s.id,
        key: s.stage_key,
        name: s.name,
        color: s.color,
        sort_order: s.sort_order,
      })));
    } else {
      // No custom stages yet, use defaults
      setStages(PIPELINE_STAGES.map((s, i) => ({
        id: `static-${i}`,
        key: s.key,
        name: s.name,
        color: s.color,
        sort_order: i,
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStages();
  }, [projectId]);

  return { stages, loading, refetch: fetchStages };
}
