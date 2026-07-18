// Certificados do UNV Academy — emitidos por AULA concluída e por TRILHA completa.
// PDF gerado no cliente (jsPDF, paisagem A4) com branding UNV (navy/vermelho/dourado),
// salvo no bucket público `academy-certificates` e registrado em `academy_certificates`
// com código de verificação único.
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/logo-unv-oficial.png";

const NAVY = "#0D2B5E";
const RED = "#CC1B1B";
const GOLD = "#C9A84C";

let logoCache: { data: string; w: number; h: number } | null = null;
async function loadLogo(): Promise<{ data: string; w: number; h: number } | null> {
  if (logoCache) return logoCache;
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.src = data;
    });
    logoCache = { data, w: dims.w, h: dims.h };
    return logoCache;
  } catch {
    return null;
  }
}

function certificateCode(): string {
  // UNV-XXXX-XXXX (sem 0/O/1/I pra facilitar conferência por telefone)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => chars[b % chars.length])
      .join("");
  return `UNV-${block()}-${block()}`;
}

interface CertificatePdfArgs {
  userName: string;
  /** "Aula" ou "Trilha" */
  kindLabel: string;
  title: string;
  /** linha auxiliar (ex.: nome da trilha da aula, ou "12 aulas") */
  subtitle?: string | null;
  hours: number;
  /** % da aula efetivamente assistida (estampado no certificado da aula) */
  watchedPct?: number | null;
  code: string;
  issuedAt: Date;
}

