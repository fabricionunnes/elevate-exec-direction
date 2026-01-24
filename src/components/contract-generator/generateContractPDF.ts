import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { productDetails } from "@/data/productDetails";
import { contractClauses, companyInfo } from "@/data/contractTemplate";
import { formatCurrencyWithWords, formatCurrencyBR } from "@/lib/numberToWords";
import type { ContractFormData } from "./ContractForm";
import { formatFullAddress } from "./ContractForm";

// UNV Brand Colors
const NAVY = [10, 34, 64] as const; // #0A2240
const RED = [220, 38, 38] as const; // #DC2626

interface CustomClause {
  id: string;
  title: string;
  content: string;
  isDynamic?: boolean;
}

interface GeneratePDFOptions {
  formData: ContractFormData;
  customClauses?: CustomClause[];
}

type LoadedImage = {
  dataUrl: string;
  width: number;
  height: number;
};

// Convert image to base64 + keep original dimensions (for correct aspect ratio)
async function loadImage(src: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Could not get canvas context"));
      ctx.drawImage(img, 0, 0);
      resolve({
        dataUrl: canvas.toDataURL("image/png"),
        width: img.width,
        height: img.height,
      });
    };
    img.onerror = reject;
    img.src = src;
  });
}

function fitImage(
  imgWidth: number,
  imgHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  // Fit inside box preserving aspect ratio
  const ratio = imgWidth / imgHeight;
  let width = maxWidth;
  let height = width / ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  return { width, height };
}

