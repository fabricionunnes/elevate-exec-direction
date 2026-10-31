// Meta Ads pelo Max: gera a imagem (OpenAI gpt-image-1), sobe na conta de anúncios da
// UNV e cria campanha → conjunto → criativo → anúncio, tudo PAUSADO. Ativar/pausar é
// outra chamada. Regras da casa: público, posicionamento e orçamento manuais; sem
// Advantage+ (advantage_audience = 0, standard enhancements OPT_OUT).
import { SupabaseClient } from "@supabase/supabase-js";

const GRAPH = "https://graph.facebook.com/v21.0";

export type ContaMeta = { ad_account_id: string; access_token: string; page_id: string; ig_actor_id: string | null; nome: string };

async function tokenValido(token: string): Promise<boolean> {
  try {
    const r = await fetch(`${GRAPH}/me?fields=id&access_token=${encodeURIComponent(token)}`);
    return r.ok;
  } catch { return false; }
}

/** Conta de anúncios principal da UNV + página do Facebook da UNV.
 * Prefere o token do CRM (crm_meta_ads_accounts, tenant null), que é o que sincroniza
 * as campanhas todo dia; cai pro unv_meta_ads_accounts se o do CRM não valer. */
export async function contaMetaUNV(supabase: SupabaseClient): Promise<ContaMeta> {
  let acc: any = null;
  const { data: crm } = await supabase.from("crm_meta_ads_accounts")
    .select("ad_account_id, ad_account_name, access_token")
    .is("tenant_id", null).eq("is_connected", true).order("last_synced_at", { ascending: false }).limit(3);
  for (const a of (crm || []) as any[]) if (a.access_token && await tokenValido(a.access_token)) { acc = a; break; }
  if (!acc) {
    const { data: unv } = await supabase.from("unv_meta_ads_accounts")
      .select("ad_account_id, ad_account_name, access_token, instagram_business_account_id")
      .eq("is_connected", true).order("is_primary", { ascending: false }).order("updated_at", { ascending: false }).limit(3);
    for (const a of (unv || []) as any[]) if (a.access_token && await tokenValido(a.access_token)) { acc = a; break; }
  }
  if (!acc?.access_token) throw new Error("nenhum token válido da conta Meta da UNV no Nexus: reconecte a conta em Tráfego pago ou no CRM (Meta Ads)");
  // no CRM o id vem com o prefixo act_; a Graph API quer só o número
  const adAccountId = String(acc.ad_account_id).replace(/^act_/, "");

  // página anunciante: AI_TEAM_META_PAGE_ID manda; senão a página "Universidade Vendas" do token;
  // senão a página ligada ao @universidadevendas no Nexus
  let pageId = Deno.env.get("AI_TEAM_META_PAGE_ID") || "";
  if (!pageId) {
    try {
      const r = await fetch(`${GRAPH}/me/accounts?fields=name,id&limit=100&access_token=${encodeURIComponent(acc.access_token)}`);
      const pages = ((await r.json())?.data || []) as { name: string; id: string }[];
      const alvo = pages.find((p) => /universidade\s*(de\s*)?vendas/i.test(p.name)) || pages.find((p) => /unv/i.test(p.name));
      if (alvo) pageId = alvo.id;
    } catch { /* cai pro Nexus */ }
  }
  if (!pageId) {
    const { data: perfil } = await supabase.from("unv_instagram_profiles")
      .select("facebook_page_id").eq("instagram_username", "universidadevendas").eq("is_active", true).maybeSingle();
    pageId = perfil?.facebook_page_id || "";
  }
  if (!pageId) throw new Error("página do Facebook da UNV não encontrada (defina AI_TEAM_META_PAGE_ID)");
  // instagram_actor_id só se for informado: o IG gravado no Nexus pra essa conta não é o @universidadevendas
  return { ad_account_id: adAccountId, access_token: acc.access_token, page_id: String(pageId), ig_actor_id: Deno.env.get("AI_TEAM_META_IG_ID") || null, nome: acc.ad_account_name };
}

async function graph(path: string, token: string, body: Record<string, unknown>): Promise<any> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) form.set(k, typeof v === "string" ? v : JSON.stringify(v));
  form.set("access_token", token);
  const r = await fetch(`${GRAPH}/${path}`, { method: "POST", body: form });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.error) {
    const e = data?.error || {};
    throw new Error(`Meta ${path}: ${e.error_user_msg || e.message || r.status}${e.error_subcode ? ` (${e.error_subcode})` : ""}`);
  }
  return data;
}

