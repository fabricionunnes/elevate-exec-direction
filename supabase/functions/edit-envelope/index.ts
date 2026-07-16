import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import { corsHeaders, createErrorResponse, createSuccessResponse, hashBuffer } from "../_shared/utils.ts";

const BUCKET = "envelopes";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return createErrorResponse("Não autorizado", 401);
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return createErrorResponse("Não autorizado", 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: staff } = await admin.from("onboarding_staff").select("role").eq("user_id", user.id).eq("is_active", true).maybeSingle();
    // closer/head_comercial também editam — mas só envelopes PRÓPRIOS (guarda de dono logo abaixo)
    if (!staff || !["master", "admin", "head_comercial", "closer"].includes(staff.role)) return createErrorResponse("Acesso negado", 403);

    const form = await req.formData();
    const envelopeId = String(form.get("envelope_id") ?? "");
    if (!envelopeId) return createErrorResponse("envelope_id é obrigatório", 400);

    const { data: env } = await admin.from("envelopes").select("*").eq("id", envelopeId).maybeSingle();
    if (!env) return createErrorResponse("Envelope não encontrado", 404);
    if (env.owner_user_id !== user.id && staff.role !== "master") return createErrorResponse("Acesso negado", 403);
    if (["completed", "cancelled"].includes(env.status)) return createErrorResponse("Envelope finalizado não pode ser editado", 409);

    const { data: curSigners } = await admin.from("signers").select("id, status, email").eq("envelope_id", envelopeId);
    if ((curSigners ?? []).some((s: any) => s.status === "signed")) {
      return createErrorResponse("Já há assinaturas — não é possível editar o documento", 409);
    }

    // ── metadados
    const title = form.get("title");
    const message = form.get("message");
    const expiresInDays = form.get("expires_in_days");
    const envUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof title === "string" && title.trim()) envUpdate.title = title.trim();
    if (typeof message === "string") envUpdate.message = message.trim().slice(0, 1000) || null;
    if (typeof expiresInDays === "string" && expiresInDays.trim()) {
      const d = Math.min(Math.max(parseInt(expiresInDays, 10) || 30, 1), 365);
      envUpdate.expires_at = new Date(Date.now() + d * 86_400_000).toISOString();
    }

    // ── signatários (upsert por id; ausentes = removidos)
    const signersRaw = form.get("signers");
    if (typeof signersRaw === "string" && signersRaw.trim()) {
      let list: Array<{ id?: string; name: string; email: string; cpf?: string; order_index?: number }>;
      try { list = JSON.parse(signersRaw); } catch { return createErrorResponse("JSON de signatários inválido", 400); }
      if (!Array.isArray(list) || list.length === 0) return createErrorResponse("Pelo menos um signatário é obrigatório", 400);
      if (list.length > 20) return createErrorResponse("Máximo de 20 signatários", 400);
      const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      for (const s of list) {
        if (!s.name?.trim() || !emailRe.test(String(s.email ?? "").trim())) return createErrorResponse("Signatário com nome/e-mail inválido", 400);
      }
      const keepIds = list.filter((s) => s.id).map((s) => s.id as string);
      const toRemove = (curSigners ?? []).filter((s: any) => !keepIds.includes(s.id)).map((s: any) => s.id);
      if (toRemove.length) {
        await admin.from("signing_tokens").delete().in("signer_id", toRemove);
        await admin.from("signers").delete().in("id", toRemove);
      }
      for (const [i, s] of list.entries()) {
        const row = { name: s.name.trim(), email: s.email.toLowerCase().trim(), cpf: s.cpf ? s.cpf.replace(/\D/g, "") : null, order_index: s.order_index ?? i };
        if (s.id) await admin.from("signers").update(row).eq("id", s.id);
        else await admin.from("signers").insert({ ...row, envelope_id: envelopeId, status: "pending" });
      }
    }

    // ── anexos: base.pdf + attachments → regenera original.pdf
    const removedRaw = form.get("removed_attachment_ids");
    const newFiles = form.getAll("attachments").filter((f): f is File => f instanceof File);
    const removedIds: string[] = (() => { try { return removedRaw ? JSON.parse(String(removedRaw)) : []; } catch { return []; } })();

    let attachmentsChanged = newFiles.length > 0 || removedIds.length > 0;
    let newHash = env.original_file_hash as string;

    if (attachmentsChanged) {
      const basePath = `envelopes/${envelopeId}/base.pdf`;
      // Garante o base.pdf (na 1ª edição, o original.pdf atual É a base)
      const { data: baseExists } = await admin.storage.from(BUCKET).download(basePath).then((r) => ({ data: r.data })).catch(() => ({ data: null }));
      if (!baseExists) {
        const { data: orig } = await admin.storage.from(BUCKET).download(env.original_file_path);
        if (!orig) return createErrorResponse("Documento base não encontrado", 500);
        await admin.storage.from(BUCKET).upload(basePath, orig, { contentType: "application/pdf", upsert: true });
      }

      // remove anexos marcados
      if (removedIds.length) {
        const { data: toDel } = await admin.from("envelope_attachments").select("id, file_path").in("id", removedIds).eq("envelope_id", envelopeId);
        for (const a of (toDel ?? [])) await admin.storage.from(BUCKET).remove([a.file_path]).catch(() => {});
        await admin.from("envelope_attachments").delete().in("id", removedIds).eq("envelope_id", envelopeId);
      }

      // sobe novos anexos (só PDF)
      let ord = ((await admin.from("envelope_attachments").select("sort_order").eq("envelope_id", envelopeId).order("sort_order", { ascending: false }).limit(1)).data?.[0]?.sort_order ?? -1) + 1;
      for (const f of newFiles) {
        if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return createErrorResponse(`Anexo "${f.name}" não é PDF`, 400);
        if (f.size > 20 * 1024 * 1024) return createErrorResponse(`Anexo "${f.name}" excede 20 MB`, 400);
        const path = `envelopes/${envelopeId}/attachments/${crypto.randomUUID()}.pdf`;
        const buf = new Uint8Array(await f.arrayBuffer());
        const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: "application/pdf", upsert: false });
        if (upErr) return createErrorResponse("Erro ao salvar anexo", 500);
        await admin.from("envelope_attachments").insert({ envelope_id: envelopeId, filename: f.name, file_path: path, size_bytes: f.size, sort_order: ord++ });
      }

      // regenera original.pdf = base + anexos (ordem)
      const merged = await PDFDocument.create();
      const { data: baseBlob } = await admin.storage.from(BUCKET).download(basePath);
      const baseDoc = await PDFDocument.load(await baseBlob!.arrayBuffer(), { ignoreEncryption: true });
      (await merged.copyPages(baseDoc, baseDoc.getPageIndices())).forEach((p) => merged.addPage(p));
      const { data: atts } = await admin.from("envelope_attachments").select("file_path").eq("envelope_id", envelopeId).order("sort_order");
      for (const a of (atts ?? [])) {
        const { data: ab } = await admin.storage.from(BUCKET).download(a.file_path);
        if (!ab) continue;
        try {
          const adoc = await PDFDocument.load(await ab.arrayBuffer(), { ignoreEncryption: true });
          (await merged.copyPages(adoc, adoc.getPageIndices())).forEach((p) => merged.addPage(p));
        } catch { /* pula anexo corrompido */ }
      }
      const mergedBytes = await merged.save();
      await admin.storage.from(BUCKET).upload(env.original_file_path, mergedBytes, { contentType: "application/pdf", upsert: true });
      newHash = await hashBuffer(mergedBytes.buffer.slice(mergedBytes.byteOffset, mergedBytes.byteOffset + mergedBytes.byteLength));
      envUpdate.original_file_hash = newHash;
    }

    await admin.from("envelopes").update(envUpdate).eq("id", envelopeId);
    await admin.from("audit_events").insert({
      envelope_id: envelopeId, event_type: "document_modified", ip: clientIp,
      user_agent: req.headers.get("user-agent"),
      metadata: { by: user.id, attachments_changed: attachmentsChanged, new_hash: attachmentsChanged ? newHash : undefined },
    });

    const { data: finalAtts } = await admin.from("envelope_attachments").select("id, filename, size_bytes, sort_order").eq("envelope_id", envelopeId).order("sort_order");
    return createSuccessResponse({ envelope_id: envelopeId, original_file_hash: newHash, attachments: finalAtts ?? [] });
  } catch (err) {
    console.error("edit-envelope error", err);
    return createErrorResponse("Erro ao editar envelope", 500);
  }
});
