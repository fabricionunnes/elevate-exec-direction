import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Token inválido", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get approval link and card
    const { data: link, error: linkError } = await supabase
      .from("social_approval_links")
      .select(`
        *,
        card:social_content_cards(
          theme,
          content_type,
          creative_url,
          creative_type,
          board_id
        )
      `)
      .eq("access_token", token)
      .single();

    if (linkError || !link) {
      return redirectToApp(token);
    }

    // Get company name
    const { data: board } = await supabase
      .from("social_content_boards")
      .select(`
        project:onboarding_projects(
          product_name,
          company:onboarding_companies(name)
        )
      `)
      .eq("id", link.card.board_id)
      .single();

    const companyName = (board?.project as any)?.company?.name || 
                        (board?.project as any)?.product_name || 
                        "UNV Social";

    const card = link.card;
    const contentTypeLabels: Record<string, string> = {
      feed: "Feed",
      reels: "Reels",
      stories: "Stories",
      carrossel: "Carrossel",
      estatico: "Estático",
    };

    const title = `📋 Aprovação: ${card.theme || "Novo Conteúdo"}`;
    const description = `${contentTypeLabels[card.content_type] || card.content_type} - ${companyName}`;
    
    // Use the creative URL if available, otherwise use a default
    const imageUrl = card.creative_url || "https://elevate-exec-direction.lovable.app/og-image.png";
    
    // For videos, we can't show video preview in OG, so we'll use the first frame or a placeholder
    // Most platforms will still show the video URL as image, or we could generate a thumbnail
    const ogImageUrl = card.creative_type === "video" 
      ? imageUrl // Videos sometimes work as og:image, WhatsApp may show first frame
      : imageUrl;

    const appUrl = `https://elevate-exec-direction.lovable.app/social/approval?token=${token}`;

    // Return HTML with OG meta tags that redirects to the actual app
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
  <meta property="og:image:width" content="1080">
  <meta property="og:image:height" content="${card.content_type === 'feed' ? '1080' : '1920'}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(appUrl)}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">
  
  <!-- WhatsApp specific -->
  <meta property="og:site_name" content="${escapeHtml(companyName)}">
  
  <title>${escapeHtml(title)}</title>
  
  <!-- Redirect to app -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(appUrl)}">
  <script>
    window.location.href = "${appUrl}";
  </script>
</head>
<body>
  <p>Redirecionando para aprovação...</p>
  <p><a href="${escapeHtml(appUrl)}">Clique aqui se não for redirecionado automaticamente</a></p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: new Headers({
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      }),
    });
  } catch (error) {
    console.error("Error:", error);
    return redirectToApp(token);
  }
});

function redirectToApp(token: string): Response {
  const appUrl = `https://elevate-exec-direction.lovable.app/social/approval?token=${token}`;
  return new Response(null, {
    status: 302,
    headers: { Location: appUrl },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
