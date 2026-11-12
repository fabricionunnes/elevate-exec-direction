import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, createErrorResponse, createSuccessResponse, hashString, getGeoFromIp, generateToken } from "../_shared/utils.ts";

// 12/11/2026 (Fabrício): "quando o cliente assina contrato quero receber uma notificação já com o link
// pra eu fazer minha assinatura". Quem assina pela UNV é reconhecido pelo e-mail: o do master do Nexus
// (ou a lista em UNV_SIGNER_EMAILS, separada por vírgula, se um dia outra pessoa assinar pela casa).
const APP_URL = Deno.env.get("APP_URL") ?? "https://unvholdings.com.br";
const TIPO_AVISO = "contrato_assinado_cliente";
const limpo = (email: unknown) => String(email ?? "").toLowerCase().trim();

type Signatario = { id: string; name: string | null; email: string | null; status: string };

// deno-lint-ignore no-explicit-any
async function emailsDaCasa(admin: any): Promise<string[]> {
  const fixos = (Deno.env.get("UNV_SIGNER_EMAILS") ?? "").split(",").map(limpo).filter(Boolean);
  if (fixos.length) return fixos;
  const { data } = await admin.from("onboarding_staff").select("email").eq("role", "master").eq("is_active", true).is("tenant_id", null);
  return ((data ?? []) as Array<{ email: string | null }>).map((r) => limpo(r.email)).filter(Boolean);
}

