// kpi-manager-import: lê um arquivo (planilha, PDF ou foto/print) enviado no link
// gerencial de KPIs e devolve os valores por vendedor/KPI já casados com os
// cadastros da empresa. Não grava nada — o gestor revisa na tela e salva.
// Entrada: { code, kind: "text" | "image", text?, image_base64?, media_type?, unit_id? }
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-sonnet-5";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** normaliza nome pra casar "Maria Cristina" com "MARIA CRISTINA DIAS R. CUNHA" */
function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchByName<T extends { id: string; name: string }>(raw: string, list: T[]): T | null {
  const target = norm(raw);
  if (!target) return null;

  const exact = list.find((x) => norm(x.name) === target);
  if (exact) return exact;

  const starts = list.filter((x) => norm(x.name).startsWith(target) || target.startsWith(norm(x.name)));
  if (starts.length === 1) return starts[0];

  // casamento por tokens: precisa bater o primeiro nome + pelo menos mais um token
  const targetTokens = target.split(" ").filter((t) => t.length > 2);
  const scored = list
    .map((x) => {
      const tokens = norm(x.name).split(" ").filter((t) => t.length > 2);
      const shared = tokens.filter((t) => targetTokens.includes(t));
      const firstOk = tokens[0] && targetTokens[0] && tokens[0] === targetTokens[0];
      return { item: x, score: shared.length + (firstOk ? 1 : 0) };
    })
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score);

  if (scored.length && (scored.length === 1 || scored[0].score > scored[1].score)) return scored[0].item;
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { code, kind, text, image_base64, media_type, unit_id } = body || {};

    if (!code) return json({ error: "code obrigatório" }, 400);
    if (kind === "text" && !text) return json({ error: "texto vazio" }, 400);
    if (kind === "image" && !image_base64) return json({ error: "imagem vazia" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // valida o link e pega o escopo real da empresa (nunca confia na lista do cliente)
    const { data: boot, error: bootErr } = await supabase.rpc("kpi_manager_bootstrap", { p_code: code });
    if (bootErr) throw bootErr;
    if (!boot?.company_id) return json({ error: "Código inválido ou desativado" }, 403);

    const lockedUnit: string | null = boot.link_unit_id ?? null;
    const scopeUnit: string | null = lockedUnit || unit_id || null;

    const salespeople = ((boot.salespeople || []) as any[])
      .filter((sp) => !scopeUnit || sp.unit_id === scopeUnit)
      .map((sp) => ({ id: sp.id, name: sp.name }));
    const kpis = ((boot.kpis || []) as any[]).map((k) => ({
      id: k.id,
      name: k.name,
      kpi_type: k.kpi_type,
    }));

    if (salespeople.length === 0) return json({ error: "Nenhum vendedor no escopo do link" }, 400);
    if (kpis.length === 0) return json({ error: "Nenhum KPI ativo nesta empresa" }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY não configurada" }, 500);

    const prompt = `Você recebe um relatório de vendas de uma loja. Extraia os números por vendedor.

VENDEDORES CADASTRADOS (use exatamente estes nomes na resposta):
${salespeople.map((s) => `- ${s.name}`).join("\n")}

INDICADORES CADASTRADOS (use exatamente estes nomes na resposta):
${kpis.map((k) => `- ${k.name}${k.kpi_type === "monetary" ? " (valor em R$)" : k.kpi_type === "percentage" ? " (percentual)" : " (quantidade)"}`).join("\n")}

REGRAS:
- Responda SÓ com JSON, sem texto antes ou depois.
- Formato: {"date": "YYYY-MM-DD ou null", "rows": [{"salesperson": "nome", "values": {"nome do indicador": numero}}], "notes": "observação curta ou null"}
- Números em formato JSON puro: 1234.56 (nunca "1.234,56", nunca "R$").
- Se um vendedor do arquivo não estiver na lista, use o nome como aparece no arquivo — o sistema tenta casar depois.
- Se um indicador do arquivo não corresponder a nenhum da lista, ignore esse indicador.
- Não invente valores: só inclua o que está no arquivo.
- "date" é a data a que os números se referem, se o arquivo indicar. Senão null.`;

    const content: any[] =
      kind === "image"
        ? [
            {
              type: "image",
              source: { type: "base64", media_type: media_type || "image/png", data: image_base64 },
            },
            { type: "text", text: prompt },
          ]
        : [{ type: "text", text: `${prompt}\n\nCONTEÚDO DO ARQUIVO:\n${String(text).slice(0, 120000)}` }];

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[kpi-manager-import] anthropic error:", errText.slice(0, 500));
      return json({ error: "Falha ao ler o arquivo com a IA" }, 502);
    }

    const aiJson = await aiRes.json();
    const raw = (aiJson?.content || []).map((c: any) => c.text || "").join("\n");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "A IA não conseguiu extrair dados desse arquivo" }, 422);

    let parsed: any;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return json({ error: "Resposta da IA em formato inesperado" }, 422);
    }

    const cells: any[] = [];
    const unmatchedPeople = new Set<string>();
    const unmatchedKpis = new Set<string>();

    for (const row of parsed.rows || []) {
      const sp = matchByName(row.salesperson || "", salespeople);
      if (!sp) {
        if (row.salesperson) unmatchedPeople.add(String(row.salesperson));
        continue;
      }
      for (const [kpiName, value] of Object.entries(row.values || {})) {
        const kpi = matchByName(kpiName, kpis as any);
        if (!kpi) {
          unmatchedKpis.add(kpiName);
          continue;
        }
        const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
        if (!isFinite(num)) continue;
        cells.push({
          salesperson_id: sp.id,
          salesperson_name: sp.name,
          kpi_id: kpi.id,
          kpi_name: kpi.name,
          value: num,
        });
      }
    }

    return json({
      date: parsed.date || null,
      notes: parsed.notes || null,
      cells,
      unmatched_salespeople: Array.from(unmatchedPeople),
      unmatched_kpis: Array.from(unmatchedKpis),
    });
  } catch (err) {
    console.error("[kpi-manager-import] error:", err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
