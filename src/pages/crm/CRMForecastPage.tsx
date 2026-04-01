import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "./CRMLayout";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Search,
  Users,
  TrendingUp,
  ExternalLink,
  StickyNote,
  Building2,
  Phone,
  Calendar,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ForecastLead {
  id: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  opportunity_value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  pipeline_id: string;
  closer_staff_id: string | null;
  closer?: { name: string } | null;
  pipeline?: { name: string } | null;
  stage?: { name: string; color: string } | null;
  product?: { name: string } | null;
}

function formatCurrency(value: number | null): string {
  if (!value) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function CRMForecastPage() {
  const { staffRole, staffId, isAdmin, isMaster } = useCRMContext();
  const [leads, setLeads] = useState<ForecastLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPipeline, setFilterPipeline] = useState<string>("all");
  const [filterCloser, setFilterCloser] = useState<string>("all");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const isHeadOrAdmin = isAdmin || isMaster || staffRole === "head_comercial";

  useEffect(() => {
    fetchForecastLeads();
  }, []);

  const fetchForecastLeads = async () => {
    setLoading(true);
    try {
      // First get all forecast stage IDs
      const { data: forecastStages } = await supabase
        .from("crm_stages")
        .select("id")
        .ilike("name", "%forecast%");

      if (!forecastStages || forecastStages.length === 0) {
        setLeads([]);
        setLoading(false);
        return;
      }

      const stageIds = forecastStages.map((s) => s.id);

      const { data, error } = await supabase
        .from("crm_leads")
        .select(`
          id, name, company, phone, email, opportunity_value, notes, 
          created_at, updated_at, pipeline_id, closer_staff_id,
          closer:onboarding_staff!crm_leads_closer_staff_id_fkey(name),
          pipeline:crm_pipelines!crm_leads_pipeline_id_fkey(name),
          stage:crm_stages!crm_leads_stage_id_fkey(name, color),
          product:onboarding_services!crm_leads_product_id_fkey(name)
        `)
        .in("stage_id", stageIds)
        .is("closed_at", null)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setLeads((data || []) as unknown as ForecastLead[]);
    } catch (err) {
      console.error("Error fetching forecast leads:", err);
    } finally {
      setLoading(false);
    }
  };

  const pipelines = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((l) => {
      if (l.pipeline_id && l.pipeline?.name) {
        map.set(l.pipeline_id, l.pipeline.name);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [leads]);

  const closers = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((l) => {
      if (l.closer_staff_id && l.closer?.name) {
        map.set(l.closer_staff_id, l.closer.name);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads;

    // Role-based filtering: closers see only their own leads
    if (!isHeadOrAdmin && staffRole === "closer" && staffId) {
      result = result.filter((l) => l.closer_staff_id === staffId);
    }

    if (filterPipeline !== "all") {
      result = result.filter((l) => l.pipeline_id === filterPipeline);
    }
    if (filterCloser !== "all") {
      result = result.filter((l) => l.closer_staff_id === filterCloser);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.company?.toLowerCase().includes(q) ||
          l.phone?.includes(q) ||
          l.email?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [leads, filterPipeline, filterCloser, search, isHeadOrAdmin, staffRole, staffId]);

  const totalValue = useMemo(
    () => filtered.reduce((sum, l) => sum + (l.opportunity_value || 0), 0),
    [filtered]
  );

  const toggleNotes = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header Cards */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Leads em Forecast</p>
                <p className="text-xl font-bold text-foreground">{filtered.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ticket Médio</p>
                <p className="text-xl font-bold text-foreground">
                  {filtered.length > 0
                    ? formatCurrency(totalValue / filtered.length)
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lead, empresa, telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <Select value={filterPipeline} onValueChange={setFilterPipeline}>
            <SelectTrigger className="w-[180px] h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Funil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os funis</SelectItem>
              {pipelines.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isHeadOrAdmin && (
            <Select value={filterCloser} onValueChange={setFilterCloser}>
              <SelectTrigger className="w-[180px] h-9">
                <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Closer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os closers</SelectItem>
                {closers.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 px-4 pb-4">
        <Card className="h-full flex flex-col">
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Nenhum lead em forecast encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Lead</TableHead>
                    <TableHead className="w-[150px]">Empresa</TableHead>
                    <TableHead className="w-[130px]">Funil</TableHead>
                    <TableHead className="w-[120px]">Closer</TableHead>
                    <TableHead className="w-[120px] text-right">Valor</TableHead>
                    <TableHead className="w-[100px]">Atualizado</TableHead>
                    <TableHead>Anotações</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lead) => (
                    <TableRow key={lead.id} className="group">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-foreground truncate max-w-[200px]">
                            {lead.name || "Sem nome"}
                          </span>
                          {lead.phone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground flex items-center gap-1 truncate max-w-[140px]">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {lead.company || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {lead.pipeline?.name || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {lead.closer?.name || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "text-sm font-semibold",
                          lead.opportunity_value ? "text-emerald-600" : "text-muted-foreground"
                        )}>
                          {formatCurrency(lead.opportunity_value)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(lead.updated_at), "dd/MM", { locale: ptBR })}
                        </span>
                      </TableCell>
                      <TableCell>
                        {lead.notes ? (
                          <button
                            onClick={() => toggleNotes(lead.id)}
                            className="text-left"
                          >
                            <span className={cn(
                              "text-xs text-muted-foreground",
                              !expandedNotes.has(lead.id) && "line-clamp-2 max-w-[250px]"
                            )}>
                              <StickyNote className="h-3 w-3 inline mr-1 text-amber-500" />
                              {lead.notes}
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/crm/leads/${lead.id}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="h-4 w-4 text-primary hover:text-primary/80" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
