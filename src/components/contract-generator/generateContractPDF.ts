import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { productDetails } from "@/data/productDetails";
import { contractClauses, companyInfo } from "@/data/contractTemplate";
import { formatCurrencyWithWords, formatCurrencyBR } from "@/lib/numberToWords";
import type { ContractFormData } from "./ContractForm";

// UNV Brand Colors
const NAVY = [10, 34, 64] as const; // #0A2240
const RED = [196, 30, 58] as const; // #C41E3A

interface GeneratePDFOptions {
  formData: ContractFormData;
}

export async function generateContractPDF({ formData }: GeneratePDFOptions): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const selectedProduct = productDetails[formData.productId];
  const today = new Date();
  const installmentValue = formData.contractValue / formData.installments;

  // Helper functions
  const checkPageBreak = (requiredSpace: number) => {
    if (y + requiredSpace > pageHeight - 30) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(text, maxWidth);
  };

  const addText = (text: string, fontSize: number, options?: {
    bold?: boolean;
    color?: readonly [number, number, number];
    align?: "left" | "center" | "right";
    maxWidth?: number;
  }) => {
    const { bold = false, color = [0, 0, 0], align = "left", maxWidth = contentWidth } = options || {};
    
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    
    const lines = wrapText(text, maxWidth, fontSize);
    lines.forEach((line) => {
      checkPageBreak(8);
      let x = margin;
      if (align === "center") x = pageWidth / 2;
      if (align === "right") x = pageWidth - margin;
      doc.text(line, x, y, { align });
      y += fontSize * 0.5;
    });
    
    return lines.length * fontSize * 0.5;
  };

  const addSectionTitle = (title: string) => {
    checkPageBreak(15);
    y += 8;
    addText(title, 11, { bold: true, color: NAVY });
    y += 3;
  };

  // ============ HEADER ============
  // Logo placeholder - drawing a styled "UNV" text
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(pageWidth / 2 - 20, y, 40, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("UNV", pageWidth / 2, y + 8, { align: "center" });
  y += 20;

  // Title
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", pageWidth / 2, y, { align: "center" });
  y += 8;

  // Subtitle with product name
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(selectedProduct.name, pageWidth / 2, y, { align: "center" });
  y += 12;

  // Horizontal line
  doc.setDrawColor(RED[0], RED[1], RED[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ============ PARTIES IDENTIFICATION ============
  addSectionTitle("1. IDENTIFICAÇÃO DAS PARTES");

  // CONTRATANTE
  addText("CONTRATANTE:", 10, { bold: true });
  y += 2;
  addText(`Nome/Razão Social: ${formData.clientName}`, 10);
  addText(`CPF/CNPJ: ${formData.clientDocument}`, 10);
  addText(`Endereço: ${formData.clientAddress}`, 10);
  if (formData.clientEmail) addText(`E-mail: ${formData.clientEmail}`, 10);
  if (formData.clientPhone) addText(`Telefone: ${formData.clientPhone}`, 10);
  y += 5;

  // CONTRATADA
  addText("CONTRATADA:", 10, { bold: true });
  y += 2;
  addText(`Razão Social: ${companyInfo.name}`, 10);
  addText(`CNPJ: ${companyInfo.cnpj}`, 10);
  addText(`Sede: ${companyInfo.address}`, 10);
  addText(`E-mail: ${companyInfo.email}`, 10);
  y += 5;

  // ============ CONTRACT OBJECT ============
  addSectionTitle("2. OBJETO DO CONTRATO");
  
  addText(`Serviço Contratado: ${selectedProduct.name}`, 10, { bold: true });
  y += 2;
  addText(`Descrição: ${selectedProduct.description}`, 10);
  y += 5;

  addText("Entregáveis:", 10, { bold: true });
  y += 2;
  selectedProduct.deliverables.forEach((item, index) => {
    checkPageBreak(8);
    addText(`${index + 1}. ${item}`, 10);
  });
  y += 5;

  // ============ COMMERCIAL CONDITIONS ============
  addSectionTitle("3. CONDIÇÕES COMERCIAIS");

  addText("Valor Total:", 10, { bold: true });
  addText(formatCurrencyWithWords(formData.contractValue), 10);
  y += 3;

  addText("Forma de Pagamento:", 10, { bold: true });
  const paymentMethodLabels = {
    card: "Cartão de Crédito",
    pix: "PIX",
    boleto: "Boleto Bancário",
  };
  addText(paymentMethodLabels[formData.paymentMethod], 10);
  y += 3;

  addText("Condições:", 10, { bold: true });
  if (formData.installments === 1) {
    addText("Pagamento à vista", 10);
  } else {
    addText(`${formData.installments}x de ${formatCurrencyWithWords(installmentValue)} - sem juros`, 10);
  }
  y += 3;

  if (formData.dueDate) {
    addText("Data de Vencimento:", 10, { bold: true });
    addText(format(formData.dueDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), 10);
    y += 3;
  }

  addText("Início do Contrato:", 10, { bold: true });
  addText(
    formData.startDate
      ? format(formData.startDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : "A definir",
    10
  );
  y += 5;

  // ============ CONTRACT CLAUSES ============
  addSectionTitle("4. CLÁUSULAS CONTRATUAIS");
  
  contractClauses.forEach((clause) => {
    checkPageBreak(30);
    y += 3;
    addText(clause.title, 10, { bold: true });
    y += 2;
    const lines = wrapText(clause.content, contentWidth, 9);
    lines.forEach((line) => {
      checkPageBreak(6);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(line, margin, y);
      y += 4.5;
    });
    y += 3;
  });

  // ============ SIGNATURES ============
  checkPageBreak(60);
  y += 15;

  addText(
    `São Paulo, ${format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
    10,
    { align: "center" }
  );
  y += 20;

  // Signature lines
  const signatureY = y;
  const leftX = margin + 20;
  const rightX = pageWidth - margin - 60;

  // CONTRATANTE
  doc.setDrawColor(0, 0, 0);
  doc.line(leftX, signatureY, leftX + 60, signatureY);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("CONTRATANTE", leftX + 30, signatureY + 5, { align: "center" });
  doc.setFontSize(8);
  doc.text(formData.clientName, leftX + 30, signatureY + 10, { align: "center" });
  doc.text(formData.clientDocument, leftX + 30, signatureY + 14, { align: "center" });

  // CONTRATADA
  doc.line(rightX, signatureY, rightX + 60, signatureY);
  doc.setFontSize(9);
  doc.text("CONTRATADA", rightX + 30, signatureY + 5, { align: "center" });
  doc.setFontSize(8);
  doc.text(companyInfo.name, rightX + 30, signatureY + 10, { align: "center" });
  doc.text(companyInfo.cnpj, rightX + 30, signatureY + 14, { align: "center" });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
    doc.text(
      `Contrato gerado em ${format(today, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  return doc.output("blob");
}

export function downloadContractPDF(blob: Blob, clientName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Contrato_${clientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
