import { createClient } from "@supabase/supabase-js";

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
    const body = await readJsonBodySafe(req);

    // Allow fallback to query params so clients that can't POST JSON still work.
    const token = body?.token || url.searchParams.get("token") || url.searchParams.get("access_token");
    const action = body?.action || url.searchParams.get("action");
    const notes = body?.notes ?? url.searchParams.get("notes");

    if (!token || !action) {
      return new Response(JSON.stringify({ error: "Token e action são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!['approved', 'adjustment_requested'].includes(action)) {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "adjustment_requested" && !notes?.toString().trim()) {
      return new Response(JSON.stringify({ error: "Descrição do ajuste é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Link inválido" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (link.status !== "pending") {
      return new Response(JSON.stringify({ error: "Este link já foi utilizado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      adjustment_notes: notes?.toString().trim() || null,
    });

    // Get board settings (required_approvals)
    const { data: board } = await supabase
      .from("social_content_boards")
      .select("id, project_id, required_approvals")
      .eq("id", link.card.board_id)
      .single();

    const requiredApprovals = board?.required_approvals || 1;

    // Get stages for the board
    const { data: stages } = await supabase
      .from("social_content_stages")
      .select("id, stage_type")
      .eq("board_id", link.card.board_id);

    if (action === "adjustment_requested") {
      // Move to adjustments stage immediately
      const adjustmentsStage = stages?.find((s: any) => s.stage_type === "adjustments");

      if (adjustmentsStage) {
        await supabase
          .from("social_content_cards")
          .update({
            stage_id: adjustmentsStage.id,
            approval_count: 0, // Reset approval count
          })
          .eq("id", link.card_id);

        // Log history
        await supabase.from("social_content_history").insert({
          card_id: link.card_id,
          action: "adjustment_requested",
          from_stage_id: link.card.stage_id,
          to_stage_id: adjustmentsStage.id,
          details: { notes: notes?.toString().trim() },
        });
      }
    } else {
      // Approved - increment approval count and check if we have enough
      const newApprovalCount = (link.card.approval_count || 0) + 1;

      await supabase
        .from("social_content_cards")
        .update({ approval_count: newApprovalCount })
        .eq("id", link.card_id);

      console.log(`Card ${link.card_id}: ${newApprovalCount}/${requiredApprovals} approvals`);

      // Check if we have enough approvals
      if (newApprovalCount >= requiredApprovals) {
        // Move to scheduled stage
        const scheduledStage = stages?.find((s: any) => s.stage_type === "scheduled");
        console.log("scheduledStage found:", scheduledStage?.id, scheduledStage?.name);

        if (scheduledStage) {
          // Calculate scheduled_at from suggested_date + suggested_time with São Paulo timezone (UTC-3)
          let scheduledAt: string | null = null;
          let shouldPublishNow = false;

          if (link.card.suggested_date) {
            const timeStr = link.card.suggested_time || "09:00:00";
            // Ensure time format is HH:MM:SS (add seconds if missing)
            const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr.substring(0, 8);
            scheduledAt = `${link.card.suggested_date}T${normalizedTime}-03:00`;

            // Check if scheduled time is in the past or now
            const scheduledDate = new Date(scheduledAt);
            if (scheduledDate <= new Date()) {
              shouldPublishNow = true;
            }
          } else {
            // No date set - publish immediately
            shouldPublishNow = true;
          }

          const updateData: Record<string, unknown> = {
            stage_id: scheduledStage.id,
            is_locked: true,
          };

          if (scheduledAt) {
            updateData.scheduled_at = scheduledAt;
          }

          console.log("Moving card to scheduled stage with data:", JSON.stringify(updateData));

          const { error: updateError } = await supabase
            .from("social_content_cards")
            .update(updateData)
            .eq("id", link.card_id);

          if (updateError) {
            console.error("Error moving card to scheduled:", updateError);
          } else {
            console.log("Card moved to scheduled successfully");
          }

          // Log history
          const { error: historyError } = await supabase.from("social_content_history").insert({
            card_id: link.card_id,
            action: "approved",
            from_stage_id: link.card.stage_id,
            to_stage_id: scheduledStage.id,
            details: {
              auto_scheduled: true,
              shouldPublishNow,
              approval_count: newApprovalCount,
              required_approvals: requiredApprovals,
            },
          });

          if (historyError) {
            console.error("Error inserting history:", historyError);
          }

          // If should publish now, trigger Instagram publishing
          if (shouldPublishNow && link.card.creative_url && board?.project_id) {
            console.log("Triggering immediate Instagram publish for card:", link.card_id);

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
            }
          }
        }
      } else {
        // Not enough approvals yet - just log
        await supabase.from("social_content_history").insert({
          card_id: link.card_id,
          action: "partial_approval",
          details: {
            approval_count: newApprovalCount,
            required_approvals: requiredApprovals,
            remaining: requiredApprovals - newApprovalCount,
          },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Erro ao processar aprovação" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function readJsonBodySafe(req: Request): Promise<any | null> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return null;

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
