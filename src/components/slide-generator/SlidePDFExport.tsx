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
      // Use pixel-based format matching the slide dimensions for perfect fit
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [1920, 1080],
        hotfixes: ["px_scaling"],
      });

      const slideElements = slidesContainerRef.current.querySelectorAll("[data-slide-export]");

      for (let i = 0; i < slideElements.length; i++) {
        if (i > 0) pdf.addPage([1920, 1080], "landscape");

        const el = slideElements[i] as HTMLElement;

        const canvas = await html2canvas(el, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          width: 1920,
          height: 1080,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        pdf.addImage(imgData, "JPEG", 0, 0, 1920, 1080);
      }

      const fileName = `${presentationTitle.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;
      const pdfBlob = pdf.output("blob");
      const blobUrl = URL.createObjectURL(pdfBlob);

      // Use an iframe to trigger the download — works in nested iframes
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.body.appendChild(iframe);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      
      // Append to iframe document for sandboxed download
      if (iframe.contentDocument) {
        iframe.contentDocument.body.appendChild(link);
        link.click();
      } else {
        // Fallback: append to main document
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(blobUrl);
      }, 10000);

      toast.success("PDF gerado com sucesso!");
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
        <div ref={slidesContainerRef} style={{ position: "absolute", left: "-9999px", top: 0 }}>
        {slides.map((slide, i) => (
            <div key={slide.id} data-slide-export style={{ width: 1920, height: 1080, overflow: "hidden" }}>
              <SlideRenderer slide={slide} scale={1} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
