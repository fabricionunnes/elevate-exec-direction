// Estúdio da Mansão: gera site da empresa (HTML) e 5 posts de Instagram (JSON) com a marca do participante
import { createClient } from "@supabase/supabase-js";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const MODEL = "claude-sonnet-5";
async function claude(system: string, user: string, maxTokens: number): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY"); if (!key) throw new Error("ANTHROPIC_API_KEY não configurada");
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }) });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json(); return (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
}
async function claudeLong(system: string, user: string, maxTokens: number, endMarker: RegExp, rounds = 3): Promise<string> {
  let acc = "";
  for (let i = 0; i < rounds; i++) {
    const messages: any[] = [{ role: "user", content: user }];
    if (acc) messages.push({ role: "assistant", content: acc });
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key!, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }) });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json(); const part = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    acc += part;
    if (endMarker.test(acc) || j.stop_reason !== "max_tokens") break;
  }
  return acc;
}
const strip = (s: string) => s.replace(/^\s*```(?:json|html)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
function ctx(row: any) {
  const a = row.answers || {}; const lines = [`Empresa: ${row.company}`, `Dono: ${row.owner_name || "-"}`, `WhatsApp: ${row.whatsapp || "-"}`, `Cor principal: ${row.color1}`, `Cor secundária: ${row.color2}`, `Logo (URL): ${row.logo_url || "sem logo, usar o nome da empresa em texto"}`];
  for (const [k, v] of Object.entries(a)) { if (v === null || v === "" || (Array.isArray(v) && !v.length)) continue; lines.push(`${k}: ${Array.isArray(v) ? (v as any[]).join(", ") : v}`); }
  return lines.join("\n");
}
const SITE_SYS = `Você é um designer e copywriter sênior da UNV. Você cria sites institucionais de uma página, prontos, para pequenas empresas. Responda SOMENTE com um documento HTML completo (<!doctype html> até </html>), sem markdown e sem explicações.
Regras técnicas: CSS inline dentro de <style>, sem JavaScript externo, sem imagens externas exceto a URL da logo informada e fotos do Unsplash via https://images.unsplash.com (só se fizer sentido, com termos genéricos do segmento). Fonte do Google Fonts via <link>. Responsivo, leve, títulos e descrição preenchidos. Botão flutuante de WhatsApp (https://wa.me/55DDDNUMERO?text=...) em todas as seções. Use as duas cores da marca como paleta (fundo claro, cor principal em títulos e botões, secundária em detalhes).
Estrutura: header com logo (img) e menu de âncoras; hero com promessa clara e botão; seção "como funciona" em 3 passos; serviços (um card por serviço, com para quem é e resultado); diferenciais com prova; depoimentos (placeholder marcado entre colchetes); sobre o dono em primeira pessoa; FAQ com 4 perguntas; contato (WhatsApp, cidade, horário); rodapé.
Copy: português do Brasil, frases curtas, específico da empresa, sem "soluções inovadoras", cada botão diz o que acontece. Nada de lorem ipsum.`;
const POSTS_SYS = `Você é o head de conteúdo da UNV. Crie 5 posts de Instagram para a empresa descrita, prontos para arte: 3 para feed (1080x1350) e 2 para story (1080x1920). Responda SOMENTE com JSON válido:
{"posts":[{"format":"feed"|"story","layout":"stat"|"list"|"quote"|"cta"|"question","headline":"até 9 palavras, forte","sub":"até 18 palavras","bullets":["até 3 itens curtos, só em layout list"],"stat":"número + unidade, só em layout stat","cta":"até 5 palavras","caption":"legenda completa do post com 3 hashtags"}]}
Regras: cada post ataca uma dor real do cliente ideal ou mostra prova/diferencial; sem clichê; sem emoji na arte (pode na legenda); 1 post com o ponto de vista do dono; stories são curtos, com pergunta ou chamada direta.`;
const SYSTEM_SYS = `Você é um engenheiro de produto sênior da UNV. Você constrói MINI SISTEMAS DE GESTÃO completos para pequenas empresas em um único arquivo HTML. Responda SOMENTE com um documento HTML completo (<!doctype html> até </html>), sem markdown e sem explicações. Seja econômico no código: CSS enxuto (uma classe reutilizada por tipo de elemento), funções curtas e genéricas (um único renderTabela(config) pra todas as listas, um único formulário genérico), sem comentários; nada de repetir blocos parecidos. O arquivo inteiro deve ficar abaixo de 600 linhas e de 60 mil caracteres.
Regras técnicas: tudo em um arquivo (CSS em <style>, JS em <script>), sem bibliotecas externas exceto uma fonte do Google Fonts. Dados salvos no localStorage do navegador (chave com o nome da empresa), com botões Exportar/Importar JSON e Exportar CSV. Responsivo (funciona no celular). Gráficos desenhados em <canvas> puro. Sem lorem ipsum: já vem com 8 a 12 registros de exemplo coerentes com a empresa, marcados como exemplo e com botão "limpar exemplos".
Interface: cabeçalho com a logo (img da URL informada, ou o nome) e as cores da marca; navegação por abas; painel inicial com os indicadores que importam pra empresa (cards grandes) e um gráfico; formulários simples com validação; tabelas com filtro por período e busca; ações de editar, excluir, marcar como pago/feito; alertas do que está vencido ou pendente; um relatório do mês em texto que o dono pode copiar.
Conteúdo: construa exatamente o que o participante pediu na especificação, usando os termos do negócio dele (categorias, produtos, cargos). Se pediu financeiro: contas a pagar e a receber, fluxo de caixa mensal, categorias, DRE simplificado (receita, custos, despesas, resultado) e o que mais ele pediu. Português do Brasil, textos curtos e claros, sem emoji.`;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { action, id, pin } = await req.json();
    const { data: row } = await sb.from("mansao_estudio").select("*").eq("id", id).single();
    if (!row || row.pin !== String(pin)) return json({ error: "acesso negado" }, 403);
    if (action === "site") {
      await sb.from("mansao_estudio").update({ site_status: "generating" }).eq("id", id);
      try {
        let html = strip(await claude(SITE_SYS, `Dados da empresa:\n${ctx(row)}\n\nCrie o site completo agora.`, 12000));
        if (!/<html/i.test(html)) throw new Error("resposta sem HTML");
        await sb.from("mansao_estudio").update({ site_html: html, site_status: "ready", updated_at: new Date().toISOString() }).eq("id", id);
        return json({ ok: true, chars: html.length });
      } catch (e) { await sb.from("mansao_estudio").update({ site_status: "error" }).eq("id", id); throw e; }
    }
    if (action === "posts") {
      await sb.from("mansao_estudio").update({ posts_status: "generating" }).eq("id", id);
      try {
        const out = strip(await claude(POSTS_SYS, `Dados da empresa:\n${ctx(row)}\n\nCrie os 5 posts.`, 4000));
        const parsed = JSON.parse(out); const posts = (parsed.posts || []).slice(0, 5);
        if (posts.length < 5) throw new Error("menos de 5 posts");
        await sb.from("mansao_estudio").update({ posts, posts_status: "ready", updated_at: new Date().toISOString() }).eq("id", id);
        return json({ ok: true, posts });
      } catch (e) { await sb.from("mansao_estudio").update({ posts_status: "error" }).eq("id", id); throw e; }
    }
    if (action === "system") {
      const spec = String(row.system_spec || "").trim() || "mini sistema financeiro: contas a pagar e a receber, fluxo de caixa mensal, categorias, relatório do mês";
      await sb.from("mansao_estudio").update({ system_status: "generating" }).eq("id", id);
      const enc = new TextEncoder();
      const stream = new ReadableStream({
        async start(ctrl) {
          const keep = setInterval(() => { try { ctrl.enqueue(enc.encode(" ")); } catch (_) { /* fechado */ } }, 8000);
          try {
            let html = strip(await claudeLong(SYSTEM_SYS, `Dados da empresa:\n${ctx(row)}\n\nEspecificação do sistema pedida pelo participante:\n${spec}\n\nConstrua o sistema completo agora.`, 16000, /<\/html>\s*$/i, 2));
            if (!/<html/i.test(html)) throw new Error("resposta sem HTML");
            if (!/<\/html>/i.test(html)) html += "\n</script></body></html>";
            await sb.from("mansao_estudio").update({ system_html: html, system_status: "ready", updated_at: new Date().toISOString() }).eq("id", id);
            ctrl.enqueue(enc.encode("\n" + JSON.stringify({ ok: true, chars: html.length })));
          } catch (e) {
            await sb.from("mansao_estudio").update({ system_status: "error" }).eq("id", id);
            ctrl.enqueue(enc.encode("\n" + JSON.stringify({ error: String((e as Error).message || e) })));
          } finally { clearInterval(keep); try { ctrl.close(); } catch (_) { /* já fechado */ } }
        },
      });
      return new Response(stream, { headers: { ...CORS, "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" } });
    }
    return json({ error: "action inválida" }, 400);
  } catch (e) { console.error(e); return json({ error: String((e as Error).message || e) }, 500); }
});
