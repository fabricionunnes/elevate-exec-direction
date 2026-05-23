// meta-ads-callback — recebe o código OAuth do Meta e salva a conexão no banco
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://xrncvhzxjmddqluxoosu.supabase.co";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID") ?? "";
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET") ?? "";
const GRAPH_API = "https://graph.facebook.com/v21.0";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/meta-ads-callback`;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  const html = (title: string, body: string, color = "#22c55e") => new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#fff}
    .box{text-align:center;padding:40px;max-width:480px}.icon{font-size:64px;margin-bottom:16px}
    h1{color:${color};margin:0 0 12px}p{color:#94a3b8;margin:0 0 24px;line-height:1.6}
    .close{background:${color};color:#fff;border:none;padding:12px 28px;border-radius:8px;font-size:16px;cursor:pointer;margin-top:8px}
    </style></head><body><div class="box">
    <div class="icon">${color === "#22c55e" ? "✅" : "❌"}</div>
    <h1>${title}</h1><p>${body}</p>
    <button class="close" onclick="window.close()">Fechar</button>
    </div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

  // Erro de autorização do Meta
  if (error) {
    return html("Autorização negada", `Meta retornou: ${errorDesc ?? error}`, "#ef4444");
  }

  // Sem código — acesso direto sem OAuth
  if (!code) {
    return html("Parâmetro inválido", "Nenhum código de autorização recebido.", "#ef4444");
  }

  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    return html("Configuração incompleta", "FACEBOOK_APP_ID ou FACEBOOK_APP_SECRET não configurados no Supabase.", "#ef4444");
  }

  try {
    // 1. Troca o code por um token de curta duração
    const shortTokenRes = await fetch(
      `${GRAPH_API}/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}`
    );
    const shortTokenData = await shortTokenRes.json();
    if (!shortTokenData.access_token) {
      throw new Error(`Falha ao obter token: ${JSON.stringify(shortTokenData)}`);
    }

    // 2. Converte para token de longa duração (~60 dias)
    const longTokenRes = await fetch(
      `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&fb_exchange_token=${shortTokenData.access_token}`
    );
    const longTokenData = await longTokenRes.json();
    const longToken = longTokenData.access_token ?? shortTokenData.access_token;

    // 3. Busca as contas de anúncio disponíveis
    const accountsRes = await fetch(
      `${GRAPH_API}/me/adaccounts?fields=id,name,account_id,account_status,currency&access_token=${longToken}`
    );
    const accountsData = await accountsRes.json();
    const accounts: Array<{ id: string; name: string; account_id: string; currency: string }> =
      accountsData.data ?? [];

    if (accounts.length === 0) {
      return html(
        "Nenhuma conta encontrada",
        "Seu usuário não tem acesso a contas de anúncios no Meta. Verifique as permissões do app (ads_read, ads_management).",
        "#f59e0b"
      );
    }

    // 4. Salva a primeira conta (ou todas) no banco via meta-ads-sync
    const saved: string[] = [];
    for (const acc of accounts) {
      const saveRes = await fetch(`${SUPABASE_URL}/functions/v1/meta-ads-sync`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "save_connection",
          ad_account_id: acc.account_id ?? acc.id.replace("act_", ""),
          ad_account_name: acc.name,
          access_token: longToken,
        }),
      });
      if (saveRes.ok) saved.push(acc.name);
    }

    // 5. Dispara sync imediato dos últimos 30 dias
    await fetch(`${SUPABASE_URL}/functions/v1/meta-ads-sync`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "sync" }),
    }).catch(() => {/* sync em background, ignora erro */});

    return html(
      "Meta Ads conectado!",
      `Conta(s) conectada(s): <strong>${saved.join(", ")}</strong><br><br>Luna já pode analisar suas campanhas. Pode fechar esta janela.`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return html("Erro na conexão", `Detalhes: ${msg.slice(0, 300)}`, "#ef4444");
  }
});
