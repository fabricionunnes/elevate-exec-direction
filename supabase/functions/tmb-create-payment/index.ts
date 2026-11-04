// tmb-create-payment — gera o link de boleto parcelado da TMB (Tem Mais no Boleto) pro lead do CRM.
// Fabrício, 03/11/2026: "quero que a TMB cobre o valor que está no CRM do cliente, exatamente o que
// está lá". Por isso o valor NUNCA vem do corpo: é sempre crm_leads.opportunity_value.
// A TMB não tem "cobrança por cliente": o que existe é OFERTA de um produto (POST api/ofertas), que
// devolve um link de checkout. Criamos uma oferta por lead com o valor exato e guardamos o link.
// Documentação: https://info.tmbeducacao.com.br/portal-do-produtor/central-de-ajuda/produto/integracoes/tmb-api
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// trim: o segredo é colado num campo de várias linhas no painel do Supabase e pode vir com quebra no fim
const TMB_TOKEN = (Deno.env.get("TMB_API_TOKEN") || "").trim().replace(/^Bearer\s+/i, "");
const TMB_API = "https://api.tmbeducacao.com.br";
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function tmb(path: string, method: string, body?: unknown) {
  const res = await fetch(`${TMB_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TMB_TOKEN}`, "Content-Type": "application/json", Accept: "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
  return { ok: res.ok, status: res.status, data };
}

// ── Juros da TMB por conta da UNV (Fabrício, 04/11/2026: "calcular com base nas taxas da TMB, pra já
// calcular comigo pagando os juros e não o cliente"). O cliente paga EXATAMENTE o valor do CRM; o
// "valor principal" enviado à TMB é o valor do CRM dividido pelo fator de juros do parcelamento.
// Taxas oficiais do produto na TMB (Produtos > Ver Taxas, 04/11/2026): juros do financiamento
// 2,39% a.m. de 1 a 12 parcelas e 2,86% a.m. de 13 a 36; tabela Price com as n parcelas pós-pagas.
// Conferido no checkout da oferta de R$ 24.000: 12x = R$ 2.326 pela fórmula x R$ 2.324 na tela.
// Pode ser sobrescrito em crm_payment_provider_settings.config:
//   { "tmb_juros": "unv" | "cliente", "tmb_taxa_mensal_ate12": 0.0239, "tmb_taxa_mensal_13_36": 0.0286,
//     "tmb_fatores": { "12": 1.163 } (fator fixo por nº de parcelas, se um dia a fórmula desviar) }
function fatorTMB(n: number, cfg: any): { fator: number; origem: "tabela" | "formula"; taxa: number } {
  const tab = cfg?.tmb_fatores && typeof cfg.tmb_fatores === "object" ? cfg.tmb_fatores : {};
  const t = Number(tab[String(n)]);
  const i = n <= 12 ? (Number(cfg?.tmb_taxa_mensal_ate12) > 0 ? Number(cfg.tmb_taxa_mensal_ate12) : 0.0239) : (Number(cfg?.tmb_taxa_mensal_13_36) > 0 ? Number(cfg.tmb_taxa_mensal_13_36) : 0.0286);
  if (t > 1) return { fator: t, origem: "tabela", taxa: i };
  if (n <= 1) return { fator: 1 + i, origem: "formula", taxa: i };
  const A = (1 - Math.pow(1 + i, -n)) / i; // valor presente de n parcelas iguais (Price)
  return { fator: n / A, origem: "formula", taxa: i };
}
function simularTMB(amountCents: number, n: number, cfg: any) {
  const modo: "unv" | "cliente" = cfg?.tmb_juros === "cliente" ? "cliente" : "unv";
  const { fator, origem, taxa } = fatorTMB(n, cfg);
  // arredonda pra baixo: o cliente nunca paga mais que o valor do CRM
  const principalCents = modo === "unv" ? Math.floor(amountCents / fator) : amountCents;
  // Repasse estimado pra UNV: o que a TMB desconta do produtor (tela Finanças e contratos > Taxas,
  // 04/11/2026): comissão 5% (1 a 24 parcelas) + R$ 1,00 por operação de crédito. Saque R$ 1,99 fica fora.
  const taxaAdmin = Number(cfg?.tmb_taxa_admin) > 0 ? Number(cfg.tmb_taxa_admin) : 0.05;
  const taxaOperacaoCents = Number(cfg?.tmb_taxa_operacao_cents) >= 0 && cfg?.tmb_taxa_operacao_cents !== undefined ? Number(cfg.tmb_taxa_operacao_cents) : 100;
  const repasseCents = Math.max(0, Math.round(principalCents * (1 - taxaAdmin)) - taxaOperacaoCents);
  const parcelaCents = Math.round(amountCents / n);
  return { modo, fator: Math.round(fator * 100000) / 100000, origem, taxa_mensal: taxa, valor_cliente_cents: amountCents, parcela_cents: parcelaCents, principal_cents: principalCents, parcelas: n, taxa_admin: taxaAdmin, taxa_operacao_cents: taxaOperacaoCents, repasse_estimado_cents: repasseCents };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "use POST" }, 405);
  if (!req.headers.get("authorization")) return j({ ok: false, error: "não autenticado" }, 401);
  if (!TMB_TOKEN) return j({ ok: false, error: "TMB não configurada (falta o segredo TMB_API_TOKEN no servidor)" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any;
  try { body = await req.json(); } catch { return j({ ok: false, error: "JSON inválido" }); }

  // Lista de produtos da TMB (pra escolher em qual produto a oferta é criada)
  if (body.action === "produtos") {
    const r = await tmb("/api/produtos", "GET");
    if (!r.ok) return j({ ok: false, error: r.data?.message || r.data?.error || `TMB respondeu HTTP ${r.status}`, detail: r.data, token_len: TMB_TOKEN.length });
    const lista = (Array.isArray(r.data) ? r.data : []).map((p: any) => ({
      produto_id: p.produto_id, nome: p.produto_nome, descricao: p.descricao || null, valor: p.valor_total || null, ativo: p.ativo !== false,
    }));
    return j({ ok: true, produtos: lista });
  }

  // Oferta de TESTE direto na TMB (sem registro no CRM), pra investigar parâmetros do checkout
  if (body.action === "oferta_teste") {
    const payload: Record<string, unknown> = { titulo: String(body.titulo || "Teste Nexus"), produto_id: Number(body.produto_id) || 0, valor_principal: Number(body.valor_principal) || 0, qtd_parcelas: String(body.qtd_parcelas || "12") };
    if (body.valor_boleto_entrada) payload.valor_boleto_entrada = Number(body.valor_boleto_entrada);
    if (body.vencimento_boleto_entrada) payload.vencimento_boleto_entrada = String(body.vencimento_boleto_entrada);
    const r = await tmb("/api/oferta", "POST", payload);
    return j({ ok: r.ok, status: r.status, enviado: payload, resposta: r.data });
  }
  // Lista completa das ofertas de um produto (pra comparar as do portal com as da API)
  if (body.action === "ofertas") {
    const r = await tmb(`/api/oferta?produto_id=${Number(body.produto_id) || 0}`, "GET");
    return j({ ok: r.ok, status: r.status, ofertas: r.data });
  }
  // Diagnóstico: quais rotas da TMB respondem (sem criar nada)
  if (body.action === "diagnostico") {
    const pid = Number(body.produto_id) || 0;
    const rotas = [`/api/oferta?produto_id=${pid}`, `/api/ofertas?produto_id=${pid}`, `/api/produtos`, `/api/pedidos?produto_id=${pid}&pageSize=1`];
    const out: Record<string, unknown> = {};
    for (const rt of rotas) { const r = await tmb(rt, "GET"); out[rt] = { status: r.status, corpo: JSON.stringify(r.data).slice(0, 300) }; }
    return j({ ok: true, out });
  }

  // Simulação pro painel: quanto a TMB vai financiar pro cliente pagar o valor do CRM
  if (body.action === "simular") {
    const { data: st } = await supabase.from("crm_payment_provider_settings").select("config").eq("provider", "tmb").maybeSingle();
    const n = Math.max(1, Math.min(36, Math.round(Number(body.installments) || 12)));
    const cents = Math.max(0, Math.round(Number(body.amount_cents) || 0));
    return j({ ok: true, ...simularTMB(cents, n, (st as any)?.config) });
  }

  const { lead_id } = body;
  if (!lead_id) return j({ ok: false, error: "lead_id obrigatório" });

  const { data: lead } = await supabase.from("crm_leads")
    .select("id, name, email, phone, document, opportunity_value").eq("id", lead_id).maybeSingle();
  if (!lead) return j({ ok: false, error: "lead não encontrado" });

  // Valor: SEMPRE o valor do negócio no CRM (regra do Fabrício). O corpo não manda valor.
  const amountCents = Math.round(Number(lead.opportunity_value || 0) * 100);
  if (!amountCents || amountCents < 100) return j({ ok: false, error: "preencha o Valor do negócio na ficha do lead: a TMB cobra exatamente esse valor" });

  // Produto da TMB: o escolhido na tela ou o padrão salvo nas configurações do provedor
  const { data: stTmb } = await supabase.from("crm_payment_provider_settings").select("config").eq("provider", "tmb").maybeSingle();
  const cfgTmb = (stTmb as any)?.config || {};
  let produtoId = Number(body.produto_id) || 0;
  if (!produtoId) produtoId = Number(cfgTmb.produto_id) || 0;
  if (!produtoId) return j({ ok: false, error: "escolha o produto da TMB em que a oferta será criada" });

  const installments = Math.max(1, Math.min(36, Math.round(Number(body.installments) || 12)));
  const entryCents = Math.max(0, Math.round(Number(body.entry_cents) || 0));
  const entryDue = String(body.entry_due || "").slice(0, 10);
  if (entryDue && !/^\d{4}-\d{2}-\d{2}$/.test(entryDue)) return j({ ok: false, error: "vencimento da entrada inválido (use AAAA-MM-DD)" });
  if (entryCents && entryCents >= amountCents) return j({ ok: false, error: "a entrada precisa ser menor que o valor do negócio" });

  const sim = simularTMB(amountCents, installments, cfgTmb);
  const principalCents = sim.principal_cents;
  if (principalCents < 100) return j({ ok: false, error: "valor principal ficou abaixo de R$ 1,00 depois dos juros" });
  const notaJuros = sim.modo === "unv" ? ` · TMB financia R$ ${(principalCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (fator ${sim.fator.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}, juros por conta da UNV)` : "";
  const description = (String(body.description || `Boleto parcelado TMB — ${lead.name || "Cliente"}`) + notaJuros).slice(0, 240);

  // 1) Registra o pagamento do lead (o id curto vai no título da oferta pra casar o webhook)
  const { data: row, error: insErr } = await supabase.from("crm_lead_payments").insert({
    lead_id, amount_cents: amountCents, description, provider: "tmb",
    billing_type: "BOLETO_PARCELADO", recurring: false, installments, status: "pending",
  }).select("id").single();
  if (insErr || !row) return j({ ok: false, error: "falha ao registrar pagamento" }, 500);

  // 2) Cria a oferta na TMB com o valor exato do CRM
  const titulo = `${String(lead.name || "Cliente").slice(0, 60)} · ${row.id.slice(0, 8)}`;
  const payload: Record<string, unknown> = {
    titulo,
    produto_id: produtoId,
    valor_principal: principalCents / 100,
    qtd_parcelas: String(installments),
  };
  if (entryCents > 0) payload.valor_boleto_entrada = entryCents / 100;
  if (entryDue) payload.vencimento_boleto_entrada = entryDue;

  // A doc escreve "api/ofertas", mas a rota que existe é "api/oferta" (singular), conferido em
  // 03/11/2026: o plural devolve 404. Mantém o plural só como reserva.
  let r = await tmb("/api/oferta", "POST", payload);
  if (r.status === 404) r = await tmb("/api/ofertas", "POST", payload);
  // A TMB pode responder 200 com url "Não criado" (aconteceu com o produto inativo, 03/11/2026)
  const urlOk = typeof r.data?.url === "string" && /^https?:\/\//i.test(r.data.url);
  if (!r.ok || !urlOk) {
    await supabase.from("crm_lead_payments").update({ status: "error" }).eq("id", row.id);
    const corpo = r.data && Object.keys(r.data).length ? JSON.stringify(r.data).slice(0, 240) : "";
    const msg = r.data?.message || r.data?.error || r.data?.title || (r.data?.errors ? JSON.stringify(r.data.errors).slice(0, 200) : "") || (r.ok && r.data?.url ? `TMB não criou a oferta: ${r.data.status || r.data.url}. Confira se o produto está ativo na TMB.` : "") || `TMB recusou (HTTP ${r.status})${corpo ? `: ${corpo}` : ""}`;
    return j({ ok: false, error: msg, detail: r.data });
  }

  const url = String(r.data.url);
  const code = url.split("?")[0].replace(/\/+$/, "").split("/").pop() || "";

  // O lançamento no Financeiro nasce pelo webhook da TMB, parcela a parcela, quando o dinheiro
  // entra de fato (repasse). Link gerado não polui o Contas a Receber.
  await supabase.from("crm_lead_payments").update({
    provider_ref: code || null, url, updated_at: new Date().toISOString(),
  }).eq("id", row.id);

  return j({ ok: true, id: row.id, url, amount_cents: amountCents, principal_cents: principalCents, fator: sim.fator, modo_juros: sim.modo, installments, titulo });
});
