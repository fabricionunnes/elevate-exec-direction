import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// helpers copiados de _shared/utils.ts (deploy pela Management API sem pasta compartilhada)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function createErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function createSuccessResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashString(input: string): Promise<string> {
  return hashBuffer(new TextEncoder().encode(input).buffer);
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getGeoFromIp(ip: string): Promise<{ country: string | null; region: string | null; city: string | null; latitude: number | null; longitude: number | null; }> {
  const fallback = { country: null, region: null, city: null, latitude: null, longitude: null };
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip.startsWith("192.168.")) return fallback;
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return fallback;
    const d = await res.json() as { country_name?: string; region?: string; city?: string; latitude?: number; longitude?: number };
    return { country: d.country_name ?? null, region: d.region ?? null, city: d.city ?? null, latitude: d.latitude ?? null, longitude: d.longitude ?? null };
  } catch { return fallback; }
}

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
    const { data: signer } = await supabaseAdmin.from("signers").select("id,envelope_id,name,email,status,order_index,signed_at").eq("id", tr.signer_id).maybeSingle();
    if (!signer) return createErrorResponse("Signatário não encontrado", 404);
    // Link reaberto depois de assinar: em vez de "token já utilizado" (assustava o cliente,
    // 30/09/2026), mostra que o documento já está assinado e entrega a via final se existir.
    if (tr.used_at !== null || signer.status === "signed") {
      if (signer.status !== "signed") return createErrorResponse("Link já utilizado", 409);
      const { data: envJa } = await supabaseAdmin.from("envelopes").select("id,title,status,final_file_path,completed_at").eq("id", signer.envelope_id).maybeSingle();
      let finalUrl: string | null = null;
      if (envJa?.final_file_path) {
        const { data: u } = await supabaseAdmin.storage.from("envelopes").createSignedUrl(envJa.final_file_path, 1800);
        finalUrl = u?.signedUrl ?? null;
      }
      const { data: todos } = await supabaseAdmin.from("signers").select("name,email,status,order_index").eq("envelope_id", signer.envelope_id).order("order_index");
      return createSuccessResponse({ already_signed: true, envelope: { id: envJa?.id ?? signer.envelope_id, title: envJa?.title ?? "", status: envJa?.status ?? null, completed_at: envJa?.completed_at ?? null },
        signer: { name: signer.name, email: signer.email, signed_at: signer.signed_at }, final_pdf_url: finalUrl, all_signers: todos ?? [] });
    }
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
