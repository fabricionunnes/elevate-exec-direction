import { useState, useRef } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { SlideRenderer } from "./SlideRenderer";

interface SlideItem {
  id: string;
  slide_type: string;
  title: string | null;
  subtitle: string | null;
  content: any;
  speaker_notes: string | null;
  layout_type: string | null;
  sort_order: number;
}

interface Props {
  slides: SlideItem[];
  presentationTitle: string;
  onBack: () => void;
}

export function SlidePDFExport({ slides, presentationTitle, onBack }: Props) {
  const [exporting, setExporting] = useState(false);
  const slidesContainerRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!slidesContainerRef.current) return;
    setExporting(true);
    toast.info("Gerando PDF... Aguarde.");

    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = 297;
      const pageHeight = 210;

      const slideElements = slidesContainerRef.current.querySelectorAll("[data-slide-export]");

      for (let i = 0; i < slideElements.length; i++) {
        if (i > 0) pdf.addPage();

        const canvas = await html2canvas(slideElements[i] as HTMLElement, {
          scale: 2,
          backgroundColor: null,
          useCORS: true,
          logging: false,
        });

        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
      }

      pdf.save(`${presentationTitle.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Erro ao exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold">Exportar PDF</h2>
              <p className="text-sm text-muted-foreground">{presentationTitle} • {slides.length} slides</p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "Exportando..." : "Baixar PDF"}
          </Button>
        </div>

        {/* Hidden render area for capture */}
        <div ref={slidesContainerRef} className="space-y-4">
          {slides.map((slide, i) => (
            <div key={slide.id} data-slide-export className="rounded-lg overflow-hidden shadow-md">
              <div style={{ width: 1920 * 0.5, height: 1080 * 0.5 }}>
                <SlideRenderer slide={slide} scale={0.5} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
