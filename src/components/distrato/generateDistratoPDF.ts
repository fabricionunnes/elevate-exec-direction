import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { distratoCompanyInfo } from "@/data/distratoTemplate";
import type { DistratoFormData } from "./DistratoForm";
import type { EditableDistratoClause } from "./DistratoClausesEditor";
import signatureImage from "@/assets/assinatura-fabricio.png";

const NAVY = [10, 34, 64] as const;
const RED = [220, 38, 38] as const;

type LoadedImage = { dataUrl: string; width: number; height: number };

async function loadImage(src: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));
      ctx.drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL("image/png"), width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = src;
  });
}

function fitImage(iw: number, ih: number, mw: number, mh: number) {
  const r = iw / ih;
  let w = mw, h = w / r;
  if (h > mh) { h = mh; w = h * r; }
  return { width: w, height: h };
}

interface GenerateDistratoOptions {
  formData: DistratoFormData;
  clauses: EditableDistratoClause[];
}

export async function generateDistratoPDF({ formData, clauses }: GenerateDistratoOptions): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 25;
  const cw = pw - margin - 20;
  let y = margin;

  // Load assets
  let logo: LoadedImage | null = null;
  let signature: LoadedImage | null = null;
  try { logo = await loadImage("/images/unv-logo-contract.png"); } catch {}
  try { signature = await loadImage(signatureImage); } catch {}

  const addDecorations = () => {
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(0, 0, 6, ph, "F");
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.rect(6, 0, 2, ph, "F");
    if (logo) {
      try {
        const gs = doc.GState({ opacity: 0.06 });
        doc.setGState(gs);
        const { width: ww, height: wh } = fitImage(logo.width, logo.height, 120, 120);
        doc.addImage(logo.dataUrl, "PNG", (pw - ww) / 2, (ph - wh) / 2, ww, wh);
        doc.setGState(doc.GState({ opacity: 1 }));
      } catch {}
    }
  };

  const checkPageBreak = (space: number) => {
    if (y + space > ph - 30) {
      doc.addPage();
      addDecorations();
      y = margin;
      return true;
    }
    return false;
  };

  const wrapText = (text: string, maxW: number, fs: number) => {
    doc.setFontSize(fs);
    return doc.splitTextToSize(text, maxW);
  };

  const addText = (text: string, fs: number, opts?: { bold?: boolean; color?: readonly [number, number, number]; align?: "left" | "center"; maxWidth?: number; lineHeight?: number }) => {
    const { bold = false, color = [0, 0, 0], align = "left", maxWidth = cw, lineHeight = fs * 0.5 } = opts || {};
    doc.setFontSize(fs);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = wrapText(text, maxWidth, fs);
    lines.forEach((line: string) => {
      checkPageBreak(8);
      const x = align === "center" ? pw / 2 : margin;
      doc.text(line, x, y, { align });
      y += lineHeight;
    });
  };

  const addSection = (title: string) => {
    checkPageBreak(15);
    y += 6;
    addText(title, 11, { bold: true, color: NAVY });
    y += 3;
  };

  // === First page ===
  addDecorations();

  if (logo) {
    try {
      const { width: hw, height: hh } = fitImage(logo.width, logo.height, 60, 50);
      doc.addImage(logo.dataUrl, "PNG", pw / 2 - hw / 2, y, hw, hh);
      y += hh + 8;
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text("UNIVERSIDADE NACIONAL DE VENDAS", pw / 2, y + 10, { align: "center" });
      y += 20;
    }
  }

  // Title
  addText("DISTRATO DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS", 14, { bold: true, color: NAVY, align: "center" });
  y += 10;

  // Intro text
  addText("Pelo presente instrumento particular de Distrato Contratual, de um lado:", 10);
  y += 5;

  // CONTRATADA
  addText("CONTRATADA:", 10, { bold: true });
  addText(`${distratoCompanyInfo.name}, pessoa jurídica de direito privado, inscrita no CNPJ nº ${distratoCompanyInfo.cnpj}, com sede em ${distratoCompanyInfo.address}, neste ato representada por seu representante legal ${distratoCompanyInfo.representative}, doravante denominada CONTRATADA.`, 10);
  y += 5;

  addText("E de outro lado:", 10);
  y += 3;

  // CONTRATANTE
  addText("CONTRATANTE:", 10, { bold: true });
  const isCompany = (formData.companyCnpj.replace(/\D/g, "").length || 0) > 11;
  const entityType = isCompany ? "pessoa jurídica" : "pessoa física";
  const docLabel = isCompany ? "CNPJ" : "CPF";
  const locationLabel = isCompany ? "com sede em" : "com endereço em";
  let contratanteText = `${formData.companyName}, ${entityType} inscrita no ${docLabel} nº ${formData.companyCnpj || "_______________"}, ${locationLabel} ${formData.companyAddress || "_______________"}`;
  if (formData.legalRepName) {
    contratanteText += `, neste ato representada por ${formData.legalRepName}`;
  }
  contratanteText += ", doravante denominada CONTRATANTE.";
  addText(contratanteText, 10);
  y += 5;

  addText("As partes acima identificadas resolvem, de comum acordo, firmar o presente DISTRATO DO CONTRATO DE PRESTAÇÃO DE SERVIÇOS, mediante as seguintes cláusulas e condições:", 10);
  y += 8;

  // === Clauses ===
  clauses.forEach((clause) => {
    addSection(clause.title);

    let content = clause.content;
    // Replace dynamic placeholders
    if (clause.isDynamic) {
      content = content.replace("{contract_date}", formData.contractDate || "____/____/________");
      content = content.replace("{service_description}", formData.serviceDescription || "________________________________");
    }

    const lines = wrapText(content, cw, 10);
    lines.forEach((line: string) => {
      checkPageBreak(6);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(line, margin, y);
      y += 5;
    });
    y += 3;
  });

  // === Closing ===
  checkPageBreak(20);
  y += 5;
  addText("E por estarem justas e acordadas, firmam o presente instrumento em duas vias de igual teor.", 10);
  y += 8;

  // Location & date
  const distratoDate = formData.distratoDate || new Date();
  addText(`${distratoCompanyInfo.city}, ${format(distratoDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, 11, { align: "center", bold: true });
  y += 20;

  // === Signatures ===
  checkPageBreak(70);
  const sigY = y;
  const sigW = 70;
  const gap = 20;
  const totalW = sigW * 2 + gap;
  const leftX = (pw - totalW) / 2;
  const rightX = leftX + sigW + gap;

  // CONTRATADA signature with image
  if (signature) {
    try {
      const { width: sw, height: sh } = fitImage(signature.width, signature.height, 40, 25);
      doc.addImage(signature.dataUrl, "PNG", leftX + (sigW - sw) / 2, sigY - sh - 2, sw, sh);
    } catch {}
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(leftX, sigY, leftX + sigW, sigY);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(distratoCompanyInfo.representative.toUpperCase(), leftX + sigW / 2, sigY + 6, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("CONTRATADA", leftX + sigW / 2, sigY + 12, { align: "center" });

  // CONTRATANTE signature
  doc.line(rightX, sigY, rightX + sigW, sigY);
  const signerName = formData.legalRepName || formData.companyName;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(signerName.toUpperCase(), rightX + sigW / 2, sigY + 6, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("CONTRATANTE", rightX + sigW / 2, sigY + 12, { align: "center" });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Página ${i} de ${totalPages}`, pw / 2, ph - 10, { align: "center" });
  }

  return doc.output("blob");
}

export function downloadDistratoPDF(blob: Blob, companyName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Distrato_UNV_${companyName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
