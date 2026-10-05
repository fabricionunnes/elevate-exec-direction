// painel-resumo-semanal — toda segunda de manhã o Marcelo manda pro Fabrício um
// resumo curto do Painel de Controle: caixa, vendas contra a meta, agenda da
// semana, dependência do fundador, saldo do Meta e o que pede decisão.
//
// Por quê: o painel responde tudo, mas só pra quem abre. O resumo leva o
// essencial pra onde ele já está (WhatsApp), no começo da semana, que é quando dá
// pra mudar alguma coisa.
//
// Os números vêm de painel_resumo_semanal_interno() (o mesmo miolo do painel,
// execute só pra service_role). Aqui só se monta o texto e se envia.
//
// Quem pode chamar: o cron (header x-painel-resumo-secret) ou o staff master
// logado. Corpo: { dry_run: true } devolve o texto sem enviar.
// Deploy manual (fora do CI): python3 /tmp/deploy_fn.py <ref> painel-resumo-semanal <este arquivo>
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("PAINEL_RESUMO_SECRET") || "";
const LIMITE = 1200; // caracteres: cabe numa tela de celular sem "ler mais"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-painel-resumo-secret",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

/** "R$ 15,7 mil", "R$ 1,2 mi", "R$ 850", com o sinal na frente */
function brl(v: unknown): string {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return "sem dado";
  const s = n < 0 ? "-" : "", a = Math.abs(n);
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toFixed(1).replace(".", ",")} mi`;
  if (a >= 1000) return `${s}R$ ${(a / 1000).toFixed(1).replace(".", ",").replace(",0", "")} mil`;
  return `${s}R$ ${Math.round(a).toLocaleString("pt-BR")}`;
}
const pct = (v: unknown): string => (v == null || !Number.isFinite(Number(v)) ? "sem dado" : `${Math.round(Number(v) * 100)}%`);
const ddmm = (iso: unknown): string => { const s = String(iso || ""); return s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "-"; };
const dec = (v: unknown): string => String(Math.round(Number(v) * 10) / 10).replace(".", ",");
const pl = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

// deno-lint-ignore no-explicit-any
function montarTexto(d: any, maxAlertas = 5): string {
  const L: string[] = [];
  const cx = d.caixa || {}, r = cx.realista || {}, sem = cx.semana || {};
  const rit = d.ritmo || {}, du = rit.dias_uteis || {}, meta = rit.meta || {};
  const reu = d.reunioes || {}, fun = d.fundador || {}, ads = d.meta_ads || {}, sp = d.semana_passada || {};

  L.push("Fabrício, resumo pra começar a semana.");

  // caixa
  const neg = r.primeiro_negativo;
  const negTxt = !neg ? "Não fica negativo nos próximos 90 dias." : neg === d.hoje ? "Já não cobre as contas de hoje." : `Fica negativo em ${ddmm(neg)}.`;
  L.push(`Caixa: ${brl(cx.saldo)} hoje. Em 30 dias, no cenário realista, ${brl(r.em30)}. ${negTxt} Essa semana entram ${brl(sem.entra_r)} e saem ${brl(sem.sai)}. Venda nova não está na conta.`);

  // vendas
  const vp = Number(sp.vendas || 0);
  const semPassada = vp ? `semana passada ${vp === 1 ? "foi" : "foram"} ${pl(vp, "venda", "vendas")}, ${brl(sp.receita)}.` : "semana passada não teve venda fechada.";
  const semMeta = (meta.sem_meta || []).length;
  const donoMeta = semMeta && (meta.com_meta || []).length ? ` (só ${(meta.com_meta as { nome: string }[]).map((x) => x.nome.split(" ")[0]).join(" e ")})` : "";
  const mes = meta.meta == null
    ? `No mês, ${brl(rit.vendido)} vendidos. Não tem meta de vendas cadastrada no CRM.`
    : `No mês, ${brl(rit.vendido)} de ${brl(meta.meta)} da meta${donoMeta}, ${pct(rit.pct_meta)}, com ${pct(du.pct_tempo)} dos dias úteis.${du.restantes > 0 && rit.projecao != null ? ` No ritmo atual fecha em ${brl(rit.projecao)}.` : ""}`;
  L.push(`Vendas: ${semPassada} ${mes}`);

  // agenda
  const prox7 = Number(reu.prox7 || 0), seguinte = Number(reu.prox14 || 0) - prox7;
  L.push(`Agenda: ${pl(prox7, "reunião marcada", "reuniões marcadas")} pros próximos 7 dias (média de ${dec(reu.media_semanal)} por semana). ${seguinte === 0 ? "A semana seguinte ainda está vazia." : `Mais ${seguinte} na semana seguinte.`}`);

  // fundador
  if (fun.pct_receita != null) {
    const ant = fun.pct_receita_anterior != null ? ` Mês passado foi ${pct(fun.pct_receita_anterior)}.` : "";
    L.push(`Dependência do fundador: ${pct(fun.pct_receita)} da receita nova do mês passou pela sua mão.${ant}`);
  }

  // meta ads
  if (!ads.conectada) L.push("Meta Ads: nenhuma conta conectada.");
  else if (ads.nivel_saldo === "zerado") L.push(`Meta Ads: saldo zerado, sem entrega desde ${ddmm(ads.ultimo_dia_com_gasto)}.`);
  else if (ads.saldo != null && ads.pre_paga !== false) L.push(`Meta Ads: saldo de ${brl(ads.saldo)}${ads.dias_de_saldo != null ? `, dá pra ${dec(ads.dias_de_saldo)} dias` : ""}.`);

  // o que pede decisão: os mais graves, sem repetir o que já foi dito acima
  // deno-lint-ignore no-explicit-any
  const al = ((d.alertas || []) as any[]).filter((a) => !/^Caixa fica negativo|^Saldo do Meta Ads|^Semana que vem/.test(String(a.titulo))).slice(0, maxAlertas);
  if (al.length) L.push(`Pede decisão:\n${al.map((a, i) => `${i + 1}. ${a.titulo}`).join("\n")}`);

  L.push("O detalhe de cada número está no Painel de Controle do Nexus.");
  return L.join("\n\n");
}

/** monta o texto e, se passar do limite, vai tirando alerta do fim até caber */
// deno-lint-ignore no-explicit-any
function textoNoLimite(d: any): string {
  for (let n = 5; n >= 0; n--) {
    const t = montarTexto(d, n);
    if (t.length <= LIMITE || n === 0) return t;
  }
  return montarTexto(d, 0);
}

// deno-lint-ignore no-explicit-any
async function enviarWhatsApp(supabase: any, phone: string, text: string): Promise<{ ok: boolean; via?: string }> {
  // sai pelo número do Marcelo; se ele estiver desconectado, pelo do Fabrício (mesmo padrão dos outros avisos)
  for (const nome of ["marceloalmeida", "fabricionunnes"]) {
    try {
      const { data: inst } = await supabase.from("whatsapp_instances").select("instance_name, api_url, api_key, provider_type")
        .eq("instance_name", nome).eq("status", "connected").maybeSingle();
      if (!inst?.api_url || !inst?.api_key) continue;
      let host = ""; try { host = new URL(inst.api_url).hostname.toLowerCase(); } catch { /* noop */ }
      const v2 = inst.provider_type === "manager_v2" || host.endsWith(".stevo.chat");
      const url = v2 ? `${inst.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "")}/send/text` : `${inst.api_url.replace(/\/+$/g, "")}/message/sendText/${inst.instance_name}`;
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", apikey: inst.api_key }, body: JSON.stringify({ number: phone, text }), signal: AbortSignal.timeout(20000) });
      if (r.ok) return { ok: true, via: nome };
    } catch (e) { console.error("[painel-resumo-semanal] whatsapp", nome, String(e)); }
  }
  return { ok: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // autorização: segredo do cron ou o staff master logado (o painel é só dele)
    const viaSegredo = SECRET && req.headers.get("x-painel-resumo-secret") === SECRET;
    if (!viaSegredo) {
      const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      // deno-lint-ignore no-explicit-any
      const { data: u } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } as any };
      if (!u?.user) return json({ ok: false, error: "não autorizado" }, 401);
      const { data: staff } = await supabase.from("onboarding_staff").select("role, is_active, tenant_id").eq("user_id", u.user.id).eq("is_active", true);
      // deno-lint-ignore no-explicit-any
      if (!(staff || []).some((s: any) => s.role === "master" && s.tenant_id == null)) return json({ ok: false, error: "não autorizado" }, 403);
    }

    const opc = await req.json().catch(() => ({} as Record<string, unknown>));
    const dry = opc.dry_run === true;

    const { data: dados, error } = await supabase.rpc("painel_resumo_semanal_interno");
    if (error || !dados) return json({ ok: false, error: `não consegui ler o painel: ${error?.message || "vazio"}` }, 500);

    const texto = textoNoLimite(dados);
    if (dry) return json({ ok: true, dry_run: true, caracteres: texto.length, texto });

    const { data: cfg } = await supabase.from("ai_usage_config").select("telefone").eq("id", true).maybeSingle();
    const telefone = String(cfg?.telefone || "").replace(/\D/g, "");
    if (!telefone) return json({ ok: false, error: "sem telefone em ai_usage_config", texto }, 500);

    const env = await enviarWhatsApp(supabase, telefone, texto);
    return json({ ok: env.ok, enviado: env.ok, via: env.via || null, caracteres: texto.length, texto, ...(env.ok ? {} : { error: "nenhum número de WhatsApp conectado pra enviar" }) }, env.ok ? 200 : 502);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e).slice(0, 300) }, 500);
  }
});
