import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();
    console.log(`[campaign-scheduler] Checking scheduled campaigns at ${now}`);

    // Find campaigns with status 'scheduled' and scheduled_at <= now
    const { data: campaigns, error } = await supabase
      .from("whatsapp_campaigns")
      .select("id, name, scheduled_at, instance_id")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    if (error) {
      console.error("[campaign-scheduler] Error fetching campaigns:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!campaigns || campaigns.length === 0) {
      console.log("[campaign-scheduler] No campaigns ready to send");
      return new Response(JSON.stringify({ message: "No campaigns ready", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[campaign-scheduler] Found ${campaigns.length} campaigns to trigger`);

    let triggered = 0;
    let failed = 0;

    for (const campaign of campaigns) {
      try {
        console.log(`[campaign-scheduler] Triggering campaign ${campaign.id} (${campaign.name})`);

        // Call whatsapp-bulk-send with service role key
        const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-bulk-send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            campaignId: campaign.id,
            action: "start",
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          triggered++;
          console.log(`[campaign-scheduler] Campaign ${campaign.id} triggered successfully`);
        } else {
          failed++;
          console.error(`[campaign-scheduler] Campaign ${campaign.id} failed:`, result);
          // Mark as failed to avoid retrying indefinitely
          await supabase
            .from("whatsapp_campaigns")
            .update({ status: "draft", started_at: null })
            .eq("id", campaign.id);
        }
      } catch (err) {
        failed++;
        console.error(`[campaign-scheduler] Error triggering campaign ${campaign.id}:`, err);
      }
    }

    console.log(`[campaign-scheduler] Done: triggered=${triggered}, failed=${failed}`);

    return new Response(
      JSON.stringify({ message: "Scheduler completed", triggered, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[campaign-scheduler] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
