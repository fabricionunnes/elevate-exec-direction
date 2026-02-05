import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, action, notes } = await req.json();

    if (!token || !action) {
      return new Response(
        JSON.stringify({ error: "Token e action são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["approved", "adjustment_requested"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Ação inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "adjustment_requested" && !notes?.trim()) {
      return new Response(
        JSON.stringify({ error: "Descrição do ajuste é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get approval link
    const { data: link, error: linkError } = await supabase
      .from("social_approval_links")
      .select("*, card:social_content_cards(*)")
      .eq("access_token", token)
      .single();

    if (linkError || !link) {
      return new Response(
        JSON.stringify({ error: "Link inválido" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (link.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Este link já foi utilizado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update link status
    await supabase
      .from("social_approval_links")
      .update({
        status: action,
        responded_at: new Date().toISOString(),
      })
      .eq("id", link.id);

    // Save feedback
    await supabase.from("social_client_feedback").insert({
      card_id: link.card_id,
      approval_link_id: link.id,
      feedback_type: action,
      adjustment_notes: notes?.trim() || null,
    });

    // Get stages for the board
    const { data: stages } = await supabase
      .from("social_content_stages")
      .select("id, stage_type")
      .eq("board_id", link.card.board_id);

    // Move card to appropriate stage
    // When approved → move to "scheduled" (Programado no Instagram)
    // When adjustment requested → move to "adjustments"
    let targetStageType = action === "approved" ? "scheduled" : "adjustments";
    const targetStage = stages?.find((s: any) => s.stage_type === targetStageType);

    if (targetStage) {
      await supabase
        .from("social_content_cards")
        .update({
          stage_id: targetStage.id,
          is_locked: action === "approved",
        })
        .eq("id", link.card_id);

      // Log history
      await supabase.from("social_content_history").insert({
        card_id: link.card_id,
        action: action,
        from_stage_id: link.card.stage_id,
        to_stage_id: targetStage.id,
        details: action === "adjustment_requested" ? { notes: notes?.trim() } : { auto_scheduled: true },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao processar aprovação" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
