import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "@/pages/crm/CRMLayout";

/**
 * Acesso por funil (crm_pipeline_permissions) + permissões granulares (crm_staff_permissions).
 *
 * Regras (iguais às functions crm_pipeline_allows / current_user_has_crm_permission do banco):
 *  - master, admin e head comercial ignoram tudo;
 *  - funil: linha da pessoa > linha "todos" (staff_id null) > liberado;
 *  - granular (lead_create, lead_delete, lead_move...): precisa da chave concedida.
 */
export interface PipelinePerm {
  can_view: boolean;
  can_create: boolean;
  can_delete: boolean;
  can_change_owner: boolean;
  only_own_leads: boolean;
}

interface PermRow extends PipelinePerm {
  pipeline_id: string;
  staff_id: string | null;
}

export const PIPELINE_PERM_OPEN: PipelinePerm = {
  can_view: true,
  can_create: true,
  can_delete: true,
  can_change_owner: true,
  only_own_leads: false,
};

export function useCRMPipelinePermissions() {
  const { staffId, isAdmin, isMaster } = useCRMContext();
  const bypass = isAdmin || isMaster;
  const [rows, setRows] = useState<PermRow[]>([]);
  const [granular, setGranular] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!staffId || bypass) {
      setRows([]);
      setGranular(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [pipeRes, granRes] = await Promise.all([
        (supabase.from("crm_pipeline_permissions" as any) as any)
          .select("pipeline_id, staff_id, can_view, can_create, can_delete, can_change_owner, only_own_leads")
          .or(`staff_id.eq.${staffId},staff_id.is.null`),
        supabase.from("crm_staff_permissions").select("permission_key").eq("staff_id", staffId),
      ]);
      setRows((pipeRes.data || []) as PermRow[]);
      setGranular(new Set(((granRes.data || []) as { permission_key: string }[]).map((p) => p.permission_key)));
    } catch (e) {
      console.error("useCRMPipelinePermissions:", e);
    } finally {
      setLoading(false);
    }
  }, [staffId, bypass]);

  useEffect(() => {
    reload();
  }, [reload]);

  const permFor = useCallback(
    (pipelineId: string | null | undefined): PipelinePerm => {
      if (bypass || !pipelineId) return PIPELINE_PERM_OPEN;
      const own = rows.find((r) => r.pipeline_id === pipelineId && r.staff_id === staffId);
      const all = rows.find((r) => r.pipeline_id === pipelineId && r.staff_id === null);
      const r = own || all;
      if (!r) return PIPELINE_PERM_OPEN;
      return {
        can_view: !!r.can_view,
        can_create: !!r.can_create,
        can_delete: !!r.can_delete,
        can_change_owner: !!r.can_change_owner,
        only_own_leads: !!r.only_own_leads,
      };
    },
    [rows, staffId, bypass],
  );

  const has = useCallback((key: string) => bypass || granular.has(key), [bypass, granular]);

  return useMemo(() => ({ loading, bypass, permFor, has, reload }), [loading, bypass, permFor, has, reload]);
}
