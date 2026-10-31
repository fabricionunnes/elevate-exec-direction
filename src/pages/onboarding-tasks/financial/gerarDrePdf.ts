// PDF do DRE com o branding UNV (navy + vermelho + logo), desenhado direto no jsPDF
// (vetorial, leve, nítido). 30/10/2026, Fabrício: "quero poder baixar um PDF bonito com a
// nossa logomarca e branding da marca". Segue o padrão do onboardingDeckPdf.ts.
import jsPDF from "jspdf";

const NAVY: [number, number, number] = [13, 43, 94];
const RED: [number, number, number] = [204, 27, 27];
const INK: [number, number, number] = [28, 32, 40];
const GRAY: [number, number, number] = [110, 120, 135];
const LIGHT: [number, number, number] = [244, 246, 250];
const GREEN: [number, number, number] = [5, 150, 105];
const LINE: [number, number, number] = [226, 232, 240];
const ENDERECO = "Rua Araguaia, 130 · Alphaville · Nova Lima/MG";

const W = 210; // A4 retrato
const H = 297;
const M = 16;  // margem

export interface LinhaPdf {
  label: string;
  nivel: "grupo" | "sub" | "total";
  natureza: "receita" | "despesa" | "neutro";
  atual: number; pct: number | null;
  anterior: number; delta: number | null;
  acumulado: number; pctAcum: number | null;
  final?: boolean;
}

export interface DrePdfDados {
  mesLabel: string; mesCurto: string; mesAnteriorCurto: string; ano: string;
  regime: "caixa" | "competencia";
  linhas: LinhaPdf[];
  kpis: { rl: number; mc: number; ebitda: number; resultado: number; rlAnterior: number };
  serie: { label: string; receita: number; despesas: number; resultado: number }[];
  leitura: { pontoEquilibrio: number | null; fixos: number; variaveis: number; semCategoriaN: number; semCategoriaTotal: number; emprestimos: number };
  formatCurrency: (v: number) => string;
}

async function loadLogo(src: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return { data: c.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight };
  } catch { return null; }
}

const fmtPct = (p: number | null) => (p == null || !isFinite(p) ? "—" : `${p.toFixed(1).replace(".", ",")}%`);

