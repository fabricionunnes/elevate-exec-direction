// agendor-sync: preenche automaticamente os KPIs da 3D Cure (Vendas e
// Faturamento) com os negócios GANHOS do Agendor, por vendedora e por dia.
// Substitui o lançamento manual: pra cada (vendedora, dia) na janela, apaga o
// lançamento existente desses 2 KPIs e grava o consolidado do Agendor.
// Entrada: { since?: "YYYY-MM-DD", days?: number, dry_run?: boolean }
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPANY_ID = "6e94acf4-4888-4c1c-bacd-0861ced43a87"; // 3D CURE
const KPI_FATURAMENTO = "43a48342-4902-4864-a891-9e344fa101a8";
const KPI_VENDAS = "afc2f5d1-535a-4990-8735-6db6c0ec4051";
const TAG = "[AGENDOR]";

// Lote que a Marianna marcou como ganho em 04/08 mas e venda de JULHO
// (decisao do Fabricio em 05/08): fica fora da sincronizacao.
const EXCLUDED_DEAL_IDS = new Set<number>([36667346, 38469679, 38878819, 39441050, 40724641, 42249914, 42296881, 42309620, 42383151, 42424855, 42876272, 42901588, 42934121, 42934983, 43128053, 43215378, 43325273, 43423148, 43496341, 43514562, 43606664, 43755036, 43909324, 43997389, 44013217, 44013570, 44013626, 44017966, 44019809, 44019937, 44020438, 44020656, 44458724, 44459377, 44461318, 44463075]);

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

/** casa "Karoliny Araújo" (Agendor) com "Karoliny Stefany Gomes de Araujo" (Nexus) */
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

/** data BRT (UTC-3) de um ISO */
const brDate = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const token = Deno.env.get("AGENDOR_TOKEN_3DCURE");
    if (!token) return json({ error: "AGENDOR_TOKEN_3DCURE não configurado" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Number(body.days || 0) || 0, 120);
    const sinceStr: string = body.since ||
      (days > 0
        ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
        : new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10));
    const dryRun = !!body.dry_run;
    const cutoffMs = new Date(`${sinceStr}T00:00:00-03:00`).getTime();

    // 1) negócios ganhos na janela — a lista vem por atualização desc; negócio
    //    ganho na janela foi atualizado na janela, então paginamos enquanto a
    //    página ainda tiver registros atualizados dentro dela (com margem).
    const won: { date: string; owner: string; value: number; id: number }[] = [];
    let stale = 0;
    for (let page = 1; page <= 60; page++) {
      const resp = await fetch(
        `https://api.agendor.com.br/v3/deals?dealStatus=2&per_page=100&page=${page}`,
        { headers: { Authorization: `Token ${token}` } }
      );
      if (!resp.ok) return json({ error: `Agendor ${resp.status}: ${(await resp.text()).slice(0, 200)}` }, 502);
      const data = (await resp.json()).data || [];
      if (data.length === 0) break;

      let pageHasFresh = false;
      for (const d of data) {
        const upd = d.updatedAt || d.wonAt || d.createdAt;
        if (upd && new Date(upd).getTime() >= cutoffMs) pageHasFresh = true;
        if (!d.wonAt) continue;
        // A venda conta na DATA DE FECHAMENTO do negócio (endTime) — é a régua
        // que o painel do Agendor usa e o que a cliente enxerga. Antes usávamos
        // a data em que o ganho foi marcado (wonAt): quem marcasse um lote
        // retroativo jogava tudo no dia do clique (foi o caso do lote de julho
        // da Marianna, que precisou de exclusão manual). Sem endTime, cai no
        // wonAt como antes.
        // endTime é DATA pura (vem 00:00Z): usar direto, sem converter fuso —
        // brDate() subtrai 3h e jogaria a venda pro dia anterior. Só o wonAt,
        // que é instante real, precisa da conversão pra Brasília.
        const refData = d.endTime || d.wonAt;
        const dataVenda = d.endTime ? String(d.endTime).slice(0, 10) : brDate(d.wonAt);
        if (new Date(refData).getTime() < cutoffMs) continue;
        if (EXCLUDED_DEAL_IDS.has(d.id)) continue;
        won.push({
          date: dataVenda,
          owner: d.owner?.name || "",
          value: Number(d.value) || 0,
          id: d.id,
        });
      }
      if (!pageHasFresh) stale++; else stale = 0;
      if (stale >= 2) break; // duas páginas seguidas sem nada na janela: acabou
    }

    // 2) vendedoras do Nexus
    const { data: sellers } = await supabase
      .from("company_salespeople")
      .select("id, name, unit_id, team_id, sector_id")
      .eq("company_id", COMPANY_ID)
      .eq("is_active", true);

    // 3) agrega por (vendedora, dia)
    const agg = new Map<string, { spId: string; date: string; count: number; value: number }>();
    const unmatched = new Map<string, number>();
    for (const w of won) {
      const sp = matchByName(w.owner, (sellers || []) as any[]);
      if (!sp) {
        unmatched.set(w.owner, (unmatched.get(w.owner) || 0) + 1);
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
        deals_na_janela: won.length,
        dias_vendedora: agg.size,
        nao_mapeados: Object.fromEntries(unmatched),
        resumo: Array.from(agg.values()).map((a) => ({
          vendedora: (sellers || []).find((s: any) => s.id === a.spId)?.name,
          ...a,
        })),
      });
    }

    // 4) substitui o lançamento do dia (só os 2 KPIs, só vendedoras mapeadas,
    //    só dias na janela) e grava o consolidado do Agendor
    const spById = new Map((sellers || []).map((s: any) => [s.id, s]));
    let written = 0;
    for (const a of agg.values()) {
      const sp = spById.get(a.spId);
      for (const [kpiId, value] of [[KPI_FATURAMENTO, a.value], [KPI_VENDAS, a.count]] as [string, number][]) {
        await supabase.from("kpi_entries").delete()
          .eq("company_id", COMPANY_ID)
          .eq("kpi_id", kpiId)
          .eq("salesperson_id", a.spId)
          .eq("entry_date", a.date);
        const { error } = await supabase.from("kpi_entries").insert({
          company_id: COMPANY_ID,
          kpi_id: kpiId,
          salesperson_id: a.spId,
          entry_date: a.date,
          value,
          unit_id: sp?.unit_id ?? null,
          team_id: sp?.team_id ?? null,
          sector_id: sp?.sector_id ?? null,
          observations: `${TAG} sync automático do Agendor`,
        });
        if (error) console.error("[agendor-sync] insert:", error.message);
        else written++;
      }
    }

    return json({
      ok: true,
      since: sinceStr,
      deals_na_janela: won.length,
      lancamentos_gravados: written,
      nao_mapeados: Object.fromEntries(unmatched),
    });
  } catch (err) {
    console.error("[agendor-sync] erro:", err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
