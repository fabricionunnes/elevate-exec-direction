import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// nome placeholder = auto-gerado (IGSID / @user / "Instagram 123" / só dígitos)
const isPlaceholderName = (n: string | null) => {
  const s = (n || "").trim();
  if (!s) return true;
  if (/^instagram\s/i.test(s)) return true;
  if (/^@/.test(s)) return true;
  if (/^\d[\d\s]*$/.test(s)) return true;
  return false;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const { channel, conversation_id } = await req.json();
    if (!conversation_id || (channel !== "instagram" && channel !== "whatsapp")) return j({ ok: false, skip: "params" });
    const isIG = channel === "instagram";

    // conversa -> lead
    const convTable = isIG ? "instagram_conversations" : "crm_whatsapp_conversations";
    const { data: conv } = await supabase.from(convTable).select("lead_id").eq("id", conversation_id).maybeSingle();
    if (!conv?.lead_id) return j({ ok: true, skip: "conversa sem lead" });

    const { data: lead } = await supabase.from("crm_leads")
      .select("id, name, phone, email, company, trade_name, segment, estimated_revenue, employee_count, city, state, role, main_pain")
      .eq("id", conv.lead_id).maybeSingle();
    if (!lead) return j({ ok: true, skip: "lead não encontrado" });

    // se já está tudo preenchido, não gasta IA
    const missing = ["phone", "email", "company", "segment", "estimated_revenue", "employee_count", "city", "main_pain"]
      .filter((k) => !(lead as any)[k]);
    if (missing.length === 0 && !isPlaceholderName(lead.name)) return j({ ok: true, skip: "card completo" });

    // histórico
    const msgTable = isIG ? "instagram_messages" : "crm_whatsapp_messages";
    const tsCol = isIG ? "timestamp" : "created_at";
    const { data: hist } = await supabase.from(msgTable)
      .select(`direction, content, ${tsCol}`).eq("conversation_id", conversation_id)
      .order(tsCol, { ascending: true }).limit(50);
    const msgs = (hist || []).filter((m: any) => (m.content || "").trim().length > 0);
    if (msgs.length === 0) return j({ ok: true, skip: "sem mensagens" });
    const transcript = msgs.map((m: any) => `${m.direction === "inbound" ? "LEAD" : "NOS"}: ${m.content}`).join("\n").slice(0, 8000);

    const system = `Você extrai dados cadastrais de um LEAD B2B a partir de uma conversa de ${isIG ? "Instagram" : "WhatsApp"}.
Retorne SOMENTE um JSON válido, sem texto antes/depois, com estas chaves (use null quando o dado NÃO foi informado — NUNCA invente):
{
 "name": "nome da pessoa (não o @ nem número)",
 "phone": "telefone/whatsapp com DDD, só se o LEAD informou",
 "email": "e-mail se informado",
 "company": "nome da empresa do lead",
 "segment": "nicho/segmento do negócio (ex: estética, advocacia, e-commerce)",
 "estimated_revenue": "faturamento mensal em número (só dígitos, sem R$/pontos), ex: 300000",
 "employee_count": "nº de funcionários/vendedores se dito (número)",
 "city": "cidade",
 "state": "UF",
 "role": "cargo do lead (dono, sócio, gestor...)",
 "main_pain": "principal dor/objetivo comercial em 1 frase curta"
}
Extraia apenas do que o LEAD disse. Só o que estiver claro.`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        system,
        max_tokens: 500,
        messages: [{ role: "user", content: `Conversa:\n${transcript}\n\nExtraia o JSON.` }],
      }),
    });
    if (!aiResp.ok) return j({ ok: false, error: `IA ${aiResp.status}`, detail: (await aiResp.text()).slice(0, 200) });
    const aiData = await aiResp.json();
    let raw = (aiData?.content?.[0]?.text || "").trim();
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return j({ ok: true, skip: "IA não retornou JSON" });
    let ext: Record<string, any>;
    try { ext = JSON.parse(m[0]); } catch { return j({ ok: true, skip: "JSON inválido" }); }

    // monta update: só preenche campo VAZIO (não sobrescreve o que já existe)
    const update: Record<string, unknown> = {};
    const setIfEmpty = (col: string, val: any) => {
      if (val == null || String(val).trim() === "") return;
      if ((lead as any)[col]) return; // já preenchido → não toca
      update[col] = val;
    };
    setIfEmpty("email", typeof ext.email === "string" ? ext.email.toLowerCase().trim() : null);
    setIfEmpty("phone", ext.phone ? String(ext.phone).replace(/[^\d]/g, "") : null);
    setIfEmpty("company", ext.company);
    setIfEmpty("segment", ext.segment);
    setIfEmpty("city", ext.city);
    setIfEmpty("state", ext.state);
    setIfEmpty("role", ext.role);
    setIfEmpty("main_pain", ext.main_pain);
    if (ext.estimated_revenue != null && !lead.estimated_revenue) {
      const n = parseInt(String(ext.estimated_revenue).replace(/[^\d]/g, ""), 10);
      if (n > 0) update.estimated_revenue = n;
    }
    if (ext.employee_count != null && !lead.employee_count) {
      const n = parseInt(String(ext.employee_count).replace(/[^\d]/g, ""), 10);
      if (n > 0) update.employee_count = n;
    }
    // nome: só troca se o atual for placeholder e a IA achou um nome real
    if (isPlaceholderName(lead.name) && typeof ext.name === "string" && ext.name.trim() && !isPlaceholderName(ext.name)) {
      update.name = ext.name.trim();
    }

    if (Object.keys(update).length === 0) return j({ ok: true, updated: 0, skip: "nada novo" });
    update.updated_at = new Date().toISOString();
    const { error } = await supabase.from("crm_leads").update(update).eq("id", lead.id);
    if (error) return j({ ok: false, error: error.message });
    return j({ ok: true, updated: Object.keys(update).filter((k) => k !== "updated_at"), fields: update });
  } catch (e) {
    console.error("crm-lead-extract", e);
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
