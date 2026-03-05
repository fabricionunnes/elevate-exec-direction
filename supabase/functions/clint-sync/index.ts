import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { lead_id, action } = await req.json();
    console.log("[clint-sync] Request:", { lead_id, action });

    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get config
    const { data: config } = await supabase
      .from("crm_clint_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config || !config.sync_enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: "sync disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (config.sync_direction === "clint_to_crm") {
      return new Response(JSON.stringify({ ok: true, skipped: "direction is clint_to_crm only" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get API token from secrets
    const apiToken = Deno.env.get(config.api_token_secret_name);
    if (!apiToken) {
      console.error("[clint-sync] API token not found:", config.api_token_secret_name);
      return new Response(JSON.stringify({ error: "API token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get lead data
    const { data: lead, error: leadError } = await supabase
      .from("crm_leads")
      .select(`
        *,
        stage:crm_stages(name, is_final, final_type),
        pipeline:crm_pipelines(name)
      `)
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for existing sync record
    const { data: existingSync } = await supabase
      .from("crm_clint_sync_log")
      .select("*")
      .eq("crm_lead_id", lead_id)
      .eq("sync_direction", "crm_to_clint")
      .eq("sync_status", "success")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const clintContactId = existingSync?.clint_contact_id;
    const clintDealId = existingSync?.clint_deal_id;

    const baseUrl = "https://api.clint.digital/v1";
    const headers = {
      "Content-Type": "application/json",
      "api-token": apiToken,
    };

    let result: any = { ok: true };

    // Sync contact
    const contactPayload: any = {
      name: lead.name,
      phone: lead.phone || undefined,
      email: lead.email || undefined,
      company: lead.company || undefined,
      _crm_sync_origin: "crm_comercial", // Anti-loop flag
    };

    try {
      if (clintContactId) {
        // Update existing contact
        const res = await fetch(`${baseUrl}/contacts/${clintContactId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(contactPayload),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Clint API error (update contact): ${res.status} - ${errorText}`);
        }

        result.contact = { action: "updated", id: clintContactId };
      } else {
        // Create new contact
        const res = await fetch(`${baseUrl}/contacts`, {
          method: "POST",
          headers,
          body: JSON.stringify(contactPayload),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Clint API error (create contact): ${res.status} - ${errorText}`);
        }

        const contactResult = await res.json();
        const newClintContactId = contactResult.id || contactResult._id || contactResult.data?.id;
        result.contact = { action: "created", id: newClintContactId };

        // Save sync record
        await supabase.from("crm_clint_sync_log").insert({
          crm_lead_id: lead_id,
          clint_contact_id: newClintContactId,
          sync_direction: "crm_to_clint",
          sync_status: "success",
          payload: contactPayload,
        });
      }
    } catch (error: any) {
      console.error("[clint-sync] Contact sync error:", error.message);
      await supabase.from("crm_clint_sync_log").insert({
        crm_lead_id: lead_id,
        clint_contact_id: clintContactId,
        sync_direction: "crm_to_clint",
        sync_status: "error",
        error_message: error.message,
        payload: contactPayload,
      });
      result.contact = { action: "error", error: error.message };
    }

    // Sync deal if lead has opportunity value or stage change
    if (action === "stage_change" || lead.opportunity_value) {
      const dealContactId = result.contact?.id || clintContactId;
      if (dealContactId) {
        const dealPayload: any = {
          contact_id: dealContactId,
          value: lead.opportunity_value || 0,
          title: `${lead.name} - ${lead.pipeline?.name || "Pipeline"}`,
          _crm_sync_origin: "crm_comercial",
        };

        // Map stage to Clint funnel step if mapping exists
        if (config.pipeline_mapping && lead.stage?.name) {
          const reverseMapping = config.pipeline_mapping as Record<string, string>;
          // Try to find a reverse mapping (CRM stage name -> Clint step)
          for (const [clintStep, crmStageId] of Object.entries(reverseMapping)) {
            if (crmStageId === lead.stage_id) {
              dealPayload.funnel_step = clintStep;
              break;
            }
          }
        }

        // Handle loss
        if (lead.stage?.is_final && lead.stage?.final_type === "lost") {
          dealPayload.status = "lost";
        } else if (lead.stage?.is_final && lead.stage?.final_type === "won") {
          dealPayload.status = "won";
        }

        try {
          if (clintDealId) {
            const res = await fetch(`${baseUrl}/deals/${clintDealId}`, {
              method: "PUT",
              headers,
              body: JSON.stringify(dealPayload),
            });
            if (!res.ok) {
              const errorText = await res.text();
              throw new Error(`Clint API error (update deal): ${res.status} - ${errorText}`);
            }
            result.deal = { action: "updated", id: clintDealId };
          } else {
            const res = await fetch(`${baseUrl}/deals`, {
              method: "POST",
              headers,
              body: JSON.stringify(dealPayload),
            });
            if (!res.ok) {
              const errorText = await res.text();
              throw new Error(`Clint API error (create deal): ${res.status} - ${errorText}`);
            }
            const dealResult = await res.json();
            const newDealId = dealResult.id || dealResult._id || dealResult.data?.id;
            result.deal = { action: "created", id: newDealId };

            await supabase.from("crm_clint_sync_log").insert({
              crm_lead_id: lead_id,
              clint_contact_id: dealContactId,
              clint_deal_id: newDealId,
              sync_direction: "crm_to_clint",
              sync_status: "success",
              payload: dealPayload,
            });
          }
        } catch (error: any) {
          console.error("[clint-sync] Deal sync error:", error.message);
          await supabase.from("crm_clint_sync_log").insert({
            crm_lead_id: lead_id,
            clint_deal_id: clintDealId,
            sync_direction: "crm_to_clint",
            sync_status: "error",
            error_message: error.message,
            payload: dealPayload,
          });
          result.deal = { action: "error", error: error.message };
        }
      }
    }

    // Update last_sync_at
    await supabase
      .from("crm_clint_config")
      .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", config.id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[clint-sync] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
