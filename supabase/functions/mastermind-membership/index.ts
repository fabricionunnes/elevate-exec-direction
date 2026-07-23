// mastermind-membership: esteira viva do grupo Mastermind UNV.
//  {event:"won", lead_id}     ← trigger no CRM quando o negócio vai pra etapa GANHO:
//     registra o membro e manda o CONVITE do grupo no WhatsApp do cliente
//     (do número do Fabrício — nunca do Marcelo, que só fala dentro de grupo).
//     Sem link configurado → avisa o Fabrício pra convidar manualmente.
//  {event:"churn", company_id} ← trigger quando a empresa vira inactive:
//     marca o membro como removido e avisa Fabrício+Eva pra tirar do grupo
//     (API do WhatsApp não remove participante; a base corta o membro na hora).
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const FABRICIO = "5531989840003";
const EVA = "5531997667686";
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const digits = (s: string) => (s || "").replace(/\D/g, "");

async function sendWhats(sb: any, number: string, text: string): Promise<boolean> {
  try {
    const { data: inst } = await sb.from("whatsapp_instances")
      .select("instance_name, api_url, api_key, provider_type, status")
      .eq("instance_name", "fabricionunnes").eq("status", "connected").maybeSingle();
    if (!inst?.api_url || !inst?.api_key) return false;
    const base = inst.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
    const resp = await fetch(`${base}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: inst.api_key },
      body: JSON.stringify({ number, text, delay: 800 }),
    });
    return resp.ok;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    if (body.event === "won") {
      const leadId = body.lead_id;
      if (!leadId) return json({ error: "lead_id obrigatório" }, 400);
      const { data: lead } = await sb.from("crm_leads").select("id, name, phone").eq("id", leadId).maybeSingle();
      if (!lead) return json({ error: "lead não encontrado" }, 404);
      const phone = digits(lead.phone || "");
      if (!phone || phone.length < 10 || phone.length > 15) {
        return json({ ok: true, skipped: "lead sem telefone válido", lead: lead.name });
      }
      // já é membro não-removido? não repete convite
      const { data: existing } = await sb.from("mastermind_members").select("id, status").eq("phone", phone).maybeSingle();
      if (existing && existing.status !== "removed") return json({ ok: true, skipped: "já é membro", status: existing.status });

      if (existing) {
        await sb.from("mastermind_members").update({ status: "invited", removed_at: null, invited_at: new Date().toISOString(), lead_id: leadId, name: lead.name }).eq("id", existing.id);
      } else {
        await sb.from("mastermind_members").insert({ lead_id: leadId, name: lead.name, phone, status: "invited", source: "crm_won" });
      }

      const { data: cfg } = await sb.from("whatsapp_default_config").select("setting_value").eq("setting_key", "mastermind_invite_link").maybeSingle();
      const link = (cfg?.setting_value || "").trim();
      const first = (lead.name || "").trim().split(/\s+/)[0] || "";
      if (link) {
        const msg = `${first ? first + ", s" : "S"}eja bem-vindo à UNV! Além do nosso trabalho junto com seu time, você acaba de ganhar acesso ao Mastermind UNV — nosso grupo fechado de donos de empresa clientes. Entra por aqui: ${link}\n\nQuando entrar, se apresenta em uma linha: sua empresa e a meta que você persegue nesse trimestre. Bora pra cima.`;
        const ok = await sendWhats(sb, phone, msg);
        return json({ ok, member: lead.name, invited: ok });
      }
      // sem link configurado: avisa o Fabrício pra convidar manualmente
      await sendWhats(sb, FABRICIO, `Mastermind UNV: novo ganho no CRM — ${lead.name} (${phone}). Link de convite ainda não configurado; convida manualmente ou me manda o link pra automatizar.`);
      return json({ ok: true, member: lead.name, invited: false, reason: "sem link configurado" });
    }

    if (body.event === "churn") {
      const companyId = body.company_id;
      if (!companyId) return json({ error: "company_id obrigatório" }, 400);
      const { data: comp } = await sb.from("onboarding_companies").select("id, name, phone, owner_phone").eq("id", companyId).maybeSingle();
      if (!comp) return json({ error: "empresa não encontrada" }, 404);
      const phones = [digits(comp.owner_phone || ""), digits(comp.phone || "")].filter(p => p.length >= 10);
      let removedNames: string[] = [];
      if (phones.length) {
        const { data: removed } = await sb.from("mastermind_members")
          .update({ status: "removed", removed_at: new Date().toISOString() })
          .in("phone", phones).neq("status", "removed").select("name");
        removedNames = (removed || []).map((r: any) => r.name || "?");
      }
      // também marca por company_id (quando o vínculo existir)
      await sb.from("mastermind_members")
        .update({ status: "removed", removed_at: new Date().toISOString() })
        .eq("company_id", companyId).neq("status", "removed");
      const alert = `Mastermind UNV: a empresa ${comp.name} cancelou/pausou. ${removedNames.length ? `Membro cortado da base: ${removedNames.join(", ")}.` : "Nenhum membro com esse telefone na base."} Remover do grupo de WhatsApp (2 toques): Mastermind UNV > participante > remover.`;
      await sendWhats(sb, FABRICIO, alert);
      await sendWhats(sb, EVA, alert);
      return json({ ok: true, company: comp.name, removed: removedNames });
    }

    return json({ error: "event inválido (won|churn)" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
