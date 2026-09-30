import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { syncLeadToClint } from "@/hooks/useClintSync";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Loader2,
  Upload,
  TrendingUp,
  Handshake,
  LayoutGrid,
  List,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { AddLeadDialog } from "@/components/crm/AddLeadDialog";
import { ImportLeadsDialog } from "@/components/crm/ImportLeadsDialog";
import { createStageActivities } from "@/hooks/useStageActions";
import { AddActivityDialog } from "@/components/crm/AddActivityDialog";
import { createProjectFromWonLead } from "@/hooks/useCreateProjectOnWon";
import { trackMeetingEventOnStageChange, isRealizedStage } from "@/hooks/useMeetingEventTracker";
import { CRMFiltersBar, CRMFilters, LeadFieldOption } from "@/components/crm/CRMFiltersBar";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { KanbanTableView } from "@/components/crm/KanbanTableView";
import { StageGateDialog } from "@/components/crm/StageGateDialog";
import { useCRMPipelinePermissions } from "@/hooks/useCRMPipelinePermissions";
import { checkStageGate, gateIsBlocked, logGateOverride, type LeadGateResult } from "@/lib/crm/stageGate";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { useCRMContext } from "./CRMLayout";
import { KanbanLeadCard } from "@/components/crm/KanbanLeadCard";
import { KanbanStageColumn } from "@/components/crm/KanbanStageColumn";
import { KanbanBulkActions } from "@/components/crm/KanbanBulkActions";
import { useDragScroll } from "@/hooks/useDragScroll";

/** Colunas que o kanban carrega (kanban, tabela e busca no banco usam a mesma lista). */
const LEAD_SELECT = `
  id, name, company, phone, email, document, stage_id, origin_id, owner_staff_id, closer_staff_id,
  opportunity_value, estimated_revenue, probability, last_activity_at, next_activity_at, urgency, notes, created_at, stage_entered_at,
  closed_at, product_id, loss_reason_id, city, state, segment, employee_count, instagram, cpf, role,
  utm_source, utm_campaign, utm_content, utm_term, meta_campaign_id, meta_adset_id, meta_ad_id,
  campaign_name, adset_name, ad_name,
  origin:crm_origins(name),
  owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name, avatar_url),
  closer:onboarding_staff!crm_leads_closer_staff_id_fkey(name, avatar_url),
  tags:crm_lead_tags(tag:crm_tags(id, name, color)),
  meeting_events:crm_meeting_events(event_type)
`;

/** Ordenação dos cards dentro de cada etapa (lembrada por funil no navegador). */
type SortMode = "recent" | "oldest" | "stale_most" | "stale_least" | "value_desc" | "value_asc" | "last_activity";
const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "stale_most", label: "Mais tempo parado na etapa" },
  { value: "stale_least", label: "Menos tempo parado" },
  { value: "value_desc", label: "Maior valor" },
  { value: "value_asc", label: "Menor valor" },
  { value: "last_activity", label: "Última atividade" },
];
const sortKey = (pipelineId: string) => `crm-kanban-sort-${pipelineId}`;

/** Campo de sistema (crm_custom_fields.is_system) -> coluna do lead que o kanban já carrega. */
const SYSTEM_FIELD_COLUMN: Record<string, string> = {
  name: "name", company: "company", company_name: "company", email: "email", phone: "phone",
  opportunity_value: "opportunity_value", notes: "notes", product_id: "product_id", closer_staff_id: "closer_staff_id",
  sdr_staff_id: "sdr_staff_id", origin_name: "origin", created_at: "created_at", city: "city", state: "state",
  segment: "segment", employee_count: "employee_count", instagram: "instagram", cpf: "cpf", document: "document",
};
const VIEW_KEY = "crm-kanban-view";

interface Stage {
  id: string;
  name: string;
  sort_order: number;
  is_final: boolean;
  final_type: string | null;
  color: string;
  pipeline_id: string;
}

interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  document: string | null;
  stage_id: string;
  origin_id: string | null;
  owner_staff_id: string | null;
  opportunity_value: number | null;
  estimated_revenue?: string | null;
  probability: number | null;
  last_activity_at: string | null;
  next_activity_at: string | null;
  urgency: string | null;
  notes: string | null;
  created_at: string;
  stage_entered_at?: string | null;
  closed_at?: string | null;
  product_id?: string | null;
  loss_reason_id?: string | null;
  city?: string | null;
  state?: string | null;
  segment?: string | null;
  employee_count?: string | null;
  instagram?: string | null;
  cpf?: string | null;
  role?: string | null;
  origin?: { name: string } | null;
  owner?: { name: string; avatar_url?: string | null } | null;
  closer_staff_id?: string | null;
  closer?: { name: string; avatar_url?: string | null } | null;
  tags?: { tag: { id: string; name: string; color: string } }[];
  meeting_events?: { event_type: string }[];
}

/** Mesma leitura que a função crm_faturamento_num faz no banco: "600000", "R$ 0 a R$ 50 mil",
 *  "9 mil por mês (30 alunos a 300)". Vários números próximos viram o ponto médio; distantes,
 *  fica o maior, porque aí o texto misturou ticket com faturamento. */
function lerFaturamento(txt?: string | null): number | null {
  if (!txt || !txt.trim()) return null;
  let t = txt.toLowerCase().replace(/r\$/g, " ");
  t = t.replace(/(\d)\.(\d{3})(?=\D|$)/g, "$1$2").replace(/(\d)\.(\d{3})(?=\D|$)/g, "$1$2").replace(/,/g, ".");
  const achados: number[] = [];
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(milh[oõ]es|milhao|milhão|mil|kk|k)?/g)) {
    let v = Number(m[1]);
    if (!isFinite(v)) continue;
    const suf = m[2] || "";
    if (["milhoes", "milhões", "milhao", "milhão", "kk"].includes(suf)) v *= 1000000;
    else if (suf === "mil" || suf === "k") v *= 1000;
    if (v >= 100) achados.push(v);
  }
  if (!achados.length) return null;
  if (achados.length === 1) return achados[0];
  const mn = Math.min(...achados), mx = Math.max(...achados);
  return mx <= mn * 5 ? (mn + mx) / 2 : mx;
}

const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const defaultFilters: CRMFilters = {
  search: "",
  dateRange: undefined,
  fields: [],
  tags: [],
  tagsExclude: [],
  owners: [],
  status: [],
  stages: [],
  origins: [],
  valueMin: null,
  valueMax: null,
  revenueMin: null,
  revenueMax: null,
  phoneFilter: "all",
};

