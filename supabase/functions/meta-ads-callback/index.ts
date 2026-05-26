// meta-ads-callback — recebe o código OAuth do Meta e salva a conexão no banco
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://xrncvhzxjmddqluxoosu.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk";
const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID") ?? "";
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET") ?? "";
const GRAPH_API = "https://graph.facebook.com/v21.0";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/meta-ads-callback`;

const html = (title: string, body: string, ok = true) => new Response(
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#fff}
  .box{text-align:center;padding:40px;max-width:500px}.icon{font-size:64px;margin-bottom:16px}
  h1{color:${ok ? "#22c55e" : "#ef4444"};margin:0 0 12px}p{color:#94a3b8;margin:0 0 8px;line-height:1.6}
  button{background:${ok ? "#22c55e" : "#ef4444"};color:#fff;border:none;padding:12px 28px;border-radius:8px;font-size:16px;cursor:pointer;margin-top:16px}
  </style></head><body><div class="box">
  <div class="icon">${ok ? "✅" : "❌"}</div>
  <h1>${title}</h1>${body}
  <button onclick="window.close()">Fechar</button>
  </div></body></html>`,
  { headers: { "Content-Type": "text/html; charset=utf-8" } }
);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  if (error) {
    return html("Autorização negada", `<p>Meta retornou: ${errorDesc ?? error}</p>`, false);
  }

  if (!code) {
    return html("Parâmetro inválido", "<p>Nenhum código de autorização recebido.</p>", false);
  }

  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    return html("Configuração incompleta", "<p>FACEBOOK_APP_ID ou FACEBOOK_APP_SECRET não configurados.</p>", false);
  }

  try {
    // 1. Troca code por token curto
    const shortRes = await fetch(
      `${GRAPH_API}/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}`
    );
    const shortData = await shortRes.json();
    if (!shortData.access_token) {
      throw new Error(`Token curto falhou: ${JSON.stringify(shortData)}`);
    }

    // 2. Converte para token de longa duração (~60 dias)
    const longRes = await fetch(
      `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&fb_exchange_token=${shortData.access_token}`
    );
    const longData = await longRes.json();
    const token = longData.access_token ?? shortData.access_token;

    // 3. Busca contas de anúncio
    const accRes = await fetch(
      `${GRAPH_API}/me/adaccounts?fields=id,name,account_id,account_status,currency&access_token=${token}`
    );
    const accData = await accRes.json();
    const accounts: Array<{ id: string; name: string; account_id?: string; currency?: string }> = accData.data ?? [];

    if (accounts.length === 0) {
      return html(
        "Nenhuma conta encontrada",
        "<p>Seu usuário não tem contas de anúncios no Meta. Verifique as permissões do app (ads_read, ads_management).</p>",
        false
      );
    }

    // 3b. Busca Instagram Business Account via páginas do Facebook
    let instagramAccountId: string | null = null;
    let instagramUsername: string | null = null;
    try {
      const pagesRes = await fetch(
        `${GRAPH_API}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${token}`
      );
      const pagesData = await pagesRes.json();
      for (const page of (pagesData.data ?? [])) {
        if (page.instagram_business_account?.id) {
          instagramAccountId = page.instagram_business_account.id;
          instagramUsername = page.instagram_business_account.username ?? null;
          break;
        }
      }
    } catch (_e) { /* ignora — Instagram é opcional */ }

    // 4. Salva em unv_meta_ads_accounts (tabela própria dos agentes UNV, sem project_id)
    const saved: string[] = [];
    let lastSaveError = "";

    for (const acc of accounts) {
      const adAccountId = acc.account_id ?? acc.id.replace("act_", "");
      const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/unv_meta_ads_accounts?on_conflict=ad_account_id`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          ad_account_id: adAccountId,
          ad_account_name: acc.name,
          access_token: token,
          is_connected: true,
          instagram_business_account_id: instagramAccountId,
          instagram_username: instagramUsername,
          updated_at: new Date().toISOString(),
        }),
      });

      if (saveRes.ok || saveRes.status === 201) {
        saved.push(acc.name);
      } else {
        const errText = await saveRes.text();
        lastSaveError = `HTTP ${saveRes.status}: ${errText}`;
        console.error("Erro ao salvar conta:", lastSaveError);
      }
    }

    if (saved.length === 0) {
      throw new Error(`Nenhuma conta foi salva. Erro: ${lastSaveError || "desconhecido"}. Contas encontradas: ${accounts.length}`);
    }

    // 5. Dispara sync em background (últimos 30 dias)
    fetch(`${SUPABASE_URL}/functions/v1/meta-ads-sync`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "sync" }),
    }).catch(() => {/* background, ignora erro */});

    return html(
      "Meta Ads conectado!",
      `<p>Conta(s) vinculada(s):<br><strong>${saved.join("<br>")}</strong></p>
       <p>A Luna já está sincronizando suas campanhas.<br>Pode fechar esta janela.</p>`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro no callback:", msg);
    return html("Erro na conexão", `<p>${msg.slice(0, 400)}</p>`, false);
  }
});
