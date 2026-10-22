// Abre (ou cria) a conversa de WhatsApp de um telefone no número do SDR, ou do closer quando não há
// SDR, pra pessoa mandar a mensagem pelo Atendimento (Fabrício, 21/10/2026: "Chamar no WhatsApp"
// dos formulários abandonados tem que abrir o Atendimento na instância do SDR, e quando não tem SDR
// na do closer, com a mensagem redigida").
//
// POST { phone, nome?, lead_id? }  (com o JWT de quem está logado)
// → { conversation_id, instance_id, numero, atendente, papel, criada }
//
// O telefone é resolvido no próprio WhatsApp (/chat/whatsappNumbers): muitos números voltam SEM o
// nono dígito (ex.: 553188590241). O contato é gravado igual ao que o WhatsApp devolve, senão a
// resposta do lead chega no evolution-webhook com outro telefone e abre uma segunda conversa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// "Ricardo Santos" (pessoa) casa com o número "Ricardo Santos"; aceita nome do número contido no da
// pessoa ou primeiro + último nome da pessoa dentro do nome do número
function mesmoNome(pessoa: string, numero: string) {
  const p = norm(pessoa), n = norm(numero);
  if (!p || !n) return false;
  if (p === n || p.includes(n) || n.includes(p)) return true;
  const t = p.split(" ");
  return t.length > 1 && n.includes(t[0]) && n.includes(t[t.length - 1]);
}

// variações brasileiras com e sem o nono dígito
function variantesBR(d: string): string[] {
  const out = new Set<string>([d]);
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") out.add(d.slice(0, 4) + d.slice(5));
  if (d.startsWith("55") && d.length === 12) out.add(d.slice(0, 4) + "9" + d.slice(4));
  return [...out];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Não autenticado" }, 401);
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j({ error: "Não autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: eu } = await admin.from("onboarding_staff").select("id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
    if (!eu) return j({ error: "Só a equipe pode abrir conversas" }, 403);

    const body = await req.json().catch(() => ({}));
    const bruto = String(body.phone || "").replace(/\D/g, "");
    if (bruto.length < 10) return j({ error: "Telefone inválido" }, 400);
    const digitos = bruto.startsWith("55") || bruto.length > 11 ? bruto : `55${bruto}`;
    const nome = String(body.nome || "").trim() || null;
    const leadId = body.lead_id || null;

    // 1) número de quem vai atender: SDR ativo com número conectado; sem SDR, closer
    const { data: instancias } = await admin.from("whatsapp_instances")
      .select("id, instance_name, display_name, api_url, api_key, status, is_personal, tenant_id")
      .eq("status", "connected").is("tenant_id", null);
    const usaveis = (instancias || []).filter((i: any) => !i.is_personal && i.api_url && i.api_key);
    const { data: equipe } = await admin.from("onboarding_staff")
      .select("id, name, role").eq("is_active", true).in("role", ["sdr", "closer"]).order("name");
    let escolha: { inst: any; pessoa: any; papel: string } | null = null;
    for (const papel of ["sdr", "closer"]) {
      for (const pessoa of (equipe || []).filter((s: any) => s.role === papel)) {
        const inst = usaveis.find((i: any) => mesmoNome(pessoa.name, i.display_name || i.instance_name));
        if (inst) { escolha = { inst, pessoa, papel }; break; }
      }
      if (escolha) break;
    }
    if (!escolha) return j({ error: "Nenhum SDR ou closer ativo com número de WhatsApp conectado" }, 409);
    const { inst, pessoa, papel } = escolha;

    // 2) telefone como o WhatsApp conhece
    let jidPhone = digitos;
    try {
      const r = await fetch(`${String(inst.api_url).replace(/\/+$/, "")}/chat/whatsappNumbers/${inst.instance_name}`, {
        method: "POST",
        headers: { apikey: inst.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: [digitos] }),
      });
      const d = await r.json();
      const hit = Array.isArray(d) ? d[0] : null;
      if (hit && hit.exists === false) return j({ error: "Esse telefone não tem WhatsApp" }, 422);
      const doJid = String(hit?.jid || "").split("@")[0].replace(/\D/g, "");
      if (doJid.length >= 10) jidPhone = doJid;
    } catch (e) {
      console.error("whatsappNumbers falhou, sigo com o número digitado:", e);
    }

    // 3) contato: reaproveita o que já existe (exato do WhatsApp primeiro, depois com/sem o 9)
    const variantes = [...new Set([jidPhone, ...variantesBR(jidPhone), ...variantesBR(digitos)])];
    const { data: contatos } = await admin.from("crm_whatsapp_contacts").select("id, phone, name, lead_id").in("phone", variantes);
    let contato = (contatos || []).find((c: any) => c.phone === jidPhone) || (contatos || [])[0] || null;
    if (!contato) {
      const { data: novo, error } = await admin.from("crm_whatsapp_contacts")
        .insert({ phone: jidPhone, name: nome || jidPhone, lead_id: leadId }).select("id, phone, name, lead_id").single();
      if (error) throw error;
      contato = novo;
    }
    const idsContato = (contatos && contatos.length ? contatos : [contato]).map((c: any) => c.id);

    // 4) conversa nesse número
    const { data: existente } = await admin.from("crm_whatsapp_conversations")
      .select("id").eq("instance_id", inst.id).in("contact_id", idsContato).is("merged_into", null)
      .order("last_message_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    let conversationId = existente?.id as string | undefined;
    let criada = false;
    if (!conversationId) {
      const { data: nova, error } = await admin.from("crm_whatsapp_conversations")
        .insert({ instance_id: inst.id, contact_id: contato.id, lead_id: leadId || contato.lead_id || null, status: "open", unread_count: 0 })
        .select("id").single();
      if (error) throw error;
      conversationId = nova.id;
      criada = true;
    }

    return j({
      conversation_id: conversationId, instance_id: inst.id, numero: inst.display_name || inst.instance_name,
      atendente: pessoa.name, papel, criada, telefone: jidPhone,
    });
  } catch (e) {
    console.error("crm-abrir-conversa:", e);
    return j({ error: (e as any)?.message || String(e) }, 500);
  }
});
