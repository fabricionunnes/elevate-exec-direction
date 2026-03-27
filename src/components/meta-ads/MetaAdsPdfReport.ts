import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

const NAVY = [10, 25, 49] as const;      // Azul marinho UNV
const BLOOD_RED = [180, 18, 27] as const; // Vermelho sangue UNV
const GRAY = [100, 100, 100] as const;
const LIGHT_GRAY = [240, 240, 240] as const;
const WHITE = [255, 255, 255] as const;
const BLACK = [30, 30, 30] as const;

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatNumber = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const formatPercent = (v: number) => `${v.toFixed(2)}%`;

function drawBranding(doc: jsPDF) {
  const pageHeight = doc.internal.pageSize.getHeight();
  // Thick navy stripe on left
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 14, pageHeight, "F");
  // Thin blood-red line parallel
  doc.setFillColor(...BLOOD_RED);
  doc.rect(14, 0, 3, pageHeight, "F");
}

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  drawBranding(doc);

  // Header background
  doc.setFillColor(...NAVY);
  doc.rect(17, 0, doc.internal.pageSize.getWidth() - 17, 42, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...WHITE);
  doc.text(title, 28, 20);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 220);
  doc.text(subtitle, 28, 32);

  // Red accent line below header
  doc.setFillColor(...BLOOD_RED);
  doc.rect(17, 42, doc.internal.pageSize.getWidth() - 17, 2, "F");
}

function drawSectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFillColor(...NAVY);
  doc.rect(28, y, 4, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(title, 38, y + 10);
  return y + 22;
}

