import jsPDF from "jspdf";

// Paleta UNV (mesma do generateProjectFullReportPDF)
const NAVY: [number, number, number] = [13, 43, 94];
const NAVY_DK: [number, number, number] = [9, 28, 64];
const RED: [number, number, number] = [204, 27, 27];
const GREY: [number, number, number] = [107, 114, 128];
const DARK: [number, number, number] = [34, 38, 46];
const LIGHT: [number, number, number] = [238, 241, 246];

// Sanitiza strings: emojis/símbolos fora do latin-1 viram lixo na fonte padrão do jsPDF
const cleanStr = (s: string) =>
  (s || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{FE0F}\u{200D}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/ {2,}/g, " ");

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const resp = await fetch("/images/unv-logo-contract.png");
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
    }
    return `data:image/png;base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

export interface BoardDeliverablePDFParams {
  title: string;
  companyName: string;
  contentMd: string;
  version: number;
  date: string; // ISO ou já formatada
}

/**
 * Gera o PDF oficial de um entregável do UNV Board e retorna o doc jsPDF
 * (não salva — quem chama decide entre doc.save() e doc.output("blob")).
 */
export async function generateBoardDeliverablePDF({
  title,
  companyName,
  contentMd,
  version,
  date,
}: BoardDeliverablePDFParams): Promise<jsPDF> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210,
    H = 297,
    M = 20,
    CW = W - 2 * M;

  const setFill = (c: number[]) => pdf.setFillColor(c[0], c[1], c[2]);
  const setText = (c: number[]) => pdf.setTextColor(c[0], c[1], c[2]);

  const cleanTitle = cleanStr(title);
  const cleanCompany = cleanStr(companyName);
  const dateLabel = (() => {
    const d = new Date(date && date.length <= 10 ? `${date}T12:00:00` : date);
    return isNaN(d.getTime())
      ? cleanStr(date)
      : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  })();

  // ============ CAPA ============
  setFill(NAVY);
  pdf.rect(0, 0, W, 10, "F");
  setFill(RED);
  pdf.rect(0, 10, W, 1.6, "F");

  const logo = await loadLogoDataUrl();
  if (logo) {
    try {
      const props = pdf.getImageProperties(logo);
      const lw = 64;
      const lh = lw * (props.height / props.width);
      pdf.addImage(logo, "PNG", (W - lw) / 2, 34, lw, lh);
    } catch {
      // logo indisponível — segue sem imagem
    }
  }

  let y = 120;
  setText(GREY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("UNV BOARD — DOCUMENTO OFICIAL", W / 2, y, { align: "center" });
  y += 16;

  setText(NAVY);
  pdf.setFontSize(26);
  const titleLines = pdf.splitTextToSize(cleanTitle, CW - 10);
  titleLines.forEach((ln: string) => {
    pdf.text(ln, W / 2, y, { align: "center" });
    y += 11;
  });
  y += 2;
  setFill(RED);
  pdf.rect(W / 2 - 28, y, 56, 1.4, "F");
  y += 14;

  setText(NAVY_DK);
  pdf.setFontSize(16);
  pdf.text(cleanCompany, W / 2, y, { align: "center" });

  // card de informações
  y = 208;
  setFill(LIGHT);
  pdf.roundedRect(M + 14, y, CW - 28, 34, 2, 2, "F");
  setFill(NAVY);
  pdf.rect(M + 14, y, 2, 34, "F");
  setText(GREY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("VERSÃO", M + 24, y + 12);
  pdf.text("EMITIDO EM", M + 24, y + 24);
  setText(DARK);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(`v${version}`, M + 60, y + 12);
  pdf.text(dateLabel, M + 60, y + 24);

  // ============ CONTEÚDO (markdown simples) ============
  pdf.addPage();
  y = M + 2;

  const ensure = (h: number) => {
    if (y + h > H - 20) {
      pdf.addPage();
      y = M + 2;
    }
  };

  const lines = (contentMd || "").split("\n");
  for (const raw of lines) {
    const line = cleanStr(raw).replace(/\*\*/g, "").trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      y += 2.6;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      const txt = trimmed.slice(4).trim();
      const tl = pdf.splitTextToSize(txt, CW);
      ensure(tl.length * 6 + 6);
      y += 2;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11.5);
      setText(NAVY_DK);
      tl.forEach((ln: string) => {
        pdf.text(ln, M, y);
        y += 6;
      });
      y += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const txt = trimmed.slice(3).trim();
      const tl = pdf.splitTextToSize(txt, CW);
      ensure(tl.length * 7 + 12);
      y += 4;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13.5);
      setText(NAVY);
      tl.forEach((ln: string) => {
        pdf.text(ln, M, y);
        y += 7;
      });
      setFill(RED);
      pdf.rect(M, y - 3.5, 22, 1, "F");
      y += 3.5;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      const txt = trimmed.slice(2).trim();
      const tl = pdf.splitTextToSize(txt, CW);
      ensure(tl.length * 8 + 14);
      y += 3;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      setText(NAVY);
      tl.forEach((ln: string) => {
        pdf.text(ln, M, y);
        y += 8;
      });
      setFill(NAVY);
      pdf.rect(M, y - 3, CW, 0.8, "F");
      setFill(RED);
      pdf.rect(M, y - 3, 30, 0.8, "F");
      y += 5;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      const isNumbered = /^\d+[.)]\s+/.test(trimmed);
      const marker = isNumbered ? (trimmed.match(/^\d+/) || ["•"])[0] + "." : "";
      const txt = trimmed.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, "");
      const tl = pdf.splitTextToSize(txt, CW - 8);
      ensure(tl.length * 5.4 + 2);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.5);
      setText(DARK);
      if (isNumbered) {
        pdf.setFont("helvetica", "bold");
        setText(NAVY);
        pdf.text(marker, M + 1, y);
        pdf.setFont("helvetica", "normal");
        setText(DARK);
      } else {
        setFill(RED);
        pdf.circle(M + 2, y - 1.4, 0.9, "F");
      }
      tl.forEach((ln: string, i: number) => {
        pdf.text(ln, M + 8, y);
        if (i < tl.length - 1) y += 5.4;
      });
      y += 6;
      continue;
    }

    // parágrafo comum
    const pl = pdf.splitTextToSize(trimmed, CW);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10.5);
    setText(DARK);
    for (const ln of pl) {
      ensure(6.5);
      pdf.text(ln, M, y);
      y += 5.6;
    }
    y += 1.6;
  }

  // ============ RODAPÉ (todas as páginas) ============
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    setFill(NAVY);
    pdf.rect(0, H - 11, W, 11, "F");
    setFill(RED);
    pdf.rect(0, H - 11, 42, 1.1, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    setText([205, 216, 233]);
    pdf.text("Universidade Nacional de Vendas  ·  UNV Board", M, H - 4.5);
    pdf.text(`${i} / ${pages}`, W - M, H - 4.5, { align: "right" });
  }

  return pdf;
}
