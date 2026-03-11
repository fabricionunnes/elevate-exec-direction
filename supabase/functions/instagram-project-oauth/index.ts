import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID");
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    console.log("Instagram Project OAuth - Action:", action);

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      throw new Error("Facebook App credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // ──────── auth_url ────────
    if (action === "auth_url") {
      const { projectId, redirectUri } = body;
      if (!projectId || !redirectUri) throw new Error("projectId and redirectUri are required");

      const scopes = [
        "instagram_basic",
        "instagram_manage_insights",
        "pages_show_list",
        "pages_read_engagement",
        "business_management",
      ].join(",");

      const state = btoa(JSON.stringify({ projectId, redirectUri }));
      const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&response_type=code`;

      return new Response(JSON.stringify({ authUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ──────── callback ────────
    if (action === "callback") {
      const { code, redirectUri, projectId } = body;
      if (!code || !redirectUri || !projectId) throw new Error("code, redirectUri and projectId are required");

      // Exchange code for access token
      const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();
      if (tokenData.error) throw new Error(tokenData.error.message);

      const shortToken = tokenData.access_token;

      // Exchange for long-lived token
      const longTokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&fb_exchange_token=${shortToken}`;
      const longRes = await fetch(longTokenUrl);
      const longData = await longRes.json();
      const longToken = longData.access_token || shortToken;
      const expiresIn = longData.expires_in || 5184000;

      // Get pages
      const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${longToken}`);
      const pagesData = await pagesRes.json();
      const pages = pagesData.data || [];
      if (pages.length === 0) throw new Error("Nenhuma página do Facebook encontrada. Verifique se sua conta Instagram está vinculada a uma página.");

      // Find Instagram account linked to page
      let igAccount = null;
      let pageToken = null;
      for (const page of pages) {
        const igRes = await fetch(`https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
        const igData = await igRes.json();
        if (igData.instagram_business_account) {
          igAccount = igData.instagram_business_account;
          pageToken = page.access_token;
          break;
        }
      }

      if (!igAccount || !pageToken) throw new Error("Nenhuma conta Instagram Business encontrada vinculada às suas páginas.");

      // Get Instagram profile info
      const profileRes = await fetch(`https://graph.facebook.com/v21.0/${igAccount.id}?fields=username,name,profile_picture_url,biography,website,followers_count,follows_count,media_count&access_token=${pageToken}`);
      const profile = await profileRes.json();

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Upsert account
      const { data: savedAccount, error: saveError } = await supabase
        .from("instagram_accounts")
        .upsert({
          project_id: projectId,
          instagram_user_id: igAccount.id,
          username: profile.username || "unknown",
          full_name: profile.name || null,
          profile_picture_url: profile.profile_picture_url || null,
          bio: profile.biography || null,
          website: profile.website || null,
          followers_count: profile.followers_count || 0,
          following_count: profile.follows_count || 0,
          media_count: profile.media_count || 0,
          access_token: pageToken,
          token_expires_at: expiresAt,
          status: "connected",
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "project_id,instagram_user_id" })
        .select("id")
        .single();

      if (saveError) throw saveError;

      return new Response(JSON.stringify({ success: true, accountId: savedAccount.id, username: profile.username }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────── sync ────────
    if (action === "sync") {
      const { accountId } = body;
      if (!accountId) throw new Error("accountId is required");

      const { data: account, error: accErr } = await supabase
        .from("instagram_accounts")
        .select("*")
        .eq("id", accountId)
        .single();
      if (accErr || !account) throw new Error("Account not found");

      // Create sync log
      const { data: syncLog } = await supabase
        .from("instagram_sync_logs")
        .insert({ account_id: accountId, sync_type: "full", status: "running" })
        .select("id")
        .single();

      try {
        const token = account.access_token;
        const igId = account.instagram_user_id;

        // Update profile info
        const profileRes = await fetch(`https://graph.facebook.com/v21.0/${igId}?fields=username,name,profile_picture_url,biography,website,followers_count,follows_count,media_count&access_token=${token}`);
        const profile = await profileRes.json();

        await supabase.from("instagram_accounts").update({
          username: profile.username || account.username,
          full_name: profile.name,
          profile_picture_url: profile.profile_picture_url,
          bio: profile.biography,
          followers_count: profile.followers_count || 0,
          following_count: profile.follows_count || 0,
          media_count: profile.media_count || 0,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", accountId);

        // Fetch recent media with engagement fields
        const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=50&access_token=${token}`);
        const mediaData = await mediaRes.json();
        const mediaItems = mediaData.data || [];

        let postsSynced = 0;
        let metricsSynced = 0;

        for (const item of mediaItems) {
          const postType = item.media_type === "VIDEO" ? "reels" : item.media_type === "CAROUSEL_ALBUM" ? "carousel" : "feed";

          const { data: savedPost } = await supabase
            .from("instagram_posts")
            .upsert({
              account_id: accountId,
              instagram_post_id: item.id,
              post_type: postType,
              caption: item.caption || null,
              media_url: item.media_url || null,
              thumbnail_url: item.thumbnail_url || null,
              permalink: item.permalink || null,
              posted_at: item.timestamp || null,
              updated_at: new Date().toISOString(),
            }, { onConflict: "instagram_post_id" })
            .select("id")
            .single();

          if (savedPost) {
            postsSynced++;

            // Get likes and comments from the media object itself
            const likesCount = item.like_count || 0;
            const commentsCount = item.comments_count || 0;

            // Fetch insights - v22.0+ compatible metrics
            let reachVal = 0, impressionsVal = 0, savedVal = 0, sharesVal = 0;
            try {
              // impressions/plays deprecated after Apr 2025. Use reach,saved,shares,views
              const insightMetrics = "reach,saved,shares,views";

              const insightsRes = await fetch(`https://graph.facebook.com/v21.0/${item.id}/insights?metric=${insightMetrics}&access_token=${token}`);
              const insightsData = await insightsRes.json();

              if (insightsData.data) {
                for (const m of insightsData.data) {
                  if (m.name === "reach") reachVal = m.values?.[0]?.value || 0;
                  if (m.name === "views") impressionsVal = m.values?.[0]?.value || 0;
                  if (m.name === "saved") savedVal = m.values?.[0]?.value || 0;
                  if (m.name === "shares") sharesVal = m.values?.[0]?.value || 0;
                }
              } else if (insightsData.error) {
                console.log(`Insights API error for ${item.id}: ${insightsData.error.message}`);
              }
            } catch (e) {
              console.log(`Could not fetch insights for post ${item.id}:`, e);
            }

            const totalEngagement = likesCount + commentsCount + sharesVal + savedVal;
            const engRate = profile.followers_count > 0 ? (totalEngagement / profile.followers_count) * 100 : 0;
            const reachRate = profile.followers_count > 0 ? (reachVal / profile.followers_count) * 100 : 0;

            await supabase.from("instagram_post_metrics").upsert({
              post_id: savedPost.id,
              reach: reachVal,
              impressions: impressionsVal,
              likes: likesCount,
              comments: commentsCount,
              shares: sharesVal,
              saves: savedVal,
              profile_visits: 0,
              link_clicks: 0,
              engagement_rate: engRate,
              reach_rate: reachRate,
              recorded_at: new Date().toISOString(),
            }, { onConflict: "post_id" });

            metricsSynced++;
          }
        }

        // Create daily account metrics snapshot
        const today = new Date().toISOString().split("T")[0];
        
        // Calculate averages from post metrics
        const { data: allPostMetrics } = await supabase
          .from("instagram_post_metrics")
          .select("likes, comments, shares, saves, reach, impressions")
          .in("post_id", (await supabase.from("instagram_posts").select("id").eq("account_id", accountId)).data?.map((p: any) => p.id) || []);

        let avgLikes = 0, avgComments = 0, avgShares = 0, avgSaves = 0, totalReach = 0, totalImpressions = 0, totalEngagement = 0;
        if (allPostMetrics && allPostMetrics.length > 0) {
          avgLikes = allPostMetrics.reduce((s: number, m: any) => s + m.likes, 0) / allPostMetrics.length;
          avgComments = allPostMetrics.reduce((s: number, m: any) => s + m.comments, 0) / allPostMetrics.length;
          avgShares = allPostMetrics.reduce((s: number, m: any) => s + m.shares, 0) / allPostMetrics.length;
          avgSaves = allPostMetrics.reduce((s: number, m: any) => s + m.saves, 0) / allPostMetrics.length;
          totalReach = allPostMetrics.reduce((s: number, m: any) => s + m.reach, 0);
          totalImpressions = allPostMetrics.reduce((s: number, m: any) => s + m.impressions, 0);
          totalEngagement = allPostMetrics.reduce((s: number, m: any) => s + m.likes + m.comments + m.shares + m.saves, 0);
        }

        // Calculate profile score (0-100)
        const consistencyScore = Math.min((profile.media_count || 0) / 3, 25);
        const engagementScore = Math.min((avgLikes + avgComments) / 20, 25);
        const growthScore = Math.min((profile.followers_count || 0) / 400, 25);
        const reachScore = Math.min(totalReach / 5000, 25);
        const profileScore = Math.round(consistencyScore + engagementScore + growthScore + reachScore);

        await supabase.from("instagram_account_metrics").upsert({
          account_id: accountId,
          followers_count: profile.followers_count || 0,
          following_count: profile.follows_count || 0,
          media_count: profile.media_count || 0,
          total_reach: totalReach,
          total_impressions: totalImpressions,
          total_engagement: totalEngagement,
          avg_likes: avgLikes,
          avg_comments: avgComments,
          avg_shares: avgShares,
          avg_saves: avgSaves,
          profile_score: profileScore,
          recorded_date: today,
        }, { onConflict: "account_id,recorded_date" });

        // Update sync log
        await supabase.from("instagram_sync_logs").update({
          status: "completed",
          posts_synced: postsSynced,
          metrics_synced: metricsSynced,
          completed_at: new Date().toISOString(),
        }).eq("id", syncLog?.id);

      } catch (syncError: any) {
        await supabase.from("instagram_sync_logs").update({
          status: "failed",
          error_message: syncError.message,
          completed_at: new Date().toISOString(),
        }).eq("id", syncLog?.id);
        throw syncError;
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ──────── generate_insights ────────
    if (action === "generate_insights") {
      const { accountId, projectId } = body;
      if (!accountId) throw new Error("accountId is required");

      // Fetch account and recent metrics
      const { data: account } = await supabase.from("instagram_accounts").select("*").eq("id", accountId).single();
      
      // Get post IDs for this account
      const { data: postIds } = await supabase.from("instagram_posts").select("id").eq("account_id", accountId).limit(30);
      const ids = postIds?.map((p: any) => p.id) || [];

      let recentMetrics: any[] = [];
      if (ids.length > 0) {
        const { data } = await supabase.from("instagram_post_metrics")
          .select("*, post:instagram_posts(*)")
          .in("post_id", ids)
          .order("recorded_at", { ascending: false });
        recentMetrics = data || [];
      }

      if (recentMetrics.length === 0) {
        // No metrics yet - trigger a sync first, then return a message
        return new Response(JSON.stringify({ success: false, error: "Nenhuma métrica encontrada. Clique em 'Sincronizar' na Visão Geral primeiro para puxar os dados do Instagram." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Generate basic insights from data patterns
      const insights: any[] = [];
      
      // Best post type
      const typeMetrics: Record<string, { total: number; count: number }> = {};
      for (const m of recentMetrics) {
        const type = (m.post as any)?.post_type || "feed";
        if (!typeMetrics[type]) typeMetrics[type] = { total: 0, count: 0 };
        typeMetrics[type].total += m.likes + m.comments + m.shares + m.saves;
        typeMetrics[type].count++;
      }

      const bestType = Object.entries(typeMetrics).sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))[0];
      if (bestType) {
        const typeLabels: Record<string, string> = { feed: "Feed", reels: "Reels", carousel: "Carrossel" };
        insights.push({
          account_id: accountId,
          insight_type: "best_format",
          title: `${typeLabels[bestType[0]] || bestType[0]} gera mais engajamento`,
          description: `Posts em formato ${typeLabels[bestType[0]] || bestType[0]} geram em média ${Math.round(bestType[1].total / bestType[1].count)} interações por publicação, superando os demais formatos.`,
          priority: "high",
          generated_at: new Date().toISOString(),
        });
      }

      // Best performing post
      const topPost = recentMetrics.sort((a: any, b: any) => (b.likes + b.comments) - (a.likes + a.comments))[0];
      if (topPost) {
        insights.push({
          account_id: accountId,
          insight_type: "top_post",
          title: "Post com melhor desempenho",
          description: `O post com ${topPost.likes} curtidas e ${topPost.comments} comentários foi o mais engajado. Analise o conteúdo para replicar o sucesso.`,
          priority: "medium",
          generated_at: new Date().toISOString(),
        });
      }

      // Saves analysis
      const avgSaves = recentMetrics.reduce((s: number, m: any) => s + m.saves, 0) / recentMetrics.length;
      insights.push({
        account_id: accountId,
        insight_type: "saves_analysis",
        title: avgSaves > 10 ? "Ótima taxa de salvamentos" : "Salvamentos precisam de atenção",
        description: avgSaves > 10
          ? `Média de ${avgSaves.toFixed(0)} salvamentos por post indica conteúdo de valor. Continue investindo em posts educativos.`
          : `Média de ${avgSaves.toFixed(0)} salvamentos por post. Invista em conteúdo educativo e dicas práticas para aumentar os salvamentos.`,
        priority: avgSaves > 10 ? "low" : "high",
        generated_at: new Date().toISOString(),
      });

      // Insert insights
      if (insights.length > 0) {
        await supabase.from("instagram_insights_ai").insert(insights);
      }

      return new Response(JSON.stringify({ success: true, count: insights.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ──────── generate_suggestions ────────
    if (action === "generate_suggestions") {
      const { accountId } = body;
      if (!accountId) throw new Error("accountId is required");

      const suggestions = [
        { account_id: accountId, suggestion_type: "educativo", theme: "Dicas práticas do seu nicho", format: "Carrossel", objective: "Aumentar salvamentos", cta: "Salve para consultar depois!", visual_style: "Clean com ícones", description: "Posts educativos geram mais salvamentos e aumentam a autoridade do perfil.", generated_at: new Date().toISOString() },
        { account_id: accountId, suggestion_type: "autoridade", theme: "Case de sucesso ou resultado", format: "Reels", objective: "Gerar credibilidade", cta: "Quer resultados assim? Link na bio", visual_style: "Antes e depois", description: "Mostrar resultados concretos aumenta a confiança e gera leads qualificados.", generated_at: new Date().toISOString() },
        { account_id: accountId, suggestion_type: "prova_social", theme: "Depoimento de cliente", format: "Stories + Feed", objective: "Converter seguidores em clientes", cta: "Você também pode! Fale conosco", visual_style: "Print de conversa ou vídeo", description: "Depoimentos reais são o melhor gatilho de conversão nas redes sociais.", generated_at: new Date().toISOString() },
        { account_id: accountId, suggestion_type: "viral", theme: "Trend ou meme do momento", format: "Reels", objective: "Aumentar alcance e seguidores", cta: "Marque alguém que precisa ver isso!", visual_style: "Dinâmico com texto na tela", description: "Reels com trends atuais têm maior chance de viralização e alcance orgânico.", generated_at: new Date().toISOString() },
        { account_id: accountId, suggestion_type: "conversao", theme: "Oferta ou lançamento", format: "Feed + Stories", objective: "Gerar vendas diretas", cta: "Aproveite agora! Link na bio", visual_style: "Profissional com destaque no CTA", description: "Posts de conversão devem ser diretos e ter uma oferta clara com urgência.", generated_at: new Date().toISOString() },
      ];

      await supabase.from("instagram_content_suggestions").insert(suggestions);

      return new Response(JSON.stringify({ success: true, count: suggestions.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ──────── generate_report ────────
    if (action === "generate_report") {
      const { accountId } = body;
      if (!accountId) throw new Error("accountId is required");

      const now = new Date();
      const periodEnd = now.toISOString().split("T")[0];
      const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { data: account } = await supabase.from("instagram_accounts").select("*").eq("id", accountId).single();
      const { data: metrics } = await supabase.from("instagram_account_metrics").select("*").eq("account_id", accountId).gte("recorded_date", periodStart).order("recorded_date");
      const { data: topPosts } = await supabase.from("instagram_posts").select("*, metrics:instagram_post_metrics(*)").eq("account_id", accountId).order("posted_at", { ascending: false }).limit(10);

      await supabase.from("instagram_reports").insert({
        account_id: accountId,
        title: `Relatório Mensal - ${now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
        report_type: "monthly",
        period_start: periodStart,
        period_end: periodEnd,
        data: { account, metrics, topPosts },
      });

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    console.error("Instagram Project OAuth Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
