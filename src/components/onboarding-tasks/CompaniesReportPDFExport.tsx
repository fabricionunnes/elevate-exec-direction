import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getRiskLevelInfo } from "@/hooks/useHealthScore";

interface CompanyReport {
  id: string;
  name: string;
  consultant_name: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_value: number | null;
  payment_method: string | null;
  status: string;
  total_paid: number;
  contract_months: number;
  avg_ticket: number;
  health_score: number | null;
  health_risk: string | null;
}

interface SummaryMetrics {
  totalLTV: number;
  avgTicketGeneral: number;
  totalContractValue: number;
  companyCount: number;
}

interface Filters {
  consultant: string;
  status: string;
  paymentMethod: string;
  searchTerm: string;
  endDateFrom: string;
  endDateTo: string;
  healthMin: number;
  healthMax: number;
}

interface CompaniesReportPDFExportProps {
  companies: CompanyReport[];
  summaryMetrics: SummaryMetrics;
  filters: Filters;
  isCS?: boolean;
}

export default function CompaniesReportPDFExport({
  companies,
  summaryMetrics,
  filters,
  isCS = false,
}: CompaniesReportPDFExportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "—";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Ativo";
      case "closed":
      case "completed":
        return "Encerrado";
      case "cancellation_signaled":
      case "notice_period":
        return "Em Aviso";
      default:
        return status;
    }
  };

  const getActiveFilters = () => {
    const activeFilters: string[] = [];
    if (filters.searchTerm) activeFilters.push(`Busca: "${filters.searchTerm}"`);
    if (filters.consultant !== "all") activeFilters.push("Consultor filtrado");
    if (filters.status !== "all") {
      const statusLabels: Record<string, string> = {
        active: "Ativo",
        closed: "Encerrado",
        cancellation_signaled: "Em Aviso",
      };
      activeFilters.push(`Status: ${statusLabels[filters.status] || filters.status}`);
    }
    if (filters.paymentMethod !== "all") {
      activeFilters.push(`Pagamento: ${filters.paymentMethod === "none" ? "Não informado" : filters.paymentMethod}`);
    }
    if (filters.endDateFrom) activeFilters.push(`Término a partir de: ${formatDate(filters.endDateFrom)}`);
    if (filters.endDateTo) activeFilters.push(`Término até: ${formatDate(filters.endDateTo)}`);
    if (filters.healthMin > 0 || filters.healthMax < 100) {
      activeFilters.push(`Saúde: ${filters.healthMin} - ${filters.healthMax}`);
    }
    return activeFilters.length > 0 ? activeFilters.join(" | ") : "Nenhum filtro aplicado";
  };

  const generatePDF = async () => {
    if (!reportRef.current) return;

    setGenerating(true);

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4"); // Landscape for more columns
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;

      let heightLeft = imgHeight * ratio;
      let position = 0;

      pdf.addImage(imgData, "PNG", imgX, position, imgWidth * ratio, imgHeight * ratio);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight * ratio;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", imgX, position, imgWidth * ratio, imgHeight * ratio);
        heightLeft -= pdfHeight;
      }

      const timestamp = format(new Date(), "dd-MM-yyyy_HH-mm", { locale: ptBR });
      pdf.save(`relatorio-empresas_${timestamp}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Button
        onClick={generatePDF}
        disabled={generating || companies.length === 0}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        {generating ? "Gerando..." : "Baixar PDF"}
      </Button>

      {/* Hidden PDF Content */}
      <div className="fixed left-[-9999px] top-0">
        <div
          ref={reportRef}
          style={{
            width: "1100px",
            padding: "40px",
            backgroundColor: "#ffffff",
            fontFamily: "Arial, sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: "30px", borderBottom: "2px solid #2563eb", paddingBottom: "20px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "#1e293b", marginBottom: "8px" }}>
              Relatório de Empresas
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b" }}>
              Gerado em: {format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
              Filtros: {getActiveFilters()}
            </p>
          </div>

          {/* Summary Cards */}
          <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
            {!isCS && (
              <>
                <div style={{ flex: 1, backgroundColor: "#f0fdf4", padding: "16px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                  <p style={{ fontSize: "12px", color: "#166534", marginBottom: "4px" }}>Valor Total Pago</p>
                  <p style={{ fontSize: "22px", fontWeight: "bold", color: "#15803d" }}>
                    {formatCurrency(summaryMetrics.totalLTV)}
                  </p>
                </div>
                <div style={{ flex: 1, backgroundColor: "#eff6ff", padding: "16px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                  <p style={{ fontSize: "12px", color: "#1e40af", marginBottom: "4px" }}>Ticket Médio</p>
                  <p style={{ fontSize: "22px", fontWeight: "bold", color: "#1d4ed8" }}>
                    {formatCurrency(summaryMetrics.avgTicketGeneral)}
                  </p>
                </div>
                <div style={{ flex: 1, backgroundColor: "#faf5ff", padding: "16px", borderRadius: "8px", border: "1px solid #e9d5ff" }}>
                  <p style={{ fontSize: "12px", color: "#7e22ce", marginBottom: "4px" }}>Valor Mensal Total</p>
                  <p style={{ fontSize: "22px", fontWeight: "bold", color: "#9333ea" }}>
                    {formatCurrency(summaryMetrics.totalContractValue)}
                  </p>
                </div>
              </>
            )}
            <div style={{ flex: 1, backgroundColor: "#fff7ed", padding: "16px", borderRadius: "8px", border: "1px solid #fed7aa" }}>
              <p style={{ fontSize: "12px", color: "#c2410c", marginBottom: "4px" }}>Empresas</p>
              <p style={{ fontSize: "22px", fontWeight: "bold", color: "#ea580c" }}>
                {summaryMetrics.companyCount}
              </p>
            </div>
          </div>

          {/* Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr style={{ backgroundColor: "#1e293b", color: "#ffffff" }}>
                <th style={{ padding: "10px 6px", textAlign: "left", fontWeight: "600" }}>Empresa</th>
                <th style={{ padding: "10px 6px", textAlign: "left", fontWeight: "600" }}>Consultor</th>
                <th style={{ padding: "10px 6px", textAlign: "center", fontWeight: "600" }}>Início</th>
                <th style={{ padding: "10px 6px", textAlign: "center", fontWeight: "600" }}>Meses</th>
                {!isCS && (
                  <>
                    <th style={{ padding: "10px 6px", textAlign: "right", fontWeight: "600" }}>Valor Contrato</th>
                    <th style={{ padding: "10px 6px", textAlign: "right", fontWeight: "600" }}>Ticket/Mês</th>
                  </>
                )}
                <th style={{ padding: "10px 6px", textAlign: "center", fontWeight: "600" }}>Status</th>
                <th style={{ padding: "10px 6px", textAlign: "center", fontWeight: "600" }}>Saúde</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company, index) => {
                const getHealthColor = () => {
                  if (company.health_score === null) return "#64748b";
                  if (company.health_score >= 80) return "#22c55e";
                  if (company.health_score >= 60) return "#eab308";
                  if (company.health_score >= 40) return "#f97316";
                  return "#ef4444";
                };

                return (
                  <tr
                    key={company.id}
                    style={{
                      backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <td style={{ padding: "8px 6px", fontWeight: "500", maxWidth: "180px" }}>{company.name}</td>
                    <td style={{ padding: "8px 6px", color: "#64748b" }}>
                      {company.consultant_name || "—"}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "center" }}>
                      {formatDate(company.contract_start_date)}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "center" }}>{company.contract_months}</td>
                    {!isCS && (
                      <>
                        <td style={{ padding: "8px 6px", textAlign: "right" }}>
                          {formatCurrency(company.total_paid)}
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "right" }}>
                          {formatCurrency(company.avg_ticket)}
                        </td>
                      </>
                    )}
                    <td style={{ padding: "8px 6px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "9px",
                          fontWeight: "500",
                          backgroundColor:
                            company.status === "active"
                              ? "#dcfce7"
                              : company.status === "closed" || company.status === "completed"
                              ? "#fee2e2"
                              : "#fef9c3",
                          color:
                            company.status === "active"
                              ? "#166534"
                              : company.status === "closed" || company.status === "completed"
                              ? "#991b1b"
                              : "#854d0e",
                        }}
                      >
                        {getStatusLabel(company.status)}
                      </span>
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "center" }}>
                      {company.health_score !== null ? (
                        <span style={{ fontWeight: "600", color: getHealthColor() }}>
                          {company.health_score}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer */}
          <div style={{ marginTop: "30px", paddingTop: "20px", borderTop: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: "10px", color: "#94a3b8", textAlign: "center" }}>
              Este relatório foi gerado automaticamente pelo sistema. Total de {companies.length} empresa(s) listada(s).
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
