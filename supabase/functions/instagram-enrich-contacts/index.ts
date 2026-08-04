import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const isPlaceholder = (n: string | null) => {
  const s = (n || "").trim();
  return !s || /^instagram\s/i.test(s) || /^@/.test(s) || /^\d[\d\s]*$/.test(s);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(parseInt(String(body.limit ?? 40), 10) || 40, 1), 200);

    // Só vale pedir o perfil de quem MANDOU mensagem (consentimento). Antes a
    // consulta pegava os 40 primeiros contatos sem username — quase todos sem
    // inbound — e a função nunca chegava em quem realmente conversou.
    const SEL = "id, instagram_user_id, name, username, instance_id, instance:instagram_instances(id, access_token, status)";
    let contacts: any[] = [];

    if (body.contact_id) {
      const { data } = await supabase.from("instagram_contacts").select(SEL).eq("id", body.contact_id);
      contacts = data || [];
    } else {
      // conversas que têm pelo menos uma mensagem recebida (pagina de 1000 em 1000)
      const inboundConvIds = new Set<string>();
      for (let page = 0; page < 40; page++) {
        const from = page * 1000;
        const { data: rows } = await supabase
          .from("instagram_messages")
          .select("conversation_id")
          .eq("direction", "inbound")
          .order("id", { ascending: true })
          .range(from, from + 999);
        (rows || []).forEach((r: any) => r.conversation_id && inboundConvIds.add(r.conversation_id));
        if (!rows || rows.length < 1000) break;
      }

      const contactIds = new Set<string>();
      const convIdList = Array.from(inboundConvIds);
      for (let i = 0; i < convIdList.length; i += 200) {
        const { data: convs } = await supabase
          .from("instagram_conversations")
          .select("contact_id")
          .in("id", convIdList.slice(i, i + 200));
        (convs || []).forEach((c: any) => c.contact_id && contactIds.add(c.contact_id));
      }

      const idList = Array.from(contactIds);
      for (let i = 0; i < idList.length && contacts.length < limit; i += 200) {
        const { data } = await supabase
          .from("instagram_contacts")
          .select(SEL)
          .in("id", idList.slice(i, i + 200))
          .or("name.is.null,username.is.null");
        contacts = contacts.concat(data || []);
      }
      contacts = contacts.slice(0, limit);
    }

    let enriched = 0, leadsFixed = 0;
    const results: any[] = [];
    for (const c of (contacts || [])) {
      const inst: any = (c as any).instance;
      const token = inst?.access_token;
      if (!token || !c.instagram_user_id) continue;
      // Instagram só libera nome/username de quem DEU CONSENTIMENTO = mandou msg.
      // Seguidor que só foi abordado (sem inbound) retorna code 230 — pula.
      const { count: inboundCount } = await supabase.from("instagram_messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .in("conversation_id",
          ((await supabase.from("instagram_conversations").select("id").eq("contact_id", c.id)).data || []).map((x: any) => x.id));
      if (!inboundCount) { results.push({ id: c.id, skip: "sem inbound (sem consentimento)" }); continue; }
      try {
        const r = await fetch(`https://graph.instagram.com/v21.0/${c.instagram_user_id}?fields=name,username,profile_pic&access_token=${token}`);
        if (!r.ok) { results.push({ id: c.id, err: r.status }); continue; }
        const p = await r.json();
        if (p.error) { results.push({ id: c.id, err: p.error.code }); continue; }
        const upd: Record<string, unknown> = {};
        if (p.name && !c.name) upd.name = String(p.name);
        if (p.username && !c.username) upd.username = String(p.username);
        if (p.profile_pic) upd.profile_picture_url = String(p.profile_pic);
        if (Object.keys(upd).length) {
          await supabase.from("instagram_contacts").update(upd).eq("id", c.id);
          enriched++;
        }
        // atualiza o nome do lead se ainda for placeholder
        const displayName = (p.name && String(p.name).trim()) || (p.username ? `@${p.username}` : null);
        if (displayName) {
          const { data: convs } = await supabase.from("instagram_conversations").select("lead_id").eq("contact_id", c.id).not("lead_id", "is", null);
          for (const cv of (convs || [])) {
            const { data: lead } = await supabase.from("crm_leads").select("id, name, instagram").eq("id", cv.lead_id).maybeSingle();
            if (!lead) continue;
            const leadUpd: Record<string, unknown> = {};
            if (isPlaceholder(lead.name)) leadUpd.name = displayName;
            if (p.username && !lead.instagram) leadUpd.instagram = String(p.username);
            if (Object.keys(leadUpd).length) {
              await supabase.from("crm_leads").update(leadUpd).eq("id", lead.id);
              leadsFixed++;
            }
          }
        }
        results.push({ id: c.id, name: p.name, username: p.username });
      } catch (e) {
        results.push({ id: c.id, err: String((e as Error).message || e) });
      }
    }
    return j({ ok: true, contacts_seen: (contacts || []).length, enriched, leads_fixed: leadsFixed, sample: results.slice(0, 5) });
  } catch (e) {
    console.error("instagram-enrich-contacts", e);
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
