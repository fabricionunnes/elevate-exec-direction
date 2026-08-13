// bitrix-sync: preenche automaticamente os KPIs da 2M Gestão (Vendas e
// Faturamento) com os negócios GANHOS do Bitrix24, por vendedor e por dia.
// Mesma régua das outras integrações (Agendor/WinDash): pra cada (vendedor, dia)
// na janela, apaga o lançamento existente desses KPIs e grava o consolidado.
//
// A venda conta na DATA DE FECHAMENTO do negócio (CLOSEDATE) — é o que o painel
// do Bitrix mostra e o que o cliente enxerga.
//
// Credencial: webhook de ENTRADA do Bitrix, guardado no secret BITRIX_WEBHOOK_2M
// (formato https://portal.bitrix24.com.br/rest/<id>/<token>/). O token nunca é
// devolvido na resposta nem escrito em log.
//
// Entradas:
//   { action: "ping" }    → confere se o webhook responde (não grava nada)
//   { action: "users" }   → lista os usuários do Bitrix (pra mapear vendedores)
//   { action: "stages" }  → lista funis e etapas (pra conferir o que é "ganho")
//   { since?: "YYYY-MM-DD", days?: number, dry_run?: boolean } → sincroniza
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPANY_ID = "8ec159d5-c560-4556-85e5-b69a04bc7f21"; // 2M Gestão e Treinamentos
const KPI_VENDAS = "416c53be-bf98-4f75-ab09-8ece021d1e9c";
const KPI_FATURAMENTO = "a4cbe40a-9b6d-4e71-98f8-1b0b21111b4c";
const TAG = "[BITRIX]";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** casa "Karoliny Araújo" (origem) com "Karoliny Stefany Gomes de Araujo" (Nexus) */
function matchByName<T extends { id: string; name: string }>(raw: string, list: T[]): T | null {
  const target = norm(raw);
  if (!target) return null;
  const exact = list.find((x) => norm(x.name) === target);
  if (exact) return exact;
  const tTok = target.split(" ").filter((t) => t.length > 2);
  const scored = list
    .map((x) => {
      const tok = norm(x.name).split(" ").filter((t) => t.length > 2);
      const shared = tok.filter((t) => tTok.includes(t));
      const firstOk = tok[0] && tTok[0] && tok[0] === tTok[0];
      return { item: x, score: shared.length + (firstOk ? 1 : 0), firstOk };
    })
    .filter((s) => s.firstOk && s.score >= 2)
    .sort((a, b) => b.score - a.score);
  if (scored.length && (scored.length === 1 || scored[0].score > scored[1].score)) return scored[0].item;
  return null;
}

/** CLOSEDATE vem como "2026-08-13T00:00:00+03:00" (fuso do portal). A parte da
 *  data já é o dia que o portal considera fechado — usar direto, sem converter
 *  fuso, senão a venda pula pro dia anterior. */
const dayOf = (v: string) => String(v || "").slice(0, 10);

/** chamada REST do Bitrix. Nunca loga a URL completa (contém o token). */
async function bx(base: string, method: string, params: Record<string, unknown> = {}) {
  const resp = await fetch(`${base}${method}.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const text = await resp.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method}: resposta inválida do Bitrix (HTTP ${resp.status})`);
  }
  if (!resp.ok || data?.error) {
    const desc = data?.error_description || data?.error || `HTTP ${resp.status}`;
    throw new Error(`${method}: ${String(desc).slice(0, 200)}`);
  }
  return data;
}

