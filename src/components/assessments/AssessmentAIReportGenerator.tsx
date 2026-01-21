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

      // Enhanced Color Palette
      const primaryNavy: [number, number, number] = [10, 34, 64];
      const accentGold: [number, number, number] = [212, 175, 55];
      const accentTeal: [number, number, number] = [0, 128, 128];
      const softBlue: [number, number, number] = [70, 130, 180];
      const textDark: [number, number, number] = [33, 37, 41];
      const textMuted: [number, number, number] = [108, 117, 125];
      const bgLight: [number, number, number] = [248, 249, 250];
      const successGreen: [number, number, number] = [40, 167, 69];
      const warningOrange: [number, number, number] = [255, 153, 0];

      // Helper function to check page break
      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - 25) {
          pdf.addPage();
          addPageDecoration();
          y = 25;
          return true;
        }
        return false;
      };

      // Helper function to wrap text
      const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
        pdf.setFontSize(fontSize);
        return pdf.splitTextToSize(text, maxWidth);
      };

      // Add page decoration (header line)
      const addPageDecoration = () => {
        // Top accent bar
        pdf.setFillColor(...primaryNavy);
        pdf.rect(0, 0, pageWidth, 8, "F");
        pdf.setFillColor(...accentGold);
        pdf.rect(0, 8, pageWidth, 2, "F");
      };

      // Add initial page decoration
      addPageDecoration();
      y = 18;

      // Load and add logo
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = logoUnv;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      if (img.complete && img.naturalWidth > 0) {
        const logoWidth = 55;
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
        y += logoHeight + 8;
      }

      // Main Title with gradient effect simulation
      pdf.setFillColor(...bgLight);
      pdf.roundedRect(margin - 5, y - 2, contentWidth + 10, 22, 3, 3, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.setTextColor(...primaryNavy);
      pdf.text("RELATÓRIO EXECUTIVO", pageWidth / 2, y + 8, { align: "center" });
      pdf.setFontSize(12);
      pdf.setTextColor(...accentTeal);
      pdf.text("Avaliações de Desempenho", pageWidth / 2, y + 16, { align: "center" });
      y += 28;

      // Cycle title badge
      pdf.setFillColor(...primaryNavy);
      const cycleTextWidth = pdf.getTextWidth(cycleTitle) + 20;
      pdf.roundedRect((pageWidth - cycleTextWidth) / 2, y - 4, cycleTextWidth, 10, 2, 2, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(255, 255, 255);
      pdf.text(cycleTitle, pageWidth / 2, y + 2, { align: "center" });
      y += 12;

      // Date with icon simulation
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...textMuted);
      const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      pdf.text(`📅 ${dateStr}`, pageWidth / 2, y, { align: "center" });
      y += 12;

      // Decorative divider
      pdf.setDrawColor(...accentGold);
      pdf.setLineWidth(1);
      pdf.line(margin + 20, y, pageWidth - margin - 20, y);
      pdf.setFillColor(...accentGold);
      pdf.circle(margin + 20, y, 1.5, "F");
      pdf.circle(pageWidth - margin - 20, y, 1.5, "F");
      y += 12;

      // Parse markdown and render with enhanced styling
      const lines = report.split("\n");
      let sectionIndex = 0;
      const sectionColors: [number, number, number][] = [
        primaryNavy, accentTeal, softBlue, successGreen, warningOrange
      ];
      
      for (const line of lines) {
        if (!line.trim()) {
          y += 3;
          continue;
        }

        // Main Section Headers (## )
        if (line.startsWith("## ")) {
          checkPageBreak(20);
          const currentColor = sectionColors[sectionIndex % sectionColors.length];
          sectionIndex++;
          
          // Section header with colored background
          pdf.setFillColor(...currentColor);
          pdf.roundedRect(margin, y - 2, contentWidth, 12, 2, 2, "F");
          
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(13);
          pdf.setTextColor(255, 255, 255);
          const headerText = line.replace("## ", "").replace(/[📊🧠🎯🌡️💡📈🔍✅⚠️💬]/g, "").trim();
          pdf.text(headerText.toUpperCase(), margin + 5, y + 6);
          y += 16;
          continue;
        }

        // Subheaders (### )
        if (line.startsWith("### ")) {
          checkPageBreak(14);
          pdf.setFillColor(...bgLight);
          pdf.rect(margin, y - 2, contentWidth, 9, "F");
          pdf.setDrawColor(...accentGold);
          pdf.setLineWidth(0.5);
          pdf.line(margin, y - 2, margin, y + 7);
          
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.setTextColor(...primaryNavy);
          const subHeaderText = line.replace("### ", "").trim();
          pdf.text(subHeaderText, margin + 4, y + 4);
          y += 12;
          continue;
        }

        // Bold text blocks
        if (line.startsWith("**") && line.endsWith("**")) {
          checkPageBreak(10);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.setTextColor(...textDark);
          const boldText = line.replace(/\*\*/g, "");
          const wrappedBold = wrapText(boldText, contentWidth - 10, 10);
          wrappedBold.forEach((textLine) => {
            checkPageBreak(6);
            pdf.text(textLine, margin + 2, y);
            y += 5;
          });
          y += 2;
          continue;
        }

        // List items with colored bullets
        if (line.startsWith("- ") || line.startsWith("* ") || /^\d+\.\s/.test(line)) {
          checkPageBreak(8);
          
          // Colored bullet
          pdf.setFillColor(...accentTeal);
          pdf.circle(margin + 3, y - 1.5, 1.2, "F");
          
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          pdf.setTextColor(...textDark);
          const listText = line.replace(/^[-*]\s|^\d+\.\s/, "");
          const wrappedList = wrapText(listText, contentWidth - 12, 10);
          wrappedList.forEach((textLine, idx) => {
            checkPageBreak(5);
            pdf.text(textLine, margin + 8, y);
            y += 5;
          });
          y += 1;
          continue;
        }

        // Regular paragraph with inline bold handling
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(...textDark);
        let cleanedLine = line.replace(/\*\*/g, "").replace(/\*/g, "");
        const wrappedParagraph = wrapText(cleanedLine, contentWidth, 10);
        wrappedParagraph.forEach((textLine) => {
          checkPageBreak(5);
          pdf.text(textLine, margin, y);
          y += 5;
        });
        y += 2;
      }

      // Footer for all pages
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        
        // Bottom accent bar
        pdf.setFillColor(...primaryNavy);
        pdf.rect(0, pageHeight - 15, pageWidth, 15, "F");
        pdf.setFillColor(...accentGold);
        pdf.rect(0, pageHeight - 15, pageWidth, 1, "F");
        
        // Footer text
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.text(
          `Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 6,
          { align: "center" }
        );
        pdf.text(
          "Universidade Nacional de Vendas",
          margin,
          pageHeight - 6
        );
        pdf.text(
          "www.unvholdings.com.br",
          pageWidth - margin,
          pageHeight - 6,
          { align: "right" }
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
