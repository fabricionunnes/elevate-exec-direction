import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

type ImportType = "receivables" | "payables";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  type: ImportType;
  onImported: () => void;
}

interface ParsedRow {
  [key: string]: string | number | null;
}

// Column mapping from spreadsheet header to DB field
const PAYABLES_COLUMN_MAP: Record<string, string> = {
  "identificador do fornecedor": "entity_identifier",
  "nome do fornecedor": "supplier_name",
  "código de referência": "reference_code",
  "codigo de referencia": "reference_code",
  "data de competência": "competence_date",
  "data de competencia": "competence_date",
  "data de vencimento": "due_date",
  "data prevista": "expected_date",
  "recorrência": "recurrence_type",
  "recorrencia": "recurrence_type",
  "quantidade de recorrência": "recurrence_count",
  "quantidade de recorrencia": "recurrence_count",
  "descrição": "description",
  "descricao": "description",
  "origem do lançamento": "origin",
  "origem do lancamento": "origin",
  "situação": "status_raw",
  "situacao": "status_raw",
  "agendado": "scheduled_raw",
  "valor original da parcela (r$)": "amount",
  "valor original da parcela": "amount",
  "forma de pagamento": "payment_method_name",
  "valor pago da parcela (r$)": "paid_amount",
  "valor pago da parcela": "paid_amount",
  "juros realizado (r$)": "interest_paid",
  "juros realizado": "interest_paid",
  "multa realizado (r$)": "penalty_paid",
  "multa realizado": "penalty_paid",
  "desconto realizado (r$)": "discount_paid",
  "desconto realizado": "discount_paid",
  "valor total pago da parcela (r$)": "_total_paid",
  "valor total pago da parcela": "_total_paid",
  "valor da parcela em aberto (r$)": "_open_amount",
  "valor da parcela em aberto": "_open_amount",
  "juros previsto (r$)": "interest_expected",
  "juros previsto": "interest_expected",
  "multa previsto (r$)": "penalty_expected",
  "multa previsto": "penalty_expected",
  "desconto previsto (r$)": "discount_expected",
  "desconto previsto": "discount_expected",
  "valor total da parcela em aberto (r$)": "_total_open",
  "valor total da parcela em aberto": "_total_open",
  "conta bancária": "bank_account_name",
  "conta bancaria": "bank_account_name",
  "data do último pagamento": "paid_at",
  "data do ultimo pagamento": "paid_at",
  "nota fiscal": "invoice_number",
  "observações": "notes",
  "observacoes": "notes",
  "categoria 1": "category_name",
  "valor na categoria 1": "_category_amount",
  "centro de custo 1": "cost_center_name",
  "valor no centro de custo 1": "_cost_center_amount",
};

const RECEIVABLES_COLUMN_MAP: Record<string, string> = {
  "identificador do cliente": "entity_identifier",
  "nome do cliente": "client_name",
  "código de referência": "reference_code",
  "codigo de referencia": "reference_code",
  "data de competência": "competence_date",
  "data de competencia": "competence_date",
  "data de vencimento": "due_date",
  "data prevista": "expected_date",
  "recorrência": "recurrence_type",
  "recorrencia": "recurrence_type",
  "quantidade de recorrência": "recurrence_count",
  "quantidade de recorrencia": "recurrence_count",
  "descrição": "description",
  "descricao": "description",
  "origem do lançamento": "origin",
  "origem do lancamento": "origin",
  "situação": "status_raw",
  "situacao": "status_raw",
  "agendado": "scheduled_raw",
  "valor original da parcela (r$)": "amount",
  "valor original da parcela": "amount",
  "forma de recebimento": "payment_method_name",
  "valor recebido da parcela (r$)": "paid_amount",
  "valor recebido da parcela": "paid_amount",
  "juros realizado (r$)": "interest_paid",
  "juros realizado": "interest_paid",
  "multa realizado (r$)": "penalty_paid",
  "multa realizado": "penalty_paid",
  "desconto realizado (r$)": "discount_paid",
  "desconto realizado": "discount_paid",
  "valor total recebido da parcela (r$)": "_total_received",
  "valor total recebido da parcela": "_total_received",
  "valor da parcela em aberto (r$)": "_open_amount",
  "valor da parcela em aberto": "_open_amount",
  "juros previsto (r$)": "interest_expected",
  "juros previsto": "interest_expected",
  "multa previsto (r$)": "penalty_expected",
  "multa previsto": "penalty_expected",
  "desconto previsto (r$)": "discount_expected",
  "desconto previsto": "discount_expected",
  "valor total da parcela em aberto (r$)": "_total_open",
  "valor total da parcela em aberto": "_total_open",
  "conta bancária": "bank_account_name",
  "conta bancaria": "bank_account_name",
  "data do último pagamento": "paid_at",
  "data do ultimo pagamento": "paid_at",
  "nota fiscal": "invoice_number",
  "observações": "notes",
  "observacoes": "notes",
  "categoria 1": "category_name",
  "valor na categoria 1": "_category_amount",
  "centro de custo 1": "cost_center_name",
  "valor no centro de custo 1": "_cost_center_amount",
};

