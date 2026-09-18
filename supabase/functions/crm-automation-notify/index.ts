// Aviso de automação do CRM: "chegou lead novo pra você" no WhatsApp do responsável sorteado.
// Chamado pelo banco (crm_run_wa_automations) com { run_id }. Não precisa de segredo: só envia se o
// registro existir, for recente (10 min) e ainda não tiver sido avisado — chamada de fora não faz nada.
import { createClient } from "npm:@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { "Content-Type": "application/json" } });
const digits = (p: string) => (p || "").replace(/\D/g, "");
const br = (p: string) => { const d = digits(p); if (!d) return ""; return d.startsWith("55") ? d : (d.length === 10 || d.length === 11) ? `55${d}` : d; };

Deno.serve(async (req) => {
  try {
    const { run_id } = await req.json().catch(() => ({}));
    if (!/^[0-9a-f-]{36}$/i.test(String(run_id || ""))) return json({ skip: "run_id inválido" });
    const { data: run } = await supabase.from("crm_automation_runs")
      .select("id, lead_id, assigned_staff_id, notified, created_at, automation:crm_automations(name)").eq("id", run_id).maybeSingle();
    if (!run || run.notified || !run.assigned_staff_id) return json({ skip: "nada a avisar" });
    if (Date.now() - new Date(run.created_at).getTime() > 10 * 60000) return json({ skip: "registro antigo" });
    await supabase.from("crm_automation_runs").update({ notified: true }).eq("id", run.id);

    const [{ data: staff }, { data: lead }] = await Promise.all([
      supabase.from("onboarding_staff").select("name, phone").eq("id", run.assigned_staff_id).maybeSingle(),
      run.lead_id ? supabase.from("crm_leads").select("id, name, phone, pipeline:crm_pipelines(name)").eq("id", run.lead_id).maybeSingle() : Promise.resolve({ data: null } as any),
    ]);
    const phone = br(staff?.phone || "");
    if (!phone) return json({ skip: "responsável sem telefone" });

    let inst: any = null;
    for (const name of ["fabricionunnes", "marceloalmeida"]) {
      const { data } = await supabase.from("whatsapp_instances").select("instance_name, api_url, api_key, provider_type, phone_number")
        .eq("instance_name", name).eq("status", "connected").maybeSingle();
      if (data && digits(data.phone_number || "") !== phone) { inst = data; break; }
    }
    if (!inst?.api_url || !inst?.api_key) return json({ skip: "sem instância conectada" });

    const msg = `📥 *Lead novo pra você*\n\n*${lead?.name || "Contato novo"}*${lead?.phone ? `\n*Telefone:* ${lead.phone}` : ""}` +
      `${(lead as any)?.pipeline?.name ? `\n*Funil:* ${(lead as any).pipeline.name}` : ""}\n*Regra:* ${(run as any).automation?.name || "automação"}` +
      `${lead?.id ? `\n\n📋 https://unvholdings.com.br/#/crm/leads/${lead.id}` : ""}`;
    const base = String(inst.api_url).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
    const v2 = inst.provider_type === "manager_v2" || base.includes("stevo");
    const r = await fetch(v2 ? `${base}/send/text` : `${base}/message/sendText/${inst.instance_name}`, {
      method: "POST", headers: { apikey: String(inst.api_key), "Content-Type": "application/json" }, body: JSON.stringify({ number: phone, text: msg }),
    });
    return json({ ok: r.ok, para: staff?.name });
  } catch (e) { return json({ error: String(e).slice(0, 200) }, 500); }
});
