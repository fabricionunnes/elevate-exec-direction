// Formulário nativo do Meta (Lead Ads) → CRM Comercial. Pedido do Fabrício, 18/09/2026.
//   { action: "forms" }  — lista os formulários das páginas conectadas e atualiza o catálogo (crm_meta_lead_forms)
//   { action: "sync", dry_run?, form_id? } — importa os leads novos dos formulários LIGADOS (cron a cada 5 min)
// Cada lead entra no funil/etapa/origem do formulário, com TODAS as respostas na aba Respostas e o rastreio do anúncio
// (campanha/conjunto/anúncio + meta_lead_id). O meta_lead_id é o que permite o rastreamento avançado (CAPI) casar o
// lead de formulário, que não tem fbclid. utm_source = facebook/instagram faz o gatilho capi_lead disparar o evento Lead.
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const G = "https://graph.facebook.com/v21.0";

async function graph(path: string, token: string): Promise<any> {
  const r = await fetch(`${G}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`);
  const d = await r.json();
  if (d?.error) throw new Error(`Meta: ${d.error.message}`);
  return d;
}
async function userToken(): Promise<string> {
  const { data } = await supabase.from("crm_meta_ads_accounts").select("access_token").not("access_token", "is", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!data?.access_token) throw new Error("Conta Meta do CRM não conectada (Configurações → Integrações).");
  return data.access_token;
}
async function pageTokens(): Promise<Map<string, { name: string; token: string }>> {
  const t = await userToken();
  const m = new Map<string, { name: string; token: string }>();
  let url = `me/accounts?fields=id,name,access_token&limit=100`;
  for (let i = 0; i < 5 && url; i++) {
    const d = await graph(url, t);
    for (const p of d.data || []) if (p.access_token) m.set(String(p.id), { name: p.name, token: p.access_token });
    url = d.paging?.next ? String(d.paging.next).replace(`${G}/`, "").replace(/([?&])access_token=[^&]*/, "$1").replace(/[?&]$/, "") : "";
  }
  return m;
}

