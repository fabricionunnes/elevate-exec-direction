import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, createErrorResponse, createSuccessResponse, generateToken, hashString } from "../_shared/utils.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://unvholdings.com.br";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "assinatura@unvholdings.com.br";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return createErrorResponse("Não autorizado", 401);
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return createErrorResponse("Não autorizado", 401);
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { envelope_id } = await req.json() as { envelope_id?: string };
    if (!envelope_id) return createErrorResponse("envelope_id obrigatório", 400);
    const { data: envelope } = await supabaseAdmin.from("envelopes").select("id,title,message,status,owner_user_id,original_file_hash,expires_at").eq("id", envelope_id).maybeSingle();
    if (!envelope) return createErrorResponse("Envelope não encontrado", 404);
    if (envelope.owner_user_id !== user.id) return createErrorResponse("Acesso negado", 403);
    if (!["draft","sent"].includes(envelope.status)) return createErrorResponse(`Status inválido: ${envelope.status}`, 400);
    const { data: signers } = await supabaseAdmin.from("signers").select("id,name,email,order_index,status").eq("envelope_id", envelope_id).eq("status","pending").order("order_index");
    if (!signers?.length) return createErrorResponse("Nenhum signatário pendente", 400);
    const isSeq = signers.some((s: { order_index: number }) => s.order_index > 0);
    const minOrder = Math.min(...signers.map((s: { order_index: number }) => s.order_index));
    const toNotify = isSeq ? signers.filter((s: { order_index: number }) => s.order_index === minOrder) : signers;
    const results: Array<{ signer_id: string; email: string; sent: boolean; error?: string }> = [];
    for (const signer of toNotify) {
      const rawToken = generateToken();
      const tokenHash = await hashString(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
      await supabaseAdmin.from("signing_tokens").delete().eq("signer_id", signer.id).is("used_at", null);
      const { error: tokErr } = await supabaseAdmin.from("signing_tokens").insert({ signer_id: signer.id, token_hash: tokenHash, expires_at: expiresAt });
      if (tokErr) { results.push({ signer_id: signer.id, email: signer.email, sent: false, error: "Erro ao gerar token" }); continue; }
      const signingUrl = `${APP_URL}/#/assinar/${rawToken}`;
      const expDate = new Date(expiresAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const html = `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden"><div style="background:#0D2B5E;padding:28px 32px"><h1 style="color:#fff;font-size:20px;margin:0">UNV Nexus — Assinatura Eletrônica</h1></div><div style="padding:32px"><p>Olá, <strong>${signer.name}</strong></p><p>Você foi solicitado a assinar: <strong>${envelope.title}</strong></p>${envelope.message ? `<p style="background:#f8f9fb;padding:12px;border-left:3px solid #0D2B5E">${envelope.message}</p>` : ""}<a href="${signingUrl}" style="display:inline-block;background:#CC1B1B;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0">Assinar Documento</a><p style="font-size:12px;color:#888">Link expira: ${expDate}</p>${envelope.original_file_hash ? `<p style="font-size:11px;color:#aaa;font-family:monospace">SHA-256: ${envelope.original_file_hash}</p>` : ""}<hr style="border:none;border-top:1px solid #eee;margin:20px 0"><p style="font-size:11px;color:#aaa">Validade jurídica: MP 2.200-2/2001 e Lei 14.063/2020</p></div></div></body></html>`;
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM_EMAIL, to: [signer.email], subject: `Documento para assinar: ${envelope.title}`, html }) });
      if (!r.ok) { results.push({ signer_id: signer.id, email: signer.email, sent: false, error: "Falha no envio" }); continue; }
      const rd = await r.json() as { id?: string };
      await supabaseAdmin.from("audit_events").insert({ envelope_id, signer_id: signer.id, event_type: "sent", ip: clientIp, metadata: { email: signer.email, resend_id: rd.id, success: true } });
      results.push({ signer_id: signer.id, email: signer.email, sent: true });
    }
    if (results.some(r => r.sent)) await supabaseAdmin.from("envelopes").update({ status: "sent" }).eq("id", envelope_id);
    return createSuccessResponse({ envelope_id, emails_sent: results.filter(r => r.sent).length, results, sequential: isSeq });
  } catch (err) { console.error(err); return createErrorResponse("Erro interno", 500); }
});