async function generateCertificatePdf(args: CertificatePdfArgs): Promise<Blob> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const H = 210;

  // Fundo branco + moldura navy dupla com filete dourado
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");
  doc.setDrawColor(NAVY);
  doc.setLineWidth(2.2);
  doc.rect(8, 8, W - 16, H - 16);
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.6);
  doc.rect(12, 12, W - 24, H - 24);

  // Faixa superior navy
  doc.setFillColor(NAVY);
  doc.rect(12, 12, W - 24, 30, "F");

  // Logo na faixa (fundo branco atrás pra logo não sumir no navy)
  const logo = await loadLogo();
  if (logo) {
    const lh = 18;
    const lw = (logo.w / logo.h) * lh;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(20, 18, lw + 8, lh + 6, 2, 2, "F");
    doc.addImage(logo.data, "PNG", 24, 21, lw, lh);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("CERTIFICADO", W - 24, 28, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("UNV Academy — Universidade Nacional de Vendas", W - 24, 35, { align: "right" });

  // Corpo
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(12);
  doc.text("Certificamos que", W / 2, 64, { align: "center" });

  doc.setTextColor(NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text(args.userName, W / 2, 78, { align: "center" });

  // linha dourada sob o nome
  const nameWidth = Math.min(doc.getTextWidth(args.userName) + 20, 220);
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - nameWidth / 2, 83, W / 2 + nameWidth / 2, 83);

  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`concluiu com êxito a ${args.kindLabel.toLowerCase()}`, W / 2, 94, { align: "center" });

  doc.setTextColor(RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  const titleLines = doc.splitTextToSize(args.title, 230);
  doc.text(titleLines, W / 2, 106, { align: "center" });
  let y = 106 + titleLines.length * 8;

  if (args.subtitle) {
    doc.setTextColor(110, 110, 110);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(args.subtitle, W / 2, y + 2, { align: "center" });
    y += 9;
  }

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(12);
  const hoursLabel = args.hours === 1 ? "1 hora" : `${args.hours} horas`;
  doc.text(`com carga horária de ${hoursLabel}.`, W / 2, y + 4, { align: "center" });

  if (args.watchedPct != null) {
    doc.setTextColor(110, 110, 110);
    doc.setFontSize(11);
    doc.text(`Aproveitamento: ${args.watchedPct}% da aula assistida`, W / 2, y + 12, { align: "center" });
  }

  // Rodapé: data + assinatura + verificação
  const issued = args.issuedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  doc.setFontSize(10.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`Emitido em ${issued}`, 26, 172);

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.4);
  doc.line(W / 2 - 40, 168, W / 2 + 40, 168);
  doc.setTextColor(NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Fabrício Nunes", W / 2, 174, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text("CEO e Fundador — UNV Holdings", W / 2, 179, { align: "center" });

  doc.setTextColor(90, 90, 90);
  doc.setFontSize(9);
  doc.text(`Código de verificação: ${args.code}`, W - 26, 172, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Verifique em unvholdings.com.br/#/certificado/${args.code}`, W - 26, 177, { align: "right" });

  // Faixa inferior fina vermelha
  doc.setFillColor(RED);
  doc.rect(12, H - 16, W - 24, 4, "F");

  return doc.output("blob");
}

export interface IssuedCertificate {
  id: string;
  certificate_code: string;
  pdf_url: string;
}

async function uploadAndRegister(opts: {
  onboardingUserId: string;
  trackId?: string | null;
  lessonId?: string | null;
  hours: number;
  pdf: Blob;
  code: string;
}): Promise<IssuedCertificate> {
  const path = `${opts.onboardingUserId}/${opts.lessonId || opts.trackId}-${Date.now()}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("academy-certificates")
    .upload(path, opts.pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("academy-certificates").getPublicUrl(path);

  const { data: row, error: insErr } = await (supabase as any)
    .from("academy_certificates")
    .insert({
      onboarding_user_id: opts.onboardingUserId,
      track_id: opts.trackId || null,
      lesson_id: opts.lessonId || null,
      certificate_code: opts.code,
      total_hours: opts.hours,
      pdf_url: pub.publicUrl,
    })
    .select("id, certificate_code, pdf_url")
    .single();
  if (insErr) throw insErr;
  return row as IssuedCertificate;
}

/** Certificado de UMA AULA concluída. Idempotente: se já existe, retorna o existente. */
export async function issueLessonCertificate(opts: {
  onboardingUserId: string;
  userName: string;
  lessonId: string;
  lessonTitle: string;
  trackName?: string | null;
  durationMinutes?: number | null;
}): Promise<IssuedCertificate> {
  const { data: existing } = await (supabase as any)
    .from("academy_certificates")
    .select("id, certificate_code, pdf_url")
    .eq("onboarding_user_id", opts.onboardingUserId)
    .eq("lesson_id", opts.lessonId)
    .maybeSingle();
  if (existing?.pdf_url) return existing as IssuedCertificate;

  // % assistido registrado na conclusão — sai estampado no certificado
  const { data: prog } = await (supabase as any)
    .from("academy_progress")
    .select("watched_pct")
    .eq("onboarding_user_id", opts.onboardingUserId)
    .eq("lesson_id", opts.lessonId)
    .maybeSingle();

  const hours = Math.max(1, Math.round((opts.durationMinutes || 60) / 60));
  const code = certificateCode();
  const pdf = await generateCertificatePdf({
    userName: opts.userName,
    kindLabel: "Aula",
    title: opts.lessonTitle,
    subtitle: opts.trackName ? `Trilha: ${opts.trackName}` : null,
    hours,
    watchedPct: prog?.watched_pct ?? null,
    code,
    issuedAt: new Date(),
  });
  return uploadAndRegister({
    onboardingUserId: opts.onboardingUserId,
    lessonId: opts.lessonId,
    hours,
    pdf,
    code,
  });
}

/** Certificado da TRILHA completa. Idempotente. */
export async function issueTrackCertificate(opts: {
  onboardingUserId: string;
  userName: string;
  trackId: string;
  trackName: string;
  lessonCount: number;
  totalMinutes: number;
}): Promise<IssuedCertificate> {
  const { data: existing } = await (supabase as any)
    .from("academy_certificates")
    .select("id, certificate_code, pdf_url")
    .eq("onboarding_user_id", opts.onboardingUserId)
    .eq("track_id", opts.trackId)
    .maybeSingle();
  if (existing?.pdf_url) return existing as IssuedCertificate;

  const hours = Math.max(1, Math.round(opts.totalMinutes / 60));
  const code = certificateCode();
  const pdf = await generateCertificatePdf({
    userName: opts.userName,
    kindLabel: "Trilha",
    title: opts.trackName,
    subtitle: `${opts.lessonCount} aula${opts.lessonCount === 1 ? "" : "s"} concluída${opts.lessonCount === 1 ? "" : "s"}`,
    hours,
    code,
    issuedAt: new Date(),
  });
  return uploadAndRegister({
    onboardingUserId: opts.onboardingUserId,
    trackId: opts.trackId,
    hours,
    pdf,
    code,
  });
}

/** Se TODAS as aulas da trilha estão concluídas, emite o certificado da trilha.
 * Retorna o certificado emitido (ou null se a trilha ainda não terminou). */
export async function maybeIssueTrackCertificate(opts: {
  onboardingUserId: string;
  userName: string;
  trackId: string;
  trackName: string;
}): Promise<IssuedCertificate | null> {
  const { data: lessons } = await supabase
    .from("academy_lessons")
    .select("id, estimated_duration_minutes")
    .eq("track_id", opts.trackId)
    .eq("is_active", true);
  if (!lessons || lessons.length === 0) return null;

  const { data: progress } = await (supabase as any)
    .from("academy_progress")
    .select("lesson_id, status")
    .eq("onboarding_user_id", opts.onboardingUserId)
    .in("lesson_id", lessons.map((l) => l.id));
  const completed = new Set(
    (progress || []).filter((p: any) => p.status === "completed").map((p: any) => p.lesson_id)
  );
  if (!lessons.every((l) => completed.has(l.id))) return null;

  const totalMinutes = lessons.reduce((s, l) => s + (l.estimated_duration_minutes || 60), 0);
  return issueTrackCertificate({
    onboardingUserId: opts.onboardingUserId,
    userName: opts.userName,
    trackId: opts.trackId,
    trackName: opts.trackName,
    lessonCount: lessons.length,
    totalMinutes,
  });
}
