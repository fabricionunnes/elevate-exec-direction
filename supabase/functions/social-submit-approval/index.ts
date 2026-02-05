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
      // Calculate scheduled_at from suggested_date + suggested_time with São Paulo timezone (UTC-3)
      let scheduledAt: string | null = null;
      let shouldPublishNow = false;
      
      if (action === "approved") {
        if (link.card.suggested_date) {
          const timeStr = link.card.suggested_time || "09:00";
          scheduledAt = `${link.card.suggested_date}T${timeStr}:00-03:00`;
          
          // Check if scheduled time is in the past or now
          const scheduledDate = new Date(scheduledAt);
          if (scheduledDate <= new Date()) {
            shouldPublishNow = true;
          }
        } else {
          // No date set - publish immediately
          shouldPublishNow = true;
        }
      }

      const updateData: Record<string, unknown> = {
        stage_id: targetStage.id,
        is_locked: action === "approved",
      };
      
      // Only set scheduled_at if it's an approval with a date
      if (scheduledAt) {
        updateData.scheduled_at = scheduledAt;
      }

      await supabase
        .from("social_content_cards")
        .update(updateData)
        .eq("id", link.card_id);

      // Log history
      await supabase.from("social_content_history").insert({
        card_id: link.card_id,
        action: action,
        from_stage_id: link.card.stage_id,
        to_stage_id: targetStage.id,
        details: action === "adjustment_requested" ? { notes: notes?.trim() } : { auto_scheduled: true, shouldPublishNow },
      });

      // If approved and should publish now, trigger Instagram publishing
      if (action === "approved" && shouldPublishNow && link.card.creative_url) {
        console.log("Triggering immediate Instagram publish for card:", link.card_id);
        
        // Get project_id from the board
        const { data: board } = await supabase
          .from("social_content_boards")
          .select("project_id")
          .eq("id", link.card.board_id)
          .single();
        
        if (board?.project_id) {
          // Call the publish function directly using fetch (service-to-service)
          try {
            const publishResponse = await fetch(`${supabaseUrl}/functions/v1/social-instagram-publish`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                cardId: link.card_id,
                projectId: board.project_id,
              }),
            });
            
            const publishResult = await publishResponse.json();
            console.log("Publish result:", publishResult);
          } catch (publishError) {
            console.error("Error calling publish function:", publishError);
            // Don't fail the approval if publish fails - it can be retried
          }
        }
      }
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
