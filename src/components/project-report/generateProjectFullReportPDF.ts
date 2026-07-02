import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import unvLogo from "@/assets/logo-unv-nexus.png";

// Paleta UNV
const NAVY: [number, number, number] = [13, 43, 94];
const RED: [number, number, number] = [204, 27, 27];
const GREEN: [number, number, number] = [30, 122, 51];
const GREY: [number, number, number] = [107, 114, 128];
const LIGHT: [number, number, number] = [238, 241, 246];
const DARK: [number, number, number] = [34, 34, 34];

const brl = (n: number) => "R$ " + (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ptDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length <= 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

export type ReportPeriod = "all" | 30 | 90;

export async function generateProjectFullReportPDF(projectId: string, period: ReportPeriod = "all") {
  // período
  let since: string | undefined;
  if (period !== "all") {
    const d = new Date();
    d.setDate(d.getDate() - period);
    since = d.toISOString().slice(0, 10);
  }

  const { data, error } = await supabase.functions.invoke("project-full-report", {
    body: { project_id: projectId, since },
  });
  if (error) throw new Error(error.message || "Falha ao gerar o relatório");
  if (!data || data.error) throw new Error(data?.error || "Sem dados para o relatório");

  const d = data;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 16, CW = W - 2 * M;
  let y = 0;

  const setFill = (c: number[]) => pdf.setFillColor(c[0], c[1], c[2]);
  const setText = (c: number[]) => pdf.setTextColor(c[0], c[1], c[2]);

  const footer = () => {
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      setFill(NAVY); pdf.rect(0, H - 10, W, 10, "F");
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); setText([210, 220, 235]);
      pdf.text("Universidade Nacional de Vendas  ·  Relatório de Resultados", M, H - 4);
      pdf.text(`${i}/${pages}`, W - M, H - 4, { align: "right" });
    }
  };

  const ensure = (h: number) => { if (y + h > H - 16) { pdf.addPage(); y = M; } };

  const sectionTitle = (num: string, title: string) => {
    ensure(16);
    setText(NAVY); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
    pdf.text(`${num}  ${title}`, M, y + 5);
    setFill(RED); pdf.rect(M, y + 7.5, CW, 0.8, "F");
    y += 13;
  };

  const para = (text: string, opts: { size?: number; color?: number[]; bold?: boolean; gap?: number } = {}) => {
    if (!text) return;
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setFontSize(opts.size || 10.5); setText(opts.color || DARK);
    const lines = pdf.splitTextToSize(text, CW);
    for (const ln of lines) { ensure(6); pdf.text(ln, M, y); y += 5.4; }
    y += opts.gap ?? 2;
  };

  const bullet = (text: string) => {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10.5); setText(DARK);
    const lines = pdf.splitTextToSize(text, CW - 6);
    ensure(lines.length * 5.4);
    setFill(RED); pdf.circle(M + 1.4, y - 1.4, 0.9, "F");
    lines.forEach((ln: string, i: number) => { pdf.text(ln, M + 6, y); if (i < lines.length - 1) y += 5.4; });
    y += 6.4;
  };

  const statRow = (items: { label: string; value: string }[]) => {
    const n = items.length, gap = 4, cw = (CW - gap * (n - 1)) / n, ch = 22;
    ensure(ch + 3);
    items.forEach((it, i) => {
      const x = M + i * (cw + gap);
      setFill(LIGHT); pdf.rect(x, y, cw, ch, "F");
      setFill(NAVY); pdf.rect(x, y, 1.6, ch, "F");
      setText(NAVY); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
      pdf.text(it.value, x + 5, y + 11);
      setText(GREY); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
      pdf.text(it.label.toUpperCase(), x + 5, y + 17);
    });
    y += ch + 6;
  };

  const chartImg = async (dataUrl?: string) => {
    if (!dataUrl) return;
    const img = await loadImg(dataUrl);
    if (!img) return;
    const w = CW, h = w * (img.height / img.width);
    ensure(h + 4);
    pdf.addImage(img, "PNG", M, y, w, h);
    y += h + 6;
  };

  // ---------- CAPA ----------
  setFill(NAVY); pdf.rect(0, 0, W, 62, "F");
  const logo = await loadImg(unvLogo);
  if (logo) {
    const lw = 40, lh = lw * (logo.height / logo.width);
    pdf.addImage(logo, "PNG", M, 14, lw, Math.min(lh, 34));
  }
  setText([255, 255, 255]); pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
  pdf.text("UNIVERSIDADE NACIONAL DE VENDAS", W - M, 24, { align: "right" });
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); setText([200, 210, 230]);
  pdf.text("Diretoria Comercial Terceirizada", W - M, 30, { align: "right" });

  y = 92;
  setText(NAVY); pdf.setFont("helvetica", "bold"); pdf.setFontSize(30);
  pdf.text("RELATÓRIO DE", M, y); pdf.text("RESULTADOS", M, y + 13);
  y += 26;
  setFill(RED); pdf.rect(M, y, 60, 1.4, "F"); y += 12;
  setText(NAVY); pdf.setFont("helvetica", "bold"); pdf.setFontSize(18);
  pdf.text(d.company?.name || "Empresa", M, y); y += 9;
  setText(GREY); pdf.setFont("helvetica", "normal"); pdf.setFontSize(12);
  pdf.text(d.project?.product || "", M, y); y += 16;

  const periodLabel = period === "all" ? "Histórico completo da parceria" : `Últimos ${period} dias`;
  setText(DARK); pdf.setFontSize(10.5);
  pdf.text(`Período: ${periodLabel}`, M, y); y += 6;
  pdf.text(`Consultor responsável: ${d.project?.consultant || "—"}`, M, y); y += 6;
  pdf.text(`Início da parceria: ${ptDate(d.project?.start)}`, M, y); y += 6;
  pdf.text(`Emitido em: ${ptDate(d.generatedAt?.slice(0, 10))}`, M, y);

  // faixa números na capa
  y = 236;
  statRow([
    { label: "Reuniões", value: String(d.meetingsCount || 0) },
    { label: "Ações realizadas", value: String(d.actions?.total || 0) },
    { label: "Faturamento", value: (d.kpis?.faturamentoTotal ? brl(d.kpis.faturamentoTotal) : "—") },
  ]);

  // ---------- 1. RESUMO EXECUTIVO ----------
  pdf.addPage(); y = M;
  sectionTitle("01", "Resumo Executivo");
  para(d.narrative?.resumo_executivo || "");

  // ---------- 2. O QUE FIZEMOS ----------
  sectionTitle("02", "O Que a UNV Realizou");
  (d.narrative?.o_que_fizemos || []).forEach((t: string) => bullet(t));

  // ---------- 3. REUNIÕES ----------
  sectionTitle("03", "Reuniões Realizadas");
  para(`Foram realizadas ${d.meetingsCount || 0} reuniões de acompanhamento e alinhamento no período.`, { gap: 3 });
  (d.meetings || []).slice(0, 30).forEach((m: any) => {
    ensure(6);
    setText(NAVY); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9.5);
    pdf.text(ptDate(m.date), M, y);
    setText(DARK); pdf.setFont("helvetica", "normal");
    const t = pdf.splitTextToSize(m.title || "Reunião", CW - 34);
    pdf.text(t[0], M + 32, y); y += 5.6;
  });
  y += 2;

  // ---------- 4. AÇÕES REALIZADAS ----------
  sectionTitle("04", "Ações Realizadas");
  statRow([
    { label: "Concluídas", value: String(d.actions?.total || 0) },
    { label: "Em andamento", value: String(d.actions?.open || 0) },
  ]);
  await chartImg(d.charts?.acoes);

  // ---------- 5. RESULTADOS ----------
  sectionTitle("05", "Resultados Gerados");
  statRow([
    { label: "Faturamento no período", value: d.kpis?.faturamentoTotal ? brl(d.kpis.faturamentoTotal) : "—" },
    { label: "Vendas", value: String(d.kpis?.vendasTotal || 0) },
    { label: "NPS", value: d.project?.nps != null ? String(d.project.nps) : "—" },
  ]);
  await chartImg(d.charts?.faturamento);
  para(d.narrative?.resultado || "");

  // ---------- 6. ACOMPANHAMENTO NOS GRUPOS ----------
  sectionTitle("06", "Acompanhamento nos Grupos de WhatsApp");
  const g = d.groups || {};
  statRow([
    { label: "Mensagens — Gestão", value: g.gestao ? String(g.gestao.total) : "—" },
    { label: "Mensagens — Vendedores", value: g.vendedores ? String(g.vendedores.total) : "—" },
  ]);
  para(d.narrative?.analise_grupos || "A operação foi acompanhada de perto pelos grupos de gestão e de vendedores.");

  // ---------- 7. DESTAQUES ----------
  if ((d.narrative?.destaques || []).length) {
    sectionTitle("07", "Destaques do Período");
    (d.narrative.destaques || []).forEach((t: string) => bullet(t));
  }

  // fecho
  ensure(28);
  y += 4;
  setFill(NAVY); pdf.rect(M, y, CW, 22, "F");
  setText([255, 255, 255]); pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
  const fecho = pdf.splitTextToSize("Seguimos juntos, com processo e resultado. — Universidade Nacional de Vendas", CW - 12);
  pdf.text(fecho, M + 6, y + 9);

  footer();
  const fname = `Relatorio_${(d.company?.name || "Empresa").replace(/[^a-zA-Z0-9]+/g, "_")}_${(d.generatedAt || "").slice(0, 10)}.pdf`;
  pdf.save(fname);
  return fname;
}
