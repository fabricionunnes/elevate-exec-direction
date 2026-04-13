import { useState, useCallback } from "react";

export const ALL_METRIC_KEYS = [
  "spend", "impressions", "reach", "clicks", "ctr", "cpc", "cpm", "roas",
  "conversations", "cost_per_conversation", "frequency", "leads", "conversions",
  "profile_visits", "followers", "visit_to_follower",
] as const;

export type MetricKey = typeof ALL_METRIC_KEYS[number];

export const METRIC_LABELS: Record<MetricKey, string> = {
  spend: "Investimento",
  impressions: "Impressões",
  reach: "Alcance",
  clicks: "Cliques",
  ctr: "CTR",
  cpc: "CPC",
  cpm: "CPM",
  roas: "ROAS",
  conversations: "Conversas Iniciadas",
  cost_per_conversation: "Custo por Conversa",
  frequency: "Frequência",
  leads: "Leads",
  conversions: "Conversões",
  profile_visits: "Visitas ao Perfil",
  followers: "Seguidores",
  visit_to_follower: "Conversão Visita → Seguidor",
};

const STORAGE_KEY = "meta-ads-visible-metrics";

function loadVisible(): Set<MetricKey> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return new Set(JSON.parse(stored) as MetricKey[]);
  } catch {}
  return new Set(ALL_METRIC_KEYS);
}

function saveVisible(set: Set<MetricKey>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export function useMetricVisibility() {
  const [visibleMetrics, setVisibleMetrics] = useState<Set<MetricKey>>(loadVisible);

  const toggle = useCallback((key: MetricKey) => {
    setVisibleMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      saveVisible(next);
      return next;
    });
  }, []);

  const isVisible = useCallback((key: MetricKey) => visibleMetrics.has(key), [visibleMetrics]);

  return { visibleMetrics, toggle, isVisible };
}
