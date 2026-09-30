import { useEffect, useState, useMemo, useCallback } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { 
  Plus, Search, Phone, Mail, ExternalLink, UserPlus, Tag, XCircle, Upload,
  Copy, Loader2, AlertTriangle, Merge
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AddLeadDialog } from "@/components/crm/AddLeadDialog";
import { ImportLeadsDialog } from "@/components/crm/ImportLeadsDialog";
import { SearchableSelect } from "@/components/ui/searchable-select";

// Ação em massa da barra de seleção (Atribuir, Etiqueta, Marcar perdido).
type BulkKind = "assign" | "tag" | "lost";
const BULK_CHUNK = 100;
const chunk = <T,>(arr: T[], size = BULK_CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

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
  const { isAdmin, staffId } = useOutletContext<{ staffRole: string; isAdmin: boolean; staffId: string | null }>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [importLeadsOpen, setImportLeadsOpen] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPipeline, setFilterPipeline] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterOrigin, setFilterOrigin] = useState("all");
  const [filterUrgency, setFilterUrgency] = useState("all");
  const [filterDuplicates, setFilterDuplicates] = useState("all"); // "all" | "phone" | "email"

  // Merge state
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [primaryLeadId, setPrimaryLeadId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  // Ações em massa (Atribuir / Etiqueta / Marcar perdido). Antes os botões existiam
  // sem onClick; a lógica segue a do KanbanBulkActions (chunks de 100 ids).
  const [bulkKind, setBulkKind] = useState<BulkKind | null>(null);
  const [bulkValue, setBulkValue] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lossReasons, setLossReasons] = useState<{ id: string; name: string }[]>([]);

  // Paginação e filtros NO SERVIDOR (RPC crm_leads_page). Antes a tela baixava até
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

  // Contagem de duplicados (em paralelo — não segura a tabela)
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
      const { data: page, error } = await supabase.rpc("crm_leads_page", {
        p_search: debouncedSearch || null,
        p_pipeline: filterPipeline !== "all" ? filterPipeline : null,
        p_stage: filterStage !== "all" ? filterStage : null,
        p_owner: filterOwner !== "all" ? filterOwner : null,
        p_origin: filterOrigin !== "all" ? filterOrigin : null,
        p_urgency: filterUrgency !== "all" ? filterUrgency : null,
        p_dups: filterDuplicates !== "all" ? filterDuplicates : null,
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
    } catch (error) {
      console.error("Error loading leads:", error);
      toast.error("Erro ao carregar leads");
    } finally {
      setPageLoading(false);
    }
  }, [debouncedSearch, filterPipeline, filterStage, filterOwner, filterOrigin, filterUrgency, filterDuplicates, pageSize, currentPage]);

  useEffect(() => { loadPage(); }, [loadPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterPipeline, filterStage, filterOwner, filterOrigin, filterUrgency, filterDuplicates, pageSize]);

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

  const handleMerge = async () => {
    if (!primaryLeadId || selectedLeads.length < 2) return;

    const secondaryIds = selectedLeads.filter(id => id !== primaryLeadId);
    setMerging(true);
    try {
      const { data, error } = await supabase.rpc("merge_crm_leads", {
        p_primary_lead_id: primaryLeadId,
        p_secondary_lead_ids: secondaryIds,
      });

      if (error) throw error;

      const result = data as any;
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result?.merged_count || secondaryIds.length} lead(s) mesclado(s) com sucesso`);
        setMergeDialogOpen(false);
        setSelectedLeads([]);
        setPrimaryLeadId(null);
        loadPage();
        loadDupCounts();
      }
    } catch (error: any) {
      console.error("Merge error:", error);
      toast.error("Erro ao mesclar leads: " + error.message);
    } finally {
      setMerging(false);
    }
  };

  const selectedLeadDetails = useMemo(() => {
    return selectedLeads.map(id => knownLeads[id]).filter(Boolean) as Lead[];
  }, [selectedLeads, knownLeads]);

  const openBulk = async (kind: BulkKind) => {
    setBulkValue("");
    setBulkKind(kind);
    if (kind === "lost" && lossReasons.length === 0) {
      const { data } = await supabase
        .from("crm_loss_reasons").select("id, name").eq("is_active", true).order("sort_order");
      setLossReasons((data || []) as { id: string; name: string }[]);
    }
  };

  const bulkOptions = useMemo(() => {
    if (bulkKind === "assign") return staff.map((s) => ({ value: s.id, label: s.name }));
    if (bulkKind === "tag") return tags.map((t) => ({ value: t.id, label: t.name }));
    if (bulkKind === "lost") return lossReasons.map((r) => ({ value: r.id, label: r.name }));
    return [];
  }, [bulkKind, staff, tags, lossReasons]);

  const bulkAssign = async (ids: string[]) => {
    for (const part of chunk(ids)) {
      const { error } = await supabase.from("crm_leads").update({ owner_staff_id: bulkValue }).in("id", part);
      if (error) throw error;
    }
    const nome = staff.find((s) => s.id === bulkValue)?.name || "responsável";
    const rows = ids.map((lead_id) => ({
      lead_id, action: "owner_change", field_changed: "owner_staff_id",
      old_value: (knownLeads[lead_id] as any)?.owner_staff_id ?? null, new_value: bulkValue,
      notes: `Responsável alterado para ${nome} em massa (tela de Contatos)`, staff_id: staffId,
    }));
    for (const part of chunk(rows)) {
      const { error } = await supabase.from("crm_lead_history").insert(part);
      if (error) console.error("bulk assign history:", error);
    }
    toast.success(`${ids.length} lead(s) atribuído(s) a ${nome}`);
  };

  const bulkTag = async (ids: string[]) => {
    for (const part of chunk(ids)) {
      const { error } = await supabase.from("crm_lead_tags")
        .upsert(part.map((lead_id) => ({ lead_id, tag_id: bulkValue })), { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
      if (error) throw error;
    }
    const nome = tags.find((t) => t.id === bulkValue)?.name || "etiqueta";
    toast.success(`Etiqueta "${nome}" aplicada em ${ids.length} lead(s)`);
  };

  // Cada funil tem a própria etapa "Perdido" (final_type = lost): agrupa os leads
  // pela etapa de destino. A mudança de etapa entra no histórico pelo trigger
  // log_lead_stage_change; aqui gravamos também a nota com o motivo, no mesmo
  // formato que o kanban usa ao mover com observação (note_added / stage_change_note).
  const bulkLost = async (ids: string[]) => {
    const reasonName = lossReasons.find((r) => r.id === bulkValue)?.name || "motivo";
    const byStage = new Map<string, { stageName: string; ids: string[] }>();
    let semEtapa = 0;
    for (const id of ids) {
      const lead = knownLeads[id];
      const lost = stages.find((s) => s.pipeline_id === lead?.pipeline_id && s.final_type === "lost");
      if (!lost) { semEtapa++; continue; }
      const g = byStage.get(lost.id) || { stageName: lost.name, ids: [] };
      g.ids.push(id);
      byStage.set(lost.id, g);
    }
    const closedAt = new Date().toISOString();
    let ok = 0;
    for (const [stageId, g] of byStage) {
      for (const part of chunk(g.ids)) {
        const { error } = await supabase.from("crm_leads")
          .update({ stage_id: stageId, loss_reason_id: bulkValue, closed_at: closedAt }).in("id", part);
        if (error) throw error;
        const { error: hErr } = await supabase.from("crm_lead_history").insert(part.map((lead_id) => ({
          lead_id, action: "note_added", field_changed: "stage_change_note", new_value: g.stageName,
          notes: `Marcado como perdido em massa. Motivo: ${reasonName}`, staff_id: staffId,
        })));
        if (hErr) console.error("bulk lost history:", hErr);
        ok += part.length;
      }
    }
    if (ok) toast.success(`${ok} lead(s) marcado(s) como perdido(s) (${reasonName})`);
    if (semEtapa) toast.error(`${semEtapa} lead(s) ignorado(s): o funil não tem etapa de perdido`);
  };

  const runBulk = async () => {
    if (!bulkKind || !bulkValue || selectedLeads.length === 0) return;
    setBulkLoading(true);
    try {
      const ids = [...selectedLeads];
      if (bulkKind === "assign") await bulkAssign(ids);
      else if (bulkKind === "tag") await bulkTag(ids);
      else await bulkLost(ids);
      setBulkKind(null);
      setSelectedLeads([]);
      loadPage();
    } catch (e: any) {
      console.error("bulk action:", e);
      toast.error(e?.message || "Erro na ação em massa");
    } finally {
      setBulkLoading(false);
    }
  };

  const bulkTitles: Record<BulkKind, { title: string; label: string; placeholder: string; empty: string; cta: string }> = {
    assign: { title: "Atribuir responsável", label: "Responsável", placeholder: "Escolha quem assume...", empty: "Ninguém com esse nome.", cta: "Atribuir" },
    tag: { title: "Adicionar etiqueta", label: "Etiqueta", placeholder: "Escolha a etiqueta...", empty: "Nenhuma etiqueta com esse nome.", cta: "Aplicar" },
    lost: { title: "Marcar como perdido", label: "Motivo da perda", placeholder: "Escolha o motivo...", empty: "Nenhum motivo cadastrado.", cta: "Marcar perdido" },
  };

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
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

            <Select value={filterPipeline} onValueChange={setFilterPipeline}>
              <SelectTrigger className="h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Pipeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Pipelines</SelectItem>
                {pipelines.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger className="h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Etapas</SelectItem>
                {stages.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isAdmin && (
              <Select value={filterOwner} onValueChange={setFilterOwner}>
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {staff.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={filterUrgency} onValueChange={setFilterUrgency}>
              <SelectTrigger className="h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Urgência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedLeads.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">
              {selectedLeads.length} selecionado(s)
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
            {selectedLeads.length >= 2 && (
              <Button variant="outline" size="sm" onClick={handleOpenMerge} className="text-amber-600 border-amber-300 hover:bg-amber-50">
                <Merge className="h-4 w-4 mr-2" />
                Mesclar ({selectedLeads.length})
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

      {/* Ação em massa: atribuir / etiqueta / marcar perdido */}
      <Dialog open={!!bulkKind} onOpenChange={(o) => { if (!o && !bulkLoading) setBulkKind(null); }}>
        <DialogContent className="max-w-md">
          {bulkKind && (
            <>
              <DialogHeader>
                <DialogTitle>{bulkTitles[bulkKind].title}</DialogTitle>
                <DialogDescription>
                  {selectedLeads.length} lead(s) selecionado(s).
                  {bulkKind === "lost" && " Cada lead vai para a etapa de perdido do próprio funil, com o motivo escolhido."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <p className="text-sm font-medium">{bulkTitles[bulkKind].label}</p>
                <SearchableSelect
                  value={bulkValue}
                  onValueChange={setBulkValue}
                  options={bulkOptions}
                  placeholder={bulkTitles[bulkKind].placeholder}
                  emptyMessage={bulkTitles[bulkKind].empty}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkKind(null)} disabled={bulkLoading}>Cancelar</Button>
                <Button onClick={runBulk} disabled={bulkLoading || !bulkValue} variant={bulkKind === "lost" ? "destructive" : "default"}>
                  {bulkLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {bulkTitles[bulkKind].cta} ({selectedLeads.length})
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
