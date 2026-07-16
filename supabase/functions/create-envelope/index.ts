import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, createErrorResponse, createSuccessResponse, hashBuffer } from "../_shared/utils.ts";

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
    const { data: staffData } = await supabaseAdmin.from("onboarding_staff").select("role").eq("user_id", user.id).eq("is_active", true).maybeSingle();
    // closer/head_comercial podem enviar contrato (RLS de envelopes é por dono — cada um só vê os seus)
    if (!staffData || !["master", "admin", "head_comercial", "closer"].includes(staffData.role)) return createErrorResponse("Acesso negado", 403);
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) return createErrorResponse("Content-Type deve ser multipart/form-data", 400);
    const formData = await req.formData();
    const title = formData.get("title");
    const message = formData.get("message");
    const signersJson = formData.get("signers");
    const expiresInDays = formData.get("expires_in_days");
    const pdfFile = formData.get("pdf") as File | null;
    if (!title || typeof title !== "string" || title.trim().length === 0) return createErrorResponse("Título é obrigatório", 400);
    if (!pdfFile || pdfFile.type !== "application/pdf") return createErrorResponse("PDF válido é obrigatório", 400);
    if (pdfFile.size > 52_428_800) return createErrorResponse("PDF excede 50 MB", 400);
    if (!signersJson || typeof signersJson !== "string") return createErrorResponse("Signatários são obrigatórios", 400);
    let signersInput: Array<{ name: string; email: string; cpf?: string; order_index?: number }>;
    try { signersInput = JSON.parse(signersJson); } catch { return createErrorResponse("JSON de signatários inválido", 400); }
    if (!Array.isArray(signersInput) || signersInput.length === 0) return createErrorResponse("Pelo menos um signatário é obrigatório", 400);
    if (signersInput.length > 20) return createErrorResponse("Máximo de 20 signatários", 400);
    const emailRegex = /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i;
    const emailsSeen = new Set<string>();
    for (const [i, s] of signersInput.entries()) {
      if (!s.name?.trim()) return createErrorResponse(`Signatário ${i+1}: nome obrigatório`, 400);
      if (!emailRegex.test(s.email)) return createErrorResponse(`Signatário ${i+1}: e-mail inválido`, 400);
      if (emailsSeen.has(s.email.toLowerCase())) return createErrorResponse(`E-mail duplicado: ${s.email}`, 400);
      emailsSeen.add(s.email.toLowerCase());
    }
    const pdfBytes = await pdfFile.arrayBuffer();
    const originalHash = await hashBuffer(pdfBytes);
    const envelopeId = crypto.randomUUID();
    const originalFilePath = `envelopes/${envelopeId}/original.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage.from("envelopes").upload(originalFilePath, new Uint8Array(pdfBytes), { contentType: "application/pdf", upsert: false });
    if (uploadError) return createErrorResponse("Erro ao salvar documento", 500);
    const days = Math.min(Math.max(parseInt(String(expiresInDays ?? "30"), 10) || 30, 1), 365);
    const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
    const { error: envErr } = await supabaseAdmin.from("envelopes").insert({ id: envelopeId, owner_user_id: user.id, title: title.trim(), message: message ? String(message).trim().slice(0, 1000) : null, status: "draft", original_file_path: originalFilePath, original_file_hash: originalHash, expires_at: expiresAt });
    if (envErr) { await supabaseAdmin.storage.from("envelopes").remove([originalFilePath]); return createErrorResponse("Erro ao criar envelope", 500); }
    const { data: createdSigners, error: signersErr } = await supabaseAdmin.from("signers").insert(signersInput.map((s, i) => ({ envelope_id: envelopeId, name: s.name.trim(), email: s.email.toLowerCase().trim(), cpf: s.cpf ? s.cpf.replace(/\D/g, "") : null, order_index: s.order_index ?? i, status: "pending" }))).select("id, email, name, order_index");
    if (signersErr) { await supabaseAdmin.storage.from("envelopes").remove([originalFilePath]); await supabaseAdmin.from("envelopes").delete().eq("id", envelopeId); return createErrorResponse("Erro ao criar signatários", 500); }
    await supabaseAdmin.from("audit_events").insert({ envelope_id: envelopeId, event_type: "created", ip: clientIp, user_agent: req.headers.get("user-agent"), metadata: { owner_user_id: user.id, total_signers: signersInput.length, original_hash: originalHash } });
    return createSuccessResponse({ envelope_id: envelopeId, status: "draft", original_file_hash: originalHash, signers: createdSigners, expires_at: expiresAt });
  } catch (err) { console.error(err); return createErrorResponse("Erro interno", 500); }
});
