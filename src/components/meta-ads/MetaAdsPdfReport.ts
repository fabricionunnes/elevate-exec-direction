import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/logo-unv-oficial.png";

const NAVY = [10, 25, 49] as const;
const BLOOD_RED = [180, 18, 27] as const;
const GRAY = [100, 100, 100] as const;
const LIGHT_GRAY = [240, 240, 240] as const;
const WHITE = [255, 255, 255] as const;
const BLACK = [30, 30, 30] as const;

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatNumber = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const formatPercent = (v: number) => `${v.toFixed(2)}%`;

// Load logo as base64
async function loadLogoBase64(): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve("");
    img.src = logoUrl;
  });
}

function drawBranding(doc: jsPDF) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 14, pageHeight, "F");
  doc.setFillColor(...BLOOD_RED);
  doc.rect(14, 0, 3, pageHeight, "F");
}

function drawWatermark(doc: jsPDF, logoBase64: string) {
  if (!logoBase64) return;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const wmW = 120;
  const wmH = 120;
  const x = (pageW - wmW) / 2 + 8;
  const y = (pageH - wmH) / 2;

  // Save graphics state and set opacity
  (doc as any).setGState(new (doc as any).GState({ opacity: 0.06 }));
  doc.addImage(logoBase64, "PNG", x, y, wmW, wmH);
  (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
}

function drawHeader(doc: jsPDF, title: string, subtitle: string, logoBase64: string) {
  drawBranding(doc);

  // Header background
  doc.setFillColor(...NAVY);
  doc.rect(17, 0, doc.internal.pageSize.getWidth() - 17, 42, "F");

  // Logo in header
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", 22, 4, 34, 34);
  }

  // Title
  const textX = logoBase64 ? 60 : 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...WHITE);
  doc.text(title, textX, 18);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 220);
  doc.text(subtitle, textX, 30);

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

  // Small accent bar at top
  doc.setFillColor(...BLOOD_RED);
  doc.roundedRect(x, y, w, 3, 3, 3, "F");
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(x, y + 2, w, 2, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(label.toUpperCase(), x + w / 2, y + 12, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(value, x + w / 2, y + 23, { align: "center" });
}

function checkPageBreak(doc: jsPDF, y: number, needed: number, logoBase64: string): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    drawBranding(doc);
    drawWatermark(doc, logoBase64);
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

// Capture a chart DOM element as image data URL
async function captureChart(elementId: string): Promise<string | null> {
  const el = document.getElementById(elementId);
  if (!el) return null;
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

// Draw simple bar chart directly in PDF as fallback
function drawPdfBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  data: { label: string; value: number; color: number[] }[],
  title: string
) {
  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(title, x, y - 3);

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barW = Math.min(w / data.length - 2, 18);
  const chartX = x + (w - data.length * (barW + 2)) / 2;

  // Draw bars
  data.forEach((d, i) => {
    const barH = (d.value / maxVal) * (h - 15);
    const bx = chartX + i * (barW + 2);
    const by = y + h - barH;

    // 3D effect
    doc.setFillColor(d.color[0] * 0.7, d.color[1] * 0.7, d.color[2] * 0.7);
    doc.rect(bx + 3, by - 3, barW, barH, "F");
    doc.setFillColor(...(d.color as [number, number, number]));
    doc.roundedRect(bx, by, barW, barH, 1, 1, "F");

    // Label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.setTextColor(...GRAY);
    const label = d.label.length > 8 ? d.label.substring(0, 7) + "…" : d.label;
    doc.text(label, bx + barW / 2, y + h + 4, { align: "center" });
  });

  // Baseline
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.3);
  doc.line(x, y + h, x + w, y + h);
}