function drawKpiCard(doc: jsPDF, x: number, y: number, w: number, label: string, value: string) {
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(x, y, w, 28, 3, 3, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(label.toUpperCase(), x + w / 2, y + 10, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(value, x + w / 2, y + 22, { align: "center" });
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    drawBranding(doc);
    return 25;
  }
  return y;
}

function drawTableHeader(doc: jsPDF, y: number, cols: { label: string; x: number; w: number }[]): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(28, y, pageW - 40, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  cols.forEach(col => {
    doc.text(col.label, col.x + col.w / 2, y + 8, { align: "center" });
  });
  return y + 14;
}

function drawTableRow(doc: jsPDF, y: number, cols: { value: string; x: number; w: number }[], even: boolean): number {
  const pageW = doc.internal.pageSize.getWidth();
  if (even) {
    doc.setFillColor(248, 248, 252);
    doc.rect(28, y, pageW - 40, 11, "F");
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...BLACK);
  cols.forEach(col => {
    const text = col.value.length > 22 ? col.value.substring(0, 20) + "…" : col.value;
    doc.text(text, col.x + col.w / 2, y + 7.5, { align: "center" });
  });
  return y + 11;
}

export async function generateMetaAdsPdf(
  projectId: string,
  dateStart: string,
  dateStop: string,
  accountName: string
) {
  // Fetch all data in parallel
  const [campaignsRes, adsetsRes, adsRes] = await Promise.all([
    supabase.from("meta_ads_campaigns").select("*").eq("project_id", projectId).eq("date_start", dateStart).eq("date_stop", dateStop).order("spend", { ascending: false }),
    supabase.from("meta_ads_adsets").select("*").eq("project_id", projectId).eq("date_start", dateStart).eq("date_stop", dateStop).order("spend", { ascending: false }),
    supabase.from("meta_ads_ads").select("*").eq("project_id", projectId).eq("date_start", dateStart).eq("date_stop", dateStop).order("spend", { ascending: false }),
  ]);

  const campaigns = campaignsRes.data || [];
  const adsets = adsetsRes.data || [];
  const ads = adsRes.data || [];

  const doc = new jsPDF("portrait", "mm", "a4");
  const pageW = doc.internal.pageSize.getWidth();

  // ──────────── PAGE 1: COVER + OVERVIEW ────────────
  const formattedStart = new Date(dateStart + "T12:00:00").toLocaleDateString("pt-BR");
  const formattedStop = new Date(dateStop + "T12:00:00").toLocaleDateString("pt-BR");

  drawHeader(doc, "Relatório Meta Ads", `Conta: ${accountName}  •  Período: ${formattedStart} a ${formattedStop}`);

  // Totals
  const totals = campaigns.reduce((acc, c) => ({
    impressions: acc.impressions + Number(c.impressions || 0),
    reach: acc.reach + Number(c.reach || 0),
    clicks: acc.clicks + Number(c.clicks || 0),
    spend: acc.spend + Number(c.spend || 0),
    conversions: acc.conversions + Number(c.conversions || 0),
    conversion_value: acc.conversion_value + Number(c.conversion_value || 0),
    messaging_conversations_started: acc.messaging_conversations_started + Number((c as any).messaging_conversations_started || 0),
    frequency_sum: acc.frequency_sum + Number(c.frequency || 0),
    frequency_count: acc.frequency_count + (Number(c.frequency || 0) > 0 ? 1 : 0),
  }), { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0, conversion_value: 0, messaging_conversations_started: 0, frequency_sum: 0, frequency_count: 0 });

  const avgCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
  const avgCPC = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const avgCPM = totals.impressions > 0 ? (totals.spend / totals.impressions * 1000) : 0;
  const roas = totals.spend > 0 ? totals.conversion_value / totals.spend : 0;
  const avgFrequency = totals.frequency_count > 0 ? totals.frequency_sum / totals.frequency_count : 0;
  const costPerConv = totals.messaging_conversations_started > 0 ? totals.spend / totals.messaging_conversations_started : 0;

  let y = 56;
  y = drawSectionTitle(doc, y, "Visão Geral");

  // KPI Cards - 4 columns x 3 rows
  const kpis = [
    { label: "Investimento", value: formatCurrency(totals.spend) },
    { label: "Impressões", value: formatNumber(totals.impressions) },
    { label: "Alcance", value: formatNumber(totals.reach) },
    { label: "Cliques", value: formatNumber(totals.clicks) },
    { label: "CTR", value: formatPercent(avgCTR) },
    { label: "CPC", value: formatCurrency(avgCPC) },
    { label: "CPM", value: formatCurrency(avgCPM) },
    { label: "ROAS", value: roas.toFixed(2) + "x" },
    { label: "Conversas Iniciadas", value: formatNumber(totals.messaging_conversations_started) },
    { label: "Custo por Conversa", value: formatCurrency(costPerConv) },
    { label: "Frequência", value: avgFrequency.toFixed(2) },
    { label: "Conversões", value: formatNumber(totals.conversions) },
  ];

  const cardW = (pageW - 28 - 12 - 9) / 4; // 4 cols with 3mm gap
  kpis.forEach((kpi, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    drawKpiCard(doc, 28 + col * (cardW + 3), y + row * 33, cardW, kpi.label, kpi.value);
  });
  y += Math.ceil(kpis.length / 4) * 33 + 8;

  // ──────────── CAMPAIGNS TABLE ────────────
  y = checkPageBreak(doc, y, 50);
  y = drawSectionTitle(doc, y, "Campanhas");

  const campCols = [
    { label: "CAMPANHA", x: 28, w: 45 },
    { label: "STATUS", x: 73, w: 22 },
    { label: "INVEST.", x: 95, w: 25 },
    { label: "IMPR.", x: 120, w: 25 },
    { label: "CLIQUES", x: 145, w: 20 },
    { label: "CTR", x: 165, w: 18 },
    { label: "CPC", x: 183, w: 20 },
  ];

  y = drawTableHeader(doc, y, campCols);

  campaigns.forEach((c, i) => {
    y = checkPageBreak(doc, y, 12);
    if (y < 30) y = drawTableHeader(doc, y, campCols);
    const row = [
      { value: c.campaign_name || "Sem nome", x: 28, w: 45 },
      { value: c.status || "-", x: 73, w: 22 },
      { value: formatCurrency(Number(c.spend)), x: 95, w: 25 },
      { value: formatNumber(Number(c.impressions)), x: 120, w: 25 },
      { value: formatNumber(Number(c.clicks)), x: 145, w: 20 },
      { value: formatPercent(Number(c.ctr)), x: 165, w: 18 },
      { value: formatCurrency(Number(c.cpc)), x: 183, w: 20 },
    ];
    y = drawTableRow(doc, y, row, i % 2 === 0);
  });

  // ──────────── ADSETS TABLE ────────────
  y += 8;
  y = checkPageBreak(doc, y, 50);
  y = drawSectionTitle(doc, y, "Conjuntos de Anúncios");

  const adsetCols = [
    { label: "CONJUNTO", x: 28, w: 40 },
    { label: "CAMPANHA", x: 68, w: 35 },
    { label: "INVEST.", x: 103, w: 22 },
    { label: "IMPR.", x: 125, w: 22 },
    { label: "CLIQUES", x: 147, w: 18 },
    { label: "CTR", x: 165, w: 18 },
    { label: "FREQ.", x: 183, w: 20 },
  ];

  y = drawTableHeader(doc, y, adsetCols);

  adsets.forEach((a, i) => {
    y = checkPageBreak(doc, y, 12);
    if (y < 30) y = drawTableHeader(doc, y, adsetCols);
    const row = [
      { value: a.adset_name || "Sem nome", x: 28, w: 40 },
      { value: a.campaign_name || "-", x: 68, w: 35 },
      { value: formatCurrency(Number(a.spend)), x: 103, w: 22 },
      { value: formatNumber(Number(a.impressions)), x: 125, w: 22 },
      { value: formatNumber(Number(a.clicks)), x: 147, w: 18 },
      { value: formatPercent(Number(a.ctr)), x: 165, w: 18 },
      { value: Number(a.frequency).toFixed(2), x: 183, w: 20 },
    ];
    y = drawTableRow(doc, y, row, i % 2 === 0);
  });

  // ──────────── ADS / CREATIVES TABLE ────────────
  y += 8;
  y = checkPageBreak(doc, y, 50);
  y = drawSectionTitle(doc, y, "Criativos / Anúncios");

  const adCols = [
    { label: "ANÚNCIO", x: 28, w: 40 },
    { label: "CAMPANHA", x: 68, w: 30 },
    { label: "INVEST.", x: 98, w: 22 },
    { label: "CLIQUES", x: 120, w: 18 },
    { label: "CTR", x: 138, w: 16 },
    { label: "CPC", x: 154, w: 22 },
    { label: "ROAS", x: 176, w: 16 },
  ];

  y = drawTableHeader(doc, y, adCols);

  ads.forEach((ad, i) => {
    y = checkPageBreak(doc, y, 12);
    if (y < 30) y = drawTableHeader(doc, y, adCols);
    const row = [
      { value: ad.ad_name || "Sem nome", x: 28, w: 40 },
      { value: ad.campaign_name || "-", x: 68, w: 30 },
      { value: formatCurrency(Number(ad.spend)), x: 98, w: 22 },
      { value: formatNumber(Number(ad.clicks)), x: 120, w: 18 },
      { value: formatPercent(Number(ad.ctr)), x: 138, w: 16 },
      { value: formatCurrency(Number(ad.cpc)), x: 154, w: 22 },
      { value: Number(ad.roas).toFixed(2) + "x", x: 176, w: 16 },
    ];
    y = drawTableRow(doc, y, row, i % 2 === 0);

    // Show creative text below if available
    if (ad.creative_body) {
      y = checkPageBreak(doc, y, 14);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6);
      doc.setTextColor(...GRAY);
      const bodyText = ad.creative_body.length > 120 ? ad.creative_body.substring(0, 117) + "…" : ad.creative_body;
      doc.text(bodyText, 32, y + 5, { maxWidth: pageW - 50 });
      y += 10;
    }
  });

  // ──────────── FOOTER on every page ────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p > 1) drawBranding(doc);
    const h = doc.internal.pageSize.getHeight();

    // Footer line
    doc.setFillColor(...BLOOD_RED);
    doc.rect(17, h - 14, pageW - 17, 0.5, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text("Universidade Nacional de Vendas  •  Relatório Meta Ads", 28, h - 7);
    doc.text(`Página ${p} de ${totalPages}`, pageW - 12, h - 7, { align: "right" });
  }

  doc.save(`relatorio-meta-ads-${dateStart}-${dateStop}.pdf`);
}
