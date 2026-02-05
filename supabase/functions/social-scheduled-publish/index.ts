import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();
    console.log(`[Cron] Starting scheduled publish check at ${now}`);

    // Find all cards in "scheduled" stage where:
    // - scheduled_at is null (publish immediately) OR scheduled_at <= now
    // - publish_attempts < 3
    // - has creative_url (media to publish)
    // - is_locked = true (approved)
    const { data: stages, error: stagesError } = await supabase
      .from("social_content_stages")
      .select("id, board_id")
      .eq("stage_type", "scheduled");

    if (stagesError) {
      console.error("Error fetching scheduled stages:", stagesError);
      return new Response(JSON.stringify({ error: stagesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!stages || stages.length === 0) {
      console.log("[Cron] No scheduled stages found");
      return new Response(JSON.stringify({ message: "No scheduled stages", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scheduledStageIds = stages.map((s) => s.id);
    console.log(`[Cron] Found ${scheduledStageIds.length} scheduled stages`);

    // Get cards ready to publish
    const { data: cards, error: cardsError } = await supabase
      .from("social_content_cards")
      .select(`
        id, 
        board_id, 
        creative_url, 
        final_caption, 
        hashtags, 
        scheduled_at, 
        publish_attempts,
        suggested_date,
        suggested_time
      `)
      .in("stage_id", scheduledStageIds)
      .eq("is_locked", true)
      .not("creative_url", "is", null)
      .lt("publish_attempts", MAX_ATTEMPTS);

    if (cardsError) {
      console.error("Error fetching cards:", cardsError);
      return new Response(JSON.stringify({ error: cardsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cards || cards.length === 0) {
      console.log("[Cron] No cards ready to publish");
      return new Response(JSON.stringify({ message: "No cards ready", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Cron] Found ${cards.length} cards in scheduled stage`);

    // Filter cards that are ready to publish (scheduled_at is null or in the past)
    const cardsToPublish = cards.filter((card) => {
      if (!card.scheduled_at) {
        // No scheduled time = publish immediately
        console.log(`[Cron] Card ${card.id}: No scheduled_at, will publish immediately`);
        return true;
      }
      const scheduledTime = new Date(card.scheduled_at);
      const isReady = scheduledTime <= new Date();
      console.log(`[Cron] Card ${card.id}: scheduled_at=${card.scheduled_at}, isReady=${isReady}`);
      return isReady;
    });

    console.log(`[Cron] ${cardsToPublish.length} cards ready to publish now`);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const card of cardsToPublish) {
      processed++;

      // Get project_id from board
      const { data: board } = await supabase
        .from("social_content_boards")
        .select("project_id")
        .eq("id", card.board_id)
        .single();

      if (!board?.project_id) {
        console.error(`[Cron] Card ${card.id}: No project found`);
        continue;
      }

      // Update attempt count before trying
      await supabase
        .from("social_content_cards")
        .update({
          publish_attempts: (card.publish_attempts || 0) + 1,
          last_publish_attempt_at: new Date().toISOString(),
        })
        .eq("id", card.id);

      console.log(`[Cron] Publishing card ${card.id} (attempt ${(card.publish_attempts || 0) + 1}/${MAX_ATTEMPTS})`);

      try {
        // Call the existing publish function via Supabase client (avoids URL/route NOT_FOUND issues)
        const { data: publishResult, error: publishInvokeError } = await supabase.functions.invoke(
          "social-instagram-publish",
          {
            body: {
              cardId: card.id,
              projectId: board.project_id,
            },
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
            },
          }
        );

        if (publishInvokeError) {
          console.error(`[Cron] Card ${card.id} publish invoke error:`, publishInvokeError);
        }

        console.log(`[Cron] Card ${card.id} publish result:`, publishResult ?? publishInvokeError);

        if ((publishResult as { success?: boolean } | null)?.success) {
          succeeded++;
          // Clear error on success
          await supabase
            .from("social_content_cards")
            .update({ publish_error: null })
            .eq("id", card.id);
        } else {
          failed++;
          const errorMsg =
            (publishResult as { error?: string } | null)?.error ||
            (publishInvokeError as { message?: string } | null)?.message ||
            "Unknown error";
          
          // Check if max attempts reached
          const newAttempts = (card.publish_attempts || 0) + 1;
          if (newAttempts >= MAX_ATTEMPTS) {
            console.error(`[Cron] Card ${card.id}: Max attempts reached, marking as failed`);
            await supabase
              .from("social_content_cards")
              .update({ 
                publish_error: `Falha após ${MAX_ATTEMPTS} tentativas: ${errorMsg}`,
              })
              .eq("id", card.id);
          } else {
            await supabase
              .from("social_content_cards")
              .update({ publish_error: errorMsg })
              .eq("id", card.id);
          }
        }
      } catch (publishError) {
        failed++;
        console.error(`[Cron] Card ${card.id} publish error:`, publishError);
        await supabase
          .from("social_content_cards")
          .update({ 
            publish_error: publishError instanceof Error ? publishError.message : "Erro desconhecido",
          })
          .eq("id", card.id);
      }
    }

    console.log(`[Cron] Completed: processed=${processed}, succeeded=${succeeded}, failed=${failed}`);

    return new Response(
      JSON.stringify({ 
        message: "Scheduled publish completed",
        processed,
        succeeded,
        failed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Cron] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
