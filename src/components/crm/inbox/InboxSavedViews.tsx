import { useMemo } from "react";
import { SavedViews } from "@/components/crm/views/SavedViews";
import {
  ConversationFiltersData, conversationFiltersFromJson, conversationFiltersToJson,
} from "@/components/crm/inbox/ConversationFilters";

export type InboxQuick = "all" | "unread" | "waiting" | "mine" | "automation" | "failed" | "hidden";
export type InboxChannel = "all" | "whatsapp" | "instagram";

const QUICKS: InboxQuick[] = ["all", "unread", "waiting", "mine", "automation", "failed", "hidden"];
const CHANNELS: InboxChannel[] = ["all", "whatsapp", "instagram"];
const STATUSES = ["all", "open", "pending", "closed"];

interface InboxSavedViewsProps {
  staffId: string | null;
  staffRole: string | null;
  quick: InboxQuick;
  setQuick: (v: InboxQuick) => void;
  instanceFilter: string;
  setInstanceFilter: (v: string) => void;
  channelFilter: InboxChannel;
  setChannelFilter: (v: InboxChannel) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filters: ConversationFiltersData;
  setFilters: (v: ConversationFiltersData) => void;
}

/**
 * Visões salvas do Atendimento. Junta num lugar só o que a tela filtra em vários
 * estados (atalho, número, canal, status, busca e o painel de filtros) pra guardar
 * e reaplicar de uma vez, sem espalhar essa lógica pelo CRMInboxPage.
 */
export function InboxSavedViews(p: InboxSavedViewsProps) {
  const current = useMemo(() => ({
    quick: p.quick,
    instance: p.instanceFilter,
    channel: p.channelFilter,
    status: p.filterStatus,
    search: p.searchTerm.trim(),
    filters: conversationFiltersToJson(p.filters),
  }), [p.quick, p.instanceFilter, p.channelFilter, p.filterStatus, p.searchTerm, p.filters]);

  const apply = (v: Record<string, any>) => {
    p.setQuick(QUICKS.includes(v.quick) ? v.quick : "all");
    p.setInstanceFilter(typeof v.instance === "string" && v.instance ? v.instance : "all");
    p.setChannelFilter(CHANNELS.includes(v.channel) ? v.channel : "all");
    p.setFilterStatus(STATUSES.includes(v.status) ? v.status : "all");
    p.setSearchTerm(typeof v.search === "string" ? v.search : "");
    p.setFilters(conversationFiltersFromJson(v.filters));
  };

  return (
    <SavedViews
      compact
      scope="atendimento"
      staffId={p.staffId}
      canManageShared={p.staffRole === "master" || p.staffRole === "admin"}
      current={current}
      onApply={apply}
    />
  );
}