/** percorre todas as páginas de um método de lista do Bitrix (50 por vez) */
async function bxList(base: string, method: string, params: Record<string, unknown>) {
  const out: any[] = [];
  let start = 0;
  for (let i = 0; i < 200; i++) {
    const data = await bx(base, method, { ...params, start });
    const rows = data?.result || [];
    out.push(...(Array.isArray(rows) ? rows : []));
    if (data?.next === undefined || data?.next === null) break;
    start = Number(data.next);
    if (!Number.isFinite(start)) break;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const raw = Deno.env.get("BITRIX_WEBHOOK_2M");
    if (!raw) {
      return json({
        error: "BITRIX_WEBHOOK_2M não configurado",
        como_resolver:
          "No Bitrix: Aplicativos → Webhooks → Webhook de entrada, marcando as permissões CRM e Usuários. " +
          "Copie a URL gerada e salve no secret BITRIX_WEBHOOK_2M do Supabase.",
      }, 500);
    }
    const base = raw.trim().endsWith("/") ? raw.trim() : raw.trim() + "/";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action || "sync");

    // --- diagnóstico: o webhook responde? (não devolve nada sensível)
    if (action === "ping") {
      const me = await bx(base, "profile");
      return json({
        ok: true,
        portal: String(base).replace(/\/rest\/.*$/, ""),
        conectado_como: me?.result?.NAME
          ? `${me.result.NAME} ${me.result.LAST_NAME || ""}`.trim()
          : me?.result?.ID || null,
        admin: !!me?.result?.ADMIN,
      });
    }

    // --- usuários do Bitrix (pra cadastrar/mapear os vendedores no Nexus)
    if (action === "users") {
      const users = await bxList(base, "user.get", { FILTER: { ACTIVE: true } });
      const { data: sellers } = await supabase
        .from("company_salespeople")
        .select("id, name")
        .eq("company_id", COMPANY_ID)
        .eq("is_active", true);
      return json({
        ok: true,
        total: users.length,
        usuarios: users.map((u: any) => {
          const nome = `${u.NAME || ""} ${u.LAST_NAME || ""}`.trim() || u.EMAIL || `ID ${u.ID}`;
          return {
            bitrix_id: u.ID,
            nome,
            email: u.EMAIL || null,
            cargo: u.WORK_POSITION || null,
            ja_no_nexus: !!matchByName(nome, (sellers || []) as any[]),
          };
        }),
      });
    }

    // --- funis e etapas (pra conferir o que o portal considera "ganho")
    if (action === "stages") {
      const cats = await bxList(base, "crm.dealcategory.list", {});
      const funis: Record<string, unknown> = {};
      for (const c of [{ ID: 0, NAME: "Geral (padrão)" }, ...cats]) {
        const st = await bx(base, "crm.dealcategory.stage.list", { id: c.ID });
        funis[`${c.ID} — ${c.NAME}`] = (st?.result || []).map((s: any) => ({
          id: s.STATUS_ID,
          nome: s.NAME,
        }));
      }
      return json({ ok: true, funis });
    }

    // --- sincronização
    const days = Math.min(Number(body.days || 0) || 0, 120);
    const sinceStr: string = body.since ||
      (days > 0
        ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
        : new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10));
    const dryRun = !!body.dry_run;

    // 1) negócios GANHOS fechados dentro da janela.
    //    STAGE_SEMANTIC_ID = "S" é o marcador de sucesso do Bitrix — pega o
    //    ganho de qualquer funil, sem depender do nome da etapa.
    const deals = await bxList(base, "crm.deal.list", {
      filter: { STAGE_SEMANTIC_ID: "S", ">=CLOSEDATE": `${sinceStr}T00:00:00` },
      select: ["ID", "TITLE", "OPPORTUNITY", "CURRENCY_ID", "CLOSEDATE", "ASSIGNED_BY_ID", "CATEGORY_ID"],
      order: { CLOSEDATE: "DESC" },
    });

    const won = deals
      .map((d: any) => ({
        id: d.ID,
        date: dayOf(d.CLOSEDATE),
        value: Number(d.OPPORTUNITY) || 0,
        userId: String(d.ASSIGNED_BY_ID || ""),
        moeda: d.CURRENCY_ID || null,
      }))
      .filter((d) => d.date >= sinceStr);

    // 2) nome do responsável de cada negócio
    const userIds = [...new Set(won.map((w) => w.userId).filter(Boolean))];
    const nomePorId = new Map<string, string>();
    if (userIds.length) {
      const users = await bxList(base, "user.get", { FILTER: { ID: userIds } });
      for (const u of users) {
        nomePorId.set(
          String(u.ID),
          `${u.NAME || ""} ${u.LAST_NAME || ""}`.trim() || u.EMAIL || `ID ${u.ID}`,
        );
      }
    }

    // 3) vendedores do Nexus
    const { data: sellers } = await supabase
      .from("company_salespeople")
      .select("id, name, unit_id, team_id, sector_id")
      .eq("company_id", COMPANY_ID)
      .eq("is_active", true);

    // sem vendedor cadastrado não dá pra gravar; na simulação segue assim mesmo,
    // porque o resultado (tudo em "nao_mapeados") é justamente a distribuição de
    // vendas por usuário do Bitrix — o que se usa pra decidir quem cadastrar.
    if (!dryRun && (!sellers || sellers.length === 0)) {
      return json({
        error: "Nenhum vendedor ativo cadastrado para a 2M no Nexus",
        como_resolver:
          "Cadastre os vendedores em Configurações → Vendedores (rode action:'users' pra ver os nomes " +
          "que existem no Bitrix) antes de sincronizar.",
        negocios_ganhos_na_janela: won.length,
      }, 409);
    }

    // 4) agrega por (vendedor, dia)
    const agg = new Map<string, { spId: string; date: string; count: number; value: number }>();
    const unmatched = new Map<string, number>();
    const moedas = new Set<string>();
    for (const w of won) {
      if (w.moeda) moedas.add(String(w.moeda));
      const nome = nomePorId.get(w.userId) || "";
      const sp = sellers && sellers.length ? matchByName(nome, sellers as any[]) : null;
      if (!sp) {
        const chave = nome || `ID ${w.userId}`;
        unmatched.set(chave, (unmatched.get(chave) || 0) + 1);
        continue;
      }
      const key = `${sp.id}|${w.date}`;
      const cur = agg.get(key) || { spId: sp.id, date: w.date, count: 0, value: 0 };
      cur.count += 1;
      cur.value += w.value;
      agg.set(key, cur);
    }

    if (dryRun) {
      return json({
        ok: true,
        dry_run: true,
        since: sinceStr,
        negocios_ganhos: won.length,
        dias_vendedor: agg.size,
        moedas: [...moedas],
        nao_mapeados: Object.fromEntries(unmatched),
        resumo: Array.from(agg.values()).map((a) => ({
          vendedor: ((sellers || []) as any[]).find((s) => s.id === a.spId)?.name,
          ...a,
        })),
      });
    }

    // 5) substitui o lançamento do dia (só esses 2 KPIs, só vendedores mapeados,
    //    só dias dentro da janela). Feito em lote: uma carga de 24 meses tem
    //    centenas de (vendedor, dia) e apagar/gravar um a um estoura o limite de
    //    150s da edge function.
    const spById = new Map(((sellers || []) as any[]).map((s) => [s.id, s]));
    const alvos = Array.from(agg.values());
    const linhas: Record<string, unknown>[] = [];
    for (const a of alvos) {
      const sp = spById.get(a.spId);
      for (const [kpiId, value] of [[KPI_FATURAMENTO, a.value], [KPI_VENDAS, a.count]] as [string, number][]) {
        linhas.push({
          company_id: COMPANY_ID,
          kpi_id: kpiId,
          salesperson_id: a.spId,
          entry_date: a.date,
          value,
          unit_id: sp?.unit_id ?? null,
          team_id: sp?.team_id ?? null,
          sector_id: sp?.sector_id ?? null,
          observations: `${TAG} sync automático do Bitrix24`,
        });
      }
    }

    // apaga o que já existia nessas combinações, em paralelo por blocos
    const CONC = 25;
    for (let i = 0; i < alvos.length; i += CONC) {
      await Promise.all(alvos.slice(i, i + CONC).map((a) =>
        supabase.from("kpi_entries").delete()
          .eq("company_id", COMPANY_ID)
          .in("kpi_id", [KPI_FATURAMENTO, KPI_VENDAS])
          .eq("salesperson_id", a.spId)
          .eq("entry_date", a.date)
      ));
    }

    // grava tudo de uma vez, em blocos
    let written = 0;
    const LOTE = 500;
    for (let i = 0; i < linhas.length; i += LOTE) {
      const { error } = await supabase.from("kpi_entries").insert(linhas.slice(i, i + LOTE));
      if (error) console.error("[bitrix-sync] insert:", error.message);
      else written += Math.min(LOTE, linhas.length - i);
    }

    return json({
      ok: true,
      since: sinceStr,
      negocios_ganhos: won.length,
      lancamentos_gravados: written,
      moedas: [...moedas],
      nao_mapeados: Object.fromEntries(unmatched),
    });
  } catch (err) {
    console.error("[bitrix-sync] erro:", (err as Error)?.message || err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
