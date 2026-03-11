import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type ImportType = "receivable" | "payable";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ImportType;
  companies: { id: string; name: string }[];
  categories: any[];
  costCenters: any[];
  onSuccess: () => void;
}

interface ParsedRow {
  [key: string]: string;
}

const RECEIVABLE_FIELDS = [
  { key: "company_name", label: "Empresa", required: true },
  { key: "cnpj", label: "CNPJ/CPF", required: false },
  { key: "phone", label: "Telefone", required: false },
  { key: "email", label: "Email", required: false },
  { key: "address", label: "Endereço", required: false },
  { key: "address_number", label: "Número", required: false },
  { key: "address_neighborhood", label: "Bairro", required: false },
  { key: "address_zipcode", label: "CEP", required: false },
  { key: "address_city", label: "Cidade", required: false },
  { key: "address_state", label: "UF", required: false },
  { key: "description", label: "Descrição", required: true },
  { key: "amount", label: "Valor", required: true },
  { key: "due_date", label: "Vencimento", required: true },
  { key: "status", label: "Status", required: false },
  { key: "notes", label: "Observações", required: false },
  { key: "category", label: "Categoria", required: false },
  { key: "cost_center", label: "Centro de Custo", required: false },
];

const PAYABLE_FIELDS = [
  { key: "supplier_name", label: "Fornecedor", required: true },
  { key: "description", label: "Descrição", required: true },
  { key: "amount", label: "Valor", required: true },
  { key: "due_date", label: "Vencimento", required: true },
  { key: "reference_month", label: "Mês Referência", required: false },
  { key: "status", label: "Status", required: false },
  { key: "notes", label: "Observações", required: false },
  { key: "category", label: "Categoria", required: false },
  { key: "cost_center", label: "Centro de Custo", required: false },
];

type Step = "upload" | "mapping" | "preview" | "importing" | "done";

