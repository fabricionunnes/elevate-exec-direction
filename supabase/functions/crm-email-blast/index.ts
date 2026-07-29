// Disparador de e-mails do CRM Comercial (Resend).
// Ações:
//  - preview  {filters}                → total, com e-mail, supressos, amostra
//  - create   {name, subject, body_text, from_email, filters} → cria campanha + destinatários
//  - process  {campaign_id}            → envia um LOTE de pendentes (o front chama em loop)
//  - optout   GET ?e=<b64 email>       → descadastro público (grava em suppressed_emails)
// Personalização no corpo/assunto: {nome} (primeiro nome do lead).
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const BATCH = 60;           // e-mails por chamada (o front repete até acabar)
const DELAY_MS = 550;       // ~2/s — respeita rate limit do Resend

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const firstName = (n?: string | null) => String(n || "").trim().split(/\s+/)[0] || "";
const render = (tpl: string, name?: string | null) => tpl.replace(/\{nome\}/gi, firstName(name));

function toHtml(text: string, optoutUrl: string): string {
  const body = text
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f5f7;padding:24px 12px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:28px 30px;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a2332">
${body}
</div>
<p style="max-width:600px;margin:14px auto 0;text-align:center;font-size:11px;color:#94a3b8;font-family:Arial,sans-serif">
UNV — Universidade Nacional de Vendas · <a href="${optoutUrl}" style="color:#94a3b8">não quero receber e-mails</a>
</p></body></html>`;
}

// ── monta a lista de leads pelo filtro (funil/etapa/origem) ──
async function buildRecipients(supabase: any, filters: any) {
  let q = supabase.from("crm_leads")
    .select("id, name, email")
    .not("email", "is", null)
    .limit(20000);
  if (filters?.pipeline_id) q = q.eq("pipeline_id", filters.pipeline_id);
  if (filters?.stage_id) q = q.eq("stage_id", filters.stage_id);
  if (filters?.origin_id) q = q.eq("origin_id", filters.origin_id);
  const { data: leads, error } = await q;
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  const valid: { lead_id: string; email: string; name: string | null }[] = [];
  let invalid = 0;
  (leads || []).forEach((l: any) => {
    const e = String(l.email || "").toLowerCase().trim();
    if (!EMAIL_RX.test(e)) { invalid++; return; }
    if (seen.has(e)) return;
    seen.add(e);
    valid.push({ lead_id: l.id, email: e, name: l.name });
  });
  // remove supressos (descadastrados/bounces)
  const emails = valid.map(v => v.email);
  const suppressed = new Set<string>();
  for (let i = 0; i < emails.length; i += 500) {
    const { data: sup } = await supabase.from("suppressed_emails")
      .select("email").in("email", emails.slice(i, i + 500));
    (sup || []).forEach((s: any) => suppressed.add(String(s.email).toLowerCase()));
  }
  const final = valid.filter(v => !suppressed.has(v.email));
  return { final, invalid, suppressedCount: valid.length - final.length, totalLeads: (leads || []).length };
}

// inscreve leads novos que entraram no filtro das cadências com auto-inscrição
async function autoEnrollSequences(supabase: any): Promise<number> {
  const { data: autoSeqs } = await supabase.from("crm_email_sequences")
    .select("id, auto_filters").eq("auto_enroll", true).eq("is_active", true);
  let enrolled = 0;
  for (const seq of autoSeqs || []) {
    try {
      const { data: firstStep } = await supabase.from("crm_email_sequence_steps")
        .select("delay_days").eq("sequence_id", seq.id).order("step_order").limit(1).maybeSingle();
      if (!firstStep) continue;
      const { final } = await buildRecipients(supabase, seq.auto_filters || {});
      if (!final.length) continue;
      const firstAt = new Date(Date.now() + (Number(firstStep.delay_days) || 0) * 86400000).toISOString();
      for (let i = 0; i < final.length; i += 500) {
        const { count } = await supabase.from("crm_email_enrollments").upsert(
          final.slice(i, i + 500).map((f: any) => ({ sequence_id: seq.id, ...f, next_send_at: firstAt })),
          { onConflict: "sequence_id,email", ignoreDuplicates: true, count: "exact" },
        );
        enrolled += count || 0;
      }
    } catch { /* uma cadência com problema não trava as outras */ }
  }
  return enrolled;
}

async function processSequences(supabase: any): Promise<Response> {
  if (!RESEND_KEY) return j({ error: "RESEND_API_KEY não configurada" }, 500);
  const autoEnrolled = await autoEnrollSequences(supabase);
  const now = new Date().toISOString();
  const { data: due } = await supabase.from("crm_email_enrollments")
    .select("id, sequence_id, email, name, current_step")
    .eq("status", "active").lte("next_send_at", now).limit(80);
  let sent = 0, stopped = 0, done = 0, failed = 0;
  for (const en of due || []) {
    // cadência ativa?
    const { data: seq } = await supabase.from("crm_email_sequences")
      .select("id, from_email, is_active").eq("id", en.sequence_id).maybeSingle();
    if (!seq || !seq.is_active) { continue; }
    // descadastrado no meio do caminho?
    const { data: sup } = await supabase.from("suppressed_emails").select("id").eq("email", en.email).maybeSingle();
    if (sup) {
      await supabase.from("crm_email_enrollments").update({ status: "stopped", finished_at: now }).eq("id", en.id);
      stopped++; continue;
    }
    const nextOrder = (en.current_step || 0) + 1;
    const { data: step } = await supabase.from("crm_email_sequence_steps")
      .select("*").eq("sequence_id", en.sequence_id).eq("step_order", nextOrder).maybeSingle();
    if (!step) {
      await supabase.from("crm_email_enrollments").update({ status: "done", finished_at: now }).eq("id", en.id);
      done++; continue;
    }
    const b64 = btoa(en.email).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const optoutUrl = `${SUPABASE_URL}/functions/v1/crm-email-blast?e=${b64}`;
    const atts = Array.isArray(step.attachments) ? step.attachments : [];
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `UNV <${seq.from_email}>`,
          to: [en.email],
          subject: render(step.subject, en.name),
          html: toHtml(render(step.body_text, en.name), optoutUrl),
          headers: { "List-Unsubscribe": `<${optoutUrl}>` },
          ...(atts.length ? { attachments: atts.map((a: any) => ({ filename: a.name, path: a.url })) } : {}),
        }),
      });
      if (resp.ok) {
        sent++;
        const outSeq = await resp.json().catch(() => ({}));
        await supabase.from("crm_email_events").insert({ provider_id: outSeq?.id || null, email: en.email, event_type: "sent", sequence_id: en.sequence_id });
        const { data: nextStep } = await supabase.from("crm_email_sequence_steps")
          .select("delay_days").eq("sequence_id", en.sequence_id).eq("step_order", nextOrder + 1).maybeSingle();
        await supabase.from("crm_email_enrollments").update(
          nextStep
            ? { current_step: nextOrder, next_send_at: new Date(Date.now() + (Number(nextStep.delay_days) || 1) * 86400000).toISOString() }
            : { current_step: nextOrder, status: "done", finished_at: now },
        ).eq("id", en.id);
        await supabase.from("email_send_log").insert({ template_name: `crm_seq:${en.sequence_id}:${nextOrder}`, recipient_email: en.email, status: "sent" });
      } else {
        failed++;
        // tenta de novo daqui 6h (erro transitório) — sem travar a fila
        await supabase.from("crm_email_enrollments").update({ next_send_at: new Date(Date.now() + 6 * 3600000).toISOString() }).eq("id", en.id);
      }
    } catch { failed++; }
    await new Promise(res => setTimeout(res, DELAY_MS));
  }
  return j({ ok: true, auto_enrolled: autoEnrolled, processed: (due || []).length, sent, done, stopped, failed });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);

  // ── descadastro público (link do rodapé) ──
  if (req.method === "GET" && url.searchParams.get("e")) {
    try {
      const email = atob(url.searchParams.get("e")!.replace(/-/g, "+").replace(/_/g, "/")).toLowerCase().trim();
      if (EMAIL_RX.test(email)) {
        await supabase.from("suppressed_emails").upsert(
          { email, reason: "unsubscribe", metadata: { source: "crm_blast" } }, { onConflict: "email", ignoreDuplicates: true },
        );
        const { data: lastRc } = await supabase.from("crm_email_recipients")
          .select("campaign_id").eq("email", email).order("sent_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
        await supabase.from("crm_email_events").insert({ email, event_type: "unsubscribe", campaign_id: lastRc?.campaign_id || null });
      }
    } catch { /* ignora */ }
    return new Response(
      "<html><body style='font-family:Arial;text-align:center;padding-top:80px'><h2>Pronto.</h2><p>Você não vai mais receber nossos e-mails.</p></body></html>",
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  // webhook do Resend (tracking): configurado no painel com ?wh=<secret>
  if (req.method === "POST" && url.searchParams.get("wh")) {
    if (url.searchParams.get("wh") !== (Deno.env.get("CANCEL_SHUTDOWN_SECRET") || "x")) return j({ error: "nope" }, 401);
    try {
      const ev = await req.json();
      const type = String(ev?.type || "");
      if (type.startsWith("email.")) {
        const providerId = ev?.data?.email_id || null;
        const to = Array.isArray(ev?.data?.to) ? ev.data.to[0] : ev?.data?.to || null;
        const link = ev?.data?.click?.link || null;
        // amarra o evento à campanha/cadência pelo provider_id
        let campaignId: string | null = null; let sequenceId: string | null = null;
        if (providerId) {
          const { data: rc } = await supabase.from("crm_email_recipients").select("campaign_id").eq("provider_id", providerId).maybeSingle();
          campaignId = rc?.campaign_id || null;
          if (!campaignId) {
            const { data: se } = await supabase.from("crm_email_events").select("sequence_id").eq("provider_id", providerId).eq("event_type", "sent").maybeSingle();
            sequenceId = se?.sequence_id || null;
          }
        }
        await supabase.from("crm_email_events").insert({
          provider_id: providerId, email: to, event_type: type.replace("email.", ""),
          link_url: link, campaign_id: campaignId, sequence_id: sequenceId,
        });
        // bounce/reclamação = suprime pra sempre
        if ((type === "email.bounced" || type === "email.complained") && to) {
          await supabase.from("suppressed_emails").upsert(
            { email: String(to).toLowerCase(), reason: type === "email.bounced" ? "bounce" : "complaint", metadata: { source: "resend_webhook" } },
            { onConflict: "email", ignoreDuplicates: true },
          );
        }
      }
    } catch { /* nunca falha pro Resend */ }
    return j({ ok: true });
  }

  try {
    const rawBody = await req.json().catch(() => ({}));
    // cron: processa cadências com secret, sem JWT
    if (rawBody.action === "sequence_process" && rawBody.secret && rawBody.secret === (Deno.env.get("CANCEL_SHUTDOWN_SECRET") || "x")) {
      return await processSequences(supabase);
    }
    // autenticação: staff ativo
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return j({ error: "não autenticado" }, 401);
    const { data: staff } = await supabase
      .from("onboarding_staff").select("id, role")
      .eq("user_id", user.id).eq("is_active", true).maybeSingle();
    if (!staff) return j({ error: "sem permissão" }, 403);

    const body = rawBody;
    const action = String(body.action || "");

    if (action === "preview") {
      const { final, invalid, suppressedCount, totalLeads } = await buildRecipients(supabase, body.filters || {});
      return j({
        ok: true, total_leads: totalLeads, enviaveis: final.length,
        invalidos: invalid, supressos: suppressedCount,
        amostra: final.slice(0, 5).map(f => ({ nome: f.name, email: f.email })),
      });
    }

    if (action === "create") {
      const { name, subject, body_text, from_email, filters } = body;
      if (!subject || !body_text) return j({ error: "assunto e corpo obrigatórios" });
      const from = /@(universidadevendas\.com\.br|unvholdings\.com\.br)$/i.test(String(from_email || ""))
        ? String(from_email) : "fabricio@unvholdings.com.br";
      const { final } = await buildRecipients(supabase, filters || {});
      if (!final.length) return j({ error: "nenhum destinatário enviável com esse filtro — ajuste funil/etapa/origem" });
      const { data: camp, error } = await supabase.from("crm_email_campaigns").insert({
        name: name || subject, subject, body_text, from_email: from,
        filters: filters || {}, status: "sending", total: final.length, created_by: staff.id,
      }).select("id").single();
      if (error || !camp) return j({ error: error?.message || "falha ao criar campanha" }, 500);
      for (let i = 0; i < final.length; i += 500) {
        await supabase.from("crm_email_recipients").insert(
          final.slice(i, i + 500).map(f => ({ campaign_id: camp.id, ...f })),
        );
      }
      return j({ ok: true, campaign_id: camp.id, total: final.length });
    }

    if (action === "enroll") {
      // inscreve leads do filtro numa cadência; auto_enroll arma a inscrição
      // automática de leads novos que entrarem no filtro (roda no cron)
      const sequenceId = String(body.sequence_id || "");
      const { data: seq } = await supabase.from("crm_email_sequences").select("id").eq("id", sequenceId).maybeSingle();
      if (!seq) return j({ error: "cadência não encontrada" });
      const { data: firstStep } = await supabase.from("crm_email_sequence_steps")
        .select("delay_days").eq("sequence_id", sequenceId).order("step_order").limit(1).maybeSingle();
      if (!firstStep) return j({ error: "a cadência não tem passos" });
      const autoOn = body.auto_enroll === true;
      await supabase.from("crm_email_sequences")
        .update({ auto_enroll: autoOn, auto_filters: autoOn ? (body.filters || {}) : {} })
        .eq("id", sequenceId);
      const { final } = await buildRecipients(supabase, body.filters || {});
      if (!final.length) {
        if (autoOn) return j({ ok: true, enrolled: 0, total_filtro: 0, auto_armed: true });
        return j({ error: "nenhum destinatário enviável com esse filtro — ajuste funil/etapa/origem" });
      }
      const firstAt = new Date(Date.now() + (Number(firstStep.delay_days) || 0) * 86400000).toISOString();
      let enrolled = 0;
      for (let i = 0; i < final.length; i += 500) {
        const { count } = await supabase.from("crm_email_enrollments").upsert(
          final.slice(i, i + 500).map(f => ({ sequence_id: sequenceId, ...f, next_send_at: firstAt })),
          { onConflict: "sequence_id,email", ignoreDuplicates: true, count: "exact" },
        );
        enrolled += count || 0;
      }
      return j({ ok: true, enrolled, total_filtro: final.length, auto_armed: autoOn });
    }

    if (action === "sequence_process") {
      return await processSequences(supabase);
    }

    if (action === "test") {
      // envia UM e-mail de teste pro endereço informado (valida domínio/template)
      if (!RESEND_KEY) return j({ error: "RESEND_API_KEY não configurada" }, 500);
      const to = String(body.to || "").toLowerCase().trim();
      if (!EMAIL_RX.test(to)) return j({ error: "destinatário inválido" });
      const from = /@(universidadevendas\.com\.br|unvholdings\.com\.br)$/i.test(String(body.from_email || ""))
        ? String(body.from_email) : "fabricio@unvholdings.com.br";
      const b64 = btoa(to).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const optoutUrl = `${SUPABASE_URL}/functions/v1/crm-email-blast?e=${b64}`;
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `UNV <${from}>`,
          to: [to],
          subject: `[TESTE] ${render(String(body.subject || "Teste do disparador"), "Teste")}`,
          html: toHtml(render(String(body.body_text || "E-mail de teste do disparador UNV."), "Teste"), optoutUrl),
        }),
      });
      const out = await resp.json().catch(() => ({}));
      if (!resp.ok) return j({ error: out?.message || `Resend recusou (HTTP ${resp.status})` }, 200);
      return j({ ok: true, id: out?.id, from });
    }

    if (action === "process") {
      if (!RESEND_KEY) return j({ error: "RESEND_API_KEY não configurada" }, 500);
      const campaignId = String(body.campaign_id || "");
      const { data: camp } = await supabase.from("crm_email_campaigns")
        .select("*").eq("id", campaignId).maybeSingle();
      if (!camp) return j({ error: "campanha não encontrada" });
      const { data: pend } = await supabase.from("crm_email_recipients")
        .select("id, lead_id, email, name")
        .eq("campaign_id", campaignId).eq("status", "pending").limit(BATCH);
      let sent = 0, failed = 0;
      for (const r of pend || []) {
        const b64 = btoa(r.email).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const optoutUrl = `${SUPABASE_URL}/functions/v1/crm-email-blast?e=${b64}`;
        try {
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `UNV <${camp.from_email}>`,
              to: [r.email],
              subject: render(camp.subject, r.name),
              html: toHtml(render(camp.body_text, r.name), optoutUrl),
              headers: { "List-Unsubscribe": `<${optoutUrl}>` },
            }),
          });
          if (resp.ok) {
            sent++;
            const out = await resp.json().catch(() => ({}));
            await supabase.from("crm_email_recipients").update({ status: "sent", sent_at: new Date().toISOString(), provider_id: out?.id || null }).eq("id", r.id);
            await supabase.from("email_send_log").insert({ template_name: `crm_blast:${campaignId}`, recipient_email: r.email, status: "sent" });
          } else {
            const err = await resp.text();
            failed++;
            await supabase.from("crm_email_recipients").update({ status: "failed", error: err.slice(0, 300) }).eq("id", r.id);
          }
        } catch (e) {
          failed++;
          await supabase.from("crm_email_recipients").update({ status: "failed", error: String(e).slice(0, 300) }).eq("id", r.id);
        }
        await new Promise(res => setTimeout(res, DELAY_MS));
      }
      const { count: remaining } = await supabase.from("crm_email_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId).eq("status", "pending");
      const done = (remaining || 0) === 0;
      await supabase.from("crm_email_campaigns").update({
        sent: (camp.sent || 0) + sent,
        failed: (camp.failed || 0) + failed,
        status: done ? "done" : "sending",
        finished_at: done ? new Date().toISOString() : null,
      }).eq("id", campaignId);
      return j({ ok: true, batch_sent: sent, batch_failed: failed, remaining: remaining || 0, done });
    }

    return j({ error: "ação inválida" }, 400);
  } catch (e) {
    return j({ error: String((e as Error).message || e) }, 500);
  }
});