export async function gerarDrePdf(d: DrePdfDados): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await loadLogo("/images/unv-logo.png");
  const logoBranca = await loadLogo("/images/unv-logo-white.png");
  const brl = d.formatCurrency;
  const regimeTxt = d.regime === "caixa" ? "Regime de caixa (recebido e pago no mês)" : "Regime de competência (pelo vencimento)";
  const geradoEm = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const logoAt = (x: number, y: number, maxW: number, branca = false) => {
    const l = branca ? (logoBranca || logo) : logo;
    if (!l) return 0;
    const h = (l.h * maxW) / l.w;
    doc.addImage(l.data, "PNG", x, y, maxW, h);
    return h;
  };
  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  let pagina = 0;
  const totalPaginasRef = { n: 0 };
  const rodapes: (() => void)[] = [];

  /** moldura das páginas internas: faixa lateral navy + fio vermelho, rodapé com logo e endereço */
  const moldura = () => {
    pagina += 1;
    const n = pagina;
    setFill([255, 255, 255]); doc.rect(0, 0, W, H, "F");
    setFill(NAVY); doc.rect(0, 0, 4, H, "F");
    setFill(RED); doc.rect(4, 0, 1.2, H, "F");
    // cabeçalho
    setText(NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("DRE GERENCIAL", M, 14);
    setText(GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text(`${d.mesLabel} · ${regimeTxt}`, M, 19);
    logoAt(W - M - 22, 8, 22);
    setDraw(LINE); doc.setLineWidth(0.3); doc.line(M, 23, W - M, 23);
    rodapes.push(() => {
      doc.setPage(n);
      setDraw(LINE); doc.line(M, H - 14, W - M, H - 14);
      setText(GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      doc.text(`UNV Holdings · ${ENDERECO}`, M, H - 9);
      doc.text(`Gerado pelo UNV Nexus em ${geradoEm}`, M, H - 5.5);
      doc.text(`${n}/${totalPaginasRef.n}`, W - M, H - 9, { align: "right" });
    });
  };

  // ── CAPA ──────────────────────────────────────────────────────────────────
  pagina += 1;
  setFill(NAVY); doc.rect(0, 0, W, H, "F");
  setFill(RED); doc.rect(0, H - 8, W, 8, "F");
  // detalhe geométrico
  setFill([19, 56, 118]); doc.triangle(W, 0, W, 120, W - 90, 0, "F");
  setFill([23, 66, 136]); doc.circle(W - 30, 150, 60, "F");
  logoAt(M + 2, 26, 52, true);
  setText([255, 210, 210]); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("FINANCEIRO · RELATÓRIO GERENCIAL", M + 2, 112);
  setText([255, 255, 255]); doc.setFontSize(30);
  doc.text("Demonstração", M + 2, 128);
  doc.text("do Resultado", M + 2, 141);
  doc.setFontSize(16); doc.setFont("helvetica", "normal");
  doc.text(d.mesLabel, M + 2, 156);
  doc.setFontSize(10); setText([200, 212, 232]);
  doc.text(regimeTxt, M + 2, 164);
  // resumo na capa
  const kp = [
    ["Receita líquida", brl(d.kpis.rl)],
    ["EBITDA", `${brl(d.kpis.ebitda)} · ${fmtPct(d.kpis.rl ? (d.kpis.ebitda / d.kpis.rl) * 100 : null)}`],
    ["Resultado líquido", `${brl(d.kpis.resultado)} · ${fmtPct(d.kpis.rl ? (d.kpis.resultado / d.kpis.rl) * 100 : null)}`],
  ];
  let yk = 196;
  kp.forEach(([t, v]) => {
    setFill([255, 255, 255]); doc.setGState?.(new (doc as any).GState({ opacity: 0.08 }));
    doc.roundedRect(M + 2, yk - 7, 120, 16, 2, 2, "F");
    doc.setGState?.(new (doc as any).GState({ opacity: 1 }));
    setText([200, 212, 232]); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(t.toUpperCase(), M + 6, yk - 1.5);
    setText([255, 255, 255]); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(v, M + 6, yk + 5.5);
    yk += 20;
  });
  setText([200, 212, 232]); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  doc.text(`UNV Holdings · ${ENDERECO}`, M + 2, H - 16);
  doc.text(`Gerado em ${geradoEm}`, W - M, H - 16, { align: "right" });

  // ── RESUMO DO MÊS ──────────────────────────────────────────────────────────
  doc.addPage(); moldura();
  let y = 32;
  setText(INK); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("Resumo do mês", M, y); y += 8;

  const cards: { t: string; v: string; s: string; cor: [number, number, number] }[] = [
    { t: "Receita líquida", v: brl(d.kpis.rl), s: d.kpis.rlAnterior ? `${d.kpis.rl >= d.kpis.rlAnterior ? "+" : ""}${fmtPct(((d.kpis.rl - d.kpis.rlAnterior) / Math.abs(d.kpis.rlAnterior)) * 100)} vs ${d.mesAnteriorCurto}` : "sem base anterior", cor: GREEN },
    { t: "Margem de contribuição", v: brl(d.kpis.mc), s: `${fmtPct(d.kpis.rl ? (d.kpis.mc / d.kpis.rl) * 100 : null)} da receita líquida`, cor: d.kpis.mc >= 0 ? GREEN : RED },
    { t: "EBITDA", v: brl(d.kpis.ebitda), s: `margem ${fmtPct(d.kpis.rl ? (d.kpis.ebitda / d.kpis.rl) * 100 : null)}`, cor: d.kpis.ebitda >= 0 ? GREEN : RED },
    { t: "Resultado líquido", v: brl(d.kpis.resultado), s: `margem ${fmtPct(d.kpis.rl ? (d.kpis.resultado / d.kpis.rl) * 100 : null)}`, cor: d.kpis.resultado >= 0 ? GREEN : RED },
  ];
  const cw = (W - 2 * M - 3 * 4) / 4;
  cards.forEach((c, i) => {
    const x = M + i * (cw + 4);
    setFill(LIGHT); doc.roundedRect(x, y, cw, 24, 2, 2, "F");
    setFill(c.cor); doc.rect(x, y, 1.4, 24, "F");
    setText(GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(6.8); doc.text(c.t.toUpperCase(), x + 4, y + 6);
    setText(c.cor); doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.text(c.v, x + 4, y + 14);
    setText(GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(6.8); doc.text(c.s, x + 4, y + 20, { maxWidth: cw - 8 });
  });
  y += 32;

  // gráfico 12 meses (vetorial)
  setText(INK); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Evolução nos últimos 12 meses", M, y); y += 4;
  const gx = M, gy = y, gw = W - 2 * M, gh = 62;
  setFill([255, 255, 255]); setDraw(LINE); doc.roundedRect(gx, gy, gw, gh, 2, 2, "FD");
  const maxV = Math.max(1, ...d.serie.flatMap((s) => [s.receita, s.despesas, Math.abs(s.resultado)]));
  const minV = Math.min(0, ...d.serie.map((s) => s.resultado));
  const plotTop = gy + 6, plotBottom = gy + gh - 10;
  const escala = (v: number) => plotBottom - ((v - minV) / (maxV - minV)) * (plotBottom - plotTop);
  const zeroY = escala(0);
  setDraw([203, 213, 225]); doc.setLineWidth(0.25); doc.line(gx + 4, zeroY, gx + gw - 4, zeroY);
  const slot = (gw - 8) / d.serie.length;
  const bw = Math.min(5, slot * 0.32);
  const pts: [number, number][] = [];
  d.serie.forEach((s, i) => {
    const cx = gx + 4 + slot * i + slot / 2;
    setFill(GREEN); doc.rect(cx - bw - 0.4, escala(s.receita), bw, zeroY - escala(s.receita), "F");
    setFill([220, 38, 38]); doc.rect(cx + 0.4, escala(s.despesas), bw, zeroY - escala(s.despesas), "F");
    pts.push([cx, escala(s.resultado)]);
    setText(GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(6); doc.text(s.label, cx, gy + gh - 4, { align: "center" });
  });
  setDraw(NAVY); doc.setLineWidth(0.7);
  for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  setFill(NAVY); pts.forEach(([px, py]) => doc.circle(px, py, 0.9, "F"));
  // legenda
  const ly = gy + gh + 4;
  const leg = [["Receita líquida", GREEN], ["Despesas e custos", [220, 38, 38]], ["Resultado líquido", NAVY]] as [string, [number, number, number]][];
  let lx = gx;
  leg.forEach(([t, c]) => { setFill(c); doc.rect(lx, ly - 2.2, 3, 3, "F"); setText(GRAY); doc.setFontSize(7); doc.text(t, lx + 4.5, ly); lx += doc.getTextWidth(t) + 12; });
  y = ly + 10;

  // leitura do mês
  setText(INK); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Leitura do mês", M, y); y += 6;
  const pe = d.leitura.pontoEquilibrio;
  const frases: string[] = [];
  frases.push(pe != null
    ? (d.kpis.rl >= pe
      ? `Ponto de equilíbrio operacional em ${brl(pe)}: a receita líquida ficou ${brl(d.kpis.rl - pe)} acima do necessário pra cobrir os custos fixos de ${brl(d.leitura.fixos)}.`
      : `Ponto de equilíbrio operacional em ${brl(pe)}: faltaram ${brl(pe - d.kpis.rl)} de receita líquida pra cobrir os custos fixos de ${brl(d.leitura.fixos)}.`)
    : "Sem margem de contribuição positiva no mês, o ponto de equilíbrio não pôde ser calculado.");
  frases.push(`Custos variáveis de ${brl(d.leitura.variaveis)} (${fmtPct(d.kpis.rl ? (d.leitura.variaveis / d.kpis.rl) * 100 : null)} da receita líquida) e estrutura fixa de ${brl(d.leitura.fixos)}.`);
  if (d.leitura.semCategoriaN > 0) frases.push(`${d.leitura.semCategoriaN} lançamento(s) sem categoria somam ${brl(d.leitura.semCategoriaTotal)} e entraram em "Sem categoria".`);
  if (d.leitura.emprestimos > 0) frases.push(`${brl(d.leitura.emprestimos)} de empréstimos recebidos ficaram fora do resultado (entrada de caixa, não é receita).`);
  setText(INK); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  frases.forEach((f) => {
    setFill(RED); doc.circle(M + 1.2, y - 1.2, 0.8, "F");
    const linhas = doc.splitTextToSize(f, W - 2 * M - 6) as string[];
    doc.text(linhas, M + 5, y);
    y += linhas.length * 4.6 + 2;
  });

  // ── DEMONSTRATIVO ──────────────────────────────────────────────────────────
  doc.addPage(); moldura();
  y = 32;
  setText(INK); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("Demonstrativo", M, y); y += 7;

  const cols = [
    { h: "", x: M, w: 66, al: "left" as const },
    { h: d.mesCurto, x: M + 66, w: 30, al: "right" as const },
    { h: "% RL", x: M + 96, w: 14, al: "right" as const },
    { h: d.mesAnteriorCurto, x: M + 110, w: 28, al: "right" as const },
    { h: "Var.", x: M + 138, w: 14, al: "right" as const },
    { h: `Acum. ${d.ano}`, x: M + 152, w: 30, al: "right" as const },
    { h: "% RL", x: M + 182, w: W - 2 * M - 182, al: "right" as const },
  ];
  const cabecalho = () => {
    setFill(LIGHT); doc.rect(M, y - 4.5, W - 2 * M, 7, "F");
    setText(GRAY); doc.setFont("helvetica", "bold"); doc.setFontSize(6.8);
    cols.forEach((c) => doc.text(c.h.toUpperCase(), c.al === "right" ? c.x + c.w - 1.5 : c.x + 2, y, { align: c.al }));
    y += 6;
  };
  cabecalho();
  const valor = (v: number, nat: LinhaPdf["natureza"]) => (nat === "despesa" && v ? `(${brl(v)})` : brl(v));

  d.linhas.forEach((l) => {
    const alt = l.nivel === "sub" ? 5.6 : 7.2;
    if (y + alt > H - 20) { doc.addPage(); moldura(); y = 32; cabecalho(); }
    if (l.nivel === "total") {
      setFill(l.final ? [230, 236, 247] : [240, 244, 250]); doc.rect(M, y - 4.6, W - 2 * M, alt, "F");
    } else if (l.nivel === "grupo") {
      setFill([248, 250, 252]); doc.rect(M, y - 4.6, W - 2 * M, alt, "F");
    }
    setDraw(LINE); doc.setLineWidth(0.2); doc.line(M, y + alt - 4.6, W - M, y + alt - 4.6);

    const bold = l.nivel !== "sub";
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(l.nivel === "total" ? (l.final ? 9.5 : 8.8) : l.nivel === "grupo" ? 8.2 : 7.6);
    setText(l.nivel === "sub" ? [71, 85, 105] : INK);
    doc.text(l.label, cols[0].x + (l.nivel === "sub" ? 7 : 2), y, { maxWidth: cols[0].w - 8 });

    const corAtual: [number, number, number] = l.natureza === "receita" ? GREEN : l.natureza === "despesa" ? (l.atual ? RED : GRAY) : (l.atual >= 0 ? GREEN : RED);
    setText(l.nivel === "sub" ? INK : corAtual);
    doc.text(valor(l.atual, l.natureza), cols[1].x + cols[1].w - 1.5, y, { align: "right" });
    setText(GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(6.8);
    doc.text(fmtPct(l.pct), cols[2].x + cols[2].w - 1.5, y, { align: "right" });
    doc.setFontSize(l.nivel === "sub" ? 7.2 : 7.8);
    doc.text(valor(l.anterior, l.natureza), cols[3].x + cols[3].w - 1.5, y, { align: "right" });
    if (l.delta != null) {
      const bom = l.natureza === "despesa" ? l.delta < 0 : l.delta > 0;
      setText(Math.abs(l.delta) < 0.05 ? GRAY : bom ? GREEN : RED);
    }
    doc.setFontSize(6.8);
    doc.text(l.delta == null ? "—" : `${l.delta > 0 ? "+" : ""}${fmtPct(l.delta)}`, cols[4].x + cols[4].w - 1.5, y, { align: "right" });
    const corAcum: [number, number, number] = l.natureza === "receita" ? GREEN : l.natureza === "despesa" ? (l.acumulado ? RED : GRAY) : (l.acumulado >= 0 ? GREEN : RED);
    setText(l.nivel === "sub" ? INK : corAcum); doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(l.nivel === "sub" ? 7.2 : 7.8);
    doc.text(valor(l.acumulado, l.natureza), cols[5].x + cols[5].w - 1.5, y, { align: "right" });
    setText(GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(6.8);
    doc.text(fmtPct(l.pctAcum), cols[6].x + cols[6].w - 1.5, y, { align: "right" });
    y += alt;
  });

  y += 6;
  if (y + 16 > H - 20) { doc.addPage(); moldura(); y = 32; }
  setText(GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(7.2);
  const nota = "Receita de faturas e recebíveis pelo valor de face; descontos concedidos no pagamento viram dedução e juros/multas recebidos viram receita financeira. Despesas vêm de Contas a Pagar e lançamentos manuais, pela categoria configurada em Categorias (o tipo de custo da categoria decide o que é variável). Investimentos (CAPEX) aparecem abaixo do EBITDA por saírem do caixa do mês. Valores entre parênteses reduzem o resultado.";
  doc.text(doc.splitTextToSize(nota, W - 2 * M) as string[], M, y);

  totalPaginasRef.n = pagina;
  rodapes.forEach((f) => f());
  doc.save(`DRE-UNV-${d.ano}-${d.mesCurto.replace("/", "-")}-${d.regime}.pdf`);
}
