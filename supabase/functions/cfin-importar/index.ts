// Importação de extratos/despesas/retiradas por imagem ou PDF (Claude vision)
// Recebe { tipo, media_type, file_base64 } e devolve { linhas: [...] } para prévia no frontend.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPTS: Record<string, string> = {
  extrato: `Você está lendo um EXTRATO BANCÁRIO brasileiro (imagem ou PDF).
Extraia TODAS as movimentações visíveis. Para cada linha:
- data: data da movimentação em formato ISO (YYYY-MM-DD). Se o ano não aparecer, deduza pelo contexto do extrato.
- descricao: descrição/histórico completo da movimentação.
- debito: valor numérico se for SAÍDA (pagamento, débito, transferência enviada, tarifa), senão null.
- credito: valor numérico se for ENTRADA (recebimento, depósito, PIX recebido), senão null.
Exatamente um entre debito/credito deve estar preenchido. Valores sempre positivos.
IGNORE linhas de saldo (saldo anterior, saldo do dia, saldo final) — só movimentações reais.`,
  despesas: `Você está lendo um documento de DESPESAS (conta, boleto, fatura, lista de despesas — imagem ou PDF).
Extraia cada despesa:
- data: vencimento ou data da despesa em ISO (YYYY-MM-DD), null se não houver.
- descricao: descrição da despesa (fornecedor, serviço).
- debito: valor da despesa (numérico positivo). Use sempre o campo debito; credito sempre null.`,
  retiradas: `Você está lendo um documento de RETIRADAS de dinheiro das lojas (imagem ou PDF).
Extraia cada retirada:
- data: data em ISO (YYYY-MM-DD), null se não houver.
- descricao: descrição (ex: RETIRADA EM DINHEIRO, depósito).
- debito: valor da retirada (numérico positivo). Use sempre o campo debito; credito sempre null.`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { tipo, media_type, file_base64 } = await req.json();
    if (!PROMPTS[tipo]) throw new Error(`tipo inválido: ${tipo}`);
    if (!file_base64 || !media_type) throw new Error("arquivo ausente");

    const isPdf = media_type === "application/pdf";
    const contentBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file_base64 } }
      : { type: "image", source: { type: "base64", media_type, data: file_base64 } };

    const keys = [Deno.env.get("ANTHROPIC_API_KEY"), Deno.env.get("CLAUDE_API_KEY")].filter(Boolean) as string[];
    if (!keys.length) throw new Error("ANTHROPIC_API_KEY não configurada");

    let resp: Response | null = null;
    let lastErr = "";
    for (const apiKey of keys) {
      resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        tools: [{
          name: "registrar_linhas",
          description: "Registra as linhas extraídas do documento",
          input_schema: {
            type: "object",
            properties: {
              linhas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    data: { type: ["string", "null"], description: "YYYY-MM-DD" },
                    descricao: { type: "string" },
                    debito: { type: ["number", "null"] },
                    credito: { type: ["number", "null"] },
                  },
                  required: ["descricao"],
                },
              },
            },
            required: ["linhas"],
          },
        }],
        tool_choice: { type: "tool", name: "registrar_linhas" },
        messages: [{
          role: "user",
          content: [
            contentBlock,
            { type: "text", text: PROMPTS[tipo] },
          ],
        }],
      }),
    });

      if (resp.ok) break;
      lastErr = `(${resp.status}) ${(await resp.text()).slice(0, 300)}`;
      resp = null;
    }

    let linhas: unknown[] = [];
    if (resp) {
      const data = await resp.json();
      const toolUse = (data.content ?? []).find((c: { type: string }) => c.type === "tool_use");
      linhas = toolUse?.input?.linhas ?? [];
    } else {
      // fallback: OpenAI Responses API (gpt-4o) — aceita imagem e PDF
      const oaKey = Deno.env.get("OPENAI_API_KEY");
      if (!oaKey) throw new Error(`API de IA falhou: ${lastErr}`);
      const oaContent = [
        isPdf
          ? { type: "input_file", filename: "documento.pdf", file_data: `data:application/pdf;base64,${file_base64}` }
          : { type: "input_image", image_url: `data:${media_type};base64,${file_base64}` },
        { type: "input_text", text: `${PROMPTS[tipo]}\n\nResponda APENAS com JSON válido no formato {"linhas":[{"data":"YYYY-MM-DD"|null,"descricao":"...","debito":number|null,"credito":number|null}]} — sem markdown, sem texto extra.` },
      ];
      const oaResp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${oaKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o", max_output_tokens: 16000, input: [{ role: "user", content: oaContent }] }),
      });
      if (!oaResp.ok) {
        const oaErr = (await oaResp.text()).slice(0, 300);
        throw new Error(`IA indisponível. Anthropic: ${lastErr} | OpenAI: (${oaResp.status}) ${oaErr}`);
      }
      const oaData = await oaResp.json();
      const txt = (oaData.output ?? []).flatMap((o: { content?: { type: string; text?: string }[] }) => o.content ?? [])
        .filter((c: { type: string }) => c.type === "output_text")
        .map((c: { text?: string }) => c.text ?? "").join("");
      const jsonTxt = txt.replace(/^```json?\s*|\s*```$/g, "").trim();
      linhas = JSON.parse(jsonTxt).linhas ?? [];
    }

    return new Response(JSON.stringify({ linhas }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
