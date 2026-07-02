import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import unvLogo from "@/assets/logo-unv-oficial.png";

// Paleta UNV
const NAVY: [number, number, number] = [13, 43, 94];
const NAVY_DK: [number, number, number] = [9, 28, 64];
const RED: [number, number, number] = [204, 27, 27];
const GREEN: [number, number, number] = [30, 122, 51];
const GREY: [number, number, number] = [107, 114, 128];
const LIGHT: [number, number, number] = [238, 241, 246];
const CREAM: [number, number, number] = [247, 243, 234];
const DARK: [number, number, number] = [34, 38, 46];
const LINE: [number, number, number] = [213, 219, 229];

const brl = (n: number) => "R$ " + (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brlShort = (n: number) => "R$ " + Math.round(n || 0).toLocaleString("pt-BR");
const ptDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length <= 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};
const ptDateShort = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length <= 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const brMonthLong = (ym: string) => { const [y, m] = ym.split("-"); return `${MESES[+m - 1]} de ${y}`; };

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

export type ReportPeriod = "all" | 7 | 15 | 30 | 90;

export async function generateProjectFullReportPDF(projectId: string, period: ReportPeriod = "all") {
  let since: string | undefined;
  if (period !== "all") {
    const dt = new Date();
    dt.setDate(dt.getDate() - period);
    since = dt.toISOString().slice(0, 10);
  }

  const { data, error } = await supabase.functions.invoke("project-full-report", {
    body: { project_id: projectId, since },
  });
  if (error) throw new Error(error.message || "Falha ao gerar o relatório");
  if (!data || data.error) throw new Error(data?.error || "Sem dados para o relatório");

  // Sanitiza strings: emojis/símbolos fora do latin-1 viram lixo na fonte padrão do jsPDF
  const cleanStr = (s: string) => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{FE0F}\u{200D}\u{2B00}-\u{2BFF}]/gu, "").replace(/\s{2,}/g, " ").trim();
  const deepClean = (o: any): any => {
    if (typeof o === "string") return o.startsWith("data:image") ? o : cleanStr(o);
    if (Array.isArray(o)) return o.map(deepClean);
    if (o && typeof o === "object") { const r: any = {}; for (const k of Object.keys(o)) r[k] = deepClean(o[k]); return r; }
    return o;
  };
  const d = deepClean(data);
  const n = d.narrative || {};
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 18, CW = W - 2 * M;
  let y = 0;
  let sec = 0;

  const setFill = (c: number[]) => pdf.setFillColor(c[0], c[1], c[2]);
  const setText = (c: number[]) => pdf.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: number[]) => pdf.setDrawColor(c[0], c[1], c[2]);

  const ensure = (h: number) => { if (y + h > H - 18) { pdf.addPage(); y = M + 4; } };

  const sectionTitle = (title: string) => {
    sec++;
    ensure(22);
    setFill(RED); pdf.roundedRect(M, y, 11, 11, 1.5, 1.5, "F");
    setText([255, 255, 255]); pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
    pdf.text(String(sec).padStart(2, "0"), M + 5.5, y + 7.3, { align: "center" });
    setText(NAVY); pdf.setFontSize(16);
    pdf.text(title, M + 15, y + 8);
    setFill(NAVY); pdf.rect(M, y + 13.5, CW, 0.9, "F");
    setFill(RED); pdf.rect(M, y + 13.5, 34, 0.9, "F");
    y += 21;
  };

  const para = (text: string, opts: { size?: number; color?: number[]; bold?: boolean; gap?: number; lh?: number } = {}) => {
    if (!text) return;
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setFontSize(opts.size || 10.5); setText(opts.color || DARK);
    const lh = opts.lh || 5.6;
    const lines = pdf.splitTextToSize(text, CW);
    for (const ln of lines) { ensure(lh + 2); pdf.text(ln, M, y); y += lh; }
    y += opts.gap ?? 2.5;
  };

  const bullet = (text: string, opts: { color?: number[] } = {}) => {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10.5); setText(DARK);
    const lines = pdf.splitTextToSize(text, CW - 7);
    ensure(lines.length * 5.5 + 2);
    setFill(opts.color || RED); pdf.circle(M + 1.6, y - 1.5, 1.0, "F");
    lines.forEach((ln: string, i: number) => { pdf.text(ln, M + 6.5, y); if (i < lines.length - 1) y += 5.5; });
    y += 6.6;
  };

  const statRow = (items: { label: string; value: string; accent?: number[] }[], ch = 24) => {
    const cnt = items.length, gap = 4, cw = (CW - gap * (cnt - 1)) / cnt;
    ensure(ch + 4);
    items.forEach((it, i) => {
      const x = M + i * (cw + gap);
      setFill(LIGHT); pdf.roundedRect(x, y, cw, ch, 1.5, 1.5, "F");
      setFill(it.accent || NAVY); pdf.rect(x, y + 2, 1.8, ch - 4, "F");
      setText(it.accent || NAVY); pdf.setFont("helvetica", "bold");
      pdf.setFontSize(it.value.length > 12 ? 12 : 15);
      pdf.text(it.value, x + 6, y + 12);
      setText(GREY); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.2);
      pdf.text(it.label.toUpperCase(), x + 6, y + ch - 5);
    });
    y += ch + 7;
  };

  const chartImg = async (dataUrl?: string) => {
    if (!dataUrl) return;
    const img = await loadImg(dataUrl);
    if (!img) return;
    const w = CW, h = w * (img.height / img.width);
    ensure(h + 6);
    setDraw(LINE); pdf.setLineWidth(0.3);
    pdf.roundedRect(M - 1, y - 1, w + 2, h + 2, 1.5, 1.5, "S");
    pdf.addImage(img, "PNG", M, y, w, h);
    y += h + 8;
  };

  const footer = () => {
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      setFill(NAVY); pdf.rect(0, H - 11, W, 11, "F");
      setFill(RED); pdf.rect(0, H - 11, 42, 1.1, "F");
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); setText([205, 216, 233]);
      pdf.text("Universidade Nacional de Vendas  ·  Diretoria Comercial Terceirizada", M, H - 4.5);
      pdf.text(`${i} / ${pages}`, W - M, H - 4.5, { align: "right" });
    }
  };

  // ============ CAPA ============
  setFill(NAVY); pdf.rect(0, 0, W, 8, "F");
  setFill(RED); pdf.rect(0, 8, W, 1.6, "F");

  const logo = await loadImg(unvLogo);
  if (logo) {
    const lw = 74, lh = lw * (logo.height / logo.width);
    pdf.addImage(logo, "PNG", (W - lw) / 2, 26, lw, lh);
  }

  y = 118;
  setText(NAVY); pdf.setFont("helvetica", "bold"); pdf.setFontSize(31);
  pdf.text("RELATÓRIO DE RESULTADOS", W / 2, y, { align: "center" });
  y += 8;
  setFill(RED); pdf.rect(W / 2 - 32, y, 64, 1.5, "F");
  y += 14;
  setText(NAVY_DK); pdf.setFontSize(18);
  pdf.text(d.company?.name || "Empresa", W / 2, y, { align: "center" });
  y += 8.5;
  setText(GREY); pdf.setFont("helvetica", "normal"); pdf.setFontSize(12);
  pdf.text(d.project?.product || "", W / 2, y, { align: "center" });

  // card de informações
  y = 170;
  setFill(LIGHT); pdf.roundedRect(M + 10, y, CW - 20, 42, 2, 2, "F");
  setFill(NAVY); pdf.rect(M + 10, y, CW - 20, 9, "F");
  setText([255, 255, 255]); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
  const periodLabel = period === "all" ? "Histórico completo da parceria" : `Últimos ${period} dias`;
  pdf.text("PERÍODO:  " + periodLabel.toUpperCase(), W / 2, y + 6, { align: "center" });
  setText(DARK); pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  const info: [string, string][] = [
    ["Consultor responsável", d.project?.consultant || "—"],
    ["Início da parceria", ptDate(d.project?.start)],
    ["Emitido em", ptDate(d.generatedAt?.slice(0, 10))],
  ];
  let iy = y + 16;
  info.forEach(([k, v]) => {
    setText(GREY); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8);
    pdf.text(k.toUpperCase(), M + 18, iy);
    setText(DARK); pdf.setFont("helvetica", "normal"); pdf.setFontSize(10.5);
    pdf.text(v, M + 78, iy);
    iy += 8.6;
  });

  // stat cards da capa
  y = 232;
  statRow([
    { label: "Reuniões realizadas", value: String(d.meetingsCount || 0) },
    { label: "Ações executadas", value: String(d.actions?.total || 0) },
    { label: "Faturamento no período", value: d.kpis?.faturamentoTotal ? brlShort(d.kpis.faturamentoTotal) : "—", accent: GREEN },
  ], 26);

  // ============ 01 RESUMO EXECUTIVO ============
  pdf.addPage(); y = M + 4;
  sectionTitle("Resumo Executivo");
  para(n.resumo_executivo || "");

  // ============ 02 O QUE A UNV REALIZOU ============
  sectionTitle("O Que a UNV Realizou");
  (n.o_que_fizemos || []).forEach((t: string) => bullet(t));

  // ============ 03 REUNIÕES (detalhado) ============
  sectionTitle("Reuniões e Alinhamentos");
  para(`Foram realizadas ${d.meetingsCount || 0} reuniões de estratégia, alinhamento e acompanhamento no período. Abaixo, o registro de cada encontro.`, { gap: 4 });
  const aiMeet: any[] = Array.isArray(n.reunioes) ? n.reunioes : [];
  const meetList: any[] = d.meetings || [];
  const detailed = meetList.map((m: any) => {
    const match = aiMeet.find((r) => r.data === m.date) || aiMeet.find((r) => (r.titulo || "").toLowerCase() === (m.title || "").toLowerCase());
    return { ...m, resumo: match?.resumo || "" };
  });
  detailed.slice(0, 40).forEach((m: any) => {
    const resumoLines = m.resumo ? pdf.splitTextToSize(m.resumo, CW - 8) : [];
    const blockH = 8 + resumoLines.length * 4.9 + 4;
    ensure(blockH + 2);
    setFill(RED); pdf.circle(M + 1.6, y + 1.2, 1.2, "F");
    setText(NAVY); pdf.setFont("helvetica", "bold"); pdf.setFontSize(10.5);
    pdf.text(ptDateShort(m.date), M + 6.5, y + 2.4);
    const tt = pdf.splitTextToSize(m.title || "Reunião", CW - 46);
    pdf.text(tt[0], M + 33, y + 2.4);
    y += 8;
    if (resumoLines.length) {
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); setText([60, 66, 78]);
      resumoLines.forEach((ln: string) => { ensure(6); pdf.text(ln, M + 6.5, y); y += 4.9; });
      y += 3;
    }
  });
  y += 2;

  // ============ 04 AÇÕES REALIZADAS (lista completa) ============
  sectionTitle("Ações Realizadas");
  statRow([
    { label: "Ações concluídas", value: String(d.actions?.total || 0), accent: GREEN },
    { label: "Em andamento", value: String(d.actions?.open || 0) },
  ]);
  await chartImg(d.charts?.acoes);
  // resumos por ação (IA): o que foi feito, diagnóstico e melhoria
  const aiActs: any[] = Array.isArray(n.acoes) ? n.acoes : [];
  const actSummary = (title: string) => {
    const t = (title || "").trim().toLowerCase();
    const hit = aiActs.find((x) => (x.titulo || "").trim().toLowerCase() === t) ||
      aiActs.find((x) => t && ((x.titulo || "").trim().toLowerCase().startsWith(t.slice(0, 40)) || t.startsWith((x.titulo || "").trim().toLowerCase().slice(0, 40))));
    return hit?.resumo || "";
  };
  const acts: any[] = (d.actions?.list || []).slice().sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""));
  const byMonth: Record<string, any[]> = {};
  acts.forEach((a) => { const k = (a.date || "").slice(0, 7) || "—"; (byMonth[k] = byMonth[k] || []).push(a); });
  Object.keys(byMonth).sort().forEach((mkey) => {
    ensure(12);
    setFill(CREAM); pdf.roundedRect(M, y - 4, CW, 8.5, 1, 1, "F");
    setText(NAVY); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9.5);
    pdf.text(mkey === "—" ? "Sem data" : brMonthLong(mkey) + `  ·  ${byMonth[mkey].length} ações`, M + 4, y + 1.4);
    y += 9.5;
    byMonth[mkey].forEach((a) => {
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); setText(DARK);
      const lines = pdf.splitTextToSize(a.title || "", CW - 26);
      const resumo = actSummary(a.title);
      const rLines = resumo ? pdf.splitTextToSize(resumo, CW - 22) : [];
      ensure(lines.length * 4.6 + rLines.length * 4.5 + 3);
      setText(GREY); pdf.setFont("helvetica", "normal"); pdf.text(ptDateShort(a.date).slice(0, 5), M + 3, y);
      setText(DARK); pdf.setFont("helvetica", "bold");
      lines.forEach((ln: string, i: number) => { pdf.text(ln, M + 16, y); if (i < lines.length - 1) y += 4.6; });
      y += 4.8;
      if (rLines.length) {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.7); setText([80, 88, 100]);
        rLines.forEach((ln: string) => { ensure(5.5); pdf.text(ln, M + 16, y); y += 4.5; });
        y += 1.6;
      } else {
        y += 0.6;
      }
    });
    y += 2;
  });

  // ============ 05 RESULTADOS ============
  sectionTitle("Resultados Gerados");
  statRow([
    { label: "Faturamento no período", value: d.kpis?.faturamentoTotal ? brlShort(d.kpis.faturamentoTotal) : "—", accent: GREEN },
    { label: "Vendas registradas", value: String(d.kpis?.vendasTotal || 0) },
    { label: "NPS do cliente", value: d.project?.nps != null ? String(d.project.nps) : "—" },
  ]);
  await chartImg(d.charts?.faturamento);
  const serie: any[] = d.kpis?.faturamentoMensal || [];
  if (serie.length) {
    ensure(10 + serie.length * 7.5);
    const tableTop = y;
    setFill(NAVY); pdf.rect(M, y, CW, 8, "F");
    setText([255, 255, 255]); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text("MÊS", M + 4, y + 5.4);
    pdf.text("FATURAMENTO REGISTRADO", W - M - 4, y + 5.4, { align: "right" });
    y += 8;
    serie.forEach((s: any, i: number) => {
      if (i % 2 === 0) { setFill([249, 250, 252]); pdf.rect(M, y, CW, 7.5, "F"); }
      setText(DARK); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5);
      pdf.text(brMonthLong(s.mes), M + 4, y + 5.2);
      pdf.setFont("helvetica", "bold"); setText(NAVY);
      pdf.text(brl(s.valor), W - M - 4, y + 5.2, { align: "right" });
      y += 7.5;
    });
    setDraw(LINE); pdf.setLineWidth(0.3); pdf.rect(M, tableTop, CW, y - tableTop, "S");
    y += 6;
  }
  para(n.resultado || "");

  // ============ 06 GRUPOS ============
  sectionTitle("Acompanhamento nos Grupos de WhatsApp");
  const g = d.groups || {};
  statRow([
    { label: "Grupo de Gestão", value: g.gestao ? String(g.gestao.total) + " msgs" : "—" },
    { label: "Grupo de Vendedores", value: g.vendedores ? String(g.vendedores.total) + " msgs" : "—" },
  ]);
  para(n.analise_grupos || "A operação foi acompanhada de perto pelos grupos de gestão e de vendedores, com orientação diária ao time.");

  // ============ 07 DESTAQUES ============
  if ((n.destaques || []).length) {
    sectionTitle("Destaques do Período");
    (n.destaques || []).forEach((t: string) => bullet(t, { color: GREEN }));
  }

  // ============ 08 PRÓXIMOS PASSOS ============
  if ((n.proximos_passos || []).length) {
    sectionTitle("Próximos Passos");
    (n.proximos_passos || []).forEach((t: string, i: number) => {
      const lines = pdf.splitTextToSize(t, CW - 12);
      ensure(lines.length * 5.5 + 4);
      setFill(NAVY); pdf.roundedRect(M, y - 4, 7, 7, 1, 1, "F");
      setText([255, 255, 255]); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
      pdf.text(String(i + 1), M + 3.5, y + 0.8, { align: "center" });
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(10.5); setText(DARK);
      lines.forEach((ln: string, li: number) => { pdf.text(ln, M + 11, y); if (li < lines.length - 1) y += 5.5; });
      y += 8.5;
    });
  }

  // fecho
  ensure(30);
  y += 3;
  setFill(NAVY); pdf.roundedRect(M, y, CW, 24, 2, 2, "F");
  setFill(RED); pdf.rect(M, y, 2.2, 24, "F");
  setText([255, 255, 255]); pdf.setFont("helvetica", "bold"); pdf.setFontSize(11.5);
  pdf.text("Processo, gestão e resultado — todos os meses.", M + 8, y + 10);
  setText([200, 212, 232]); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5);
  pdf.text("Universidade Nacional de Vendas · Seu Diretor Comercial", M + 8, y + 17.5);

  footer();
  const fname = `Relatorio_${(d.company?.name || "Empresa").replace(/[^a-zA-Z0-9]+/g, "_")}_${(d.generatedAt || "").slice(0, 10)}.pdf`;
  pdf.save(fname);
  return fname;
}
