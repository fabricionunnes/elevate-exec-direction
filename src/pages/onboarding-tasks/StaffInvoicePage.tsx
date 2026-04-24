import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileText, DollarSign, History, Settings, Download, Search, Eye, Pencil, Trash2 } from "lucide-react";

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  enviado: { label: "Enviado", variant: "default" },
  em_analise: { label: "Em análise", variant: "secondary" },
  pago: { label: "Pago", variant: "outline" },
};

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  user_id: string;
}

interface Salary {
  id: string;
  staff_id: string;
  month: number;
  year: number;
  amount: number;
  commission?: number | null;
}

interface Invoice {
  id: string;
  staff_id: string;
  month: number;
  year: number;
  amount: number;
  pix_key: string;
  pdf_url: string;
  pdf_file_name: string | null;
  status: string;
  submitted_at: string;
  onboarding_staff?: { name: string; email: string } | null;
}

const StaffInvoicePage = () => {
  const navigate = useNavigate();
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(null);
  const [hasManagePermission, setHasManagePermission] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // My invoice state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [mySalary, setMySalary] = useState<Salary | null>(null);
  const [myInvoices, setMyInvoices] = useState<Invoice[]>([]);
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixKey, setPixKey] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCommissionFile, setSelectedCommissionFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commissionFileInputRef = useRef<HTMLInputElement>(null);
  
  // Admin state
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [adminFilterMonth, setAdminFilterMonth] = useState<number | "all">("all");
  const [adminFilterYear, setAdminFilterYear] = useState(new Date().getFullYear());
  const [adminFilterStaff, setAdminFilterStaff] = useState("all");
  const [adminFilterStatus, setAdminFilterStatus] = useState("all");
  
  // Salary config state
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [salaryStaffId, setSalaryStaffId] = useState("");
  const [salaryMonth, setSalaryMonth] = useState(new Date().getMonth() + 1);
  const [salaryYear, setSalaryYear] = useState(new Date().getFullYear());
  const [salaryAmount, setSalaryAmount] = useState<number>(0);
  const [salaryCommission, setSalaryCommission] = useState<number>(0);
  const [allSalaries, setAllSalaries] = useState<Salary[]>([]);
  const [savingSalary, setSavingSalary] = useState(false);
  const [deleteSalaryId, setDeleteSalaryId] = useState<string | null>(null);
  const [deletingSalary, setDeletingSalary] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (currentStaff) {
      loadMySalary();
      loadMyInvoices();
    }
  }, [currentStaff, selectedMonth, selectedYear]);

  useEffect(() => {
    if (hasManagePermission && allStaff.length > 0) {
      loadAdminInvoices();
      loadAllSalaries();
    }
  }, [hasManagePermission, allStaff, adminFilterMonth, adminFilterYear]);

  const loadInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/onboarding-tasks/login"); return; }

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, name, email, role, user_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      // Get full staff record (including tenant_id) for tenant isolation
      const { data: fullStaff } = await supabase
        .from("onboarding_staff")
        .select("id, name, email, role, user_id, tenant_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!fullStaff) { navigate("/onboarding-tasks"); return; }
      setCurrentStaff(fullStaff as any);
      const currentTenantId = (fullStaff as any).tenant_id ?? null;

      // Check nf_manage permission - only master has automatic access
      const isMaster = fullStaff.role === "master";
      if (isMaster) {
        setHasManagePermission(true);
      } else {
        const { data: perms } = await supabase
          .from("staff_menu_permissions")
          .select("menu_key")
          .eq("staff_id", fullStaff.id)
          .eq("menu_key", "nf_manage");
        setHasManagePermission((perms && perms.length > 0) || false);
      }

      // Load all staff for users with manage permission - SCOPED BY TENANT
      // Master (tenant_id NULL) sees only platform staff (tenant_id NULL)
      // White-label admin sees only their tenant's staff
      const loadStaffList = async () => {
        let q = supabase
          .from("onboarding_staff")
          .select("id, name, email, role, user_id, tenant_id")
          .eq("is_active", true)
          .order("name");
        if (currentTenantId === null) {
          q = q.is("tenant_id", null);
        } else {
          q = q.eq("tenant_id", currentTenantId);
        }
        const { data: staffList } = await q;
        setAllStaff((staffList || []) as any);
      };

      if (isMaster) {
        await loadStaffList();
      } else {
        const { data: perms } = await supabase
          .from("staff_menu_permissions")
          .select("menu_key")
          .eq("staff_id", fullStaff.id)
          .eq("menu_key", "nf_manage");
        if (perms && perms.length > 0) {
          await loadStaffList();
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const loadMySalary = async () => {
    if (!currentStaff) return;
    const { data } = await supabase
      .from("staff_salaries")
      .select("*")
      .eq("staff_id", currentStaff.id)
      .eq("month", selectedMonth)
      .eq("year", selectedYear)
      .maybeSingle();
    setMySalary(data);
  };

  const loadMyInvoices = async () => {
    if (!currentStaff) return;
    const { data } = await supabase
      .from("staff_invoices")
      .select("*")
      .eq("staff_id", currentStaff.id)
      .order("submitted_at", { ascending: false });
    setMyInvoices(data || []);
  };

  const loadAdminInvoices = async () => {
    if (!hasManagePermission) return;
    // Tenant isolation: limit to staff visible to current admin
    const tenantStaffIds = allStaff.map((s) => s.id);
    if (tenantStaffIds.length === 0) { setAllInvoices([]); return; }

    let query = supabase
      .from("staff_invoices")
      .select("*, onboarding_staff!staff_invoices_staff_id_fkey(name, email)")
      .in("staff_id", tenantStaffIds)
      .order("submitted_at", { ascending: false });
    
    if (adminFilterMonth !== "all") query = query.eq("month", adminFilterMonth);
    query = query.eq("year", adminFilterYear);
    
    if (adminFilterStaff !== "all") query = query.eq("staff_id", adminFilterStaff);
    if (adminFilterStatus !== "all") query = query.eq("status", adminFilterStatus);

    const { data } = await query;
    setAllInvoices(data || []);
  };

  const loadAllSalaries = async () => {
    if (!hasManagePermission) return;
    // Tenant isolation: limit to staff visible to current admin
    const tenantStaffIds = allStaff.map((s) => s.id);
    if (tenantStaffIds.length === 0) { setAllSalaries([]); return; }

    const { data } = await supabase
      .from("staff_salaries")
      .select("*")
      .in("staff_id", tenantStaffIds)
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    setAllSalaries(data || []);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são aceitos");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSelectedFile(file);
  };

  const handleCommissionFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são aceitos");
      if (commissionFileInputRef.current) commissionFileInputRef.current.value = "";
      return;
    }
    setSelectedCommissionFile(file);
  };

  const handleSubmitInvoice = async () => {
    if (!currentStaff || !selectedFile) return;

    if (!pixKey.trim()) {
      toast.error("Informe sua chave PIX antes de enviar");
      return;
    }

    if (!mySalary) {
      toast.error("Não há salário configurado para este mês");
      return;
    }

    const hasCommission = mySalary.commission && mySalary.commission > 0;
    if (hasCommission && !selectedCommissionFile) {
      toast.error("Anexe a NF de comissão antes de enviar");
      return;
    }

    setUploading(true);
    try {
      // Upload salary NF
      const filePath = `${currentStaff.user_id}/${selectedYear}-${String(selectedMonth).padStart(2, "0")}-salary-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("staff-invoices")
        .upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("staff_invoices")
        .insert({
          staff_id: currentStaff.id,
          month: selectedMonth,
          year: selectedYear,
          amount: mySalary.amount,
          pix_key: pixKey.trim(),
          pix_key_type: pixKeyType,
          pdf_url: filePath,
          pdf_file_name: selectedFile.name,
          invoice_type: "salary",
        } as any);
      if (insertError) throw insertError;

      // Upload commission NF if applicable
      if (hasCommission && selectedCommissionFile) {
        const commFilePath = `${currentStaff.user_id}/${selectedYear}-${String(selectedMonth).padStart(2, "0")}-commission-${Date.now()}.pdf`;
        const { error: commUploadError } = await supabase.storage
          .from("staff-invoices")
          .upload(commFilePath, selectedCommissionFile);
        if (commUploadError) throw commUploadError;

        const { error: commInsertError } = await supabase
          .from("staff_invoices")
          .insert({
            staff_id: currentStaff.id,
            month: selectedMonth,
            year: selectedYear,
            amount: mySalary.commission!,
            pix_key: pixKey.trim(),
            pix_key_type: pixKeyType,
            pdf_url: commFilePath,
            pdf_file_name: selectedCommissionFile.name,
            invoice_type: "commission",
          } as any);
        if (commInsertError) throw commInsertError;
      }

      await supabase.from("staff_invoice_audit_logs").insert({
        staff_id: currentStaff.id,
        action: "envio",
        details: `NF enviada para ${MONTHS[selectedMonth - 1].label}/${selectedYear} - Salário: R$ ${mySalary.amount.toFixed(2)}${hasCommission ? ` + Comissão: R$ ${mySalary.commission!.toFixed(2)}` : ""}`,
      });

      toast.success("Nota(s) fiscal(is) enviada(s) com sucesso!");
      setSelectedFile(null);
      setSelectedCommissionFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (commissionFileInputRef.current) commissionFileInputRef.current.value = "";
      loadMyInvoices();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar nota fiscal");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadPdf = async (pdfUrl: string, fileName: string | null) => {
    try {
      const { data, error } = await supabase.storage
        .from("staff-invoices")
        .download(pdfUrl);
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "nota-fiscal.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao baixar PDF");
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("staff_invoices")
        .update({ status: newStatus, reviewed_at: new Date().toISOString(), reviewed_by: currentStaff?.id })
        .eq("id", invoiceId);
      if (error) throw error;

      await supabase.from("staff_invoice_audit_logs").insert({
        staff_id: currentStaff?.id,
        invoice_id: invoiceId,
        action: "status_change",
        details: `Status alterado para ${STATUS_MAP[newStatus]?.label || newStatus}`,
      });

      toast.success("Status atualizado");
      loadAdminInvoices();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleUpdatePaymentForecast = async (invoiceId: string, date: string) => {
    try {
      const { error } = await supabase
        .from("staff_invoices")
        .update({ payment_forecast: date || null } as any)
        .eq("id", invoiceId);
      if (error) throw error;

      await supabase.from("staff_invoice_audit_logs").insert({
        staff_id: currentStaff?.id,
        invoice_id: invoiceId,
        action: "payment_forecast_change",
        details: `Previsão de pagamento alterada para ${date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}`,
      });

      toast.success("Previsão de pagamento atualizada");
      loadAdminInvoices();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar previsão");
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta nota fiscal? Esta ação não pode ser desfeita.")) return;
    try {
      const { error } = await supabase
        .from("staff_invoices")
        .delete()
        .eq("id", invoiceId);
      if (error) throw error;

      await supabase.from("staff_invoice_audit_logs").insert({
        staff_id: currentStaff?.id,
        invoice_id: invoiceId,
        action: "invoice_deleted",
        details: "Nota fiscal excluída pelo administrador",
      });

      toast.success("Nota fiscal excluída com sucesso");
      loadAdminInvoices();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao excluir nota fiscal: " + (err?.message || ""));
    }
  };

  const handleSaveSalary = async () => {
    if (!salaryStaffId || !salaryAmount) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSavingSalary(true);
    try {
      const amount = salaryAmount;
      if (!amount || amount <= 0) { toast.error("Valor inválido"); setSavingSalary(false); return; }

      // Upsert salary
      const { error } = await supabase
        .from("staff_salaries")
        .upsert({
          staff_id: salaryStaffId,
          month: salaryMonth,
          year: salaryYear,
          amount,
          commission: salaryCommission > 0 ? salaryCommission : null,
          created_by: currentStaff?.id,
        } as any, { onConflict: "staff_id,month,year" });

      if (error) throw error;

      await supabase.from("staff_invoice_audit_logs").insert({
        staff_id: currentStaff?.id,
        action: "salary_config",
        details: `Salário configurado para staff ${salaryStaffId}: R$ ${amount.toFixed(2)} em ${MONTHS[salaryMonth - 1].label}/${salaryYear}`,
      });

      toast.success("Salário configurado!");
      setSalaryDialogOpen(false);
      loadAllSalaries();
      loadMySalary();
    } catch (err: any) {
      console.error("Salary save error:", err, { salaryStaffId, salaryMonth, salaryYear, salaryAmount });
      toast.error(err?.message || "Erro ao salvar salário");
    } finally {
      setSavingSalary(false);
    }
  };

  const handleDeleteSalary = async () => {
    if (!deleteSalaryId) return;
    setDeletingSalary(true);
    try {
      const { error } = await supabase
        .from("staff_salaries")
        .delete()
        .eq("id", deleteSalaryId);
      if (error) throw error;

      await supabase.from("staff_invoice_audit_logs").insert({
        staff_id: currentStaff?.id,
        action: "salary_delete",
        details: `Salário excluído (ID: ${deleteSalaryId})`,
      });

      toast.success("Salário excluído!");
      setDeleteSalaryId(null);
      loadAllSalaries();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir salário");
    } finally {
      setDeletingSalary(false);
    }
  };

  const getStaffName = (staffId: string) => {
    return allStaff.find(s => s.id === staffId)?.name || "—";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Envio de Nota Fiscal</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas notas fiscais e visualize seu salário</p>
          </div>
        </div>

        <Tabs defaultValue="minha-nf">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="minha-nf" className="gap-2">
              <FileText className="h-4 w-4" />
              Minha NF
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
            {hasManagePermission && (
              <>
                <TabsTrigger value="recebidas" className="gap-2">
                  <Eye className="h-4 w-4" />
                  NFs Recebidas
                </TabsTrigger>
                <TabsTrigger value="salarios" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Salários
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* =========== MINHA NF =========== */}
          <TabsContent value="minha-nf">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Salary View */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Valor a Receber
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1">
                      <Label>Mês</Label>
                      <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MONTHS.map(m => (
                            <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24">
                      <Label>Ano</Label>
                      <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[2025, 2026, 2027].map(y => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {mySalary ? (
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center space-y-2">
                      <p className="text-sm text-muted-foreground mb-1">Mês de referência: {MONTHS[selectedMonth - 1].label}/{selectedYear}</p>
                      <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                        R$ {mySalary.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">Salário</p>
                      {mySalary.commission && mySalary.commission > 0 && (
                        <>
                          <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                            + R$ {mySalary.commission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground">Comissão</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="bg-muted rounded-lg p-6 text-center">
                      <p className="text-muted-foreground">Nenhum salário configurado para este mês</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upload Invoice */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-blue-600" />
                    Enviar Nota Fiscal
                  </CardTitle>
                  <CardDescription>
                    {MONTHS[selectedMonth - 1].label}/{selectedYear}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo de Chave PIX *</Label>
                      <Select value={pixKeyType} onValueChange={setPixKeyType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="cnpj">CNPJ</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="telefone">Telefone</SelectItem>
                          <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Chave PIX *</Label>
                      <Input
                        placeholder="Digite sua chave PIX"
                        value={pixKey}
                        onChange={(e) => setPixKey(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>NF do Salário (PDF) *</Label>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileSelect}
                      disabled={uploading || !mySalary}
                      className="cursor-pointer"
                    />
                    {selectedFile && (
                      <p className="text-xs text-muted-foreground mt-1">📄 {selectedFile.name}</p>
                    )}
                    {!mySalary && (
                      <p className="text-xs text-destructive mt-1">Salário não configurado para este mês</p>
                    )}
                  </div>
                  {mySalary?.commission && mySalary.commission > 0 && (
                    <div>
                      <Label>NF da Comissão (PDF) *</Label>
                      <p className="text-xs text-muted-foreground mb-1">
                        Comissão: R$ {mySalary.commission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <Input
                        ref={commissionFileInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={handleCommissionFileSelect}
                        disabled={uploading}
                        className="cursor-pointer"
                      />
                      {selectedCommissionFile && (
                        <p className="text-xs text-muted-foreground mt-1">📄 {selectedCommissionFile.name}</p>
                      )}
                    </div>
                  )}
                  <Button 
                    onClick={handleSubmitInvoice} 
                    disabled={uploading || !mySalary || !selectedFile || !pixKey.trim() || (mySalary?.commission && mySalary.commission > 0 && !selectedCommissionFile)}
                    className="w-full"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                        Enviando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Enviar Nota(s) Fiscal(is)
                      </span>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* =========== HISTÓRICO =========== */}
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Notas Fiscais</CardTitle>
              </CardHeader>
              <CardContent>
                {myInvoices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma nota fiscal enviada</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Previsão Pgto</TableHead>
                        <TableHead>Data de Envio</TableHead>
                        <TableHead>PDF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myInvoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell>{MONTHS[inv.month - 1]?.label}/{inv.year}</TableCell>
                          <TableCell>
                            <Badge variant={(inv as any).invoice_type === "commission" ? "secondary" : "outline"}>
                              {(inv as any).invoice_type === "commission" ? "Comissão" : "Salário"}
                            </Badge>
                          </TableCell>
                          <TableCell>R$ {inv.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_MAP[inv.status]?.variant || "default"}>
                              {STATUS_MAP[inv.status]?.label || inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(inv as any).payment_forecast 
                              ? new Date((inv as any).payment_forecast + "T12:00:00").toLocaleDateString("pt-BR")
                              : "—"}
                          </TableCell>
                          <TableCell>{new Date(inv.submitted_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => handleDownloadPdf(inv.pdf_url, inv.pdf_file_name)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* =========== NFs RECEBIDAS (ADMIN) =========== */}
          {hasManagePermission && (
            <TabsContent value="recebidas">
              <Card>
                <CardHeader>
                  <CardTitle>Notas Fiscais Recebidas</CardTitle>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <Select value={String(adminFilterMonth)} onValueChange={(v) => setAdminFilterMonth(v === "all" ? "all" : Number(v))}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os meses</SelectItem>
                        {MONTHS.map(m => (
                          <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={String(adminFilterYear)} onValueChange={(v) => setAdminFilterYear(Number(v))}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[2025, 2026, 2027].map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={adminFilterStaff} onValueChange={setAdminFilterStaff}>
                      <SelectTrigger className="w-48"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {allStaff.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={adminFilterStatus} onValueChange={(v) => { setAdminFilterStatus(v); }}>
                      <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="enviado">Enviado</SelectItem>
                        <SelectItem value="em_analise">Em análise</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={loadAdminInvoices}>
                      <Search className="h-4 w-4 mr-1" /> Filtrar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {allInvoices.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma nota fiscal encontrada</p>
                  ) : (
                    <div className="max-h-[600px] overflow-auto rounded-md border">
                      <Table className="min-w-[1100px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Mês</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Chave PIX</TableHead>
                            <TableHead>Data Envio</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Previsão Pgto</TableHead>
                            <TableHead>PDF</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allInvoices.map((inv) => {
                            const staffInfo = inv.onboarding_staff as any;
                            return (
                              <TableRow key={inv.id}>
                                <TableCell className="font-medium">{staffInfo?.name || "—"}</TableCell>
                                <TableCell>{MONTHS[inv.month - 1]?.label}/{inv.year}</TableCell>
                                <TableCell>
                                  <Badge variant={(inv as any).invoice_type === "commission" ? "secondary" : "outline"}>
                                    {(inv as any).invoice_type === "commission" ? "Comissão" : "Salário"}
                                  </Badge>
                                </TableCell>
                                <TableCell>R$ {inv.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-xs max-w-[180px]">
                                  <span className="font-medium uppercase">{(inv as any).pix_key_type || "—"}</span>: {inv.pix_key}
                                </TableCell>
                                <TableCell>{new Date(inv.submitted_at).toLocaleDateString("pt-BR")}</TableCell>
                                <TableCell>
                                  <Badge variant={STATUS_MAP[inv.status]?.variant || "default"}>
                                    {STATUS_MAP[inv.status]?.label || inv.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="date"
                                    className="h-8 w-36"
                                    value={(inv as any).payment_forecast || ""}
                                    onChange={(e) => handleUpdatePaymentForecast(inv.id, e.target.value)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button size="sm" variant="ghost" onClick={() => handleDownloadPdf(inv.pdf_url, inv.pdf_file_name)}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                                <TableCell>
                                  <Select value={inv.status} onValueChange={(v) => handleUpdateInvoiceStatus(inv.id, v)}>
                                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="enviado">Enviado</SelectItem>
                                      <SelectItem value="em_analise">Em análise</SelectItem>
                                      <SelectItem value="pago">Pago</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* =========== SALÁRIOS (ADMIN) =========== */}
          {hasManagePermission && (
            <TabsContent value="salarios">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Configuração de Salários</CardTitle>
                  <Button onClick={() => { setSalaryDialogOpen(true); setSalaryStaffId(""); setSalaryAmount(0); setSalaryCommission(0); }}>
                    Configurar Salário
                  </Button>
                </CardHeader>
                <CardContent>
                  {allSalaries.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum salário configurado</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Colaborador</TableHead>
                          <TableHead>Mês</TableHead>
                          <TableHead>Valor</TableHead>
                            <TableHead>Comissão</TableHead>
                            <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allSalaries.map((sal) => (
                          <TableRow key={sal.id}>
                            <TableCell>{getStaffName(sal.staff_id)}</TableCell>
                            <TableCell>{MONTHS[sal.month - 1]?.label}/{sal.year}</TableCell>
                            <TableCell>R$ {sal.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>
                              {(sal as any).commission && (sal as any).commission > 0
                                ? `R$ ${Number((sal as any).commission).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => {
                                  setSalaryStaffId(sal.staff_id);
                                  setSalaryMonth(sal.month);
                                  setSalaryYear(sal.year);
                                  setSalaryAmount(sal.amount);
                                  setSalaryCommission((sal as any).commission || 0);
                                  setSalaryDialogOpen(true);
                                }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteSalaryId(sal.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Salary Dialog */}
              <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Configurar Salário</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Colaborador</Label>
                      <Select value={salaryStaffId} onValueChange={setSalaryStaffId}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {allStaff.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Label>Mês</Label>
                        <Select value={String(salaryMonth)} onValueChange={(v) => setSalaryMonth(Number(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MONTHS.map(m => (
                              <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24">
                        <Label>Ano</Label>
                        <Select value={String(salaryYear)} onValueChange={(v) => setSalaryYear(Number(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[2025, 2026, 2027].map(y => (
                              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Salário (R$) *</Label>
                      <CurrencyInput
                        value={salaryAmount}
                        onChange={setSalaryAmount}
                      />
                    </div>
                    <div>
                      <Label>Comissão (R$) <span className="text-xs text-muted-foreground">— opcional</span></Label>
                      <CurrencyInput
                        value={salaryCommission}
                        onChange={setSalaryCommission}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Se preenchido, o colaborador precisará enviar duas NFs separadas</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSalaryDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSaveSalary} disabled={savingSalary}>
                      {savingSalary ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete Salary Confirmation */}
              <AlertDialog open={!!deleteSalaryId} onOpenChange={(open) => !open && setDeleteSalaryId(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir salário configurado?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. O salário configurado será removido permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deletingSalary}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteSalary} disabled={deletingSalary} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {deletingSalary ? "Excluindo..." : "Excluir"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default StaffInvoicePage;
