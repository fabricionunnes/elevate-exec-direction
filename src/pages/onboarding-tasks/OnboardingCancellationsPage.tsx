import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import {
  ArrowLeft, RefreshCw, Building2, AlertTriangle, ShieldAlert, ShieldCheck,
  XCircle, Search, Filter, MessageSquare, Clock, Loader2, UserCheck, Ban,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

interface ProjectWithCompany {
  id: string;
  product_name: string;
  status: string;
  cancellation_signal_date: string | null;
  cancellation_signal_reason: string | null;
  cancellation_signal_notes: string | null;
  notice_end_date: string | null;
  company_id: string;
  company_name: string;
  contract_value: number | null;
  segment: string | null;
  consultant_name: string | null;
  cs_name: string | null;
  retention_status: string | null;
  retention_notes: string | null;
}

const RETENTION_STATUS_OPTIONS = [
  { value: "em_negociacao", label: "Em negociação", icon: "🤝", bgLight: "bg-amber-50 dark:bg-amber-950", textColor: "text-amber-700 dark:text-amber-300" },
  { value: "reuniao_agendada", label: "Reunião agendada", icon: "📅", bgLight: "bg-violet-50 dark:bg-violet-950", textColor: "text-violet-700 dark:text-violet-300" },
  { value: "retido", label: "Retido", icon: "✅", bgLight: "bg-emerald-50 dark:bg-emerald-950", textColor: "text-emerald-700 dark:text-emerald-300" },
  { value: "encerrado", label: "Encerrado", icon: "❌", bgLight: "bg-rose-50 dark:bg-rose-950", textColor: "text-rose-700 dark:text-rose-300" },
];

type StatusFilter = "all" | "cancellation_signaled" | "notice_period";

export default function OnboardingCancellationsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [saving, setSaving] = useState(false);

  // Confirm close dialog
  const [closeDialog, setCloseDialog] = useState<{ open: boolean; project: ProjectWithCompany | null }>({ open: false, project: null });
  const [churnReason, setChurnReason] = useState("");
  const [churnNotes, setChurnNotes] = useState("");

  // Confirm retain dialog
  const [retainDialog, setRetainDialog] = useState<{ open: boolean; project: ProjectWithCompany | null }>({ open: false, project: null });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/onboarding-login"); return; }

    const { data: staff } = await supabase
      .from("onboarding_staff")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!staff || !["master", "admin", "cs"].includes(staff.role)) {
      toast.error("Acesso restrito");
      navigate("/onboarding-tasks");
      return;
    }

    setStaffId(staff.id);
    setIsAdmin(staff.role === "admin" || staff.role === "master");
    fetchData(staff.id, staff.role);
  };

  const fetchData = async (currentStaffId?: string, role?: string) => {
    setLoading(true);
    try {
      const { data: projectsData, error } = await supabase
        .from("onboarding_projects")
        .select(`
          id, product_name, status, 
          cancellation_signal_date, cancellation_signal_reason, cancellation_signal_notes,
          notice_end_date, retention_status, retention_notes,
          onboarding_company:onboarding_company_id(
            id, name, contract_value, segment,
            consultant:consultant_id(name),
            cs:cs_id(name)
          )
        `)
        .in("status", ["cancellation_signaled", "notice_period"])
        .order("cancellation_signal_date", { ascending: false, nullsFirst: false });

      if (error) throw error;

      const formatted: ProjectWithCompany[] = (projectsData || []).map((p: any) => ({
        id: p.id,
        product_name: p.product_name,
        status: p.status,
        cancellation_signal_date: p.cancellation_signal_date,
        cancellation_signal_reason: p.cancellation_signal_reason,
        cancellation_signal_notes: p.cancellation_signal_notes,
        notice_end_date: p.notice_end_date,
        company_id: p.onboarding_company?.id || "",
        company_name: p.onboarding_company?.name || "Sem empresa",
        contract_value: p.onboarding_company?.contract_value || null,
        segment: p.onboarding_company?.segment || null,
        consultant_name: p.onboarding_company?.consultant?.name || null,
        cs_name: p.onboarding_company?.cs?.name || null,
        retention_status: p.retention_status || null,
        retention_notes: p.retention_notes || null,
      }));

      // CS users: filter only their companies
      if (role === "cs" && currentStaffId) {
        const { data: myCompanies } = await supabase
          .from("onboarding_companies")
          .select("id")
          .or(`cs_id.eq.${currentStaffId},consultant_id.eq.${currentStaffId}`);
        const myIds = new Set((myCompanies || []).map(c => c.id));
        setProjects(formatted.filter(p => myIds.has(p.company_id)));
      } else {
        setProjects(formatted);
      }
    } catch (err) {
      console.error("Error fetching cancellations:", err);
      toast.error("Erro ao carregar dados");
    }
    setLoading(false);
  };

  const handleRetentionStatusChange = async (projectId: string, status: string) => {
    if (!isAdmin) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    if (status === "encerrado") {
      setCloseDialog({ open: true, project });
      return;
    }

    if (status === "retido") {
      setRetainDialog({ open: true, project });
      return;
    }

    try {
      const { error } = await supabase
        .from("onboarding_projects")
        .update({ retention_status: status } as any)
        .eq("id", projectId);
      if (error) throw error;

      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, retention_status: status } : p));
      toast.success("Status atualizado");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleCloseProject = async () => {
    const project = closeDialog.project;
    if (!project) return;
    setSaving(true);

    try {
      // Close the project
      const { error: projErr } = await supabase
        .from("onboarding_projects")
        .update({
          status: "closed",
          churn_date: format(new Date(), "yyyy-MM-dd"),
          churn_reason: churnReason || null,
          churn_notes: churnNotes || null,
          retention_status: "encerrado",
        } as any)
        .eq("id", project.id);
      if (projErr) throw projErr;

      // Also update company status
      if (project.company_id) {
        // Check if company has other active projects
        const { data: otherProjects } = await supabase
          .from("onboarding_projects")
          .select("id")
          .eq("onboarding_company_id", project.company_id)
          .eq("status", "active")
          .neq("id", project.id);

        if (!otherProjects || otherProjects.length === 0) {
          await supabase
            .from("onboarding_companies")
            .update({ status: "inactive" })
            .eq("id", project.company_id);
        }
      }

      toast.success("Projeto encerrado com sucesso");
      setCloseDialog({ open: false, project: null });
      setChurnReason("");
      setChurnNotes("");
      fetchData(staffId || undefined);
      
      // Redirect to Distrato page
      navigate(`/distrato?company_id=${project.company_id}&project_id=${project.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao encerrar projeto: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const handleRetainProject = async () => {
    const project = retainDialog.project;
    if (!project) return;
    setSaving(true);

    try {
      // Reactivate the project
      const { error } = await supabase
        .from("onboarding_projects")
        .update({
          status: "active",
          retention_status: "retido",
          cancellation_signal_date: null,
          cancellation_signal_reason: null,
          cancellation_signal_notes: null,
          notice_end_date: null,
        } as any)
        .eq("id", project.id);
      if (error) throw error;

      // Ensure company stays active
      if (project.company_id) {
        await supabase
          .from("onboarding_companies")
          .update({ status: "active" })
          .eq("id", project.company_id);
      }

      toast.success("Cliente retido com sucesso! Projeto reativado.");
      setRetainDialog({ open: false, project: null });
      fetchData(staffId || undefined);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao reter cliente: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const handleNotesChange = async (projectId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from("onboarding_projects")
        .update({ retention_notes: notes } as any)
        .eq("id", projectId);
      if (error) throw error;
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, retention_notes: notes } : p));
      toast.success("Observações salvas");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar observações");
    }
  };

  const filtered = projects.filter(p => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return p.company_name.toLowerCase().includes(q) || p.product_name.toLowerCase().includes(q);
    }
    return true;
  });

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const getNoticeDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    return differenceInDays(parseISO(endDate), new Date());
  };

  // Stats
  const stats = {
    total: projects.length,
    signaled: projects.filter(p => p.status === "cancellation_signaled").length,
    notice: projects.filter(p => p.status === "notice_period").length,
    totalValue: projects.reduce((sum, p) => sum + (p.contract_value || 0), 0),
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <NexusHeader title="Cancelamentos & Retenção" />
            </div>
            <Button onClick={() => fetchData(staffId || undefined)} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="border-l-4 border-l-slate-500 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-slate-200 dark:bg-slate-700">
                  <Building2 className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</p>
                  <p className="text-3xl font-bold text-slate-700 dark:text-slate-200">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-200 dark:bg-amber-800">
                  <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-500 uppercase tracking-wide">Sinalizados</p>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.signaled}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-rose-500 bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-rose-200 dark:bg-rose-800">
                  <ShieldAlert className="h-6 w-6 text-rose-600 dark:text-rose-300" />
                </div>
                <div>
                  <p className="text-xs font-medium text-rose-500 uppercase tracking-wide">Cumprindo Aviso</p>
                  <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{stats.notice}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-cyan-200 dark:bg-cyan-800">
                  <ShieldCheck className="h-6 w-6 text-cyan-600 dark:text-cyan-300" />
                </div>
                <div>
                  <p className="text-xs font-medium text-cyan-500 uppercase tracking-wide">Valor em Risco</p>
                  <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(stats.totalValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtrar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="cancellation_signaled">Sinalizou Cancelamento</SelectItem>
                    <SelectItem value="notice_period">Cumprindo Aviso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Empresas em Cancelamento ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="min-w-[1000px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border-b-2 border-primary/20">
                      <TableHead className="w-[200px] font-bold text-slate-700 dark:text-slate-200">🏢 Empresa</TableHead>
                      <TableHead className="w-[110px] font-bold text-slate-700 dark:text-slate-200">💵 Valor</TableHead>
                      <TableHead className="w-[120px] font-bold text-slate-700 dark:text-slate-200">📌 Situação</TableHead>
                      <TableHead className="w-[120px] font-bold text-slate-700 dark:text-slate-200">📅 Sinalização</TableHead>
                      <TableHead className="w-[120px] font-bold text-slate-700 dark:text-slate-200">⏰ Fim do Aviso</TableHead>
                      <TableHead className="w-[150px] font-bold text-slate-700 dark:text-slate-200">📝 Motivo</TableHead>
                      <TableHead className="w-[120px] font-bold text-slate-700 dark:text-slate-200">👤 Consultor</TableHead>
                      <TableHead className="w-[160px] font-bold text-slate-700 dark:text-slate-200">🔄 Retenção</TableHead>
                      <TableHead className="w-[50px] font-bold text-slate-700 dark:text-slate-200">💬</TableHead>
                      <TableHead className="w-[160px] text-right font-bold text-slate-700 dark:text-slate-200">⚡ Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((project, index) => {
                      const daysRemaining = getNoticeDaysRemaining(project.notice_end_date);
                      const retentionOpt = RETENTION_STATUS_OPTIONS.find(s => s.value === project.retention_status);

                      const getRowBg = () => {
                        if (project.status === "notice_period") return "bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-950/50";
                        return "bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/40";
                      };

                      return (
                        <TableRow key={project.id} className={`${getRowBg()} transition-colors border-b border-slate-200 dark:border-slate-700`}>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                                <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                              </div>
                              <span className="font-semibold text-sm text-slate-800 dark:text-slate-100" title={project.company_name}>
                                {project.company_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(project.contract_value)}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            {project.status === "cancellation_signaled" ? (
                              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-sm">
                                ⚠️ Sinalizou
                              </Badge>
                            ) : (
                              <Badge className="bg-gradient-to-r from-rose-500 to-red-600 text-white border-0 shadow-sm">
                                🚨 Em Aviso
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-sm">
                            {project.cancellation_signal_date
                              ? format(parseISO(project.cancellation_signal_date.substring(0, 10)), "dd/MM/yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell className="py-3">
                            {project.notice_end_date ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium">
                                  {format(parseISO(project.notice_end_date), "dd/MM/yyyy")}
                                </span>
                                {daysRemaining !== null && (
                                  <Badge
                                    variant={daysRemaining <= 0 ? "destructive" : daysRemaining <= 7 ? "outline" : "secondary"}
                                    className="text-xs w-fit"
                                  >
                                    {daysRemaining <= 0 ? "Expirado" : `${daysRemaining} dias`}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-sm text-muted-foreground truncate max-w-[150px] block" title={project.cancellation_signal_reason || ""}>
                              {project.cancellation_signal_reason || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-sm">{project.consultant_name || project.cs_name || "-"}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            {isAdmin ? (
                              <Select
                                value={project.retention_status || "em_negociacao"}
                                onValueChange={(v) => handleRetentionStatusChange(project.id, v)}
                              >
                                <SelectTrigger className={`w-full h-9 text-sm font-medium border-2 ${
                                  (RETENTION_STATUS_OPTIONS.find(s => s.value === (project.retention_status || "em_negociacao"))?.bgLight || "bg-slate-50")
                                } ${
                                  (RETENTION_STATUS_OPTIONS.find(s => s.value === (project.retention_status || "em_negociacao"))?.textColor || "text-slate-700")
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">
                                      {RETENTION_STATUS_OPTIONS.find(s => s.value === (project.retention_status || "em_negociacao"))?.icon || "🤝"}
                                    </span>
                                    <span className="truncate text-sm font-semibold">
                                      {RETENTION_STATUS_OPTIONS.find(s => s.value === (project.retention_status || "em_negociacao"))?.label || "Em negociação"}
                                    </span>
                                  </div>
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50 min-w-[200px] border-2">
                                  {RETENTION_STATUS_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value} className={`${opt.bgLight} ${opt.textColor} font-medium my-0.5 rounded-md`}>
                                      <div className="flex items-center gap-2">
                                        <span className="text-base">{opt.icon}</span>
                                        <span className="font-semibold">{opt.label}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge className={`${retentionOpt?.bgLight || "bg-slate-100"} ${retentionOpt?.textColor || "text-slate-700"} border-0 font-medium`}>
                                <span className="mr-1">{retentionOpt?.icon || "🤝"}</span>
                                {retentionOpt?.label || "Em negociação"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={project.retention_notes ? "text-primary" : "text-muted-foreground"}
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80">
                                <div className="space-y-2">
                                  <Label>Observações da retenção</Label>
                                  <Textarea
                                    value={project.retention_notes || ""}
                                    onChange={(e) => {
                                      setProjects(prev => prev.map(p =>
                                        p.id === project.id ? { ...p, retention_notes: e.target.value } : p
                                      ));
                                    }}
                                    onBlur={(e) => handleNotesChange(project.id, e.target.value)}
                                    placeholder="Adicione observações sobre a retenção..."
                                    rows={4}
                                  />
                                </div>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {isAdmin && (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => setRetainDialog({ open: true, project })}
                                  >
                                    <UserCheck className="h-4 w-4 mr-1" />
                                    Reter
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setCloseDialog({ open: true, project })}
                                  >
                                    <Ban className="h-4 w-4 mr-1" />
                                    Encerrar
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          Nenhuma empresa em processo de cancelamento
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

      {/* Close Project Dialog */}
      <AlertDialog open={closeDialog.open} onOpenChange={(open) => !open && setCloseDialog({ open: false, project: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar Projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja encerrar o projeto de <strong>{closeDialog.project?.company_name}</strong>?
              Esta ação irá marcar o projeto como encerrado e inativar a empresa caso não tenha outros projetos ativos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Motivo do churn</Label>
              <Input
                value={churnReason}
                onChange={(e) => setChurnReason(e.target.value)}
                placeholder="Ex: Sem orçamento, não viu valor..."
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={churnNotes}
                onChange={(e) => setChurnNotes(e.target.value)}
                placeholder="Detalhes adicionais..."
                rows={3}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
              Confirmar Encerramento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retain Project Dialog */}
      <AlertDialog open={retainDialog.open} onOpenChange={(open) => !open && setRetainDialog({ open: false, project: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reter Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma a retenção de <strong>{retainDialog.project?.company_name}</strong>?
              O projeto será reativado e o processo de cancelamento será encerrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetainProject} className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
              Confirmar Retenção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
