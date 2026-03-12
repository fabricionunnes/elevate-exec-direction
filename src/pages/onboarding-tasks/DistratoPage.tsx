import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Eye, Loader2, FileText, History } from "lucide-react";
import { toast } from "sonner";
import DistratoForm, { defaultDistrato, type DistratoFormData } from "@/components/distrato/DistratoForm";
import DistratoClausesEditor, { getDefaultDistratoClauses, type EditableDistratoClause } from "@/components/distrato/DistratoClausesEditor";
import { generateDistratoPDF, downloadDistratoPDF } from "@/components/distrato/generateDistratoPDF";
import { supabase } from "@/integrations/supabase/client";

export default function DistratoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preCompanyId = searchParams.get("company_id") || undefined;
  const preProjectId = searchParams.get("project_id") || undefined;

  const [formData, setFormData] = useState<DistratoFormData>(defaultDistrato);
  const [clauses, setClauses] = useState<EditableDistratoClause[]>(getDefaultDistratoClauses());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);

  const handleGenerate = async () => {
    if (!formData.companyName) {
      toast.error("Selecione uma empresa");
      return;
    }
    setIsGenerating(true);
    try {
      const blob = await generateDistratoPDF({ formData, clauses });
      setGeneratedBlob(blob);

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("distratos").insert({
        company_id: formData.companyId || null,
        company_name: formData.companyName,
        company_cnpj: formData.companyCnpj || null,
        company_address: formData.companyAddress || null,
        legal_rep_name: formData.legalRepName || null,
        project_id: formData.projectId || null,
        project_name: formData.projectName || null,
        contract_date: formData.contractDate || null,
        service_description: formData.serviceDescription || null,
        distrato_date: formData.distratoDate.toISOString().split("T")[0],
        additional_notes: formData.additionalNotes || null,
        clauses_snapshot: clauses as any,
        created_by: user?.id || null,
      });

      toast.success("Distrato gerado e salvo com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar distrato");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (generatedBlob) {
      downloadDistratoPDF(generatedBlob, formData.companyName);
    }
  };

  const handlePreview = () => {
    if (generatedBlob) {
      const url = URL.createObjectURL(generatedBlob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/contratos")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Distrato de Contrato
              </h1>
              <p className="text-sm text-muted-foreground">Gere o documento de rescisão contratual</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/distratos")} className="gap-2">
              <History className="h-4 w-4" /> Histórico
            </Button>
            {generatedBlob && (
              <>
                <Button variant="outline" onClick={handlePreview} className="gap-2">
                  <Eye className="h-4 w-4" /> Visualizar
                </Button>
                <Button variant="outline" onClick={handleDownload} className="gap-2">
                  <Download className="h-4 w-4" /> Baixar PDF
                </Button>
              </>
            )}
            <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {generatedBlob ? "Regerar" : "Gerar Distrato"}
            </Button>
          </div>
        </div>

        {/* Form */}
        <DistratoForm
          formData={formData}
          onChange={setFormData}
          preSelectedCompanyId={preCompanyId}
          preSelectedProjectId={preProjectId}
        />

        {/* Clauses Editor */}
        <DistratoClausesEditor clauses={clauses} onChange={setClauses} />
      </div>
    </div>
  );
}
