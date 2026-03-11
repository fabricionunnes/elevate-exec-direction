import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedRow {
  [key: string]: string;
}

const FIELDS = [
  { key: "name", label: "Nome / Razão Social", required: true },
  { key: "cnpj", label: "CNPJ/CPF", required: false },
  { key: "phone", label: "Telefone", required: false },
  { key: "email", label: "Email", required: false },
  { key: "address", label: "Endereço", required: false },
  { key: "address_number", label: "Número", required: false },
  { key: "address_complement", label: "Complemento", required: false },
  { key: "address_neighborhood", label: "Bairro", required: false },
  { key: "address_zipcode", label: "CEP", required: false },
  { key: "address_city", label: "Cidade", required: false },
  { key: "address_state", label: "UF", required: false },
  { key: "segment", label: "Segmento", required: false },
];

type Step = "upload" | "mapping" | "importing" | "done";

export function CompanyImportDialog({ open, onOpenChange, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState({ created: 0, updated: 0, linked: 0, errors: 0, errorMessages: [] as string[] });
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setFileHeaders([]);
    setParsedData([]);
    setMapping({});
    setProgress(0);
    setImportResult({ created: 0, updated: 0, linked: 0, errors: 0, errorMessages: [] });
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

  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

  const autoMap = (headers: string[]) => {
    const m: Record<string, string> = {};
    const aliases: Record<string, string[]> = {
      name: ["nome", "razao social", "razao", "empresa", "cliente", "devedor", "nome do devedor", "nome devedor", "company"],
      cnpj: ["cnpj", "cpf", "cnpjcpf", "cpfcnpj", "documento", "doc"],
      phone: ["telefone", "fone", "phone", "tel", "celular"],
      email: ["email", "e-mail", "mail"],
      address: ["endereco", "logradouro", "rua", "address"],
      address_number: ["numero", "nro", "num"],
      address_complement: ["complemento", "compl"],
      address_neighborhood: ["bairro", "neighborhood"],
      address_zipcode: ["cep", "zipcode", "zip"],
      address_city: ["cidade", "city", "municipio"],
      address_state: ["uf", "estado", "state"],
      segment: ["segmento", "segment", "ramo", "atividade"],
    };
    headers.forEach(h => {
      const hn = normalize(h);
      for (const [field, alts] of Object.entries(aliases)) {
        if (alts.some(a => normalize(a) === hn || hn.includes(normalize(a)))) {
          if (!m[field]) m[field] = h;
        }
      }
    });
    setMapping(m);
  };

  const getVal = (row: ParsedRow, fieldKey: string) => {
    const header = mapping[fieldKey];
    return header ? (row[header] || "").trim() : "";
  };

  const handleImport = async () => {
    setStep("importing");
    let created = 0, updated = 0, linked = 0, errors = 0;
    const errorMsgs: string[] = [];

    // Fetch all existing companies for matching
    const { data: existingCompanies } = await supabase
      .from("onboarding_companies")
      .select("id, name, cnpj");

    const nameMap = new Map<string, string>();
    const cnpjMap = new Map<string, string>();
    for (const c of existingCompanies || []) {
      nameMap.set(c.name.toLowerCase().trim(), c.id);
      if (c.cnpj) cnpjMap.set(c.cnpj.replace(/\D/g, ""), c.id);
    }

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      const lineNum = i + 2;
      try {
        const name = getVal(row, "name");
        if (!name) {
          errors++;
          errorMsgs.push(`Linha ${lineNum}: nome da empresa não informado`);
          continue;
        }

        const rawCnpj = getVal(row, "cnpj");
        const cleanCnpj = rawCnpj.replace(/\D/g, "");
        const data: Record<string, any> = {
          name,
          status: "active",
        };

        if (rawCnpj) data.cnpj = rawCnpj;
        const phone = getVal(row, "phone"); if (phone) data.phone = phone;
        const email = getVal(row, "email"); if (email) data.email = email;
        const addr = getVal(row, "address"); if (addr) data.address = addr;
        const addrNum = getVal(row, "address_number"); if (addrNum) data.address_number = addrNum;
        const addrCompl = getVal(row, "address_complement"); if (addrCompl) data.address_complement = addrCompl;
        const addrNeigh = getVal(row, "address_neighborhood"); if (addrNeigh) data.address_neighborhood = addrNeigh;
        const addrZip = getVal(row, "address_zipcode"); if (addrZip) data.address_zipcode = addrZip.replace(/\D/g, "");
        const addrCity = getVal(row, "address_city"); if (addrCity) data.address_city = addrCity;
        const addrState = getVal(row, "address_state"); if (addrState) data.address_state = addrState.toUpperCase().trim();
        const segment = getVal(row, "segment"); if (segment) data.segment = segment;

        // Try to find existing company by name or CNPJ
        let existingId = nameMap.get(name.toLowerCase().trim()) || null;
        if (!existingId && cleanCnpj) existingId = cnpjMap.get(cleanCnpj) || null;

        if (existingId) {
          // Update existing: only fill empty fields
          const { data: current } = await supabase
            .from("onboarding_companies")
            .select("cnpj, phone, email, address, address_number, address_complement, address_neighborhood, address_zipcode, address_city, address_state, segment")
            .eq("id", existingId)
            .single();

          if (current) {
            const updates: Record<string, any> = {};
            for (const [key, val] of Object.entries(data)) {
              if (key === "name" || key === "status") continue;
              if (!current[key as keyof typeof current]) updates[key] = val;
            }
            if (Object.keys(updates).length > 0) {
              await supabase.from("onboarding_companies").update(updates as any).eq("id", existingId);
              updated++;
            }
          }

          // Link invoices
          const { data: linkedData } = await supabase
            .from("company_invoices")
            .update({ company_id: existingId, custom_receiver_name: null } as any)
            .is("company_id", null)
            .ilike("custom_receiver_name", name)
            .select("id");
          if (linkedData && linkedData.length > 0) linked += linkedData.length;
        } else {
          // Create new company
          const { data: newComp, error: insertErr } = await supabase
            .from("onboarding_companies")
            .insert(data as any)
            .select("id")
            .single();

          if (insertErr) {
            errors++;
            errorMsgs.push(`Linha ${lineNum}: ${insertErr.message}`);
            continue;
          }

          if (newComp) {
            created++;
            nameMap.set(name.toLowerCase().trim(), newComp.id);
            if (cleanCnpj) cnpjMap.set(cleanCnpj, newComp.id);

            // Link invoices with matching custom_receiver_name
            const { data: linkedData2 } = await supabase
              .from("company_invoices")
              .update({ company_id: newComp.id, custom_receiver_name: null } as any)
              .is("company_id", null)
              .ilike("custom_receiver_name", name)
              .select("id");
            if (linkedData2 && linkedData2.length > 0) linked += linkedData2.length;
          }
        }
      } catch (err: any) {
        errors++;
        errorMsgs.push(`Linha ${lineNum}: ${err.message || "erro inesperado"}`);
      }

      setProgress(Math.round(((i + 1) / parsedData.length) * 100));
    }

    setImportResult({ created, updated, linked, errors, errorMessages: errorMsgs.slice(0, 20) });
    setStep("done");
    if (created > 0 || updated > 0) onSuccess();
  };

  const requiredMissing = FIELDS.filter(f => f.required && !mapping[f.key]).map(f => f.label);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Importar Cadastro de Empresas
          </DialogTitle>
        </DialogHeader>

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
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium">Como funciona:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Empresas existentes terão seus dados atualizados (campos vazios serão preenchidos)</li>
                <li>Empresas novas serão cadastradas automaticamente</li>
                <li>Faturas importadas anteriormente serão vinculadas às empresas pelo nome</li>
              </ul>
              <p className="font-medium mt-3">Colunas aceitas:</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {FIELDS.map(f => (
                  <Badge key={f.key} variant={f.required ? "default" : "secondary"} className="text-xs">
                    {f.label}{f.required ? " *" : ""}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{parsedData.length} linhas encontradas. Mapeie as colunas:</p>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto">
              {FIELDS.map(f => (
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
            {/* Preview */}
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {FIELDS.filter(f => mapping[f.key]).map(f => <TableHead key={f.key} className="text-xs whitespace-nowrap">{f.label}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {FIELDS.filter(f => mapping[f.key]).map(f => (
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
                <Building2 className="h-4 w-4 mr-2" />
                Importar {parsedData.length} empresas
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 space-y-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="font-medium">Importando empresas...</p>
            <Progress value={progress} className="max-w-xs mx-auto" />
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
              <p className="text-lg font-semibold">Importação Concluída</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{importResult.created}</p>
                <p className="text-xs text-muted-foreground">Empresas criadas</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                <p className="text-xs text-muted-foreground">Empresas atualizadas</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-600">{importResult.linked}</p>
                <p className="text-xs text-muted-foreground">Faturas vinculadas</p>
              </div>
              <div className="bg-destructive/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-destructive">{importResult.errors}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>
            {importResult.errorMessages.length > 0 && (
              <div className="bg-destructive/10 rounded-lg p-3 max-h-32 overflow-y-auto">
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