// Avisa o Fabrício pela Central de Avisos. Se a assinatura dele ainda falta, gera um link novo
// (o anterior, se não foi usado, deixa de valer) e manda junto. Nunca derruba a assinatura do cliente.
// deno-lint-ignore no-explicit-any
async function avisarAssinaturaDoCliente(admin: any, envelope: { id: string; title: string }, quemAssinou: Signatario, todos: Signatario[]) {
  const casa = await emailsDaCasa(admin);
  const daCasa = (email: unknown) => casa.includes(limpo(email));
  if (!casa.length || daCasa(quemAssinou.email)) return;
  const pendentes = todos.filter((s) => s.id !== quemAssinou.id && s.status !== "signed" && s.status !== "declined");
  const meu = pendentes.find((s) => daCasa(s.email));
  const outros = pendentes.filter((s) => !daCasa(s.email)).map((s) => s.name || s.email).filter(Boolean);
  const linhas = ["*Cliente assinou o contrato*", "", `${quemAssinou.name || quemAssinou.email} assinou agora:`, envelope.title];
  if (meu) {
    await admin.from("signing_tokens").delete().eq("signer_id", meu.id).is("used_at", null);
    const novo = generateToken();
    const { error } = await admin.from("signing_tokens").insert({ signer_id: meu.id, token_hash: await hashString(novo), expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() });
    if (error) {
      console.error("aviso de assinatura: token não gerado", error.message);
      linhas.push("", "Falta a sua assinatura. Não consegui gerar o link agora, abre o contrato no Nexus pra assinar.");
    } else {
      linhas.push("", "Falta a sua assinatura. É só abrir e assinar:", `${APP_URL}/#/assinar/${novo}`, "", "O link é só seu e vale 7 dias.");
    }
  } else if (!outros.length) {
    linhas.push("", "Todas as assinaturas feitas. O contrato está concluído.");
  }
  if (outros.length) linhas.push("", `Ainda falta assinar: ${outros.join(", ")}.`);
  const { error } = await admin.rpc("aviso_enviar", { p_tipo: TIPO_AVISO, p_texto: linhas.join("\n"), p_titulo: "Cliente assinou o contrato", p_origem: "nexus", p_nivel_padrao: "hora" });
  if (error) console.error("aviso de assinatura falhou", error.message);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? null;
  try {
    const { token: rawToken, signature_image, accepted_terms, device_info } = await req.json() as { token?: string; signature_image?: string; accepted_terms?: boolean; device_info?: Record<string, unknown> };
    if (!rawToken || !/^[a-f0-9]{64}$/.test(rawToken)) return createErrorResponse("Token inválido", 400);
    if (accepted_terms !== true) return createErrorResponse("Aceite explícito obrigatório (MP 2.200-2/2001)", 400);
    if (!signature_image) return createErrorResponse("Assinatura obrigatória", 400);
    const b64 = signature_image.replace(/^data:image\/\w+;base64,/, "");
    const binStr = atob(b64);
    const imgBytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) imgBytes[i] = binStr.charCodeAt(i);
    if (imgBytes.length > 2_097_152) return createErrorResponse("Imagem excede 2 MB", 400);
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tokenHash = await hashString(rawToken);
    const { data: tr } = await supabaseAdmin.from("signing_tokens").select("id,signer_id,expires_at,used_at").eq("token_hash", tokenHash).maybeSingle();
    if (!tr) return createErrorResponse("Token inválido", 404);
    if (tr.used_at !== null) return createErrorResponse("Token já utilizado", 409);
    if (new Date(tr.expires_at) < new Date()) return createErrorResponse("Token expirado", 410);
    const { data: signer } = await supabaseAdmin.from("signers").select("id,envelope_id,name,email,status,order_index").eq("id", tr.signer_id).maybeSingle();
    if (!signer || signer.status === "signed") return createErrorResponse("Signatário inválido", 404);
    const { data: envelope } = await supabaseAdmin.from("envelopes").select("id,title,status").eq("id", signer.envelope_id).maybeSingle();
    if (!envelope || !["sent","partially_signed"].includes(envelope.status)) return createErrorResponse("Documento não disponível", 400);
    const geo = await getGeoFromIp(clientIp);
    const sigPath = `envelopes/${envelope.id}/signatures/${signer.id}.png`;
    const { error: upErr } = await supabaseAdmin.storage.from("envelopes").upload(sigPath, imgBytes, { contentType: "image/png", upsert: true });
    if (upErr) return createErrorResponse("Erro ao salvar assinatura", 500);
    const signedAt = new Date().toISOString();
    await supabaseAdmin.from("signers").update({ status: "signed", signed_at: signedAt, sign_ip: clientIp, sign_user_agent: userAgent, sign_geo_country: geo.country, sign_geo_region: geo.region, sign_geo_city: geo.city, sign_latitude: geo.latitude, sign_longitude: geo.longitude, signature_image_path: sigPath }).eq("id", signer.id);
    await supabaseAdmin.from("signing_tokens").update({ used_at: signedAt }).eq("id", tr.id);
    const sigHash = await hashString(signature_image);
    await supabaseAdmin.from("audit_events").insert({ envelope_id: envelope.id, signer_id: signer.id, event_type: "signed", ip: clientIp, user_agent: userAgent, geo_country: geo.country, geo_region: geo.region, geo_city: geo.city, metadata: { email: signer.email, accepted_terms: true, accepted_terms_text: "Aceito assinar este documento eletronicamente nos termos da MP 2.200-2/2001", signed_at_utc: signedAt, signature_hash: sigHash, device_info: device_info ?? {} } });
    const { data: allSigners } = await supabaseAdmin.from("signers").select("id,name,email,status").eq("envelope_id", envelope.id);
    try { await avisarAssinaturaDoCliente(supabaseAdmin, envelope, { ...signer, status: "signed" }, (allSigners ?? []) as Signatario[]); }
    catch (e) { console.error("aviso de assinatura erro", e); }
    const allSigned = (allSigners ?? []).every((s: { status: string }) => s.status === "signed");
    if (allSigned) {
      // Espera a finalização: sem await o runtime encerrava antes da chamada sair e o envelope
      // ficava "parcialmente assinado" sem PDF final (Instituto Educação Sant'Ana, 16/09/2026).
      try {
        const fin = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/finalize-envelope`, { method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ envelope_id: envelope.id }) });
        if (!fin.ok) console.error("finalize-envelope falhou", fin.status, await fin.text());
      } catch (e) { console.error("finalize-envelope erro", e); }
    } else {
      await supabaseAdmin.from("envelopes").update({ status: "partially_signed" }).eq("id", envelope.id);
    }
    return createSuccessResponse({ signed: true, signed_at: signedAt, all_signed: allSigned, envelope_id: envelope.id });
  } catch (err) { console.error(err); return createErrorResponse("Erro interno", 500); }
});
