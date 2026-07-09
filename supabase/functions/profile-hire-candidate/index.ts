// profile-hire-candidate: o candidato aprovado preenche o cadastro de contratação.
// Salva os dados, move pra etapa "Contratado" (hired), cria o COLABORADOR
// (profile_employees) e o cadastro de USUÁRIO (onboarding_staff, sem login ainda —
// senha/e-mail de acesso são configurados depois pelo admin).
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
    if (!candidateId) throw new Error("candidateId obrigatório");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: cand, error: cErr } = await supabase
      .from("profile_candidates").select("id,tenant_id,full_name,email,phone,stage").eq("id", candidateId).maybeSingle();
    if (cErr) throw cErr;
    if (!cand) throw new Error("Candidato não encontrado");

    const d = body.data || {};
    const patch: any = {
      cpf: d.cpf?.trim() || null, cnpj: d.cnpj?.trim() || null,
      address: d.address?.trim() || null, neighborhood: d.neighborhood?.trim() || null,
      city: d.city?.trim() || null, state: d.state?.trim() || null,
      bank_info: d.bank_info?.trim() || null, pix_key: d.pix_key?.trim() || null,
      photo_url: d.photo_url?.trim() || null,
      stage: "hired",
    };
    const { error: upErr } = await supabase.from("profile_candidates").update(patch).eq("id", candidateId);
    if (upErr) throw upErr;

    const name = cand.full_name || "Novo colaborador";
    const email = (cand.email || "").trim().toLowerCase();

    // Cadastro de usuário (sem login ainda; admin configura senha/email depois)
    let staffId: string | null = null;
    if (email) {
      const { data: existingStaff } = await supabase.from("onboarding_staff").select("id").eq("email", email).maybeSingle();
      if (existingStaff) staffId = existingStaff.id;
    }
    if (!staffId) {
      const { data: st, error: stErr } = await supabase.from("onboarding_staff")
        .insert({ name, email: email || `${candidateId}@sem-email.local`, role: "pending", is_active: true, tenant_id: cand.tenant_id })
        .select("id").single();
      if (stErr) throw stErr;
      staffId = st.id;
    }

    // Colaborador (aparece em Colaboradores/Organograma)
    const { data: existingEmp } = await supabase.from("profile_employees").select("id").eq("staff_id", staffId).maybeSingle();
    if (!existingEmp) {
      await supabase.from("profile_employees").insert({
        tenant_id: cand.tenant_id, staff_id: staffId, full_name: name,
        email: email || null, phone: cand.phone || null, avatar_url: patch.photo_url,
        status: "active", employee_type: "internal", is_employee: true,
        metadata: { source: "hired_candidate", candidate_id: candidateId },
      });
    } else if (patch.photo_url) {
      await supabase.from("profile_employees").update({ avatar_url: patch.photo_url, status: "active", is_employee: true }).eq("id", existingEmp.id);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
