import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Sparkles, RefreshCw, Download, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoUnv from "@/assets/logo-unv.png";

interface AssessmentAIReportGeneratorProps {
  cycleId: string;
  cycleTitle: string;
  projectId?: string;
}

export function AssessmentAIReportGenerator({
  cycleId,
  cycleTitle,
  projectId,
}: AssessmentAIReportGeneratorProps) {
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const generateReport = async () => {
    setLoading(true);
    setReport("");
    setIsOpen(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assessment-ai-report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ cycleId, cycleTitle, projectId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
          setIsOpen(false);
          return;
        }
        if (response.status === 402) {
          toast.error("Créditos insuficientes. Por favor, adicione créditos.");
          setIsOpen(false);
          return;
        }
        throw new Error(errorData.error || "Erro ao gerar relatório");
      }

      if (!response.body) {
        throw new Error("Resposta sem corpo");
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              fullContent += content;
              setReport(fullContent);
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const lines = buffer.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              fullContent += content;
              setReport(fullContent);
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      toast.success("Relatório gerado com sucesso!");
    } catch (error: any) {
      console.error("Error generating report:", error);
      toast.error("Erro ao gerar relatório: " + error.message);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!reportRef.current || !report) return;

    setGeneratingPDF(true);

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // Colors
      const primaryColor: [number, number, number] = [10, 34, 64];
      const textColor: [number, number, number] = [51, 51, 51];
      const mutedColor: [number, number, number] = [107, 114, 128];

      // Helper function to check page break
      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
          return true;
        }
        return false;
      };

      // Helper function to wrap text
      const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
        pdf.setFontSize(fontSize);
        return pdf.splitTextToSize(text, maxWidth);
      };

      // Load and add logo
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = logoUnv;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      if (img.complete && img.naturalWidth > 0) {
        const logoWidth = 50;
        const logoHeight = (img.naturalHeight / img.naturalWidth) * logoWidth;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth * 2;
        canvas.height = img.naturalHeight * 2;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.scale(2, 2);
          ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
        }
        const logoDataUrl = canvas.toDataURL("image/png", 1.0);
        pdf.addImage(logoDataUrl, "PNG", (pageWidth - logoWidth) / 2, y, logoWidth, logoHeight);
        y += logoHeight + 10;
      }

      // Title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(...primaryColor);
      const title = "Relatório de Avaliações";
      pdf.text(title, pageWidth / 2, y, { align: "center" });
      y += 8;

      // Subtitle
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      pdf.setTextColor(...mutedColor);
      pdf.text(cycleTitle, pageWidth / 2, y, { align: "center" });
      y += 6;

      // Date
      pdf.setFontSize(10);
      const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      pdf.text(dateStr, pageWidth / 2, y, { align: "center" });
      y += 15;

      // Divider
      pdf.setDrawColor(...primaryColor);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Parse markdown and render
      const lines = report.split("\n");
      
      for (const line of lines) {
        if (!line.trim()) {
          y += 4;
          continue;
        }

        // Headers
        if (line.startsWith("## ")) {
          checkPageBreak(15);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(14);
          pdf.setTextColor(...primaryColor);
          const headerText = line.replace("## ", "").replace(/[📊🧠🎯🌡️💡📈]/g, "").trim();
          const wrappedHeader = wrapText(headerText, contentWidth, 14);
          wrappedHeader.forEach((textLine) => {
            checkPageBreak(8);
            pdf.text(textLine, margin, y);
            y += 7;
          });
          y += 3;
          continue;
        }

        // Subheaders
        if (line.startsWith("### ")) {
          checkPageBreak(12);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(12);
          pdf.setTextColor(...textColor);
          const subHeaderText = line.replace("### ", "").trim();
          pdf.text(subHeaderText, margin, y);
          y += 7;
          continue;
        }

        // Bold text
        if (line.startsWith("**") && line.endsWith("**")) {
          checkPageBreak(8);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.setTextColor(...textColor);
          const boldText = line.replace(/\*\*/g, "");
          const wrappedBold = wrapText(boldText, contentWidth, 11);
          wrappedBold.forEach((textLine) => {
            checkPageBreak(6);
            pdf.text(textLine, margin, y);
            y += 6;
          });
          continue;
        }

        // List items
        if (line.startsWith("- ") || line.startsWith("* ") || /^\d+\.\s/.test(line)) {
          checkPageBreak(8);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          pdf.setTextColor(...textColor);
          const listText = line.replace(/^[-*]\s|^\d+\.\s/, "• ");
          const wrappedList = wrapText(listText, contentWidth - 5, 10);
          wrappedList.forEach((textLine, idx) => {
            checkPageBreak(5);
            pdf.text(idx === 0 ? textLine : `  ${textLine}`, margin + 3, y);
            y += 5;
          });
          continue;
        }

        // Regular paragraph
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(...textColor);
        const cleanedLine = line.replace(/\*\*/g, "").replace(/\*/g, "");
        const wrappedParagraph = wrapText(cleanedLine, contentWidth, 10);
        wrappedParagraph.forEach((textLine) => {
          checkPageBreak(5);
          pdf.text(textLine, margin, y);
          y += 5;
        });
        y += 2;
      }

      // Footer
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(...mutedColor);
        pdf.text(
          `Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
        pdf.text(
          "Gerado por UNV Soluções",
          margin,
          pageHeight - 10
        );
      }

      const filename = `Relatorio_Avaliacoes_${cycleTitle.replace(/\s+/g, "_")}_${format(new Date(), "dd-MM-yyyy")}.pdf`;
      pdf.save(filename);
      toast.success("PDF baixado com sucesso!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={generateReport}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Relatório IA
          </>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Relatório de Avaliações - {cycleTitle}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {report && !loading && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={generatePDF}
                    disabled={generatingPDF}
                    className="gap-2"
                  >
                    {generatingPDF ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Gerando PDF...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Baixar PDF
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden p-6">
            {loading && !report && (
              <div className="flex flex-col items-center justify-center h-full">
                <RefreshCw className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Analisando dados das avaliações...</p>
                <p className="text-xs text-muted-foreground mt-2">Isso pode levar alguns segundos</p>
              </div>
            )}

            {report && (
              <ScrollArea className="h-full">
                <div ref={reportRef} className="pr-4">
                  <div
                    className={cn(
                      "prose prose-sm max-w-none dark:prose-invert",
                      "prose-headings:text-foreground prose-headings:font-semibold",
                      "prose-p:text-muted-foreground prose-p:leading-relaxed",
                      "prose-li:text-muted-foreground",
                      "prose-strong:text-foreground",
                      "prose-ul:my-2 prose-ol:my-2",
                      "[&>h2]:text-lg [&>h2]:mt-6 [&>h2]:mb-3 [&>h2]:pb-2 [&>h2]:border-b",
                      "[&>h3]:text-base [&>h3]:mt-4 [&>h3]:mb-2"
                    )}
                  >
                    <ReactMarkdown>{report}</ReactMarkdown>
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