const digits = (s: string) => (s || "").replace(/\D/g, "");
const NOME = /^(full_?name|nome(_completo)?|name)$/i, PRIMEIRO = /^(first_?name|primeiro_nome)$/i, ULTIMO = /^(last_?name|sobrenome)$/i;
const FONE = /^(phone(_number)?|telefone|celular|whatsapp|numero_de_telefone|número_de_telefone)$/i, EMAIL = /^(e-?mail|email_address)$/i;
const EMPRESA = /^(company(_name)?|empresa|nome_da_empresa)$/i, CIDADE = /^(city|cidade)$/i, ESTADO = /^(state|estado|province)$/i, CARGO = /^(job_title|cargo)$/i;
const bonito = (k: string) => { const t = k.replace(/_/g, " ").replace(/\s+/g, " ").trim(); return t.charAt(0).toUpperCase() + t.slice(1); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "sync");

    if (action === "forms") {
      // só equipe logada com permissão de configurações
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = await supabase.auth.getUser(token);
      const { data: me } = u?.user ? await supabase.from("onboarding_staff").select("role").eq("user_id", u.user.id).eq("is_active", true).maybeSingle() : { data: null } as any;
      if (!me || !["master", "admin"].includes(String(me.role))) return json({ error: "sem permissão" }, 403);
      const pages = await pageTokens();
      let total = 0; const erros: string[] = [];
      for (const [pid, pg] of pages) {
        try {
          const d = await graph(`${pid}/leadgen_forms?fields=id,name,status,leads_count&limit=100`, pg.token);
          for (const f of d.data || []) {
            total++;
            const { data: ex } = await supabase.from("crm_meta_lead_forms").select("form_id").eq("form_id", String(f.id)).maybeSingle();
            const row = { form_name: f.name, page_id: pid, page_name: pg.name, status: f.status, leads_count: Number(f.leads_count || 0) };
            if (ex) await supabase.from("crm_meta_lead_forms").update(row).eq("form_id", String(f.id));
            else await supabase.from("crm_meta_lead_forms").insert({ form_id: String(f.id), ...row });
          }
        } catch (e) { erros.push(`${pg.name}: ${String((e as Error).message).slice(0, 100)}`); }
      }
      return json({ ok: true, paginas: pages.size, formularios: total, erros });
    }

    // ── sync ──
    const dry = body.dry_run === true;
    let q = supabase.from("crm_meta_lead_forms").select("*").eq("is_active", true).not("pipeline_id", "is", null);
    if (body.form_id) q = q.eq("form_id", String(body.form_id));
    const { data: forms } = await q;
    if (!forms?.length) return json({ ok: true, formularios: 0, importados: 0 });
    const pages = await pageTokens();
    const out: any[] = [];

    for (const f of forms) {
      const pg = pages.get(String(f.page_id));
      if (!pg) { out.push({ form: f.form_name, erro: "página sem acesso no token" }); continue; }
      let novos = 0, vinculados = 0, maisRecente = f.last_lead_time ? Date.parse(f.last_lead_time) : 0;
      try {
        // perguntas do formulário: chave → texto que o lead viu
        const labels = new Map<string, string>();
        try { const fq = await graph(`${f.form_id}?fields=questions`, pg.token); for (const qq of fq.questions || []) labels.set(String(qq.key), String(qq.label || qq.key)); } catch { /* segue com a chave */ }
        // só o que chegou depois de ligar (ou do último importado); margem de 10 min
        const desde = Math.floor(((maisRecente || Date.parse(f.activated_at || new Date().toISOString())) - 600000) / 1000);
        const filtro = encodeURIComponent(JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: desde }]));
        let url = `${f.form_id}/leads?fields=id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,platform,is_organic&filtering=${filtro}&limit=100`;
        const leads: any[] = [];
        for (let i = 0; i < 10 && url; i++) {
          const d = await graph(url, pg.token);
          leads.push(...(d.data || []));
          url = d.paging?.next ? String(d.paging.next).replace(`${G}/`, "").replace(/([?&])access_token=[^&]*/, "$1").replace(/[?&]$/, "") : "";
        }
        let stageId = f.stage_id;
        if (!stageId) stageId = (await supabase.from("crm_stages").select("id").eq("pipeline_id", f.pipeline_id).order("sort_order", { ascending: true }).limit(1).maybeSingle()).data?.id || null;

        for (const L of leads.sort((a, b) => Date.parse(a.created_time) - Date.parse(b.created_time))) {
          const criado = Date.parse(L.created_time); if (criado > maisRecente) maisRecente = criado;
          const { data: ja } = await supabase.from("crm_leads").select("id").eq("meta_lead_id", String(L.id)).maybeSingle();
          if (ja) continue;
          let nome = "", pn = "", un = "", fone = "", email = "", empresa = "", cidade = "", estado = "", cargo = "";
          const respostas: { label: string; valor: string }[] = [];
          for (const fd of L.field_data || []) {
            const k = String(fd.name || ""), v = (fd.values || []).map((x: unknown) => String(x)).join(", ").trim();
            if (!v) continue;
            if (NOME.test(k)) nome = v; else if (PRIMEIRO.test(k)) pn = v; else if (ULTIMO.test(k)) un = v;
            else if (FONE.test(k)) fone = v; else if (EMAIL.test(k)) email = v; else if (EMPRESA.test(k)) empresa = v;
            else if (CIDADE.test(k)) cidade = v; else if (ESTADO.test(k)) estado = v; else if (CARGO.test(k)) cargo = v;
            respostas.push({ label: labels.get(k) || bonito(k), valor: v.replace(/_/g, " ") });
          }
          nome = nome || [pn, un].filter(Boolean).join(" ") || email || fone || "Lead do formulário";
          const foneD = digits(fone); const foneBR = foneD.startsWith("55") ? foneD : (foneD.length === 10 || foneD.length === 11) ? `55${foneD}` : foneD;
          const plataforma = String(L.platform || "").toLowerCase() === "ig" ? "instagram" : "facebook";
          if (dry) { novos++; out.push({ form: f.form_name, lead: nome, fone: foneBR ? `…${foneBR.slice(-4)}` : null, respostas: respostas.length, campanha: L.campaign_name }); continue; }

          // já existe lead com esse telefone? liga o formulário nele em vez de duplicar
          let leadId: string | null = null;
          if (foneBR.length >= 12) {
            const { data: ex } = await supabase.rpc("crm_find_lead_by_phone", { p_phone: foneBR });
            if (ex) leadId = String(ex);
          }
          const rastreio: Record<string, unknown> = {
            meta_lead_id: String(L.id), meta_campaign_id: L.campaign_id || null, meta_adset_id: L.adset_id || null, meta_ad_id: L.ad_id || null,
            campaign_name: L.campaign_name || null, adset_name: L.adset_name || null, ad_name: L.ad_name || null,
          };
          if (leadId) {
            await supabase.from("crm_leads").update(rastreio).eq("id", leadId).is("meta_lead_id", null);
            vinculados++;
          } else {
            const { data: ins, error: ie } = await supabase.from("crm_leads").insert({
              name: nome, phone: foneBR || null, email: email || null, company: empresa || null, city: cidade || null, state: estado || null, role: cargo || null,
              pipeline_id: f.pipeline_id, stage_id: stageId, origin_id: f.origin_id || null,
              utm_source: plataforma, utm_medium: "lead_form", utm_campaign: L.campaign_name || null, utm_content: L.ad_name || null, utm_term: L.adset_name || null,
              ...rastreio,
            }).select("id").single();
            if (ie) { out.push({ form: f.form_name, lead: nome, erro: ie.message.slice(0, 120) }); continue; }
            leadId = ins.id; novos++;
          }
          // etiquetas do formulário valem pro lead novo e pro que já existia
          if (leadId) for (const tg of (f.tag_ids || [])) await supabase.from("crm_lead_tags").upsert({ lead_id: leadId, tag_id: tg }, { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
          if (leadId && respostas.length) {
            await supabase.from("crm_lead_form_answers").insert(respostas.map((r) => ({ lead_id: leadId, question_id: null, question_label: r.label, answer_text: r.valor, source: `meta_form:${f.form_id}` })));
          }
          if (leadId) await supabase.from("crm_lead_history").insert({ lead_id: leadId, action: "meta_lead_form", notes: `Preencheu o formulário "${f.form_name}" no ${plataforma === "instagram" ? "Instagram" : "Facebook"}${L.campaign_name ? ` (campanha ${L.campaign_name})` : ""}` }).then(() => {}, () => {});
        }
        if (!dry) await supabase.from("crm_meta_lead_forms").update({ last_synced_at: new Date().toISOString(), last_lead_time: maisRecente ? new Date(maisRecente).toISOString() : f.last_lead_time, imported_count: (f.imported_count || 0) + novos + vinculados, last_result: `ok: ${novos} novo(s), ${vinculados} já existente(s)` }).eq("form_id", f.form_id);
        out.push({ form: f.form_name, novos, vinculados, lidos: leads.length });
      } catch (e) {
        const msg = String((e as Error).message || e).slice(0, 200);
        if (!dry) await supabase.from("crm_meta_lead_forms").update({ last_synced_at: new Date().toISOString(), last_result: `erro: ${msg}` }).eq("form_id", f.form_id);
        out.push({ form: f.form_name, erro: msg });
      }
    }
    return json({ ok: true, formularios: forms.length, detalhe: out });
  } catch (e) { return json({ ok: false, error: String((e as Error).message || e).slice(0, 300) }, 500); }
});
