import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileText, Download, History, Eye, Calendar, DollarSign, Loader2, Search, Trash2, Users, Pencil, XCircle, Send, ExternalLink, Copy, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import EmployeeContractForm, {
  type EmployeeContractFormData,
  defaultEmployeeFormData,
} from "@/components/employee-contract/EmployeeContractForm";
import EmployeeClausesEditor, {
  type EditableEmployeeClause,
} from "@/components/employee-contract/EmployeeClausesEditor";
import {
  employeeContractClauses,
  clauseFirstByRole,
  clauseFirstDefault,
  defaultCommissionByRole,
  buildPaymentClauseText,
  roleLabels,
  employeeContractCompanyInfo,
  type RoleCommissionConfig,
} from "@/data/employeeContractTemplate";
import EmployeeCommissionEditor from "@/components/employee-contract/EmployeeCommissionEditor";
import { generateEmployeeContractPDF, downloadEmployeeContractPDF } from "@/components/employee-contract/generateEmployeeContractPDF";
import { formatCurrencyBR } from "@/lib/numberToWords";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CEO_EMAIL = "fabricio@universidadevendas.com.br";
const ALLOWED_EMAILS = [CEO_EMAIL, "yasmim@universidadevendas.com.br"];
const COMPANY_SIGNER_NAME = employeeContractCompanyInfo.representative;
const COMPANY_SIGNER_EMAIL = employeeContractCompanyInfo.email;

interface ZapSignSigner {
  name: string;
  email: string;
  signUrl?: string;
  status?: string;
}

interface SavedEmployeeContract {
  id: string;
  created_at: string;
  staff_id: string | null;
  staff_name: string;
  staff_role: string;
  staff_email: string | null;
  staff_phone: string | null;
  staff_cpf: string | null;
  staff_cnpj: string | null;
  staff_address: string | null;
  contract_value: number;
  payment_method: string;
  start_date: string | null;
  duration_months: number | null;
  clauses_snapshot: any;
  pdf_url: string | null;
  zapsign_document_token: string | null;
  zapsign_document_url: string | null;
  zapsign_signers: any;
  zapsign_sent_at: string | null;
}

function getEditableClauses(role: string, durationMonths?: number, commissionConfig?: RoleCommissionConfig): EditableEmployeeClause[] {
  const clauseContent = clauseFirstByRole[role] || clauseFirstDefault;
  const commission = commissionConfig || defaultCommissionByRole[role] || defaultCommissionByRole.consultor;
  const paymentContent = buildPaymentClauseText(commission);
  const duration = durationMonths || 3;
  const isSdrTerceirizado = role === "sdr_terceirizado";

  return employeeContractClauses.map((c) => {
    let content = c.content;
    if (c.id === "objeto") content = clauseContent;
    if (c.id === "pagamento") content = paymentContent;
    if (c.id === "prazo") {
      content = content.replace("válido por 3 meses", `válido por ${duration} meses`);
    }

    // SDR Terceirizado: remove agenda mínima (3.5) and non-compete items (d, e, f)
    if (isSdrTerceirizado && c.id === "obrigacoes_contratada") {
      // Remove the entire "3.5 ..." line (agenda mínima de 31 atendimentos)
      content = content
        .split("\n")
        .filter((line) => !line.trim().startsWith("3.5 "))
        .join("\n");
    }
    if (isSdrTerceirizado && c.id === "disposicoes") {
      // Remove the non-compete items d), e) and f) and the leading colon line that introduces them
      content = content
        .split("\n")
        .filter((line) => {
          const t = line.trim();
          return !(
            t.startsWith("d) Não-Oferta") ||
            t.startsWith("e) Não-Concorrência") ||
            t.startsWith("f) Penalidade")
          );
        })
        .join("\n");
    }

    return {
      id: c.id,
      title: c.title,
      content,
      originalContent: content,
      isDynamic: c.isDynamic,
    };
  });
}

function getZapSignStatusInfo(signers: ZapSignSigner[] | null) {
  if (!signers || signers.length === 0) return { label: "Pendente", color: "bg-muted text-muted-foreground", icon: Clock };
  const allSigned = signers.every((s) => s.status === "signed");
  const someSigned = signers.some((s) => s.status === "signed");
  if (allSigned) return { label: "Assinado", color: "bg-green-500/20 text-green-700 border-green-500/30", icon: CheckCircle2 };
  if (someSigned) return { label: "Parcial", color: "bg-amber-500/20 text-amber-700 border-amber-500/30", icon: AlertCircle };
  return { label: "Enviado", color: "bg-blue-500/20 text-blue-700 border-blue-500/30", icon: Send };
}