export async function generateContractPDF({ formData, customClauses }: GeneratePDFOptions): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 25; // Increased margin to account for left stripes
  const contentWidth = pageWidth - margin - 20; // Right margin stays at 20
  let y = margin;

  const selectedProduct = productDetails[formData.productId];
  const today = new Date();
  const installmentValue = formData.contractValue / formData.installments;

  // Load logo from public folder
  let logo: LoadedImage | null = null;
  try {
    logo = await loadImage("/images/unv-logo-contract.png");
  } catch (e) {
    console.warn("Could not load logo:", e);
  }

  // Add page decorations (stripes and watermark)
  const addPageDecorations = () => {
    // Left blue stripe (thicker)
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(0, 0, 6, pageHeight, "F");
    
    // Left red stripe (thinner, next to blue)
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.rect(6, 0, 2, pageHeight, "F");
    
    // Watermark - centered logo with low opacity
    if (logo) {
      try {
        // Add watermark with transparency using GState
        const gState = doc.GState({ opacity: 0.06 });
        doc.setGState(gState);
        
        // Large centered watermark - preserve real aspect ratio
        const { width: wmWidth, height: wmHeight } = fitImage(
          logo.width,
          logo.height,
          120,
          120
        );
        const wmX = (pageWidth - wmWidth) / 2;
        const wmY = (pageHeight - wmHeight) / 2;
        doc.addImage(logo.dataUrl, "PNG", wmX, wmY, wmWidth, wmHeight);
        
        // Reset opacity
        doc.setGState(doc.GState({ opacity: 1 }));
      } catch (e) {
        console.warn("Could not add watermark:", e);
      }
    }
  };

  // Helper functions
  const checkPageBreak = (requiredSpace: number) => {
    if (y + requiredSpace > pageHeight - 30) {
      doc.addPage();
      addPageDecorations();
      y = margin;
      // No header logo on continuation pages - only watermark
      return true;
    }
    return false;
  };
  
  // Add decorations to first page
  addPageDecorations();

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
  if (logo) {
    try {
      // Header logo - preserve real aspect ratio
      const { width: hW, height: hH } = fitImage(logo.width, logo.height, 60, 50);
      doc.addImage(logo.dataUrl, "PNG", pageWidth / 2 - hW / 2, y, hW, hH);
      y += hH + 8;
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
  const fullAddress = formatFullAddress(formData);
  
  if (isCompany) {
    // Company format
    addText(`${formData.clientName}, sociedade empresária inscrita no CNPJ sob o nº ${formData.clientDocument}, com sede na ${fullAddress}, e endereço eletrônico ${formData.clientEmail}, neste ato representada por ${formData.legalRepName}, ${formData.legalRepNationality || "brasileiro(a)"}, ${formData.legalRepMaritalStatus}, ${formData.legalRepProfession}, portador(a) da Cédula de Identidade RG nº ${formData.legalRepRg}, inscrito(a) no CPF sob o nº ${formData.legalRepCpf}.`, 10);
  } else {
    // Individual format
    addText(`${formData.legalRepName || formData.clientName}, ${formData.legalRepNationality || "brasileiro(a)"}, ${formData.legalRepMaritalStatus}, ${formData.legalRepProfession}, portador(a) da Cédula de Identidade RG nº ${formData.legalRepRg}, inscrito(a) no CPF sob o nº ${formData.legalRepCpf || formData.clientDocument}${fullAddress ? `, residente e domiciliado(a) na ${fullAddress}` : ""}${formData.clientEmail ? `, e-mail: ${formData.clientEmail}` : ""}.`, 10);
  }
  y += 8;

  // ============ CONTRACT CLAUSES ============
  // Use custom clauses if provided, otherwise use defaults
  const clausesToRender = customClauses || contractClauses;
  
  clausesToRender.forEach((clause) => {
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
      
      if (formData.isRecurring) {
        // Recurring payment
        addText(`I. O valor do presente contrato será de ${formatCurrencyWithWords(formData.contractValue)} mensais, com cobrança recorrente.`, 10);
        y += 2;
        
        addText(`II. O pagamento será realizado mensalmente via ${paymentMethodLabels[formData.paymentMethod]}, de forma recorrente.`, 10);
        y += 2;
      } else {
        // Regular installments
        addText(`I. O valor do presente contrato será de ${formatCurrencyWithWords(formData.contractValue)}.`, 10);
        y += 2;
        
        if (formData.installments === 1) {
          addText(`II. O pagamento será realizado à vista via ${paymentMethodLabels[formData.paymentMethod]}.`, 10);
        } else {
          addText(`II. O pagamento será realizado em ${formData.installments}x de ${formatCurrencyWithWords(installmentValue)}, sem juros, via ${paymentMethodLabels[formData.paymentMethod]}.`, 10);
        }
        y += 2;
      }
      
      if (formData.dueDate) {
        addText(`Vencimento: ${format(formData.dueDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, 10);
        y += 2;
      }
      
      addText(`III. Em caso de atraso no pagamento, incidirão:
• Multa moratória de 2%
• Juros de mora de 1% ao dia`, 10);
      y += 2;
      
      // Conditional clause IV based on payment type
      if (formData.isRecurring) {
        // Recurring payment - cancellation clause
        addText("IV. A rescisão poderá ser feita com aviso prévio de 30 dias do vencimento da próxima parcela.", 10);
      } else if (formData.paymentMethod === "card") {
        // Credit card installments - payment obligation clause
        addText("IV. Este contrato caracteriza-se como prestação de serviço com pagamento parcelado. O não uso dos serviços não isenta a CONTRATANTE do pagamento das parcelas acordadas.", 10);
      }
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

  // Signature lines - properly spaced
  const signatureY = y;
  const signatureWidth = 70;
  const gap = 20; // Gap between signatures
  const totalSignaturesWidth = signatureWidth * 2 + gap;
  const leftX = (pageWidth - totalSignaturesWidth) / 2;
  const rightX = leftX + signatureWidth + gap;

  // CONTRATADA signature
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(leftX, signatureY, leftX + signatureWidth, signatureY);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(companyInfo.representative.toUpperCase(), leftX + signatureWidth / 2, signatureY + 6, { align: "center" });
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("CONTRATADA", leftX + signatureWidth / 2, signatureY + 12, { align: "center" });

  // CONTRATANTE signature
  doc.line(rightX, signatureY, rightX + signatureWidth, signatureY);
  
  // Use legal representative name if available, otherwise client name
  const signerName = formData.legalRepName || formData.clientName;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(signerName.toUpperCase(), rightX + signatureWidth / 2, signatureY + 6, { align: "center" });
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("CONTRATANTE", rightX + signatureWidth / 2, signatureY + 12, { align: "center" });

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
