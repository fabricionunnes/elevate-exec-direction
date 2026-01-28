import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import type { PresentationSlide, SlideContent } from "./types";

// UNV Brand colors
const UNV_BLUE_RGB: [number, number, number] = [30, 58, 95];
const UNV_RED_RGB: [number, number, number] = [230, 57, 70];

interface PresentationPDFExportProps {
  slides: PresentationSlide[];
  companyName: string;
  title: string;
  meetingDate?: string;
}

export function PresentationPDFExport({
  slides,
  companyName,
  title,
  meetingDate,
}: PresentationPDFExportProps) {
  const [exporting, setExporting] = useState(false);

  const exportToPDF = async () => {
    if (!slides.length) {
      toast.error("Nenhum slide para exportar");
      return;
    }

    setExporting(true);

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      for (let i = 0; i < slides.length; i++) {
        if (i > 0) doc.addPage();

        const slide = slides[i];
        const content = slide.content as SlideContent;

        // Background
        doc.setFillColor(250, 250, 250);
        doc.rect(0, 0, pageWidth, pageHeight, "F");

        // Left accent bar
        const barColor = slide.is_interactive ? UNV_RED_RGB : UNV_BLUE_RGB;
        doc.setFillColor(...barColor);
        doc.rect(0, 0, 4, pageHeight, "F");

        // Page number
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`${i + 1} / ${slides.length}`, pageWidth - 15, pageHeight - 8);

        // UNV branding footer
        doc.setFontSize(8);
        doc.setTextColor(...UNV_BLUE_RGB);
        doc.text("UNIVERSIDADE VENDAS", 10, pageHeight - 8);

        if (slide.slide_type === "cover") {
          // Cover slide
          doc.setFontSize(20);
          doc.setTextColor(...UNV_BLUE_RGB);
          doc.setFont("helvetica", "bold");
          doc.text("UNIVERSIDADE VENDAS", pageWidth / 2, 40, { align: "center" });

          doc.setFontSize(14);
          doc.setTextColor(100, 100, 100);
          doc.setFont("helvetica", "normal");
          doc.text(companyName, pageWidth / 2, 55, { align: "center" });

          doc.setFontSize(28);
          doc.setTextColor(...UNV_BLUE_RGB);
          doc.setFont("helvetica", "bold");
          const titleLines = doc.splitTextToSize(slide.title || title, pageWidth - 60);
          doc.text(titleLines, pageWidth / 2, 90, { align: "center" });

          if (slide.subtitle) {
            doc.setFontSize(14);
            doc.setTextColor(100, 100, 100);
            doc.setFont("helvetica", "normal");
            doc.text(slide.subtitle, pageWidth / 2, 115, { align: "center" });
          }

          if (meetingDate) {
            doc.setFontSize(12);
            doc.setTextColor(150, 150, 150);
            doc.text(meetingDate, pageWidth / 2, pageHeight - 25, { align: "center" });
          }
        } else if (slide.is_interactive) {
          // Interactive slide
          const typeLabels: Record<string, string> = {
            question: "💭 PERGUNTA ESTRATÉGICA",
            reflection: "🔍 MOMENTO DE REFLEXÃO",
            decision: "⚖️ DECISÃO",
            highlight: "📊 DESTAQUE",
          };

          doc.setFontSize(10);
          doc.setTextColor(...UNV_RED_RGB);
          doc.setFont("helvetica", "bold");
          doc.text(typeLabels[slide.interactive_type || "question"] || "", pageWidth / 2, 30, { align: "center" });

          if (content.question) {
            doc.setFontSize(22);
            doc.setTextColor(...UNV_BLUE_RGB);
            const questionLines = doc.splitTextToSize(content.question, pageWidth - 60);
            doc.text(questionLines, pageWidth / 2, 70, { align: "center" });
          }

          if (content.highlight) {
            doc.setFontSize(36);
            doc.setTextColor(...UNV_RED_RGB);
            doc.text(content.highlight, pageWidth / 2, 80, { align: "center" });
          }

          if (content.metric_value) {
            doc.setFontSize(48);
            doc.setTextColor(...UNV_RED_RGB);
            doc.text(content.metric_value, pageWidth / 2, 80, { align: "center" });

            if (content.metric_label) {
              doc.setFontSize(14);
              doc.setTextColor(100, 100, 100);
              doc.setFont("helvetica", "normal");
              doc.text(content.metric_label, pageWidth / 2, 95, { align: "center" });
            }
          }

          if (content.options?.length) {
            const optionWidth = 80;
            const startX = (pageWidth - (optionWidth * content.options.length + 20)) / 2;
            
            content.options.forEach((option, idx) => {
              const x = startX + idx * (optionWidth + 20);
              const color = idx === 0 ? UNV_BLUE_RGB : UNV_RED_RGB;
              
              doc.setDrawColor(...color);
              doc.setLineWidth(0.5);
              doc.roundedRect(x, 120, optionWidth, 25, 3, 3);
              
              doc.setFontSize(12);
              doc.setTextColor(...color);
              doc.text(option, x + optionWidth / 2, 135, { align: "center" });
            });
          }
        } else {
          // Regular content slide
          doc.setFontSize(20);
          doc.setTextColor(...UNV_BLUE_RGB);
          doc.setFont("helvetica", "bold");
          doc.text(slide.title || "", 15, 25);

          if (slide.subtitle) {
            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            doc.setFont("helvetica", "normal");
            doc.text(slide.subtitle, 15, 35);
          }

          let yPos = slide.subtitle ? 50 : 40;

          if (content.bullets?.length) {
            doc.setFontSize(12);
            doc.setTextColor(60, 60, 60);
            doc.setFont("helvetica", "normal");

            content.bullets.forEach((bullet) => {
              // Bullet point
              doc.setFillColor(...UNV_RED_RGB);
              doc.circle(20, yPos - 1.5, 1.5, "F");

              // Text
              const bulletLines = doc.splitTextToSize(bullet, pageWidth - 45);
              doc.text(bulletLines, 28, yPos);
              yPos += bulletLines.length * 7 + 5;
            });
          }

          if (content.text && !content.bullets?.length) {
            doc.setFontSize(12);
            doc.setTextColor(60, 60, 60);
            doc.setFont("helvetica", "normal");
            const textLines = doc.splitTextToSize(content.text, pageWidth - 40);
            doc.text(textLines, 15, yPos);
          }
        }
      }

      // Save
      const fileName = `Apresentacao_${companyName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);

      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={exportToPDF}
      disabled={exporting || !slides.length}
    >
      {exporting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Exportando...
        </>
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" />
          Baixar PDF
        </>
      )}
    </Button>
  );
}
