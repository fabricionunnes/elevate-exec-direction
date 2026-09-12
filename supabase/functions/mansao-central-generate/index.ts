// Central de Processos da Mansão Empreendedora
// action=map  -> a partir das respostas do formulário, define os documentos (mapa)
// action=doc  -> gera o conteúdo HTML de um documento
import { createClient } from "@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = "claude-sonnet-5";

async function claude(system: string, user: string, maxTokens: number): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
}
const stripFences = (s: string) => s.replace(/^\s*```(?:json|html)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

function answersText(row: any): string {
  const a = row.answers || {};
  const lines = [`Empresa: ${row.company}`, `Dono/gestor: ${row.owner_name || "-"}`];
  for (const [k, v] of Object.entries(a)) {
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
    lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  }
  return lines.join("\n");
}

const MAP_SYSTEM = `Você é diretor comercial da UNV (Universidade Nacional de Vendas), especialista em estruturar processos comerciais de pequenas e médias empresas. Você vai desenhar a CENTRAL DE PROCESSOS de uma empresa a partir das respostas de um formulário.
Responda SOMENTE com JSON válido, sem comentários, sem markdown.`;

function mapPrompt(row: any): string {
  return `Respostas do formulário:
${answersText(row)}

Defina os documentos da Central de Processos desta empresa. Regras:
- Entre 12 e 16 documentos, específicos pra ESTA empresa (use o segmento, os nomes, os canais, as dores e os processos pedidos).
- Grupos, nesta ordem: "Comece aqui" (obrigatórios: id "inicio" = Como usar esta central + resumo da empresa e metas; id "plano" = Plano de implantação em fases), "Rotinas" (diária, semanal, mensal), "Processos" (POPs numerados POP-01, POP-02... cobrindo a jornada do lead ao pós-venda e as dores citadas), "Gestão" (indicadores e metas, reunião semanal, e o que mais fizer sentido).
- "kw": palavras-chave de busca sem acento, separadas por espaço (sinônimos que a pessoa digitaria).
- "objetivo": uma frase.

Formato:
{"docs":[{"id":"inicio","grp":"Comece aqui","title":"Como usar esta central","kw":"...","objetivo":"..."}, ...]}`;
}

const DOC_SYSTEM = `Você é diretor comercial da UNV escrevendo um documento da Central de Processos de um cliente. Escreva em português do Brasil, direto, prático, sem enrolação e sem jargão. Tudo tem que ser específico da empresa (nomes, canais, números e ferramentas que ela citou). Nada de "soluções inovadoras", nada de emoji.
Responda SOMENTE com um fragmento HTML (sem <html>, <head>, <body>, sem markdown, sem code fences) usando exatamente estas classes:
- <h1>Título</h1> e <p class="sub">uma linha explicando quando usar</p>
- <div class="popmeta"><div><b>Responsável</b>nome/cargo</div><div><b>Quando</b>gatilho ou frequência</div><div><b>Ferramenta</b>...</div><div><b>Indicador</b>...</div></div> (em POPs e rotinas)
- <h2>Seções</h2>, <p>, <ul>/<ol>
- Passo a passo: <div class="steps"><div class="step"><div><b>Nome do passo:</b> o que fazer, como e em quanto tempo.</div></div>...</div>
- Scripts e modelos de mensagem: <div class="scriptbox"><div class="t">Script · situação</div><p>texto pronto pra copiar</p></div>
- Checklist: <div class="check"><div class="t">Checklist</div><ul><li>item</li></ul></div>
- Erros comuns: <div class="warn">...</div>
- Recomendação da UNV: <div class="unv"><div class="t">★ Melhoria UNV</div><p>...</p></div>
- Números e metas: <div class="stat"><div><b>150</b><span>leads/mês</span></div>...</div> ou funil <div class="funil"><div class="fstep"><b>150</b><span>Leads</span></div>...</div>
- Tabelas quando comparar coisas: <div class="tablewrap"><table>...</table></div>
Referencie outros documentos pelo id entre colchetes, ex.: [POP-03] ou [plano]. Entre 450 e 900 palavras. Um documento que a pessoa lê e consegue executar sozinha hoje.`;

function docPrompt(row: any, doc: any, all: any[]): string {
  return `Respostas do formulário:
${answersText(row)}

Documentos da central (pra referência cruzada): ${all.map((d) => `${d.id} = ${d.title}`).join("; ")}

Escreva agora o documento:
id: ${doc.id}
grupo: ${doc.grp}
título: ${doc.title}
objetivo: ${doc.objetivo || ""}
${doc.id === "inicio" ? "Este é o documento de entrada: explique em 3 parágrafos como usar a central (busca, grupos, ordem), resuma a empresa, o cliente ideal, a oferta e as metas em <div class=\"stat\">, e liste os documentos por grupo com o id entre colchetes." : ""}
${doc.id === "plano" ? "Este é o plano de implantação: 4 ou 5 fases sequenciais, cada uma com objetivo em itálico e um checklist (<div class=\"check\">) citando os POPs pelo id entre colchetes. Fase 1 sempre é enxergar os números." : ""}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { action, id, docId } = body;
    if (!id) return json({ error: "id obrigatório" }, 400);
    const { data: row, error } = await sb.from("mansao_central").select("*").eq("id", id).single();
    if (error || !row) return json({ error: "central não encontrada" }, 404);

    if (action === "map") {
      await sb.from("mansao_central").update({ status: "generating", error: null, updated_at: new Date().toISOString() }).eq("id", id);
      let parsed: any = null; let lastOut = "";
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        const out = await claude(MAP_SYSTEM, mapPrompt(row), 8000); lastOut = out;
        const cleaned = stripFences(out); const i = cleaned.indexOf("{"); const j = cleaned.lastIndexOf("}");
        try { parsed = JSON.parse(cleaned.slice(i, j + 1)); } catch { parsed = null; }
      }
      if (!parsed) throw new Error("mapa inválido: " + lastOut.slice(0, 200));
      const docs = (parsed.docs || []).slice(0, 18);
      if (docs.length < 6) throw new Error("mapa com poucos documentos");
      await sb.from("mansao_central_docs").delete().eq("central_id", id);
      const rows = docs.map((d: any, i: number) => ({ central_id: id, doc_id: String(d.id), grp: String(d.grp), title: String(d.title), kw: String(d.kw || ""), objetivo: String(d.objetivo || ""), ord: i, status: "pending" }));
      const { error: e2 } = await sb.from("mansao_central_docs").insert(rows);
      if (e2) throw e2;
      return json({ ok: true, docs: rows.map((r: any) => ({ doc_id: r.doc_id, title: r.title, grp: r.grp })) });
    }

    if (action === "doc") {
      const { data: all } = await sb.from("mansao_central_docs").select("doc_id, title, grp, objetivo, status").eq("central_id", id).order("ord");
      const doc = (all || []).find((d: any) => d.doc_id === docId);
      if (!doc) return json({ error: "doc não encontrado" }, 404);
      try {
        const html = stripFences(await claude(DOC_SYSTEM, docPrompt(row, { id: doc.doc_id, grp: doc.grp, title: doc.title, objetivo: doc.objetivo }, (all || []).map((d: any) => ({ id: d.doc_id, title: d.title }))), 3500));
        await sb.from("mansao_central_docs").update({ html, status: "ready" }).eq("central_id", id).eq("doc_id", docId);
      } catch (e) {
        await sb.from("mansao_central_docs").update({ status: "error", html: `<h1>${doc.title}</h1><p class="sub">Não consegui gerar este documento. Tente de novo.</p>` }).eq("central_id", id).eq("doc_id", docId);
        throw e;
      }
      const { data: left } = await sb.from("mansao_central_docs").select("doc_id").eq("central_id", id).neq("status", "ready");
      if (!left || !left.length) await sb.from("mansao_central").update({ status: "ready", updated_at: new Date().toISOString() }).eq("id", id);
      return json({ ok: true, docId, remaining: left?.length ?? 0 });
    }
    return json({ error: "action inválida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
