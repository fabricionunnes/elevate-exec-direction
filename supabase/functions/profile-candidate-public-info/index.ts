// profile-candidate-public-info: dado um candidateId, devolve nome/email/telefone
// do candidato (service role) para PRÉ-PREENCHER o teste DISC público e manter o
// resultado vinculado ao candidato. Só retorna dados básicos do próprio candidato
// cujo id (UUID não-adivinhável) está no link enviado a ele.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const candidateId: string = body.candidateId || "";
    const employeeId: string = body.employeeId || "";
    if (!candidateId && !employeeId) throw new Error("candidateId ou employeeId obrigatório");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = employeeId
      ? await supabase.from("profile_employees").select("full_name,email,phone").eq("id", employeeId).maybeSingle()
      : await supabase.from("profile_candidates").select("full_name,email,phone").eq("id", candidateId).maybeSingle();
    if (error) throw error;

    return new Response(JSON.stringify({ candidate: data || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
