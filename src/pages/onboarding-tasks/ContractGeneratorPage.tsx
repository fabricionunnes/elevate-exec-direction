import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileText, Download, CheckCircle2, Home, History, Eye, Calendar, DollarSign, RefreshCw, Copy, Pencil, Send, Loader2, Clock, ExternalLink, Check, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import ContractForm, { type ContractFormData } from "@/components/contract-generator/ContractForm";
import ContractPreview from "@/components/contract-generator/ContractPreview";
import ClausesEditor, { getDefaultEditableClauses, type EditableClause } from "@/components/contract-generator/ClausesEditor";
import { generateContractPDF, downloadContractPDF } from "@/components/contract-generator/generateContractPDF";
import { productDetails } from "@/data/productDetails";
import { formatCurrencyBR } from "@/lib/numberToWords";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ZapSignSigner {
  name: string;
  email: string;
  status: string;
  signedAt: string | null;
  signUrl: string;
}

interface SavedContract {
  id: string;
  created_at: string;
  client_name: string;
  client_document: string;
  client_address: string | null;
  client_email: string | null;
  client_phone: string | null;
  legal_rep_name: string | null;
  legal_rep_cpf: string | null;
  legal_rep_rg: string | null;
  legal_rep_marital_status: string | null;
  legal_rep_nationality: string | null;
  legal_rep_profession: string | null;
  product_id: string;
  product_name: string;
  contract_value: number;
  payment_method: string;
  installments: number | null;
  is_recurring: boolean;
  start_date: string | null;
  pdf_url: string | null;
  zapsign_document_token: string | null;
  zapsign_document_url: string | null;
  zapsign_signers: unknown;
  zapsign_sent_at: string | null;
}

const defaultFormData: ContractFormData = {
  clientName: "",
  clientDocument: "",
  clientCep: "",
  clientStreet: "",
  clientNumber: "",
  clientComplement: "",
  clientNeighborhood: "",
  clientCity: "",
  clientState: "",
  clientEmail: "",
  clientPhone: "",
  legalRepName: "",
  legalRepCpf: "",
  legalRepRg: "",
  legalRepMaritalStatus: "",
  legalRepNationality: "brasileiro(a)",
  legalRepProfession: "",
  productId: "",
  contractValue: 0,
  paymentMethod: "pix",
  installments: 1,
  isRecurring: false,
  dueDate: undefined,
  startDate: new Date(),
};

const CEO_EMAIL = "fabricio@universidadevendas.com.br";

