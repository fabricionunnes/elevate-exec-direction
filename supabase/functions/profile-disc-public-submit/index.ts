// Public DISC submission for UNV Profile (no auth required).
// Accepts respondent name/email + DISC answers, finds-or-creates a profile_employees
// record (tenant-less / generic if no tenant header) and stores the result in profile_disc_results.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  tenantId?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  scores: { D: number; I: number; S: number; C: number };
  dominant: "D" | "I" | "S" | "C";
  rawAnswers: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;

    if (!body?.name?.trim()) {
      return new Response(JSON.stringify({ error: "name_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.scores || !body.dominant) {
      return new Response(JSON.stringify({ error: "scores_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tenantId = body.tenantId ?? null;

    // Try to find an existing employee by email within the same tenant scope.
    let employeeId: string | null = null;
    if (body.email) {
      const { data: existing } = await supabase
        .from("profile_employees")
        .select("id")
        .eq("email", body.email)
        .is("tenant_id", tenantId as any)
        .maybeSingle();
      if (existing) employeeId = existing.id;
    }

    if (!employeeId) {
      const { data: created, error: insertErr } = await supabase
        .from("profile_employees")
        .insert({
          tenant_id: tenantId,
          full_name: body.name.trim(),
          email: body.email || null,
          phone: body.phone || null,
          status: "active",
          employee_type: "external",
          is_employee: false,
          metadata: { source: "public_disc_link" },
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;
      employeeId = created.id;
    }

    const { error: discErr } = await supabase.from("profile_disc_results").insert({
      tenant_id: tenantId,
      employee_id: employeeId,
      d_score: body.scores.D,
      i_score: body.scores.I,
      s_score: body.scores.S,
      c_score: body.scores.C,
      dominant: body.dominant,
      raw_responses: body.rawAnswers as any,
    });
    if (discErr) throw discErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("profile-disc-public-submit error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
