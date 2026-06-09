import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Clock,
  Eye,
  TrendingUp,
  Calendar,
  DollarSign,
} from "lucide-react";

interface CompanyRenewal {
  id: string;
  name: string;
  status: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_value: number | null;
  consultant_id: string | null;
  cs_id: string | null;
  segment: string | null;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface OverdueInvoice {
  company_id: string;
  status: string;
  amount_cents: number;
}

interface NpsResult {
  company_id: string;
  score: number;
  created_at: string;
}

interface KpiEntry {
  company_id: string;
  kpi_id: string;
  value: number;
  entry_date: string;
}

interface CompanyKpi {
  id: string;
  company_id: string;
  target_value: number;
  is_main_goal: boolean;
}

interface EnrichedCompany extends CompanyRenewal {
  daysUntilExpiry: number | null;
  overdueCount: number;
  latestNps: number | null;
  kpiAchievement: number | null;
  churnScore: number;
  riskLevel: "alto" | "medio" | "baixo";
  consultantName: string | null;
  urgencyCategory: "critico" | "urgente" | "atencao" | "monitorando" | "sem-data";
}

const calcChurnScore = (
  overdueCount: number,
  npsScore: number | null,
  kpiAchievement: number | null
): number => {
  let score = 0;

  if (npsScore !== null) {
    if (npsScore < 6) score += 40;
    else if (npsScore < 8) score += 20;
    else if (npsScore >= 9) score -= 10;
  }

  if (overdueCount > 2) score += 30;
  else if (overdueCount > 0) score += 15;

  if (kpiAchievement !== null) {
    if (kpiAchievement < 60) score += 25;
    else if (kpiAchievement < 80) score += 10;
    else if (kpiAchievement >= 100) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
};

const getRiskLevel = (score: number): "alto" | "medio" | "baixo" => {
  if (score >= 60) return "alto";
  if (score >= 30) return "medio";
  return "baixo";
};

const getUrgencyCategory = (days: number | null): EnrichedCompany["urgencyCategory"] => {
  if (days === null) return "sem-data";
  if (days <= 30) return "critico";
  if (days <= 60) return "urgente";
  if (days <= 90) return "atencao";
  return "monitorando";
};

export default function RenovacoesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<EnrichedCompany[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const [filterConsultant, setFilterConsultant] = useState<string>("all");
  const [filterRisk, setFilterRisk] = useState<string>("all");

  // Renew dialog
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<EnrichedCompany | null>(null);
  const [renewForm, setRenewForm] = useState({
    newEndDate: "",
    newValue: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  // Risk dialog
  const [riskDialogOpen, setRiskDialogOpen] = useState(false);
  const [riskCompany, setRiskCompany] = useState<EnrichedCompany | null>(null);
  const [riskNote, setRiskNote] = useState("");
  const [savingRisk, setSavingRisk] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/onboarding-login");
      return;
    }

    const { data: staffRow } = await supabase
      .from("onboarding_staff")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!staffRow) {
      navigate("/onboarding-login");
      return;
    }

    const allowed = ["master", "admin", "cs"];
    if (!allowed.includes(staffRow.role)) {
      toast.error("Acesso restrito");
      navigate("/onboarding-tasks");
      return;
    }

    fetchData();
  };

  const fetchData = async () => {
    setLoading(true);

    const { data: companiesData } = await supabase
      .from("onboarding_companies")
      .select("id, name, status, contract_start_date, contract_end_date, contract_value, consultant_id, cs_id, segment")
      .in("status", ["active", "onboarding"])
      .order("contract_end_date", { ascending: true, nullsFirst: false });

    const { data: staffData } = await supabase
      .from("onboarding_staff")
      .select("id, name, role")
      .eq("is_active", true);

    const { data: overdueData } = await supabase
      .from("company_invoices")
      .select("company_id, status, amount_cents")
      .eq("status", "overdue");

    let npsData: NpsResult[] = [];
    try {
      const { data } = await supabase
        .from("nps_results")
        .select("company_id, score, created_at")
        .order("created_at", { ascending: false });
      npsData = data || [];
    } catch (_) {}

    const currentMonth = format(new Date(), "yyyy-MM");
    const { data: kpiEntries } = await supabase
      .from("kpi_entries")
      .select("company_id, kpi_id, value, entry_date")
      .gte("entry_date", `${currentMonth}-01`);

    const { data: kpis } = await supabase
      .from("company_kpis")
      .select("id, company_id, target_value, is_main_goal")
      .eq("is_active", true)
      .eq("is_main_goal", true);

    setStaff(staffData || []);

    const overdueByCompany: Record<string, number> = {};
    (overdueData || []).forEach((inv: OverdueInvoice) => {
      overdueByCompany[inv.company_id] = (overdueByCompany[inv.company_id] || 0) + 1;
    });

    // Latest NPS per company
    const latestNpsByCompany: Record<string, number> = {};
    (npsData || []).forEach((n: NpsResult) => {
      if (!(n.company_id in latestNpsByCompany)) {
        latestNpsByCompany[n.company_id] = n.score;
      }
    });

    // KPI achievement per company (main goal)
    const kpiAchievementByCompany: Record<string, number> = {};
    (kpis || []).forEach((kpi: CompanyKpi) => {
      const entry = (kpiEntries || []).find((e: KpiEntry) => e.kpi_id === kpi.id);
      if (entry && kpi.target_value > 0) {
        kpiAchievementByCompany[kpi.company_id] = Math.round((entry.value / kpi.target_value) * 100);
      }
    });

    const consultantsById: Record<string, string> = {};
    (staffData || []).forEach((s: StaffMember) => {
      consultantsById[s.id] = s.name;
    });

    const enriched: EnrichedCompany[] = (companiesData || []).map((c: CompanyRenewal) => {
      const daysUntilExpiry = c.contract_end_date
        ? Math.ceil((new Date(c.contract_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const overdueCount = overdueByCompany[c.id] || 0;
      const latestNps = latestNpsByCompany[c.id] ?? null;
      const kpiAchievement = kpiAchievementByCompany[c.id] ?? null;
      const churnScore = calcChurnScore(overdueCount, latestNps, kpiAchievement);
      const riskLevel = getRiskLevel(churnScore);
      const urgencyCategory = getUrgencyCategory(daysUntilExpiry);
      const consultantName = c.consultant_id ? (consultantsById[c.consultant_id] || null) : null;

      return {
        ...c,
        daysUntilExpiry,
        overdueCount,
        latestNps,
        kpiAchievement,
        churnScore,
        riskLevel,
        urgencyCategory,
        consultantName,
      };
    });

    // Sort by urgency then churn score
    const urgencyOrder: Record<string, number> = { critico: 0, urgente: 1, atencao: 2, monitorando: 3, "sem-data": 4 };
    enriched.sort((a, b) => {
      const ua = urgencyOrder[a.urgencyCategory] ?? 5;
      const ub = urgencyOrder[b.urgencyCategory] ?? 5;
      if (ua !== ub) return ua - ub;
      return b.churnScore - a.churnScore;
    });

    setCompanies(enriched);
    setLoading(false);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const openRenewDialog = (company: EnrichedCompany) => {
    setSelectedCompany(company);
    setRenewForm({
      newEndDate: company.contract_end_date || "",
      newValue: company.contract_value?.toString() || "",
      notes: "",
    });
    setRenewDialogOpen(true);
  };

  const openRiskDialog = (company: EnrichedCompany) => {
    setRiskCompany(company);
    setRiskNote("");
    setRiskDialogOpen(true);
  };

  const handleRenew = async () => {
    if (!selectedCompany || !renewForm.newEndDate) {
      toast.error("Informe a nova data de vencimento");
      return;
    }
    setSaving(true);
    try {
      const updateData: Record<string, any> = { contract_end_date: renewForm.newEndDate };
      if (renewForm.newValue) {
        const parsed = parseFloat(renewForm.newValue);
        if (!isNaN(parsed)) updateData.contract_value = parsed;
      }
      const { error } = await supabase
        .from("onboarding_companies")
        .update(updateData)
        .eq("id", selectedCompany.id);
      if (error) throw error;
      toast.success("Contrato renovado com sucesso");
      setRenewDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao renovar contrato");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkRisk = async () => {
    if (!riskCompany) return;
    setSavingRisk(true);
    try {
      // Save note in renewal_notes field on company
      if (riskNote.trim()) {
        await supabase
          .from("onboarding_companies")
          .update({ renewal_notes: riskNote.trim() })
          .eq("id", riskCompany.id);
      }
      toast.success(`${riskCompany.name} marcado como em risco`);
      setRiskDialogOpen(false);
      setRiskCompany(null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar");
    } finally {
      setSavingRisk(false);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    if (filterUrgency !== "all" && c.urgencyCategory !== filterUrgency) return false;
    if (filterConsultant !== "all" && c.consultant_id !== filterConsultant) return false;
    if (filterRisk !== "all" && c.riskLevel !== filterRisk) return false;
    return true;
  });

  // Summary counts
  const countByUrgency = (cat: string) => companies.filter((c) => c.urgencyCategory === cat).length;
  const highRiskCount = companies.filter((c) => c.riskLevel === "alto").length;

  const urgencyBadge = (cat: EnrichedCompany["urgencyCategory"], days: number | null) => {
    if (cat === "sem-data") return <Badge variant="secondary" className="text-xs">Sem data</Badge>;
    if (cat === "critico") return <Badge className="bg-red-600 text-white text-xs">{days}d</Badge>;
    if (cat === "urgente") return <Badge className="bg-orange-500 text-white text-xs">{days}d</Badge>;
    if (cat === "atencao") return <Badge className="bg-yellow-500 text-white text-xs">{days}d</Badge>;
    return <Badge className="bg-green-600 text-white text-xs">{days}d</Badge>;
  };

  const riskBadge = (level: EnrichedCompany["riskLevel"], score: number) => {
    if (level === "alto") return <Badge className="bg-red-100 text-red-700 border border-red-300 text-xs">{score} Alto</Badge>;
    if (level === "medio") return <Badge className="bg-yellow-100 text-yellow-700 border border-yellow-300 text-xs">{score} Médio</Badge>;
    return <Badge className="bg-green-100 text-green-700 border border-green-300 text-xs">{score} Baixo</Badge>;
  };

  const consultants = staff.filter((s) => ["consultant", "master", "admin", "cs"].includes(s.role));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const allNoDates = companies.length > 0 && companies.every((c) => c.contract_end_date === null);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <NexusHeader title="Pipeline de Renovações" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              <Button onClick={fetchData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {allNoDates && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950">
            <CardContent className="p-4 text-amber-700 dark:text-amber-300 text-sm">
              Configure as datas de vencimento nas empresas para usar este painel.
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Vencendo em 30d</p>
                  <p className="text-3xl font-bold text-red-600">{countByUrgency("critico")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Vencendo em 60d</p>
                  <p className="text-3xl font-bold text-orange-600">{countByUrgency("urgente")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900">
                  <Eye className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Vencendo em 90d</p>
                  <p className="text-3xl font-bold text-yellow-600">{countByUrgency("atencao")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Alto risco churn</p>
                  <p className="text-3xl font-bold text-purple-600">{highRiskCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Select value={filterUrgency} onValueChange={setFilterUrgency}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Urgência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as urgências</SelectItem>
                  <SelectItem value="critico">Crítico (≤30d)</SelectItem>
                  <SelectItem value="urgente">Urgente (≤60d)</SelectItem>
                  <SelectItem value="atencao">Atenção (≤90d)</SelectItem>
                  <SelectItem value="monitorando">Monitorando (&gt;90d)</SelectItem>
                  <SelectItem value="sem-data">Sem data</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterConsultant} onValueChange={setFilterConsultant}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Consultor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os consultores</SelectItem>
                  {consultants.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterRisk} onValueChange={setFilterRisk}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Risco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os riscos</SelectItem>
                  <SelectItem value="alto">Alto risco</SelectItem>
                  <SelectItem value="medio">Médio risco</SelectItem>
                  <SelectItem value="baixo">Baixo risco</SelectItem>
                </SelectContent>
              </Select>

              {(filterUrgency !== "all" || filterConsultant !== "all" || filterRisk !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterUrgency("all");
                    setFilterConsultant("all");
                    setFilterRisk("all");
                  }}
                >
                  Limpar filtros
                </Button>
              )}

              <span className="ml-auto text-sm text-muted-foreground">
                {filteredCompanies.length} empresa{filteredCompanies.length !== 1 ? "s" : ""}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Main Table */}
        <Card>
          <CardHeader>
            <CardTitle>Contratos ({filteredCompanies.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="min-w-[1000px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Empresa</TableHead>
                      <TableHead>Consultor</TableHead>
                      <TableHead>Vence em</TableHead>
                      <TableHead>Dias restantes</TableHead>
                      <TableHead>NPS</TableHead>
                      <TableHead>Fat. atraso</TableHead>
                      <TableHead>Score risco</TableHead>
                      <TableHead>Valor contrato</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company) => (
                      <TableRow key={company.id} className="border-b">
                        <TableCell className="font-medium">
                          <button
                            className="hover:underline hover:text-primary text-left"
                            onClick={() => navigate(`/onboarding-tasks/companies/${company.id}`)}
                          >
                            {company.name}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {company.consultantName || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {company.contract_end_date
                            ? format(new Date(company.contract_end_date), "dd/MM/yyyy")
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {urgencyBadge(company.urgencyCategory, company.daysUntilExpiry)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {company.latestNps !== null ? (
                            <span className={company.latestNps >= 9 ? "text-green-600 font-medium" : company.latestNps < 6 ? "text-red-600 font-medium" : "text-yellow-600 font-medium"}>
                              {company.latestNps}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {company.overdueCount > 0 ? (
                            <span className="text-red-600 font-medium">{company.overdueCount}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {riskBadge(company.riskLevel, company.churnScore)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatCurrency(company.contract_value)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRiskDialog(company)}
                              className="text-orange-600 border-orange-300 hover:bg-orange-50"
                            >
                              Em risco
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openRenewDialog(company)}
                            >
                              <Calendar className="h-3.5 w-3.5 mr-1" />
                              Renovar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredCompanies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                          Nenhuma empresa encontrada com esses filtros.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Renew Dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renovar Contrato</DialogTitle>
            <DialogDescription>
              {selectedCompany?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Valor atual</p>
                <p className="font-medium">{formatCurrency(selectedCompany?.contract_value ?? null)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vencimento atual</p>
                <p className="font-medium">
                  {selectedCompany?.contract_end_date
                    ? format(new Date(selectedCompany.contract_end_date), "dd/MM/yyyy")
                    : "Não definido"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-end-date">Nova data de vencimento</Label>
              <Input
                id="new-end-date"
                type="date"
                value={renewForm.newEndDate}
                onChange={(e) => setRenewForm({ ...renewForm, newEndDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-value">Novo valor (opcional)</Label>
              <Input
                id="new-value"
                type="number"
                value={renewForm.newValue}
                onChange={(e) => setRenewForm({ ...renewForm, newValue: e.target.value })}
                placeholder="R$ 0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="renew-notes">Observações</Label>
              <Textarea
                id="renew-notes"
                value={renewForm.notes}
                onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })}
                placeholder="Anotações sobre a renovação..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRenew} disabled={saving || !renewForm.newEndDate}>
              {saving ? "Salvando..." : "Confirmar Renovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Risk Dialog */}
      <Dialog open={riskDialogOpen} onOpenChange={setRiskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Em Risco</DialogTitle>
            <DialogDescription>
              {riskCompany?.name} — Score atual: {riskCompany?.churnScore}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="risk-note">Nota sobre o risco (opcional)</Label>
              <Textarea
                id="risk-note"
                value={riskNote}
                onChange={(e) => setRiskNote(e.target.value)}
                placeholder="Descreva o motivo do risco de churn..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRiskDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleMarkRisk}
              disabled={savingRisk}
            >
              {savingRisk ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
