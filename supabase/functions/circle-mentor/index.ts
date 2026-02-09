import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MentorRequest {
  sessionId?: string;
  profileId: string;
  message: string;
  sessionType?: "profile_analysis" | "growth_plan" | "content_strategy" | "reputation_boost" | "general";
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
    const { sessionId, profileId, message, sessionType = "general" } = await req.json() as MentorRequest;

    // Fetch user profile data
    const { data: profile, error: profileError } = await supabase
      .from("circle_profiles")
      .select(`
        display_name,
        bio,
        company_name,
        role_title,
        trust_score,
        total_points,
        current_level,
        level_name
      `)
      .eq("id", profileId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user stats
    const [postsResult, followersResult, areaRepResult] = await Promise.all([
      supabase
        .from("circle_posts")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profileId)
        .eq("is_active", true),
      supabase
        .from("circle_follows")
        .select("id", { count: "exact", head: true })
        .eq("following_profile_id", profileId),
      supabase
        .from("circle_area_reputation")
        .select("area, reputation_score, level_name")
        .eq("profile_id", profileId),
    ]);

    // Get or create session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from("circle_mentor_sessions")
        .insert({
          profile_id: profileId,
          session_type: sessionType,
          context: {
            profile: profile,
            stats: {
              posts: postsResult.count || 0,
              followers: followersResult.count || 0,
            },
            areaReputation: areaRepResult.data || [],
          },
        })
        .select()
        .single();

      if (sessionError) {
        console.error("Error creating session:", sessionError);
        throw new Error("Failed to create mentor session");
      }
      currentSessionId = newSession.id;
    }

    // Get previous messages
    const { data: previousMessages } = await supabase
      .from("circle_mentor_messages")
      .select("role, content")
      .eq("session_id", currentSessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Save user message
    await supabase
      .from("circle_mentor_messages")
      .insert({
        session_id: currentSessionId,
        role: "user",
        content: message,
      });

    // Build AI context
    const systemPrompt = `Você é o Mentor UNV Circle, um coach de crescimento profissional personalizado.

SOBRE O USUÁRIO:
- Nome: ${profile.display_name}
- Cargo: ${profile.role_title || 'Não informado'}
- Empresa: ${profile.company_name || 'Não informada'}
- Trust Score: ${profile.trust_score || 50}/100
- Nível: ${profile.level_name} (${profile.total_points} pontos)
- Posts: ${postsResult.count || 0}
- Seguidores: ${followersResult.count || 0}
- Reputação por área: ${JSON.stringify(areaRepResult.data || [])}

SEU PAPEL:
1. Analisar o perfil e engajamento do usuário
2. Sugerir estratégias personalizadas de crescimento
3. Recomendar tipos de conteúdo, horários de postagem
4. Indicar comunidades relevantes para participar
5. Ajudar a melhorar Trust Score e reputação

ESTILO:
- Seja amigável e encorajador
- Dê conselhos práticos e acionáveis
- Use exemplos concretos quando possível
- Responda em português brasileiro
- Seja conciso mas completo`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(previousMessages || []).map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
    }

    // For streaming, we'll collect the full response and save it
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    let textBuffer = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });
        
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullResponse += content;
          } catch {
            // Partial JSON, continue
          }
        }
      }
    }

    // Save assistant message
    await supabase
      .from("circle_mentor_messages")
      .insert({
        session_id: currentSessionId,
        role: "assistant",
        content: fullResponse,
      });

    return new Response(
      JSON.stringify({
        sessionId: currentSessionId,
        response: fullResponse,
        profile: {
          trustScore: profile.trust_score,
          level: profile.level_name,
          points: profile.total_points,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in circle-mentor:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
