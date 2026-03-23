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
    const authHeader = req.headers.get("authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, project_id, pipeline_id, stage_id, rows } = await req.json();

    if (!project_id || !rows || !Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: "Missing project_id or rows" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get onboarding user
    const { data: onbUser } = await supabase
      .from("onboarding_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("project_id", project_id)
      .maybeSingle();

    let inserted = 0;
    let skipped = 0;
    let errors: string[] = [];

    if (type === "contacts") {
      for (const row of rows) {
        try {
          if (!row.name && !row.email && !row.phone) {
            skipped++;
            continue;
          }

          // Dedup: same email or phone in project
          if (row.email || row.phone) {
            let query = supabase.from("client_crm_contacts").select("id").eq("project_id", project_id);
            if (row.email) query = query.eq("email", row.email);
            else if (row.phone) query = query.eq("phone", row.phone);
            const { data: existing } = await query.limit(1);
            if (existing && existing.length > 0) {
              skipped++;
              continue;
            }
          }

          const tags = row.tags
            ? (typeof row.tags === "string" ? row.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : row.tags)
            : null;

          const { error } = await supabase.from("client_crm_contacts").insert({
            project_id,
            name: row.name || row.organization_name || "Sem nome",
            email: row.email || null,
            phone: row.phone || row.complete_phone || null,
            company: row.organization_name || row.company || null,
            role: row.role || null,
            document: row.cnpj || row.cpf || row.document || null,
            notes: row.notes || null,
            tags,
            created_by: onbUser?.id || null,
          });

          if (error) {
            errors.push(`Contact ${row.name || row.email}: ${error.message}`);
          } else {
            inserted++;
          }
        } catch (e) {
          errors.push(`Contact error: ${e.message}`);
        }
      }
    } else if (type === "deals") {
      if (!pipeline_id) {
        return new Response(JSON.stringify({ error: "Missing pipeline_id for deals import" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get stages for this pipeline
      const { data: stages } = await supabase
        .from("client_crm_stages")
        .select("id, name, sort_order, is_final")
        .eq("pipeline_id", pipeline_id)
        .order("sort_order");

      const stageMap: Record<string, string> = {};
      for (const s of stages || []) {
        stageMap[s.name.toLowerCase().trim()] = s.id;
      }

      const defaultStageId = stage_id || stages?.find(s => !s.is_final)?.id || stages?.[0]?.id;

      for (const row of rows) {
        try {
          const title = row.name || row.title || row.organization_name || "Sem título";
          const value = parseFloat(String(row.value || "0").replace(/[^\d.,\-]/g, "").replace(",", ".")) || 0;

          // Try to match stage by name
          let targetStageId = defaultStageId;
          if (row.stage) {
            const matchedStage = stageMap[row.stage.toLowerCase().trim()];
            if (matchedStage) targetStageId = matchedStage;
          }

          // Try to find or create contact
          let contactId: string | null = null;
          const contactEmail = row.email || null;
          const contactPhone = row.phone || row.complete_phone || null;
          const contactName = row.name || row.contactName || null;

          if (contactEmail || contactPhone) {
            let cQuery = supabase.from("client_crm_contacts").select("id").eq("project_id", project_id);
            if (contactEmail) cQuery = cQuery.eq("email", contactEmail);
            else cQuery = cQuery.eq("phone", contactPhone);
            const { data: existingContact } = await cQuery.limit(1);

            if (existingContact && existingContact.length > 0) {
              contactId = existingContact[0].id;
            } else if (contactName || contactEmail) {
              const tags = row.tags
                ? (typeof row.tags === "string" ? row.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : row.tags)
                : null;

              const { data: newContact } = await supabase.from("client_crm_contacts").insert({
                project_id,
                name: contactName || contactEmail || "Sem nome",
                email: contactEmail,
                phone: contactPhone,
                company: row.organization_name || null,
                document: row.cnpj || row.cpf || null,
                tags,
                created_by: onbUser?.id || null,
              }).select("id").single();

              if (newContact) contactId = newContact.id;
            }
          }

          // Parse dates
          let expectedClose: string | null = null;
          let closedAt: string | null = null;
          if (row.won_at) {
            closedAt = parseDate(row.won_at);
          } else if (row.lost_at) {
            closedAt = parseDate(row.lost_at);
          }

          // Build notes from extra fields
          const notesParts: string[] = [];
          if (row.notes) notesParts.push(row.notes);
          if (row.observacoes) notesParts.push(row.observacoes);
          if (row.origin) notesParts.push(`Origem: ${row.origin}`);
          if (row.utm_source) notesParts.push(`UTM Source: ${row.utm_source}`);
          if (row.utm_medium) notesParts.push(`UTM Medium: ${row.utm_medium}`);
          if (row.utm_campaign) notesParts.push(`UTM Campaign: ${row.utm_campaign}`);
          if (row.sdr) notesParts.push(`SDR: ${row.sdr}`);
          if (row.closer) notesParts.push(`Closer: ${row.closer}`);
          if (row.funil) notesParts.push(`Funil original: ${row.funil}`);
          if (row.segment) notesParts.push(`Segmento: ${row.segment}`);
          if (row.category) notesParts.push(`Categoria: ${row.category}`);
          if (row.qual_faturamento_atu) notesParts.push(`Faturamento: ${row.qual_faturamento_atu}`);
          if (row.city && row.state) notesParts.push(`Local: ${row.city}/${row.state}`);

          const { error } = await supabase.from("client_crm_deals").insert({
            project_id,
            pipeline_id,
            stage_id: targetStageId,
            contact_id: contactId,
            title,
            value,
            notes: notesParts.length > 0 ? notesParts.join("\n") : null,
            probability: row.status === "Ganho" ? 100 : row.status === "Perdido" ? 0 : 50,
            expected_close_date: expectedClose,
            closed_at: closedAt,
            loss_reason: row.lost_status || null,
            created_by: onbUser?.id || null,
            owner_id: onbUser?.id || null,
          });

          if (error) {
            errors.push(`Deal ${title}: ${error.message}`);
          } else {
            inserted++;
          }
        } catch (e) {
          errors.push(`Deal error: ${e.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, type, inserted, skipped, errors: errors.slice(0, 20), total_errors: errors.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  // DD/MM/YYYY HH:mm:ss or DD/MM/YYYY
  const parts = dateStr.split(" ")[0].split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  // Already ISO
  if (dateStr.includes("-")) return dateStr.split("T")[0];
  return null;
}
