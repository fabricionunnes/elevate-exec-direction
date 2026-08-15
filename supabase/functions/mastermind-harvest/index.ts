// mastermind-harvest: lê as mensagens novas do grupo Mastermind UNV, reconhece
// os membros (contatos cadastrados na aba Mastermind da empresa) e classifica
// com IA o que cada empresa CONTRIBUIU ou RECEBEU no grupo.
//
// Reconhecimento: o WhatsApp entrega sender_phone em formato LID (id interno),
// não o número real. O casamento é por wa_lid aprendido > telefone (sufixo) >
// nome normalizado — e quando casa por nome/telefone, o LID é gravado no membro
// pra próxima rodada casar exato.
//
// Roda 2x/dia via cron. Entrada: {} (cron) · { dry_run: true } · { days: N }
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROUP_JID = "120363429757662444"; // Mastermind UNV
const MODEL = "claude-sonnet-4-6";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** sufixo de 8 dígitos: casa 553199887766 com 3199887766 e variações com 9 */
const tail = (p: string) => (p || "").replace(/\D/g, "").slice(-8);

type Member = {
  id: string; name: string; phone: string | null; wa_lid: string | null;
  company_id: string | null; status: string;
};

function matchMember(members: Member[], senderPhone: string, senderName: string): Member | null {
  const sp = (senderPhone || "").replace(/\D/g, "");
  if (sp) {
    const byLid = members.find((m) => m.wa_lid && m.wa_lid === sp);
    if (byLid) return byLid;
    const st = tail(sp);
    const byPhone = members.find((m) => m.phone && tail(m.phone) === st && st.length >= 8);
    if (byPhone) return byPhone;
  }
  const sn = norm(senderName);
  if (!sn) return null;
  const exact = members.filter((m) => norm(m.name) === sn);
  if (exact.length === 1) return exact[0];
  // primeiro nome + um sobrenome compartilhado
  const tok = sn.split(" ");
  const cands = members.filter((m) => {
    const mt = norm(m.name).split(" ");
    return mt[0] === tok[0] && (tok.length === 1 || mt.some((t) => t.length > 2 && tok.includes(t) && t !== tok[0]));
  });
  return cands.length === 1 ? cands[0] : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "ANTHROPIC_API_KEY não configurada" }, 500);

    const body = await req.json().catch(() => ({} as any));
    const dryRun = !!body.dry_run;

    // cursor
    const { data: st } = await supabase.from("mastermind_harvest_state")
      .select("last_message_at").eq("id", 1).maybeSingle();
    const since = body.days
      ? new Date(Date.now() - Number(body.days) * 86400000).toISOString()
      : (st?.last_message_at || new Date(Date.now() - 30 * 86400000).toISOString());

    // conversas do grupo (todas as instâncias que estão nele; dedupe por remote_id)
    const { data: convs } = await supabase
      .from("crm_whatsapp_conversations")
      .select("id, contact:crm_whatsapp_contacts!inner(phone)")
      .eq("crm_whatsapp_contacts.phone", GROUP_JID);
    const convIds = (convs || []).map((c: any) => c.id);
    if (!convIds.length) return json({ error: "grupo Mastermind não encontrado nas conversas" }, 404);

    const { data: msgs } = await supabase
      .from("crm_whatsapp_messages")
      .select("id, content, sender_phone, sender_name, created_at, whatsapp_message_id")
      .in("conversation_id", convIds)
      .gt("created_at", since)
      .not("content", "is", null)
      .order("created_at", { ascending: true })
      .limit(400);

    // dedupe entre instâncias (mesma mensagem chega por cada instância no grupo)
    const seen = new Set<string>();
    const unicas = (msgs || []).filter((m: any) => {
      const k = m.whatsapp_message_id || `${m.sender_phone}|${m.created_at}|${(m.content || "").slice(0, 40)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return (m.content || "").trim().length > 2;
    });

    if (!unicas.length) return json({ ok: true, mensagens_novas: 0 });

    // membros ativos
    const { data: membersRaw } = await supabase.from("mastermind_members")
      .select("id, name, phone, wa_lid, company_id, status")
      .neq("status", "removed");
    const members = (membersRaw || []) as Member[];

    // atribui remetentes e aprende o LID
    const rotulos: { msg: any; member: Member | null }[] = [];
    for (const m of unicas) {
      const mm = matchMember(members, m.sender_phone || "", m.sender_name || "");
      if (mm && m.sender_phone) {
        const sp = m.sender_phone.replace(/\D/g, "");
        if (sp && mm.wa_lid !== sp && tail(sp) !== tail(mm.phone || "")) {
          // era LID: aprende pro próximo ciclo casar exato
          await supabase.from("mastermind_members").update({ wa_lid: sp }).eq("id", mm.id);
          mm.wa_lid = sp;
        }
      }
      rotulos.push({ msg: m, member: mm });
    }

    // transcript pra IA — só marca como MEMBRO quem foi reconhecido
    const linhas = rotulos.map(({ msg, member }, i) => {
      const quem = member
        ? `[${i}] MEMBRO ${member.name} (member_id=${member.id})`
        : `[${i}] ${msg.sender_name || "desconhecido"}`;
      return `${quem} em ${String(msg.created_at).slice(0, 16)}:\n${String(msg.content).slice(0, 500)}`;
    }).join("\n---\n");

    const prompt = `Você analisa a conversa de um grupo de mastermind de empresários (Mastermind UNV).
Extraia CONTRIBUIÇÕES atômicas — uma por evento real:

- direction "given": o membro contribuiu (respondeu dúvida de outro, indicou contato/fornecedor, compartilhou material/ferramenta/aprendizado útil, ofereceu ajuda concreta)
- direction "received": o membro foi contribuído (teve dúvida respondida, recebeu indicação/material/ajuda)

Regras duras:
- Só crie itens para remetentes marcados como MEMBRO (use o member_id exato).
- Conversa social, parabéns, "bom dia", figurinha: NÃO é contribuição.
- Compartilhar resultado próprio ("chegamos em 445k") não é contribuição — a menos que explique COMO, aí é "given" (kind=aprendizado).
- Quando a troca envolve dois membros reconhecidos, crie os dois lados (given pra quem deu, received pra quem recebeu) e preencha counterpart_member_id.
- summary: uma frase objetiva em pt-BR dizendo o que foi dado/recebido.
- kind: um de resposta_duvida | indicacao | material | aprendizado | oferta_ajuda | outro.

Responda SÓ com JSON: {"contributions":[{"msg_index":number,"member_id":string,"direction":"given"|"received","kind":string,"summary":string,"counterpart_member_id":string|null}]}

Conversa:
${linhas}`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!aiResp.ok) return json({ error: `IA ${aiResp.status}: ${(await aiResp.text()).slice(0, 200)}` }, 502);
    const aiData = await aiResp.json();
    const texto = aiData?.content?.[0]?.text || "";
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    let contribs: any[] = [];
    try { contribs = JSON.parse(jsonMatch ? jsonMatch[0] : texto)?.contributions || []; } catch { contribs = []; }

    const memberById = new Map(members.map((m) => [m.id, m]));
    const validas = contribs.filter((c) =>
      memberById.has(c.member_id) && c.summary &&
      ["given", "received"].includes(c.direction) &&
      rotulos[c.msg_index]?.member?.id === c.member_id);

    if (dryRun) {
      return json({
        ok: true, dry_run: true, mensagens_novas: unicas.length,
        reconhecidas: rotulos.filter((r) => r.member).length,
        contribuicoes: validas.map((c) => ({
          membro: memberById.get(c.member_id)?.name, ...c,
        })),
      });
    }

    let gravadas = 0;
    for (const c of validas) {
      const m = memberById.get(c.member_id)!;
      const cp = c.counterpart_member_id ? memberById.get(c.counterpart_member_id) : null;
      const { error } = await supabase.from("mastermind_contributions").upsert({
        message_id: rotulos[c.msg_index].msg.id,
        member_id: m.id, company_id: m.company_id,
        direction: c.direction, kind: c.kind || "outro",
        summary: String(c.summary).slice(0, 500),
        counterpart_member_id: cp?.id || null,
        counterpart_company_id: cp?.company_id || null,
        message_at: rotulos[c.msg_index].msg.created_at,
      }, { onConflict: "message_id,member_id,direction", ignoreDuplicates: true });
      if (!error) gravadas++;
      else console.error("[mastermind-harvest] insert:", error.message);
    }

    // avança o cursor
    const ultimo = unicas[unicas.length - 1].created_at;
    await supabase.from("mastermind_harvest_state")
      .update({ last_message_at: ultimo, updated_at: new Date().toISOString() }).eq("id", 1);

    return json({
      ok: true, mensagens_novas: unicas.length,
      reconhecidas: rotulos.filter((r) => r.member).length,
      contribuicoes_gravadas: gravadas,
    });
  } catch (err) {
    console.error("[mastermind-harvest] erro:", (err as Error)?.message || err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