function drawPdfPieChart(
  doc: jsPDF,
  cx: number,
  cy: number,
  radius: number,
  data: { label: string; value: number; color: number[] }[],
  title: string
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(title, cx - radius, cy - radius - 5);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return;

  let startAngle = 0;
  data.forEach((d) => {
    const sliceAngle = (d.value / total) * 360;
    const endAngle = startAngle + sliceAngle;

    // Draw filled arc (approximate with polygon)
    doc.setFillColor(...(d.color as [number, number, number]));
    const points: number[][] = [[cx, cy]];
    for (let angle = startAngle; angle <= endAngle; angle += 2) {
      const rad = (angle * Math.PI) / 180;
      points.push([cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)]);
    }
    const endRad = (endAngle * Math.PI) / 180;
    points.push([cx + radius * Math.cos(endRad), cy + radius * Math.sin(endRad)]);
    points.push([cx, cy]);

    // Draw as lines forming filled polygon
    if (points.length > 2) {
      doc.setFillColor(...(d.color as [number, number, number]));
      // Use triangle fan approach
      for (let i = 1; i < points.length - 1; i++) {
        doc.triangle(
          cx, cy,
          points[i][0], points[i][1],
          points[i + 1][0], points[i + 1][1],
          "F"
        );
      }
    }

    // Label
    const midAngle = ((startAngle + endAngle) / 2 * Math.PI) / 180;
    const lx = cx + (radius + 8) * Math.cos(midAngle);
    const ly = cy + (radius + 8) * Math.sin(midAngle);
    if (sliceAngle > 15) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5);
      doc.setTextColor(...BLACK);
      const pct = ((d.value / total) * 100).toFixed(0) + "%";
      doc.text(pct, lx, ly, { align: "center" });
    }

    startAngle = endAngle;
  });

  // White inner circle for donut effect
  doc.setFillColor(...WHITE);
  const innerR = radius * 0.35;
  // Approximate circle with many triangles
  for (let a = 0; a < 360; a += 5) {
    const r1 = (a * Math.PI) / 180;
    const r2 = ((a + 5) * Math.PI) / 180;
    doc.triangle(cx, cy, cx + innerR * Math.cos(r1), cy + innerR * Math.sin(r1), cx + innerR * Math.cos(r2), cy + innerR * Math.sin(r2), "F");
  }
}