export default function EmployeeContractPage() {
  const navigate = useNavigate();
  const { isMaster, currentStaff } = useStaffPermissions();
  const [formData, setFormData] = useState<EmployeeContractFormData>(defaultEmployeeFormData);
  const [editableClauses, setEditableClauses] = useState<EditableEmployeeClause[]>(getEditableClauses("consultor", 3));
  const [commissionConfig, setCommissionConfig] = useState<RoleCommissionConfig>(
    defaultCommissionByRole.consultor
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [contracts, setContracts] = useState<SavedEmployeeContract[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContract, setSelectedContract] = useState<SavedEmployeeContract | null>(null);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ZapSign states
  const [isSendingToZapSign, setIsSendingToZapSign] = useState(false);
  const [lastSavedContractId, setLastSavedContractId] = useState<string | null>(null);
  const [lastGeneratedPdfUrl, setLastGeneratedPdfUrl] = useState<string | null>(null);
  const [zapSignSent, setZapSignSent] = useState(false);
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<{
    signers: any[];
    allSigned: boolean;
    signedFileUrl: string | null;
  } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserEmail(data.user?.email || null);
    });
  }, []);

  useEffect(() => {
    if (showHistory) loadContracts();
  }, [showHistory]);

  // Reset commission when role changes
  useEffect(() => {
    if (formData.staffRole && !editingContractId) {
      const roleConfig = defaultCommissionByRole[formData.staffRole] || defaultCommissionByRole.consultor;
      setCommissionConfig({ ...roleConfig });
    }
  }, [formData.staffRole, editingContractId]);

  // Update clauses when role, duration or commission changes
  useEffect(() => {
    if (formData.staffRole && !editingContractId) {
      setEditableClauses(getEditableClauses(formData.staffRole, formData.durationMonths, commissionConfig));
    }
  }, [formData.staffRole, formData.durationMonths, commissionConfig, editingContractId]);

  const hasAccess = currentUserEmail && ALLOWED_EMAILS.includes(currentUserEmail);
  const canDelete = currentUserEmail === CEO_EMAIL;

  // Block access for unauthorized users
  if (currentUserEmail !== null && !hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
          <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
        </div>
      </div>
    );
  }

  const loadContracts = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("employee_contracts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const contractsList = (data as unknown as SavedEmployeeContract[]) || [];
      setContracts(contractsList);

      // Refresh ZapSign statuses
      const withZapSign = contractsList.filter((c) => c.zapsign_document_token);
      if (withZapSign.length > 0) refreshZapSignStatuses(withZapSign);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar contratos");
    } finally {
      setLoadingHistory(false);
    }
  };

  const refreshZapSignStatuses = async (contractsList: SavedEmployeeContract[]) => {
    for (const contract of contractsList) {
      try {
        const { data, error } = await supabase.functions.invoke("check-zapsign-status", {
          body: { documentToken: contract.zapsign_document_token },
        });
        if (error || !data?.signers) continue;

        const signersChanged = JSON.stringify(data.signers.map((s: any) => s.status)) !==
          JSON.stringify((contract.zapsign_signers as any[] || []).map((s: any) => s.status));

        if (signersChanged) {
          await supabase
            .from("employee_contracts")
            .update({ zapsign_signers: data.signers })
            .eq("id", contract.id);

          setContracts((prev) =>
            prev.map((c) => (c.id === contract.id ? { ...c, zapsign_signers: data.signers } : c))
          );
          if (selectedContract?.id === contract.id) {
            setSelectedContract((prev) => prev ? { ...prev, zapsign_signers: data.signers } : prev);
          }
        }
      } catch {
        // ignore individual failures
      }
    }
  };

  const checkSignatureStatus = async (documentToken: string) => {
    setIsLoadingSignatures(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-zapsign-status", {
        body: { documentToken },
      });
      if (error) {
        console.error("Erro ao verificar status:", error);
        return;
      }
      setSignatureStatus({
        signers: data.signers || [],
        allSigned: data.allSigned || false,
        signedFileUrl: data.signedFileUrl || null,
      });
    } catch (error) {
      console.error("Erro ao verificar status:", error);
    } finally {
      setIsLoadingSignatures(false);
    }
  };

  const downloadFileFromUrl = async (url: string, filename: string) => {
    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch (e) {
      console.error("Erro ao baixar arquivo:", e);
      toast.error("Não consegui baixar o arquivo assinado. Tente novamente.");
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setZapSignSent(false);
    try {
      const blob = await generateEmployeeContractPDF({
        formData,
        customClauses: editableClauses,
      });

      // Upload PDF
      const fileName = `employee_contracts/${Date.now()}_${formData.staffName.replace(/\s+/g, "_")}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("contract-pdfs")
        .upload(fileName, blob, { contentType: "application/pdf", upsert: true });

      let pdfUrl: string | null = null;
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("contract-pdfs").getPublicUrl(fileName);
        pdfUrl = urlData?.publicUrl || null;
      }

      const { data: staffData } = await supabase.auth.getUser();
      const staffUserId = staffData.user?.id;
      let createdByStaffId: string | null = null;
      if (staffUserId) {
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", staffUserId)
          .eq("is_active", true)
          .maybeSingle();
        createdByStaffId = staff?.id || null;
      }

      const contractData = {
        staff_id: formData.staffId || null,
        staff_name: formData.staffName,
        staff_role: formData.staffRole,
        staff_email: formData.staffEmail || null,
        staff_phone: formData.staffPhone || null,
        staff_cpf: formData.staffCpf || null,
        staff_cnpj: formData.staffCnpj || null,
        staff_address: formData.staffAddress || null,
        contract_value: formData.contractValue,
        payment_method: formData.paymentMethod,
        start_date: formData.startDate ? format(formData.startDate, "yyyy-MM-dd") : null,
        duration_months: formData.durationMonths,
        clauses_snapshot: editableClauses.map((c) => ({ id: c.id, title: c.title, content: c.content, isDynamic: c.isDynamic })),
        pdf_url: pdfUrl,
        created_by: createdByStaffId,
      };

      let savedId: string | null = null;

      if (editingContractId) {
        // Cancel old ZapSign if exists
        const oldContract = contracts.find((c) => c.id === editingContractId);
        if (oldContract?.zapsign_document_token) {
          try {
            await supabase.functions.invoke("cancel-zapsign", {
              body: { documentToken: oldContract.zapsign_document_token },
            });
            toast.info("Documento anterior cancelado na ZapSign.");
          } catch {}
        }

        const { error } = await supabase
          .from("employee_contracts")
          .update({
            ...contractData,
            zapsign_document_token: null,
            zapsign_document_url: null,
            zapsign_signers: null,
            zapsign_sent_at: null,
          })
          .eq("id", editingContractId);
        if (error) throw error;
        savedId = editingContractId;
        toast.success("Contrato atualizado com sucesso!");
        setEditingContractId(null);
      } else {
        const { data: inserted, error } = await supabase
          .from("employee_contracts")
          .insert(contractData)
          .select("id")
          .single();
        if (error) throw error;
        savedId = inserted?.id || null;
        toast.success("Contrato gerado com sucesso!");
      }

      setLastSavedContractId(savedId);
      setLastGeneratedPdfUrl(pdfUrl);

      downloadEmployeeContractPDF(blob, formData.staffName);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar contrato: " + (err.message || "erro desconhecido"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendToZapSign = async () => {
    if (!lastGeneratedPdfUrl) {
      toast.error("PDF não disponível. Gere o contrato novamente.");
      return;
    }
    if (!formData.staffEmail) {
      toast.error("E-mail do colaborador é obrigatório para envio via ZapSign.");
      return;
    }

    setIsSendingToZapSign(true);
    try {
      const documentName = `Contrato Colaborador - ${formData.staffName} - ${roleLabels[formData.staffRole] || formData.staffRole}`;
      const { data, error } = await supabase.functions.invoke("send-to-zapsign", {
        body: {
          pdfUrl: lastGeneratedPdfUrl,
          documentName,
          signers: [
            { name: COMPANY_SIGNER_NAME, email: COMPANY_SIGNER_EMAIL },
            { name: formData.staffName, email: formData.staffEmail, phone: formData.staffPhone },
          ],
          sendAutomatically: true,
        },
      });

      if (error) {
        toast.error("Erro ao enviar para ZapSign. Verifique a configuração.");
        return;
      }

      if (lastSavedContractId) {
        await supabase
          .from("employee_contracts")
          .update({
            zapsign_document_token: data.documentToken,
            zapsign_document_url: data.documentUrl,
            zapsign_signers: data.signers,
            zapsign_sent_at: new Date().toISOString(),
          })
          .eq("id", lastSavedContractId);
      }

      setZapSignSent(true);
      toast.success(data.message || "Contrato enviado para assinatura!");
    } catch {
      toast.error("Erro ao enviar para ZapSign.");
    } finally {
      setIsSendingToZapSign(false);
    }
  };

  const handleSendToZapSignFromHistory = async (contract: SavedEmployeeContract) => {
    if (!contract.pdf_url) {
      toast.error("PDF não disponível.");
      return;
    }
    if (!contract.staff_email) {
      toast.error("E-mail do colaborador não informado neste contrato.");
      return;
    }

    setIsSendingToZapSign(true);
    try {
      const documentName = `Contrato Colaborador - ${contract.staff_name} - ${roleLabels[contract.staff_role] || contract.staff_role}`;
      const { data, error } = await supabase.functions.invoke("send-to-zapsign", {
        body: {
          pdfUrl: contract.pdf_url,
          documentName,
          signers: [
            { name: COMPANY_SIGNER_NAME, email: COMPANY_SIGNER_EMAIL },
            { name: contract.staff_name, email: contract.staff_email, phone: contract.staff_phone || "" },
          ],
          sendAutomatically: true,
        },
      });

      if (error) {
        toast.error("Erro ao enviar para ZapSign.");
        return;
      }

      await supabase
        .from("employee_contracts")
        .update({
          zapsign_document_token: data.documentToken,
          zapsign_document_url: data.documentUrl,
          zapsign_signers: data.signers,
          zapsign_sent_at: new Date().toISOString(),
        })
        .eq("id", contract.id);

      setSelectedContract({
        ...contract,
        zapsign_document_token: data.documentToken,
        zapsign_document_url: data.documentUrl,
        zapsign_signers: data.signers,
        zapsign_sent_at: new Date().toISOString(),
      });

      loadContracts();
      toast.success(data.message || "Contrato enviado para assinatura!");
    } catch {
      toast.error("Erro ao enviar para ZapSign.");
    } finally {
      setIsSendingToZapSign(false);
    }
  };

  const handleEdit = (contract: SavedEmployeeContract) => {
    setFormData({
      staffId: contract.staff_id || "",
      staffName: contract.staff_name,
      staffRole: contract.staff_role,
      staffEmail: contract.staff_email || "",
      staffPhone: contract.staff_phone || "",
      staffCpf: contract.staff_cpf || "",
      staffCnpj: contract.staff_cnpj || "",
      staffAddress: contract.staff_address || "",
      contractValue: contract.contract_value,
      paymentMethod: contract.payment_method,
      startDate: contract.start_date ? new Date(contract.start_date) : new Date(),
      durationMonths: contract.duration_months || 3,
    });

    if (contract.clauses_snapshot && Array.isArray(contract.clauses_snapshot)) {
      const restored = (contract.clauses_snapshot as any[]).map((c: any) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        originalContent: c.content,
        isDynamic: c.isDynamic,
      }));
      setEditableClauses(restored);
    } else {
      setEditableClauses(getEditableClauses(contract.staff_role));
    }

    setEditingContractId(contract.id);
    setShowHistory(false);
    setZapSignSent(false);
    setLastSavedContractId(null);
    setLastGeneratedPdfUrl(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este contrato?")) return;
    setIsDeleting(true);
    try {
      const contract = contracts.find((c) => c.id === id);
      if (contract?.zapsign_document_token) {
        try {
          await supabase.functions.invoke("cancel-zapsign", {
            body: { documentToken: contract.zapsign_document_token },
          });
        } catch {}
      }
      const { error } = await supabase.from("employee_contracts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Contrato excluído");
      loadContracts();
      setSelectedContract(null);
    } catch {
      toast.error("Erro ao excluir");
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copiado!");
  };

  const filteredContracts = contracts.filter((c) =>
    c.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (roleLabels[c.staff_role] || c.staff_role).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setEditingContractId(null);
    setFormData(defaultEmployeeFormData);
    setEditableClauses(getEditableClauses("consultor"));
    setZapSignSent(false);
    setLastSavedContractId(null);
    setLastGeneratedPdfUrl(null);
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/contratos")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Contratos de Colaboradores
                </h1>
                <p className="text-sm text-muted-foreground">
                  Contratos de prestação de serviços autônomos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editingContractId && !showHistory && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { resetForm(); toast.info("Edição cancelada"); }}
                  className="text-destructive hover:text-destructive gap-1"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar Edição
                </Button>
              )}
              {currentUserEmail && ALLOWED_EMAILS.includes(currentUserEmail) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (showHistory) resetForm();
                    setShowHistory(!showHistory);
                  }}
                  className="gap-2"
                >
                  <History className="h-4 w-4" />
                  {showHistory ? "Novo Contrato" : "Histórico"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {showHistory ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold">Contratos Gerados</h2>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou cargo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredContracts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum contrato de colaborador encontrado.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContracts.map((c) => {
                  const zapStatus = getZapSignStatusInfo(c.zapsign_signers as ZapSignSigner[] | null);
                  const StatusIcon = zapStatus.icon;
                  return (
                    <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedContract(c)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-sm">{c.staff_name}</h3>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {roleLabels[c.staff_role] || c.staff_role}
                              </Badge>
                              {c.zapsign_sent_at && (
                                <Badge variant="outline" className={`text-xs ${zapStatus.color}`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {zapStatus.label}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEdit(c); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {c.pdf_url && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); window.open(c.pdf_url!, "_blank"); }}>
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <Separator className="my-2" />
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrencyBR(c.contract_value)}/mês
                          </div>
                          {c.start_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Início: {format(new Date(c.start_date), "dd/MM/yyyy")}
                            </div>
                          )}
                          <div className="text-xs">
                            Gerado em {format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-4">
              {editingContractId && (
                <Card className="border-amber-500/50 bg-amber-500/10">
                  <CardContent className="py-3 px-4">
                    <p className="text-sm font-medium text-amber-700">
                      ✏️ Editando contrato existente
                    </p>
                  </CardContent>
                </Card>
              )}
              <EmployeeContractForm
                formData={formData}
                onChange={setFormData}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
              />

              {/* ZapSign send button after generation */}
              {lastGeneratedPdfUrl && lastSavedContractId && !zapSignSent && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="py-4 px-4 space-y-3">
                    <p className="text-sm font-medium">📄 Contrato gerado com sucesso! Deseja enviar para assinatura digital?</p>
                    <Button
                      onClick={handleSendToZapSign}
                      disabled={isSendingToZapSign || !formData.staffEmail}
                      className="w-full gap-2"
                    >
                      {isSendingToZapSign ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                      ) : (
                        <><Send className="h-4 w-4" /> Enviar para ZapSign</>
                      )}
                    </Button>
                    {!formData.staffEmail && (
                      <p className="text-xs text-destructive">Preencha o e-mail do colaborador para enviar via ZapSign.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {zapSignSent && (
                <Card className="border-green-500/30 bg-green-500/5">
                  <CardContent className="py-4 px-4">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="h-5 w-5" />
                      <p className="text-sm font-medium">Contrato enviado para assinatura digital!</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Os signatários receberão um e-mail com o link de assinatura.</p>
                  </CardContent>
                </Card>
              )}

              <EmployeeCommissionEditor
                role={formData.staffRole || "consultor"}
                config={commissionConfig}
                onChange={setCommissionConfig}
              />
            </div>
            <div className="space-y-4">
              <EmployeeClausesEditor
                clauses={editableClauses}
                onChange={setEditableClauses}
              />
            </div>
          </div>
        )}
      </main>

      {/* Contract detail dialog */}
      <Dialog open={!!selectedContract} onOpenChange={(open) => { if (!open) { setSelectedContract(null); setSignatureStatus(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Contrato</DialogTitle>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Colaborador:</span>
                  <p className="font-medium">{selectedContract.staff_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cargo:</span>
                  <p className="font-medium">{roleLabels[selectedContract.staff_role] || selectedContract.staff_role}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor Mensal:</span>
                  <p className="font-medium">{formatCurrencyBR(selectedContract.contract_value)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duração:</span>
                  <p className="font-medium">{selectedContract.duration_months || 3} meses</p>
                </div>
                {selectedContract.staff_cpf && (
                  <div>
                    <span className="text-muted-foreground">CPF:</span>
                    <p className="font-medium">{selectedContract.staff_cpf}</p>
                  </div>
                )}
                {selectedContract.staff_cnpj && (
                  <div>
                    <span className="text-muted-foreground">CNPJ:</span>
                    <p className="font-medium">{selectedContract.staff_cnpj}</p>
                  </div>
                )}
                {selectedContract.start_date && (
                  <div>
                    <span className="text-muted-foreground">Início:</span>
                    <p className="font-medium">{format(new Date(selectedContract.start_date), "dd/MM/yyyy")}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Gerado em:</span>
                  <p className="font-medium">{format(new Date(selectedContract.created_at), "dd/MM/yyyy HH:mm")}</p>
                </div>
              </div>

              {/* ZapSign status section */}
              {selectedContract.zapsign_sent_at && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        Assinatura Digital (ZapSign)
                      </h4>
                      {selectedContract.zapsign_document_token && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1"
                          disabled={isLoadingSignatures}
                          onClick={() => checkSignatureStatus(selectedContract.zapsign_document_token!)}
                        >
                          {isLoadingSignatures ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                          Atualizar Status
                        </Button>
                      )}
                    </div>

                    {/* Show real-time signature status if loaded */}
                    {signatureStatus ? (
                      <div className="space-y-2">
                        {signatureStatus.signers.map((signer: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                            <div>
                              <p className="font-medium">{signer.name}</p>
                              <p className="text-xs text-muted-foreground">{signer.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {signer.status === "signed" ? (
                                <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500/30 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Assinado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30 text-xs">
                                  <Clock className="h-3 w-3 mr-1" /> Pendente
                                </Badge>
                              )}
                              {signer.signUrl && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(signer.signUrl!)}>
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* All signed - download button */}
                        {signatureStatus.allSigned && signatureStatus.signedFileUrl && (
                          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                                Todas as partes assinaram!
                              </span>
                            </div>
                            <Button
                              onClick={() =>
                                downloadFileFromUrl(
                                  signatureStatus.signedFileUrl!,
                                  `Contrato_Assinado_${selectedContract.staff_name.replace(/\s+/g, "_")}.pdf`
                                )
                              }
                              className="w-full bg-green-600 hover:bg-green-700"
                              size="sm"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Baixar Contrato Assinado
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Fallback: show cached signer data */
                      <div className="space-y-2">
                        {(selectedContract.zapsign_signers as ZapSignSigner[] || []).map((signer, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                            <div>
                              <p className="font-medium">{signer.name}</p>
                              <p className="text-xs text-muted-foreground">{signer.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {signer.status === "signed" ? (
                                <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500/30 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Assinado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30 text-xs">
                                  <Clock className="h-3 w-3 mr-1" /> Pendente
                                </Badge>
                              )}
                              {signer.signUrl && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(signer.signUrl!)}>
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground text-center">
                          Clique em "Atualizar Status" para ver o status atual e baixar o contrato assinado.
                        </p>
                      </div>
                    )}

                    {selectedContract.zapsign_document_url && (
                      <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => window.open(selectedContract.zapsign_document_url!, "_blank")}>
                        <ExternalLink className="h-4 w-4" />
                        Abrir na ZapSign
                      </Button>
                    )}
                  </div>
                </>
              )}

              <Separator />

              <div className="flex flex-wrap gap-2 pt-1">
                {selectedContract.pdf_url && (
                  <Button variant="outline" size="sm" onClick={() => window.open(selectedContract.pdf_url!, "_blank")}>
                    <Download className="h-4 w-4 mr-1" />
                    Download PDF
                  </Button>
                )}
                {!selectedContract.zapsign_sent_at && selectedContract.pdf_url && (
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isSendingToZapSign || !selectedContract.staff_email}
                    onClick={() => handleSendToZapSignFromHistory(selectedContract)}
                  >
                    {isSendingToZapSign ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Enviando...</>
                    ) : (
                      <><Send className="h-4 w-4 mr-1" /> Enviar ZapSign</>
                    )}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { handleEdit(selectedContract); setSelectedContract(null); }}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                {canDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => handleDelete(selectedContract.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Excluir
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
