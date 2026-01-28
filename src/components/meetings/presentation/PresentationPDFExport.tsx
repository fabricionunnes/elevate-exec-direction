import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { PresentationSlide, SlideContent } from "./types";

// UNV Brand colors
const UNV_COLORS = {
  blue: {
    dark: "#1E3A5F",
    primary: "#2A4A6F",
    light: "#3A5A7F",
  },
  red: {
    primary: "#E63946",
    dark: "#C62B38",
  },
  gold: {
    primary: "#D4AF37",
    light: "#E5C158",
  },
};

interface PresentationPDFExportProps {
  slides: PresentationSlide[];
  companyName: string;
  title: string;
  meetingDate?: string;
}

interface SlideRendererProps {
  slide: PresentationSlide; 
  companyName: string;
  meetingDate?: string;
  presentationTitle: string;
  slideRef: React.RefObject<HTMLDivElement>;
}

// Render a single slide to a hidden div for capture
function SlideRenderer({ 
  slide, 
  companyName, 
  meetingDate,
  presentationTitle,
  slideRef 
}: SlideRendererProps) {
  const content = slide.content as SlideContent;

  const renderCoverSlide = () => (
    <div 
      ref={slideRef}
      className="relative w-[1920px] h-[1080px] overflow-hidden"
      style={{ 
        background: `linear-gradient(135deg, ${UNV_COLORS.blue.dark} 0%, ${UNV_COLORS.blue.primary} 50%, ${UNV_COLORS.blue.light} 100%)`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Decorative elements */}
      <div 
        className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-10"
        style={{ background: UNV_COLORS.gold.primary, transform: 'translate(200px, -200px)' }}
      />
      <div 
        className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10"
        style={{ background: UNV_COLORS.red.primary, transform: 'translate(-100px, 100px)' }}
      />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-20">
        {/* Logo area */}
        <div 
          className="mb-12 px-16 py-6 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}
        >
          <div className="text-5xl font-bold text-white tracking-wide">
            UNIVERSIDADE VENDAS
          </div>
        </div>

        {/* Gold accent line */}
        <div 
          className="w-48 h-1.5 rounded-full mb-12"
          style={{ background: `linear-gradient(90deg, transparent, ${UNV_COLORS.gold.primary}, transparent)` }}
        />

        {/* Company */}
        <div className="text-3xl text-white/80 mb-8 font-medium tracking-wider uppercase">
          {companyName}
        </div>

        {/* Title */}
        <h1 className="text-7xl font-bold text-white text-center mb-6 max-w-[1400px] leading-tight">
          {slide.title || presentationTitle}
        </h1>

        {/* Subtitle */}
        {slide.subtitle && (
          <p className="text-3xl text-white/70 text-center max-w-[1200px]">
            {slide.subtitle}
          </p>
        )}

        {/* Date */}
        {meetingDate && (
          <div className="absolute bottom-20 text-2xl text-white/50">
            {meetingDate}
          </div>
        )}
      </div>

      {/* Bottom accent */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-2"
        style={{ background: `linear-gradient(90deg, ${UNV_COLORS.red.primary}, ${UNV_COLORS.gold.primary})` }}
      />
    </div>
  );

  const renderInteractiveSlide = () => {
    const typeLabels: Record<string, { label: string; icon: string }> = {
      question: { label: "PERGUNTA ESTRATÉGICA", icon: "💭" },
      reflection: { label: "MOMENTO DE REFLEXÃO", icon: "🔍" },
      decision: { label: "DECISÃO", icon: "⚖️" },
      highlight: { label: "DESTAQUE", icon: "📊" },
    };

    const typeInfo = typeLabels[slide.interactive_type || "question"] || typeLabels.question;

    return (
      <div 
        ref={slideRef}
        className="relative w-[1920px] h-[1080px] overflow-hidden"
        style={{ 
          background: `linear-gradient(180deg, #FAFAFA 0%, #F0F0F0 100%)`,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Red accent bar */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-3"
          style={{ background: `linear-gradient(180deg, ${UNV_COLORS.red.primary}, ${UNV_COLORS.red.dark})` }}
        />

        {/* Header */}
        <div 
          className="absolute top-0 left-3 right-0 h-24 flex items-center px-16"
          style={{ background: `linear-gradient(90deg, ${UNV_COLORS.blue.dark}, ${UNV_COLORS.blue.primary})` }}
        >
          <div className="text-3xl font-bold text-white tracking-wide">
            UNIVERSIDADE VENDAS
          </div>
        </div>

        {/* Content */}
        <div className="absolute top-24 left-3 right-0 bottom-20 flex flex-col items-center justify-center px-20">
          {/* Type badge */}
          <div 
            className="inline-flex items-center gap-4 px-10 py-4 rounded-full mb-12"
            style={{ background: `linear-gradient(135deg, ${UNV_COLORS.red.primary}, ${UNV_COLORS.red.dark})` }}
          >
            <span className="text-4xl">{typeInfo.icon}</span>
            <span className="text-2xl font-bold text-white tracking-wider">
              {typeInfo.label}
            </span>
          </div>

          {/* Question */}
          {content.question && (
            <div 
              className="text-5xl font-bold text-center mb-12 max-w-[1400px] leading-tight"
              style={{ color: UNV_COLORS.blue.dark }}
            >
              {content.question}
            </div>
          )}

          {/* Highlight or Metric */}
          {content.highlight && (
            <div 
              className="text-8xl font-bold mb-8"
              style={{ color: UNV_COLORS.red.primary }}
            >
              {content.highlight}
            </div>
          )}

          {content.metric_value && (
            <div className="text-center mb-8">
              <div 
                className="text-9xl font-bold mb-4"
                style={{ color: UNV_COLORS.red.primary }}
              >
                {content.metric_value}
              </div>
              {content.metric_label && (
                <div className="text-3xl text-gray-600">
                  {content.metric_label}
                </div>
              )}
            </div>
          )}

          {/* Options */}
          {content.options && content.options.length > 0 && (
            <div className="flex gap-12 mt-8">
              {content.options.map((option, idx) => (
                <div 
                  key={idx}
                  className="px-16 py-8 rounded-2xl text-3xl font-bold text-white"
                  style={{ 
                    background: idx === 0 
                      ? `linear-gradient(135deg, ${UNV_COLORS.blue.dark}, ${UNV_COLORS.blue.primary})`
                      : `linear-gradient(135deg, ${UNV_COLORS.red.primary}, ${UNV_COLORS.red.dark})`
                  }}
                >
                  {option}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-3 right-0 h-20 flex items-center justify-between px-16 bg-gray-100 border-t">
          <div className="text-xl font-medium" style={{ color: UNV_COLORS.blue.dark }}>
            UNIVERSIDADE VENDAS
          </div>
          <div className="text-xl text-gray-500">
            {slide.slide_number}
          </div>
        </div>
      </div>
    );
  };

  const renderContentSlide = () => (
    <div 
      ref={slideRef}
      className="relative w-[1920px] h-[1080px] overflow-hidden bg-white"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Header */}
      <div 
        className="absolute top-0 left-0 right-0 h-28 flex items-center px-16"
        style={{ background: `linear-gradient(90deg, ${UNV_COLORS.blue.dark}, ${UNV_COLORS.blue.primary})` }}
      >
        <h2 className="text-4xl font-bold text-white">
          {slide.title}
        </h2>
      </div>

      {/* Red accent line */}
      <div 
        className="absolute top-28 left-0 right-0 h-2"
        style={{ background: `linear-gradient(90deg, ${UNV_COLORS.red.primary}, ${UNV_COLORS.gold.primary})` }}
      />

      {/* Subtitle */}
      {slide.subtitle && (
        <div className="absolute top-36 left-16 right-16 text-2xl text-gray-600">
          {slide.subtitle}
        </div>
      )}

      {/* Content area */}
      <div className="absolute top-48 left-16 right-16 bottom-24">
        {/* Bullets */}
        {content.bullets && content.bullets.length > 0 && (
          <div className="space-y-8">
            {content.bullets.map((bullet, idx) => (
              <div key={idx} className="flex items-start gap-6">
                <div 
                  className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${UNV_COLORS.blue.dark}, ${UNV_COLORS.blue.primary})` }}
                >
                  {idx + 1}
                </div>
                <div className="text-3xl text-gray-700 leading-relaxed pt-2">
                  {bullet}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Text */}
        {content.text && !content.bullets?.length && (
          <div className="text-3xl text-gray-700 leading-relaxed">
            {content.text}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 h-20 flex items-center justify-between px-16 bg-gray-50 border-t">
        <div className="flex items-center gap-4">
          <div 
            className="w-3 h-8 rounded"
            style={{ background: UNV_COLORS.red.primary }}
          />
          <span className="text-xl font-medium" style={{ color: UNV_COLORS.blue.dark }}>
            UNIVERSIDADE VENDAS
          </span>
        </div>
        <div className="text-xl text-gray-500">
          {slide.slide_number}
        </div>
      </div>
    </div>
  );

  if (slide.slide_type === "cover") {
    return renderCoverSlide();
  }

  if (slide.is_interactive) {
    return renderInteractiveSlide();
  }

  return renderContentSlide();
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
      // Create PDF in landscape
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [1920, 1080],
      });

      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      document.body.appendChild(container);

      for (let i = 0; i < slides.length; i++) {
        if (i > 0) {
          pdf.addPage([1920, 1080], "landscape");
        }

        // Create a temporary element to render the slide
        const slideContainer = document.createElement("div");
        slideContainer.style.width = "1920px";
        slideContainer.style.height = "1080px";
        container.appendChild(slideContainer);

        // Render using React
        const { createRoot } = await import("react-dom/client");
        const root = createRoot(slideContainer);
        
        await new Promise<void>((resolve) => {
          const TempSlide = () => {
            const ref = useRef<HTMLDivElement>(null);
            return (
              <SlideRenderer
                slide={slides[i]}
                companyName={companyName}
                meetingDate={meetingDate}
                presentationTitle={title}
                slideRef={ref}
              />
            );
          };
          root.render(<TempSlide />);
          
          // Wait for render
          setTimeout(async () => {
            try {
              const canvas = await html2canvas(slideContainer, {
                width: 1920,
                height: 1080,
                scale: 1,
                useCORS: true,
                allowTaint: true,
                backgroundColor: "#ffffff",
              });

              const imgData = canvas.toDataURL("image/jpeg", 0.95);
              pdf.addImage(imgData, "JPEG", 0, 0, 1920, 1080);
            } catch (err) {
              console.error("Error capturing slide:", err);
            }
            
            root.unmount();
            resolve();
          }, 100);
        });

        container.removeChild(slideContainer);
      }

      document.body.removeChild(container);

      // Save
      const fileName = `Apresentacao_${companyName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);

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
