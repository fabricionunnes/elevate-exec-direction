// profile-send-whatsapp: envia uma mensagem de texto pelo WhatsApp usando uma das
// instâncias conectadas do sistema (whatsapp_instances), escolhida pelo recrutador.
// Usado pra mandar o link do teste DISC (ou qualquer texto) pro candidato.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatPhoneNumber(phone: string): string {
  let n = String(phone || "").replace(/\D/g, "");
  if (n.length === 11 && n.startsWith("0")) n = "55" + n.substring(1);
  else if (n.length === 10 || n.length === 11) n = "55" + n;
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const instanceId: string = body.instanceId || "";
    const phone: string = body.phone || "";
    const message: string = body.message || "";
    if (!instanceId) throw new Error("instanceId obrigatório");
    if (!phone) throw new Error("Candidato sem telefone");
    if (!message.trim()) throw new Error("Mensagem vazia");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: inst, error: iErr } = await supabase
      .from("whatsapp_instances")
      .select("instance_name, api_url, api_key, status, provider_type")
      .eq("id", instanceId)
      .maybeSingle();
    if (iErr) throw iErr;
    if (!inst) throw new Error("Instância não encontrada");
    if (!inst.api_url || !inst.api_key) throw new Error("Instância sem credenciais configuradas");
    if (inst.status && inst.status !== "connected") throw new Error("Instância não está conectada");

    const number = formatPhoneNumber(phone);

    // Stevo / Manager V2 usa POST /send/text {number,text}; Evolution clássico usa /message/sendText/{instance}.
    let host = "";
    try { host = new URL(inst.api_url).hostname.toLowerCase(); } catch { /* noop */ }
    const isManagerV2 = inst.provider_type === "manager_v2" || host.endsWith(".stevo.chat");

    let url: string;
    let payload: Record<string, unknown>;
    if (isManagerV2) {
      const base = inst.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
      url = `${base}/send/text`;
      payload = { number, text: message };
    } else {
      url = `${inst.api_url.replace(/\/+$/g, "")}/message/sendText/${inst.instance_name}`;
      payload = { number, text: message };
    }

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: inst.api_key },
      body: JSON.stringify(payload),
    });
    const respData = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const m = respData?.response?.message;
      const errMsg = Array.isArray(m) ? m[0] : (m || respData?.message || respData?.error || `HTTP ${resp.status}`);
      throw new Error(String(errMsg));
    }

    return new Response(JSON.stringify({ ok: true, number }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
