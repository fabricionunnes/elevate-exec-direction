import jsPDF from "jspdf";

interface RoutineTask {
  time?: string;
  task: string;
  priority?: string;
}

interface Indicator {
  name: string;
  target: string;
  frequency: string;
}

const NAVY = [10, 25, 49] as const;
const RED = [180, 30, 35] as const;
const GOLD = [180, 150, 80] as const;
const WHITE = [255, 255, 255] as const;
const GRAY = [100, 100, 100] as const;
const LIGHT_GRAY = [240, 240, 240] as const;

function drawSideBars(doc: jsPDF) {
  const h = doc.internal.pageSize.getHeight();
  // Navy bar (thick)
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 12, h, "F");
  // Red bar (thin)
  doc.setFillColor(...RED);
  doc.rect(12, 0, 4, h, "F");
}

function drawFooter(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Universidade Nacional de Vendas", w / 2, h - 10, { align: "center" });
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.line(24, h - 16, w - 16, h - 16);
}

function addPage(doc: jsPDF) {
  doc.addPage();
  drawSideBars(doc);
  drawFooter(doc);
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(24, y, w - 40, 9, "F");
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.text(title, 28, y + 6.5);
  return y + 14;
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth);
}

export async function generateRoutinePDF(contract: any) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const contentWidth = w - 44; // left margin 24 + right margin 20

  // ===== COVER PAGE =====
  drawSideBars(doc);

  // Background header area
  doc.setFillColor(...NAVY);
  doc.rect(16, 0, w - 16, 100, "F");

  // Title
  doc.setFontSize(32);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("CONTRATO", 28, 45);
  doc.text("DE ROTINA", 28, 58);

  // Gold accent line
  doc.setFillColor(...GOLD);
  doc.rect(28, 65, 50, 2, "F");

  // Employee info on cover
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.text(contract.employee_name || "", 28, 80);
  doc.setFontSize(12);
  doc.text(contract.employee_role || "", 28, 88);

  // Company area
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.text(contract.employee_department || "", 28, 120);

  // Footer
  drawFooter(doc);

  // ===== INTRODUCTION =====
  if (contract.introduction) {
    addPage(doc);
    let y = drawSectionTitle(doc, "INTRODUÇÃO", 20);
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "normal");
    const lines = wrapText(doc, contract.introduction, contentWidth);
    for (const line of lines) {
      if (y > 270) { addPage(doc); y = 20; }
      doc.text(line, 24, y);
      y += 5;
    }
  }

  // ===== DAILY ROUTINE =====
  const dailyRoutine = (contract.daily_routine || []) as RoutineTask[];
  if (dailyRoutine.length > 0) {
    addPage(doc);
    let y = drawSectionTitle(doc, "ROTINA DIÁRIA", 20);

    // Table header
    doc.setFillColor(...LIGHT_GRAY);
    doc.rect(24, y, contentWidth, 7, "F");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.text("Horário", 26, y + 5);
    doc.text("Atividade", 50, y + 5);
    doc.text("Prioridade", w - 40, y + 5);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    for (const task of dailyRoutine) {
      if (y > 270) { addPage(doc); y = 20; }
      doc.text(task.time || "—", 26, y);
      const taskLines = wrapText(doc, task.task, contentWidth - 65);
      doc.text(taskLines[0] || "", 50, y);
      doc.text(task.priority || "—", w - 40, y);
      y += 6 + (taskLines.length - 1) * 4;
    }
  }

  // ===== WEEKLY ROUTINE =====
  const weeklyRoutine = (contract.weekly_routine || []) as RoutineTask[];
  if (weeklyRoutine.length > 0) {
    addPage(doc);
    let y = drawSectionTitle(doc, "ROTINA SEMANAL", 20);

    doc.setFillColor(...LIGHT_GRAY);
    doc.rect(24, y, contentWidth, 7, "F");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.text("Dia/Período", 26, y + 5);
    doc.text("Atividade", 60, y + 5);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    for (const task of weeklyRoutine) {
      if (y > 270) { addPage(doc); y = 20; }
      doc.text(task.time || "—", 26, y);
      const taskLines = wrapText(doc, task.task, contentWidth - 40);
      doc.text(taskLines[0] || "", 60, y);
      y += 6 + (taskLines.length - 1) * 4;
    }
  }

  // ===== INDICATORS =====
  const indicators = (contract.performance_indicators || []) as Indicator[];
  if (indicators.length > 0) {
    addPage(doc);
    let y = drawSectionTitle(doc, "INDICADORES DE PERFORMANCE", 20);

    doc.setFillColor(...LIGHT_GRAY);
    doc.rect(24, y, contentWidth, 7, "F");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.text("Indicador", 26, y + 5);
    doc.text("Meta", 100, y + 5);
    doc.text("Frequência", 140, y + 5);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    for (const ind of indicators) {
      if (y > 270) { addPage(doc); y = 20; }
      doc.text(ind.name, 26, y);
      doc.text(ind.target, 100, y);
      doc.text(ind.frequency, 140, y);
      y += 6;
    }
  }

  // ===== RESPONSIBILITIES =====
  if (contract.responsibilities) {
    addPage(doc);
    let y = drawSectionTitle(doc, "RESPONSABILIDADES", 20);
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "normal");
    const lines = wrapText(doc, contract.responsibilities, contentWidth);
    for (const line of lines) {
      if (y > 270) { addPage(doc); y = 20; }
      doc.text(line, 24, y);
      y += 5;
    }
  }

  // ===== OBSERVATIONS =====
  if (contract.observations) {
    addPage(doc);
    let y = drawSectionTitle(doc, "OBSERVAÇÕES FINAIS", 20);
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "normal");
    const lines = wrapText(doc, contract.observations, contentWidth);
    for (const line of lines) {
      if (y > 270) { addPage(doc); y = 20; }
      doc.text(line, 24, y);
      y += 5;
    }
  }

  // Save
  const fileName = `Contrato_Rotina_${(contract.employee_name || "colaborador").replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}
