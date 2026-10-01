import { useEffect, useState, useMemo, useCallback } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { 
  Plus, Search, Phone, Mail, ExternalLink, UserPlus, Tag, XCircle, Upload,
  Copy, Loader2, AlertTriangle, Merge, ListChecks, ListPlus, ListMinus
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AddLeadDialog } from "@/components/crm/AddLeadDialog";
import { ImportLeadsDialog } from "@/components/crm/ImportLeadsDialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SavedViews } from "@/components/crm/views/SavedViews";
import { LeadListsDialog } from "@/components/crm/lists/LeadListsDialog";
import { AddToListDialog } from "@/components/crm/lists/AddToListDialog";
import { LeadList, fetchLeadLists } from "@/components/crm/lists/leadLists";

// Ações em massa de Contatos. Com leads marcados, valem pros marcados; sem nenhum marcado,
// valem pra TODOS os leads do filtro atual. Quem conta e aplica é o banco (RPC
// crm_leads_bulk): o PostgREST só devolve 1000 linhas e a base passa de 100 mil leads.
type BulkKind = "assign" | "tag" | "lost" | "remove_from_list" | "merge_dups";
/** ações que pedem uma escolha (responsável, etiqueta, motivo) antes de aplicar */
const BULK_NEEDS_VALUE: BulkKind[] = ["assign", "tag", "lost"];

interface BulkResult {
  count: number;
  pending?: number;
  affected?: number;
  remaining?: number;
  groups?: number;
  skipped_permission?: number;
  skipped_won?: number;
  skipped_no_stage?: number;
  skipped_large?: number;
}

const nf = (n: number | undefined | null) => Number(n || 0).toLocaleString("pt-BR");

interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  document: string | null;
  stage_id: string;
  pipeline_id: string | null;
  stage: { name: string; color: string; is_final: boolean; final_type: string | null } | null;
  pipeline: { name: string } | null;
  owner: { name: string; avatar_url?: string | null } | null;
  opportunity_value: number | null;
  probability: number | null;
  last_activity_at: string | null;
  next_activity_at: string | null;
  urgency: string | null;
  origin: string | null;
  created_at: string;
  tags: { tag: { id: string; name: string; color: string } }[];
}