/** Imagem do anúncio: fotográfica, paleta navy da UNV, sem texto (o texto vai na copy). */
export async function gerarImagem(briefing: string): Promise<string> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY não configurada (imagem)");
  const prompt = `Fotografia publicitária realista para anúncio no Instagram de uma consultoria de gestão comercial brasileira. Cena: ${briefing}. Pessoas brasileiras, ambiente de empresa de pequeno ou médio porte, luz natural, expressão séria e confiante, composição limpa com espaço vazio em um dos lados. Paleta dominante azul-marinho escuro (#0D2B5E) com toques discretos de vermelho (#CC1B1B) em objetos ou roupa. SEM texto, SEM letras, SEM logotipo, SEM marca d'água, SEM gráficos flutuantes. Estilo de foto de agência, nada de aparência de imagem gerada por IA, nada de brilho exagerado.`;
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "medium", output_format: "png", n: 1 }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`imagem: ${data?.error?.message || r.status}`);
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("imagem: resposta sem conteúdo");
  return b64;
}

export type NovoAnuncio = {
  nome: string; headline: string; texto: string; link: string; cta: string; // LEARN_MORE | SIGN_UP | CONTACT_US | GET_QUOTE
  orcamentoDiario: number; idadeMin: number; idadeMax: number; generos?: number[]; // 1 homem, 2 mulher
  imagemBriefing: string;
};

export async function criarAnuncioPausado(conta: ContaMeta, a: NovoAnuncio): Promise<{ campaign_id: string; adset_id: string; creative_id: string; ad_id: string; image_hash: string }> {
  const act = `act_${conta.ad_account_id}`;
  const tok = conta.access_token;

  // 1. imagem
  const b64 = await gerarImagem(a.imagemBriefing);
  const img = await graph(`${act}/adimages`, tok, { bytes: b64 });
  const image_hash = Object.values(img?.images || {}).map((v: any) => v.hash)[0];
  if (!image_hash) throw new Error("Meta não devolveu o hash da imagem");

  // 2. campanha (pausada)
  const camp = await graph(`${act}/campaigns`, tok, {
    name: a.nome, objective: "OUTCOME_TRAFFIC", status: "PAUSED", special_ad_categories: [],
  });

  // 3. conjunto: Brasil, idade, posicionamentos manuais, sem Advantage+ audience
  const targeting: Record<string, unknown> = {
    geo_locations: { countries: ["BR"] },
    age_min: Math.max(18, a.idadeMin || 25), age_max: Math.min(65, a.idadeMax || 60),
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["feed"],
    instagram_positions: ["stream", "story", "reels"],
    targeting_automation: { advantage_audience: 0 },
  };
  if (a.generos?.length) targeting.genders = a.generos;
  const adset = await graph(`${act}/adsets`, tok, {
    name: `${a.nome} · conjunto`, campaign_id: camp.id, status: "PAUSED",
    daily_budget: Math.round(Math.max(10, a.orcamentoDiario) * 100),
    billing_event: "IMPRESSIONS", optimization_goal: "LINK_CLICKS", bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting,
  });

  // 4. criativo (sem "melhorias" automáticas da Meta)
  const story: Record<string, unknown> = {
    page_id: conta.page_id,
    link_data: { image_hash, link: a.link, message: a.texto, name: a.headline, call_to_action: { type: a.cta || "LEARN_MORE", value: { link: a.link } } },
  };
  if (conta.ig_actor_id) story.instagram_actor_id = conta.ig_actor_id;
  const creative = await graph(`${act}/adcreatives`, tok, {
    name: `${a.nome} · criativo`, object_story_spec: story,
    degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: "OPT_OUT" } } },
  });

  // 5. anúncio (pausado)
  const ad = await graph(`${act}/ads`, tok, { name: a.nome, adset_id: adset.id, creative: { creative_id: creative.id }, status: "PAUSED" });

  return { campaign_id: String(camp.id), adset_id: String(adset.id), creative_id: String(creative.id), ad_id: String(ad.id), image_hash: String(image_hash) };
}

/** Liga ou pausa campanha, conjunto e anúncio de uma vez. */
export async function mudarStatus(conta: ContaMeta, ids: { campaign_id: string; adset_id?: string | null; ad_id?: string | null }, status: "ACTIVE" | "PAUSED"): Promise<void> {
  for (const id of [ids.ad_id, ids.adset_id, ids.campaign_id]) if (id) await graph(String(id), conta.access_token, { status });
}

export const linkGerenciador = (adAccountId: string, campaignId: string) =>
  `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${adAccountId}&selected_campaign_ids=${campaignId}`;
