import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SummaryRequest {
  communityId: string;
  weekStart?: string;
  weekEnd?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { communityId, weekStart, weekEnd } = await req.json() as SummaryRequest;

    // Calculate week range
    const now = new Date();
    const startDate = weekStart ? new Date(weekStart) : new Date(now.setDate(now.getDate() - 7));
    const endDate = weekEnd ? new Date(weekEnd) : new Date();

    // Fetch community info
    const { data: community, error: commError } = await supabase
      .from("circle_communities")
      .select("name, description, category")
      .eq("id", communityId)
      .single();

    if (commError || !community) {
      return new Response(
        JSON.stringify({ error: "Community not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch posts from the week
    const { data: posts, error: postsError } = await supabase
      .from("circle_posts")
      .select(`
        id,
        content,
        likes_count,
        comments_count,
        created_at,
        profile:circle_profiles!circle_posts_profile_id_fkey(
          id,
          display_name
        )
      `)
      .eq("community_id", communityId)
      .eq("is_active", true)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("likes_count", { ascending: false })
      .limit(50);

    if (postsError) {
      console.error("Error fetching posts:", postsError);
    }

    const postsData = posts || [];

    // Build context for AI
    const postsContext = postsData
      .slice(0, 20)
      .map((p: any) => `- "${p.content?.substring(0, 200) || ''}" (${p.likes_count} curtidas, por ${p.profile?.display_name})`)
      .join("\n");

    // Get top contributors
    const contributorCounts: Record<string, { id: string; name: string; count: number }> = {};
    postsData.forEach((p: any) => {
      const profileId = p.profile?.id;
      if (profileId) {
        if (!contributorCounts[profileId]) {
          contributorCounts[profileId] = { id: profileId, name: p.profile.display_name, count: 0 };
        }
        contributorCounts[profileId].count++;
      }
    });
    const topContributors = Object.values(contributorCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const systemPrompt = `Você é um assistente que gera resumos semanais inteligentes para comunidades profissionais.
Seu resumo deve ser:
- Conciso e informativo
- Destacar os temas principais discutidos
- Identificar insights e tendências
- Ser escrito em português brasileiro`;

    const userPrompt = `Gere um resumo semanal para a comunidade "${community.name}" (categoria: ${community.category}).

Descrição da comunidade: ${community.description || 'Não disponível'}

Posts da semana (${postsData.length} posts):
${postsContext || "Nenhum post esta semana"}

Top contribuidores: ${topContributors.map(c => c.name).join(", ") || "Nenhum"}

Responda em JSON:
{
  "summary": "Resumo geral em 2-3 parágrafos",
  "main_topics": ["tema1", "tema2", "tema3"],
  "key_insights": ["insight1", "insight2"],
  "highlight_quote": "Uma frase de destaque dos posts (ou null)",
  "engagement_level": "baixo|médio|alto",
  "recommendation": "Uma sugestão para a próxima semana"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content || "";

    let summaryData;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summaryData = JSON.parse(jsonMatch[0]);
      }
    } catch {
      summaryData = {
        summary: "Não foi possível gerar o resumo automático desta semana.",
        main_topics: [],
        key_insights: [],
      };
    }

    // Save summary to database
    const topPostIds = postsData.slice(0, 5).map((p: any) => p.id);
    const topContributorIds = topContributors.map(c => c.id);

    const { data: savedSummary, error: saveError } = await supabase
      .from("circle_community_summaries")
      .upsert({
        community_id: communityId,
        summary_content: summaryData.summary,
        main_topics: summaryData.main_topics || [],
        top_posts: topPostIds,
        top_contributors: topContributorIds,
        insights: summaryData.key_insights || [],
        week_start: startDate.toISOString().split("T")[0],
        week_end: endDate.toISOString().split("T")[0],
      }, { onConflict: "community_id,week_start" })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving summary:", saveError);
    }

    return new Response(
      JSON.stringify({
        summary: summaryData,
        topContributors,
        postsCount: postsData.length,
        savedId: savedSummary?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in circle-community-summary:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
