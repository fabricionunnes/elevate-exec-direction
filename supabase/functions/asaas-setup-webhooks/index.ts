import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_BASE = "https://api.asaas.com/v3";
const WEBHOOK_URL = "https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/asaas-webhook";
const WEBHOOK_EVENTS = [
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_UPDATED",
  "PAYMENT_CHARGEBACK_REQUESTED",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getWebhooks(apiKey: string) {
  const r = await fetch(`${ASAAS_BASE}/webhooks`, {
    headers: { access_token: apiKey, "Content-Type": "application/json" },
  });
  if (!r.ok) return null;
  return r.json();
}

async function upsertWebhook(apiKey: string, accountName: string): Promise<{ status: string; detail: string }> {
  const existing = await getWebhooks(apiKey);
  if (!existing) return { status: "error", detail: `${accountName}: não conseguiu listar webhooks (API key inválida?)` };

  const data = existing.data || [];
  const current = data.find((w: any) => w.url === WEBHOOK_URL);

  const payload = {
    name: "UNV Nexus - Pagamentos",
    url: WEBHOOK_URL,
    email: "fabricio@universidadevendas.com.br",
    sendType: "SEQUENTIALLY",
    events: WEBHOOK_EVENTS,
    enabled: true,
    interrupted: false,
    authToken: null,
  };

  if (current) {
    const r = await fetch(`${ASAAS_BASE}/webhooks/${current.id}`, {
      method: "PUT",
      headers: { access_token: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const err = await r.text();
      return { status: "error", detail: `${accountName}: erro ao atualizar: ${err}` };
    }
    return { status: "updated", detail: `${accountName}: webhook atualizado (id: ${current.id})` };
  }

  const r = await fetch(`${ASAAS_BASE}/webhooks`, {
    method: "POST",
    headers: { access_token: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await r.text();
    return { status: "error", detail: `${accountName}: erro ao criar: ${err}` };
  }
  const created = await r.json();
  return { status: "created", detail: `${accountName}: webhook criado (id: ${created.id})` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: accounts } = await supabase
    .from("asaas_accounts")
    .select("name, api_key_secret_name, is_active")
    .eq("is_active", true);

  if (!accounts?.length) {
    return new Response(JSON.stringify({ error: "Nenhuma conta Asaas ativa" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = [];
  for (const account of accounts) {
    const apiKey = Deno.env.get(account.api_key_secret_name);
    if (!apiKey) {
      results.push({ status: "skipped", detail: `${account.name}: secret ${account.api_key_secret_name} não encontrado` });
      continue;
    }
    const result = await upsertWebhook(apiKey, account.name);
    results.push(result);
  }

  console.log("[asaas-setup-webhooks]", JSON.stringify(results));

  return new Response(JSON.stringify({ webhook_url: WEBHOOK_URL, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