export const CRMLeadsPage = () => {
  const { isAdmin, staffId, staffRole } = useOutletContext<{ staffRole: string; isAdmin: boolean; staffId: string | null }>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [importLeadsOpen, setImportLeadsOpen] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPipeline, setFilterPipeline] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterUrgency, setFilterUrgency] = useState("all");
  const [filterList, setFilterList] = useState("all");
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [filterDuplicates, setFilterDuplicates] = useState("all"); // "all" | "phone" | "email"

  // Merge state
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [primaryLeadId, setPrimaryLeadId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  // Ações em massa (ver BulkKind). Tudo passa pela RPC crm_leads_bulk.
  const [bulkKind, setBulkKind] = useState<BulkKind | null>(null);
  const [bulkValue, setBulkValue] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<BulkResult | null>(null);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [lossReasons, setLossReasons] = useState<{ id: string; name: string }[]>([]);
  const [addToListOpen, setAddToListOpen] = useState(false);
  const [addToListCount, setAddToListCount] = useState<number | null>(null);

  // Paginação e filtros NO SERVIDOR (RPC crm_leads_page_v2). Antes a tela baixava até
  // 50 mil leads (50 requisições em sequência, com joins) antes de mostrar a 1ª linha
  // — com 118 mil leads na base, levava dezenas de segundos (pedido do Fabrício 10/09/2026: ≤1s).
  const [total, setTotal] = useState(0);
  const [pageLoading, setPageLoading] = useState(false);
  const [dupCounts, setDupCounts] = useState({ phone: 0, email: 0 });
  const [knownLeads, setKnownLeads] = useState<Record<string, Lead>>({});
  const [dupFlags, setDupFlags] = useState<Record<string, { phone: boolean; email: boolean }>>({});
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Listas dos filtros (uma vez)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pipelinesRes, stagesRes, tagsRes] = await Promise.all([
        supabase.from("crm_pipelines").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("crm_stages").select("*").order("sort_order"),
        supabase.from("crm_tags").select("*").eq("is_active", true),
      ]);
      setPipelines(pipelinesRes.data || []);
      setStages(stagesRes.data || []);
      setTags(tagsRes.data || []);
      if (isAdmin) {
        const { data: staffData } = await supabase
          .from("onboarding_staff")
          .select("id, name")
          .eq("is_active", true)
          .in("role", ["master", "admin", "head_comercial", "closer", "sdr"]);
        setStaff(staffData || []);
      }
    } catch (error) {
      console.error("Error loading filters:", error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listas de leads (filtro "Lista" e gestão)
  const loadLists = useCallback(async () => {
    try { setLeadLists(await fetchLeadLists()); } catch (e) { console.error("listas de leads:", e); }
  }, []);
  useEffect(() => { loadLists(); }, [loadLists]);

  // Filtro atual no formato do banco (crm_leads_page_v2 e crm_leads_bulk leem o mesmo JSON)
  const rpcFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (debouncedSearch) f.search = debouncedSearch;
    if (filterPipeline !== "all") f.pipeline = filterPipeline;
    if (filterStage !== "all") f.stage = filterStage;
    if (filterOwner !== "all") f.owner = filterOwner;
    if (filterUrgency !== "all") f.urgency = filterUrgency;
    if (filterDuplicates !== "all") f.dups = filterDuplicates;
    if (filterList !== "all") f.list = filterList;
    return f;
  }, [debouncedSearch, filterPipeline, filterStage, filterOwner, filterUrgency, filterDuplicates, filterList]);

  // Contagem de duplicados (em paralelo, não segura a tabela)
  const loadDupCounts = useCallback(async () => {
    const { data } = await supabase.rpc("crm_leads_dup_counts");
    const r: any = Array.isArray(data) ? data[0] : data;
    if (r) setDupCounts({ phone: Number(r.phone_dups || 0), email: Number(r.email_dups || 0) });
  }, []);
  useEffect(() => { loadDupCounts(); }, [loadDupCounts]);

  // Página atual
  const loadPage = useCallback(async () => {
    setPageLoading(true);
    try {
      const { data: page, error } = await (supabase as any).rpc("crm_leads_page_v2", {
        p_filters: rpcFilters,
        p_limit: pageSize,
        p_offset: (currentPage - 1) * pageSize,
      });
      if (error) throw error;
      const rows = (page || []) as { id: string; total: number; dup_phone?: boolean; dup_email?: boolean }[];
      setTotal(rows.length ? Number(rows[0].total) : 0);
      setDupFlags(Object.fromEntries(rows.map((r) => [r.id, { phone: !!r.dup_phone, email: !!r.dup_email }])));
      const ids = rows.map((r) => r.id);
      if (!ids.length) { setLeads([]); return; }
      const { data, error: e2 } = await supabase
        .from("crm_leads")
        .select(`
          *,
          stage:crm_stages(name, color, is_final, final_type),
          pipeline:crm_pipelines(name),
          owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name, avatar_url),
          tags:crm_lead_tags(tag:crm_tags(id, name, color))
        `)
        .in("id", ids);
      if (e2) throw e2;
      const byId = new Map((data || []).map((l: any) => [l.id, l]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as Lead[];
      setLeads(ordered);
      setKnownLeads((prev) => { const n = { ...prev }; ordered.forEach((l) => { n[l.id] = l; }); return n; });
    } catch (error: any) {
      console.error("Error loading leads:", error);
      // visão salva apontando pra uma lista que foi apagada ou deixou de ser compartilhada
      if (String(error?.message || "").includes("Lista não encontrada")) {
        toast.error("A lista deste filtro não existe mais ou não está compartilhada com você");
        setFilterList("all");
      } else {
        toast.error("Erro ao carregar leads");
      }
    } finally {
      setPageLoading(false);
    }
  }, [rpcFilters, pageSize, currentPage]);

  useEffect(() => { loadPage(); }, [loadPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rpcFilters, pageSize]);

  // Visões salvas: o conjunto de filtros desta tela
  const viewPayload = useMemo(() => ({
    search: searchTerm.trim(),
    pipeline: filterPipeline,
    stage: filterStage,
    owner: filterOwner,
    urgency: filterUrgency,
    dups: filterDuplicates,
    list: filterList,
    pageSize,
  }), [searchTerm, filterPipeline, filterStage, filterOwner, filterUrgency, filterDuplicates, filterList, pageSize]);
  const applySavedView = (v: Record<string, any>) => {
    const txt = (x: unknown, d = "all") => (typeof x === "string" && x ? x : d);
    setSearchTerm(typeof v.search === "string" ? v.search : "");
    setFilterPipeline(txt(v.pipeline));
    setFilterStage(txt(v.stage));
    setFilterOwner(isAdmin ? txt(v.owner) : "all");
    setFilterUrgency(txt(v.urgency));
    setFilterDuplicates(txt(v.dups));
    setFilterList(txt(v.list));
    if ([10, 50, 100].includes(Number(v.pageSize))) setPageSize(Number(v.pageSize));
    setSelectedLeads([]);
  };

  const duplicatePhoneCount = dupCounts.phone;
  const duplicateEmailCount = dupCounts.email;
  const paginatedLeads = leads;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === paginatedLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(paginatedLeads.map(l => l.id));
    }
  };

  const toggleSelectLead = (leadId: string) => {
    setSelectedLeads(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleOpenMerge = () => {
    if (selectedLeads.length < 2) {
      toast.error("Selecione pelo menos 2 leads para mesclar");
      return;
    }
    setPrimaryLeadId(selectedLeads[0]);
    setMergeDialogOpen(true);
  };

  // Mesclar os selecionados no principal. Vai pela crm_leads_bulk (ação "merge"), que leva
  // junto atividades, histórico, conversas e vendas. A merge_crm_leads antiga parava com erro
  // (referencia tabelas que não existem) e, quando rodava, o histórico ia embora no cascade.
  const handleMerge = async () => {
    if (!primaryLeadId || selectedLeads.length < 2) return;
    setMerging(true);
    try {
      const { data, error } = await (supabase as any).rpc("crm_leads_bulk", {
        p_action: "merge",
        p_payload: { primary_id: primaryLeadId },
        p_filters: {},
        p_ids: selectedLeads,
        p_dry_run: false,
      });
      if (error) throw error;
      const res = (data || {}) as BulkResult;
      toast.success(`${nf(res.affected)} lead(s) mesclado(s) no principal`);
      if (res.skipped_permission) toast.error(`${nf(res.skipped_permission)} lead(s) ficaram de fora: sem permissão de excluir no funil`);
      setMergeDialogOpen(false);
      setSelectedLeads([]);
      setPrimaryLeadId(null);
      loadPage();
      loadDupCounts();
      loadLists();
    } catch (error: any) {
      console.error("Merge error:", error);
      toast.error("Erro ao mesclar leads: " + (error?.message || "tente de novo"));
    } finally {
      setMerging(false);
    }
  };

  const selectedLeadDetails = useMemo(() => {
    return selectedLeads.map(id => knownLeads[id]).filter(Boolean) as Lead[];
  }, [selectedLeads, knownLeads]);

  // ----------------------------------------------------------------- ações em massa
  // Sem seleção, o alvo é o filtro inteiro.
  const bulkOnFilter = selectedLeads.length === 0;
  const bulkTarget = useCallback(() => ({
    p_filters: bulkOnFilter ? rpcFilters : {},
    p_ids: bulkOnFilter ? null : selectedLeads,
  }), [bulkOnFilter, rpcFilters, selectedLeads]);

  const bulkPayload = useCallback((kind: BulkKind, value: string): Record<string, string> => {
    if (kind === "assign") return { staff_id: value };
    if (kind === "tag") return { tag_id: value };
    if (kind === "lost") return { loss_reason_id: value };
    if (kind === "remove_from_list") return { list_id: filterList };
    return { key: filterDuplicates };
  }, [filterList, filterDuplicates]);

  const callBulk = useCallback(async (action: string, payload: Record<string, string>, dryRun: boolean): Promise<BulkResult> => {
    const { data, error } = await (supabase as any).rpc("crm_leads_bulk", {
      p_action: action, p_payload: payload, ...bulkTarget(), p_dry_run: dryRun,
    });
    if (error) throw error;
    return (data || { count: 0 }) as BulkResult;
  }, [bulkTarget]);

  /** Aplica em lotes até o banco dizer que não sobrou nada (cada chamada tem limite de tempo). */
  const runBulkLoop = useCallback(async (action: string, payload: Record<string, string>): Promise<{ done: number; last: BulkResult }> => {
    let done = 0;
    let last: BulkResult = { count: 0 };
    let total = 0;
    for (let i = 0; i < 600; i++) {
      last = await callBulk(action, payload, false);
      const affected = Number(last.affected || 0);
      done += affected;
      if (i === 0) total = Number(last.pending || 0);
      setBulkProgress({ done, total: Math.max(total, done) });
      if (!Number(last.remaining || 0) || affected === 0) break;
    }
    return { done, last };
  }, [callBulk]);

  const openBulk = async (kind: BulkKind) => {
    setBulkValue("");
    setBulkPreview(null);
    setBulkProgress(null);
    setBulkKind(kind);
    if (kind === "lost" && lossReasons.length === 0) {
      const { data } = await supabase
        .from("crm_loss_reasons").select("id, name").eq("is_active", true).order("sort_order");
      setLossReasons((data || []) as { id: string; name: string }[]);
    }
  };

  // Prévia vinda do banco: quantos leads estão no alvo e quantos vão mudar de fato.
  useEffect(() => {
    if (!bulkKind || bulkLoading) return;
    const needsValue = BULK_NEEDS_VALUE.includes(bulkKind);
    let vivo = true;
    setBulkPreviewLoading(true);
    const req = needsValue && !bulkValue
      ? callBulk("count", {}, true)
      : callBulk(bulkKind, bulkPayload(bulkKind, bulkValue), true);
    req
      .then((res) => { if (vivo) setBulkPreview(res); })
      .catch((e) => { console.error("bulk preview:", e); if (vivo) { setBulkPreview(null); toast.error(e?.message || "Não consegui contar os leads"); } })
      .finally(() => { if (vivo) setBulkPreviewLoading(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkKind, bulkValue]);

  const bulkOptions = useMemo(() => {
    if (bulkKind === "assign") return staff.map((s) => ({ value: s.id, label: s.name }));
    if (bulkKind === "tag") return tags.map((t) => ({ value: t.id, label: t.name }));
    if (bulkKind === "lost") return lossReasons.map((r) => ({ value: r.id, label: r.name }));
    return [];
  }, [bulkKind, staff, tags, lossReasons]);

  const afterBulk = () => {
    setSelectedLeads([]);
    loadPage();
    loadDupCounts();
    loadLists();
  };

  const runBulk = async () => {
    if (!bulkKind) return;
    const needsValue = BULK_NEEDS_VALUE.includes(bulkKind);
    if (needsValue && !bulkValue) return;
    const kind = bulkKind;
    setBulkLoading(true);
    setBulkProgress({ done: 0, total: Number(bulkPreview?.pending || 0) });
    try {
      const { done, last } = await runBulkLoop(kind, bulkPayload(kind, bulkValue));
      const nome = bulkOptions.find((o) => o.value === bulkValue)?.label || "";
      if (kind === "assign") toast.success(`${nf(done)} lead(s) atribuído(s) a ${nome}`);
      else if (kind === "tag") toast.success(`Etiqueta "${nome}" aplicada em ${nf(done)} lead(s)`);
      else if (kind === "lost") toast.success(`${nf(done)} lead(s) marcado(s) como perdido(s) (${nome})`);
      else if (kind === "remove_from_list") toast.success(`${nf(done)} lead(s) tirado(s) da lista`);
      else toast.success(`${nf(done)} lead(s) duplicado(s) mesclado(s)`);
      if (last.skipped_won && kind === "lost") toast.info(`${nf(last.skipped_won)} lead(s) ganho(s) ficaram de fora. Ganho se reabre um por um.`);
      if (last.skipped_no_stage) toast.error(`${nf(last.skipped_no_stage)} lead(s) ignorado(s): o funil não tem etapa de perdido`);
      if (last.skipped_permission) toast.error(`${nf(last.skipped_permission)} lead(s) ficaram de fora: sem permissão neste funil`);
      if (Number(last.remaining || 0) > 0) toast.error(`Sobraram ${nf(last.remaining)} lead(s). Rode de novo pra terminar.`);
      setBulkKind(null);
      afterBulk();
    } catch (e: any) {
      console.error("bulk action:", e);
      toast.error(e?.message || "Erro na ação em massa");
      loadPage();
    } finally {
      setBulkLoading(false);
      setBulkProgress(null);
    }
  };

  // Adicionar à lista: o diálogo escolhe (ou cria) a lista e a RPC inclui, em lotes.
  const openAddToList = async () => {
    setAddToListCount(null);
    setAddToListOpen(true);
    if (!bulkOnFilter) return;
    try {
      const res = await callBulk("count", {}, true);
      setAddToListCount(Number(res.count || 0));
    } catch (e) {
      console.error("bulk count:", e);
    }
  };
  const addToListPicked = async (list: { id: string; name: string }) => {
    const { done, last } = await runBulkLoop("add_to_list", { list_id: list.id });
    setBulkProgress(null);
    const jaEstavam = Number(last.count || 0) - done;
    toast.success(`${nf(done)} lead(s) adicionado(s) à lista "${list.name}"` + (jaEstavam > 0 ? `. ${nf(jaEstavam)} já estava(m) nela.` : ""));
    afterBulk();
  };

  const bulkTitles: Record<BulkKind, { title: string; label: string; placeholder: string; empty: string; cta: string }> = {
    assign: { title: "Atribuir responsável", label: "Responsável", placeholder: "Escolha quem assume...", empty: "Ninguém com esse nome.", cta: "Atribuir" },
    tag: { title: "Adicionar etiqueta", label: "Etiqueta", placeholder: "Escolha a etiqueta...", empty: "Nenhuma etiqueta com esse nome.", cta: "Aplicar" },
    lost: { title: "Marcar como perdido", label: "Motivo da perda", placeholder: "Escolha o motivo...", empty: "Nenhum motivo cadastrado.", cta: "Marcar perdido" },
    remove_from_list: { title: "Tirar da lista", label: "", placeholder: "", empty: "", cta: "Tirar da lista" },
    merge_dups: { title: "Mesclar duplicados do filtro", label: "", placeholder: "", empty: "", cta: "Mesclar" },
  };
  const activeList = leadLists.find((l) => l.id === filterList) || null;
  const bulkNeedsValue = !!bulkKind && BULK_NEEDS_VALUE.includes(bulkKind);
  const bulkPending = Number(bulkPreview?.pending ?? 0);
  const bulkReady = !!bulkPreview && !bulkPreviewLoading && (!bulkNeedsValue || !!bulkValue);
  const lostIsIcp = bulkKind === "lost" && (lossReasons.find((r) => r.id === bulkValue)?.name || "").trim().toLowerCase() === "fora do icp";

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {pageLoading ? "Carregando…" : `${total.toLocaleString("pt-BR")} leads encontrados`}
            {filterDuplicates !== "all" && (
              <span className="ml-1 text-amber-600 font-medium">
                (filtro de duplicados ativo)
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setListsOpen(true)} title="Listas de leads: criar, editar, exportar">
            <ListChecks className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Listas</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportLeadsOpen(true)}>
            <Upload className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Importar</span>
          </Button>
          <Button size="sm" onClick={() => setAddLeadOpen(true)}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Novo Lead</span>
          </Button>
        </div>
      </div>

      {/* Duplicate Detection Cards */}
      {(duplicatePhoneCount > 0 || duplicateEmailCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {duplicatePhoneCount > 0 && (
            <Card 
              className={`cursor-pointer transition-all ${filterDuplicates === "phone" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "hover:border-amber-300"}`}
              onClick={() => setFilterDuplicates(filterDuplicates === "phone" ? "all" : "phone")}
            >
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">
                  {duplicatePhoneCount} leads com telefone duplicado
                </span>
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              </CardContent>
            </Card>
          )}
          {duplicateEmailCount > 0 && (
            <Card 
              className={`cursor-pointer transition-all ${filterDuplicates === "email" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "hover:border-amber-300"}`}
              onClick={() => setFilterDuplicates(filterDuplicates === "email" ? "all" : "email")}
            >
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">
                  {duplicateEmailCount} leads com email duplicado
                </span>
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3">
            <div className="col-span-2 sm:col-span-1 lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            <SearchableSelect
              value={filterPipeline}
              onValueChange={(v) => { setFilterPipeline(v); setFilterStage("all"); }}
              options={[{ value: "all", label: "Todos os funis" }, ...pipelines.map((p) => ({ value: p.id, label: p.name }))]}
              placeholder="Funil"
              emptyMessage="Nenhum funil com esse nome."
              className="h-9 text-xs sm:text-sm"
            />

            <SearchableSelect
              value={filterStage}
              onValueChange={setFilterStage}
              options={[
                { value: "all", label: "Todas as etapas" },
                ...stages
                  .filter((st) => filterPipeline === "all" || st.pipeline_id === filterPipeline)
                  .map((st) => ({
                    value: st.id,
                    label: st.name,
                    hint: filterPipeline === "all" ? pipelines.find((p) => p.id === st.pipeline_id)?.name : undefined,
                  })),
              ]}
              placeholder="Etapa"
              emptyMessage="Nenhuma etapa com esse nome."
              className="h-9 text-xs sm:text-sm"
            />

            {isAdmin && (
              <SearchableSelect
                value={filterOwner}
                onValueChange={setFilterOwner}
                options={[{ value: "all", label: "Todos os responsáveis" }, ...staff.map((st) => ({ value: st.id, label: st.name }))]}
                placeholder="Responsável"
                emptyMessage="Ninguém com esse nome."
                className="h-9 text-xs sm:text-sm"
              />
            )}

            <SearchableSelect
              value={filterUrgency}
              onValueChange={setFilterUrgency}
              options={[
                { value: "all", label: "Qualquer urgência" },
                { value: "low", label: "Urgência baixa" },
                { value: "medium", label: "Urgência média" },
                { value: "high", label: "Urgência alta" },
              ]}
              placeholder="Urgência"
              emptyMessage="Nenhuma opção."
              className="h-9 text-xs sm:text-sm"
            />

            <SearchableSelect
              value={filterList}
              onValueChange={setFilterList}
              options={[
                { value: "all", label: "Qualquer lista" },
                ...leadLists.map((l) => ({ value: l.id, label: l.name, hint: `${nf(l.lead_count)} leads` })),
              ]}
              placeholder="Lista"
              emptyMessage="Nenhuma lista com esse nome."
              className="h-9 text-xs sm:text-sm"
            />
          </div>
          <SavedViews
            className="mt-3"
            scope="contatos"
            staffId={staffId}
            canManageShared={staffRole === "master" || staffRole === "admin"}
            current={viewPayload}
            onApply={applySavedView}
          />
        </CardContent>
      </Card>

      {/* Ações em massa: nos marcados ou, sem nenhum marcado, em todos os leads do filtro */}
      {(selectedLeads.length > 0 || total > 0) && (
        <Card className={bulkOnFilter ? "border-dashed" : "bg-primary/5 border-primary/20"}>
          <CardContent className="p-3 sm:p-4 flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-sm font-medium">
              {bulkOnFilter ? (
                <>
                  Nenhum selecionado
                  <span className="font-normal text-muted-foreground">
                    , as ações valem para {pageLoading ? "os" : `os ${nf(total)}`} leads do filtro
                  </span>
                </>
              ) : (
                <>
                  {nf(selectedLeads.length)} selecionado(s)
                  <button type="button" className="ml-2 text-xs font-normal text-muted-foreground underline" onClick={() => setSelectedLeads([])}>
                    limpar
                  </button>
                </>
              )}
            </span>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => openBulk("assign")} disabled={bulkLoading}>
                <UserPlus className="h-4 w-4 mr-2" />
                Atribuir
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => openBulk("tag")} disabled={bulkLoading}>
              <Tag className="h-4 w-4 mr-2" />
              Adicionar Tag
            </Button>
            <Button variant="outline" size="sm" onClick={openAddToList} disabled={bulkLoading}>
              <ListPlus className="h-4 w-4 mr-2" />
              Adicionar à lista
            </Button>
            {activeList && (
              <Button variant="outline" size="sm" onClick={() => openBulk("remove_from_list")} disabled={bulkLoading} title={`Tirar da lista "${activeList.name}"`}>
                <ListMinus className="h-4 w-4 mr-2" />
                Tirar da lista
              </Button>
            )}
            {isAdmin && selectedLeads.length >= 2 && (
              <Button variant="outline" size="sm" onClick={handleOpenMerge} className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                <Merge className="h-4 w-4 mr-2" />
                Mesclar ({selectedLeads.length})
              </Button>
            )}
            {isAdmin && bulkOnFilter && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openBulk("merge_dups")}
                disabled={bulkLoading || filterDuplicates === "all"}
                className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                title={filterDuplicates === "all"
                  ? "Ligue o filtro de duplicados (cartões de telefone ou e-mail duplicado) pra mesclar em massa"
                  : "Junta os duplicados exatos do filtro, cada grupo num lead só"}
              >
                <Merge className="h-4 w-4 mr-2" />
                Mesclar duplicados
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => openBulk("lost")} disabled={bulkLoading}>
              <XCircle className="h-4 w-4 mr-2" />
              Marcar Perdido
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nome / Empresa</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Última Atividade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.map(lead => {
                  const isPhoneDup = !!dupFlags[lead.id]?.phone;
                  const isEmailDup = !!dupFlags[lead.id]?.email;
                  return (
                    <TableRow key={lead.id} className={isPhoneDup || isEmailDup ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLeads.includes(lead.id)}
                          onCheckedChange={() => toggleSelectLead(lead.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Link to={`/crm/leads/${lead.id}`} className="hover:underline">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium">{lead.name}</p>
                              {lead.company && (
                                <p className="text-sm text-muted-foreground">{lead.company}</p>
                              )}
                            </div>
                            {lead.urgency === "high" && (
                              <Badge variant="destructive" className="text-[10px]">URGENTE</Badge>
                            )}
                          </div>
                        </Link>
                        <div className="flex gap-1 mt-1">
                          {isPhoneDup && (
                            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">
                              <Copy className="h-2.5 w-2.5 mr-0.5" /> Tel. duplicado
                            </Badge>
                          )}
                          {isEmailDup && (
                            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">
                              <Copy className="h-2.5 w-2.5 mr-0.5" /> Email duplicado
                            </Badge>
                          )}
                          {lead.tags?.slice(0, 3).map(t => (
                            <Badge
                              key={t.tag.id}
                              variant="outline"
                              className="text-[10px]"
                              style={{ borderColor: t.tag.color, color: t.tag.color }}
                            >
                              {t.tag.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{lead.phone || "-"}</span>
                      </TableCell>
                      <TableCell>
                        {lead.stage && (
                          <Badge
                            style={{ backgroundColor: lead.stage.color }}
                            className="text-white"
                          >
                            {lead.stage.name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(lead.opportunity_value)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{lead.pipeline?.name || "-"}</span>
                      </TableCell>
                      <TableCell>
                        {lead.last_activity_at ? (
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(lead.last_activity_at), { 
                              locale: ptBR, addSuffix: true 
                            })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {lead.phone && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={`tel:${lead.phone}`}>
                                <Phone className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {lead.email && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={`mailto:${lead.email}`}>
                                <Mail className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/crm/leads/${lead.id}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {paginatedLeads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum lead encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-border">
            {paginatedLeads.map(lead => (
              <Link
                key={lead.id}
                to={`/crm/leads/${lead.id}`}
                className="flex items-center gap-3 px-3 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="pt-1" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelectLead(lead.id); }}>
                  <Checkbox checked={selectedLeads.includes(lead.id)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{lead.name}</span>
                    {lead.urgency === "high" && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">URGENTE</Badge>
                    )}
                  </div>
                  {lead.company && (
                    <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {lead.stage && (
                      <Badge style={{ backgroundColor: lead.stage.color }} className="text-white text-[10px]">
                        {lead.stage.name}
                      </Badge>
                    )}
                    {lead.opportunity_value ? (
                      <span className="text-xs font-medium">{formatCurrency(lead.opportunity_value)}</span>
                    ) : null}
                    {!!dupFlags[lead.id]?.phone && (
                      <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">Duplicado</Badge>
                    )}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}

            {paginatedLeads.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum lead encontrado
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-t gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-muted-foreground">Exibir</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[70px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs sm:text-sm text-muted-foreground">por página</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-muted-foreground">
                {Math.min((currentPage - 1) * pageSize + 1, total)}-{Math.min(currentPage * pageSize, total)} de {total}
              </span>
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                Próximo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5" />
              Mesclar Leads
            </DialogTitle>
            <DialogDescription>
              Selecione o lead principal que manterá os dados. Os outros serão mesclados nele e removidos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {selectedLeadDetails.map(lead => (
              <div
                key={lead.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  primaryLeadId === lead.id 
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setPrimaryLeadId(lead.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{lead.name}</p>
                    {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
                  </div>
                  {primaryLeadId === lead.id && (
                    <Badge className="bg-primary text-primary-foreground text-[10px]">PRINCIPAL</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                  {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                  {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
                  {lead.pipeline?.name && <Badge variant="secondary" className="text-[10px]">{lead.pipeline.name}</Badge>}
                  {lead.stage?.name && (
                    <Badge style={{ backgroundColor: lead.stage.color }} className="text-white text-[10px]">{lead.stage.name}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
              Os dados faltantes no lead principal serão preenchidos com os dados dos leads secundários. 
              Tags e atividades serão movidas para o lead principal. 
              Os {selectedLeads.length - 1} lead(s) secundário(s) serão excluídos permanentemente.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)} disabled={merging}>
              Cancelar
            </Button>
            <Button onClick={handleMerge} disabled={merging || !primaryLeadId} className="bg-amber-600 hover:bg-amber-700 text-white">
              {merging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Merge className="h-4 w-4 mr-2" />}
              Mesclar {selectedLeads.length - 1} lead(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ação em massa: confirma com a contagem que vem do banco */}
      <Dialog open={!!bulkKind} onOpenChange={(o) => { if (!o && !bulkLoading) setBulkKind(null); }}>
        <DialogContent className="max-w-md">
          {bulkKind && (
            <>
              <DialogHeader>
                <DialogTitle>{bulkTitles[bulkKind].title}</DialogTitle>
                <DialogDescription>
                  {bulkOnFilter
                    ? <>Nada selecionado: vale para <strong className="text-foreground">todos os {bulkPreview ? nf(bulkPreview.count) : "..."} leads do filtro atual</strong>.</>
                    : <>{nf(selectedLeads.length)} lead(s) selecionado(s).</>}
                  {bulkKind === "lost" && " Cada lead vai para a etapa de perdido do próprio funil, com o motivo escolhido."}
                  {bulkKind === "remove_from_list" && activeList && ` Saem da lista "${activeList.name}". Os leads continuam no CRM.`}
                </DialogDescription>
              </DialogHeader>

              {bulkKind === "merge_dups" && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                  <p>
                    <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                    Só entra duplicado exato: mesmo funil, mesmo {filterDuplicates === "email" ? "e-mail" : "telefone (com DDD)"} e mesmo nome.
                    Cada grupo vira um lead só, o que teve atividade mais recente.
                  </p>
                  <p>Atividades, histórico, conversas e etiquetas vão junto pro lead que fica. Lead ganho ou com venda nunca é apagado. Não dá pra desfazer.</p>
                </div>
              )}

              {bulkNeedsValue && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{bulkTitles[bulkKind].label}</p>
                  <SearchableSelect
                    value={bulkValue}
                    onValueChange={setBulkValue}
                    options={bulkOptions}
                    placeholder={bulkTitles[bulkKind].placeholder}
                    emptyMessage={bulkTitles[bulkKind].empty}
                    disabled={bulkLoading}
                  />
                </div>
              )}

              {/* Prévia: o que vai mudar de fato */}
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm min-h-[40px]">
                {bulkProgress ? (
                  <div className="space-y-1.5">
                    <p>Aplicando: {nf(bulkProgress.done)} de {nf(bulkProgress.total)}</p>
                    <Progress value={bulkProgress.total ? Math.min(100, (bulkProgress.done / bulkProgress.total) * 100) : 0} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">Não feche esta janela até terminar.</p>
                  </div>
                ) : bulkPreviewLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Contando no banco...</span>
                ) : !bulkPreview ? (
                  <span className="text-muted-foreground">Não consegui contar os leads.</span>
                ) : bulkNeedsValue && !bulkValue ? (
                  <span className="text-muted-foreground">{nf(bulkPreview.count)} lead(s) no alvo. Escolha {bulkKind === "assign" ? "o responsável" : bulkKind === "tag" ? "a etiqueta" : "o motivo"} pra ver quantos mudam.</span>
                ) : (
                  <div className="space-y-0.5">
                    <p>
                      <strong>{nf(bulkPending)}</strong> lead(s) {bulkKind === "merge_dups" ? `serão mesclados e apagados, em ${nf(bulkPreview.groups)} grupo(s)` : "vão mudar"}
                      {bulkKind !== "merge_dups" && bulkPreview.count !== bulkPending && <span className="text-muted-foreground"> de {nf(bulkPreview.count)}</span>}.
                    </p>
                    {bulkKind === "assign" && bulkPreview.count - bulkPending - Number(bulkPreview.skipped_permission || 0) > 0 && (
                      <p className="text-xs text-muted-foreground">{nf(bulkPreview.count - bulkPending - Number(bulkPreview.skipped_permission || 0))} já são desta pessoa.</p>
                    )}
                    {bulkKind === "tag" && bulkPreview.count - bulkPending > 0 && (
                      <p className="text-xs text-muted-foreground">{nf(bulkPreview.count - bulkPending)} já têm esta etiqueta.</p>
                    )}
                    {bulkKind === "remove_from_list" && bulkPreview.count - bulkPending > 0 && (
                      <p className="text-xs text-muted-foreground">{nf(bulkPreview.count - bulkPending)} não estão nesta lista.</p>
                    )}
                    {!!bulkPreview.skipped_won && (
                      <p className="text-xs text-muted-foreground">
                        {bulkKind === "merge_dups"
                          ? `${nf(bulkPreview.skipped_won)} duplicado(s) ganho(s) ou com venda ficam como estão.`
                          : `${nf(bulkPreview.skipped_won)} lead(s) ganho(s) ficam de fora (ganho se reabre um por um).`}
                      </p>
                    )}
                    {!!bulkPreview.skipped_large && (
                      <p className="text-xs text-muted-foreground">{nf(bulkPreview.skipped_large)} lead(s) em grupos com mais de 10 iguais ficam de fora (costuma ser contato coringa). Mescle esses à mão.</p>
                    )}
                    {!!bulkPreview.skipped_no_stage && (
                      <p className="text-xs text-muted-foreground">{nf(bulkPreview.skipped_no_stage)} lead(s) em funil sem etapa de perdido ficam de fora.</p>
                    )}
                    {!!bulkPreview.skipped_permission && (
                      <p className="text-xs text-muted-foreground">{nf(bulkPreview.skipped_permission)} lead(s) ficam de fora: sem permissão neste funil.</p>
                    )}
                    {lostIsIcp && bulkPending > 10 && (
                      <p className="text-xs text-amber-600">O motivo "Fora do ICP" dispara um alerta automático por lead. São {nf(bulkPending)} alertas.</p>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkKind(null)} disabled={bulkLoading}>Cancelar</Button>
                <Button
                  onClick={runBulk}
                  disabled={bulkLoading || !bulkReady || bulkPending === 0}
                  variant={bulkKind === "lost" || bulkKind === "merge_dups" ? "destructive" : "default"}
                >
                  {bulkLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {bulkTitles[bulkKind].cta}{bulkReady ? ` (${nf(bulkPending)})` : ""}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AddToListDialog
        open={addToListOpen}
        onOpenChange={setAddToListOpen}
        leadIds={selectedLeads}
        onPick={addToListPicked}
        countLabel={bulkOnFilter
          ? `Nada selecionado: entram todos os ${addToListCount === null ? "..." : nf(addToListCount)} leads do filtro atual`
          : undefined}
      />

      <LeadListsDialog
        open={listsOpen}
        onOpenChange={setListsOpen}
        staffId={staffId}
        canManageAll={staffRole === "master" || staffRole === "admin"}
        canExport={isAdmin}
        onOpenList={(l) => { setFilterList(l.id); setSelectedLeads([]); }}
        onChanged={loadLists}
      />

      <AddLeadDialog
        open={addLeadOpen}
        onOpenChange={setAddLeadOpen}
        pipelineId={pipelines[0]?.id || ""}
        onSuccess={() => { loadPage(); loadDupCounts(); }}
      />

      <ImportLeadsDialog
        open={importLeadsOpen}
        onOpenChange={setImportLeadsOpen}
        onSuccess={() => { loadPage(); loadDupCounts(); }}
        selectedOriginId={null}
      />
    </div>
  );
};
