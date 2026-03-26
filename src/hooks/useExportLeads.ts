import { useCallback } from "react";
import { toast } from "sonner";
import type { B2BLead } from "@/types/b2bProspection";

export function useExportLeads() {
  const exportCSV = useCallback((leads: B2BLead[], filename: string) => {
    const headers = ["Nome", "Segmento", "Telefone", "Endereço", "Cidade", "Estado", "Website", "Avaliação"];
    const rows = leads.map(l => [
      l.name, l.segment, l.phone || "", l.address, l.city, l.state, l.website || "", l.google_rating?.toString() || "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${(v || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    downloadFile(csv, `${filename}.csv`, "text/csv");
    toast.success("CSV exportado com sucesso!");
  }, []);

  const exportXLSX = useCallback(async (leads: B2BLead[], filename: string) => {
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(
        leads.map(l => ({
          Nome: l.name,
          Segmento: l.segment,
          Telefone: l.phone || "",
          Endereço: l.address,
          Cidade: l.city,
          Estado: l.state,
          Website: l.website || "",
          "Avaliação Google": l.google_rating || "",
        }))
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      XLSX.writeFile(wb, `${filename}.xlsx`);
      toast.success("Excel exportado com sucesso!");
    } catch {
      toast.error("Erro ao exportar Excel");
    }
  }, []);

  const exportPDF = useCallback(async (leads: B2BLead[], filename: string) => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Leads B2B - Prospecção", 14, 20);
      doc.setFontSize(8);
      doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

      let y = 38;
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("Nome", 14, y);
      doc.text("Segmento", 70, y);
      doc.text("Telefone", 110, y);
      doc.text("Cidade/UF", 150, y);
      doc.text("Avaliação", 185, y);
      y += 6;
      doc.setFont("helvetica", "normal");

      for (const lead of leads) {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text((lead.name || "").substring(0, 30), 14, y);
        doc.text((lead.segment || "").substring(0, 20), 70, y);
        doc.text(lead.phone || "-", 110, y);
        doc.text(`${lead.city}/${lead.state}`, 150, y);
        doc.text(lead.google_rating ? `${lead.google_rating}★` : "-", 185, y);
        y += 5;
      }

      doc.save(`${filename}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch {
      toast.error("Erro ao exportar PDF");
    }
  }, []);

  return { exportCSV, exportXLSX, exportPDF };
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
