import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "npm:pdf-lib@1.17.1";
import { corsHeaders, createErrorResponse, createSuccessResponse, hashBuffer } from "../_shared/utils.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "https://unvholdings.com.br";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "assinatura@unvholdings.com.br";

const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " UTC" : "N/A";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { envelope_id } = await req.json() as { envelope_id?: string };
    if (!envelope_id) return createErrorResponse("envelope_id obrigatório", 400);
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: envelope } = await supabaseAdmin.from("envelopes").select("*").eq("id", envelope_id).maybeSingle();
    if (!envelope) return createErrorResponse("Envelope não encontrado", 404);
    if (envelope.status === "completed") return createSuccessResponse({ already_completed: true });
    const { data: signers } = await supabaseAdmin.from("signers").select("*").eq("envelope_id", envelope_id).order("order_index");
    const { data: auditEvents } = await supabaseAdmin.from("audit_events").select("*").eq("envelope_id", envelope_id).order("created_at");
    const { data: origPdfBlob } = await supabaseAdmin.storage.from("envelopes").download(envelope.original_file_path);
    if (!origPdfBlob) return createErrorResponse("Erro ao baixar PDF original", 500);
    const origBytes = await origPdfBlob.arrayBuffer();
    const finalPdf = await PDFDocument.load(origBytes, { ignoreEncryption: true });
    const fontBold = await finalPdf.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await finalPdf.embedFont(StandardFonts.Helvetica);
    const fontMono = await finalPdf.embedFont(StandardFonts.Courier);
    for (const signer of (signers ?? [])) {
      if (signer.status !== "signed" || !signer.signature_image_path) continue;
      try {
        const { data: sigBlob } = await supabaseAdmin.storage.from("envelopes").download(signer.signature_image_path);
        if (!sigBlob) continue;
        const sigImg = await finalPdf.embedPng(new Uint8Array(await sigBlob.arrayBuffer()));
        const pages = finalPdf.getPages();
        const last = pages[pages.length - 1];
        last.drawImage(sigImg, { x: 40 + signer.order_index * 160, y: 30, width: 140, height: 50, opacity: 0.85 });
        last.drawText(signer.name.slice(0, 30), { x: 40 + signer.order_index * 160, y: 25, size: 7, font: fontRegular, color: rgb(0.3,0.3,0.3) });
      } catch { /* ignore */ }
    }
    const mp = finalPdf.addPage(PageSizes.A4);
    const { width: pw, height: ph } = mp.getSize();
    const M = 48; let y = ph - M;
    const dt = (text: string, opts: { s?: number; bold?: boolean; mono?: boolean; c?: [number,number,number]; i?: number }) => {
      const { s = 9, bold = false, mono = false, c = [0.1,0.1,0.1] as [number,number,number], i = 0 } = opts;
      const font = mono ? fontMono : bold ? fontBold : fontRegular;
      mp.drawText(String(text).slice(0, 110), { x: M + i, y, size: s, font, color: rgb(...c), maxWidth: pw - M*2 - i });
      y -= s + 5;
    };
    const dl = () => { mp.drawLine({ start: { x: M, y }, end: { x: pw - M, y }, thickness: 0.5, color: rgb(0.8,0.8,0.8) }); y -= 8; };
    const ds = (t: string) => { y -= 4; mp.drawRectangle({ x: M, y: y-2, width: pw-M*2, height: 16, color: rgb(0.05,0.17,0.37), borderRadius: 2 }); mp.drawText(t, { x: M+6, y: y+2, size: 8, font: fontBold, color: rgb(1,1,1) }); y -= 20; };
    mp.drawRectangle({ x: 0, y: ph-80, width: pw, height: 80, color: rgb(0.05,0.17,0.37) });
    mp.drawText("MANIFESTO DE ASSINATURA ELETRONICA", { x: M, y: ph-30, size: 14, font: fontBold, color: rgb(1,1,1) });
    mp.drawText("UNV Nexus - MP 2.200-2/2001 e Lei 14.063/2020", { x: M, y: ph-48, size: 9, font: fontRegular, color: rgb(0.7,0.8,0.9) });
    mp.drawText(`Verificar: ${APP_URL}/#/verificar/${envelope_id}`, { x: M, y: ph-62, size: 8, font: fontMono, color: rgb(0.6,0.75,0.85) });
    y = ph - 96;
    ds("IDENTIFICACAO DO DOCUMENTO");
    dt(`Titulo: ${envelope.title}`, { bold: true });
    dt(`ID: ${envelope_id}`, { mono: true, s: 8 });
    dt(`Criado: ${fmtDate(envelope.created_at)}`, { s: 8 });
    dl();
    ds("INTEGRIDADE");
    dt("SHA-256 Original:", { s: 8, bold: true });
    dt(envelope.original_file_hash ?? "N/A", { mono: true, s: 7.5, i: 8 });
    dl();
    ds("SIGNATARIOS");
    for (const s of (signers ?? [])) {
      if (y < 100) break;
      const sl = { signed: "ASSINOU", pending: "PENDENTE", viewed: "VISUALIZOU", declined: "RECUSOU" }[s.status as string] ?? s.status;
      dt(`${s.name} - ${sl}`, { bold: true });
      dt(`E-mail: ${s.email}`, { s: 8, i: 8 });
      if (s.status === "signed") {
        dt(`Assinado: ${fmtDate(s.signed_at)}`, { s: 8, i: 8 });
        dt(`IP: ${s.sign_ip ?? "N/A"}`, { s: 8, i: 8, mono: true });
        dt(`Local: ${[s.sign_geo_city, s.sign_geo_region, s.sign_geo_country].filter(Boolean).join(", ") || "N/A"}`, { s: 8, i: 8 });
        dt('Aceite: "Aceito assinar eletronicamente nos termos da MP 2.200-2/2001"', { s: 7.5, i: 8, c: [0.1,0.5,0.1] });
      }
      y -= 4; dl();
    }
    if (y > 80) {
      ds("TRILHA DE AUDITORIA");
      for (const ev of (auditEvents ?? [])) {
        if (y < 30) break;
        dt(`[${fmtDate(ev.created_at)}] ${ev.event_type.toUpperCase()}${ev.ip ? ` - ${ev.ip}` : ""}`, { s: 7, mono: true, c: [0.3,0.3,0.3] });
      }
    }
    mp.drawText(`${APP_URL}/#/verificar/${envelope_id}`, { x: M, y: 20, size: 7, font: fontMono, color: rgb(0.5,0.5,0.5) });
    const finalBytes = await finalPdf.save();
    const finalHash = await hashBuffer(finalBytes.buffer);
    const finalPath = `envelopes/${envelope_id}/final.pdf`;
    const { error: upErr } = await supabaseAdmin.storage.from("envelopes").upload(finalPath, finalBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) return createErrorResponse("Erro ao salvar PDF final", 500);
    const completedAt = new Date().toISOString();
    await supabaseAdmin.from("envelopes").update({ status: "completed", final_file_path: finalPath, final_file_hash: finalHash, completed_at: completedAt }).eq("id", envelope_id);
    await supabaseAdmin.from("audit_events").insert({ envelope_id, event_type: "completed", metadata: { final_hash: finalHash, completed_at_utc: completedAt } });
    try {
      const { data: urlData } = await supabaseAdmin.storage.from("envelopes").createSignedUrl(finalPath, 7*86400);
      if (urlData?.signedUrl) {
        for (const s of (signers ?? [])) {
          await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM_EMAIL, to: [s.email], subject: `Documento assinado: ${envelope.title}`, html: `<div style="font-family:Arial,sans-serif;padding:20px"><h2 style="color:#0D2B5E">Documento assinado por todos</h2><p>Ola ${s.name}, o documento <strong>${envelope.title}</strong> foi assinado.</p><a href="${urlData.signedUrl}" style="background:#0D2B5E;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Baixar PDF Final</a><p style="font-size:11px;color:#888;margin-top:16px">MP 2.200-2/2001 e Lei 14.063/2020 - Verificar: ${APP_URL}/#/verificar/${envelope_id}</p></div>` }) });
        }
      }
    } catch (e) { console.error("email error:", e); }
    return createSuccessResponse({ completed: true, final_file_hash: finalHash, completed_at: completedAt });
  } catch (err) { console.error(err); return createErrorResponse("Erro interno", 500); }
});
