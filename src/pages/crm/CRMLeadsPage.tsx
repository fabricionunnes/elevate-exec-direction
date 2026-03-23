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
  owner: { name: string } | null;
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
  const { isAdmin } = useOutletContext<{ staffRole: string; isAdmin: boolean }>();
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch leads in batches to bypass 1000-row limit
      const PAGE_SIZE = 1000;
      const MAX_LEADS = 50000;
      let allLeads: Lead[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore && allLeads.length < MAX_LEADS) {
        const { data, error } = await supabase
          .from("crm_leads")
          .select(`
            *,
            stage:crm_stages(name, color, is_final, final_type),
            pipeline:crm_pipelines(name),
            owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name),
            tags:crm_lead_tags(tag:crm_tags(id, name, color))
          `)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error("Error loading leads:", error);
          break;
        }

        if (data && data.length > 0) {
          allLeads = allLeads.concat(data as Lead[]);
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      setLeads(allLeads);

      // Load filters data
      const [pipelinesRes, stagesRes, tagsRes] = await Promise.all([
        supabase.from("crm_pipelines").select("*").eq("is_active", true),
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
      console.error("Error loading leads:", error);
      toast.error("Erro ao carregar leads");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute duplicate maps
  const { phoneDuplicates, emailDuplicates } = useMemo(() => {
    const phoneMap = new Map<string, string[]>();
    const emailMap = new Map<string, string[]>();

    leads.forEach(lead => {
      if (lead.phone) {
        const normalized = lead.phone.replace(/\D/g, "").slice(-11); // last 11 digits
        if (normalized.length >= 8) {
          const key = normalized.slice(-8); // match by last 8 digits
          const existing = phoneMap.get(key) || [];
          existing.push(lead.id);
          phoneMap.set(key, existing);
        }
      }
      if (lead.email) {
        const normalized = lead.email.toLowerCase().trim();
        if (normalized) {
          const existing = emailMap.get(normalized) || [];
          existing.push(lead.id);
          emailMap.set(normalized, existing);
        }
      }
    });

    // Only keep entries with duplicates (2+)
    const phoneDups = new Set<string>();
    phoneMap.forEach((ids) => {
      if (ids.length > 1) ids.forEach(id => phoneDups.add(id));
    });
    const emailDups = new Set<string>();
    emailMap.forEach((ids) => {
      if (ids.length > 1) ids.forEach(id => emailDups.add(id));
    });

    return { phoneDuplicates: phoneDups, emailDuplicates: emailDups };
  }, [leads]);

  const duplicatePhoneCount = phoneDuplicates.size;
  const duplicateEmailCount = emailDuplicates.size;

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          lead.name.toLowerCase().includes(search) ||
          lead.company?.toLowerCase().includes(search) ||
          lead.email?.toLowerCase().includes(search) ||
          lead.phone?.includes(search);
        if (!matchesSearch) return false;
      }

      if (filterPipeline !== "all") {
        const pipeline = pipelines.find(p => p.id === filterPipeline);
        if (pipeline && lead.pipeline?.name !== pipeline.name) return false;
      }

      if (filterStage !== "all" && lead.stage_id !== filterStage) return false;

      if (filterOwner !== "all") {
        const owner = staff.find(s => s.id === filterOwner);
        if (owner && lead.owner?.name !== owner.name) return false;
      }

      if (filterOrigin !== "all" && lead.origin !== filterOrigin) return false;
      if (filterUrgency !== "all" && lead.urgency !== filterUrgency) return false;

      // Duplicate filter
      if (filterDuplicates === "phone" && !phoneDuplicates.has(lead.id)) return false;
      if (filterDuplicates === "email" && !emailDuplicates.has(lead.id)) return false;

      return true;
    });
  }, [leads, searchTerm, filterPipeline, filterStage, filterOwner, filterOrigin, filterUrgency, filterDuplicates, pipelines, staff, phoneDuplicates, emailDuplicates]);

  const totalPages = Math.ceil(filteredLeads.length / pageSize);
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterPipeline, filterStage, filterOwner, filterOrigin, filterUrgency, filterDuplicates, pageSize]);

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
        loadData();
      }
    } catch (error: any) {
      console.error("Merge error:", error);
      toast.error("Erro ao mesclar leads: " + error.message);
    } finally {
      setMerging(false);
    }
  };

  const selectedLeadDetails = useMemo(() => {
    return selectedLeads.map(id => leads.find(l => l.id === id)).filter(Boolean) as Lead[];
  }, [selectedLeads, leads]);

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
            {filteredLeads.length} leads encontrados
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
            <Button variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Atribuir
            </Button>
            <Button variant="outline" size="sm">
              <Tag className="h-4 w-4 mr-2" />
              Adicionar Tag
            </Button>
            {selectedLeads.length >= 2 && (
              <Button variant="outline" size="sm" onClick={handleOpenMerge} className="text-amber-600 border-amber-300 hover:bg-amber-50">
                <Merge className="h-4 w-4 mr-2" />
                Mesclar ({selectedLeads.length})
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-destructive">
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
                  const isPhoneDup = phoneDuplicates.has(lead.id);
                  const isEmailDup = emailDuplicates.has(lead.id);
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
                    {phoneDuplicates.has(lead.id) && (
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
                {Math.min((currentPage - 1) * pageSize + 1, filteredLeads.length)}-{Math.min(currentPage * pageSize, filteredLeads.length)} de {filteredLeads.length}
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

      <AddLeadDialog
        open={addLeadOpen}
        onOpenChange={setAddLeadOpen}
        pipelineId={pipelines[0]?.id || ""}
        onSuccess={loadData}
      />

      <ImportLeadsDialog
        open={importLeadsOpen}
        onOpenChange={setImportLeadsOpen}
        onSuccess={loadData}
      />
    </div>
  );
};
