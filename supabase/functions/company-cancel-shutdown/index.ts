// Desligamento IMEDIATO das automações de uma empresa cancelada.
// Chamada pelo trigger do banco (pg_net) quando a empresa sai de 'active':
// 1) grava as 7 chaves de automação como desligadas (company_automation_settings);
// 2) arquiva e remove os grupos da empresa no banco do Marcelo (cross-conta) —
//    sem vínculo em marcelo_groups, nenhum job manda ranking/resumo/NPS no grupo.
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const AUTOMATION_KEYS = [
  "fechamento_dia", "csat", "nps", "resumo_diario",
  "lembretes_reuniao", "ranking_vendas", "relatorio_pdf",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const secret = Deno.env.get("CANCEL_SHUTDOWN_SECRET") || "";
    if (!secret || body.secret !== secret) return j({ error: "não autorizado" }, 401);
    const companyId = String(body.company_id || "");
    if (!companyId) return j({ error: "company_id obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) painel de automações: tudo OFF (idempotente)
    for (const key of AUTOMATION_KEYS) {
      await supabase.from("company_automation_settings").upsert(
        { company_id: companyId, automation_key: key, enabled: false, updated_at: new Date().toISOString() },
        { onConflict: "company_id,automation_key" },
      );
    }

    // 2) grupos no banco do Marcelo: arquivar + remover vínculo
    let groupsArchived = 0;
    const MURL = Deno.env.get("MARCELO_SUPABASE_URL") || "";
    const MKEY = Deno.env.get("MARCELO_SERVICE_KEY") || "";
    if (MURL && MKEY) {
      const marcelo = createClient(MURL, MKEY);
      const { data: groups } = await marcelo.from("marcelo_groups").select("*").eq("company_id", companyId);
      if (groups?.length) {
        await marcelo.from("marcelo_groups_archive").insert(
          groups.map((g: any) => ({ ...g, archived_at: new Date().toISOString(), archive_reason: "empresa cancelada (auto)" })),
        );
        await marcelo.from("marcelo_groups").delete().eq("company_id", companyId);
        groupsArchived = groups.length;
      }
    }

    console.log(`[cancel-shutdown] company=${companyId} keys=off groups_archived=${groupsArchived}`);
    return j({ ok: true, company_id: companyId, automation_keys_off: AUTOMATION_KEYS.length, groups_archived: groupsArchived });
  } catch (e) {
    console.error("[cancel-shutdown]", e);
    return j({ error: String((e as Error).message || e) }, 500);
  }
});
