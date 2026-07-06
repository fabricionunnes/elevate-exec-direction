import jsPDF from "jspdf";

// Conteúdo da proposta vindo da IA (edge function generate-proposal)
export interface ProposalContent {
  headline_l1?: string;
  headline_l2?: string;
  subtitulo?: string;
  quote?: string;
  preparado_para_detalhe?: string;
  diagnostico_titulo?: string;
  diagnostico?: { titulo: string; descricao: string }[];
  virada_frase?: string;
  antes_depois?: { hoje: string; meta: string }[];
  solucao_intro?: string;
  servico?: string;
  entregas?: string[];
  investimento?: string;
  forma_pagamento?: string;
  prazo?: string;
  proximos_passos?: { titulo: string; descricao: string }[];
  cta?: string;
  // compat com versão antiga
  contexto?: string;
  objetivo?: string;
}

interface Options {
  proposal: ProposalContent;
  leadName: string;
  companyName?: string | null;
  serviceName?: string;
}

const NAVY: [number, number, number] = [13, 43, 94];
const NAVY_DK: [number, number, number] = [9, 28, 64];
const RED: [number, number, number] = [204, 27, 27];
const INK: [number, number, number] = [33, 43, 60];
const MUTED: [number, number, number] = [110, 122, 140];
const CARD: [number, number, number] = [246, 247, 249];
const CARDLINE: [number, number, number] = [225, 230, 238];
const LIGHT: [number, number, number] = [203, 214, 232];

type Img = { dataUrl: string; width: number; height: number };

async function loadImage(src: string): Promise<Img> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, 0, 0);
      resolve({ dataUrl: c.toDataURL("image/png"), width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = src;
  });
}
async function loadLogo(): Promise<Img | null> {
  for (const s of ["/images/unv-holdings-logo.png", "/images/unv-logo-contract.png"]) {
    try { return await loadImage(s); } catch { /* próximo */ }
  }
  return null;
}
function fit(w: number, h: number, mw: number, mh: number) {
  const r = w / h; let W = mw, H = mw / r;
  if (H > mh) { H = mh; W = mh * r; }
  return { width: W, height: H };
}

const CRESCER = [
  ["Cenário", "Diagnóstico do comercial, dos funis e dos números mês a mês."],
  ["Resultado Ideal", "Meta clara e previsível — o que precisa ser batido todo mês."],
  ["Estrutura", "Pré-venda, supervisão do CRM, playbook e rotina de cobrança."],
  ["Captação", "Sistema de geração de oportunidades qualificadas e constantes."],
  ["Conversão", "Time treinado e cobrado: lead vira reunião, reunião vira venda."],
  ["Escala", "Padrão replicável e dono fora da operação comercial."],
  ["Revisão", "Gestão contínua: medir, corrigir e manter a previsibilidade."],
];
const RITMO = [
  ["Diário", "Cobrança da execução e dos números do time."],
  ["Semanal", "Treino do time e ajuste de rota da semana."],
  ["Quinzenal", "Reunião estratégica de resultado com a direção."],
  ["Sob demanda", "Apoio em negociações e correções de rota."],
];