export function FinancialImportDialog({ open, onOpenChange, type, companies, categories, costCenters, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState({ success: 0, errors: 0, errorMessages: [] as string[] });
  const fileRef = useRef<HTMLInputElement>(null);

  const fields = type === "receivable" ? RECEIVABLE_FIELDS : PAYABLE_FIELDS;
  const title = type === "receivable" ? "Importar Contas a Receber" : "Importar Contas a Pagar";

  const reset = () => {
    setStep("upload");
    setFileHeaders([]);
    setParsedData([]);
    setMapping({});
    setProgress(0);
    setImportResult({ success: 0, errors: 0, errorMessages: [] });
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv" || ext === "txt") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        complete: (results) => {
          if (!results.meta.fields?.length) { toast.error("Arquivo sem colunas válidas"); return; }
          setFileHeaders(results.meta.fields);
          setParsedData(results.data as ParsedRow[]);
          autoMap(results.meta.fields);
          setStep("mapping");
        },
        error: () => toast.error("Erro ao ler arquivo CSV"),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "binary" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: "" });
          if (!json.length) { toast.error("Planilha vazia"); return; }
          const headers = Object.keys(json[0]);
          setFileHeaders(headers);
          setParsedData(json.map(row => {
            const clean: ParsedRow = {};
            headers.forEach(h => clean[h] = String(row[h] ?? ""));
            return clean;
          }));
          autoMap(headers);
          setStep("mapping");
        } catch { toast.error("Erro ao ler planilha"); }
      };
      reader.readAsBinaryString(file);
    } else {
      toast.error("Formato não suportado. Use CSV ou Excel (.xlsx/.xls)");
    }
  }, []);

  const autoMap = (headers: string[]) => {
    const m: Record<string, string> = {};
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const aliases: Record<string, string[]> = {
      company_name: ["empresa", "cliente", "company", "razao social", "razao", "nome do devedor", "devedor", "nome devedor"],
      cnpj: ["cnpj", "cpf", "cnpjcpf", "cpfcnpj", "documento", "doc"],
      phone: ["telefone", "fone", "phone", "tel", "celular"],
      email: ["email", "e-mail", "mail"],
      address: ["endereco", "logradouro", "rua", "address"],
      address_number: ["numero", "nro", "num", "n"],
      address_neighborhood: ["bairro", "neighborhood"],
      address_zipcode: ["cep", "zipcode", "zip"],
      address_city: ["cidade", "city", "municipio"],
      address_state: ["uf", "estado", "state"],
      supplier_name: ["fornecedor", "supplier", "credor"],
      description: ["descricao", "desc", "description", "historico"],
      amount: ["valor", "amount", "value", "total"],
      due_date: ["vencimento", "due_date", "data vencimento", "dt vencimento", "data"],
      reference_month: ["mes referencia", "mes ref", "competencia", "ref"],
      status: ["status", "situacao"],
      notes: ["observacoes", "obs", "notas", "notes"],
      category: ["categoria", "category", "tipo"],
      cost_center: ["centro de custo", "centro custo", "cc", "cost center"],
    };
    headers.forEach(h => {
      const hn = normalize(h);
      for (const [field, alts] of Object.entries(aliases)) {
        if (fields.some(f => f.key === field) && alts.some(a => normalize(a) === hn || hn.includes(normalize(a)))) {
          if (!m[field]) m[field] = h;
        }
      }
    });
    setMapping(m);
  };

  const parseDateValue = (val: string): string | null => {
    if (!val) return null;
    // Try DD/MM/YYYY
    const brMatch = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
    // Try YYYY-MM-DD
    const isoMatch = val.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
    // Excel serial number
    const num = Number(val);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const d = new Date((num - 25569) * 86400000);
      return d.toISOString().split("T")[0];
    }
    return null;
  };

  const parseAmount = (val: string): number | null => {
    if (!val) return null;
    let clean = val.replace(/[R$\s]/g, "");
    // Handle Brazilian format: 1.234,56
    if (clean.includes(",") && clean.includes(".")) {
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else if (clean.includes(",")) {
      clean = clean.replace(",", ".");
    }
    const n = parseFloat(clean);
    return isNaN(n) ? null : Math.abs(n);
  };

  const getVal = (row: ParsedRow, fieldKey: string) => {
    const header = mapping[fieldKey];
    return header ? (row[header] || "").trim() : "";
  };

  const handleImport = async () => {
    setImporting(true);
    setStep("importing");
    let success = 0;
    let errors = 0;
    const errorMsgs: string[] = [];

    const companyMap = new Map(companies.map(c => [c.name.toLowerCase().trim(), c.id]));
    const catMap = new Map(categories.map(c => [c.name.toLowerCase().trim(), c.id]));
    const ccMap = new Map(costCenters.map(c => [c.name.toLowerCase().trim(), c.id]));

    // Build a CNPJ->id map from existing companies for fallback matching
    let cnpjMap = new Map<string, string>();
    if (type === "receivable") {
      const { data: allComps } = await supabase
        .from("onboarding_companies")
        .select("id, name, cnpj");
      if (allComps) {
        for (const c of allComps) {
          if (c.cnpj) cnpjMap.set(c.cnpj.replace(/\D/g, ""), c.id);
          companyMap.set(c.name.toLowerCase().trim(), c.id);
        }
      }
    }

    // Track companies to update/create with imported data
    const companiesToUpdate: Map<string, Record<string, string>> = new Map();
    const companiesToCreate: { name: string; data: Record<string, string> }[] = [];

    const BATCH = 50;
    for (let i = 0; i < parsedData.length; i += BATCH) {
      const batch = parsedData.slice(i, i + BATCH);
      const rows: any[] = [];

      for (const row of batch) {
        const lineNum = i + batch.indexOf(row) + 2;
        try {
          const amount = parseAmount(getVal(row, "amount"));
          const dueDate = parseDateValue(getVal(row, "due_date"));
          const description = getVal(row, "description");

          if (!amount || !dueDate || !description) {
            errors++;
            errorMsgs.push(`Linha ${lineNum}: campos obrigatórios faltando (descrição/valor/vencimento)`);
            continue;
          }

          const catName = getVal(row, "category").toLowerCase().trim();
          const ccName = getVal(row, "cost_center").toLowerCase().trim();
          const statusRaw = getVal(row, "status").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          const status = ["quitado", "pago", "paid", "recebido", "liquidado"].includes(statusRaw) ? "paid" : ["vencido", "overdue", "em atraso", "atrasado"].includes(statusRaw) ? "overdue" : ["cancelado", "estornado"].includes(statusRaw) ? "cancelled" : "pending";

          if (type === "receivable") {
            const rawCompanyName = getVal(row, "company_name");
            const companyNameKey = rawCompanyName.toLowerCase().trim();
            const rawCnpj = getVal(row, "cnpj").replace(/\D/g, "");

            // Try match: by name first, then by CNPJ
            let companyId = companyMap.get(companyNameKey) || null;
            if (!companyId && rawCnpj) {
              companyId = cnpjMap.get(rawCnpj) || null;
            }

            // Collect company extra data from the row
            const extraData: Record<string, string> = {};
            const rowCnpj = getVal(row, "cnpj");
            const rowPhone = getVal(row, "phone");
            const rowEmail = getVal(row, "email");
            const rowAddress = getVal(row, "address");
            const rowAddressNumber = getVal(row, "address_number");
            const rowNeighborhood = getVal(row, "address_neighborhood");
            const rowZipcode = getVal(row, "address_zipcode");
            const rowCity = getVal(row, "address_city");
            const rowState = getVal(row, "address_state");
            if (rowCnpj) extraData.cnpj = rowCnpj;
            if (rowPhone) extraData.phone = rowPhone;
            if (rowEmail) extraData.email = rowEmail;
            if (rowAddress) extraData.address = rowAddress;
            if (rowAddressNumber) extraData.address_number = rowAddressNumber;
            if (rowNeighborhood) extraData.address_neighborhood = rowNeighborhood;
            if (rowZipcode) extraData.address_zipcode = rowZipcode.replace(/\D/g, "");
            if (rowCity) extraData.address_city = rowCity;
            if (rowState) extraData.address_state = rowState.toUpperCase().trim();

            if (companyId && Object.keys(extraData).length > 0) {
              // Merge data for update (won't overwrite existing non-empty fields)
              const existing = companiesToUpdate.get(companyId) || {};
              companiesToUpdate.set(companyId, { ...existing, ...extraData });
            } else if (!companyId && rawCompanyName && Object.keys(extraData).length > 0) {
              // Track for creation
              companiesToCreate.push({ name: rawCompanyName, data: extraData });
            }

            const record: any = {
              company_id: companyId,
              custom_receiver_name: companyId ? null : (rawCompanyName || null),
              description,
              amount_cents: Math.round(amount * 100),
              due_date: dueDate,
              status,
              notes: getVal(row, "notes") || null,
              category_id: catMap.get(catName) || null,
              cost_center_id: ccMap.get(ccName) || null,
              installment_number: 1,
              total_installments: 1,
            };
            if (status === "paid") {
              record.paid_at = dueDate;
              record.paid_amount_cents = record.amount_cents;
            }
            rows.push(record);
          } else {
            const supplierName = getVal(row, "supplier_name");
            if (!supplierName) {
              errors++;
              errorMsgs.push(`Linha ${lineNum}: fornecedor não informado`);
              continue;
            }
            const now = new Date();
            const refMonth = getVal(row, "reference_month") || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            const record: any = {
              supplier_name: supplierName,
              description,
              amount,
              due_date: dueDate,
              reference_month: refMonth,
              status,
              notes: getVal(row, "notes") || null,
              category_id: catMap.get(catName) || null,
              cost_center_id: ccMap.get(ccName) || null,
            };
            if (status === "paid") {
              record.paid_date = dueDate;
              record.paid_amount = amount;
            }
            rows.push(record);
          }
        } catch {
          errors++;
          errorMsgs.push(`Linha ${lineNum}: erro inesperado`);
        }
      }

      if (rows.length > 0) {
        const table = type === "receivable" ? "company_invoices" : "financial_payables";
        const { error } = await supabase.from(table).insert(rows as any);
        if (error) {
          errors += rows.length;
          errorMsgs.push(`Batch erro: ${error.message}`);
        } else {
          success += rows.length;
        }
      }

      setProgress(Math.round(((i + batch.length) / parsedData.length) * 100));
    }

    // Update existing companies with imported data (only fill empty fields)
    for (const [compId, extraData] of companiesToUpdate) {
      try {
        // Fetch current data to avoid overwriting
        const { data: current } = await supabase
          .from("onboarding_companies")
          .select("cnpj, phone, email, address, address_number, address_neighborhood, address_zipcode, address_city, address_state")
          .eq("id", compId)
          .single();
        if (current) {
          const updates: Record<string, string> = {};
          for (const [key, val] of Object.entries(extraData)) {
            if (!current[key as keyof typeof current]) updates[key] = val;
          }
          if (Object.keys(updates).length > 0) {
            await supabase.from("onboarding_companies").update(updates as any).eq("id", compId);
          }
        }
      } catch { /* silently skip update errors */ }
    }

    // Create new companies from import data (deduplicate by name)
    const createdNames = new Set<string>();
    for (const { name, data } of companiesToCreate) {
      const nameKey = name.toLowerCase().trim();
      if (createdNames.has(nameKey)) continue;
      createdNames.add(nameKey);
      try {
        const { data: newComp } = await supabase
          .from("onboarding_companies")
          .insert({ name, status: "active", ...data } as any)
          .select("id")
          .single();
        if (newComp) {
          // Update invoices that have this custom_receiver_name to link to the new company
          await supabase
            .from("company_invoices")
            .update({ company_id: newComp.id, custom_receiver_name: null } as any)
            .is("company_id", null)
            .eq("custom_receiver_name", name);
        }
      } catch { /* silently skip creation errors */ }
    }

    setImportResult({ success, errors, errorMessages: errorMsgs.slice(0, 20) });
    setStep("done");
    setImporting(false);
    if (success > 0) onSuccess();
  };

  const requiredMissing = fields.filter(f => f.required && !mapping[f.key]).map(f => f.label);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Arraste o arquivo ou clique para selecionar</p>
              <p className="text-sm text-muted-foreground mt-1">CSV, XLS ou XLSX</p>
              <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
              <p className="font-medium">Colunas esperadas:</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {fields.map(f => (
                  <Badge key={f.key} variant={f.required ? "default" : "secondary"} className="text-xs">
                    {f.label}{f.required ? " *" : ""}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === "mapping" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{parsedData.length} linhas encontradas. Mapeie as colunas do arquivo:</p>
            <div className="space-y-3">
              {fields.map(f => (
                <div key={f.key} className="grid grid-cols-2 gap-3 items-center">
                  <Label className="text-sm">
                    {f.label}{f.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Select value={mapping[f.key] || "_none"} onValueChange={(v) => setMapping(prev => ({ ...prev, [f.key]: v === "_none" ? "" : v }))}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Ignorar —</SelectItem>
                      {fileHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {requiredMissing.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Campos obrigatórios não mapeados: {requiredMissing.join(", ")}</span>
              </div>
            )}
            {/* Preview first 5 rows */}
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {fields.filter(f => mapping[f.key]).map(f => <TableHead key={f.key} className="text-xs whitespace-nowrap">{f.label}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {fields.filter(f => mapping[f.key]).map(f => (
                        <TableCell key={f.key} className="text-xs max-w-[150px] truncate">{getVal(row, f.key)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={handleImport} disabled={requiredMissing.length > 0}>
                Importar {parsedData.length} registros
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === "importing" && (
          <div className="py-8 space-y-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="font-medium">Importando...</p>
            <Progress value={progress} className="max-w-xs mx-auto" />
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
              <p className="text-lg font-semibold">Importação Concluída</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{importResult.success}</p>
                <p className="text-sm text-muted-foreground">Importados</p>
              </div>
              <div className="bg-destructive/10 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{importResult.errors}</p>
                <p className="text-sm text-muted-foreground">Erros</p>
              </div>
            </div>
            {importResult.errorMessages.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                {importResult.errorMessages.map((msg, i) => (
                  <p key={i} className="text-xs text-destructive">{msg}</p>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