export async function generateMetaAdsPdf(
  projectId: string,
  dateStart: string,
  dateStop: string,
  accountName: string,
  visibleMetrics?: Set<string>
) {
  // Load logo and data in parallel
  const [logoBase64, campaignsRes, adsetsRes, adsRes] = await Promise.all([
    loadLogoBase64(),
    supabase.from("meta_ads_campaigns").select("*").eq("project_id", projectId).eq("date_start", dateStart).eq("date_stop", dateStop).order("spend", { ascending: false }),
    supabase.from("meta_ads_adsets").select("*").eq("project_id", projectId).eq("date_start", dateStart).eq("date_stop", dateStop).order("spend", { ascending: false }),
    supabase.from("meta_ads_ads").select("*").eq("project_id", projectId).eq("date_start", dateStart).eq("date_stop", dateStop).order("spend", { ascending: false }),
  ]);

  const campaigns = campaignsRes.data || [];
  const adsets = adsetsRes.data || [];
  const ads = adsRes.data || [];

  // Try to capture charts from the DOM
  const [chartSpend, chartPie, chartRadial, chartClicksReach] = await Promise.all([
    captureChart("chart-spend-campaign"),
    captureChart("chart-spend-pie"),
    captureChart("chart-radial"),
    captureChart("chart-clicks-reach"),
  ]);

  const doc = new jsPDF("portrait", "mm", "a4");
  const pageW = doc.internal.pageSize.getWidth();

  const formattedStart = new Date(dateStart + "T12:00:00").toLocaleDateString("pt-BR");
  const formattedStop = new Date(dateStop + "T12:00:00").toLocaleDateString("pt-BR");

  // ──────────── PAGE 1: COVER + OVERVIEW ────────────
  drawHeader(doc, "Relatório Meta Ads", `Conta: ${accountName}  •  Período: ${formattedStart} a ${formattedStop}`, logoBase64);
  drawWatermark(doc, logoBase64);

  // Totals
  const totals = campaigns.reduce((acc, c) => ({
    impressions: acc.impressions + Number(c.impressions || 0),
    reach: acc.reach + Number(c.reach || 0),
    clicks: acc.clicks + Number(c.clicks || 0),
    spend: acc.spend + Number(c.spend || 0),
    conversions: acc.conversions + Number(c.conversions || 0),
    conversion_value: acc.conversion_value + Number(c.conversion_value || 0),
    messaging_conversations_started: acc.messaging_conversations_started + Number((c as any).messaging_conversations_started || 0),
    leads: acc.leads + Number((c as any).leads || 0),
    frequency_sum: acc.frequency_sum + Number(c.frequency || 0),
    frequency_count: acc.frequency_count + (Number(c.frequency || 0) > 0 ? 1 : 0),
  }), { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0, conversion_value: 0, messaging_conversations_started: 0, leads: 0, frequency_sum: 0, frequency_count: 0 });

  const avgCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
  const avgCPC = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const avgCPM = totals.impressions > 0 ? (totals.spend / totals.impressions * 1000) : 0;
  const roas = totals.spend > 0 ? totals.conversion_value / totals.spend : 0;
  const avgFrequency = totals.frequency_count > 0 ? totals.frequency_sum / totals.frequency_count : 0;
  const costPerConv = totals.messaging_conversations_started > 0 ? totals.spend / totals.messaging_conversations_started : 0;

  let y = 56;
  y = drawSectionTitle(doc, y, "Visão Geral");

  const kpis = [
    { label: "Investimento", value: formatCurrency(totals.spend) },
    { label: "Impressões", value: formatNumber(totals.impressions) },
    { label: "Alcance", value: formatNumber(totals.reach) },
    { label: "Cliques", value: formatNumber(totals.clicks) },
    { label: "CTR", value: formatPercent(avgCTR) },
    { label: "CPC", value: formatCurrency(avgCPC) },
    { label: "CPM", value: formatCurrency(avgCPM) },
    { label: "ROAS", value: roas.toFixed(2) + "x" },
    { label: "Conversas", value: formatNumber(totals.messaging_conversations_started) },
    { label: "Custo/Conversa", value: formatCurrency(costPerConv) },
    { label: "Frequência", value: avgFrequency.toFixed(2) },
    { label: "Leads", value: formatNumber(totals.leads) },
  ];

  const cardW = (pageW - 28 - 12 - 9) / 4;
  kpis.forEach((kpi, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    drawKpiCard(doc, 28 + col * (cardW + 3), y + row * 33, cardW, kpi.label, kpi.value);
  });
  y += Math.ceil(kpis.length / 4) * 33 + 8;

  // ──────────── CHARTS PAGE ────────────
  doc.addPage();
  drawBranding(doc);
  drawWatermark(doc, logoBase64);
  y = 20;
  y = drawSectionTitle(doc, y, "Gráficos de Performance");

  const chartW = (pageW - 28 - 12 - 4) / 2;
  const chartH = 70;

  if (chartSpend) {
    doc.addImage(chartSpend, "PNG", 28, y, chartW, chartH);
  } else {
    // Fallback: draw bars directly
    const barColors = [[10, 25, 49], [180, 18, 27], [59, 130, 246], [16, 185, 129], [245, 158, 11], [139, 92, 246]];
    const barData = campaigns.filter(c => Number(c.spend) > 0).slice(0, 8).map((c, i) => ({
      label: c.campaign_name?.substring(0, 10) || "?",
      value: Number(c.spend),
      color: barColors[i % barColors.length],
    }));
    drawPdfBarChart(doc, 28, y, chartW, chartH, barData, "Investimento por Campanha");
  }

  if (chartPie) {
    doc.addImage(chartPie, "PNG", 28 + chartW + 4, y, chartW, chartH);
  } else {
    const pieColors = [[10, 25, 49], [180, 18, 27], [59, 130, 246], [16, 185, 129], [245, 158, 11], [139, 92, 246]];
    const pieChartData = campaigns.filter(c => Number(c.spend) > 0).slice(0, 6).map((c, i) => ({
      label: c.campaign_name?.substring(0, 10) || "?",
      value: Number(c.spend),
      color: pieColors[i % pieColors.length],
    }));
    drawPdfPieChart(doc, 28 + chartW + 4 + chartW / 2, y + chartH / 2, 28, pieChartData, "Distribuição de Investimento");
  }

  y += chartH + 10;

  if (chartRadial) {
    doc.addImage(chartRadial, "PNG", 28, y, chartW, chartH);
  }

  if (chartClicksReach) {
    doc.addImage(chartClicksReach, "PNG", 28 + chartW + 4, y, chartW, chartH);
  } else {
    // Fallback bar chart for clicks
    const barColors2 = [[10, 25, 49], [180, 18, 27], [59, 130, 246], [16, 185, 129], [245, 158, 11]];
    const clicksData = campaigns.filter(c => Number(c.clicks) > 0).slice(0, 8).map((c, i) => ({
      label: c.campaign_name?.substring(0, 10) || "?",
      value: Number(c.clicks),
      color: barColors2[i % barColors2.length],
    }));
    drawPdfBarChart(doc, 28 + chartW + 4, y, chartW, chartH, clicksData, "Cliques por Campanha");
  }

  y += chartH + 10;

  // ──────────── CAMPAIGNS TABLE ────────────
  y = checkPageBreak(doc, y, 50, logoBase64);
  y = drawSectionTitle(doc, y, "Campanhas");

  const campCols = [
    { label: "CAMPANHA", x: 28, w: 40 },
    { label: "STATUS", x: 68, w: 20 },
    { label: "INVEST.", x: 88, w: 22 },
    { label: "IMPR.", x: 110, w: 22 },
    { label: "CLIQUES", x: 132, w: 18 },
    { label: "CTR", x: 150, w: 16 },
    { label: "CPC", x: 166, w: 20 },
    { label: "LEADS", x: 186, w: 16 },
  ];

  y = drawTableHeader(doc, y, campCols);

  campaigns.forEach((c, i) => {
    y = checkPageBreak(doc, y, 12, logoBase64);
    if (y < 30) y = drawTableHeader(doc, y, campCols);
    const row = [
      { value: c.campaign_name || "Sem nome", x: 28, w: 40 },
      { value: c.status || "-", x: 68, w: 20 },
      { value: formatCurrency(Number(c.spend)), x: 88, w: 22 },
      { value: formatNumber(Number(c.impressions)), x: 110, w: 22 },
      { value: formatNumber(Number(c.clicks)), x: 132, w: 18 },
      { value: formatPercent(Number(c.ctr)), x: 150, w: 16 },
      { value: formatCurrency(Number(c.cpc)), x: 166, w: 20 },
      { value: formatNumber(Number((c as any).leads || 0)), x: 186, w: 16 },
    ];
    y = drawTableRow(doc, y, row, i % 2 === 0);
  });

  // ──────────── ADSETS TABLE ────────────
  y += 8;
  y = checkPageBreak(doc, y, 50, logoBase64);
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
    y = checkPageBreak(doc, y, 12, logoBase64);
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
  y = checkPageBreak(doc, y, 50, logoBase64);
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
    y = checkPageBreak(doc, y, 12, logoBase64);
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

    if (ad.creative_body) {
      y = checkPageBreak(doc, y, 14, logoBase64);
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
    if (p > 1) {
      // Ensure branding on all pages
    }
    const h = doc.internal.pageSize.getHeight();

    // Footer line
    doc.setFillColor(...BLOOD_RED);
    doc.rect(17, h - 14, pageW - 17, 0.5, "F");

    // Small logo in footer
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", 20, h - 13, 8, 8);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text("Universidade Nacional de Vendas  •  Relatório Meta Ads", 30, h - 7);
    doc.text(`Página ${p} de ${totalPages}`, pageW - 12, h - 7, { align: "right" });
  }

  doc.save(`relatorio-meta-ads-${dateStart}-${dateStop}.pdf`);
}
