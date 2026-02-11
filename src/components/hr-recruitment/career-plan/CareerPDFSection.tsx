import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import type { CareerTrack, CareerPlanVersion } from "./types";

interface CareerPDFSectionProps {
  tracks: CareerTrack[];
  activeVersion: CareerPlanVersion | null;
  readOnly?: boolean;
}

export function CareerPDFSection({ tracks, activeVersion, readOnly }: CareerPDFSectionProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const formatCurrency = (val: number | null) =>
    val != null ? `R$ ${val.toLocaleString("pt-BR")}` : "-";

  const generatePDF = async () => {
    if (!activeVersion || tracks.length === 0) return;

    setIsGenerating(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 25;
      const contentWidth = pageWidth - margin * 2;
      const primaryColor = "#1e3a5f";
      const secondaryColor = "#c41e3a";
      const goldColor = "#b8860b";

      const addPageDecorations = () => {
        doc.setFillColor(primaryColor);
        doc.rect(0, 0, 8, pageHeight, "F");
        doc.setFillColor(secondaryColor);
        doc.rect(8, 0, 3, pageHeight, "F");
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.setFont("helvetica", "normal");
        doc.text("Plano de Carreira – Documento Interno", pageWidth / 2, pageHeight - 10, { align: "center" });
        doc.text(new Date().getFullYear().toString(), pageWidth / 2, pageHeight - 6, { align: "center" });
      };

      const checkNewPage = (y: number, needed: number = 20): number => {
        if (y > pageHeight - needed) {
          doc.addPage();
          addPageDecorations();
          return 30;
        }
        return y;
      };

      // ========== COVER PAGE ==========
      addPageDecorations();
      doc.setFontSize(42);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor);
      doc.text("PLANO DE", pageWidth / 2, pageHeight / 2 - 30, { align: "center" });
      doc.text("CARREIRA", pageWidth / 2, pageHeight / 2 - 10, { align: "center" });

      doc.setDrawColor(secondaryColor);
      doc.setLineWidth(1);
      doc.line(pageWidth / 2 - 40, pageHeight / 2 + 5, pageWidth / 2 + 40, pageHeight / 2 + 5);

      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(128, 128, 128);
      const versionLabel = activeVersion.version_name || `Versão ${activeVersion.version_number}`;
      doc.text(versionLabel, pageWidth / 2, pageHeight / 2 + 18, { align: "center" });

      doc.setFontSize(16);
      doc.text(new Date().getFullYear().toString(), pageWidth / 2, pageHeight / 2 + 30, { align: "center" });

      // ========== INDEX PAGE ==========
      doc.addPage();
      addPageDecorations();
      let y = 30;
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor);
      doc.text("Índice", margin + 10, y);
      doc.setDrawColor(secondaryColor);
      doc.setLineWidth(0.8);
      doc.line(margin + 10, y + 4, pageWidth - margin, y + 4);
      y += 18;

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      tracks.forEach((track, idx) => {
        y = checkNewPage(y);
        doc.setFont("helvetica", "bold");
        doc.text(`${idx + 1}. ${track.name}`, margin + 14, y);
        doc.setFont("helvetica", "normal");
        const typeLabel = track.track_type === "vertical" ? "Trilha Vertical" : "Trilha Horizontal";
        doc.setTextColor(100, 100, 100);
        doc.text(`    ${typeLabel}${track.department ? " – " + track.department : ""}`, margin + 14, y + 6);
        doc.setTextColor(50, 50, 50);
        y += 16;
      });

      // ========== TRACK PAGES ==========
      for (let tIdx = 0; tIdx < tracks.length; tIdx++) {
        const track = tracks[tIdx];
        doc.addPage();
        addPageDecorations();
        y = 30;

        // Track header
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(primaryColor);
        const trackTitle = `${tIdx + 1}. ${track.name}`;
        doc.text(trackTitle, margin + 10, y);
        doc.setDrawColor(secondaryColor);
        doc.setLineWidth(0.8);
        doc.line(margin + 10, y + 4, pageWidth - margin, y + 4);
        y += 12;

        // Track type and department
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        const typeLabel = track.track_type === "vertical" ? "📊 Trilha Vertical" : "↔️ Trilha Horizontal";
        doc.text(typeLabel + (track.department ? ` | ${track.department}` : ""), margin + 10, y);
        y += 6;

        if (track.description) {
          doc.setFontSize(10);
          doc.setTextColor(80, 80, 80);
          const descLines = doc.splitTextToSize(track.description, contentWidth - 15);
          for (const line of descLines) {
            y = checkNewPage(y);
            doc.text(line, margin + 10, y);
            y += 5;
          }
        }
        y += 6;

        // Roles
        const sortedRoles = (track.roles || []).sort((a, b) => a.level_order - b.level_order);
        for (let rIdx = 0; rIdx < sortedRoles.length; rIdx++) {
          const role = sortedRoles[rIdx];
          y = checkNewPage(y, 40);

          // Role header with level badge
          doc.setFillColor(240, 242, 245);
          doc.roundedRect(margin + 8, y - 5, contentWidth - 6, 12, 2, 2, "F");

          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(primaryColor);
          doc.text(`Nível ${rIdx + 1}: ${role.name}`, margin + 12, y + 2);

          if (role.is_entry_level) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(34, 197, 94);
            doc.text("NÍVEL INICIAL", pageWidth - margin - 5, y + 2, { align: "right" });
          }
          y += 14;

          // Role description
          if (role.description) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(80, 80, 80);
            const descLines = doc.splitTextToSize(role.description, contentWidth - 20);
            for (const line of descLines) {
              y = checkNewPage(y);
              doc.text(line, margin + 12, y);
              y += 5;
            }
            y += 3;
          }

          // Info grid
          y = checkNewPage(y, 15);
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          const col1 = margin + 12;
          const col2 = margin + contentWidth / 2;

          doc.text("Faixa Salarial:", col1, y);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(50, 50, 50);
          doc.text(`${formatCurrency(role.salary_min)} – ${formatCurrency(role.salary_max)}`, col1 + 28, y);

          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text("Tempo Mínimo:", col2, y);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(50, 50, 50);
          doc.text(role.min_time_months ? `${role.min_time_months} meses` : "-", col2 + 28, y);
          y += 7;

          if (role.benefits) {
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 100, 100);
            doc.text("Benefícios:", col1, y);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(50, 50, 50);
            const benefLines = doc.splitTextToSize(role.benefits, contentWidth - 45);
            for (const line of benefLines) {
              y = checkNewPage(y);
              doc.text(line, col1 + 22, y);
              y += 5;
            }
            y += 2;
          }

          // Criteria
          if (role.criteria && role.criteria.length > 0) {
            y = checkNewPage(y, 15);
            y += 3;
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(primaryColor);
            doc.text("Critérios de Progressão", margin + 12, y);
            y += 7;

            for (const c of role.criteria) {
              y = checkNewPage(y);
              doc.setFontSize(9);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(50, 50, 50);
              doc.text(`• ${c.name}`, margin + 16, y);
              doc.setTextColor(100, 100, 100);
              const meta = `(Nota mín. ${c.min_score} | Peso ${c.weight} | ${c.criteria_type})`;
              doc.text(meta, margin + 16 + doc.getTextWidth(`• ${c.name}  `), y);
              y += 6;
              if (c.description) {
                doc.setFontSize(8);
                doc.setTextColor(120, 120, 120);
                const cDescLines = doc.splitTextToSize(c.description, contentWidth - 35);
                for (const line of cDescLines) {
                  y = checkNewPage(y);
                  doc.text(line, margin + 20, y);
                  y += 4;
                }
                y += 1;
              }
            }
          }

          // Goals
          if (role.goals && role.goals.length > 0) {
            y = checkNewPage(y, 15);
            y += 3;
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(goldColor);
            doc.text("Metas do Cargo", margin + 12, y);
            y += 7;

            for (const g of role.goals) {
              y = checkNewPage(y);
              doc.setFontSize(9);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(50, 50, 50);
              doc.text(`• ${g.title}`, margin + 16, y);
              y += 5;
              if (g.description) {
                doc.setFont("helvetica", "normal");
                doc.setTextColor(80, 80, 80);
                const gDescLines = doc.splitTextToSize(g.description, contentWidth - 35);
                for (const line of gDescLines) {
                  y = checkNewPage(y);
                  doc.text(line, margin + 20, y);
                  y += 4;
                }
              }
              doc.setFontSize(8);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(100, 100, 100);
              const goalMeta = [
                g.goal_type && `Tipo: ${g.goal_type}`,
                g.target_value && `Meta: ${g.target_value}`,
                g.measurement_unit && `Unidade: ${g.measurement_unit}`,
              ].filter(Boolean).join(" | ");
              if (goalMeta) {
                y = checkNewPage(y);
                doc.text(goalMeta, margin + 20, y);
                y += 5;
              }
              y += 1;
            }
          }

          // Arrow separator between roles (vertical tracks)
          if (rIdx < sortedRoles.length - 1 && track.track_type === "vertical") {
            y = checkNewPage(y, 12);
            y += 3;
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.3);
            const midX = pageWidth / 2;
            doc.line(midX, y, midX, y + 6);
            doc.text("▼", midX - 1.5, y + 10);
            y += 14;
          } else {
            y += 8;
          }
        }
      }

      const fileName = `plano-carreira-v${activeVersion.version_number}.pdf`;
      doc.save(fileName);
      toast.success("PDF do Plano de Carreira gerado com sucesso!");
    } catch (error: any) {
      console.error("Error generating career PDF:", error);
      toast.error("Erro ao gerar PDF: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!activeVersion || tracks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download do PDF
          </CardTitle>
          <CardDescription>
            {readOnly
              ? "O plano de carreira ainda não foi publicado"
              : "Gere ou edite um plano de carreira para baixar o PDF"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {readOnly
                ? "Aguarde a publicação do plano pela equipe."
                : "Crie uma versão do plano primeiro para poder baixar o PDF."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Download do PDF
        </CardTitle>
        <CardDescription>
          Baixe o plano de carreira em formato PDF premium
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 rounded-lg border bg-muted/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">
                Versão {activeVersion.version_number}
                {activeVersion.version_name && ` – ${activeVersion.version_name}`}
              </h4>
              <p className="text-sm text-muted-foreground">
                {tracks.length} trilha(s) · {tracks.reduce((acc, t) => acc + (t.roles?.length || 0), 0)} cargo(s)
              </p>
            </div>
            <div className="flex gap-2">
              {activeVersion.is_published && (
                <Badge className="bg-green-500">Publicado</Badge>
              )}
              {activeVersion.generated_by_ai && (
                <Badge variant="outline">Gerado por IA</Badge>
              )}
            </div>
          </div>

          <div className="text-sm">
            <p className="font-medium mb-2">Trilhas incluídas:</p>
            <div className="flex flex-wrap gap-1">
              {tracks.map((track) => (
                <Badge key={track.id} variant="secondary" className="text-xs">
                  {track.name} ({track.roles?.length || 0} cargos)
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border">
            <h4 className="font-medium mb-2">Características do PDF</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Layout institucional premium</li>
              <li>✓ Capa e índice automáticos</li>
              <li>✓ Critérios e metas detalhados</li>
              <li>✓ Faixas salariais por cargo</li>
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

        <Button
          onClick={generatePDF}
          disabled={isGenerating}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Gerando PDF...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF do Plano de Carreira
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
