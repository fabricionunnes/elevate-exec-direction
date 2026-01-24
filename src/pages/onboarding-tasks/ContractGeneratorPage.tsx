import { useState } from "react";
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
import { ArrowLeft, FileText, Download, CheckCircle2, Home } from "lucide-react";
import { toast } from "sonner";
import ContractForm, { type ContractFormData } from "@/components/contract-generator/ContractForm";
import ContractPreview from "@/components/contract-generator/ContractPreview";
import { generateContractPDF, downloadContractPDF } from "@/components/contract-generator/generateContractPDF";

export default function ContractGeneratorPage() {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const [formData, setFormData] = useState<ContractFormData>({
    clientName: "",
    clientDocument: "",
    clientAddress: "",
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
    dueDate: undefined,
    startDate: new Date(),
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const blob = await generateContractPDF({ formData });
      setGeneratedBlob(blob);
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
    setFormData({
      clientName: "",
      clientDocument: "",
      clientAddress: "",
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
      dueDate: undefined,
      startDate: new Date(),
    });
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
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
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
              O contrato foi gerado e está pronto para download.
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
    </div>
  );
}
