import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code2, DollarSign, Target, Briefcase, MessageSquare, Video, BarChart3, LayoutGrid, Download, Loader2 } from "lucide-react";
import { FinancialApiDocs } from "@/components/financial-api/FinancialApiDocs";
import { CrmApiDocs } from "@/components/financial-api/CrmApiDocs";
import { ProductApiDocs } from "@/components/financial-api/ProductApiDocs";
import { ConversationsApiDocs } from "@/components/financial-api/ConversationsApiDocs";
import { ProjectMeetingsApiDocs } from "@/components/financial-api/ProjectMeetingsApiDocs";
import { CRMTrafficApiDocs } from "@/components/crm/traffic/CRMTrafficApiDocs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

export default function ApiDocsPage() {
  const navigate = useNavigate();
  const allRef = useRef<HTMLDivElement>(null);
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState("");

  const preparePdf = useCallback(async () => {
    const element = allRef.current;
    if (!element) return;
    setDownloading(true);
    try {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: element.scrollWidth,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const date = new Date().toISOString().split("T")[0];
      const filename = `documentacao-api-unv-nexus-${date}.pdf`;
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfFilename(filename);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setDownloading(false);
    }
  }, [pdfUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void preparePdf();
    }, 400);

    return () => {
      window.clearTimeout(timer);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, []);

  const handleDownloadPdf = async () => {
    if (pdfUrl && downloadLinkRef.current) {
      downloadLinkRef.current.click();
      toast.success("Download iniciado.");
      return;
    }

    toast.info("Preparando PDF, aguarde...");
    await preparePdf();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/onboarding-tasks")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Nexus
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Documentação da API
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="all" className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <TabsList className="grid w-full max-w-5xl grid-cols-4 sm:grid-cols-7 h-auto">
              <TabsTrigger value="all" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Geral</span>
              </TabsTrigger>
              <TabsTrigger value="financial" className="gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Financeiro</span>
              </TabsTrigger>
              <TabsTrigger value="crm" className="gap-2">
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">CRM Comercial</span>
              </TabsTrigger>
              <TabsTrigger value="traffic" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Tráfego Pago</span>
              </TabsTrigger>
              <TabsTrigger value="project_meetings" className="gap-2">
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">Reuniões</span>
              </TabsTrigger>
              <TabsTrigger value="product" className="gap-2">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Produto</span>
              </TabsTrigger>
              <TabsTrigger value="conversations" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Conversas</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="space-y-4">
            <div className="flex justify-end">
              <a ref={downloadLinkRef} href={pdfUrl ?? undefined} download={pdfFilename} className="hidden" aria-hidden="true" />
              <Button onClick={handleDownloadPdf} disabled={downloading || !pdfUrl} size="sm">
                {downloading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Preparando PDF...</>
                ) : (
                  <><Download className="h-4 w-4 mr-2" /> Baixar documentação completa (PDF)</>
                )}
              </Button>
            </div>
            <div ref={allRef} className="space-y-12 bg-background p-4">
              <section><FinancialApiDocs /></section>
              <section><CrmApiDocs /></section>
              <section><CRMTrafficApiDocs /></section>
              <section><ProjectMeetingsApiDocs /></section>
              <section><ProductApiDocs /></section>
              <section><ConversationsApiDocs /></section>
            </div>
          </TabsContent>

          <TabsContent value="financial">
            <FinancialApiDocs />
          </TabsContent>

          <TabsContent value="crm">
            <CrmApiDocs />
          </TabsContent>

          <TabsContent value="product">
            <ProductApiDocs />
          </TabsContent>

          <TabsContent value="traffic">
            <CRMTrafficApiDocs />
          </TabsContent>

          <TabsContent value="project_meetings">
            <ProjectMeetingsApiDocs />
          </TabsContent>

          <TabsContent value="conversations">
            <ConversationsApiDocs />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
