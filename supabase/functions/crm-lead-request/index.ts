import { createClient } from "npm:@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const json = (p, s = 200)=>new Response(JSON.stringify(p), {
    status: s,
    headers: {
      ...CORS,
      "Content-Type": "application/json"
    }
  });
const isStevo = (u)=>(u || "").includes("stevo");
const digits = (p)=>(p || "").replace(/\D/g, "");
const br = (p)=>{
  const d = digits(p);
  if (!d) return "";
  return d.startsWith("55") ? d : d.length === 10 || d.length === 11 ? `55${d}` : d;
};
// Mensagem de sistema: sai pelo número institucional, nunca pelo de um vendedor.
async function pickInstance() {
  for (const name of [
    "fabricionunnes",
    "marceloalmeida"
  ]){
    const { data } = await supabase.from("whatsapp_instances").select("instance_name, api_url, api_key, provider_type, phone_number").eq("instance_name", name).eq("status", "connected").maybeSingle();
    if (data) return data;
  }
  return null;
}
async function sendWhatsApp(inst, phone, text) {
  if (!inst.api_url || !inst.api_key) return false;
  const base = String(inst.api_url).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
  const v2 = inst.provider_type === "manager_v2" || isStevo(base);
  const url = v2 ? `${base}/send/text` : `${base}/message/sendText/${inst.instance_name}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        apikey: String(inst.api_key),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        number: phone,
        text
      })
    });
    return r.ok;
  } catch  {
    return false;
  }
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: CORS
  });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await supabase.auth.getUser(token);
    if (!u?.user) return json({
      error: "não autenticado"
    }, 401);
    const { data: me } = await supabase.from("onboarding_staff").select("id, name, tenant_id").eq("user_id", u.user.id).eq("is_active", true).maybeSingle();
    if (!me) return json({
      error: "sem acesso ao CRM"
    }, 403);
    const body = await req.json().catch(()=>({}));
    const leadId = String(body.lead_id || "");
    const dryRun = body.dry_run === true;
    if (!/^[0-9a-f-]{36}$/i.test(leadId)) return json({
      error: "lead_id inválido"
    }, 400);
    const { data: lead } = await supabase.from("crm_leads").select("id, name, company, tenant_id, owner_staff_id, pipeline:crm_pipelines(name), stage:crm_stages(name)").eq("id", leadId).maybeSingle();
    if (!lead || (lead.tenant_id ?? null) !== (me.tenant_id ?? null)) return json({
      error: "lead não encontrado"
    }, 404);
    if (lead.owner_staff_id === me.id) return json({
      ok: true,
      ja_e_seu: true
    });
    // no máximo 1 pedido por pessoa por lead a cada 30 min
    const desde = new Date(Date.now() - 30 * 60000).toISOString();
    const { data: recente } = await supabase.from("crm_lead_access_requests").select("id").eq("lead_id", leadId).eq("requester_staff_id", me.id).gte("created_at", desde).limit(1);
    if (recente?.length && !dryRun) return json({
      ok: true,
      ja_pedido: true
    });
    // destinatários: dono atual + head comercial + master (mesmo tenant), menos quem pediu
    const { data: gestores } = await supabase.from("onboarding_staff").select("id, name, phone, role, tenant_id").eq("is_active", true).in("role", [
      "master",
      "head_comercial"
    ]);
    const alvo = new Map();
    const add = (s)=>{
      const ph = br(s?.phone || "");
      if (s && s.id !== me.id && ph && !alvo.has(ph)) alvo.set(ph, {
        id: s.id,
        name: s.name,
        phone: ph
      });
    };
    let donoNome = "";
    if (lead.owner_staff_id) {
      const { data: dono } = await supabase.from("onboarding_staff").select("id, name, phone").eq("id", lead.owner_staff_id).maybeSingle();
      donoNome = dono?.name || "";
      add(dono);
    }
    for (const g of gestores || [])if ((g.tenant_id ?? null) === (me.tenant_id ?? null)) add(g);
    const msgBase = `🙋 *Pedido de lead*\n\n*${me.name}* abriu o lead *${lead.name}*${lead.company ? ` (${lead.company})` : ""} e não tem acesso, porque ele está com *${donoNome || "outra pessoa"}*.` + `${lead.pipeline?.name ? `\n*Funil:* ${lead.pipeline.name}${lead.stage?.name ? ` · ${lead.stage.name}` : ""}` : ""}` + `\n\nSe for o caso, transfira o lead para ${me.name.split(" ")[0]} trocando o responsável:\n📋 https://unvholdings.com.br/#/crm/leads/${lead.id}`;
    if (dryRun) return json({
      ok: true,
      dry: true,
      destinatarios: [
        ...alvo.values()
      ].map((a)=>a.name),
      msg: msgBase
    });
    // o pedido nasce aqui pra cada gestor receber um link de decisão só dele
    const { data: pedido } = await supabase.from("crm_lead_access_requests").insert({
      lead_id: leadId,
      requester_staff_id: me.id,
      notified: [],
      status: "pending"
    }).select("id").single();
    const DECIDE = `${SUPABASE_URL}/functions/v1/crm-lead-decide`;
    const novoToken = ()=>{
      const b = new Uint8Array(24);
      crypto.getRandomValues(b);
      return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };
    const inst = await pickInstance();
    const instPhone = digits(inst?.phone_number || "");
    const enviados = [];
    if (inst) for (const a of alvo.values()){
      if (instPhone && a.phone === instPhone) continue;
      const tk = novoToken();
      if (pedido?.id) {
        await supabase.from("crm_lead_access_decisions").insert({
          token: tk,
          request_id: pedido.id,
          staff_id: a.id
        });
      }
      const link = `${DECIDE}?t=${encodeURIComponent(tk)}`;
      const texto = `${msgBase}\n\n*Responder:*\n✅ Aceitar e passar pro ${me.name.split(" ")[0]}:\n${link}&d=sim\n\n❌ Recusar:\n${link}&d=nao`;
      if (await sendWhatsApp(inst, a.phone, texto)) enviados.push(a.name);
    }
    if (pedido?.id) await supabase.from("crm_lead_access_requests").update({
      notified: enviados
    }).eq("id", pedido.id);
    return json({
      ok: true,
      enviados,
      sem_instancia: !inst,
      pedido: pedido?.id
    });
  } catch (e) {
    return json({
      error: String(e).slice(0, 300)
    }, 500);
  }
});