function parseDate(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim();
  // DD/MM/YYYY
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Excel serial date
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    return d.toISOString().split("T")[0];
  }
  return null;
}

function parseNumber(val: any): number {
  if (val === null || val === undefined || val === "" || val === "-") return 0;
  if (typeof val === "number") return val;
  const str = String(val).trim().replace(/\s/g, "");
  // Handle Brazilian format: 1.234,56
  if (str.includes(",")) {
    const cleaned = str.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function mapStatus(raw: string | null): string {
  if (!raw) return "open";
  const lower = raw.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["quitado", "pago", "recebido", "liquidado"].includes(lower)) return "paid";
  if (["vencido", "em atraso", "atrasado"].includes(lower)) return "overdue";
  if (["cancelado", "estornado"].includes(lower)) return "cancelled";
  return "open";
}

const STATUS_KEYWORDS = ["quitado", "pendente", "vencido", "pago", "recebido", "em aberto", "cancelado", "liquidado", "atrasado"];

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, "").replace(/\s+/g, " ").trim();
}

function findColumnKey(normalized: string, columnMap: Record<string, string>): string | undefined {
  // Level 1: exact match
  const exactKey = Object.keys(columnMap).find(k => {
    const nk = normalizeHeader(k);
    return nk === normalized;
  });
  if (exactKey) return exactKey;

  // Level 2: startsWith
  const startsKey = Object.keys(columnMap).find(k => {
    const nk = normalizeHeader(k);
    return normalized.startsWith(nk) || nk.startsWith(normalized);
  });
  if (startsKey) return startsKey;

  // Level 3: includes (only if substring >= 6 chars to avoid false positives)
  const includesKey = Object.keys(columnMap).find(k => {
    const nk = normalizeHeader(k);
    if (nk.length < 6 && normalized.length < 6) return false;
    return (nk.length >= 6 && normalized.includes(nk)) || (normalized.length >= 6 && nk.includes(normalized));
  });
  return includesKey;
}

