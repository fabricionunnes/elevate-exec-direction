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
// Número institucional: reserva pra quando quem pediu não tem WhatsApp próprio conectado.
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
// O pedido sai pelo WhatsApp de quem pediu (decisão do Fabrício em 13/11/2026): a conexão
// conectada do mesmo tenant cujo número é o telefone do cadastro da pessoa.
const semDdi = (p)=>{
  const d = digits(p);
  return d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
};
// Mesmo DDD e mesmos 8 dígitos finais: tolera o nono dígito e o 55 na frente.
const mesmoNumero = (a, b)=>{
  const x = semDdi(a), y = semDdi(b);
  if (x.length < 10 || y.length < 10) return false;
  return x.slice(0, 2) === y.slice(0, 2) && x.slice(-8) === y.slice(-8);
};
async function instanciaDe(staff) {
  if (!digits(staff?.phone || "")) return null;
  let q = supabase.from("whatsapp_instances").select("instance_name, api_url, api_key, provider_type, phone_number").eq("status", "connected");
  q = staff.tenant_id ? q.eq("tenant_id", staff.tenant_id) : q.is("tenant_id", null);
  const { data } = await q;
  return (data || []).find((i)=>mesmoNumero(i.phone_number, staff.phone)) || null;
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
    const { data: me } = await supabase.from("onboarding_staff").select("id, name, tenant_id, phone").eq("user_id", u.user.id).eq("is_active", true).maybeSingle();
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
    const leadTxt = `*${lead.name}*${lead.company ? ` (${lead.company})` : ""}`;
    const rodape = `${lead.pipeline?.name ? `\n*Funil:* ${lead.pipeline.name}${lead.stage?.name ? ` · ${lead.stage.name}` : ""}` : ""}` + `\n\nVer o lead:\n📋 https://unvholdings.com.br/#/crm/leads/${lead.id}`;
    // terceira pessoa: quando o aviso sai pelo número institucional
    const msgBase = `🙋 *Pedido de lead*\n\n*${me.name}* abriu o lead ${leadTxt} e não tem acesso, porque ele está com *${donoNome || "outra pessoa"}*.` + rodape;
    // primeira pessoa: quando sai do WhatsApp de quem pediu (pro dono do lead vira "está com você")
    const msgPropria = (paraODono)=>`🙋 *Pedido de lead*\n\nAbri o lead ${leadTxt} e não tenho acesso, porque ele está com ${paraODono ? "você" : `*${donoNome || "outra pessoa"}*`}. Pode passar pra mim?` + rodape;
    // sai do WhatsApp de quem pediu; sem conexão própria, do número institucional
    const propria = await instanciaDe(me);
    const inst = propria || await pickInstance();
    if (dryRun) return json({
      ok: true,
      dry: true,
      instancia: inst?.instance_name || null,
      da_propria_pessoa: !!propria,
      destinatarios: [
        ...alvo.values()
      ].map((a)=>a.name),
      msg: propria ? msgPropria(false) : msgBase
    });
    // o pedido nasce aqui pra cada gestor receber um link de decisão só dele
    const { data: pedido } = await supabase.from("crm_lead_access_requests").insert({
      lead_id: leadId,
      requester_staff_id: me.id,
      notified: [],
      status: "pending"
    }).select("id").single();
    const DECIDE = "https://unvholdings.com.br/#/pedido-lead";
    const novoToken = ()=>{
      const b = new Uint8Array(24);
      crypto.getRandomValues(b);
      return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };
    const instPhone = digits(inst?.phone_number || "");
    // se o WhatsApp de quem pediu falhar no envio, o aviso não se perde: vai pelo institucional
    const reserva = propria ? await pickInstance() : null;
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
      const fim = `\n\n*Aceitar ou recusar em um toque:*\n${link}`;
      const texto = (propria ? msgPropria(a.id === lead.owner_staff_id) : msgBase) + fim;
      let ok = await sendWhatsApp(inst, a.phone, texto);
      // pela reserva institucional o texto volta pra terceira pessoa
      if (!ok && reserva && digits(reserva.phone_number || "") !== a.phone) ok = await sendWhatsApp(reserva, a.phone, msgBase + fim);
      if (ok) enviados.push(a.name);
    }
    if (pedido?.id) await supabase.from("crm_lead_access_requests").update({
      notified: enviados
    }).eq("id", pedido.id);
    return json({
      ok: true,
      enviados,
      sem_instancia: !inst,
      instancia: inst?.instance_name || null,
      pedido: pedido?.id
    });
  } catch (e) {
    return json({
      error: String(e).slice(0, 300)
    }, 500);
  }
});