export const CRMPipelinePage = () => {
  const navigate = useNavigate();
  const { selectedOrigin, selectedPipeline, setSelectedPipeline, isAdmin, isMaster, staffId } = useCRMContext();
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filters, setFilters] = useState<CRMFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [importLeadsOpen, setImportLeadsOpen] = useState(false);
  const [addLeadStageId, setAddLeadStageId] = useState<string | undefined>(undefined);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  
  // Drag scroll for horizontal kanban
  const { ref: dragScrollRef, isDragging: isDraggingScroll, bind: dragScrollBind } = useDragScroll();
  
  // Bulk selection state
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  // Filter options
  const [tagOptions, setTagOptions] = useState<{ id: string; name: string; color: string }[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<{ id: string; name: string }[]>([]);
  const [originOptions, setOriginOptions] = useState<{ id: string; name: string }[]>([]);
  const [productOptions, setProductOptions] = useState<{ id: string; name: string }[]>([]);
  const [lossReasonOptions, setLossReasonOptions] = useState<{ id: string; name: string }[]>([]);
  const [fieldOptions, setFieldOptions] = useState<LeadFieldOption[]>([]);
  // valores dos campos adicionais usados nas condições do filtro "Campos" (lead -> campo -> valor)
  const [customValues, setCustomValues] = useState<Record<string, Record<string, string | null>>>({});

  // Acesso por funil + permissões granulares (master/admin ignoram)
  const perms = useCRMPipelinePermissions();
  const pipePerm = perms.permFor(selectedPipeline);
  const canCreateLead = pipePerm.can_create && perms.has("lead_create");
  const canDeleteLead = pipePerm.can_delete && perms.has("lead_delete");
  const canMoveLead = perms.has("lead_move");
  const canChangeOwner = pipePerm.can_change_owner;

  // Ordenação dos cards e modo de visualização (kanban / tabela)
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [viewMode, setViewMode] = useState<"kanban" | "table">(() => {
    try { return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "kanban"; } catch { return "kanban"; }
  });
  useEffect(() => {
    if (!selectedPipeline) return;
    try {
      const saved = localStorage.getItem(sortKey(selectedPipeline)) as SortMode | null;
      setSortMode(saved && SORT_OPTIONS.some((o) => o.value === saved) ? saved : "recent");
    } catch { setSortMode("recent"); }
  }, [selectedPipeline]);
  const changeSort = (m: SortMode) => {
    setSortMode(m);
    if (selectedPipeline) { try { localStorage.setItem(sortKey(selectedPipeline), m); } catch { /* sem storage */ } }
  };
  const changeView = (v: "kanban" | "table") => {
    setViewMode(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* sem storage */ }
  };

  // Trava de etapa (atividade obrigatória pendente / campo exigido): diálogo de pendências
  const [gate, setGate] = useState<{ result: LeadGateResult; targetStageName: string } | null>(null);
  
  // Summary cards state
  const [forecastTotal, setForecastTotal] = useState(0);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [negotiationTotal, setNegotiationTotal] = useState(0);
  const [negotiationData, setNegotiationData] = useState<any[]>([]);

  // Stage move dialog state
  // Tarefa obrigatória de próximo contato ao mover pra etapa de reunião agendada
  const [forcedTask, setForcedTask] = useState<{ leadId: string; motivo: "agendada" | "realizada" } | null>(null);
  const [stageMoveDialog, setStageMoveDialog] = useState<{
    open: boolean;
    leadId: string;
    targetStageId: string;
    targetStageName: string;
  }>({ open: false, leadId: "", targetStageId: "", targetStageName: "" });
  const [stageNote, setStageNote] = useState("");
  const [movingLead, setMovingLead] = useState(false);

  const loadPipelines = async () => {
    const { data } = await supabase
      .from("crm_pipelines")
      .select("*")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("sort_order", { ascending: true });
    
    setPipelines(data || []);
    // Só escolhe o funil padrão se ninguém escolheu um até a lista chegar. O menu de
    // origens seleciona a 1ª origem + o funil dela ao abrir Negócios; antes esta
    // resposta chegava depois e trocava pro funil padrão (Leads Clint, 40 mil leads):
    // origem FUNIL SE com colunas de outro funil, zeradas e carregando sem fim (15/09/2026).
    if (data && data.length > 0) {
      (setSelectedPipeline as unknown as (fn: (prev: string | null) => string | null) => void)(
        (prev) => prev || data[0].id,
      );
    }
  };

  const loadFilterOptions = async () => {
    const [tagsRes, ownersRes, originsRes, productsRes, reasonsRes, fieldsRes] = await Promise.all([
      supabase.from("crm_tags").select("id, name, color").eq("is_active", true),
      supabase.from("onboarding_staff").select("id, name").eq("is_active", true)
        .in("role", ["master", "admin", "head_comercial", "closer", "sdr"]),
      supabase.from("crm_origins").select("id, name").eq("is_active", true),
      supabase.from("onboarding_services").select("id, name").eq("is_active", true).order("name"),
      supabase.from("crm_loss_reasons").select("id, name").eq("is_active", true).order("sort_order"),
      supabase.from("crm_custom_fields").select("id, field_name, field_label, field_type, context, is_system").eq("is_active", true).order("sort_order"),
    ]);

    setTagOptions(tagsRes.data || []);
    setOwnerOptions(ownersRes.data || []);
    setOriginOptions(originsRes.data || []);
    setProductOptions(productsRes.data || []);
    setLossReasonOptions(reasonsRes.data || []);
    setFieldOptions(
      ((fieldsRes.data || []) as any[])
        // só entra no filtro campo de sistema que o kanban carrega como coluna do lead
        .filter((f) => !f.is_system || SYSTEM_FIELD_COLUMN[f.field_name])
        .map((f) => ({ id: f.id, name: f.field_label || f.field_name, is_system: !!f.is_system, field_name: f.field_name, field_type: f.field_type, context: f.context })),
    );
  };

  // Campos adicionais (não sistema) das condições ativas: busca os valores no banco,
  // paginando de 1000 em 1000 (PostgREST corta em 1000).
  const customFieldIdsInUse = useMemo(() => {
    const ids = (filters.fieldConditions || [])
      .map((c) => fieldOptions.find((f) => f.id === c.fieldId))
      .filter((f) => f && !f.is_system)
      .map((f) => f!.id);
    return [...new Set(ids)].sort().join(",");
  }, [filters.fieldConditions, fieldOptions]);
  useEffect(() => {
    if (!customFieldIdsInUse) { setCustomValues({}); return; }
    let vivo = true;
    (async () => {
      try {
        const ids = customFieldIdsInUse.split(",");
        const rows = await fetchAllRows<{ lead_id: string; field_id: string; value: string | null }>((from, to) =>
          supabase.from("crm_custom_field_values").select("lead_id, field_id, value").in("field_id", ids).range(from, to),
        );
        if (!vivo) return;
        const map: Record<string, Record<string, string | null>> = {};
        for (const r of rows) (map[r.lead_id] ||= {})[r.field_id] = r.value;
        setCustomValues(map);
      } catch (e) {
        console.error("customValues:", e);
      }
    })();
    return () => { vivo = false; };
  }, [customFieldIdsInUse]);

  const loadSummaryCards = useCallback(async () => {
    try {
      // Find all "Forecast" stages across ALL pipelines
      const { data: forecastStages } = await supabase
        .from("crm_stages")
        .select("id")
        .ilike("name", "%forecast%");

      if (forecastStages && forecastStages.length > 0) {
        const stageIds = forecastStages.map(s => s.id);
        let forecastQuery = supabase
          .from("crm_leads")
          .select("id, opportunity_value, owner_staff_id")
          .in("stage_id", stageIds);
        if (selectedOrigin) {
          forecastQuery = forecastQuery.eq("origin_id", selectedOrigin);
        }
        const { data: forecastLeads } = await forecastQuery;
        setForecastData(forecastLeads || []);
      } else {
        setForecastData([]);
      }

      // Find all "Realizada" stages across ALL pipelines
      const { data: realizadaStages } = await supabase
        .from("crm_stages")
        .select("id")
        .ilike("name", "%realizada%");

      if (realizadaStages && realizadaStages.length > 0) {
        const stageIds = realizadaStages.map(s => s.id);
        let negQuery = supabase
          .from("crm_leads")
          .select("id, opportunity_value, owner_staff_id")
          .in("stage_id", stageIds);
        if (selectedOrigin) {
          negQuery = negQuery.eq("origin_id", selectedOrigin);
        }
        const { data: negotiationLeads } = await negQuery;
        setNegotiationData(negotiationLeads || []);
      } else {
        setNegotiationData([]);
      }
    } catch (error) {
      console.error("Error loading summary cards:", error);
    }
  }, [selectedOrigin]);

  // Compute filtered totals based on owner filter
  const filteredForecastTotal = useMemo(() => {
    const ownerFilter = filters.owners;
    const data = ownerFilter.length > 0
      ? forecastData.filter(f => ownerFilter.includes(f.owner_staff_id))
      : forecastData;
    return data.reduce((sum, f) => sum + (f.opportunity_value || 0), 0);
  }, [forecastData, filters.owners]);

  const filteredNegotiationTotal = useMemo(() => {
    const ownerFilter = filters.owners;
    const data = ownerFilter.length > 0
      ? negotiationData.filter(l => ownerFilter.includes(l.owner_staff_id))
      : negotiationData;
    return data.reduce((sum, l) => sum + (l.opportunity_value || 0), 0);
  }, [negotiationData, filters.owners]);

  const isRealtimeRefresh = useRef(false);
  const loadFnRef = useRef<() => Promise<void>>();
  const activeLoadIdRef = useRef(0);

  const loadStagesAndLeads = useCallback(async () => {
    if (!selectedPipeline) return;

    const loadId = ++activeLoadIdRef.current;
    const isCurrentLoad = () => activeLoadIdRef.current === loadId;
    let effectiveOrigin = selectedOrigin;

    if (!isRealtimeRefresh.current) {
      setLoading(true);
    }

    try {
      const FIRST_PAGE = 200;

      const buildLeadQuery = (origin: string | null, from: number, size: number) => {
        let query = supabase
          .from("crm_leads")
          .select(LEAD_SELECT)
          .eq("pipeline_id", selectedPipeline)
          .order("created_at", { ascending: false })
          .range(from, from + size - 1);

        if (origin) {
          query = query.eq("origin_id", origin);
        }

        return query;
      };

      const originCheckPromise = effectiveOrigin
        ? supabase.from("crm_origins").select("pipeline_id").eq("id", effectiveOrigin).single()
        : Promise.resolve({ data: null, error: null });

      const [stagesRes, originRes] = await Promise.all([
        supabase.from("crm_stages").select("*").eq("pipeline_id", selectedPipeline).order("sort_order"),
        originCheckPromise,
      ]);

      if (!isCurrentLoad()) return;

      if (stagesRes.error) {
        console.error("Error loading stages:", stagesRes.error);
        return;
      }

      if (originRes.data && originRes.data.pipeline_id !== selectedPipeline) {
        // Origem de outro funil: troca pro funil da origem (dispara nova carga) em vez de
        // ignorar a origem e baixar o funil errado inteiro.
        if (originRes.data.pipeline_id) {
          setSelectedPipeline(originRes.data.pipeline_id);
          return;
        }
        effectiveOrigin = null;
      }

      setStages(stagesRes.data || []);

      const { data: firstPage, error: firstError } = await buildLeadQuery(effectiveOrigin, 0, FIRST_PAGE);
      if (!isCurrentLoad()) return;

      if (firstError) {
        console.error("Error loading leads:", firstError);
        return;
      }

      const firstBatch = (firstPage || []) as Lead[];
      if (firstBatch.length > 0 || !isRealtimeRefresh.current) {
        setLeads(firstBatch);
      }
      setLoading(false);
      isRealtimeRefresh.current = false;

      if (firstBatch.length === FIRST_PAGE) {
        // Resto do funil em paralelo (4 páginas por vez) e já pintando na tela a
        // cada página. Antes era uma página de 500 por vez, em fila: funil de
        // 1.400 leads levava vários segundos com etapas zeradas (14/09/2026).
        const PAGE_SIZE = 500;
        const MAX_LEADS = 10000;
        const CONCURRENCY = 4;
        let countQuery = supabase
          .from("crm_leads")
          .select("id", { count: "exact", head: true })
          .eq("pipeline_id", selectedPipeline);
        if (effectiveOrigin) countQuery = countQuery.eq("origin_id", effectiveOrigin);
        const { count } = await countQuery;
        if (!isCurrentLoad()) return;

        const total = Math.min(count ?? MAX_LEADS, MAX_LEADS);
        const offsets: number[] = [];
        for (let from = FIRST_PAGE; from < total; from += PAGE_SIZE) offsets.push(from);

        const pages: Lead[][] = new Array(offsets.length);
        const publish = () => {
          const loaded = [firstBatch];
          for (const pg of pages) if (pg) loaded.push(pg);
          const seen = new Set<string>();
          const merged: Lead[] = [];
          for (const pg of loaded) for (const l of pg) {
            if (!seen.has(l.id)) { seen.add(l.id); merged.push(l); }
          }
          setLeads(merged);
        };

        let next = 0;
        const worker = async () => {
          while (next < offsets.length) {
            const idx = next++;
            const { data: pageData, error: pageError } = await buildLeadQuery(effectiveOrigin, offsets[idx], PAGE_SIZE);
            if (!isCurrentLoad()) return;
            if (pageError) { console.error("Error loading leads page:", pageError); continue; }
            pages[idx] = (pageData || []) as Lead[];
            publish();
          }
        };
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, offsets.length) }, worker));

        // Se entrou lead novo durante a carga e passou do count, busca a sobra.
        if (isCurrentLoad() && count != null && offsets.length > 0) {
          const lastFrom = offsets[offsets.length - 1] + PAGE_SIZE;
          if (lastFrom < MAX_LEADS && (pages[pages.length - 1]?.length ?? 0) === PAGE_SIZE) {
            const { data: extra } = await buildLeadQuery(effectiveOrigin, lastFrom, PAGE_SIZE);
            if (isCurrentLoad() && extra?.length) { pages.push(extra as Lead[]); publish(); }
          }
        }
      }
    } catch (error) {
      if (!isCurrentLoad()) return;
      console.error("Error loading pipeline data:", error);
      setLoading(false);
      isRealtimeRefresh.current = false;
    }
  }, [selectedPipeline, selectedOrigin]);

  // Keep a ref to the latest load function so realtime always calls the current version
  useEffect(() => {
    loadFnRef.current = loadStagesAndLeads;
  }, [loadStagesAndLeads]);

  useEffect(() => {
    loadPipelines();
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadSummaryCards();
  }, [loadSummaryCards]);

  // Funil sem visão pra este usuário: some da lista e, se estava selecionado, troca pro
  // primeiro liberado (o banco já esconde o funil e os leads; aqui é só a tela acompanhar).
  const visiblePipelines = useMemo(
    () => pipelines.filter((p) => perms.permFor(p.id).can_view),
    [pipelines, perms],
  );
  useEffect(() => {
    if (perms.loading || !selectedPipeline || pipelines.length === 0) return;
    if (!perms.permFor(selectedPipeline).can_view) {
      toast.error("Você não tem acesso a este funil");
      setSelectedPipeline(visiblePipelines[0]?.id || null);
    }
  }, [perms, selectedPipeline, pipelines.length, visiblePipelines, setSelectedPipeline]);

  useEffect(() => {
    loadStagesAndLeads();
  }, [loadStagesAndLeads]);

  // Realtime subscription - only depends on selectedPipeline to avoid
  // unnecessary channel teardown/recreation when origin changes
  useEffect(() => {
    if (!selectedPipeline) return;

    // Debounce: mover leads em massa gera 1 evento por lead. Sem espera, 200
    // eventos = 200 recarregamentos que se cancelavam entre si e a tela ficava
    // presa nos 200 mais recentes (14/09/2026, funil Disparo API Oficial).
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`crm-leads-${selectedPipeline}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crm_leads",
          filter: `pipeline_id=eq.${selectedPipeline}`,
        },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            debounceTimer = null;
            isRealtimeRefresh.current = true;
            loadFnRef.current?.();
          }, 1500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [selectedPipeline]);

  // Filter leads
  // Exporta em CSV o que está na tela (com os filtros aplicados). Restrito a
  // master/admin — a base de leads é dado sensível do negócio.
  const exportLeadsCsv = () => {
    if (!(isMaster || isAdmin)) { toast.error("Sem permissão para exportar"); return; }
    const linhas = filteredLeads;
    if (!linhas.length) { toast.error("Nada para exportar com os filtros atuais"); return; }
    const stageName = (id: string) => stages.find((st: any) => st.id === id)?.name || "";
    const cols: { h: string; get: (l: any) => string }[] = [
      { h: "Nome", get: (l) => l.name || "" },
      { h: "Empresa", get: (l) => l.company || "" },
      { h: "Telefone", get: (l) => l.phone || "" },
      { h: "Email", get: (l) => l.email || "" },
      { h: "Documento", get: (l) => l.document || "" },
      { h: "Etapa", get: (l) => stageName(l.stage_id) },
      { h: "Origem", get: (l) => l.origin?.name || "" },
      { h: "Responsavel", get: (l) => l.owner?.name || "" },
      { h: "Valor", get: (l) => (l.opportunity_value ?? "") === "" ? "" : String(l.opportunity_value).replace(".", ",") },
      { h: "Criado em", get: (l) => l.created_at ? new Date(l.created_at).toLocaleString("pt-BR") : "" },
      { h: "Ultima atividade", get: (l) => l.last_activity_at ? new Date(l.last_activity_at).toLocaleString("pt-BR") : "" },
      { h: "Campanha", get: (l) => l.campaign_name || l.utm_campaign || "" },
      { h: "Conjunto", get: (l) => l.adset_name || l.utm_term || "" },
      { h: "Anuncio", get: (l) => l.ad_name || l.utm_content || "" },
      { h: "Tags", get: (l) => (l.tags || []).map((t: any) => t.tag?.name).filter(Boolean).join(" | ") },
    ];
    const esc = (v: string) => `"${String(v).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    const csv = [
      cols.map((c) => esc(c.h)).join(";"),
      ...linhas.map((l: any) => cols.map((c) => esc(c.get(l))).join(";")),
    ].join("\r\n");
    // BOM: o Excel em pt-BR precisa dele pra não quebrar os acentos
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const hoje = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `leads-${(selectedOriginName || "crm").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${hoje}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${linhas.length} lead(s) exportado(s)`);
  };

  // O kanban carrega por página, então digitar no buscar só encontrava quem já tinha
  // chegado na tela. Agora, a partir de 3 letras, a busca vai ao banco e traz o resto
  // (25/09/2026: o Erick, da distribuidora de pet, não aparecia por isso).
  const [leadsBusca, setLeadsBusca] = useState<Lead[]>([]);
  useEffect(() => {
    const termo = (filters.search || "").trim();
    if (termo.length < 3 || !selectedPipeline) { setLeadsBusca([]); return; }
    let vivo = true;
    const t = setTimeout(async () => {
      const like = `%${termo.replace(/[%,]/g, " ")}%`;
      let q = supabase
        .from("crm_leads")
        .select(LEAD_SELECT)
        .eq("pipeline_id", selectedPipeline)
        .or(`name.ilike.${like},company.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
        .limit(300);
      if (selectedOrigin) q = q.eq("origin_id", selectedOrigin);
      const { data } = await q;
      if (vivo) setLeadsBusca((data || []) as any);
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [filters.search, selectedPipeline, selectedOrigin]);

  const filteredLeads = useMemo(() => {
    const porId = new Map<string, Lead>();
    for (const l of leads) porId.set(l.id, l);
    for (const l of leadsBusca) if (!porId.has(l.id)) porId.set(l.id, l);
    return [...porId.values()].filter(lead => {
      // Só os meus (acesso por funil) — o banco também esconde, aqui é pra tela reagir na hora
      if (pipePerm.only_own_leads && lead.owner_staff_id !== staffId) return false;

      // Search filter: o "Campos" (Contato / Negócio / Empresa) limita onde o texto procura
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const scope = filters.fields || [];
        const campos: (string | null | undefined)[] = [];
        if (scope.length === 0) campos.push(lead.name, lead.company, lead.email, lead.phone);
        if (scope.includes("contact")) campos.push(lead.name, lead.email, lead.phone, lead.instagram, lead.role);
        if (scope.includes("company")) campos.push(lead.company, lead.document, lead.segment, lead.city, lead.state);
        if (scope.includes("deal")) campos.push(lead.notes, lead.estimated_revenue, lead.opportunity_value != null ? String(lead.opportunity_value) : null, productOptions.find((p) => p.id === lead.product_id)?.name);
        const matchesSearch = campos.some((c) => (c || "").toLowerCase().includes(search));
        if (!matchesSearch) return false;
      }

      // Produto / motivo de perda
      if (filters.products?.length && (!lead.product_id || !filters.products.includes(lead.product_id))) return false;
      if (filters.lossReasons?.length && (!lead.loss_reason_id || !filters.lossReasons.includes(lead.loss_reason_id))) return false;

      // Data da última mudança de etapa
      if (filters.movedRange?.from) {
        if (!lead.stage_entered_at) return false;
        const d = new Date(lead.stage_entered_at);
        if (d < filters.movedRange.from) return false;
        if (filters.movedRange.to && d > endOfDay(filters.movedRange.to)) return false;
      }
      // Data de ganho: closed_at, e só quem está numa etapa de ganho
      if (filters.wonRange?.from) {
        const ft = stages.find((st) => st.id === lead.stage_id)?.final_type;
        if (ft !== "won" || !lead.closed_at) return false;
        const d = new Date(lead.closed_at);
        if (d < filters.wonRange.from) return false;
        if (filters.wonRange.to && d > endOfDay(filters.wonRange.to)) return false;
      }

      // Sem atividade há N dias (ou nunca) / sem responsável
      if (filters.inactiveDays) {
        const limite = Date.now() - filters.inactiveDays * 86400000;
        if (lead.last_activity_at && new Date(lead.last_activity_at).getTime() > limite) return false;
      }
      if (filters.noOwner && lead.owner_staff_id) return false;

      // Condições em campos (coluna do lead ou campo adicional)
      for (const cond of filters.fieldConditions || []) {
        const def = fieldOptions.find((f) => f.id === cond.fieldId);
        if (!def) continue;
        let raw: unknown = def.is_system
          ? (SYSTEM_FIELD_COLUMN[def.field_name] === "origin" ? lead.origin?.name : (lead as any)[SYSTEM_FIELD_COLUMN[def.field_name]])
          : customValues[lead.id]?.[def.id];
        if (def.is_system && def.field_name === "product_id") raw = productOptions.find((p) => p.id === raw)?.name || raw;
        if (def.is_system && (def.field_name === "closer_staff_id" || def.field_name === "sdr_staff_id")) raw = ownerOptions.find((o) => o.id === raw)?.name || raw;
        const val = raw == null ? "" : String(raw).trim();
        const alvo = cond.value.toLowerCase();
        if (cond.op === "empty" && val !== "") return false;
        if (cond.op === "not_empty" && val === "") return false;
        if (cond.op === "contains" && !val.toLowerCase().includes(alvo)) return false;
        if (cond.op === "equals" && val.toLowerCase() !== alvo) return false;
      }

      // Tags filter
      if (filters.tags.length > 0) {
        const leadTagIds = lead.tags?.map(t => t.tag.id) || [];
        if (!filters.tags.some(tagId => leadTagIds.includes(tagId))) return false;
      }
      // Tags excluídas: esconde quem tem qualquer uma delas
      if (filters.tagsExclude?.length) {
        const leadTagIds = lead.tags?.map(t => t.tag.id) || [];
        if (filters.tagsExclude.some(tagId => leadTagIds.includes(tagId))) return false;
      }

      // Owner filter
      if (filters.owners.length > 0) {
        if (!lead.owner_staff_id || !filters.owners.includes(lead.owner_staff_id)) return false;
      }

      // Stage filter
      if (filters.stages.length > 0) {
        if (!filters.stages.includes(lead.stage_id)) return false;
      }

      // Status (Aberto / Ganho / Perdido) — vem do final_type da etapa. O filtro existia na
      // barra mas ninguém aplicava aqui (22/09/2026).
      if (filters.status?.length) {
        const ft = stages.find((st) => st.id === lead.stage_id)?.final_type;
        const status = ft === "won" ? "won" : ft === "lost" ? "lost" : "open";
        if (!filters.status.includes(status)) return false;
      }

      // Value filter
      if (filters.valueMin !== null && (lead.opportunity_value || 0) < filters.valueMin) return false;
      if (filters.valueMax !== null && (lead.opportunity_value || 0) > filters.valueMax) return false;

      // Faturamento que o lead informou: o campo é texto livre, então lê por aproximação
      if (filters.revenueMin != null || filters.revenueMax != null) {
        const fat = lerFaturamento(lead.estimated_revenue);
        if (fat == null) return false;   // sem informação não entra quando o filtro está ligado
        if (filters.revenueMin != null && fat < filters.revenueMin) return false;
        if (filters.revenueMax != null && fat > filters.revenueMax) return false;
      }

      // Date filter
      if (filters.dateRange?.from) {
        const leadDate = new Date(lead.created_at);
        if (leadDate < filters.dateRange.from) return false;
        if (filters.dateRange.to && leadDate > filters.dateRange.to) return false;
      }

      // Phone filter
      if (filters.phoneFilter === "with_phone") {
        if (!lead.phone) return false;
      } else if (filters.phoneFilter === "without_phone") {
        if (lead.phone) return false;
      }

      // Filtro por anúncio (Meta): campanha / conjunto / anúncio.
      // Nome oficial quando existe; senão cai no UTM (padrão dos leads atuais).
      const adNames = (l: any) => ({
        camp: l.campaign_name || l.utm_campaign || null,
        adset: l.adset_name || l.utm_term || null,
        ad: l.ad_name || l.utm_content || null,
      });
      const an = adNames(lead as any);
      if ((filters.campaigns?.length || 0) > 0 && (!an.camp || !filters.campaigns!.includes(an.camp))) return false;
      if ((filters.adsets?.length || 0) > 0 && (!an.adset || !filters.adsets!.includes(an.adset))) return false;
      if ((filters.ads?.length || 0) > 0 && (!an.ad || !filters.ads!.includes(an.ad))) return false;

      return true;
    });
  }, [leads, leadsBusca, filters, stages, pipePerm.only_own_leads, staffId, productOptions, ownerOptions, fieldOptions, customValues]);

  // Leads por etapa já na ordem escolhida (um sort por etapa, só quando muda algo)
  const leadsByStage = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const l of filteredLeads) {
      const arr = map.get(l.stage_id);
      if (arr) arr.push(l); else map.set(l.stage_id, [l]);
    }
    const ts = (v: string | null | undefined) => (v ? new Date(v).getTime() : null);
    // tempo na etapa: o mesmo campo que o card mostra (stage_entered_at), caindo em created_at
    const entrou = (l: Lead) => ts(l.stage_entered_at) ?? ts(l.created_at) ?? 0;
    const cmp: Record<SortMode, (a: Lead, b: Lead) => number> = {
      recent: (a, b) => (ts(b.created_at) || 0) - (ts(a.created_at) || 0),
      oldest: (a, b) => (ts(a.created_at) || 0) - (ts(b.created_at) || 0),
      stale_most: (a, b) => entrou(a) - entrou(b),
      stale_least: (a, b) => entrou(b) - entrou(a),
      value_desc: (a, b) => (b.opportunity_value || 0) - (a.opportunity_value || 0),
      value_asc: (a, b) => (a.opportunity_value || 0) - (b.opportunity_value || 0),
      // sem atividade vai pro fim
      last_activity: (a, b) => (ts(b.last_activity_at) ?? -1) - (ts(a.last_activity_at) ?? -1),
    };
    if (sortMode !== "recent") for (const arr of map.values()) arr.sort(cmp[sortMode]);
    return map;
  }, [filteredLeads, sortMode]);

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    
    if (!draggedLead || draggedLead.stage_id === stageId) {
      setDraggedLead(null);
      return;
    }

    if (!canMoveLead) {
      toast.error("Você não tem permissão para mover leads entre etapas");
      setDraggedLead(null);
      return;
    }

    const targetStage = stages.find(s => s.id === stageId);
    const currentStage = stages.find(s => s.id === draggedLead.stage_id);

    // 🛡️ Proteção: impedir mover acidentalmente um lead já fechado (Ganho/Perdido)
    // de volta para uma etapa do funil — isso bagunça as métricas de venda.
    if (currentStage?.final_type === "won" || currentStage?.final_type === "lost") {
      const fromLabel = currentStage.final_type === "won" ? "GANHO" : "PERDIDO";
      const confirmed = window.confirm(
        `⚠️ ATENÇÃO\n\nO lead "${draggedLead.name || "sem nome"}" já está marcado como ${fromLabel}.\n\n` +
        `Mover para "${targetStage?.name || "outra etapa"}" vai:\n` +
        `• Reabrir o negócio\n` +
        `• Afetar as métricas de vendas (esta venda deixará de ser contabilizada)\n` +
        `• Manter o projeto/contrato já criado vinculado ao lead\n\n` +
        `Tem certeza que deseja continuar?`
      );
      if (!confirmed) {
        setDraggedLead(null);
        return;
      }
    }

    setStageMoveDialog({
      open: true,
      leadId: draggedLead.id,
      targetStageId: stageId,
      targetStageName: targetStage?.name || "Nova Etapa"
    });
    setStageNote("");
    setDraggedLead(null);
  };

  const confirmStageMove = async (opts?: { skipGate?: boolean }) => {
    if (!stageMoveDialog.leadId || !stageMoveDialog.targetStageId) return;

    // Trava de etapa: atividade obrigatória da etapa atual pendente ou campo exigido pela
    // etapa destino em branco (ganho sempre exige valor; o banco também bloqueia via
    // trigger enforce_won_value_upd). Abre o diálogo de pendências em vez de mover.
    if (!opts?.skipGate) {
      setMovingLead(true);
      try {
        const res = await checkStageGate([stageMoveDialog.leadId], stageMoveDialog.targetStageId);
        const r = res.get(stageMoveDialog.leadId);
        if (gateIsBlocked(r)) {
          setGate({ result: r!, targetStageName: stageMoveDialog.targetStageName });
          setMovingLead(false);
          return;
        }
      } catch (e) {
        console.error("checkStageGate:", e);
      }
    }

    setMovingLead(true);

    setLeads(prev =>
      prev.map(l =>
        l.id === stageMoveDialog.leadId ? { ...l, stage_id: stageMoveDialog.targetStageId } : l
      )
    );

    try {
      // Verificar se a etapa destino é "won"
      const targetStage = stages.find(s => s.id === stageMoveDialog.targetStageId);
      const isWonStage = targetStage?.final_type === "won";

      // Atualizar lead com closed_at se for etapa final
      const updateData: { stage_id: string; closed_at?: string; closer_staff_id?: string } = {
        stage_id: stageMoveDialog.targetStageId,
      };
      
      if (isWonStage) {
        updateData.closed_at = new Date().toISOString();
        // Set closer as the lead's current owner (the person responsible)
        const { data: leadData } = await supabase
          .from("crm_leads")
          .select("owner_staff_id, closer_staff_id")
          .eq("id", stageMoveDialog.leadId)
          .single();
        if (leadData && !leadData.closer_staff_id) {
          updateData.closer_staff_id = leadData.owner_staff_id || staffId;
        }
      }

      const { error } = await supabase
        .from("crm_leads")
        .update(updateData)
        .eq("id", stageMoveDialog.leadId);

      if (error) throw error;

      // Sync stage change to Clint in background
      syncLeadToClint(stageMoveDialog.leadId, "stage_change");
      
      if (stageNote.trim()) {
        await supabase
          .from("crm_lead_history")
          .insert({
            lead_id: stageMoveDialog.leadId,
            action: "note_added",
            notes: stageNote.trim(),
            field_changed: "stage_change_note",
            new_value: stageMoveDialog.targetStageName
          });
      }
      
      await createStageActivities(stageMoveDialog.leadId, stageMoveDialog.targetStageId);

      // Reunião agendada OU realizada: obriga criar a tarefa do próximo contato.
      // Realizada entrou em 28/09/2026 (Fabrício): reunião feita sem follow-up
      // marcado é lead que esfria sozinho.
      {
        const nome = stageMoveDialog.targetStageName || "";
        if (isRealizedStage(nome)) setForcedTask({ leadId: stageMoveDialog.leadId, motivo: "realizada" });
        else if (/agendad/i.test(nome)) setForcedTask({ leadId: stageMoveDialog.leadId, motivo: "agendada" });
      }
      
      // Track meeting events (scheduled/realized) for CRM metrics
      if (staffId && selectedPipeline) {
        await trackMeetingEventOnStageChange(
          stageMoveDialog.leadId,
          selectedPipeline,
          stageMoveDialog.targetStageId,
          stageMoveDialog.targetStageName,
          staffId
        );
      }
      
      // Se for etapa "won", criar projeto automaticamente
      if (isWonStage) {
        const projectResult = await createProjectFromWonLead(stageMoveDialog.leadId);
        if (projectResult.success) {
          toast.success("🎉 Lead movido para GANHO e projeto criado!");
        } else {
          toast.success("Lead movido para GANHO");
          if (projectResult.error && !projectResult.error.includes("não tem")) {
            console.warn("Projeto não criado:", projectResult.error);
          }
        }

        // Notificação do grupo é SERVER-SIDE (trigger no banco → edge
        // crm-won-notify, idempotente) — dispara em qualquer caminho de ganho.
      } else {
        toast.success("Lead movido com sucesso");
      }

      // === Enqueue CRM message rules for stage change / won / lost ===
      try {
        const movedLead = leads.find(l => l.id === stageMoveDialog.leadId);
        if (movedLead?.phone) {
          const triggerType = isWonStage 
            ? "lead_won" 
            : targetStage?.final_type === "lost" 
              ? "lead_lost" 
              : "stage_changed";

          await supabase.functions.invoke("crm-message-queue", {
            body: {
              action: "enqueue",
              trigger_type: triggerType,
              lead_id: stageMoveDialog.leadId,
              lead_name: movedLead.name || "",
              lead_phone: movedLead.phone,
              lead_email: movedLead.email || "",
              company_name: movedLead.company || "",
              pipeline_id: selectedPipeline,
              pipeline_name: visiblePipelines.find(p => p.id === selectedPipeline)?.name || "",
              stage_id: stageMoveDialog.targetStageId,
              stage_name: stageMoveDialog.targetStageName,
            },
          });
        }
      } catch (queueErr) {
        console.error("[CRMPipeline] Message queue error:", queueErr);
      }
      
      setStageMoveDialog({ open: false, leadId: "", targetStageId: "", targetStageName: "" });
    } catch (error) {
      console.error("Error moving lead:", error);
      toast.error("Erro ao mover lead");
      loadStagesAndLeads();
    } finally {
      setMovingLead(false);
    }
  };

  const getLeadsByStage = (stageId: string) => leadsByStage.get(stageId) || [];

  const formatCurrency = (value: number | null) => {
    if (!value) return null;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const isOverdue = (lead: Lead) => {
    if (!lead.last_activity_at) return true;
    const lastActivity = new Date(lead.last_activity_at);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return lastActivity < sevenDaysAgo;
  };

  const getStageTotal = (stageId: string) => {
    const stageLeads = getLeadsByStage(stageId);
    return stageLeads.reduce((sum, lead) => sum + (lead.opportunity_value || 0), 0);
  };

  // Navigate to inbox with the lead's WhatsApp conversation
  const handleOpenChat = async (e: React.MouseEvent, lead: Lead) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!lead.phone) {
      toast.error("Este lead não possui telefone cadastrado");
      return;
    }
    
    // Clean phone number (remove non-digits)
    const cleanPhone = lead.phone.replace(/\D/g, "");
    
    // Extract core phone parts for flexible matching
    // Brazilian phones can have DDI (55), DDD (2 digits), and phone (8-9 digits)
    // Some systems store with extra 9 digit, others without
    // Use last 8 digits as the most stable identifier
    const phoneSuffix8 = cleanPhone.slice(-8);
    const phoneSuffix9 = cleanPhone.slice(-9);
    
    try {
      // Find contact by phone using flexible matching
      // Search for contacts ending with these digits
      const { data: suffixMatches } = await supabase
        .from("crm_whatsapp_contacts")
        .select("id, phone")
        .or(`phone.ilike.%${phoneSuffix8},phone.ilike.%${phoneSuffix9}`);
      
      let contact: { id: string } | null = null;
      
      if (suffixMatches && suffixMatches.length > 0) {
        // Filter to find valid phone contacts (not groups)
        const validContact = suffixMatches.find(c => {
          const cPhone = c.phone.replace(/\D/g, "");
          // Skip group IDs (too long, contain @, or have special formats)
          if (cPhone.length > 13 || cPhone.length < 8) return false;
          if (c.phone.includes("@") || c.phone.includes("-")) return false;
          // Check if the phone ends with our suffix
          return cPhone.slice(-8) === phoneSuffix8 || cPhone.slice(-9) === phoneSuffix9;
        });
        
        if (validContact) {
          contact = { id: validContact.id };
        }
      }
      
      if (contact) {
        // Find conversation for this contact
        const { data: conversation } = await supabase
          .from("crm_whatsapp_conversations")
          .select("id")
          .eq("contact_id", contact.id)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (conversation) {
          navigate(`/crm/inbox?conversation=${conversation.id}`);
          return;
        }
      }
      
      // No existing conversation found - navigate to inbox anyway
      toast.info("Nenhuma conversa encontrada para este contato");
      navigate("/crm/inbox");
    } catch (error) {
      console.error("Error finding conversation:", error);
      navigate("/crm/inbox");
    }
  };

  const selectedOriginName = selectedOrigin 
    ? originOptions.find(o => o.id === selectedOrigin)?.name 
    : "Negócio";

  const stageOptions = stages.map(s => ({ id: s.id, name: s.name, color: s.color }));

  // Selection handlers
  const handleLeadSelect = (leadId: string, selected: boolean) => {
    setSelectedLeads(prev => 
      selected 
        ? [...prev, leadId]
        : prev.filter(id => id !== leadId)
    );
  };

  const handleClearSelection = () => {
    setSelectedLeads([]);
  };

  const handleSelectAllInStage = (stageId: string) => {
    const stageLeadIds = getLeadsByStage(stageId).map(l => l.id);
    const allSelected = stageLeadIds.every(id => selectedLeads.includes(id));
    
    if (allSelected) {
      // Deselect all from this stage
      setSelectedLeads(prev => prev.filter(id => !stageLeadIds.includes(id)));
    } else {
      // Select all from this stage
      setSelectedLeads(prev => [...new Set([...prev, ...stageLeadIds])]);
    }
  };

  // Seleciona só os N primeiros da etapa (ordem da coluna), somando ao que já estava marcado
  const handleSelectFirstInStage = (stageId: string, count: number) => {
    const ids = getLeadsByStage(stageId).slice(0, Math.max(0, count)).map(l => l.id);
    setSelectedLeads(prev => [...new Set([...prev, ...ids])]);
  };

  const isSelectionMode = selectedLeads.length > 0;

  if (loading && !stages.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Origin Header */}
      <div className="shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Negócios da origem</p>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-bold truncate">
            {selectedOriginName || "Funil"}
          </h1>
          <div className="flex items-center gap-2">
            {/* Kanban / Tabela */}
            <div className="flex items-center rounded-md border border-border/60 overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => changeView("kanban")}
                title="Ver em kanban"
                className={`h-8 px-2 flex items-center gap-1 text-xs ${viewMode === "kanban" ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /><span className="hidden md:inline">Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => changeView("table")}
                title="Ver em tabela"
                className={`h-8 px-2 flex items-center gap-1 text-xs border-l border-border/60 ${viewMode === "table" ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="h-3.5 w-3.5" /><span className="hidden md:inline">Tabela</span>
              </button>
            </div>
            {/* Ordenação dos cards (por etapa) */}
            {viewMode === "kanban" && (
              <div className="w-[200px] hidden sm:block" title="Ordem dos cards em cada etapa">
                <SearchableSelect
                  value={sortMode}
                  onValueChange={(v) => changeSort(v as SortMode)}
                  options={SORT_OPTIONS}
                  className="h-8 text-xs"
                />
              </div>
            )}
            {viewMode === "kanban" && (
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground sm:hidden" />
            )}
            <Button
              variant="outline"
              onClick={() => setImportLeadsOpen(true)}
              className="gap-2 shrink-0"
              size="sm"
              disabled={!canCreateLead}
              title={canCreateLead ? "Importar leads" : "Sem permissão para criar leads neste funil"}
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button onClick={() => {
              setAddLeadStageId(undefined);
              setAddLeadOpen(true);
            }} className="gap-2 shrink-0" size="sm"
              disabled={!canCreateLead}
              title={canCreateLead ? "Novo negócio" : "Sem permissão para criar leads neste funil"}
            >
              <span className="hidden sm:inline">Negócio</span> <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="shrink-0">
        <CRMFiltersBar
          filters={filters}
          onFiltersChange={setFilters}
          tagOptions={tagOptions}
          ownerOptions={ownerOptions}
          stageOptions={stageOptions}
          originOptions={originOptions}
          totalCount={filteredLeads.length}
          entityName={selectedOriginName || "Negócio"}
          campaignOptions={[...new Set(leads.map((l: any) => l.campaign_name || l.utm_campaign).filter(Boolean))].sort() as string[]}
          adsetOptions={[...new Set(leads.map((l: any) => l.adset_name || l.utm_term).filter(Boolean))].sort() as string[]}
          adOptions={[...new Set(leads.map((l: any) => l.ad_name || l.utm_content).filter(Boolean))].sort() as string[]}
          canExport={isMaster || isAdmin}
          onExport={exportLeadsCsv}
          productOptions={productOptions}
          lossReasonOptions={lossReasonOptions}
          fieldOptions={fieldOptions}
        />
      </div>

      {/* Barra de indicadores (uma linha, sempre alinhada) */}
      <div className="shrink-0 px-3 sm:px-4 pb-2">
        <div className="flex items-stretch rounded-lg border border-border/60 bg-card divide-x divide-border/60 overflow-hidden">
          <div className="flex-1 basis-0 flex items-center gap-2 px-3 sm:px-4 py-2 min-w-0">
            <TrendingUp className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium shrink-0">Forecast</span>
            <span className="text-sm font-bold text-foreground tabular-nums truncate">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(filteredForecastTotal)}
            </span>
            <span className="text-[10px] text-muted-foreground hidden sm:inline shrink-0">
              {forecastData.length} aberto{forecastData.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex-1 basis-0 flex items-center gap-2 px-3 sm:px-4 py-2 min-w-0">
            <Handshake className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium shrink-0">Em Negociação</span>
            <span className="text-sm font-bold text-foreground tabular-nums truncate">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(filteredNegotiationTotal)}
            </span>
            <span className="text-[10px] text-muted-foreground hidden sm:inline shrink-0">
              {negotiationData.length} negócio{negotiationData.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Tabela (mesmos dados e filtros do kanban) */}
      {viewMode === "table" && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <KanbanTableView
            leads={filteredLeads}
            stages={stages}
            selectedLeads={selectedLeads}
            isMaster={isMaster || isAdmin}
            onSelectLead={handleLeadSelect}
            onSelectMany={(ids, selected) =>
              setSelectedLeads((prev) => (selected ? [...new Set([...prev, ...ids])] : prev.filter((id) => !ids.includes(id))))
            }
          />
        </div>
      )}

      {/* Kanban Board */}
      {viewMode === "kanban" && (
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          ref={dragScrollRef}
          className="h-full w-full overflow-x-auto overflow-y-hidden kanban-horizontal-scroll"
          style={{ cursor: isDraggingScroll ? 'grabbing' : 'grab' }}
          {...dragScrollBind}
        >
          <div className="h-full px-2 sm:px-4 pb-4">
            <div className="flex gap-2 sm:gap-3 h-full" style={{ minWidth: "max-content" }}>
              {stages.map(stage => {
                const stageLeads = getLeadsByStage(stage.id);

                return (
                  <KanbanStageColumn
                    key={stage.id}
                    stage={stage}
                    leads={stageLeads}
                    pipelineId={selectedPipeline || ""}
                    selectedLeads={selectedLeads}
                    isSelectionMode={isSelectionMode}
                    isMaster={isMaster || isAdmin}
                    draggedLeadId={draggedLead?.id || null}
                    onSelectLead={handleLeadSelect}
                    onSelectAllInStage={handleSelectAllInStage}
                    onSelectFirstInStage={handleSelectFirstInStage}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragStart={handleDragStart}
                    onOpenChat={handleOpenChat}
                    onRefresh={loadStagesAndLeads}
                    canAddLead={canCreateLead}
                    canChangeOwner={canChangeOwner}
                    onAddLead={(stageId) => {
                      setAddLeadStageId(stageId);
                      setAddLeadOpen(true);
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Bulk Actions Bar (Master only) */}
      <KanbanBulkActions
        selectedLeads={selectedLeads}
        onClearSelection={handleClearSelection}
        stages={stageOptions}
        owners={ownerOptions}
        onSuccess={loadStagesAndLeads}
        isMaster={isMaster || isAdmin}
        currentPipelineId={selectedPipeline || undefined}
        canDelete={canDeleteLead}
        canChangeOwner={canChangeOwner}
        canMove={canMoveLead}
        canOverrideGate={isMaster || isAdmin}
        staffId={staffId}
      />

      <AddLeadDialog
        open={addLeadOpen}
        onOpenChange={(open) => {
          setAddLeadOpen(open);
          if (!open) setAddLeadStageId(undefined);
        }}
        pipelineId={selectedPipeline || ""}
        onSuccess={loadStagesAndLeads}
        initialStageId={addLeadStageId}
      />

      {/* Stage Move Confirmation Dialog */}
      <Dialog 
        open={stageMoveDialog.open} 
        onOpenChange={(open) => {
          if (!open && !movingLead) {
            setStageMoveDialog({ open: false, leadId: "", targetStageId: "", targetStageName: "" });
            loadStagesAndLeads();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover para {stageMoveDialog.targetStageName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea
                value={stageNote}
                onChange={(e) => setStageNote(e.target.value)}
                placeholder="Adicione uma observação sobre a mudança de etapa..."
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setStageMoveDialog({ open: false, leadId: "", targetStageId: "", targetStageName: "" });
                loadStagesAndLeads();
              }}
              disabled={movingLead}
            >
              Cancelar
            </Button>
            <Button onClick={() => confirmStageMove()} disabled={movingLead}>
              {movingLead && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pendências da trava de etapa */}
      <StageGateDialog
        open={!!gate}
        gate={gate?.result || null}
        targetStageName={gate?.targetStageName || stageMoveDialog.targetStageName}
        canOverride={isMaster || isAdmin}
        onCancel={() => setGate(null)}
        onResolved={() => {
          setGate(null);
          // refaz a movimentação: checa de novo (pode ter sobrado algo) e move
          confirmStageMove();
        }}
        onOverride={async () => {
          const g = gate;
          setGate(null);
          if (g) {
            await logGateOverride({
              leadIds: [g.result.leadId],
              staffId,
              targetStageName: g.targetStageName,
              results: new Map([[g.result.leadId, g.result]]),
            });
          }
          confirmStageMove({ skipGate: true });
        }}
      />

      {/* Import Leads Dialog */}
      <ImportLeadsDialog
        open={importLeadsOpen}
        onOpenChange={setImportLeadsOpen}
        onSuccess={loadStagesAndLeads}
        selectedOriginId={selectedOrigin}
        defaultPipelineId={selectedPipeline}
      />

      {/* Tarefa OBRIGATÓRIA de próximo contato (reunião agendada ou realizada) */}
      {forcedTask && (
        <AddActivityDialog
          open
          onOpenChange={(o) => {
            if (o) return;
            toast.error(forcedTask.motivo === "realizada"
              ? "Marque o follow-up com data e hora — reunião realizada não fica sem próximo passo"
              : "Crie a tarefa do próximo contato — reunião agendada não fica sem follow-up");
          }}
          leadId={forcedTask.leadId}
          exigirDataHora={forcedTask.motivo === "realizada"}
          tituloDialogo={forcedTask.motivo === "realizada" ? "Follow-up da reunião" : "Nova Atividade"}
          aviso={forcedTask.motivo === "realizada"
            ? "A reunião foi marcada como realizada. Agende agora o próximo contato com data e hora — sem isso o lead sai da sua régua."
            : undefined}
          tipoPadrao={forcedTask.motivo === "realizada" ? "followup" : undefined}
          tituloPadrao={forcedTask.motivo === "realizada" ? "Follow-up pós-reunião" : undefined}
          onSuccess={() => setForcedTask(null)}
        />
      )}
    </div>
  );
};
