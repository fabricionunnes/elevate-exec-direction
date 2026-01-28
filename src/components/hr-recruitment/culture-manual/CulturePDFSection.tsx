import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, RefreshCw, Printer } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { 
  useActiveManualVersion,
  usePublishedManualVersion,
  useManualSections 
} from "./useCultureManual";
import { supabase } from "@/integrations/supabase/client";

interface CulturePDFSectionProps {
  projectId: string;
  readOnly?: boolean;
}

export function CulturePDFSection({ projectId, readOnly }: CulturePDFSectionProps) {
  const { data: activeVersion, isLoading: loadingActive } = useActiveManualVersion(projectId);
  const { data: publishedVersion, isLoading: loadingPublished } = usePublishedManualVersion(projectId);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Use published version for clients, active version for staff
  const versionToShow = readOnly ? publishedVersion : activeVersion;
  const { data: sections, isLoading: loadingSections } = useManualSections(versionToShow?.id);

  const isLoading = loadingActive || loadingPublished || loadingSections;

  const generatePDF = async () => {
    if (!versionToShow || !sections) return;

    setIsGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 25;
      const contentWidth = pageWidth - margin * 2;
      const primaryColor = versionToShow.primary_color || "#1e3a5f";
      const secondaryColor = versionToShow.secondary_color || "#c41e3a";

      // Helper function to add page decorations
      const addPageDecorations = () => {
        // Left stripe (navy)
        doc.setFillColor(primaryColor);
        doc.rect(0, 0, 8, pageHeight, "F");
        
        // Second stripe (red)
        doc.setFillColor(secondaryColor);
        doc.rect(8, 0, 3, pageHeight, "F");

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text("Manual de Cultura – Documento Interno", pageWidth / 2, pageHeight - 10, { align: "center" });
        doc.text(new Date().getFullYear().toString(), pageWidth / 2, pageHeight - 6, { align: "center" });
      };

      // Cover page
      addPageDecorations();
      
      // Title
      doc.setFontSize(32);
      doc.setTextColor(primaryColor);
      doc.text("Manual de Cultura", pageWidth / 2, pageHeight / 2 - 20, { align: "center" });
      
      doc.setFontSize(14);
      doc.setTextColor(128, 128, 128);
      doc.text(new Date().getFullYear().toString(), pageWidth / 2, pageHeight / 2, { align: "center" });

      // Content pages
      const sortedSections = sections.sort((a, b) => a.sort_order - b.sort_order);
      
      for (const section of sortedSections) {
        if (!section.section_content) continue;

        doc.addPage();
        addPageDecorations();

        let yPosition = 30;

        // Section title
        doc.setFontSize(18);
        doc.setTextColor(primaryColor);
        doc.text(section.section_title, margin + 10, yPosition);
        
        // Title underline
        doc.setDrawColor(secondaryColor);
        doc.setLineWidth(0.5);
        doc.line(margin + 10, yPosition + 3, pageWidth - margin, yPosition + 3);
        
        yPosition += 15;

        // Section content
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        
        const lines = doc.splitTextToSize(section.section_content, contentWidth - 10);
        const lineHeight = 6;
        
        for (const line of lines) {
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            addPageDecorations();
            yPosition = 30;
          }
          doc.text(line, margin + 10, yPosition);
          yPosition += lineHeight;
        }
      }

      // Save the PDF
      const fileName = `manual-cultura-v${versionToShow.version_number}.pdf`;
      doc.save(fileName);

      // Log the download
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      await supabase.from("culture_manual_audit_log").insert({
        project_id: projectId,
        version_id: versionToShow.id,
        action: "pdf_download",
        action_details: { version_number: versionToShow.version_number, file_name: fileName },
        performed_by_staff_id: staffData?.id,
      });

      toast.success("PDF gerado com sucesso!");
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!versionToShow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download do PDF
          </CardTitle>
          <CardDescription>
            {readOnly 
              ? "O manual de cultura ainda não foi publicado" 
              : "Baixe o manual em formato PDF institucional"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {readOnly 
                ? "Aguarde a publicação do manual de cultura pela equipe." 
                : "Crie uma versão do manual primeiro para poder baixar o PDF."
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedSections = sections?.sort((a, b) => a.sort_order - b.sort_order) || [];
  const filledSections = sortedSections.filter(s => s.section_content);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Download do PDF
        </CardTitle>
        <CardDescription>
          Baixe o manual de cultura em formato PDF premium
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Version Info */}
        <div className="p-4 rounded-lg border bg-muted/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">
                Versão {versionToShow.version_number}
                {versionToShow.version_name && ` - ${versionToShow.version_name}`}
              </h4>
              <p className="text-sm text-muted-foreground">
                {filledSections.length} seções preenchidas
              </p>
            </div>
            <div className="flex gap-2">
              {versionToShow.is_published && (
                <Badge className="bg-green-500">Publicado</Badge>
              )}
              {versionToShow.generated_by_ai && (
                <Badge variant="outline">Gerado por IA</Badge>
              )}
            </div>
          </div>

          {/* Sections Preview */}
          <div className="text-sm">
            <p className="font-medium mb-2">Seções incluídas:</p>
            <div className="flex flex-wrap gap-1">
              {filledSections.map((section) => (
                <Badge key={section.id} variant="secondary" className="text-xs">
                  {section.section_title}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* PDF Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border">
            <h4 className="font-medium mb-2">Características do PDF</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Layout institucional premium</li>
              <li>✓ Faixas laterais coloridas</li>
              <li>✓ Tipografia profissional</li>
              <li>✓ Sumário automático</li>
              <li>✓ Rodapé em todas as páginas</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border">
            <h4 className="font-medium mb-2">Formato</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>📄 Formato A4</li>
              <li>🎨 Cores: Navy + Vermelho</li>
              <li>📝 Alta resolução</li>
              <li>🖨️ Pronto para impressão</li>
            </ul>
          </div>
        </div>

        {/* Download Button */}
        <div className="flex gap-2">
          <Button 
            onClick={generatePDF}
            disabled={isGenerating || filledSections.length === 0}
            className="flex-1"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Baixar PDF
              </>
            )}
          </Button>
          <Button 
            variant="outline"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>

        {filledSections.length === 0 && (
          <p className="text-sm text-amber-600 text-center">
            ⚠️ Preencha pelo menos uma seção do manual para gerar o PDF.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
