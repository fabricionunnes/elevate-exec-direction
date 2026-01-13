import { useEffect, useState, useMemo } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Search, 
  Filter,
  MoreHorizontal,
  Phone,
  Mail,
  ExternalLink,
  UserPlus,
  Tag,
  XCircle
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AddLeadDialog } from "@/components/crm/AddLeadDialog";

interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  stage_id: string;
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
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPipeline, setFilterPipeline] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterOrigin, setFilterOrigin] = useState("all");
  const [filterUrgency, setFilterUrgency] = useState("all");

  const loadData = async () => {
    setLoading(true);
    try {
      // Load leads with relations
      const { data: leadsData } = await supabase
        .from("crm_leads")
        .select(`
          *,
          stage:crm_stages(name, color, is_final, final_type),
          pipeline:crm_pipelines(name),
          owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name),
          tags:crm_lead_tags(tag:crm_tags(id, name, color))
        `)
        .order("created_at", { ascending: false });

      setLeads(leadsData || []);

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
          .in("role", ["admin", "head_comercial", "closer", "sdr"]);
        setStaff(staffData || []);
      }
    } catch (error) {
      console.error("Error loading leads:", error);
      toast.error("Erro ao carregar leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          lead.name.toLowerCase().includes(search) ||
          lead.company?.toLowerCase().includes(search) ||
          lead.email?.toLowerCase().includes(search) ||
          lead.phone?.includes(search);
        if (!matchesSearch) return false;
      }

      // Pipeline filter
      if (filterPipeline !== "all" && lead.pipeline?.name !== filterPipeline) {
        // Need to match by pipeline_id actually
        const pipeline = pipelines.find(p => p.id === filterPipeline);
        if (pipeline && lead.pipeline?.name !== pipeline.name) return false;
      }

      // Stage filter
      if (filterStage !== "all" && lead.stage_id !== filterStage) return false;

      // Owner filter
      if (filterOwner !== "all") {
        const owner = staff.find(s => s.id === filterOwner);
        if (owner && lead.owner?.name !== owner.name) return false;
      }

      // Origin filter
      if (filterOrigin !== "all" && lead.origin !== filterOrigin) return false;

      // Urgency filter
      if (filterUrgency !== "all" && lead.urgency !== filterUrgency) return false;

      return true;
    });
  }, [leads, searchTerm, filterPipeline, filterStage, filterOwner, filterOrigin, filterUrgency, pipelines, staff]);

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(l => l.id));
    }
  };

  const toggleSelectLead = (leadId: string) => {
    setSelectedLeads(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const uniqueOrigins = [...new Set(leads.map(l => l.origin).filter(Boolean))];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            {filteredLeads.length} leads encontrados
          </p>
        </div>

        <Button onClick={() => setAddLeadOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lead
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="col-span-2 md:col-span-1 lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={filterPipeline} onValueChange={setFilterPipeline}>
              <SelectTrigger>
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
              <SelectTrigger>
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
                <SelectTrigger>
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
              <SelectTrigger>
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
          <CardContent className="p-4 flex items-center gap-4">
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
            <Button variant="outline" size="sm" className="text-red-600">
              <XCircle className="h-4 w-4 mr-2" />
              Marcar Perdido
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nome / Empresa</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Última Atividade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map(lead => (
                  <TableRow key={lead.id}>
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
                    <TableCell>{lead.origin || "-"}</TableCell>
                    <TableCell>
                      {lead.last_activity_at ? (
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(lead.last_activity_at), { 
                            locale: ptBR, 
                            addSuffix: true 
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
                ))}

                {filteredLeads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum lead encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddLeadDialog
        open={addLeadOpen}
        onOpenChange={setAddLeadOpen}
        pipelineId={pipelines[0]?.id || ""}
        onSuccess={loadData}
      />
    </div>
  );
};
