import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  DollarSign, 
  Percent, 
  Hash, 
  Building2,
  Users,
  Package,
  Calendar,
  Filter,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface ResultsGlobalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Company {
  id: string;
  name: string;
  cs_id: string | null;
  consultant_id: string | null;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface Service {
  id: string;
  name: string;
}

interface Project {
  id: string;
  product_id: string;
  product_name: string;
  onboarding_company_id: string | null;
  status: string;
}

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  company_id: string;
  target_value: number;
}

interface KPIEntry {
  id: string;
  kpi_id: string;
  value: number;
  entry_date: string;
  company_id: string;
}

interface MonthlyTarget {
  kpi_id: string;
  company_id: string;
  target_value: number;
  level_name: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B6B'];

export const ResultsGlobalDialog = ({ open, onOpenChange }: ResultsGlobalDialogProps) => {
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedConsultant, setSelectedConsultant] = useState<string>("all");
  const [selectedService, setSelectedService] = useState<string>("all");
  
  // Data states
  const [companies, setCompanies] = useState<Company[]>([]);
  const [consultants, setConsultants] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [entries, setEntries] = useState<KPIEntry[]>([]);
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTarget[]>([]);

  useEffect(() => {
    if (open) {
      fetchFiltersData();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      fetchKPIData();
    }
  }, [open, selectedMonth, selectedCompany, selectedConsultant, selectedService]);

  const fetchFiltersData = async () => {
    try {
      const [companiesRes, staffRes, servicesRes, projectsRes] = await Promise.all([
        supabase.from("onboarding_companies").select("id, name, cs_id, consultant_id").eq("status", "active").order("name"),
        supabase.from("onboarding_staff").select("id, name, role").eq("is_active", true).order("name"),
        supabase.from("onboarding_services").select("id, name").order("name"),
        supabase.from("onboarding_projects").select("id, product_id, product_name, onboarding_company_id, status").eq("status", "active"),
      ]);

      setCompanies(companiesRes.data || []);
      setConsultants((staffRes.data || []).filter(s => s.role === "consultant" || s.role === "cs"));
      setServices(servicesRes.data || []);
      setProjects(projectsRes.data || []);
    } catch (error) {
      console.error("Error fetching filters data:", error);
    }
  };

  const fetchKPIData = async () => {
    setLoading(true);
    try {
      // Calculate date range for selected month
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd");

      // Get filtered company IDs
      let filteredCompanyIds: string[] = [];
      
      if (selectedCompany !== "all") {
        filteredCompanyIds = [selectedCompany];
      } else {
        // Apply consultant and service filters
        let companyList = [...companies];
        
        if (selectedConsultant !== "all") {
          companyList = companyList.filter(c => 
            c.cs_id === selectedConsultant || c.consultant_id === selectedConsultant
          );
        }
        
        if (selectedService !== "all") {
          const companyIdsWithService = projects
            .filter(p => p.product_id === selectedService && p.onboarding_company_id)
            .map(p => p.onboarding_company_id!);
          companyList = companyList.filter(c => companyIdsWithService.includes(c.id));
        }
        
        filteredCompanyIds = companyList.map(c => c.id);
      }

      if (filteredCompanyIds.length === 0) {
        setKpis([]);
        setEntries([]);
        setMonthlyTargets([]);
        setLoading(false);
        return;
      }

      // Fetch KPIs for filtered companies
      const [kpisRes, entriesRes, targetsRes] = await Promise.all([
        supabase
          .from("company_kpis")
          .select("id, name, kpi_type, company_id, target_value")
          .in("company_id", filteredCompanyIds)
          .eq("is_active", true),
        supabase
          .from("kpi_entries")
          .select("id, kpi_id, value, entry_date, company_id")
          .in("company_id", filteredCompanyIds)
          .gte("entry_date", startDate)
          .lte("entry_date", endDate),
        supabase
          .from("kpi_monthly_targets")
          .select("kpi_id, company_id, target_value, level_name")
          .in("company_id", filteredCompanyIds)
          .eq("month_year", selectedMonth)
          .is("unit_id", null)
          .is("salesperson_id", null),
      ]);

      setKpis((kpisRes.data || []) as KPI[]);
      setEntries(entriesRes.data || []);
      setMonthlyTargets(targetsRes.data || []);
    } catch (error) {
      console.error("Error fetching KPI data:", error);
      toast.error("Erro ao carregar dados de KPIs");
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1);
    setSelectedMonth(format(prevDate, "yyyy-MM"));
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(year, month, 1);
    setSelectedMonth(format(nextDate, "yyyy-MM"));
  };