export async function generateProposalPDF({ proposal, leadName, companyName, serviceName }: Options): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const CW = W - M * 2;
  const logo = await loadLogo();
  const cliente = companyName || leadName || "Cliente";
  const servico = proposal.servico || serviceName || "Direção Comercial Terceirizada";

  let page = 0;
  let y = 0;

  const setColor = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setStroke = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  const kicker = (txt: string, x: number, yy: number, color = MUTED) => {
    setColor(color); doc.setFont("helvetica", "bold"); doc.setFontSize(8.2);
    doc.text(txt.toUpperCase(), x, yy, { charSpace: 1.1 });
  };

  const footer = () => {
    setStroke(CARDLINE); doc.setLineWidth(0.3);
    doc.line(M, H - 13, W - M, H - 13);
    setColor(MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text(`UNV HOLDINGS · PROPOSTA COMERCIAL — ${cliente.toUpperCase()}`, M, H - 8.5, { charSpace: 0.5 });
    setColor(RED);
    doc.text(`— ${String(page).padStart(2, "0")} —`, W - M, H - 8.5, { align: "right" });
  };

  const ensure = (need: number) => {
    if (y + need > H - 20) { footer(); doc.addPage(); page++; y = M + 4; }
  };

  // Inicia uma página de seção (fundo branco) com kicker + título
  const startSection = (num: string, label: string, title: string, intro?: string) => {
    doc.addPage(); page++; y = M + 6;
    kicker(`${num} — ${label}`, M, y);
    y += 9;
    setColor(NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(23);
    doc.splitTextToSize(title, CW).forEach((ln: string) => { doc.text(ln, M, y); y += 10; });
    y += 1;
    if (intro) {
      setColor(INK); doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
      doc.splitTextToSize(intro, CW).forEach((ln: string) => { ensure(6); doc.text(ln, M, y); y += 5.4; });
      y += 4;
    }
  };

  const paragraph = (t: string, color = INK, size = 10.5) => {
    if (!t) return;
    setColor(color); doc.setFont("helvetica", "normal"); doc.setFontSize(size);
    doc.splitTextToSize(t, CW).forEach((ln: string) => { ensure(6); doc.text(ln, M, y); y += size * 0.5 + 0.4; });
    y += 3;
  };

  // ───────────────────────── CAPA ─────────────────────────
  page = 1;
  setFill(NAVY); doc.rect(0, 0, W, H, "F");
  setFill(RED); doc.rect(0, 0, W, 6, "F");

  // card branco com a logo
  const cardW = 52, cardH = 34, cardX = M, cardY = 26;
  setFill([255, 255, 255]); doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, "F");
  if (logo) {
    const { width, height } = fit(logo.width, logo.height, cardW - 12, cardH - 12);
    try { doc.addImage(logo.dataUrl, "PNG", cardX + (cardW - width) / 2, cardY + (cardH - height) / 2, width, height); } catch { /* */ }
  }
  y = cardY + cardH + 18;

  kicker("— Proposta Comercial", M, y, RED); y += 11;
  const h1 = proposal.headline_l1 || "Direção Comercial";
  const h2 = proposal.headline_l2 || "Terceirizada";
  doc.setFont("helvetica", "bold");
  // auto-ajusta o tamanho da fonte pra a maior linha caber na largura (evita corte)
  let hSize = 33; doc.setFontSize(hSize);
  while (hSize > 16 && (doc.getTextWidth(h1) > CW || doc.getTextWidth(h2) > CW)) { hSize -= 1; doc.setFontSize(hSize); }
  const lineH = hSize * 0.41;
  setColor([255, 255, 255]);
  doc.splitTextToSize(h1, CW).forEach((ln: string) => { doc.text(ln, M, y); y += lineH; });
  setColor(RED);
  doc.splitTextToSize(h2, CW).forEach((ln: string) => { doc.text(ln, M, y); y += lineH; });
  y += 4;

  if (proposal.subtitulo) {
    setColor(LIGHT); doc.setFont("helvetica", "normal"); doc.setFontSize(11.5);
    doc.splitTextToSize(proposal.subtitulo, CW - 8).forEach((ln: string) => { doc.text(ln, M, y); y += 6.2; });
    y += 4;
  }

  if (proposal.quote) {
    setFill(RED); doc.rect(M, y - 1, 1.4, 16, "F");
    setColor([235, 240, 248]); doc.setFont("helvetica", "italic"); doc.setFontSize(11);
    doc.splitTextToSize(`“${proposal.quote}”`, CW - 12).forEach((ln: string) => { doc.text(ln, M + 6, y + 4); y += 6; });
    y += 8;
  }

  // grid de meta (2 col x 2 linhas)
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const metaY = H - 60;
  const col2 = W / 2;
  const metaItem = (lbl: string, val: string, x: number, yy: number) => {
    kicker(lbl, x, yy, RED);
    setColor([255, 255, 255]); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
    doc.splitTextToSize(val, col2 - M - 6).forEach((ln: string, i: number) => doc.text(ln, x, yy + 6 + i * 5));
  };
  const detalhe = (proposal.preparado_para_detalhe || "").trim().slice(0, 44);
  setStroke([60, 80, 120]); doc.setLineWidth(0.2); doc.line(M, metaY - 8, W - M, metaY - 8);
  metaItem("Preparado para", `${cliente}${detalhe ? "\n" + detalhe : ""}`, M, metaY);
  metaItem("Apresentado por", "Fabrício Nunes\nUNV Holdings", col2, metaY);
  metaItem("Data", hoje, M, metaY + 26);
  metaItem("Validade da proposta", "15 dias", col2, metaY + 26);

  setColor([120, 140, 170]); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text("NOVA LIMA · MG — ESTRUTURAÇÃO COMERCIAL PARA PMES", W / 2, H - 12, { align: "center", charSpace: 1 });

  // ───────────────────────── DIAGNÓSTICO ─────────────────────────
  const diag = (proposal.diagnostico || []).filter((d) => d && (d.titulo || d.descricao));
  if (diag.length) {
    startSection("01", "Diagnóstico", proposal.diagnostico_titulo || "O cenário que ouvimos");
    twoColNumberedCards(diag);
  }

  // ───────────────────────── A VIRADA ─────────────────────────
  const ad = (proposal.antes_depois || []).filter((x) => x && (x.hoje || x.meta));
  if (ad.length || proposal.virada_frase) {
    startSection("02", "A Virada", "Onde você está e onde vai chegar");
    if (proposal.virada_frase) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      const lines = doc.splitTextToSize(proposal.virada_frase, CW - 16);
      const bh = lines.length * 6.4 + 12;
      ensure(bh + 4);
      setFill(NAVY); doc.roundedRect(M, y, CW, bh, 2.5, 2.5, "F");
      setColor([255, 255, 255]); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      lines.forEach((ln: string, i: number) => doc.text(ln, M + 8, y + 9 + i * 6.4));
      y += bh + 8;
    }
    for (const item of ad) { hojeMetaRow(item.hoje || "", item.meta || ""); }
  }

  // ───────────────────────── A SOLUÇÃO ─────────────────────────
  const entregas = (proposal.entregas || []).filter(Boolean);
  startSection("03", "A Solução", `A UNV entrega: ${servico}`, proposal.solucao_intro || proposal.objetivo);
  if (entregas.length) {
    for (const e of entregas) { checkItem(String(e)); }
    y += 4;
  }
  // ritmo
  ensure(34);
  kicker("O Ritmo de Acompanhamento", M, y, RED); y += 7;
  fourNavyCards(RITMO);

  // ───────────────────────── MÉTODO CRESCER ─────────────────────────
  startSection("04", "Metodologia", "O Método CRESCER", "As 7 fases que levam a academia do improviso ao sistema. Cada decisão passa por um filtro: o que escala, o que gera previsibilidade, o que aumenta margem e o que reduz a dependência do dono.");
  CRESCER.forEach((p, i) => numberedRow(i + 1, p[0], p[1], i % 2 === 0 ? NAVY : RED));
  y += 4;
  ensure(26);
  const fdLines = ["O que escala?", "O que gera previsibilidade?", "O que aumenta margem?", "O que reduz a dependência do dono?"];
  const fdH = 10 + Math.ceil(fdLines.length / 2) * 7;
  setFill(CARD); setStroke(CARDLINE); doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CW, fdH, 2.5, 2.5, "FD");
  kicker("Filtro de decisão — toda ação passa por aqui", M + 6, y + 7, RED);
  setColor(INK); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  fdLines.forEach((q, i) => {
    const cx = M + 6 + (i % 2) * (CW / 2);
    const cy = y + 14 + Math.floor(i / 2) * 7;
    setColor(RED); doc.text("›", cx, cy); setColor(INK); doc.text(q, cx + 4, cy);
  });
  y += fdH + 6;

  // ───────────────────────── INVESTIMENTO ─────────────────────────
  startSection("05", "Investimento", "O investimento");
  const inv = proposal.investimento || "A combinar";
  const fpg = proposal.forma_pagamento || "A combinar";
  // Caixa DINÂMICA: valor e forma de pagamento podem ter muito texto
  // (ex.: devolução/crédito negociado) — as duas colunas quebram em linhas e
  // a altura cresce pra caber tudo, sem sobreposição.
  const padX = 8;
  const gap = 6;
  const leftW = CW * 0.52;
  const rightW = CW - leftW - gap; // coluna direita (forma de pagamento)

  // Valor: reduz a fonte só o necessário e quebra em linhas dentro da coluna esquerda
  doc.setFont("helvetica", "bold");
  let vSize = 20; doc.setFontSize(vSize);
  let invLines = doc.splitTextToSize(inv, leftW - padX * 2) as string[];
  while (vSize > 11 && invLines.length > 3) { vSize -= 1; doc.setFontSize(vSize); invLines = doc.splitTextToSize(inv, leftW - padX * 2) as string[]; }
  const invLineH = vSize * 0.42; // mm por linha (jsPDF em mm, fonte em pt)

  // Forma de pagamento: quebra na coluna direita
  const fpgLines = doc.splitTextToSize(fpg, rightW - padX * 2) as string[];
  const fpgLineH = 4.6;

  // Altura de cada coluna a partir do topo da caixa
  const leftStack = 12 /* kicker */ + invLines.length * invLineH
    + (proposal.prazo ? 6 : 0);
  const rightStack = 10 /* label */ + 2 + fpgLines.length * fpgLineH;
  const boxH = Math.max(34, leftStack, rightStack) + 8;

  ensure(boxH + 10);
  setFill(NAVY); doc.roundedRect(M, y, CW, boxH, 3, 3, "F");
  setFill(RED); doc.rect(M, y, 2.2, boxH, "F");

  // Coluna esquerda: serviço + valor + vigência
  kicker(servico, M + padX, y + 8, [150, 170, 200]);
  setColor([255, 255, 255]); doc.setFont("helvetica", "bold"); doc.setFontSize(vSize);
  let ly = y + 12 + invLineH;
  invLines.forEach((ln) => { doc.text(ln, M + padX, ly); ly += invLineH; });
  if (proposal.prazo) {
    setColor([150, 170, 200]); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`Vigência: ${proposal.prazo}`, M + padX, y + boxH - 4, { maxWidth: leftW - padX });
  }

  // Coluna direita: forma de pagamento
  const rightX = W - M - padX;
  setColor([170, 188, 214]); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  doc.text("FORMA DE PAGAMENTO", rightX, y + 8, { align: "right" });
  setColor([255, 255, 255]); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  fpgLines.forEach((ln, i) => doc.text(ln, rightX, y + 15 + i * fpgLineH, { align: "right" }));

  y += boxH + 9;
  if (entregas.length) {
    kicker("O que está incluído", M, y, RED); y += 7;
    entregas.slice(0, 10).forEach((e) => checkItem(String(e)));
  }

  // ───────────────────────── PRÓXIMOS PASSOS ─────────────────────────
  const passos = (proposal.proximos_passos || []).filter((p) => p && (p.titulo || p.descricao));
  startSection("06", "Próximos Passos", "Como a gente avança");
  passos.forEach((p, i) => numberedRow(i + 1, p.titulo || "", p.descricao || "", NAVY));
  y += 4;
  const cta = proposal.cta || "Quando quiser bater meta todo mês com previsibilidade — é só chamar.";
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  const ctaLines = doc.splitTextToSize(cta, CW - 16);
  const ctaH = ctaLines.length * 7 + 14;
  ensure(ctaH + 30);
  setFill(NAVY); doc.roundedRect(M, y, CW, ctaH, 3, 3, "F");
  setColor([255, 255, 255]); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  ctaLines.forEach((ln: string, i: number) => doc.text(ln, M + 8, y + 10 + i * 7));
  y += ctaH + 14;
  // assinatura
  setColor(NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Fabrício Nunes", M, y);
  setColor(MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("CEO & Fundador — UNV Holdings", M, y + 5);
  doc.text("Universidade Nacional de Vendas · Nova Lima/MG", M, y + 10);
  if (logo) {
    const { width, height } = fit(logo.width, logo.height, 34, 20);
    try { doc.addImage(logo.dataUrl, "PNG", W - M - width, y - 2, width, height); } catch { /* */ }
  }

  footer();
  return doc.output("blob");

  // ───────────────────────── helpers de layout ─────────────────────────
  function twoColNumberedCards(items: { titulo: string; descricao: string }[]) {
    const gap = 6;
    const cw = (CW - gap) / 2;
    const inner = cw - 12;
    let i = 0;
    while (i < items.length) {
      const left = items[i];
      const right = items[i + 1];
      const lh = cardHeight(left, inner);
      const rh = right ? cardHeight(right, inner) : 0;
      const rowH = Math.max(lh, rh);
      ensure(rowH + 5);
      drawCard(left, i + 1, M, y, cw, rowH, inner);
      if (right) drawCard(right, i + 2, M + cw + gap, y, cw, rowH, inner);
      y += rowH + 5;
      i += 2;
    }
    y += 2;
  }
  function cardHeight(item: { titulo: string; descricao: string }, inner: number) {
    doc.setFontSize(10.5); const tl = doc.splitTextToSize(item.titulo || "", inner).length;
    doc.setFontSize(9); const dl = doc.splitTextToSize(item.descricao || "", inner).length;
    return 8 + tl * 5 + 2 + dl * 4.4 + 6;
  }
  function drawCard(item: { titulo: string; descricao: string }, num: number, x: number, yy: number, w: number, h: number, inner: number) {
    setFill(CARD); setStroke(CARDLINE); doc.setLineWidth(0.3);
    doc.roundedRect(x, yy, w, h, 2, 2, "FD");
    setFill(RED); doc.rect(x, yy, 1.6, h, "F");
    let cy = yy + 8;
    setColor(RED); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
    const numTxt = String(num).padStart(2, "0");
    doc.text(numTxt, x + 7, cy);
    setColor(NAVY);
    const tLines = doc.splitTextToSize(item.titulo || "", inner - 8);
    tLines.forEach((ln: string, k: number) => doc.text(ln, x + 7 + 8, cy + k * 5));
    cy += Math.max(tLines.length * 5, 5) + 2;
    setColor(MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.splitTextToSize(item.descricao || "", inner).forEach((ln: string) => { doc.text(ln, x + 7, cy); cy += 4.4; });
  }
  function hojeMetaRow(hojeT: string, metaT: string) {
    const gap = 6; const cw = (CW - gap) / 2; const inner = cw - 12;
    doc.setFontSize(9.5);
    const hL = doc.splitTextToSize(hojeT, inner); const mL = doc.splitTextToSize(metaT, inner);
    const h = 9 + Math.max(hL.length, mL.length) * 4.6 + 6;
    ensure(h + 5);
    // HOJE (cinza)
    setFill(CARD); setStroke(CARDLINE); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, cw, h, 2, 2, "FD");
    kicker("Hoje", M + 6, y + 7, MUTED);
    setColor(INK); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    hL.forEach((ln: string, k: number) => doc.text(ln, M + 6, y + 13 + k * 4.6));
    // META (borda vermelha)
    setFill([255, 255, 255]); setStroke(RED); doc.setLineWidth(0.5);
    doc.roundedRect(M + cw + gap, y, cw, h, 2, 2, "FD");
    kicker("Meta", M + cw + gap + 6, y + 7, RED);
    setColor(INK); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    mL.forEach((ln: string, k: number) => doc.text(ln, M + cw + gap + 6, y + 13 + k * 4.6));
    y += h + 5;
  }
  function checkItem(text: string) {
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, CW - 9);
    ensure(lines.length * 5 + 2);
    setFill(NAVY); doc.circle(M + 2.2, y - 1.4, 2.2, "F");
    setColor([255, 255, 255]); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    doc.text("✓", M + 2.2, y - 0.4, { align: "center" });
    setColor(INK); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    lines.forEach((ln: string, k: number) => doc.text(ln, M + 7, y + k * 5));
    y += lines.length * 5 + 2.5;
  }
  function numberedRow(num: number, title: string, desc: string, color: [number, number, number]) {
    doc.setFontSize(9.5);
    const dLines = doc.splitTextToSize(desc, CW - 16);
    const h = Math.max(11, 6 + dLines.length * 4.6);
    ensure(h + 2);
    setFill(color); doc.circle(M + 4, y + 1.5, 4, "F");
    setColor([255, 255, 255]); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
    doc.text(String(num), M + 4, y + 3, { align: "center" });
    setColor(NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(title, M + 11, y + 2);
    setColor(MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    dLines.forEach((ln: string, k: number) => doc.text(ln, M + 11, y + 8 + k * 4.6));
    y += h + 3;
  }
  function fourNavyCards(items: string[][]) {
    const gap = 4; const cw = (CW - gap * 3) / 4;
    const h = 26;
    ensure(h + 3);
    items.forEach((it, i) => {
      const x = M + i * (cw + gap);
      setFill(NAVY); doc.roundedRect(x, y, cw, h, 2, 2, "F");
      setColor([150, 170, 200]); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text(it[0].toUpperCase(), x + 4, y + 7, { charSpace: 0.4 });
      setColor([235, 240, 248]); doc.setFont("helvetica", "normal"); doc.setFontSize(7.6);
      doc.splitTextToSize(it[1], cw - 8).forEach((ln: string, k: number) => doc.text(ln, x + 4, y + 13 + k * 3.8));
    });
    y += h + 4;
  }
}
