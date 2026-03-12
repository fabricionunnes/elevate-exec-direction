import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Eye, Loader2, FileText, History, Send, ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import DistratoForm, { defaultDistrato, type DistratoFormData } from "@/components/distrato/DistratoForm";
import DistratoClausesEditor, { getDefaultDistratoClauses, type EditableDistratoClause } from "@/components/distrato/DistratoClausesEditor";
import { generateDistratoPDF, downloadDistratoPDF } from "@/components/distrato/generateDistratoPDF";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ZapSignResult {
  documentToken: string;
  documentUrl: string;
  signers: { name: string; email: string; signUrl: string; status: string }[];
}

export default function DistratoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preCompanyId = searchParams.get("company_id") || undefined;
  const preProjectId = searchParams.get("project_id") || undefined;

  const [formData, setFormData] = useState<DistratoFormData>(defaultDistrato);
  const [clauses, setClauses] = useState<EditableDistratoClause[]>(getDefaultDistratoClauses());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [savedDistratoId, setSavedDistratoId] = useState<string | null>(null);

  // ZapSign state
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerPhone, setSignerPhone] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [zapSignResult, setZapSignResult] = useState<ZapSignResult | null>(null);

  const uploadPdfToStorage = async (blob: Blob): Promise<string | null> => {
    try {
      const fileName = `distratos/${Date.now()}_${formData.companyName.replace(/\s+/g, "_")}.pdf`;
      const { error } = await supabase.storage
        .from("contract-pdfs")
        .upload(fileName, blob, { contentType: "application/pdf", upsert: false });
      if (error) {
        console.error("Upload error:", error);
        return null;
      }
      const { data: publicUrl } = supabase.storage.from("contract-pdfs").getPublicUrl(fileName);
      return publicUrl.publicUrl;
    } catch (e) {
      console.error("Upload error:", e);
      return null;
    }
  };

  const handleGenerate = async () => {
    if (!formData.companyName) {
      toast.error("Selecione uma empresa");
      return;
    }
    setIsGenerating(true);
    try {
      const blob = await generateDistratoPDF({ formData, clauses });
      setGeneratedBlob(blob);
      setZapSignResult(null);

      // Upload PDF to storage
      const pdfUrl = await uploadPdfToStorage(blob);

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      const { data: saved } = await supabase.from("distratos").insert({
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
        pdf_url: pdfUrl,
      }).select("id").single();

      if (saved) setSavedDistratoId(saved.id);

      // Pre-fill signer with legal rep info
      if (formData.legalRepName && !signerName) {
        setSignerName(formData.legalRepName);
      }

      toast.success("Distrato gerado e salvo com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar distrato");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendToZapSign = async () => {
    if (!signerName || !signerEmail) {
      toast.error("Preencha o nome e e-mail do signatário");
      return;
    }
    if (!generatedBlob) {
      toast.error("Gere o distrato primeiro");
      return;
    }

    setIsSending(true);
    try {
      // Make sure we have a PDF URL
      let pdfUrl: string | null = null;
      if (savedDistratoId) {
        const { data } = await supabase.from("distratos").select("pdf_url").eq("id", savedDistratoId).single();
        pdfUrl = data?.pdf_url || null;
      }
      if (!pdfUrl) {
        pdfUrl = await uploadPdfToStorage(generatedBlob);
        if (savedDistratoId && pdfUrl) {
          await supabase.from("distratos").update({ pdf_url: pdfUrl }).eq("id", savedDistratoId);
        }
      }
      if (!pdfUrl) {
        toast.error("Erro ao fazer upload do PDF");
        return;
      }

      const documentName = `Distrato - ${formData.companyName} - ${format(formData.distratoDate, "dd-MM-yyyy")}`;

      const { data: zapData, error: zapError } = await supabase.functions.invoke("send-to-zapsign", {
        body: {
          pdfUrl,
          documentName,
          signers: [
            { name: "Fabrício Nunnes", email: "fabricio@universidadevendas.com.br" },
            { name: signerName, email: signerEmail, phone: signerPhone || undefined },
          ],
          sendAutomatically: true,
        },
      });

      if (zapError) throw zapError;

      setZapSignResult(zapData);

      // Update distrato with ZapSign info
      if (savedDistratoId) {
        await supabase.from("distratos").update({
          zapsign_document_token: zapData.documentToken,
          zapsign_document_url: zapData.documentUrl,
          zapsign_signers: zapData.signers,
          zapsign_sent_at: new Date().toISOString(),
        }).eq("id", savedDistratoId);
      }

      toast.success("Distrato enviado para assinatura via ZapSign!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao enviar para ZapSign");
    } finally {
      setIsSending(false);
    }
  };

  const handleDownload = () => {
    if (generatedBlob) downloadDistratoPDF(generatedBlob, formData.companyName);
  };

  const handlePreview = () => {
    if (generatedBlob) {
      const url = URL.createObjectURL(generatedBlob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copiado!");
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

        {/* ZapSign Section - Only show after PDF is generated */}
        {generatedBlob && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4" /> Enviar para Assinatura (ZapSign)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!zapSignResult ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Preencha os dados do signatário do contratante para enviar o distrato via ZapSign.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Nome do Signatário</Label>
                      <Input
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <Label>E-mail</Label>
                      <Input
                        type="email"
                        value={signerEmail}
                        onChange={(e) => setSignerEmail(e.target.value)}
                        placeholder="email@empresa.com"
                      />
                    </div>
                    <div>
                      <Label>Telefone (opcional)</Label>
                      <Input
                        value={signerPhone}
                        onChange={(e) => setSignerPhone(e.target.value)}
                        placeholder="(31) 99999-9999"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleSendToZapSign}
                    disabled={isSending}
                    className="gap-2"
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar para ZapSign
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Documento enviado com sucesso!</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(zapSignResult.documentUrl, "_blank")}
                      className="gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Ver no ZapSign
                    </Button>
                  </div>

                  {zapSignResult.signers?.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Links de assinatura:</Label>
                      {zapSignResult.signers.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="font-medium min-w-[120px]">{s.name}:</span>
                          {s.signUrl ? (
                            <>
                              <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[300px]">
                                {s.signUrl}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(s.signUrl)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => window.open(s.signUrl, "_blank")}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-muted-foreground">E-mail enviado</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
