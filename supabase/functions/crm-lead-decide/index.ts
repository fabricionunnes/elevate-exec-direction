// Decisão do "Pedido de lead" (24/09/2026). Responde JSON; a página é a rota
// /#/pedido-lead do app (o Supabase força text/plain em qualquer HTML servido por
// edge function, então a página não pode morar aqui).
//   POST { token }            → dados do pedido, pra tela montar os botões
//   POST { token, decisao }   → "sim" transfere o lead, "nao" recusa
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const APP = "https://unvholdings.com.br";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const digits = (p: string) => (p || "").replace(/\D/g, "");
const br = (p: string) => { const d = digits(p); if (!d) return ""; return d.startsWith("55") ? d : (d.length === 10 || d.length === 11) ? `55${d}` : d; };

async function pickInstance() {
  for (const name of ["fabricionunnes", "marceloalmeida"]) {
    const { data } = await supabase.from("whatsapp_instances")
      .select("instance_name, api_url, api_key, provider_type, phone_number")
      .eq("instance_name", name).eq("status", "connected").maybeSingle();
    if (data) return data;
  }
  return null;
}
async function sendWhatsApp(inst: any, phone: string, text: string) {
  if (!inst?.api_url || !inst?.api_key) return false;
  const base = String(inst.api_url).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
  const v2 = inst.provider_type === "manager_v2" || base.includes("stevo");
  try {
    const r = await fetch(v2 ? `${base}/send/text` : `${base}/message/sendText/${inst.instance_name}`, {
      method: "POST", headers: { apikey: String(inst.api_key), "Content-Type": "application/json" },
      body: JSON.stringify({ number: phone, text }),
    });
    return r.ok;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || url.searchParams.get("t") || "");
    const decisao = String(body.decisao || "");

    if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return json({ erro: "link_invalido" }, 400);

    const { data: tk } = await supabase.from("crm_lead_access_decisions")
      .select("token, request_id, staff_id").eq("token", token).maybeSingle();
    if (!tk) return json({ erro: "nao_encontrado" }, 404);

    const { data: req0 } = await supabase.from("crm_lead_access_requests")
      .select("id, lead_id, requester_staff_id, status, decided_by, decided_at, created_at").eq("id", tk.request_id).maybeSingle();
    if (!req0) return json({ erro: "nao_encontrado" }, 404);

    const [{ data: lead }, { data: quemPediu }, { data: quemDecide }] = await Promise.all([
      supabase.from("crm_leads").select("id, name, company, owner_staff_id, pipeline:crm_pipelines(name), stage:crm_stages(name)").eq("id", req0.lead_id).maybeSingle(),
      supabase.from("onboarding_staff").select("id, name, phone").eq("id", req0.requester_staff_id).maybeSingle(),
      supabase.from("onboarding_staff").select("id, name").eq("id", tk.staff_id).maybeSingle(),
    ]);
    if (!lead) return json({ erro: "lead_nao_encontrado" }, 404);

    const base = {
      lead: { id: lead.id, nome: lead.name, empresa: lead.company, funil: (lead as any).pipeline?.name || null, etapa: (lead as any).stage?.name || null },
      quem_pediu: quemPediu?.name || null,
      quem_decide: quemDecide?.name || null,
      link_lead: `${APP}/#/crm/leads/${lead.id}`,
    };

    // já respondido
    if (req0.status !== "pending") {
      const { data: dec } = await supabase.from("onboarding_staff").select("name").eq("id", req0.decided_by).maybeSingle();
      return json({ ...base, status: req0.status, ja_respondido: true, respondido_por: dec?.name || null });
    }

    // só consulta (a tela abre assim)
    if (decisao !== "sim" && decisao !== "nao") return json({ ...base, status: "pending" });

    const aceitar = decisao === "sim";
    const agora = new Date().toISOString();

    if (aceitar) {
      const { error } = await supabase.from("crm_leads")
        .update({ owner_staff_id: req0.requester_staff_id, updated_at: agora }).eq("id", lead.id);
      if (error) return json({ ...base, erro: "falha_transferencia", detalhe: error.message }, 500);
      await supabase.from("crm_activities").insert({
        lead_id: lead.id, type: "note", status: "completed", completed_at: agora,
        title: "Lead transferido pelo pedido de acesso",
        description: `${quemDecide?.name || "Gestor"} aceitou o pedido de ${quemPediu?.name || "—"} e passou o lead pra ele.`,
      }).then(() => {}, () => {});
    }

    await supabase.from("crm_lead_access_requests")
      .update({ status: aceitar ? "accepted" : "declined", decided_by: tk.staff_id, decided_at: agora })
      .eq("id", req0.id).eq("status", "pending");
    await supabase.from("crm_lead_access_decisions").update({ used_at: agora, decision: aceitar ? "sim" : "nao" }).eq("token", token);

    const fone = br(quemPediu?.phone || "");
    if (fone) {
      const inst = await pickInstance();
      if (inst) {
        const texto = aceitar
          ? `✅ *Lead liberado*\n\n${quemDecide?.name || "A gestão"} passou o lead *${lead.name}*${lead.company ? ` (${lead.company})` : ""} pra você.\n\n${base.link_lead}`
          : `❌ *Pedido recusado*\n\n${quemDecide?.name || "A gestão"} manteve o lead *${lead.name}*${lead.company ? ` (${lead.company})` : ""} com quem já estava. Fale com a gestão se precisar.`;
        await sendWhatsApp(inst, fone, texto);
      }
    }

    return json({ ...base, status: aceitar ? "accepted" : "declined", feito_agora: true });
  } catch (e) {
    return json({ erro: "falha", detalhe: String(e).slice(0, 200) }, 500);
  }
});