function detectStatusColumnByContent(rows: Record<string, any>[], mappedFields: Set<string>, rawHeaders: string[]): string | null {
  const unmappedHeaders = rawHeaders.filter(h => !mappedFields.has(h));
  for (const header of unmappedHeaders) {
    const sampleValues = rows.slice(0, Math.min(20, rows.length))
      .map(r => String(r[header] || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const matchCount = sampleValues.filter(v => STATUS_KEYWORDS.some(kw => v.includes(kw))).length;
    if (matchCount >= Math.min(3, sampleValues.length * 0.3)) {
      console.log(`[Import] Detected status column by content: "${header}"`);
      return header;
    }
  }
  return null;
}

export function ClientFinancialImportDialog({ open, onOpenChange, projectId, type, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [mappedHeaders, setMappedHeaders] = useState<string[]>([]);
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState({ success: 0, errors: 0 });

  const columnMap = type === "payables" ? PAYABLES_COLUMN_MAP : RECEIVABLES_COLUMN_MAP;
  const nameField = type === "payables" ? "supplier_name" : "client_name";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

        if (jsonData.length === 0) {
          toast.error("Planilha vazia");
          return;
        }

        // Map headers using improved matching
        const rawHeaders = Object.keys(jsonData[0]);
        const mapped: string[] = [];
        const unmapped: string[] = [];
        const headerToField = new Map<string, string>();

        rawHeaders.forEach((h) => {
          const normalized = normalizeHeader(h);
          const key = findColumnKey(normalized, columnMap);
          if (key) {
            mapped.push(h);
            headerToField.set(h, columnMap[key]);
          } else {
            unmapped.push(h);
          }
        });

        // Check if status_raw was mapped
        const statusMapped = Array.from(headerToField.values()).includes("status_raw");
        let statusColumnHeader: string | null = null;

        if (!statusMapped) {
          console.log("[Import] status_raw not mapped via headers, trying content detection...");
          statusColumnHeader = detectStatusColumnByContent(jsonData, new Set(mapped), rawHeaders);
          if (statusColumnHeader) {
            mapped.push(statusColumnHeader);
            unmapped.splice(unmapped.indexOf(statusColumnHeader), 1);
            headerToField.set(statusColumnHeader, "status_raw");
          }
        }

        if (unmapped.length > 0) {
          console.log("[Import] Unmapped headers:", unmapped);
        }

        setMappedHeaders(mapped);
        setUnmappedHeaders(unmapped);

        // Parse rows using headerToField map
        const rows = jsonData.map((row) => {
          const parsed: ParsedRow = {};
          rawHeaders.forEach((h) => {
            const field = headerToField.get(h);
            if (field) {
              parsed[field] = row[h];
            }
          });
          return parsed;
        });

        // Filter rows that have at least amount and due_date or name
        const validRows = rows.filter((r) => {
          const hasAmount = parseNumber(r.amount) > 0;
          const hasDueDate = parseDate(r.due_date) !== null;
          return hasAmount || hasDueDate || r[nameField];
        });

        setParsedRows(validRows);
        setStep("preview");
      } catch (err) {
        console.error("Parse error:", err);
        toast.error("Erro ao ler a planilha");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    setStep("importing");
    setProgress(0);

    // Load lookup data
    const [categoriesRes, costCentersRes, paymentMethodsRes, bankAccountsRes] = await Promise.all([
      supabase.from("client_financial_categories").select("*").eq("project_id", projectId),
      supabase.from("client_financial_cost_centers").select("*").eq("project_id", projectId),
      supabase.from("client_financial_payment_methods").select("*").eq("project_id", projectId),
      supabase.from("client_financial_bank_accounts").select("*").eq("project_id", projectId),
    ]);

    const categories = categoriesRes.data || [];
    const costCenters = costCentersRes.data || [];
    const paymentMethods = paymentMethodsRes.data || [];
    const bankAccounts = bankAccountsRes.data || [];

    // Helper to find or create
    const findCategoryByName = async (name: string | null) => {
      if (!name || String(name).trim() === "") return null;
      const cleanName = String(name).trim();
      const found = categories.find((c: any) => c.name.toLowerCase() === cleanName.toLowerCase());
      if (found) return found.id;
      // Create it
      const { data } = await supabase.from("client_financial_categories").insert({
        project_id: projectId,
        name: cleanName,
        type: type === "payables" ? "expense" : "income",
        color: "#6B7280",
      }).select("id").single();
      if (data) {
        (categories as any[]).push({ id: data.id, name: cleanName });
        return data.id;
      }
      return null;
    };

    const findCostCenterByName = async (name: string | null) => {
      if (!name || String(name).trim() === "") return null;
      const cleanName = String(name).trim();
      const found = costCenters.find((c: any) => c.name.toLowerCase() === cleanName.toLowerCase());
      if (found) return (found as any).id;
      const { data } = await supabase.from("client_financial_cost_centers").insert({
        project_id: projectId,
        name: cleanName,
      }).select("id").single();
      if (data) {
        (costCenters as any[]).push({ id: data.id, name: cleanName });
        return data.id;
      }
      return null;
    };

    const findPaymentMethodByName = async (name: string | null) => {
      if (!name || String(name).trim() === "") return null;
      const cleanName = String(name).trim();
      const found = paymentMethods.find((p: any) => p.name.toLowerCase() === cleanName.toLowerCase());
      if (found) return (found as any).id;
      const { data } = await supabase.from("client_financial_payment_methods").insert({
        project_id: projectId,
        name: cleanName,
      }).select("id").single();
      if (data) {
        (paymentMethods as any[]).push({ id: data.id, name: cleanName });
        return data.id;
      }
      return null;
    };

    const findBankAccountByName = (name: string | null) => {
      if (!name || String(name).trim() === "") return null;
      const cleanName = String(name).trim();
      const found = bankAccounts.find((b: any) => b.name.toLowerCase() === cleanName.toLowerCase());
      return found ? found.id : null;
    };

    const tableName = type === "payables" ? "client_financial_payables" : "client_financial_receivables";
    let success = 0;
    let errors = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
      const batch = parsedRows.slice(i, i + BATCH_SIZE);
      const records = [];

      for (const row of batch) {
        try {
          const amount = Math.abs(parseNumber(row.amount));
          const dueDate = parseDate(row.due_date);
          if (!dueDate && amount === 0) {
            errors++;
            continue;
          }

          let status = mapStatus(row.status_raw as string);
          
          // Fallback: infer status from payment evidence
          if (status === "open") {
            const paidAmount = parseNumber(row.paid_amount);
            const paidAt = parseDate(row.paid_at);
            if (paidAmount > 0 || paidAt) {
              status = "paid";
              console.log(`[Import] Inferred status=paid from payment data for row`);
            }
          }
          const categoryId = await findCategoryByName(row.category_name as string);
          const costCenterId = await findCostCenterByName(row.cost_center_name as string);
          const paymentMethodId = await findPaymentMethodByName(row.payment_method_name as string);
          const bankAccountId = findBankAccountByName(row.bank_account_name as string);

          const record: any = {
            project_id: projectId,
            description: String(row.description || "").trim() || "Importado",
            amount: amount || 0,
            due_date: dueDate || new Date().toISOString().split("T")[0],
            status,
            category_id: categoryId,
            cost_center_id: costCenterId,
            payment_method_id: paymentMethodId,
            bank_account_id: bankAccountId,
            notes: row.notes ? String(row.notes).trim() : null,
            competence_date: parseDate(row.competence_date),
            expected_date: parseDate(row.expected_date),
            reference_code: row.reference_code ? String(row.reference_code).trim() : null,
            entity_identifier: row.entity_identifier ? String(row.entity_identifier).trim() : null,
            origin: row.origin ? String(row.origin).trim() : null,
            recurrence_type: row.recurrence_type ? String(row.recurrence_type).trim() : null,
            recurrence_count: row.recurrence_count ? parseInt(String(row.recurrence_count)) || null : null,
            scheduled: String(row.scheduled_raw || "").toLowerCase().includes("sim"),
            interest_paid: parseNumber(row.interest_paid),
            penalty_paid: parseNumber(row.penalty_paid),
            discount_paid: parseNumber(row.discount_paid),
            interest_expected: parseNumber(row.interest_expected),
            penalty_expected: parseNumber(row.penalty_expected),
            discount_expected: parseNumber(row.discount_expected),
            invoice_number: row.invoice_number ? String(row.invoice_number).trim() : null,
            paid_amount: status === "paid" ? (parseNumber(row.paid_amount) || amount) : null,
            paid_at: status === "paid" ? (parseDate(row.paid_at) || dueDate) : null,
          };

          // Set name field
          if (type === "payables") {
            record.supplier_name = String(row.supplier_name || "").trim() || "Não informado";
          } else {
            record.client_name = String(row.client_name || "").trim() || "Não informado";
          }

          records.push(record);
        } catch (err) {
          console.error("Row error:", err);
          errors++;
        }
      }

      if (records.length > 0) {
        const { error } = await supabase.from(tableName).insert(records);
        if (error) {
          console.error("Batch insert error:", error);
          errors += records.length;
        } else {
          success += records.length;
        }
      }

      setProgress(Math.round(((i + batch.length) / parsedRows.length) * 100));
    }

    setImportResult({ success, errors });
    setStep("done");
    if (success > 0) onImported();
  };

  const resetDialog = () => {
    setStep("upload");
    setParsedRows([]);
    setMappedHeaders([]);
    setUnmappedHeaders([]);
    setProgress(0);
    setImportResult({ success: 0, errors: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetDialog(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar {type === "payables" ? "Contas a Pagar" : "Contas a Receber"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center w-full cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Clique para selecionar um arquivo</p>
              <p className="text-sm text-muted-foreground mt-1">Suporta .xls, .xlsx, .csv</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="text-xs text-muted-foreground space-y-1 w-full">
              <p className="font-medium">Campos importados automaticamente:</p>
              <p>Nome, Identificador, Código de referência, Data de competência, Vencimento, Data prevista, Recorrência, Descrição, Origem, Situação, Agendado, Valor original, Forma de pagamento, Valor pago, Juros/Multa/Desconto (realizado e previsto), Conta bancária, Data do último pagamento, Nota fiscal, Observações, Categoria, Centro de Custo</p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                {parsedRows.length} registros encontrados
              </Badge>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
                {mappedHeaders.length} colunas mapeadas
              </Badge>
              {unmappedHeaders.length > 0 && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                  {unmappedHeaders.length} colunas ignoradas
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-3 space-y-2">
                <p className="text-sm font-medium mb-2">Prévia dos primeiros registros:</p>
                {parsedRows.slice(0, 10).map((row, idx) => {
                  const name = type === "payables" ? row.supplier_name : row.client_name;
                  const amount = parseNumber(row.amount);
                  const dueDate = parseDate(row.due_date);
                  const status = mapStatus(row.status_raw as string);
                  const category = row.category_name;
                  const bank = row.bank_account_name;
                  return (
                    <div key={idx} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/30">
                      <span className="font-medium min-w-[120px] truncate">{String(name || "Não informado")}</span>
                      <span className="text-muted-foreground truncate flex-1">{String(row.description || "-")}</span>
                      <span className="font-mono text-xs">
                        {amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                      <span className="text-xs text-muted-foreground">{dueDate || "-"}</span>
                      <Badge variant="outline" className="text-xs">
                        {status === "paid" ? "Pago" : status === "overdue" ? "Vencido" : "Aberto"}
                      </Badge>
                    </div>
                  );
                })}
                {parsedRows.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">
                    ... e mais {parsedRows.length - 10} registros
                  </p>
                )}
              </div>
            </ScrollArea>

            {unmappedHeaders.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Colunas ignoradas: </span>
                {unmappedHeaders.join(", ")}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              ℹ️ Categorias, centros de custo e formas de pagamento serão criados automaticamente se não existirem.
            </p>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-medium">Importando registros...</p>
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">{progress}% concluído</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-medium text-lg">Importação concluída!</p>
            <div className="flex gap-4">
              <Badge variant="outline" className="bg-green-500/10 text-green-600 text-sm px-3 py-1">
                {importResult.success} importados
              </Badge>
              {importResult.errors > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-600 text-sm px-3 py-1">
                  {importResult.errors} erros
                </Badge>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" onClick={resetDialog}>Voltar</Button>
              <Button onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" />
                Importar {parsedRows.length} registros
              </Button>
            </div>
          )}
          {step === "done" && (
            <Button onClick={() => { resetDialog(); onOpenChange(false); }}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
