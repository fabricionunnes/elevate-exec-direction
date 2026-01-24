import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { productDetails } from "@/data/productDetails";
import { contractClauses, companyInfo } from "@/data/contractTemplate";
import { formatCurrencyWithWords, formatCurrencyBR } from "@/lib/numberToWords";
import type { ContractFormData } from "./ContractForm";
import logoUnv from "@/assets/logo-unv-contract.png";

// UNV Brand Colors
const NAVY = [10, 34, 64] as const; // #0A2240

interface GeneratePDFOptions {
  formData: ContractFormData;
}

// Convert image to base64
async function loadImage(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } else {
        reject(new Error("Could not get canvas context"));
      }
    };
    img.onerror = reject;
    img.src = src;
  });
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

  // Load logo
  let logoBase64: string | null = null;
  try {
    logoBase64 = await loadImage(logoUnv);
  } catch (e) {
    console.warn("Could not load logo:", e);
  }

  // Helper functions
  const checkPageBreak = (requiredSpace: number) => {
    if (y + requiredSpace > pageHeight - 30) {
      doc.addPage();
      y = margin;
      addHeader();
      return true;
    }
    return false;
  };

  const addHeader = () => {
    // Logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", pageWidth / 2 - 25, 10, 50, 15);
      } catch (e) {
        console.warn("Could not add logo to PDF:", e);
        // Fallback text
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
        doc.text("UNIVERSIDADE NACIONAL DE VENDAS", pageWidth / 2, 18, { align: "center" });
      }
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text("UNIVERSIDADE NACIONAL DE VENDAS", pageWidth / 2, 18, { align: "center" });
    }
    y = 35;
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
    lineHeight?: number;
  }) => {
    const { 
      bold = false, 
      color = [0, 0, 0], 
      align = "left", 
      maxWidth = contentWidth,
      lineHeight = fontSize * 0.5 
    } = options || {};
    
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
      y += lineHeight;
    });
    
    return lines.length * lineHeight;
  };

  const addSectionTitle = (title: string) => {
    checkPageBreak(15);
    y += 6;
    addText(title, 11, { bold: true, color: NAVY });
    y += 3;
  };

  // ============ FIRST PAGE HEADER ============
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", pageWidth / 2 - 30, y, 60, 18);
      y += 25;
    } catch (e) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text("UNIVERSIDADE NACIONAL DE VENDAS", pageWidth / 2, y + 10, { align: "center" });
      y += 20;
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text("UNIVERSIDADE NACIONAL DE VENDAS", pageWidth / 2, y + 10, { align: "center" });
    y += 20;
  }

  // Title
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`CONTRATO DE PRESTAÇÃO DE SERVIÇOS – ${selectedProduct.name.toUpperCase()}`, pageWidth / 2, y, { align: "center" });
  y += 12;

  // ============ PARTIES IDENTIFICATION ============
  addSectionTitle("IDENTIFICAÇÃO DAS PARTES");

  addText("As partes abaixo identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descritas no presente neste contrato.", 10);
  y += 5;

  // CONTRATADA
  addText("CONTRATADA:", 10, { bold: true });
  addText(`${companyInfo.name}, inscrita no CNPJ sob o nº ${companyInfo.cnpj}, com sede na ${companyInfo.address}, e-mail: ${companyInfo.email}, neste ato representada por seu ${companyInfo.role}, ${companyInfo.representative}, CPF ${companyInfo.cpf} e RG ${companyInfo.rg}.`, 10);
  y += 5;

  // CONTRATANTE
  addText("CONTRATANTE:", 10, { bold: true });
  
  // Check if it's a company (CNPJ) or individual (CPF)
  const isCompany = formData.clientDocument.replace(/\D/g, "").length > 11;
  
  if (isCompany) {
    // Company format
    addText(`${formData.clientName}, sociedade empresária inscrita no CNPJ sob o nº ${formData.clientDocument}, com sede na ${formData.clientAddress}, e endereço eletrônico ${formData.clientEmail}, neste ato representada por ${formData.legalRepName}, ${formData.legalRepNationality || "brasileiro(a)"}, ${formData.legalRepMaritalStatus}, ${formData.legalRepProfession}, portador(a) da Cédula de Identidade RG nº ${formData.legalRepRg}, inscrito(a) no CPF sob o nº ${formData.legalRepCpf}.`, 10);
  } else {
    // Individual format
    addText(`${formData.legalRepName || formData.clientName}, ${formData.legalRepNationality || "brasileiro(a)"}, ${formData.legalRepMaritalStatus}, ${formData.legalRepProfession}, portador(a) da Cédula de Identidade RG nº ${formData.legalRepRg}, inscrito(a) no CPF sob o nº ${formData.legalRepCpf || formData.clientDocument}${formData.clientAddress ? `, residente e domiciliado(a) na ${formData.clientAddress}` : ""}${formData.clientEmail ? `, e-mail: ${formData.clientEmail}` : ""}.`, 10);
  }
  y += 8;

  // ============ CONTRACT CLAUSES ============
  contractClauses.forEach((clause) => {
    checkPageBreak(25);
    
    addSectionTitle(clause.title);
    
    if (clause.isDynamic && clause.id === "entrega") {
      // Dynamic deliverables clause
      addText(clause.content, 10);
      y += 3;
      
      selectedProduct.deliverables.forEach((item, index) => {
        checkPageBreak(8);
        addText(`• ${item}`, 10);
      });
      y += 3;
    } else if (clause.id === "investimento") {
      // Add payment details to investment clause
      const paymentMethodLabels = {
        card: "Cartão de Crédito",
        pix: "PIX",
        boleto: "Boleto Bancário",
      };
      
      addText(`I. O valor do presente contrato será de ${formatCurrencyWithWords(formData.contractValue)}.`, 10);
      y += 2;
      
      if (formData.installments === 1) {
        addText(`II. O pagamento será realizado à vista via ${paymentMethodLabels[formData.paymentMethod]}.`, 10);
      } else {
        addText(`II. O pagamento será realizado em ${formData.installments}x de ${formatCurrencyWithWords(installmentValue)}, sem juros, via ${paymentMethodLabels[formData.paymentMethod]}.`, 10);
      }
      y += 2;
      
      if (formData.dueDate) {
        addText(`Vencimento: ${format(formData.dueDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, 10);
        y += 2;
      }
      
      addText(`III. Em caso de atraso no pagamento, incidirão:
• Multa moratória de 2%
• Juros de mora de 1% ao dia`, 10);
      y += 2;
      
      addText("IV. Este contrato caracteriza-se como prestação de serviço com pagamento parcelado. O não uso dos serviços não isenta a CONTRATANTE do pagamento das parcelas acordadas.", 10);
      y += 2;
      
      addText("V. A rescisão poderá ser feita com aviso prévio de 30 dias do vencimento da próxima parcela.", 10);
      y += 3;
    } else {
      // Regular clause
      const lines = wrapText(clause.content, contentWidth, 10);
      lines.forEach((line) => {
        checkPageBreak(6);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(line, margin, y);
        y += 5;
      });
      y += 3;
    }
  });

  // ============ SIGNATURES ============
  checkPageBreak(70);
  y += 15;

  // Date and location
  const startDate = formData.startDate || today;
  addText(
    `${companyInfo.city}, ${companyInfo.state} ${format(startDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
    11,
    { align: "center", bold: true }
  );
  y += 25;

  // Signature lines
  const signatureY = y;
  const leftX = margin + 15;
  const rightX = pageWidth - margin - 75;

  // CONTRATADA signature
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(leftX, signatureY, leftX + 70, signatureY);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(companyInfo.representative.toUpperCase(), leftX + 35, signatureY + 6, { align: "center" });
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("CONTRATADA", leftX + 35, signatureY + 12, { align: "center" });

  // CONTRATANTE signature
  doc.line(rightX, signatureY, rightX + 70, signatureY);
  
  // Use legal representative name if available, otherwise client name
  const signerName = formData.legalRepName || formData.clientName;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(signerName.toUpperCase(), rightX + 35, signatureY + 6, { align: "center" });
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("CONTRATANTE", rightX + 35, signatureY + 12, { align: "center" });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Add header logo on pages after first
    if (i > 1) {
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, "PNG", pageWidth / 2 - 20, 8, 40, 12);
        } catch (e) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
          doc.text("UNIVERSIDADE NACIONAL DE VENDAS", pageWidth / 2, 15, { align: "center" });
        }
      }
    }
    
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  return doc.output("blob");
}

export function downloadContractPDF(blob: Blob, clientName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Contrato_UNV_${clientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
