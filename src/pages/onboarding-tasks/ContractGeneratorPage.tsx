import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileText, Download, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ContractForm, { type ContractFormData } from "@/components/contract-generator/ContractForm";
import ContractPreview from "@/components/contract-generator/ContractPreview";
import { generateContractPDF, downloadContractPDF } from "@/components/contract-generator/generateContractPDF";
import { format } from "date-fns";

interface Company {
  id: string;
  name: string;
}

export default function ContractGeneratorPage() {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<ContractFormData>({
    clientName: "",
    clientDocument: "",
    clientAddress: "",
    clientEmail: "",
    clientPhone: "",
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

  const handleOpenSaveDialog = async () => {
    setShowSuccessDialog(false);
    
    // Fetch companies for the dropdown
    try {
      const { data, error } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Erro ao carregar empresas:", error);
      toast.error("Erro ao carregar lista de empresas");
    }
    
    setShowSaveDialog(true);
  };

  const handleSaveToSystem = async () => {
    if (!generatedBlob || !selectedCompanyId) {
      toast.error("Selecione uma empresa para vincular o contrato");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado para salvar contratos");
        return;
      }

      // Generate unique filename
      const timestamp = format(new Date(), "yyyy-MM-dd_HHmmss");
      const fileName = `contrato_${formData.clientName.replace(/\s+/g, "_")}_${timestamp}.pdf`;
      const filePath = `${selectedCompanyId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("onboarding-documents")
        .upload(filePath, generatedBlob, {
          contentType: "application/pdf",
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("onboarding-documents")
        .getPublicUrl(filePath);

      // Save to documents table
      const { error: insertError } = await supabase
        .from("onboarding_documents")
        .insert({
          company_id: selectedCompanyId,
          file_name: fileName,
          file_path: filePath,
          file_size: generatedBlob.size,
          file_type: "application/pdf",
          category: "contract",
          description: `Contrato ${formData.productId} - ${formData.clientName}`,
          uploaded_by: user.id,
        });

      if (insertError) throw insertError;

      toast.success("Contrato salvo com sucesso!");
      setShowSaveDialog(false);
      setGeneratedBlob(null);
      setSelectedCompanyId("");
    } catch (error) {
      console.error("Erro ao salvar contrato:", error);
      toast.error("Erro ao salvar o contrato. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/onboarding/companies")}
            >
              <ArrowLeft className="h-5 w-5" />
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
              O contrato foi gerado e está pronto. O que deseja fazer?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleDownload} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
            <Button onClick={handleOpenSaveDialog} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              Salvar no Sistema
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save to System Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Contrato no Sistema</DialogTitle>
            <DialogDescription>
              Selecione a empresa para vincular este contrato
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="company">Empresa</Label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione uma empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                handleDownload();
                setShowSaveDialog(false);
              }}
            >
              Apenas Baixar
            </Button>
            <Button
              onClick={handleSaveToSystem}
              disabled={!selectedCompanyId || isSaving}
            >
              {isSaving ? "Salvando..." : "Salvar e Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
