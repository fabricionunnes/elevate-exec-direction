import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileText, Download, History, Eye, Calendar, DollarSign, Loader2, Search, Trash2, Users, Pencil, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
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
  clausePaymentByRole,
  clausePaymentDefault,
  roleLabels,
} from "@/data/employeeContractTemplate";
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

function getEditableClauses(role: string, durationMonths?: number): EditableEmployeeClause[] {
  const clauseContent = clauseFirstByRole[role] || clauseFirstDefault;
  const paymentContent = clausePaymentByRole[role] || clausePaymentDefault;
  const duration = durationMonths || 3;
  return employeeContractClauses.map((c) => {
    let content = c.content;
    if (c.id === "objeto") content = clauseContent;
    if (c.id === "pagamento") content = paymentContent;
    if (c.id === "prazo") {
      content = content.replace("válido por 3 meses", `válido por ${duration} meses`);
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

export default function EmployeeContractPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<EmployeeContractFormData>(defaultEmployeeFormData);
  const [editableClauses, setEditableClauses] = useState<EditableEmployeeClause[]>(getEditableClauses("consultor", 3));
  const [isGenerating, setIsGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [contracts, setContracts] = useState<SavedEmployeeContract[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContract, setSelectedContract] = useState<SavedEmployeeContract | null>(null);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserEmail(data.user?.email || null);
    });
  }, []);

  useEffect(() => {
    if (showHistory) loadContracts();
  }, [showHistory]);

  // Update clauses when role or duration changes
  useEffect(() => {
    if (formData.staffRole && !editingContractId) {
      setEditableClauses(getEditableClauses(formData.staffRole, formData.durationMonths));
    }
  }, [formData.staffRole, formData.durationMonths, editingContractId]);

  const canDelete = currentUserEmail === CEO_EMAIL;

  const loadContracts = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("employee_contracts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setContracts((data as unknown as SavedEmployeeContract[]) || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar contratos");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
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

      if (editingContractId) {
        const { error } = await supabase
          .from("employee_contracts")
          .update(contractData)
          .eq("id", editingContractId);
        if (error) throw error;
        toast.success("Contrato atualizado com sucesso!");
        setEditingContractId(null);
      } else {
        const { error } = await supabase
          .from("employee_contracts")
          .insert(contractData);
        if (error) throw error;
        toast.success("Contrato gerado com sucesso!");
      }

      downloadEmployeeContractPDF(blob, formData.staffName);
      setFormData(defaultEmployeeFormData);
      setEditableClauses(getEditableClauses("consultor"));
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar contrato: " + (err.message || "erro desconhecido"));
    } finally {
      setIsGenerating(false);
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

    // Restore clauses snapshot if available
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
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este contrato?")) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("employee_contracts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Contrato excluído");
      loadContracts();
      setSelectedContract(null);
    } catch (err) {
      toast.error("Erro ao excluir");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredContracts = contracts.filter((c) =>
    c.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (roleLabels[c.staff_role] || c.staff_role).toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                  onClick={() => {
                    setEditingContractId(null);
                    setFormData(defaultEmployeeFormData);
                    setEditableClauses(getEditableClauses("consultor"));
                    toast.info("Edição cancelada");
                  }}
                  className="text-destructive hover:text-destructive gap-1"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar Edição
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  if (showHistory) {
                    setEditingContractId(null);
                    setFormData(defaultEmployeeFormData);
                    setEditableClauses(getEditableClauses("consultor"));
                  }
                  setShowHistory(!showHistory);
                }}
                className="gap-2"
              >
                <History className="h-4 w-4" />
                {showHistory ? "Novo Contrato" : "Histórico"}
              </Button>
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
                {filteredContracts.map((c) => (
                  <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedContract(c)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-sm">{c.staff_name}</h3>
                          <Badge variant="secondary" className="text-xs mt-1">
                            {roleLabels[c.staff_role] || c.staff_role}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {c.pdf_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); window.open(c.pdf_url!, "_blank"); }}
                            >
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
                ))}
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
      <Dialog open={!!selectedContract} onOpenChange={() => setSelectedContract(null)}>
        <DialogContent className="max-w-lg">
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
              <div className="flex gap-2 pt-2">
                {selectedContract.pdf_url && (
                  <Button variant="outline" size="sm" onClick={() => window.open(selectedContract.pdf_url!, "_blank")}>
                    <Download className="h-4 w-4 mr-1" />
                    Download PDF
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
