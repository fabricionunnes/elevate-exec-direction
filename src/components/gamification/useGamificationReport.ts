import { GlobalParticipant, CompanySummary } from "@/hooks/useGlobalGamification";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function generateRankingText(
  participants: GlobalParticipant[],
  companies: CompanySummary[],
  month: Date,
  stats: { total: number; avgPercent: number; activeCompanies: number; above100: number }
): string {
  const monthLabel = format(month, "MMMM/yyyy", { locale: ptBR });
  const lines: string[] = [];

  lines.push("🏆 *RANKING GAMIFICAÇÃO* 🏆");
  lines.push(`📅 ${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}`);
  lines.push("");
  lines.push(`👥 ${stats.total} vendedores | 🏢 ${stats.activeCompanies} empresas`);
  lines.push(`📊 Média: ${stats.avgPercent.toFixed(1)}% | ✅ Bateram meta: ${stats.above100}`);
  lines.push("");

  // Top 10
  const top = participants.slice(0, 10);
  if (top.length > 0) {
    lines.push("*🥇 TOP 10 VENDEDORES*");
    lines.push("");
    top.forEach((p, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`;
      lines.push(`${medal} *${p.salesperson_name}* - ${p.company_name}`);
      lines.push(`   📈 ${p.achievement_percent.toFixed(1)}% (${p.total_achieved.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} / ${p.total_target.toLocaleString("pt-BR", { maximumFractionDigits: 0 })})`);
    });
  }

  // Top companies
  if (companies.length > 0) {
    lines.push("");
    lines.push("*🏢 TOP 5 EMPRESAS*");
    lines.push("");
    companies.slice(0, 5).forEach((c, i) => {
      lines.push(`${i + 1}º *${c.company_name}* - ${c.avg_percent.toFixed(1)}%`);
      lines.push(`   ⭐ ${c.top_salesperson} (${c.top_percent.toFixed(0)}%) | ${c.participant_count} vendedores`);
    });
  }

  lines.push("");
  lines.push("💪 _Vamos com tudo!_");

  return lines.join("\n");
}

export async function generateRankingPDF(
  participants: GlobalParticipant[],
  companies: CompanySummary[],
  month: Date,
  stats: { total: number; avgPercent: number; activeCompanies: number; above100: number }
): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const monthLabel = format(month, "MMMM/yyyy", { locale: ptBR });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Ranking Gamificação", pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), pageWidth / 2, y, { align: "center" });
  y += 12;

  // Stats
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Vendedores: ${stats.total}   |   Empresas: ${stats.activeCompanies}   |   Média: ${stats.avgPercent.toFixed(1)}%   |   Bateram Meta: ${stats.above100}`, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Divider
  doc.setDrawColor(200);
  doc.line(15, y, pageWidth - 15, y);
  y += 8;

  // Ranking table
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Top Vendedores", 15, y);
  y += 8;

  // Header
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y - 4, pageWidth - 30, 7, "F");
  doc.text("#", 18, y);
  doc.text("Vendedor", 28, y);
  doc.text("Empresa", 90, y);
  doc.text("Realizado / Meta", 145, y);
  doc.text("%", pageWidth - 20, y, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal");
  const top50 = participants.slice(0, 50);
  for (let i = 0; i < top50.length; i++) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const p = top50[i];
    const pos = `${i + 1}º`;

    if (i < 3) {
      doc.setFillColor(i === 0 ? 255 : i === 1 ? 230 : 255, i === 0 ? 248 : i === 1 ? 230 : 237, i === 0 ? 220 : i === 1 ? 230 : 213);
      doc.rect(15, y - 4, pageWidth - 30, 7, "F");
      doc.setFont("helvetica", "bold");
    } else {
      doc.setFont("helvetica", "normal");
    }

    doc.setFontSize(9);
    doc.text(pos, 18, y);
    doc.text(p.salesperson_name.substring(0, 30), 28, y);
    doc.text(p.company_name.substring(0, 28), 90, y);
    doc.text(`${p.total_achieved.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} / ${p.total_target.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, 145, y);

    // Color for percentage
    const pct = p.achievement_percent;
    if (pct >= 100) doc.setTextColor(16, 185, 129);
    else if (pct >= 80) doc.setTextColor(245, 158, 11);
    else doc.setTextColor(239, 68, 68);
    doc.text(`${pct.toFixed(1)}%`, pageWidth - 20, y, { align: "right" });
    doc.setTextColor(0);

    y += 7;
  }

  // Companies section
  if (companies.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }
    y += 5;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Ranking por Empresa", 15, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y - 4, pageWidth - 30, 7, "F");
    doc.text("#", 18, y);
    doc.text("Empresa", 28, y);
    doc.text("Vendedores", 110, y);
    doc.text("Destaque", 140, y);
    doc.text("Média %", pageWidth - 20, y, { align: "right" });
    y += 8;

    doc.setFont("helvetica", "normal");
    companies.slice(0, 20).forEach((c, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${i + 1}º`, 18, y);
      doc.text(c.company_name.substring(0, 38), 28, y);
      doc.text(`${c.participant_count}`, 115, y);
      doc.text(`${c.top_salesperson.substring(0, 18)} (${c.top_percent.toFixed(0)}%)`, 140, y);

      const pct = c.avg_percent;
      if (pct >= 100) doc.setTextColor(16, 185, 129);
      else if (pct >= 80) doc.setTextColor(245, 158, 11);
      else doc.setTextColor(239, 68, 68);
      doc.text(`${pct.toFixed(1)}%`, pageWidth - 20, y, { align: "right" });
      doc.setTextColor(0);

      y += 7;
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });

  return doc.output("blob");
}
