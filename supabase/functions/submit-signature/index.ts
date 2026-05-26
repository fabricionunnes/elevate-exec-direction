import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, createErrorResponse, createSuccessResponse, hashString, getGeoFromIp } from "../_shared/utils.ts";

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
    const { data: allSigners } = await supabaseAdmin.from("signers").select("id,status").eq("envelope_id", envelope.id);
    const allSigned = (allSigners ?? []).every((s: { status: string }) => s.status === "signed");
    if (allSigned) {
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/finalize-envelope`, { method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ envelope_id: envelope.id }) }).catch(e => console.error(e));
    } else {
      await supabaseAdmin.from("envelopes").update({ status: "partially_signed" }).eq("id", envelope.id);
    }
    return createSuccessResponse({ signed: true, signed_at: signedAt, all_signed: allSigned, envelope_id: envelope.id });
  } catch (err) { console.error(err); return createErrorResponse("Erro interno", 500); }
});