export default function ContractGeneratorPage() {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedContracts, setSavedContracts] = useState<SavedContract[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedContract, setSelectedContract] = useState<SavedContract | null>(null);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastSavedContractId, setLastSavedContractId] = useState<string | null>(null);
  
  // ZapSign integration states
  const [isSendingToZapSign, setIsSendingToZapSign] = useState(false);
  const [zapSignSent, setZapSignSent] = useState(false);
  const [lastGeneratedPdfUrl, setLastGeneratedPdfUrl] = useState<string | null>(null);
  const [historyZapSignSent, setHistoryZapSignSent] = useState(false);
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<{
    signers: ZapSignSigner[];
    allSigned: boolean;
    signedFileUrl: string | null;
  } | null>(null);
  
  // E-mail fixo da empresa contratada
  const COMPANY_SIGNER_EMAIL = "fabricio@universidadevendas.com.br";
  const COMPANY_SIGNER_NAME = "Universidade de Vendas";
  
  const canDeleteContracts = currentUserEmail === CEO_EMAIL;

  const [formData, setFormData] = useState<ContractFormData>(defaultFormData);
  const [editableClauses, setEditableClauses] = useState<EditableClause[]>(getDefaultEditableClauses());

  const fetchContractById = async (id: string): Promise<SavedContract | null> => {
    try {
      const { data, error } = await supabase
        .from("generated_contracts")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return (data as unknown as SavedContract) || null;
    } catch (error) {
      console.error("Erro ao buscar contrato atualizado:", error);
      return null;
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

      // Cleanup
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch (e) {
      console.error("Erro ao baixar arquivo:", e);
      toast.error("Não consegui baixar o arquivo assinado. Clique em Atualizar e tente novamente.");
    }
  };

  const loadContracts = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("generated_contracts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setSavedContracts(data || []);
    } catch (error) {
      console.error("Erro ao carregar contratos:", error);
      toast.error("Erro ao carregar histórico de contratos");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadContracts();
    
    // Get current user email
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserEmail(user?.email || null);
    };
    getCurrentUser();
  }, []);

  const uploadPDF = async (blob: Blob, clientName: string): Promise<string | null> => {
    try {
      const fileName = `contrato-${clientName.replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now()}.pdf`;
      const filePath = `contracts/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from("contract-pdfs")
        .upload(filePath, blob, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (error) {
        console.error("Erro ao fazer upload do PDF:", error);
        return null;
      }

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from("contract-pdfs")
        .getPublicUrl(filePath);

      return publicUrl.publicUrl;
    } catch (error) {
      console.error("Erro ao fazer upload do PDF:", error);
      return null;
    }
  };

  const saveContract = async (pdfUrl: string | null): Promise<string | null> => {
    try {
      const selectedProduct = productDetails[formData.productId];
      
      const { data, error } = await supabase
        .from("generated_contracts")
        .insert({
          client_name: formData.clientName,
          client_document: formData.clientDocument,
          client_address: `${formData.clientStreet}, nº ${formData.clientNumber}, ${formData.clientNeighborhood}, ${formData.clientCity} - ${formData.clientState}, CEP ${formData.clientCep}`,
          client_email: formData.clientEmail,
          client_phone: formData.clientPhone,
          legal_rep_name: formData.legalRepName,
          legal_rep_cpf: formData.legalRepCpf,
          legal_rep_rg: formData.legalRepRg,
          legal_rep_marital_status: formData.legalRepMaritalStatus,
          legal_rep_nationality: formData.legalRepNationality,
          legal_rep_profession: formData.legalRepProfession,
          product_id: formData.productId,
          product_name: selectedProduct?.name || formData.productId,
          contract_value: formData.contractValue,
          payment_method: formData.paymentMethod,
          installments: formData.isRecurring ? null : formData.installments,
          is_recurring: formData.isRecurring,
          due_date: formData.dueDate ? format(formData.dueDate, "yyyy-MM-dd") : null,
          start_date: formData.startDate ? format(formData.startDate, "yyyy-MM-dd") : null,
          pdf_url: pdfUrl,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Reload contracts list
      loadContracts();
      return data?.id || null;
    } catch (error) {
      console.error("Erro ao salvar contrato:", error);
      return null;
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setZapSignSent(false);
    setLastSavedContractId(null);
    try {
      // Convert editable clauses to format expected by PDF generator
      const customClauses = editableClauses.map((c) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        isDynamic: c.isDynamic,
      }));
      
      const blob = await generateContractPDF({ formData, customClauses });
      setGeneratedBlob(blob);
      
      // Upload PDF to storage
      const pdfUrl = await uploadPDF(blob, formData.clientName);
      setLastGeneratedPdfUrl(pdfUrl);
      
      // Save contract to database with PDF URL
      const savedId = await saveContract(pdfUrl);
      setLastSavedContractId(savedId);
      
      setShowSuccessDialog(true);
      toast.success("Contrato gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar contrato:", error);
      toast.error("Erro ao gerar o contrato. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendToZapSign = async () => {
    if (!lastGeneratedPdfUrl) {
      toast.error("PDF não disponível. Gere o contrato novamente.");
      return;
    }

    if (!formData.clientEmail) {
      toast.error("E-mail do cliente (contratante) é obrigatório para envio via ZapSign.");
      return;
    }

    setIsSendingToZapSign(true);
    try {
      const selectedProduct = productDetails[formData.productId];
      const documentName = `Contrato - ${formData.clientName} - ${selectedProduct?.name || formData.productId}`;

      const { data, error } = await supabase.functions.invoke("send-to-zapsign", {
        body: {
          pdfUrl: lastGeneratedPdfUrl,
          documentName,
          signers: [
            {
              name: COMPANY_SIGNER_NAME,
              email: COMPANY_SIGNER_EMAIL,
            },
            {
              name: formData.clientName,
              email: formData.clientEmail,
              phone: formData.clientPhone,
            },
          ],
          sendAutomatically: true,
        },
      });

      if (error) {
        console.error("Erro ao enviar para ZapSign:", error);
        toast.error("Erro ao enviar para ZapSign. Verifique a configuração.");
        return;
      }

      console.log("ZapSign response:", data);

      // Persist ZapSign info to the most recently saved contract so history can show status
      if (lastSavedContractId) {
        const { error: updateError } = await supabase
          .from("generated_contracts")
          .update({
            zapsign_document_token: data.documentToken,
            zapsign_document_url: data.documentUrl,
            zapsign_signers: data.signers,
            zapsign_sent_at: new Date().toISOString(),
          })
          .eq("id", lastSavedContractId);

        if (updateError) {
          console.error("Erro ao salvar dados do ZapSign no contrato:", updateError);
        } else {
          loadContracts();
        }
      }

      setZapSignSent(true);
      toast.success(data.message || "Contrato enviado para assinatura!");
    } catch (error) {
      console.error("Erro ao enviar para ZapSign:", error);
      toast.error("Erro ao enviar para ZapSign. Tente novamente.");
    } finally {
      setIsSendingToZapSign(false);
    }
  };

  const handleSendToZapSignFromHistory = async () => {
    if (!selectedContract?.pdf_url) {
      toast.error("PDF não disponível para este contrato.");
      return;
    }

    if (!selectedContract.client_email) {
      toast.error("E-mail do cliente (contratante) não foi informado neste contrato.");
      return;
    }

    setIsSendingToZapSign(true);
    try {
      const documentName = `Contrato - ${selectedContract.client_name} - ${selectedContract.product_name}`;

      const { data, error } = await supabase.functions.invoke("send-to-zapsign", {
        body: {
          pdfUrl: selectedContract.pdf_url,
          documentName,
          signers: [
            {
              name: COMPANY_SIGNER_NAME,
              email: COMPANY_SIGNER_EMAIL,
            },
            {
              name: selectedContract.client_name,
              email: selectedContract.client_email,
              phone: selectedContract.client_phone || "",
            },
          ],
          sendAutomatically: true,
        },
      });

      if (error) {
        console.error("Erro ao enviar para ZapSign:", error);
        toast.error("Erro ao enviar para ZapSign. Verifique a configuração.");
        return;
      }

      console.log("ZapSign response:", data);
      
      // Update contract in database with ZapSign info
      const { error: updateError } = await supabase
        .from("generated_contracts")
        .update({
          zapsign_document_token: data.documentToken,
          zapsign_document_url: data.documentUrl,
          zapsign_signers: data.signers,
          zapsign_sent_at: new Date().toISOString(),
        })
        .eq("id", selectedContract.id);
      
      if (updateError) {
        console.error("Erro ao atualizar contrato no banco:", updateError);
        toast.error("Não consegui salvar o envio para assinatura. Recarregue a página e tente novamente.");
        return;
      }

      // Fetch fresh contract from DB to ensure persistence/UI consistency
      const fresh = await fetchContractById(selectedContract.id);
      setSelectedContract(
        fresh || {
          ...selectedContract,
          zapsign_document_token: data.documentToken,
          zapsign_document_url: data.documentUrl,
          zapsign_signers: data.signers,
          zapsign_sent_at: new Date().toISOString(),
        }
      );
      
      setHistoryZapSignSent(true);
      // Refresh signature status
      await checkSignatureStatus(data.documentToken);
      // Reload contracts list
      await loadContracts();
      toast.success(data.message || "Contrato enviado para assinatura!");
    } catch (error) {
      console.error("Erro ao enviar para ZapSign:", error);
      toast.error("Erro ao enviar para ZapSign. Tente novamente.");
    } finally {
      setIsSendingToZapSign(false);
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

  const handleDownload = () => {
    if (generatedBlob) {
      downloadContractPDF(generatedBlob, formData.clientName);
    }
  };

  const handleNewContract = () => {
    setShowSuccessDialog(false);
    setGeneratedBlob(null);
    setFormData(defaultFormData);
    setEditableClauses(getDefaultEditableClauses());
    setZapSignSent(false);
    setLastGeneratedPdfUrl(null);
  };

  const handleContractClick = async (contract: SavedContract) => {
    setShowContractDialog(true);
    setSignatureStatus(null);

    // Always refetch the contract to avoid stale history list data
    const fresh = await fetchContractById(contract.id);
    const effective = fresh || contract;

    setSelectedContract(effective);
    setHistoryZapSignSent(!!effective.zapsign_document_token || !!effective.zapsign_sent_at);

    // If contract was sent to ZapSign, check current status
    if (effective.zapsign_document_token) {
      await checkSignatureStatus(effective.zapsign_document_token);
    }
  };

  const handleDeleteContract = async () => {
    if (!selectedContract || !canDeleteContracts) return;
    
    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir o contrato de ${selectedContract.client_name}? Esta ação não pode ser desfeita.`
    );
    
    if (!confirmDelete) return;
    
    setIsDeleting(true);
    try {
      // Delete PDF from storage if exists
      if (selectedContract.pdf_url) {
        const urlParts = selectedContract.pdf_url.split("/");
        const fileName = urlParts.slice(-2).join("/"); // "contracts/filename.pdf"
        await supabase.storage.from("contract-pdfs").remove([fileName]);
      }
      
      // Delete from database
      const { error } = await supabase
        .from("generated_contracts")
        .delete()
        .eq("id", selectedContract.id);
      
      if (error) throw error;
      
      toast.success("Contrato excluído com sucesso!");
      setShowContractDialog(false);
      setSelectedContract(null);
      loadContracts();
    } catch (error) {
      console.error("Erro ao excluir contrato:", error);
      toast.error("Erro ao excluir contrato. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewPDF = () => {
    if (selectedContract?.pdf_url) {
      window.open(selectedContract.pdf_url, "_blank");
    } else {
      toast.error("PDF não disponível para este contrato");
    }
  };

  const handleDownloadFromHistory = () => {
    if (selectedContract?.pdf_url) {
      const link = document.createElement("a");
      link.href = selectedContract.pdf_url;
      link.download = `contrato-${selectedContract.client_name}.pdf`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast.error("PDF não disponível para este contrato");
    }
  };

  const handleDuplicateContract = () => {
    if (!selectedContract) return;
    
    // Parse address parts from saved address if available
    // Address format: "Rua, nº 123, Bairro, Cidade - UF, CEP 00000-000"
    let addressParts = {
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      state: "",
      cep: "",
    };
    
    if (selectedContract.client_address) {
      const parts = selectedContract.client_address.split(", ");
      if (parts.length >= 5) {
        addressParts.street = parts[0] || "";
        const numberMatch = parts[1]?.match(/nº\s*(.+)/);
        addressParts.number = numberMatch ? numberMatch[1] : parts[1] || "";
        addressParts.neighborhood = parts[2] || "";
        // City - State format: "Cidade - UF"
        const cityStatePart = parts[3] || "";
        const cityStateMatch = cityStatePart.match(/(.+)\s*-\s*(.+)/);
        if (cityStateMatch) {
          addressParts.city = cityStateMatch[1].trim();
          addressParts.state = cityStateMatch[2].trim();
        } else {
          addressParts.city = cityStatePart;
        }
        const cepMatch = parts[4]?.match(/CEP\s*(.+)/);
        addressParts.cep = cepMatch ? cepMatch[1] : "";
      }
    }
    
    // Pre-fill form with all client and legal rep data, but clear contract/payment details
    setFormData({
      // Company/Client data - all filled
      clientName: selectedContract.client_name || "",
      clientDocument: selectedContract.client_document || "",
      clientCep: addressParts.cep,
      clientStreet: addressParts.street,
      clientNumber: addressParts.number,
      clientComplement: "",
      clientNeighborhood: addressParts.neighborhood,
      clientCity: addressParts.city,
      clientState: addressParts.state,
      clientEmail: selectedContract.client_email || "",
      clientPhone: selectedContract.client_phone || "",
      
      // Legal representative data - all filled
      legalRepName: selectedContract.legal_rep_name || "",
      legalRepCpf: selectedContract.legal_rep_cpf || "",
      legalRepRg: selectedContract.legal_rep_rg || "",
      legalRepMaritalStatus: selectedContract.legal_rep_marital_status || "",
      legalRepNationality: selectedContract.legal_rep_nationality || "brasileiro(a)",
      legalRepProfession: selectedContract.legal_rep_profession || "",
      
      // Contract data - EMPTY for user to fill new values
      productId: "",
      contractValue: 0,
      paymentMethod: "pix",
      installments: 1,
      isRecurring: false,
      dueDate: undefined,
      startDate: new Date(),
    });
    
    setShowContractDialog(false);
    setShowHistory(false);
    toast.success("Dados do cliente e responsável legal carregados. Preencha os dados do contrato.");
  };

  const handleEditContract = () => {
    if (!selectedContract) return;
    
    // Parse address parts from saved address if available
    let addressParts = {
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      state: "",
      cep: "",
    };
    
    if (selectedContract.client_address) {
      const parts = selectedContract.client_address.split(", ");
      if (parts.length >= 5) {
        addressParts.street = parts[0] || "";
        const numberMatch = parts[1]?.match(/nº\s*(.+)/);
        addressParts.number = numberMatch ? numberMatch[1] : parts[1] || "";
        addressParts.neighborhood = parts[2] || "";
        const cityStatePart = parts[3] || "";
        const cityStateMatch = cityStatePart.match(/(.+)\s*-\s*(.+)/);
        if (cityStateMatch) {
          addressParts.city = cityStateMatch[1].trim();
          addressParts.state = cityStateMatch[2].trim();
        } else {
          addressParts.city = cityStatePart;
        }
        const cepMatch = parts[4]?.match(/CEP\s*(.+)/);
        addressParts.cep = cepMatch ? cepMatch[1] : "";
      }
    }
    
    // Pre-fill form with ALL contract data for editing
    setFormData({
      clientName: selectedContract.client_name || "",
      clientDocument: selectedContract.client_document || "",
      clientCep: addressParts.cep,
      clientStreet: addressParts.street,
      clientNumber: addressParts.number,
      clientComplement: "",
      clientNeighborhood: addressParts.neighborhood,
      clientCity: addressParts.city,
      clientState: addressParts.state,
      clientEmail: selectedContract.client_email || "",
      clientPhone: selectedContract.client_phone || "",
      legalRepName: selectedContract.legal_rep_name || "",
      legalRepCpf: selectedContract.legal_rep_cpf || "",
      legalRepRg: selectedContract.legal_rep_rg || "",
      legalRepMaritalStatus: selectedContract.legal_rep_marital_status || "",
      legalRepNationality: selectedContract.legal_rep_nationality || "brasileiro(a)",
      legalRepProfession: selectedContract.legal_rep_profession || "",
      // Contract data - ALL filled for editing
      productId: selectedContract.product_id || "",
      contractValue: selectedContract.contract_value || 0,
      paymentMethod: (selectedContract.payment_method as "card" | "pix" | "boleto") || "pix",
      installments: selectedContract.installments || 1,
      isRecurring: selectedContract.is_recurring || false,
      dueDate: undefined,
      startDate: selectedContract.start_date ? new Date(selectedContract.start_date) : new Date(),
    });
    
    setShowContractDialog(false);
    setShowHistory(false);
    toast.success("Contrato carregado para edição. Faça as alterações necessárias e gere um novo PDF.");
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      card: "Cartão",
      pix: "PIX",
      boleto: "Boleto",
    };
    return labels[method] || method;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/onboarding-tasks")}
              >
                <Home className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Gerador de Contratos
                </h1>
                <p className="text-sm text-muted-foreground">
                  Gere contratos profissionais com valores por extenso
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
              className="gap-2"
            >
              <History className="h-4 w-4" />
              {showHistory ? "Novo Contrato" : "Histórico"}
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {showHistory ? (
          // History View
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Contratos Gerados</h2>
              <Button variant="ghost" size="sm" onClick={loadContracts} disabled={loadingHistory}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingHistory ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
            
            {savedContracts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum contrato gerado ainda.</p>
                  <Button 
                    variant="link" 
                    onClick={() => setShowHistory(false)}
                    className="mt-2"
                  >
                    Gerar primeiro contrato
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {savedContracts.map((contract) => (
                  <Card 
                    key={contract.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleContractClick(contract)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base font-medium line-clamp-1">
                          {contract.client_name}
                        </CardTitle>
                        <div className="flex gap-1">
                          {contract.pdf_url && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              PDF
                            </Badge>
                          )}
                          {contract.is_recurring && (
                            <Badge variant="secondary" className="text-xs">
                              Recorrente
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {contract.client_document}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-primary">
                          {contract.product_name}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrencyBR(contract.contract_value)}
                        </span>
                        <span>
                          {contract.is_recurring 
                            ? "Mensal" 
                            : `${contract.installments}x`}
                        </span>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(contract.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getPaymentMethodLabel(contract.payment_method)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Form View
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Form + Clauses Editor - 2 columns */}
            <div className="lg:col-span-2 space-y-6">
              <ContractForm
                formData={formData}
                onChange={setFormData}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
              />
              
              {/* Clauses Editor */}
              <ClausesEditor
                clauses={editableClauses}
                onChange={setEditableClauses}
              />
            </div>

            {/* Preview - 1 column */}
            <div className="lg:col-span-1">
              <div className="sticky top-6">
                <ContractPreview formData={formData} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Contrato Gerado com Sucesso!
            </DialogTitle>
            <DialogDescription>
              O contrato foi gerado e salvo no histórico. Você pode baixá-lo ou enviar para assinatura digital via ZapSign.
            </DialogDescription>
          </DialogHeader>
          
          {/* ZapSign Integration Section */}
          <div className="space-y-4 py-2">
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                Enviar para Assinatura Digital (ZapSign)
              </h4>
              
              {zapSignSent ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                  <CheckCircle2 className="h-4 w-4 inline mr-2" />
                  Contrato enviado! Os signatários receberão um e-mail com o link para assinatura.
                </div>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Contratada:</strong> {COMPANY_SIGNER_EMAIL}</p>
                    <p><strong>Contratante:</strong> {formData.clientEmail || "e-mail não informado"}</p>
                  </div>
                  
                  <Button
                    onClick={handleSendToZapSign}
                    disabled={isSendingToZapSign || !formData.clientEmail}
                    className="w-full"
                    variant="secondary"
                  >
                    {isSendingToZapSign ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Enviar para Assinatura
                      </>
                    )}
                  </Button>
                  
                  {!formData.clientEmail && (
                    <p className="text-xs text-destructive">
                      E-mail do cliente não informado no formulário.
                    </p>
                  )}
                </>
              )}
            </div>
            <Separator />
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleNewContract} className="flex-1">
              Novo Contrato
            </Button>
            <Button onClick={handleDownload} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Details Dialog */}
      <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Detalhes do Contrato
            </DialogTitle>
          </DialogHeader>
          
          {selectedContract && (
            <div className="space-y-5">
              {/* Contract Info Grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Cliente</p>
                  <p className="font-medium">{selectedContract.client_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Documento</p>
                  <p className="font-medium">{selectedContract.client_document}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Produto</p>
                  <p className="font-medium text-primary">{selectedContract.product_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Valor</p>
                  <p className="font-medium">{formatCurrencyBR(selectedContract.contract_value)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Pagamento</p>
                  <p className="font-medium">
                    {selectedContract.is_recurring 
                      ? "Recorrente Mensal" 
                      : `${selectedContract.installments}x`} via {getPaymentMethodLabel(selectedContract.payment_method)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Gerado em</p>
                  <p className="font-medium">
                    {format(new Date(selectedContract.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              
              {/* Action Buttons - Grouped in 2 rows */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleEditContract} 
                    className="w-full"
                    size="sm"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleDuplicateContract} 
                    className="w-full"
                    size="sm"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicar
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleViewPDF} 
                    className="w-full"
                    size="sm"
                    disabled={!selectedContract.pdf_url}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar
                  </Button>
                  <Button 
                    onClick={handleDownloadFromHistory} 
                    className="w-full"
                    size="sm"
                    disabled={!selectedContract.pdf_url}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar PDF
                  </Button>
                </div>
              </div>
              
              {!selectedContract.pdf_url && (
                <p className="text-xs text-muted-foreground text-center">
                  Este contrato foi gerado antes do armazenamento de PDFs.
                </p>
              )}

              {/* ZapSign Integration Section */}
              {selectedContract.pdf_url && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Send className="h-4 w-4 text-primary" />
                        Assinatura Digital (ZapSign)
                      </h4>
                      {selectedContract.zapsign_document_token && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => checkSignatureStatus(selectedContract.zapsign_document_token!)}
                          disabled={isLoadingSignatures}
                        >
                          <RefreshCw className={`h-3 w-3 ${isLoadingSignatures ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                    </div>
                    
                    {/* Signature Status Display */}
                    {isLoadingSignatures ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Verificando assinaturas...</span>
                      </div>
                    ) : signatureStatus ? (
                      <div className="space-y-3">
                        {/* Signers List */}
                        <div className="space-y-2">
                          {signatureStatus.signers.map((signer, index) => (
                            <div 
                              key={index} 
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                signer.status === 'signed' 
                                  ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900' 
                                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {signer.status === 'signed' ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Clock className="h-4 w-4 text-amber-600" />
                                )}
                                <div>
                                  <p className="text-sm font-medium">{signer.name}</p>
                                  <p className="text-xs text-muted-foreground">{signer.email}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                {signer.status === 'signed' ? (
                                  <Badge variant="default" className="bg-green-600">
                                    Assinado
                                  </Badge>
                                ) : (
                                  <div className="flex flex-col items-end gap-1">
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                      Pendente
                                    </Badge>
                                    {signer.signUrl && (
                                      <a
                                        href={signer.signUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                      >
                                        Link para assinar
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* All Signed - Download Button */}
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
                                  `${selectedContract.product_name} - ${selectedContract.client_name}.pdf`
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
                    ) : selectedContract.zapsign_document_token ? (
                      <div className="text-sm text-muted-foreground text-center py-2">
                        Contrato enviado para assinatura em{" "}
                        {selectedContract.zapsign_sent_at 
                          ? format(new Date(selectedContract.zapsign_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : "data desconhecida"
                        }
                      </div>
                    ) : historyZapSignSent ? (
                      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-3 text-sm text-green-800 dark:text-green-300">
                        <CheckCircle2 className="h-4 w-4 inline mr-2" />
                        Contrato enviado! Os signatários receberão um e-mail.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p><strong>Contratada:</strong> {COMPANY_SIGNER_EMAIL}</p>
                          <p><strong>Contratante:</strong> {selectedContract.client_email || "E-mail não informado"}</p>
                        </div>
                        
                        <Button
                          onClick={handleSendToZapSignFromHistory}
                          disabled={isSendingToZapSign || !selectedContract.client_email}
                          className="w-full"
                          size="sm"
                        >
                          {isSendingToZapSign ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Enviar para Assinatura
                            </>
                          )}
                        </Button>
                        
                        {!selectedContract.client_email && (
                          <p className="text-xs text-destructive">
                            E-mail do cliente não foi informado neste contrato.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {/* Delete Button - Only for Fabrício */}
              {canDeleteContracts && (
                <>
                  <Separator />
                  <Button
                    variant="destructive"
                    onClick={handleDeleteContract}
                    disabled={isDeleting}
                    className="w-full"
                    size="sm"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir Contrato
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
