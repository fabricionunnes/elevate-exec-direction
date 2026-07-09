// crm-autofill: extrai dados estruturados da transcrição da reunião pra preencher
// os campos do lead no CRM (produto, valor, forma de pagamento, segmento, dor, etc.).
// Produto e forma de pagamento são escolhidos das LISTAS fornecidas (ids reais).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MODEL = "claude-sonnet-4-6";

function headTail(s: string | null | undefined, n: number): string {
  const t = String(s || "").trim();
  if (t.length <= n) return t;
  const head = Math.floor(n * 0.55);
  return t.slice(0, head) + "\n\n[…trecho do meio omitido…]\n\n" + t.slice(t.length - (n - head));
}

// Interpreta valor em reais tolerando formatos: number, "2000", "2.000",
// "2.000,00", "R$ 2.000", "24 mil", "2,5 mil". Retorna number>0 ou null.
export function parseMoneyBR(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : null;
  if (typeof raw !== "string") return null;
  let s = raw.toLowerCase().replace(/r\$/g, "").trim();
  const mil = s.match(/([\d.,]+)\s*mil\b/);
  if (mil) {
    const base = Number(mil[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(base) && base > 0) return Math.round(base * 1000);
  }
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");        // 2.000,00 -> 2000.00
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");   // 1.234.567 -> 1234567
  else if (/^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(".", "");            // 2.000 -> 2000 (milhar)
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada");

    const body = await req.json().catch(() => ({}));
    const transcription: string = body.transcription || "";
    const services: { id: string; name: string }[] = Array.isArray(body.services) ? body.services : [];
    const paymentMethods: { id: string; name: string }[] = Array.isArray(body.paymentMethods) ? body.paymentMethods : [];
    if (!transcription.trim()) throw new Error("transcription é obrigatória");

    const prompt = `Você é analista comercial da UNV. A partir da TRANSCRIÇÃO de uma reunião de vendas, extraia os dados pra preencher o CRM. Use SÓ o que foi dito na reunião — não invente.

Empresas/serviços possíveis (escolha 1 id se o serviço foi discutido, senão null):
${services.map((s) => `- ${s.id} = ${s.name}`).join("\n")}

Formas de pagamento possíveis (escolha 1 id se foi combinada, senão null):
${paymentMethods.map((p) => `- ${p.id} = ${p.name}`).join("\n")}

Transcrição:
${headTail(transcription, 44000)}

Regras:
- VALOR (opportunity_value): o valor do negócio combinado, em REAIS, como NÚMERO puro (sem "R$", sem pontos). Se for mensalidade, use o valor MENSAL (ex.: "2.000 por mês" -> 2000). O valor costuma ser combinado no FIM da reunião. Se não houver valor claro, null.
- product_id e payment_method_id: SOMENTE um id das listas acima, ou null. Nunca invente id.
- segment: segmento/ramo do cliente (ex.: "Estética capilar", "Academia"). main_pain: a principal dor comercial dita. estimated_revenue: faturamento atual do cliente se mencionado (texto). employee_count: nº de vendedores/funcionários se mencionado (texto).

Responda APENAS com JSON válido:
{
  "product_id": "id ou null",
  "opportunity_value": número ou null,
  "payment_method_id": "id ou null",
  "segment": "texto ou null",
  "estimated_revenue": "texto ou null",
  "employee_count": "texto ou null",
  "main_pain": "texto ou null"
}`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 800, messages: [{ role: "user", content: prompt }] }),
    });
    if (!aiResp.ok) throw new Error(`Anthropic ${aiResp.status}`);
    const aiData = await aiResp.json();
    let raw = (aiData?.content?.[0]?.text || "{}").trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
    let fields: any;
    try { fields = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); fields = m ? JSON.parse(m[0]) : {}; }

    // valida ids contra as listas (descarta alucinação)
    const sIds = new Set(services.map((s) => s.id));
    const pIds = new Set(paymentMethods.map((p) => p.id));
    if (fields.product_id && !sIds.has(fields.product_id)) fields.product_id = null;
    if (fields.payment_method_id && !pIds.has(fields.payment_method_id)) fields.payment_method_id = null;
    fields.opportunity_value = parseMoneyBR(fields.opportunity_value);

    return new Response(JSON.stringify({ fields }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
