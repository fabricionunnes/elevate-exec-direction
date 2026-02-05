import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Accept token from either JSON body (recommended) or query string (fallback)
    const queryToken = url.searchParams.get("token") || url.searchParams.get("access_token");
    const body = await readJsonBodySafe(req);
    const token = queryToken || body?.token;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get approval link and card
    const { data: link, error: linkError } = await supabase
      .from("social_approval_links")
      .select(
        `
        *,
        card:social_content_cards(*)
      `,
      )
      .eq("access_token", token)
      .single();

    if (linkError || !link) {
      return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiration
    if (new Date(link.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Este link expirou" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already responded
    if (link.status !== "pending") {
      return new Response(JSON.stringify({ error: "Este link já foi utilizado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get project/company name
    const { data: board } = await supabase
      .from("social_content_boards")
      .select(
        `
        project:onboarding_projects(
          product_name,
          company:onboarding_companies(name)
        )
      `,
      )
      .eq("id", link.card.board_id)
      .single();

    const companyName = (board?.project as any)?.company?.name ||
      (board?.project as any)?.product_name ||
      null;

    return new Response(
      JSON.stringify({
        id: link.id,
        card: link.card,
        status: link.status,
        expires_at: link.expires_at,
        company_name: companyName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Erro ao carregar aprovação" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function readJsonBodySafe(req: Request): Promise<any | null> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return null;

  // Some clients send POST without body; avoid req.json() throwing.
  const contentLength = req.headers.get("content-length");
  if (contentLength === "0") return null;

  try {
    const text = await req.text();
    if (!text?.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
