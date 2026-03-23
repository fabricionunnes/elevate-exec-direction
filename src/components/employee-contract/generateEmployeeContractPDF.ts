import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { employeeContractCompanyInfo, roleLabels } from "@/data/employeeContractTemplate";
import { formatCurrencyBR } from "@/lib/numberToWords";
import type { EmployeeContractFormData } from "./EmployeeContractForm";

const NAVY = [10, 34, 64] as const;
const RED = [220, 38, 38] as const;

interface CustomClause {
  id: string;
  title: string;
  content: string;
  isDynamic?: boolean;
}

interface GenerateOptions {
  formData: EmployeeContractFormData;
  customClauses?: CustomClause[];
}

async function loadImage(src: string): Promise<{ dataUrl: string; width: number; height: number }> {
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
      resolve({ dataUrl: canvas.toDataURL("image/png"), width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = src;
  });
}

function fitImage(imgW: number, imgH: number, maxW: number, maxH: number) {
  const ratio = imgW / imgH;
  let w = maxW, h = maxW / ratio;
  if (h > maxH) { h = maxH; w = h * ratio; }
  return { width: w, height: h };
}

export async function generateEmployeeContractPDF({ formData, customClauses }: GenerateOptions): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pw - marginLeft - marginRight;
  const info = employeeContractCompanyInfo;

  // Try load logo
  let logo: { dataUrl: string; width: number; height: number } | null = null;
  try {
    logo = await loadImage("/lovable-uploads/c1e06995-0a6e-4c72-8568-a1e84b16be13.png");
  } catch {}

  const addHeader = (isFirst = false) => {
    // Top bar
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pw, 3, "F");
    doc.setFillColor(...RED);
    doc.rect(0, 3, pw, 1.5, "F");

    if (logo) {
      const fit = fitImage(logo.width, logo.height, 35, 15);
      doc.addImage(logo.dataUrl, "PNG", marginLeft, 8, fit.width, fit.height);
    }
  };

  const addFooter = (pageNum: number) => {
    doc.setFillColor(...RED);
    doc.rect(0, ph - 4.5, pw, 1.5, "F");
    doc.setFillColor(...NAVY);
    doc.rect(0, ph - 3, pw, 3, "F");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Universidade Nacional de Vendas LTDA — CNPJ 51.356.237/0001-40", pw / 2, ph - 7, { align: "center" });
    doc.text(`Página ${pageNum}`, pw - marginRight, ph - 7, { align: "right" });
  };

  let pageNum = 1;
  let y = 0;

  // Track current font state for restoration after page breaks
  let _currentFontSize = 9;
  let _currentFontStyle: string = "normal";
  let _currentTextColor: [number, number, number] = [50, 50, 50];

  const checkPage = (needed: number) => {
    if (y + needed > ph - 20) {
      addFooter(pageNum);
      doc.addPage();
      pageNum++;
      addHeader();
      y = 28;
      // Restore font state after page break (footer/header change it)
      doc.setFontSize(_currentFontSize);
      doc.setFont("helvetica", _currentFontStyle);
      doc.setTextColor(..._currentTextColor);
    }
  };

  const writeWrapped = (text: string, startY: number, fontSize = 10, lineH = 5): number => {
    _currentFontSize = fontSize;
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      checkPage(lineH + 2);
      doc.text(line, marginLeft, y);
      y += lineH;
    }
    return y;
  };

  // ===== PAGE 1 =====
  addHeader(true);
  y = 28;

  // Title
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS", pw / 2, y, { align: "center" });
  y += 10;

  // IDENTIFICAÇÃO DAS PARTES
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("IDENTIFICAÇÃO DAS PARTES", marginLeft, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "normal");
  const introText = "As partes abaixo identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descritas no presente neste contrato.";
  y = writeWrapped(introText, y);
  y += 4;

  // CONTRATANTE
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("CONTRATANTE", marginLeft, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  const contratanteText = `${info.representative}, sociedade empresária com nome fantasia ${info.fantasyName} e nome jurídico ${info.name}, inscrita no CNPJ sob o nº ${info.cnpj}, com sede na ${info.address}, endereço eletrônico ${info.email}, neste ato, representada por ${info.representative}, brasileiro, ${info.maritalStatus}, ${info.role}, endereço eletrônico ${info.email} portador da Cédula de Identidade RG n° ${info.rg}, inscrito no CPF sob o n° ${info.cpf}, residente e domiciliado à ${info.address} denominado CONTRATANTE`;
  y = writeWrapped(contratanteText, y);
  y += 6;

  // CONTRATADA
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("CONTRATADA", marginLeft, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  const roleLabel = roleLabels[formData.staffRole] || formData.staffRole;
  let contratadaText = `${formData.staffName.toUpperCase()}, ${roleLabel}`;
  if (formData.staffAddress) contratadaText += `, residente na ${formData.staffAddress}`;
  contratadaText += `, portador do CPF nº ${formData.staffCpf}`;
  if (formData.staffCnpj) contratadaText += ` e CNPJ nº ${formData.staffCnpj}`;
  contratadaText += `, têm justo e acertado o presente CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS, que se regerá pelas disposições legais aplicáveis à espécie e demais condições abaixo ajustadas, sendo este contrato substituindo todos os contratos anteriormente assinados.`;
  y = writeWrapped(contratadaText, y);
  y += 8;

  // CLAUSES
  const clauses = customClauses || [];
  for (const clause of clauses) {
    _currentFontSize = 10;
    _currentFontStyle = "bold";
    _currentTextColor = [...NAVY] as [number, number, number];
    checkPage(15);
    // Clause title
    doc.setFillColor(245, 245, 245);
    doc.rect(marginLeft, y - 4, contentWidth, 7, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(clause.title, marginLeft + 2, y);
    y += 6;

    // Clause content
    _currentFontStyle = "normal";
    _currentTextColor = [50, 50, 50];
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);

    // Special handling for payment clause - inject actual values
    let content = clause.content;
    if (clause.id === "pagamento" && formData.contractValue > 0) {
      const valueFormatted = formatCurrencyBR(formData.contractValue);
      content = content.replace(
        "remunerados pela quantia especificada neste instrumento",
        `remunerados pela quantia total de ${valueFormatted} por mês`
      );
    }
    if (clause.id === "prazo" && formData.durationMonths) {
      content = content.replace(
        "válido por 3 meses",
        `válido por ${formData.durationMonths} meses`
      );
    }
    if (clause.id === "servicos" && formData.startDate) {
      const dateStr = format(formData.startDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      content = content.replace(
        "na data especificada neste contrato",
        `no dia ${dateStr}`
      );
    }

    y = writeWrapped(content, y);
    y += 6;
  }

  // Signature area
  checkPage(50);
  y += 10;
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "normal");
  const dateStr = formData.startDate
    ? format(formData.startDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : "_____ de __________ de _____";
  doc.text(`${info.city}, ${dateStr}.`, pw / 2, y, { align: "center" });
  y += 20;

  // Signature lines
  const sigWidth = 70;
  const sigX1 = pw / 2 - sigWidth - 10;
  const sigX2 = pw / 2 + 10;

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.line(sigX1, y, sigX1 + sigWidth, y);
  doc.line(sigX2, y, sigX2 + sigWidth, y);
  y += 4;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CONTRATANTE", sigX1 + sigWidth / 2, y, { align: "center" });
  doc.text("CONTRATADA", sigX2 + sigWidth / 2, y, { align: "center" });

  addFooter(pageNum);

  return doc.output("blob");
}

export function downloadEmployeeContractPDF(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Contrato_Colaborador_${name.replace(/\s+/g, "_")}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
