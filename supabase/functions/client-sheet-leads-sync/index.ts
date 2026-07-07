// client-sheet-leads-sync: importa leads de PLANILHAS Google (export CSV) pra
// aba Leads do Tráfego Pago do portal do cliente. Cada linha nova da planilha
// vira um lead em client_traffic_leads (source="planilha").
// Fontes cadastradas em client_sheet_lead_sources (project_id + csv_url).
// Dedup por meta_lead_id sintético ("sheet:<projeto>:<telefone|email|hash>:<data>").
// Roda por cron a cada 15 min e também aceita { projectId } / { sourceId } pra
// sincronizar uma fonte específica sob demanda (botão do portal).
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parser CSV correto: trata aspas, vírgula dentro de aspas e quebra de linha
// dentro de campo. Retorna matriz de linhas (cada linha = array de células).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
  }
  // última célula/linha (arquivo sem newline final)
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => (x || "").trim() !== ""));
}

const clean = (v: string | undefined) =>
  (v || "").replace(/_/g, " ").replace(/\s+/g, " ").trim();

const digits = (v: string | undefined) => (v || "").replace(/\D/g, "");

// "06/07/2026" (dd/mm/yyyy) -> "2026-07-06". Aceita também já em ISO.
function toIsoDate(v: string | undefined): string | null {
  const t = (v || "").trim();
  if (!t) return null;
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    let [, d, m, y] = br;
    if (y.length === 2) y = "20" + y;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

// Identifica o índice de uma coluna pelo cabeçalho (case-insensitive, contém).
function findCol(headers: string[], ...needles: string[]): number {
  for (const n of needles) {
    const idx = headers.findIndex((h) => h.toLowerCase().includes(n));
    if (idx >= 0) return idx;
  }
  return -1;
}

async function syncSource(supabase: any, src: any) {
  const res = await fetch(src.csv_url, { redirect: "follow" });
  if (!res.ok) {
    return { source_id: src.id, label: src.label, error: `HTTP ${res.status} ao ler a planilha` };
  }
  const csv = await res.text();
  const rows = parseCsv(csv);
  if (rows.length < 2) return { source_id: src.id, label: src.label, inserted: 0, note: "planilha vazia" };

  const headers = rows[0].map((h) => (h || "").trim());
  const iName = findCol(headers, "nome", "name", "full name");
  const iPhone = findCol(headers, "telefone", "phone", "whatsapp", "celular", "fone");
  const iEmail = findCol(headers, "email", "e-mail");
  const iDate = findCol(headers, "data", "date", "carimbo", "timestamp");
  const iCriativo = findCol(headers, "criativo", "anúncio", "anuncio", "creative", "ad ");

  // colunas "extras" (perguntas) = tudo que não é nome/telefone/email/data/criativo
  const known = new Set([iName, iPhone, iEmail, iDate, iCriativo].filter((x) => x >= 0));

  const projShort = String(src.project_id).slice(0, 8);
  const candidates: any[] = [];
  const keys: string[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const name = clean(iName >= 0 ? cols[iName] : "") || "Lead sem nome";
    const phone = iPhone >= 0 ? digits(cols[iPhone]) : "";
    const email = clean(iEmail >= 0 ? cols[iEmail] : "");
    const arrived = toIsoDate(iDate >= 0 ? cols[iDate] : "") || new Date().toISOString().slice(0, 10);
    const criativo = clean(iCriativo >= 0 ? cols[iCriativo] : "");

    // chave de dedup estável por linha
    const ident = phone || email.toLowerCase() || `${name}|${criativo}`.toLowerCase();
    const key = `sheet:${projShort}:${ident}:${arrived}`;

    // monta observações: criativo + respostas das perguntas + email
    const noteLines: string[] = [];
    if (criativo) noteLines.push(`Criativo: ${criativo}`);
    headers.forEach((h, idx) => {
      if (known.has(idx)) return;
      const val = clean(cols[idx]);
      if (h.trim() && val) noteLines.push(`${h.trim()}: ${val}`);
    });
    if (email) noteLines.push(`Email: ${email}`);

    candidates.push({
      project_id: src.project_id,
      name,
      phone: phone || null,
      arrived_at: arrived,
      source: "planilha",
      status: "novo",
      meta_lead_id: key,
      notes: noteLines.join(" · ") || null,
    });
    keys.push(key);
  }

  // dedup: descobre quais chaves já existem e insere só as novas
  const existing = new Set<string>();
  for (let i = 0; i < keys.length; i += 300) {
    const chunk = keys.slice(i, i + 300);
    const { data } = await supabase
      .from("client_traffic_leads")
      .select("meta_lead_id")
      .in("meta_lead_id", chunk);
    (data || []).forEach((d: any) => existing.add(d.meta_lead_id));
  }

  const toInsert = candidates.filter((c) => !existing.has(c.meta_lead_id));
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200);
    const { error, count } = await supabase
      .from("client_traffic_leads")
      .insert(batch, { count: "exact" });
    // ignora conflito de índice único (corrida com outra execução)
    if (!error) inserted += count ?? batch.length;
  }

  await supabase
    .from("client_sheet_lead_sources")
    .update({
      last_sync_at: new Date().toISOString(),
      last_result: { rows: candidates.length, inserted, skipped: candidates.length - inserted },
      updated_at: new Date().toISOString(),
    })
    .eq("id", src.id);

  return { source_id: src.id, label: src.label, rows: candidates.length, inserted, skipped: candidates.length - inserted };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    let query = supabase
      .from("client_sheet_lead_sources")
      .select("id, project_id, label, csv_url")
      .eq("enabled", true);
    if (body.sourceId) query = query.eq("id", body.sourceId);
    else if (body.projectId) query = query.eq("project_id", body.projectId);

    const { data: sources, error } = await query;
    if (error) throw new Error(`sources query: ${error.message || JSON.stringify(error)}`);

    const results = [];
    for (const src of sources || []) {
      try {
        results.push(await syncSource(supabase, src));
      } catch (e) {
        results.push({ source_id: src.id, label: src.label, error: String(e).slice(0, 200) });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || JSON.stringify(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