  const clearFilters = () => {
    setSelectedCompany("all");
    setSelectedConsultant("all");
    setSelectedService("all");
  };

  const hasActiveFilters = selectedCompany !== "all" || selectedConsultant !== "all" || selectedService !== "all";

  // Aggregate KPIs by type
  const aggregatedData = useMemo(() => {
    // Group KPIs by normalized name (lowercase, trimmed)
    const kpiGroups: Record<string, { 
      name: string; 
      type: string; 
      realized: number; 
      target: number;
      companies: Set<string>;
    }> = {};

    kpis.forEach(kpi => {
      const normalizedName = kpi.name.toLowerCase().trim();
      
      if (!kpiGroups[normalizedName]) {
        kpiGroups[normalizedName] = {
          name: kpi.name,
          type: kpi.kpi_type,
          realized: 0,
          target: 0,
          companies: new Set(),
        };
      }
      
      // Sum entries for this KPI
      const kpiEntries = entries.filter(e => e.kpi_id === kpi.id);
      kpiGroups[normalizedName].realized += kpiEntries.reduce((sum, e) => sum + e.value, 0);
      
      // Get target (monthly target or default)
      const monthlyTarget = monthlyTargets.find(t => t.kpi_id === kpi.id);
      kpiGroups[normalizedName].target += monthlyTarget?.target_value ?? kpi.target_value;
      
      kpiGroups[normalizedName].companies.add(kpi.company_id);
    });

    return Object.values(kpiGroups).map(g => ({
      ...g,
      companies: g.companies.size,
      percentage: g.target > 0 ? (g.realized / g.target) * 100 : 0,
    }));
  }, [kpis, entries, monthlyTargets]);

  // Revenue totals (monetary KPIs)
  const revenueTotals = useMemo(() => {
    const monetaryKpis = aggregatedData.filter(k => k.type === "monetary");
    const realized = monetaryKpis.reduce((sum, k) => sum + k.realized, 0);
    const target = monetaryKpis.reduce((sum, k) => sum + k.target, 0);
    return { realized, target, percentage: target > 0 ? (realized / target) * 100 : 0 };
  }, [aggregatedData]);

  // Companies with data
  const companiesWithData = useMemo(() => {
    const companyIds = new Set(entries.map(e => e.company_id));
    return companies.filter(c => companyIds.has(c.id));
  }, [companies, entries]);

  // Per-company revenue breakdown
  const companyBreakdown = useMemo(() => {
    const breakdown: { name: string; realized: number; target: number; percentage: number }[] = [];
    
    companies.forEach(company => {
      const companyKpis = kpis.filter(k => k.company_id === company.id && k.kpi_type === "monetary");
      if (companyKpis.length === 0) return;
      
      let realized = 0;
      let target = 0;
      
      companyKpis.forEach(kpi => {
        const kpiEntries = entries.filter(e => e.kpi_id === kpi.id);
        realized += kpiEntries.reduce((sum, e) => sum + e.value, 0);
        
        const monthlyTarget = monthlyTargets.find(t => t.kpi_id === kpi.id);
        target += monthlyTarget?.target_value ?? kpi.target_value;
      });
      
      if (realized > 0 || target > 0) {
        breakdown.push({
          name: company.name.length > 20 ? company.name.substring(0, 20) + "..." : company.name,
          realized,
          target,
          percentage: target > 0 ? (realized / target) * 100 : 0,
        });
      }
    });
    
    return breakdown.sort((a, b) => b.realized - a.realized);
  }, [companies, kpis, entries, monthlyTargets]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  };

  const formatValue = (value: number, type: string) => {
    if (type === "monetary") return formatCurrency(value);
    if (type === "percentage") return `${value.toFixed(1)}%`;
    return value.toLocaleString("pt-BR");
  };

