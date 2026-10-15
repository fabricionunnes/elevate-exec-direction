import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ads-criativos — Criativos dos clientes UNV Ads.
 *
 *  remetente  : de qual número sai o envio de quem está logado (o número da própria pessoa)
 *  grupos     : grupos de WhatsApp pra escolher o do cliente (vinculado ao projeto primeiro)
 *  enviar     : manda o criativo (mídias + legenda) pro grupo do cliente pedindo aprovação
 *  avisar     : WhatsApp pro número pessoal de quem enviou quando o cliente aprova/pede ajuste
 *               (chamado pelo gatilho ads_criativo_avaliar_msg; não repete o mesmo aviso)
 *  meta_ads   : anúncios da conta Meta do cliente pra vincular ao criativo que subiu
 *  metricas   : métricas do criativo (soma dos anúncios vinculados, desde o início)
 *  metricas_cron : atualiza as métricas de todos os criativos no ar (cron diário)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GRAPH = "https://graph.facebook.com/v21.0";
const APP_URL = "https://unvholdings.com.br/#";
// aviso de aprovação sai de um número oficial, nunca do próprio número de quem recebe
const OFICIAIS = ["marceloalmeida", "fabricionunnes"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
/** DDD + 8 últimos dígitos: casa número com e sem o 9 e com e sem 55 */
const chave = (v: unknown) => {
  let d = digits(v);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : d;
};
const br = (v: unknown) => { const d = digits(v); return d.startsWith("55") ? d : `55${d}`; };

type Inst = { id: string; instance_name: string; display_name: string | null; phone_number: string | null; status: string; api_url: string | null; api_key: string | null; provider_type: string | null };
const INST_COLS = "id, instance_name, display_name, phone_number, status, api_url, api_key, provider_type";

const isV2 = (i: Inst) => {
  if (i.provider_type === "manager_v2") return true;
  try { return new URL(String(i.api_url || "")).hostname.toLowerCase().endsWith(".stevo.chat"); } catch { return false; }
};
const base = (i: Inst) => String(i.api_url || Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
const key = (i: Inst) => i.api_key || Deno.env.get("EVOLUTION_API_KEY") || "";
const msgId = (d: any): string | null => d?.key?.id || d?.data?.key?.id || d?.messageId || d?.data?.messageId || d?.id || null;

async function sendText(i: Inst, number: string, text: string) {
  const h = { "Content-Type": "application/json", apikey: key(i) };
  const r = isV2(i)
    ? await fetch(`${base(i)}/send/text`, { method: "POST", headers: h, body: JSON.stringify({ number, text, delay: 0 }) })
    : await fetch(`${base(i)}/message/sendText/${i.instance_name}`, { method: "POST", headers: h, body: JSON.stringify({ number, text }) });
  const t = await r.text();
  let d: any = null; try { d = JSON.parse(t); } catch { /* corpo não-JSON */ }
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${t.slice(0, 200)}`);
  return msgId(d);
}

async function sendMedia(i: Inst, number: string, m: { url: string; tipo: string; mime?: string; nome?: string }, caption: string) {
  const h = { "Content-Type": "application/json", apikey: key(i) };
  const mediatype = m.tipo === "video" ? "video" : "image";
  const body = { number, mediatype, mimetype: m.mime || undefined, media: m.url, caption, fileName: m.nome || undefined };
  const r = isV2(i)
    ? await fetch(`${base(i)}/send/media`, { method: "POST", headers: h, body: JSON.stringify(body) })
    : await fetch(`${base(i)}/message/sendMedia/${i.instance_name}`, { method: "POST", headers: h, body: JSON.stringify(body) });
  const t = await r.text();
  let d: any = null; try { d = JSON.parse(t); } catch { /* corpo não-JSON */ }
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${t.slice(0, 200)}`);
  return msgId(d);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // ── ações internas (gatilho do banco / cron): sem login, idempotentes ──
    if (action === "avisar") return json(await avisar(supabase, body.criativo_id));
    if (action === "metricas_cron") {
      const { data: lista } = await supabase.from("ads_criativos").select("id")
        .eq("no_ar", true).neq("meta_ad_ids", "{}");
      const out: unknown[] = [];
      for (const c of lista || []) {
        try { out.push({ id: c.id, ok: !!(await metricas(supabase, c.id)) }); }
        catch (e) { out.push({ id: c.id, erro: (e as Error).message }); }
      }
      return json({ ok: true, atualizados: out.length, out });
    }

    // ── ações do sistema: só time UNV logado ──
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await supabase.auth.getUser(jwt);
    if (!u?.user) return json({ error: "Faça login de novo." }, 401);
    const { data: staff } = await supabase.from("onboarding_staff")
      .select("id, name, phone, default_whatsapp_instance_id").eq("user_id", u.user.id).eq("is_active", true).maybeSingle();
    if (!staff) return json({ error: "Só o time UNV usa os criativos." }, 403);

    if (action === "remetente") return json(await remetente(supabase, staff));

    if (action === "grupos") {
      const projectId = String(body.project_id || "");
      const { data: proj } = await supabase.from("onboarding_projects")
        .select("id, onboarding_company:onboarding_companies(name)").eq("id", projectId).maybeSingle();
      const empresa = String((proj as any)?.onboarding_company?.name || "");
      const { data: cfg } = await supabase.from("ads_criativos_config").select("grupo_jid, grupo_nome").eq("project_id", projectId).maybeSingle();
      // todos os grupos que algum número nosso enxerga (contato com JID de grupo)
      const { data: convs } = await supabase.from("crm_whatsapp_conversations")
        .select("project_id, last_message_at, contact:crm_whatsapp_contacts!inner(phone, name)")
        .order("last_message_at", { ascending: false, nullsFirst: false }).limit(3000);
      const palavras = empresa.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
        .split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !["ltda", "eireli", "consultoria", "company", "servicos", "comercio"].includes(w));
      const mapa = new Map<string, { jid: string; nome: string; vinculado: boolean; sugerido: boolean; ultima: string | null }>();
      for (const c of convs || []) {
        const ct = (c as any).contact;
        const jid = digits(ct?.phone);
        if (jid.length < 18) continue;
        const nome = String(ct?.name || jid);
        const n = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        const atual = mapa.get(jid);
        const vinculado = (atual?.vinculado ?? false) || c.project_id === projectId;
        const sugerido = vinculado || palavras.some((w) => n.includes(w));
        mapa.set(jid, { jid, nome: atual?.nome && atual.nome !== jid ? atual.nome : nome, vinculado, sugerido: (atual?.sugerido ?? false) || sugerido, ultima: atual?.ultima ?? c.last_message_at });
      }
      const grupos = [...mapa.values()].sort((a, b) =>
        Number(b.jid === cfg?.grupo_jid) - Number(a.jid === cfg?.grupo_jid) ||
        Number(b.vinculado) - Number(a.vinculado) || Number(b.sugerido) - Number(a.sugerido) ||
        String(b.ultima || "").localeCompare(String(a.ultima || "")));
      return json({ padrao: cfg?.grupo_jid || grupos.find((g) => g.vinculado)?.jid || null, grupos });
    }

    if (action === "enviar") {
      const { data: c } = await supabase.from("ads_criativos").select("*").eq("id", body.criativo_id).maybeSingle();
      if (!c) return json({ error: "Criativo não encontrado." }, 404);
      const midias = (c.midias || []) as { url: string; tipo: string; mime?: string; nome?: string }[];
      if (!midias.length) return json({ error: "Coloque a imagem ou o vídeo do criativo antes de enviar." }, 400);
      const jid = digits(body.grupo_jid || c.grupo_jid);
      if (jid.length < 18) return json({ error: "Escolha o grupo do cliente." }, 400);
      const grupoNome = String(body.grupo_nome || c.grupo_nome || "");

      const rem = await remetente(supabase, staff);
      if (!rem.instancia) return json({ error: rem.motivo }, 400);
      const inst = rem.instancia as Inst;
      const number = `${jid}@g.us`;

      const ids: string[] = [];
      const titulo = c.envios > 0 ? `*Criativo pra aprovação (versão ${c.envios + 1}): ${c.titulo}*` : `*Criativo pra aprovação: ${c.titulo}*`;
      try {
        for (let k = 0; k < midias.length; k++) {
          const cap = k === 0 ? (midias.length > 1 ? `${titulo}\n(${midias.length} peças)` : titulo) : `${k + 1}/${midias.length}`;
          const id = await sendMedia(inst, number, midias[k], cap);
          if (id) ids.push(id);
        }
        const partes = [
          c.mensagem ? String(c.mensagem).trim() : null,
          c.legenda ? `*Legenda do anúncio:*\n${String(c.legenda).trim()}` : null,
          "Responda esta mensagem com *APROVADO* ou diga o que ajustar.",
        ].filter(Boolean);
        const id = await sendText(inst, number, partes.join("\n\n"));
        if (id) ids.push(id);
      } catch (e) {
        const m = (e as Error).message;
        const fora = /not.*(participant|member)|forbidden|not-authorized|item-not-found/i.test(m);
        return json({ error: fora ? `O número ${inst.display_name || inst.instance_name} não está nesse grupo. Adicione o número no grupo ou escolha outro grupo.` : `Não consegui enviar: ${m}` }, 502);
      }

      await supabase.from("ads_criativos").update({
        status: "enviado", enviado_por: staff.id, enviado_em: new Date().toISOString(), instancia_id: inst.id,
        wa_ids: [...(c.wa_ids || []), ...ids], envios: (c.envios || 0) + 1, grupo_jid: jid, grupo_nome: grupoNome,
        ultimo_remote_id: null, aviso_status: null,
      }).eq("id", c.id);
      await supabase.from("ads_criativos_config").upsert({ project_id: c.project_id, grupo_jid: jid, grupo_nome: grupoNome, updated_at: new Date().toISOString() });
      await supabase.from("ads_criativos_eventos").insert({
        criativo_id: c.id, tipo: "enviado", staff_id: staff.id, autor_nome: staff.name,
        texto: `Enviado pro grupo ${grupoNome || jid} do número ${inst.display_name || inst.instance_name}${ids.length ? "" : " (sem id de retorno: a aprovação por resposta pode não ser lida)"}`,
      });
      return json({ ok: true, enviados: ids.length, numero: inst.display_name || inst.instance_name });
    }

    if (action === "meta_ads") {
      const conta = await contaMeta(supabase, String(body.project_id || ""));
      if (!conta) return json({ error: "Conta do Meta Ads não conectada neste projeto. Conecte na aba Tráfego." }, 400);
      const fields = "id,name,status,effective_status,created_time,campaign{name},adset{name},creative.thumbnail_width(320).thumbnail_height(320){thumbnail_url,image_url}";
      let url: string | null = `${GRAPH}/${conta.act}/ads?fields=${encodeURIComponent(fields)}&limit=100&access_token=${conta.token}`;
      const ads: unknown[] = [];
      for (let p = 0; url && p < 4; p++) {
        const r: Response = await fetch(url);
        // deno-lint-ignore no-explicit-any
        const d: any = await r.json();
        if (d.error) return json({ error: erroMeta(d.error) }, 502);
        for (const a of d.data || []) ads.push({
          id: a.id, nome: a.name, status: a.effective_status || a.status, criado: a.created_time,
          campanha: a.campaign?.name || null, conjunto: a.adset?.name || null,
          thumb: a.creative?.thumbnail_url || a.creative?.image_url || null,
        });
        url = d.paging?.next || null;
      }
      ads.sort((a: any, b: any) => String(b.criado).localeCompare(String(a.criado)));
      return json({ ads });
    }

    if (action === "metricas") {
      const m = await metricas(supabase, String(body.criativo_id || ""));
      return json({ ok: true, metricas: m });
    }

    return json({ error: "ação desconhecida" }, 400);
  } catch (e) {
    console.error("[ads-criativos]", e);
    return json({ error: (e as Error).message || "erro" }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function remetente(supabase: any, staff: any): Promise<{ instancia: Inst | null; numero?: string; motivo?: string }> {
  // número da própria pessoa: o que tem o telefone dela > padrão dela > o que ela criou
  const { data: todas } = await supabase.from("whatsapp_instances").select(`${INST_COLS}, created_by`).is("tenant_id", null);
  const conectadas = ((todas || []) as (Inst & { created_by: string | null })[]).filter((i) => i.status === "connected");
  const minha = staff.phone ? conectadas.find((i) => chave(i.phone_number) === chave(staff.phone)) : undefined;
  const padrao = conectadas.find((i) => i.id === staff.default_whatsapp_instance_id);
  const criada = conectadas.filter((i) => i.created_by === staff.id);
  const inst = minha || padrao || (criada.length === 1 ? criada[0] : undefined);
  if (inst) return { instancia: inst, numero: inst.display_name || inst.instance_name };
  const desconectada = ((todas || []) as Inst[]).find((i) => staff.phone && chave(i.phone_number) === chave(staff.phone));
  return {
    instancia: null,
    motivo: desconectada
      ? `Seu WhatsApp (${desconectada.display_name || desconectada.instance_name}) está desconectado no Nexus. Reconecte em WhatsApp > Dispositivos pra enviar do seu número.`
      : `Seu número (${staff.phone || "sem telefone no cadastro"}) não está conectado no Nexus. Conecte seu WhatsApp em WhatsApp > Dispositivos pra enviar do seu número.`,
  };
}

// deno-lint-ignore no-explicit-any
async function avisar(supabase: any, criativoId: string) {
  const { data: c } = await supabase.from("ads_criativos")
    .select("id, titulo, status, aviso_status, enviado_por, project_id, aprovado_por_nome, resposta_cliente, ajuste_texto, aprovacao_origem, grupo_nome")
    .eq("id", criativoId).maybeSingle();
  if (!c || !["aprovado", "ajuste"].includes(c.status)) return { ok: false, motivo: "nada a avisar" };
  if (c.aviso_status === c.status) return { ok: true, motivo: "já avisado" };
  const { data: dono } = await supabase.from("onboarding_staff").select("name, phone").eq("id", c.enviado_por).maybeSingle();
  if (!dono?.phone) return { ok: false, motivo: "quem enviou não tem telefone" };
  const { data: proj } = await supabase.from("onboarding_projects")
    .select("onboarding_company:onboarding_companies(name)").eq("id", c.project_id).maybeSingle();
  const empresa = (proj as any)?.onboarding_company?.name || "cliente";

  const { data: inst } = await supabase.from("whatsapp_instances").select(INST_COLS).in("instance_name", OFICIAIS).eq("status", "connected");
  const lista = ((inst || []) as Inst[]).sort((a, b) => OFICIAIS.indexOf(a.instance_name) - OFICIAIS.indexOf(b.instance_name))
    .filter((i) => chave(i.phone_number) !== chave(dono.phone)); // mandar pra si mesmo não notifica
  if (!lista.length) return { ok: false, motivo: "nenhum número oficial conectado" };

  const link = `${APP_URL}/onboarding-tasks/${c.project_id}?tab=criativos`;
  const quem = c.aprovado_por_nome || "O cliente";
  const texto = c.status === "aprovado"
    ? [`*Criativo aprovado: ${c.titulo}*`, `Cliente: ${empresa}`,
       `${quem} aprovou no grupo${c.aprovacao_origem === "reacao" ? ` reagindo ${c.resposta_cliente}` : `: "${String(c.resposta_cliente || "").slice(0, 300)}"`}`,
       "Já está em Criativos aprovados. Quando subir no Meta, marque no sistema pra acompanhar as métricas.", link].join("\n\n")
    : [`*Cliente pediu ajuste: ${c.titulo}*`, `Cliente: ${empresa}`,
       `"${String(c.ajuste_texto || "").slice(0, 400)}"`, "Ajuste e reenvie pelo sistema.", link].join("\n\n");

  let erro = "";
  for (const i of lista) {
    try {
      await sendText(i, br(dono.phone), texto);
      await supabase.from("ads_criativos").update({ aviso_status: c.status }).eq("id", c.id);
      return { ok: true, via: i.instance_name };
    } catch (e) { erro = (e as Error).message; }
  }
  return { ok: false, motivo: erro };
}

// deno-lint-ignore no-explicit-any
async function contaMeta(supabase: any, projectId: string) {
  const { data } = await supabase.from("meta_ads_accounts").select("ad_account_id, access_token")
    .eq("project_id", projectId).eq("is_connected", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!data?.access_token || !data?.ad_account_id) return null;
  const act = String(data.ad_account_id).startsWith("act_") ? data.ad_account_id : `act_${data.ad_account_id}`;
  return { act, token: data.access_token as string };
}

/** token derrubado pelo Facebook (troca de senha etc.) vira instrução, não erro cru */
const erroMeta = (e: any) => e?.code === 190 || /access token|session has been invalidated/i.test(String(e?.message || ""))
  ? "A conexão com o Meta Ads deste cliente caiu (o Facebook invalidou o acesso). Reconecte na aba Tráfego e tente de novo."
  : `Meta: ${e?.message || "erro"}`;

// deno-lint-ignore no-explicit-any
const acao = (arr: any[] | undefined, tipos: string[]) => {
  let v = 0;
  for (const t of tipos) { const a = (arr || []).find((x) => x.action_type === t); if (a) { v = Number(a.value || 0); break; } }
  return v;
};

// deno-lint-ignore no-explicit-any
async function metricas(supabase: any, criativoId: string) {
  const { data: c } = await supabase.from("ads_criativos").select("id, project_id, meta_ad_ids").eq("id", criativoId).maybeSingle();
  if (!c) throw new Error("Criativo não encontrado.");
  const ids = (c.meta_ad_ids || []) as string[];
  if (!ids.length) throw new Error("Vincule ao menos um anúncio do Meta.");
  const conta = await contaMeta(supabase, c.project_id);
  if (!conta) throw new Error("Conta do Meta Ads não conectada neste projeto.");

  const fields = "spend,impressions,reach,clicks,inline_link_clicks,ctr,cpc,cpm,frequency,actions,action_values";
  const tot = { gasto: 0, impressoes: 0, alcance: 0, cliques: 0, cliques_link: 0, leads: 0, conversas: 0, compras: 0, valor_compras: 0 };
  const recente = { gasto: 0, resultados: 0 };
  const anuncios: unknown[] = [];
  for (const id of ids) {
    const [rAd, rIns, r7] = await Promise.all([
      fetch(`${GRAPH}/${id}?fields=name,effective_status,created_time&access_token=${conta.token}`).then((r) => r.json()),
      fetch(`${GRAPH}/${id}/insights?fields=${fields}&date_preset=maximum&access_token=${conta.token}`).then((r) => r.json()),
      fetch(`${GRAPH}/${id}/insights?fields=spend,actions&date_preset=last_7d&access_token=${conta.token}`).then((r) => r.json()),
    ]);
    if (rIns.error) throw new Error(erroMeta(rIns.error));
    const i = rIns.data?.[0] || {};
    const leads = acao(i.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
    const conversas = acao(i.actions, ["onsite_conversion.messaging_conversation_started_7d"]);
    const compras = acao(i.actions, ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"]);
    const valor = acao(i.action_values, ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"]);
    const linha = {
      id, nome: rAd?.name || id, status: rAd?.effective_status || null, criado: rAd?.created_time || null,
      gasto: Number(i.spend || 0), impressoes: Number(i.impressions || 0), alcance: Number(i.reach || 0),
      cliques: Number(i.clicks || 0), cliques_link: Number(i.inline_link_clicks || 0), frequencia: Number(i.frequency || 0),
      leads, conversas, compras, valor_compras: valor,
    };
    anuncios.push(linha);
    tot.gasto += linha.gasto; tot.impressoes += linha.impressoes; tot.alcance += linha.alcance;
    tot.cliques += linha.cliques; tot.cliques_link += linha.cliques_link; tot.leads += leads;
    tot.conversas += conversas; tot.compras += compras; tot.valor_compras += valor;
    const s7 = r7.data?.[0] || {};
    recente.gasto += Number(s7.spend || 0);
    recente.resultados += acao(s7.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]) +
      acao(s7.actions, ["onsite_conversion.messaging_conversation_started_7d"]) + acao(s7.actions, ["purchase", "omni_purchase"]);
  }
  const resultados = tot.leads + tot.conversas + tot.compras;
  const m = {
    ...tot,
    ctr: tot.impressoes ? (tot.cliques_link || tot.cliques) / tot.impressoes * 100 : 0,
    cpc: (tot.cliques_link || tot.cliques) ? tot.gasto / (tot.cliques_link || tot.cliques) : 0,
    cpm: tot.impressoes ? tot.gasto / tot.impressoes * 1000 : 0,
    frequencia: tot.alcance ? tot.impressoes / tot.alcance : 0,
    resultados,
    custo_resultado: resultados ? tot.gasto / resultados : null,
    roas: tot.gasto && tot.valor_compras ? tot.valor_compras / tot.gasto : null,
    ultimos_7d: recente,
    anuncios,
  };
  await supabase.from("ads_criativos").update({ metricas: m, metricas_em: new Date().toISOString() }).eq("id", c.id);
  return m;
}
