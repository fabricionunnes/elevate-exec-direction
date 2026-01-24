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
import { ArrowLeft, FileText, Download, CheckCircle2, Home, History, Eye, Calendar, DollarSign, RefreshCw, Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import ContractForm, { type ContractFormData } from "@/components/contract-generator/ContractForm";
import ContractPreview from "@/components/contract-generator/ContractPreview";
import { generateContractPDF, downloadContractPDF } from "@/components/contract-generator/generateContractPDF";
import { productDetails } from "@/data/productDetails";
import { formatCurrencyBR } from "@/lib/numberToWords";

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

  const [formData, setFormData] = useState<ContractFormData>(defaultFormData);

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

  const saveContract = async (pdfUrl: string | null) => {
    try {
      const selectedProduct = productDetails[formData.productId];
      
      const { error } = await supabase
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
        });

      if (error) throw error;
      
      // Reload contracts list
      loadContracts();
    } catch (error) {
      console.error("Erro ao salvar contrato:", error);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const blob = await generateContractPDF({ formData });
      setGeneratedBlob(blob);
      
      // Upload PDF to storage
      const pdfUrl = await uploadPDF(blob, formData.clientName);
      
      // Save contract to database with PDF URL
      await saveContract(pdfUrl);
      
      setShowSuccessDialog(true);
      toast.success("Contrato gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar contrato:", error);
      toast.error("Erro ao gerar o contrato. Tente novamente.");
    } finally {
      setIsGenerating(false);
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
  };

  const handleContractClick = (contract: SavedContract) => {
    setSelectedContract(contract);
    setShowContractDialog(true);
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
                onClick={() => navigate("/")}
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
            {/* Form - 2 columns */}
            <div className="lg:col-span-2">
              <ContractForm
                formData={formData}
                onChange={setFormData}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Contrato Gerado com Sucesso!
            </DialogTitle>
            <DialogDescription>
              O contrato foi gerado e salvo no histórico. Você pode baixá-lo agora ou acessá-lo depois.
            </DialogDescription>
          </DialogHeader>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Detalhes do Contrato
            </DialogTitle>
          </DialogHeader>
          
          {selectedContract && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedContract.client_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Documento</p>
                  <p className="font-medium">{selectedContract.client_document}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Produto</p>
                  <p className="font-medium text-primary">{selectedContract.product_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor</p>
                  <p className="font-medium">{formatCurrencyBR(selectedContract.contract_value)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pagamento</p>
                  <p className="font-medium">
                    {selectedContract.is_recurring 
                      ? "Recorrente Mensal" 
                      : `${selectedContract.installments}x`} via {getPaymentMethodLabel(selectedContract.payment_method)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gerado em</p>
                  <p className="font-medium">
                    {format(new Date(selectedContract.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleEditContract} 
                  className="flex-1"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={handleDuplicateContract} 
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleViewPDF} 
                  className="flex-1"
                  disabled={!selectedContract.pdf_url}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Visualizar
                </Button>
                <Button 
                  onClick={handleDownloadFromHistory} 
                  className="flex-1"
                  disabled={!selectedContract.pdf_url}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar PDF
                </Button>
              </DialogFooter>
              
              {!selectedContract.pdf_url && (
                <p className="text-xs text-muted-foreground text-center">
                  Este contrato foi gerado antes do armazenamento de PDFs. Gere um novo contrato para ter acesso ao PDF.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