  const getKpiIcon = (type: string) => {
    switch (type) {
      case "monetary": return <DollarSign className="h-4 w-4" />;
      case "percentage": return <Percent className="h-4 w-4" />;
      default: return <Hash className="h-4 w-4" />;
    }
  };

  const monthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    return format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: ptBR });
  }, [selectedMonth]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Resultados Consolidados
          </DialogTitle>
        </DialogHeader>

        {/* Month Navigation */}
        <div className="flex items-center justify-center gap-4 py-2 border-b">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium capitalize">{monthLabel}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 py-3 border-b">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Empresa</Label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="w-[180px] h-8">
                <Building2 className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Consultor/CS</Label>
            <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
              <SelectTrigger className="w-[180px] h-8">
                <Users className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {consultants.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Serviço</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="w-[180px] h-8">
                <Package className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os serviços</SelectItem>
                {services.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-1">
            {loading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
                <div className="h-64 bg-muted animate-pulse rounded-lg" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Nenhum dado de KPI encontrado para os filtros selecionados.</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        Faturamento Total
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(revenueTotals.realized)}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Target className="h-3 w-3" />
                        Meta: {formatCurrency(revenueTotals.target)}
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          {revenueTotals.percentage >= 100 ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <span className={revenueTotals.percentage >= 100 ? "text-green-600" : "text-red-600"}>
                            {revenueTotals.percentage.toFixed(1)}% da meta
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-500" />
                        Empresas com Dados
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{companiesWithData.length}</div>
                      <div className="text-sm text-muted-foreground">
                        de {companies.length} empresas ativas
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Hash className="h-4 w-4 text-purple-500" />
                        Total de Lançamentos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{entries.length}</div>
                      <div className="text-sm text-muted-foreground">
                        em {aggregatedData.length} KPIs distintos
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {aggregatedData.slice(0, 8).map((kpi, index) => (
                    <Card key={index} className="overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          {getKpiIcon(kpi.type)}
                          <span className="text-xs font-medium truncate">{kpi.name}</span>
                        </div>
                        <div className="text-lg font-bold">{formatValue(kpi.realized, kpi.type)}</div>
                        <div className="text-xs text-muted-foreground">
                          Meta: {formatValue(kpi.target, kpi.type)}
                        </div>
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${kpi.percentage >= 100 ? 'bg-green-500' : kpi.percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(kpi.percentage, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {kpi.percentage.toFixed(1)}% • {kpi.companies} empresa{kpi.companies !== 1 ? 's' : ''}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Company Breakdown Chart */}
                {companyBreakdown.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Faturamento por Empresa</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={companyBreakdown.slice(0, 10)} 
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                            <Tooltip 
                              formatter={(value: number) => formatCurrency(value)}
                              labelStyle={{ fontWeight: 'bold' }}
                            />
                            <Legend />
                            <Bar dataKey="realized" name="Realizado" fill="#22c55e" />
                            <Bar dataKey="target" name="Meta" fill="#94a3b8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* KPI Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Detalhamento por KPI</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2 font-medium">KPI</th>
                            <th className="text-right p-2 font-medium">Realizado</th>
                            <th className="text-right p-2 font-medium">Meta</th>
                            <th className="text-right p-2 font-medium">%</th>
                            <th className="text-right p-2 font-medium">Empresas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aggregatedData.map((kpi, index) => (
                            <tr key={index} className="border-t">
                              <td className="p-2 flex items-center gap-2">
                                {getKpiIcon(kpi.type)}
                                {kpi.name}
                              </td>
                              <td className="p-2 text-right font-medium">{formatValue(kpi.realized, kpi.type)}</td>
                              <td className="p-2 text-right text-muted-foreground">{formatValue(kpi.target, kpi.type)}</td>
                              <td className="p-2 text-right">
                                <Badge variant={kpi.percentage >= 100 ? "default" : kpi.percentage >= 70 ? "secondary" : "destructive"}>
                                  {kpi.percentage.toFixed(1)}%
                                </Badge>
                              </td>
                              <td className="p-2 text-right text-muted-foreground">{kpi.companies}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
