import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHEETS_URL =
  "https://docs.google.com/spreadsheets/d/1ber4uoSTITnMwFWrRLUJ9o_22Z0dnXN3sUKl1dLmpP0/export?format=csv&gid=1914840166";

// Parse Brazilian number format: "1.234,56" or "1234,56" → number
function parseBRNumber(raw: string): number | null {
  if (!raw || raw.trim() === "" || raw.trim() === "-") return null;
  // Remove thousand separators (.) then replace decimal comma with dot
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Parse DD/MM/YYYY → YYYY-MM-DD
function parseBRDate(raw: string): string | null {
  if (!raw || raw.trim() === "") return null;
  const parts = raw.trim().split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

// Simple CSV parser — handles quoted fields with commas inside
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let inQuote = false;
    let current = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current);
    rows.push(fields);
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Create sync_run record
  const { data: runData, error: runError } = await supabase
    .from("facunicamps_sync_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (runError) {
    console.error("[facunicamps-sync] Failed to create sync_run:", runError);
    return new Response(
      JSON.stringify({ success: false, error: runError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const runId = runData.id;

  const markError = async (msg: string) => {
    await supabase
      .from("facunicamps_sync_runs")
      .update({ status: "error", error_message: msg, finished_at: new Date().toISOString() })
      .eq("id", runId);
  };

  try {
    // Fetch CSV — follow redirects
    console.log("[facunicamps-sync] Fetching CSV...");
    const resp = await fetch(SHEETS_URL, { redirect: "follow" });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} fetching CSV`);
    }
    const csvText = await resp.text();
    console.log(`[facunicamps-sync] CSV fetched, length=${csvText.length}`);

    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      throw new Error("CSV is empty or has only header");
    }

    // Skip header row (index 0)
    const dataRows = rows.slice(1);

    // Build insert batch
    const records: Record<string, unknown>[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const cols = dataRows[i];
      // Columns: Data da Venda, Vendedor(a), Cliente, Forma de Ingresso, Modalidade, Curso, Valor Matricula, Valor Total
      const rawDate = cols[0] ?? "";
      const vendedor = (cols[1] ?? "").trim();
      const cliente = (cols[2] ?? "").trim();
      const formaIngresso = (cols[3] ?? "").trim();
      const modalidade = (cols[4] ?? "").trim();
      const curso = (cols[5] ?? "").trim();
      const rawValorMatricula = cols[6] ?? "";
      const rawValorTotal = cols[7] ?? "";

      // Skip completely empty rows
      if (!rawDate.trim() && !vendedor && !cliente) continue;

      records.push({
        company_id: "1081cb78-bd6c-42b2-8a85-104ead3ecc18",
        data_venda: parseBRDate(rawDate),
        vendedor: vendedor || null,
        cliente: cliente || null,
        forma_ingresso: formaIngresso || null,
        modalidade: modalidade || null,
        curso: curso || null,
        valor_matricula: parseBRNumber(rawValorMatricula),
        valor_total: parseBRNumber(rawValorTotal),
        row_index: i + 2, // 1-based, accounting for header
      });
    }

    console.log(`[facunicamps-sync] Parsed ${records.length} rows`);

    // Truncate existing data
    const { error: truncError } = await supabase
      .from("facunicamps_matriculas")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all

    if (truncError) {
      throw new Error(`Failed to truncate: ${truncError.message}`);
    }

    // Insert in batches of 100
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from("facunicamps_matriculas")
        .insert(batch);
      if (insertError) {
        throw new Error(`Insert batch failed at row ${i}: ${insertError.message}`);
      }
      totalInserted += batch.length;
    }

    console.log(`[facunicamps-sync] Inserted ${totalInserted} rows`);

    // Mark success
    await supabase
      .from("facunicamps_sync_runs")
      .update({
        status: "success",
        rows_imported: totalInserted,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({ success: true, rows_imported: totalInserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[facunicamps-sync] Error:", msg);
    await markError(msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
