// Estúdio da Mansão: chat estilo Claude com ferramentas (perfil, site, posts, financeiro, vídeo)
import { createClient } from "@supabase/supabase-js";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const MODEL = "claude-sonnet-5";
const KEY = () => { const k = Deno.env.get("ANTHROPIC_API_KEY"); if (!k) throw new Error("ANTHROPIC_API_KEY não configurada"); return k; };
async function anthropic(body: any) {
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": KEY(), "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: MODEL, ...body }) });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return await r.json();
}
const text = (j: any) => (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
const strip = (s: string) => s.replace(/^\s*```(?:json|html)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
function ctx(row: any) {
  const a = row.answers || {}; const lines = [`Empresa: ${row.company}`, `Dono: ${row.owner_name || "-"}`, `WhatsApp: ${row.whatsapp || "-"}`, `Cor principal: ${row.color1}`, `Cor secundária: ${row.color2}`, `Logo (URL): ${row.logo_url || "sem logo, usar o nome da empresa em texto"}`];
  for (const [k, v] of Object.entries(a)) { if (v === null || v === "" ) continue; lines.push(`${k}: ${v}`); }
  return lines.join("\n");
}
const SITE_SYS = `Você é um designer e copywriter sênior da UNV. Você cria sites institucionais de uma página, prontos, para pequenas empresas. Responda SOMENTE com um documento HTML completo (<!doctype html> até </html>), sem markdown e sem explicações.
Regras técnicas: CSS inline dentro de <style>, sem JavaScript externo, sem imagens externas exceto a URL da logo informada e fotos do Unsplash via https://images.unsplash.com (só se fizer sentido, com termos genéricos do segmento). Fonte do Google Fonts via <link>. Responsivo, leve, títulos e descrição preenchidos. Botão flutuante de WhatsApp (https://wa.me/55DDDNUMERO?text=...) em todas as seções. Use as duas cores da marca como paleta (fundo claro, cor principal em títulos e botões, secundária em detalhes).
Estrutura: header com logo (img) e menu de âncoras; hero com promessa clara e botão; "como funciona" em 3 passos; serviços (um card por serviço); diferenciais com prova; depoimentos (placeholder entre colchetes); sobre o dono em primeira pessoa; FAQ com 4 perguntas; contato; rodapé.
Copy: português do Brasil, frases curtas, específico da empresa, sem "soluções inovadoras". Nada de lorem ipsum.`;
const POSTS_SYS = `Você é o head de conteúdo da UNV. Crie 5 posts de Instagram para a empresa descrita: 3 para feed (1080x1350) e 2 para story (1080x1920). Responda SOMENTE com JSON válido:
{"posts":[{"format":"feed"|"story","layout":"stat"|"list"|"quote"|"cta"|"question","headline":"até 9 palavras","sub":"até 18 palavras","bullets":["até 3 itens, só em list"],"stat":"número + unidade, só em stat","cta":"até 5 palavras","caption":"legenda com 3 hashtags"}]}
Regras: cada post ataca uma dor real do cliente ideal ou mostra prova; sem clichê; sem emoji na arte; 1 post com o ponto de vista do dono; stories curtos com pergunta ou chamada direta.`;
async function genSite(sb: any, id: string) {
  const { data: row } = await sb.from("mansao_estudio").select("*").eq("id", id).single();
  try { const html = strip(text(await anthropic({ max_tokens: 12000, system: SITE_SYS, messages: [{ role: "user", content: `Dados da empresa:\n${ctx(row)}\n\nCrie o site completo agora.` }] })));
    if (!/<html/i.test(html)) throw new Error("sem html");
    await sb.from("mansao_estudio").update({ site_html: html, site_status: "ready", updated_at: new Date().toISOString() }).eq("id", id);
  } catch (e) { console.error("site", e); await sb.from("mansao_estudio").update({ site_status: "error" }).eq("id", id); }
}
async function genPosts(sb: any, id: string) {
  const { data: row } = await sb.from("mansao_estudio").select("*").eq("id", id).single();
  try { const out = strip(text(await anthropic({ max_tokens: 4000, system: POSTS_SYS, messages: [{ role: "user", content: `Dados da empresa:\n${ctx(row)}\n\nCrie os 5 posts.` }] })));
    const posts = (JSON.parse(out).posts || []).slice(0, 5); if (posts.length < 5) throw new Error("menos de 5");
    await sb.from("mansao_estudio").update({ posts, posts_status: "ready", updated_at: new Date().toISOString() }).eq("id", id);
  } catch (e) { console.error("posts", e); await sb.from("mansao_estudio").update({ posts_status: "error" }).eq("id", id); }
}
const SYSTEM_SYS = `Você é um engenheiro de produto sênior da UNV. Você constrói MINI SISTEMAS DE GESTÃO completos para pequenas empresas em um único arquivo HTML. Responda SOMENTE com um documento HTML completo (<!doctype html> até </html>), sem markdown e sem explicações.
Regras técnicas: tudo em um arquivo (CSS em <style>, JS em <script>), sem bibliotecas externas exceto uma fonte do Google Fonts. Dados salvos no localStorage do navegador (chave com o nome da empresa), com botões Exportar/Importar JSON e Exportar CSV. Responsivo (funciona no celular). Gráficos desenhados em <canvas> puro. Sem lorem ipsum: já vem com 8 a 12 registros de exemplo coerentes com a empresa, marcados como exemplo e com botão "limpar exemplos".
Interface: cabeçalho com a logo (img da URL informada, ou o nome) e as cores da marca; navegação por abas; painel inicial com os indicadores que importam pra empresa (cards grandes) e um gráfico; formulários simples com validação; tabelas com filtro por período e busca; ações de editar, excluir, marcar como pago/feito; alertas do que está vencido ou pendente; um relatório do mês em texto que o dono pode copiar.
Conteúdo: construa exatamente o que o participante pediu na especificação, usando os termos do negócio dele (categorias, produtos, cargos). Se pediu financeiro: contas a pagar e a receber, fluxo de caixa mensal, categorias, DRE simplificado (receita, custos, despesas, resultado) e o que mais ele pediu. Português do Brasil, textos curtos e claros, sem emoji.`;
async function genSystem(sb: any, id: string, spec: string) {
  const { data: row } = await sb.from("mansao_estudio").select("*").eq("id", id).single();
  try { const html = strip(text(await anthropic({ max_tokens: 20000, system: SYSTEM_SYS, messages: [{ role: "user", content: `Dados da empresa:\n${ctx(row)}\n\nEspecificação do sistema pedida pelo participante:\n${spec}\n\nConstrua o sistema completo agora.` }] })));
    if (!/<html/i.test(html)) throw new Error("sem html");
    await sb.from("mansao_estudio").update({ system_html: html, system_status: "ready", system_spec: spec, updated_at: new Date().toISOString() }).eq("id", id);
  } catch (e) { console.error("system", e); await sb.from("mansao_estudio").update({ system_status: "error" }).eq("id", id); }
}
const TOOLS = [
  { name: "save_profile", description: "Salva ou atualiza dados da empresa do participante. Chame assim que souber algo novo (pode chamar várias vezes). Só envie os campos que você descobriu.", input_schema: { type: "object", properties: { segmento: { type: "string" }, cidade: { type: "string" }, o_que_vende: { type: "string", description: "produtos/serviços, ticket médio, forma de pagamento" }, servicos: { type: "string", description: "um por linha" }, cliente_ideal: { type: "string" }, dores: { type: "string" }, diferenciais: { type: "string" }, tom: { type: "string" }, horario: { type: "string" }, redes: { type: "string" }, historia: { type: "string" }, whatsapp: { type: "string", description: "só dígitos com DDD" }, color1: { type: "string", description: "hex" }, color2: { type: "string", description: "hex" }, owner_name: { type: "string" } } } },
  { name: "set_logo", description: "Define a logo da empresa a partir de uma URL de imagem que o participante enviou.", input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "generate_site", description: "Gera (ou regenera) o site institucional da empresa com os dados salvos. Roda em segundo plano (1 a 2 min) e aparece no painel Site.", input_schema: { type: "object", properties: {} } },
  { name: "generate_posts", description: "Gera 5 posts de Instagram (3 feed + 2 story) com a marca. Roda em segundo plano (30 s) e aparece no painel Posts.", input_schema: { type: "object", properties: {} } },
  { name: "generate_system", description: "Gera (ou regenera) o mini sistema de gestão da empresa (ex.: financeiro) a partir da especificação do participante. Roda em segundo plano (2 a 3 min) e aparece no painel Sistema.", input_schema: { type: "object", properties: { spec: { type: "string", description: "tudo que o sistema precisa ter, nas palavras do participante, mais o que você inferiu do negócio" } }, required: ["spec"] } },
  { name: "create_video_job", description: "Coloca na fila de edição um vídeo com as fotos e os vídeos (um ou vários) que o participante enviou (URLs). Fica pronto em até 30 min no painel Vídeo.", input_schema: { type: "object", properties: { file_urls: { type: "array", items: { type: "string" } }, brief: { type: "string" } }, required: ["file_urls"] } },
  { name: "get_status", description: "Status atual do site, posts, vídeos e central de processos do participante.", input_schema: { type: "object", properties: {} } },
];
function system(row: any) {
  return `Você é o Estúdio da Mansão Empreendedora, um assistente da UNV (Universidade Nacional de Vendas) que conversa como o Claude: direto, humano, sem enrolação, em português do Brasil, mensagens curtas, sem emoji. Você está atendendo ${row.owner_name || "o participante"} da empresa "${row.company}" durante o evento Mansão Empreendedora (12/09/2026).

O que você faz por ele, com as ferramentas: entender a empresa, salvar o perfil (save_profile), gerar o site (generate_site), gerar 5 posts (generate_posts), gerar o mini sistema de gestão sob medida (generate_system: financeiro ou o que ele pedir), colocar um vídeo na fila de edição (create_video_job, quando ele enviar fotos e vídeo) e orientar sobre a Central de Processos (formulário em https://mansaoempreendedora.com.br/central, link fica no painel Processos).

Regras:
- Primeira mensagem sem perfil: se apresente em 2 linhas e pergunte o que ele quer criar primeiro (site, posts, vídeo, financeiro, central). Depois colete o que falta pra aquele item, UMA pergunta por vez, no máximo 6 perguntas no total: segmento e cidade; o que vende e ticket; cliente ideal; 3 dores do cliente; diferenciais com prova; tom de voz e WhatsApp. Se ele responder várias de uma vez, aproveite tudo.
- Salve com save_profile a cada resposta útil. Se ele mandar uma imagem que pareça logo, use set_logo. Se mandar cores, salve color1/color2.
- Quando tiver segmento + o que vende + cliente ideal + dores, já pode gerar. Não peça o que já sabe (perfil atual abaixo).
- Após chamar generate_site ou generate_posts, diga que está sendo criado e vai aparecer no painel ao lado em 1 a 2 minutos, e sugira o próximo item.
- Mini sistema (financeiro ou outro): pergunte em UMA mensagem o que ele precisa controlar e quem vai usar (se ele já descreveu no prompt, não pergunte). Monte a especificação completa e chame generate_system. Diga que leva 2 a 3 minutos e aparece no painel Sistema, com link próprio.
- Vídeo: o participante envia fotos e um ou mais vídeos pelo anexo (podem vir em várias mensagens). Assim que ele pedir pra montar (ou disser que já mandou tudo), chame create_video_job com TODAS as URLs de fotos e vídeos enviadas nesta conversa e um brief. Não insista em fotos: só vídeos também serve. Fotos de logo não entram no vídeo.
- Nunca invente dados da empresa. Nunca fale de preço da UNV. Se perguntarem algo fora do estúdio, responda curto e volte pro que está criando.

Perfil atual:
${ctx(row)}
Status: site=${row.site_status}, posts=${row.posts_status}, sistema=${row.system_status}, central=${row.central_slug ? "ok" : "não feita"}.`;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { id, pin, message, attachments, chat_id, admin } = await req.json();
    let { data: row } = await sb.from("mansao_estudio").select("*").eq("id", id).single();
    // ---- admin (bloqueio) ----
    if (admin) {
      if (admin.pass !== (Deno.env.get("MANSAO_ADMIN_PASS") || "Fano@3005")) return json({ error: "acesso negado" }, 403);
      if (admin.action === "list") { const { data } = await sb.from("mansao_estudio").select("id, company, owner_name, login, active, created_at, site_status, posts_status").order("created_at"); const { data: g } = await sb.from("mansao_estudio_settings").select("value").eq("key", "global").single(); const { data: m } = await sb.from("mansao_estudio_msgs").select("estudio_id"); const counts: any = {}; (m || []).forEach((x: any) => counts[x.estudio_id] = (counts[x.estudio_id] || 0) + 1); return json({ users: (data || []).map((u: any) => ({ ...u, msgs: counts[u.id] || 0 })), global: g?.value?.active !== false }); }
      if (admin.action === "set") { await sb.from("mansao_estudio").update({ active: !!admin.active }).eq("id", admin.target); return json({ ok: true }); }
      if (admin.action === "global") { await sb.from("mansao_estudio_settings").upsert({ key: "global", value: { active: !!admin.active } }); return json({ ok: true }); }
      return json({ error: "admin action" }, 400);
    }
    if (!row || row.pin !== String(pin)) return json({ error: "acesso negado" }, 403);
    const { data: gset } = await sb.from("mansao_estudio_settings").select("value").eq("key", "global").single();
    if (row.active === false || (gset && gset.value && gset.value.active === false)) return json({ error: "O estúdio foi encerrado. Use os prompts da aba \"Prompts pra levar\" no seu próprio Claude." }, 403);
    let chatId = chat_id;
    if (chatId) { const { data: c } = await sb.from("mansao_estudio_chats").select("id").eq("id", chatId).eq("estudio_id", id).single(); if (!c) chatId = null; }
    if (!chatId) { const { data: c } = await sb.from("mansao_estudio_chats").insert({ estudio_id: id, title: String(message || "Nova conversa").slice(0, 60) }).select().single(); chatId = c.id; }
    else { const { data: cnt } = await sb.from("mansao_estudio_msgs").select("id").eq("chat_id", chatId).limit(1); if (!cnt || !cnt.length) await sb.from("mansao_estudio_chats").update({ title: String(message || "Nova conversa").slice(0, 60) }).eq("id", chatId); }
    await sb.from("mansao_estudio_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
    const { data: hist } = await sb.from("mansao_estudio_msgs").select("role, content").eq("chat_id", chatId).order("created_at").limit(40);
    const msgs: any[] = (hist || []).map((m: any) => ({ role: m.role, content: m.content.text || "" })).filter((m: any) => m.content);
    let userText = String(message || "").trim();
    if (attachments && attachments.length) userText += `\n\n[Arquivos enviados: ${attachments.map((a: any) => `${a.name} (${a.type}) ${a.url}`).join("; ")}]`;
    if (!userText) userText = "Oi";
    msgs.push({ role: "user", content: userText });
    await sb.from("mansao_estudio_msgs").insert({ estudio_id: id, chat_id: chatId, role: "user", content: { text: message || "", attachments: attachments || [] } });
    const bg: Promise<any>[] = []; const events: string[] = [];
    let convo: any[] = msgs.map((m) => ({ role: m.role, content: m.content }));
    let reply = "";
    for (let round = 0; round < 6; round++) {
      const res = await anthropic({ max_tokens: 1200, system: system(row), tools: TOOLS, messages: convo });
      const toolUses = (res.content || []).filter((c: any) => c.type === "tool_use");
      reply = text(res) || reply;
      if (!toolUses.length || res.stop_reason !== "tool_use") break;
      convo.push({ role: "assistant", content: res.content });
      const results: any[] = [];
      for (const t of toolUses) {
        let out: any = { ok: true };
        try {
          if (t.name === "save_profile") { const inp = t.input || {}; const patch: any = { answers: { ...(row.answers || {}) }, updated_at: new Date().toISOString() };
            for (const [k, v] of Object.entries(inp)) { if (!v) continue; if (k === "color1" || k === "color2" || k === "whatsapp" || k === "owner_name") patch[k] = k === "whatsapp" ? String(v).replace(/\D/g, "") : v; else patch.answers[k] = v; }
            await sb.from("mansao_estudio").update(patch).eq("id", id); row = { ...row, ...patch }; events.push("perfil"); out = { ok: true, salvo: Object.keys(inp) }; }
          else if (t.name === "set_logo") { await sb.from("mansao_estudio").update({ logo_url: t.input.url }).eq("id", id); row.logo_url = t.input.url; events.push("logo"); }
          else if (t.name === "generate_site") { await sb.from("mansao_estudio").update({ site_status: "generating" }).eq("id", id); row.site_status = "generating"; bg.push(genSite(sb, id)); events.push("site"); out = { ok: true, status: "generating", url: `https://mansaoempreendedora.com.br/estudio/?site=${row.slug}` }; }
          else if (t.name === "generate_posts") { await sb.from("mansao_estudio").update({ posts_status: "generating" }).eq("id", id); row.posts_status = "generating"; bg.push(genPosts(sb, id)); events.push("posts"); out = { ok: true, status: "generating" }; }
          else if (t.name === "generate_system") { await sb.from("mansao_estudio").update({ system_status: "generating", system_spec: t.input.spec || "" }).eq("id", id); row.system_status = "generating"; events.push("system"); out = { ok: true, status: "generating", url: `https://mansaoempreendedora.com.br/estudio/?app=${row.slug}` }; }
          else if (t.name === "create_video_job") { const urls: string[] = t.input.file_urls || []; const files = urls.map((u) => { const name = decodeURIComponent(u.split("/").pop() || "arquivo"); const ext = name.split(".").pop()?.toLowerCase() || ""; const type = ["mp4", "mov", "m4v", "webm"].includes(ext) ? "video/" + ext : "image/" + ext; return { url: u, name, type, path: u.split("/mansao-estudio/")[1] || "" }; });
            if (!files.length) throw new Error("sem arquivos"); await sb.from("mansao_estudio_video").insert({ estudio_id: id, files, brief: t.input.brief || "" }); events.push("video"); out = { ok: true, na_fila: files.length }; }
          else if (t.name === "get_status") { const { data: v } = await sb.from("mansao_estudio_video").select("status, result_url").eq("estudio_id", id); out = { site: row.site_status, posts: row.posts_status, sistema: row.system_status, videos: v || [], central: row.central_slug ? `https://mansaoempreendedora.com.br/central?c=${row.central_slug}` : null }; }
        } catch (e) { out = { error: String((e as Error).message || e) }; }
        results.push({ type: "tool_result", tool_use_id: t.id, content: JSON.stringify(out) });
      }
      convo.push({ role: "user", content: results });
    }
    if (!reply) reply = "Feito. Dá uma olhada no painel ao lado.";
    await sb.from("mansao_estudio_msgs").insert({ estudio_id: id, chat_id: chatId, role: "assistant", content: { text: reply, events } });
    // @ts-ignore EdgeRuntime existe no Supabase
    if (bg.length && typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(Promise.all(bg)); else if (bg.length) await Promise.all(bg);
    return json({ reply, events, chat_id: chatId });
  } catch (e) { console.error(e); return json({ error: String((e as Error).message || e) }, 500); }
});
