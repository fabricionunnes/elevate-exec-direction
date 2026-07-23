import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Normaliza nome (minúsculo, sem acento, sem espaço extra) — pra casar KPI/vendedor
const norm = (t: unknown) =>
  String(t ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "use POST" }, 405);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1) Autentica pela chave do projeto
  const apiKey =
    req.headers.get("x-api-key") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    new URL(req.url).searchParams.get("key") ||
    "";
  if (!apiKey) return j({ ok: false, error: "chave de API ausente (x-api-key)" }, 401);

  const { data: keyRow } = await supabase
    .from("project_api_keys")
    .select("id, company_id, is_active, source")
    .eq("key", apiKey)
    .maybeSingle();
  if (!keyRow || !keyRow.is_active) return j({ ok: false, error: "chave inválida ou desativada" }, 401);
  const companyId = keyRow.company_id;

  let body: any;
  try { body = await req.json(); } catch { return j({ ok: false, error: "JSON inválido" }, 400); }

  // Aceita 1 lançamento ou uma lista
  const items: any[] = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [body];

  // Carrega vendedores e KPIs da empresa uma vez
  const [{ data: sps }, { data: kpis }] = await Promise.all([
    supabase.from("company_salespeople").select("id, name, email, phone, access_code").eq("company_id", companyId),
    supabase.from("company_kpis").select("id, name, is_active").eq("company_id", companyId),
  ]);
  const kpiByName = new Map((kpis || []).filter((k: any) => k.is_active !== false).map((k: any) => [norm(k.name), k.id]));

  const resolveSalesperson = (ref: unknown): string | null => {
    const r = norm(ref);
    const digits = String(ref ?? "").replace(/\D/g, "");
    for (const sp of (sps || [])) {
      if (r && (norm(sp.access_code) === r || norm(sp.email) === r || norm(sp.name) === r)) return sp.id;
      if (digits && sp.phone && String(sp.phone).replace(/\D/g, "").endsWith(digits.slice(-8))) return sp.id;
    }
    return null;
  };

  const today = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const results: any[] = [];
  let totalApplied = 0;

  for (const it of items) {
    const spRef = it.salesperson ?? it.vendedor ?? it.seller ?? it.salesperson_code ?? it.email;
    const salespersonId = resolveSalesperson(spRef);
    const entryDate = String(it.date ?? it.data ?? today).slice(0, 10);
    const kpiObj = it.kpis ?? it.indicadores ?? it.metrics ?? {};
    const unmatched: string[] = [];
    let applied = 0;

    if (!salespersonId) {
      results.push({ salesperson: spRef ?? null, status: "erro", error: "vendedor não encontrado" });
      await supabase.from("project_integration_events").insert({
        company_id: companyId, api_key_id: keyRow.id, source: it.source || keyRow.source,
        status: "erro", salesperson_ref: String(spRef ?? ""), entry_date: entryDate,
        kpis_applied: 0, raw_payload: it, error: "vendedor não encontrado",
      });
      continue;
    }

    for (const [rawName, rawVal] of Object.entries(kpiObj)) {
      const kpiId = kpiByName.get(norm(rawName));
      const value = Number(rawVal);
      if (!kpiId || Number.isNaN(value)) { unmatched.push(String(rawName)); continue; }
      const { error } = await supabase.from("kpi_entries").upsert({
        company_id: companyId, salesperson_id: salespersonId, kpi_id: kpiId,
        entry_date: entryDate, value, observations: "Via integração",
      }, { onConflict: "salesperson_id,kpi_id,entry_date" });
      if (!error) applied++;
    }

    totalApplied += applied;
    results.push({ salesperson: spRef, date: entryDate, applied, unmatched });
    await supabase.from("project_integration_events").insert({
      company_id: companyId, api_key_id: keyRow.id, source: it.source || keyRow.source,
      status: unmatched.length && !applied ? "erro" : "ok",
      salesperson_ref: String(spRef ?? ""), entry_date: entryDate,
      kpis_applied: applied, raw_payload: it,
      error: unmatched.length ? `KPIs não reconhecidos: ${unmatched.join(", ")}` : null,
    });
  }

  await supabase.from("project_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
  return j({ ok: true, applied: totalApplied, results });
});
