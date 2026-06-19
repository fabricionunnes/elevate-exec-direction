import jsPDF from "jspdf";

// Conteúdo da proposta vindo da IA (edge function generate-proposal)
export interface ProposalContent {
  titulo?: string;
  contexto?: string;
  diagnostico?: string[];
  objetivo?: string;
  servico?: string;
  descricao_servico?: string;
  entregas?: string[];
  investimento?: string;
  forma_pagamento?: string;
  prazo?: string;
  proximos_passos?: string[];
}

interface Options {
  proposal: ProposalContent;
  leadName: string;
  companyName?: string | null;
  serviceName?: string;
}

const NAVY: [number, number, number] = [13, 43, 94]; // #0D2B5E
const RED: [number, number, number] = [204, 27, 27]; // #CC1B1B
const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];

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
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL("image/png"), width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = src;
  });
}

// Tenta a logo da UNV Holdings; cai pra logo do contrato; se nada, segue sem imagem.
async function loadLogo(): Promise<LoadedImage | null> {
  for (const src of ["/images/unv-holdings-logo.png", "/images/unv-logo-contract.png"]) {
    try { return await loadImage(src); } catch { /* tenta a próxima */ }
  }
  return null;
}

function fit(w: number, h: number, maxW: number, maxH: number) {
  const r = w / h;
  let width = maxW, height = maxW / r;
  if (height > maxH) { height = maxH; width = maxH * r; }
  return { width, height };
}

export async function generateProposalPDF({ proposal, leadName, companyName, serviceName }: Options): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 0;

  const logo = await loadLogo();

  const ensure = (need: number) => {
    if (y + need > pageH - 22) { footer(); doc.addPage(); y = margin; }
  };

  const footer = () => {
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("UNV Holdings — Universidade Nacional de Vendas", margin, pageH - 9);
    doc.text("unvholdings.com.br", pageW - margin, pageH - 9, { align: "right" });
  };

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 42, "F");
  doc.setFillColor(...RED);
  doc.rect(0, 42, pageW, 1.6, "F");

  if (logo) {
    const { width, height } = fit(logo.width, logo.height, 34, 26);
    try { doc.addImage(logo.dataUrl, "PNG", margin, (42 - height) / 2, width, height); } catch { /* ignore */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PROPOSTA COMERCIAL", pageW - margin, 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(210, 220, 235);
  doc.text("UNV Holdings · Direção Comercial Terceirizada", pageW - margin, 28, { align: "right" });
  y = 54;

  // ── Cliente ────────────────────────────────────────────────────────────────
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const cliente = companyName || leadName || "Cliente";
  doc.text(cliente, margin, y);
  y += 6;
  if (companyName && leadName && companyName !== leadName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(`A/C ${leadName}`, margin, y);
    y += 5;
  }
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(hoje, margin, y);
  y += 8;

  // ── Helpers de seção ────────────────────────────────────────────────────────
  const sectionTitle = (label: string) => {
    ensure(14);
    doc.setFillColor(...NAVY);
    doc.rect(margin, y - 3.4, 3, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...NAVY);
    doc.text(label.toUpperCase(), margin + 5, y);
    y += 7;
  };

  const paragraph = (text: string) => {
    if (!text) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(text, contentW);
    for (const ln of lines) { ensure(6); doc.text(ln, margin, y); y += 5.4; }
    y += 2;
  };

  const bullets = (items: string[]) => {
    doc.setFontSize(10.5);
    for (const it of items || []) {
      if (!it) continue;
      const lines = doc.splitTextToSize(String(it), contentW - 6);
      ensure(lines.length * 5.4 + 1);
      doc.setFillColor(...RED);
      doc.circle(margin + 1.4, y - 1.4, 1, "F");
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...INK);
      lines.forEach((ln: string, i: number) => {
        doc.text(ln, margin + 6, y);
        y += 5.4;
        if (i < lines.length - 1) { /* continua */ }
      });
      y += 1;
    }
    y += 2;
  };

  // ── Conteúdo ────────────────────────────────────────────────────────────────
  if (proposal.contexto) { sectionTitle("Contexto"); paragraph(proposal.contexto); }

  if (proposal.diagnostico?.length) { sectionTitle("Diagnóstico"); bullets(proposal.diagnostico); }

  if (proposal.objetivo) { sectionTitle("Objetivo"); paragraph(proposal.objetivo); }

  const servico = proposal.servico || serviceName;
  if (servico || proposal.entregas?.length) {
    sectionTitle(`Solução${servico ? ` — ${servico}` : ""}`);
    if (proposal.descricao_servico) paragraph(proposal.descricao_servico);
    if (proposal.entregas?.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      ensure(7);
      doc.text("Entregas:", margin, y); y += 6;
      bullets(proposal.entregas);
    }
  }

  // ── Investimento (valor + forma de pagamento, extraídos da reunião) ──────────
  const investimento = proposal.investimento || "A combinar";
  const formaPg = proposal.forma_pagamento || "A combinar";
  ensure(34);
  sectionTitle("Investimento");
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  const boxY = y - 2;
  const boxH = 22 + (proposal.prazo ? 6 : 0);
  doc.roundedRect(margin, boxY, contentW, boxH, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("VALOR", margin + 5, boxY + 7);
  doc.text("FORMA DE PAGAMENTO", margin + contentW / 2, boxY + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(doc.splitTextToSize(investimento, contentW / 2 - 8), margin + 5, boxY + 14);
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(doc.splitTextToSize(formaPg, contentW / 2 - 8), margin + contentW / 2, boxY + 14);
  if (proposal.prazo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`Prazo / vigência: ${proposal.prazo}`, margin + 5, boxY + boxH - 4);
  }
  y = boxY + boxH + 8;

  if (proposal.proximos_passos?.length) { sectionTitle("Próximos passos"); bullets(proposal.proximos_passos); }

  // ── Briefing institucional ──────────────────────────────────────────────────
  ensure(30);
  sectionTitle("Sobre a UNV Holdings");
  paragraph(
    "A UNV Holdings é a sua direção comercial terceirizada: estruturamos o time de vendas, implantamos processo e gestão e fazemos a empresa bater meta com previsibilidade — sem depender do dono na operação. Não vendemos marketing; entregamos resultado comercial estruturado, acompanhado por métricas (ticket médio, conversão, CAC, LTV, NPS) e por uma rotina de gestão contínua.",
  );

  footer();
  return doc.output("blob");
}
