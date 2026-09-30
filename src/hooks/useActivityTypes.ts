// Tipos de atividade vindos de crm_activity_types (Configurações > Tipos de
// Atividade). Se a consulta falhar ou vier vazia, cai na lista fixa de sempre.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ActivityTypeOption, FALLBACK_ACTIVITY_TYPES } from "@/lib/crm/activityTypes";

interface Options {
  /** incluir inativos (tela de configuração e rótulo de atividade antiga) */
  includeInactive?: boolean;
}

export const useActivityTypes = (opts: Options = {}) => {
  const { includeInactive = false } = opts;
  const [all, setAll] = useState<ActivityTypeOption[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("crm_activity_types")
          .select("slug, name, icon, color, is_active, is_system, sort_order")
          .order("sort_order", { ascending: true })
          .order("name");
        if (error) throw error;
        if (!alive) return;
        const rows = (data || []) as any[];
        setAll(rows.length ? rows.map((r) => ({
          value: r.slug, label: r.name, icon: r.icon, color: r.color,
          isSystem: !!r.is_system, isActive: r.is_active !== false,
        })) : null);
      } catch (e) {
        console.warn("crm_activity_types indisponível, usando lista fixa:", e);
        if (alive) setAll(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const types = useMemo(() => {
    const base = all ?? FALLBACK_ACTIVITY_TYPES.map((t) => ({ ...t, isActive: true }));
    return includeInactive ? base : base.filter((t) => t.isActive !== false);
  }, [all, includeInactive]);

  const labelOf = useMemo(() => {
    const map = new Map<string, string>();
    (all ?? FALLBACK_ACTIVITY_TYPES).forEach((t) => map.set(t.value, t.label));
    return (value: string | null | undefined) => (value ? map.get(value) || value : "");
  }, [all]);

  const iconOf = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    (all ?? FALLBACK_ACTIVITY_TYPES).forEach((t) => map.set(t.value, t.icon));
    return (value: string | null | undefined) => (value ? map.get(value) || null : null);
  }, [all]);

  return { types, loading, labelOf, iconOf, fromTable: all !== null };
};
