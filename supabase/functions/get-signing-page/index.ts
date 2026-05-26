import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, createErrorResponse, createSuccessResponse, hashString, getGeoFromIp } from "../_shared/utils.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? null;
  try {
    const rawToken = new URL(req.url).searchParams.get("token");
    if (!rawToken || !/^[a-f0-9]{64}$/.test(rawToken)) return createErrorResponse("Token inválido", 400);
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tokenHash = await hashString(rawToken);
    const { data: tr } = await supabaseAdmin.from("signing_tokens").select("id,signer_id,expires_at,used_at").eq("token_hash", tokenHash).maybeSingle();
    if (!tr) return createErrorResponse("Link inválido", 404);
    if (new Date(tr.expires_at) < new Date()) return createErrorResponse("Link expirado", 410);
    if (tr.used_at !== null) return createErrorResponse("Link já utilizado", 409);
    const { data: signer } = await supabaseAdmin.from("signers").select("id,envelope_id,name,email,status,order_index").eq("id", tr.signer_id).maybeSingle();
    if (!signer) return createErrorResponse("Signatário não encontrado", 404);
    if (signer.status === "signed") return createErrorResponse("Você já assinou", 409);
    if (signer.status === "declined") return createErrorResponse("Você recusou assinar", 409);
    const { data: envelope } = await supabaseAdmin.from("envelopes").select("id,title,message,status,original_file_path,original_file_hash,expires_at").eq("id", signer.envelope_id).maybeSingle();
    if (!envelope) return createErrorResponse("Documento não encontrado", 404);
    if (!["sent","partially_signed"].includes(envelope.status)) return createErrorResponse("Documento não disponível", 400);
    if (envelope.expires_at && new Date(envelope.expires_at) < new Date()) { await supabaseAdmin.from("envelopes").update({ status: "expired" }).eq("id", envelope.id); return createErrorResponse("Documento expirado", 410); }
    const { data: urlData } = await supabaseAdmin.storage.from("envelopes").createSignedUrl(envelope.original_file_path, 1800);
    if (!urlData?.signedUrl) return createErrorResponse("Erro ao gerar URL do PDF", 500);
    const geo = await getGeoFromIp(clientIp);
    if (signer.status === "pending") {
      await supabaseAdmin.from("signers").update({ status: "viewed" }).eq("id", signer.id);
      await supabaseAdmin.from("audit_events").insert({ envelope_id: envelope.id, signer_id: signer.id, event_type: "viewed", ip: clientIp, user_agent: userAgent, geo_country: geo.country, geo_region: geo.region, geo_city: geo.city, metadata: { email: signer.email, first_view: true } });
    }
    const { data: allSigners } = await supabaseAdmin.from("signers").select("name,email,status,order_index").eq("envelope_id", envelope.id).order("order_index");
    return createSuccessResponse({ envelope: { id: envelope.id, title: envelope.title, message: envelope.message, original_file_hash: envelope.original_file_hash, expires_at: envelope.expires_at }, signer: { id: signer.id, name: signer.name, email: signer.email, status: signer.status === "pending" ? "viewed" : signer.status }, pdf_url: urlData.signedUrl, all_signers: allSigners ?? [], _signing_session: rawToken });
  } catch (err) { console.error(err); return createErrorResponse("Erro interno", 500); }
});
