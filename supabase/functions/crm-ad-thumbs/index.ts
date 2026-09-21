// Miniaturas dos anúncios da Meta com cópia permanente no nosso storage (21/09/2026).
// As URLs de imagem que a Meta devolve são assinadas e expiram em poucos dias, então a tela de ROAS real
// mostrava imagem quebrada. Aqui buscamos a imagem atual do criativo, salvamos no bucket público
// "ad-thumbs" e gravamos o endereço em crm_meta_ad_thumbs (chave = nome do anúncio em maiúsculas).
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const G = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const force = !!body.force;
    const { data: acc } = await supabase.from("crm_meta_ads_accounts").select("access_token").eq("is_connected", true).not("access_token", "is", null).limit(1).maybeSingle();
    if (!acc?.access_token) return json({ ok: false, error: "conta do Meta Ads não conectada" });

    // um ad_id (o mais recente) por nome de anúncio
    const { data: rows } = await supabase.from("crm_meta_ads_ads").select("ad_id, ad_name, date_start")
      .not("ad_name", "is", null).order("date_start", { ascending: false }).limit(3000);
    const porNome = new Map<string, string>();
    for (const r of rows || []) { const k = String(r.ad_name).trim().toUpperCase(); if (k && !porNome.has(k)) porNome.set(k, String(r.ad_id)); }

    const { data: ja } = await supabase.from("crm_meta_ad_thumbs").select("ad_key, updated_at");
    const recentes = new Set((ja || []).filter((x: any) => !force && Date.now() - new Date(x.updated_at).getTime() < 7 * 86400000).map((x: any) => x.ad_key));

    let feitos = 0, falhas = 0; const erros: string[] = [];
    for (const [key, adId] of porNome) {
      if (recentes.has(key)) continue;
      if (feitos + falhas >= 40) break;
      try {
        const r = await fetch(`${G}/${adId}?fields=creative{thumbnail_url,image_url}&thumbnail_width=256&thumbnail_height=256&access_token=${encodeURIComponent(acc.access_token)}`);
        const j = await r.json();
        const src = j?.creative?.image_url || j?.creative?.thumbnail_url;
        if (!src) { falhas++; erros.push(`${key.slice(0, 30)}: sem imagem`); continue; }
        const img = await fetch(src);
        if (!img.ok) { falhas++; erros.push(`${key.slice(0, 30)}: download ${img.status}`); continue; }
        const tipo = img.headers.get("content-type") || "image/jpeg";
        const bytes = new Uint8Array(await img.arrayBuffer());
        const path = `${adId}.${tipo.includes("png") ? "png" : "jpg"}`;
        const up = await supabase.storage.from("ad-thumbs").upload(path, bytes, { contentType: tipo, upsert: true });
        if (up.error) { falhas++; erros.push(`${key.slice(0, 30)}: ${up.error.message}`); continue; }
        const url = `${supabase.storage.from("ad-thumbs").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
        await supabase.from("crm_meta_ad_thumbs").upsert({ ad_key: key, ad_id: adId, url, updated_at: new Date().toISOString() }, { onConflict: "ad_key" });
        feitos++;
      } catch (e) { falhas++; erros.push(`${key.slice(0, 30)}: ${String(e).slice(0, 80)}`); }
    }
    return json({ ok: true, anuncios: porNome.size, atualizados: feitos, falhas, erros: erros.slice(0, 8) });
  } catch (e) { return json({ ok: false, error: String(e) }, 500); }
});
