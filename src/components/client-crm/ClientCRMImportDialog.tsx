import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import type { ClientPipeline, ClientStage } from "./hooks/useClientCRM";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "contacts" | "deals";
  projectId: string;
  pipelines: ClientPipeline[];
  stages: ClientStage[];
  activePipelineId: string | null;
  onImportComplete: () => void;
}

const CONTACT_FIELD_MAP: Record<string, string[]> = {
  name: ["name", "nome", "contactname", "contact_name", "full_name"],
  email: ["email", "e-mail", "email_1", "contactemail"],
  phone: ["phone", "telefone", "complete_phone", "celular", "contactphone", "whatsapp_number"],
  company: ["organization_name", "empresa", "company", "nome_fantasia_da_emp", "minha_empresa"],
  role: ["role", "cargo", "funcao"],
  document: ["cnpj", "cpf", "cpfcnpj", "doc", "document"],
  notes: ["notes", "observacoes", "notas"],
  tags: ["tags", "etiquetas"],
};

const DEAL_FIELD_MAP: Record<string, string[]> = {
  name: ["name", "nome", "title", "titulo", "contactname"],
  email: ["email", "e-mail", "contactemail"],
  phone: ["phone", "telefone", "complete_phone", "contactphone"],
  organization_name: ["organization_name", "empresa", "company"],
  value: ["value", "valor"],
  stage: ["stage", "etapa", "status_negocio"],
  status: ["status", "situacao"],
  tags: ["tags", "etiquetas"],
  origin: ["origin", "origem"],
  notes: ["notes", "observacoes"],
  cnpj: ["cnpj", "cpfcnpj"],
  city: ["city", "cidade"],
  state: ["state", "estado", "estado_sigla"],
  segment: ["segment", "segmento_da_empresa", "category"],
  utm_source: ["utm_source"],
  utm_medium: ["utm_medium"],
  utm_campaign: ["utm_campaign", "utm_campaing"],
  sdr: ["sdr"],
  closer: ["closer"],
  funil: ["funil"],
  qual_faturamento_atu: ["qual_faturamento_atu", "faturamento_mensal"],
  won_at: ["won_at", "data_ganho"],
  lost_at: ["lost_at", "data_perda"],
  lost_status: ["lost_status", "motivo_perda"],
  category: ["category", "categoria"],
};

const BATCH_SIZE = 50;

export const ClientCRMImportDialog = ({
  open, onOpenChange, type, projectId, pipelines, stages, activePipelineId, onImportComplete,
}: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState(activePipelineId || "");
  const [selectedStage, setSelectedStage] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; skipped: number; total_errors: number } | null>(null);

  const fieldMap = type === "contacts" ? CONTACT_FIELD_MAP : DEAL_FIELD_MAP;

  const autoMapColumn = useCallback((header: string): string | null => {
    const lower = header.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(fieldMap)) {
      if (aliases.includes(lower)) return field;
    }
    return null;
  }, [fieldMap]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        const hdrs = results.meta.fields || [];
        setHeaders(hdrs);
        setPreview(data.slice(0, 5));
        setTotalRows(data.length);
        setAllRows(data);
      },
    });
  };

  const mapRow = (row: Record<string, string>): Record<string, any> => {
    const mapped: Record<string, any> = {};
    for (const header of headers) {
      const field = autoMapColumn(header);
      if (field && row[header]) {
        mapped[field] = row[header];
      }
    }
    return mapped;
  };

  const handleImport = async () => {
    if (allRows.length === 0) return;
    if (type === "deals" && !selectedPipeline) {
      toast.error("Selecione um funil para importar os negócios");
      return;
    }

    setImporting(true);
    setProgress(0);
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    try {
      const mapped = allRows.map(mapRow);
      const batches = Math.ceil(mapped.length / BATCH_SIZE);

      for (let i = 0; i < batches; i++) {
        const batch = mapped.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

        const { data, error } = await supabase.functions.invoke("import-crm-data", {
          body: {
            type,
            project_id: projectId,
            pipeline_id: selectedPipeline || undefined,
            stage_id: selectedStage || undefined,
            rows: batch,
          },
        });

        if (error) throw error;

        totalInserted += data.inserted || 0;
        totalSkipped += data.skipped || 0;
        totalErrors += data.total_errors || 0;

        setProgress(Math.round(((i + 1) / batches) * 100));
      }

      setResult({ inserted: totalInserted, skipped: totalSkipped, total_errors: totalErrors });

      if (totalInserted > 0) {
        toast.success(`${totalInserted} ${type === "contacts" ? "contatos" : "negócios"} importados!`);
        onImportComplete();
      }
      if (totalSkipped > 0) {
        toast.info(`${totalSkipped} registros ignorados (duplicados ou inválidos)`);
      }
    } catch (err: any) {
      toast.error(`Erro na importação: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const mappedFields = headers.map(h => ({ header: h, field: autoMapColumn(h) })).filter(m => m.field);

  const pipelineStages = stages.filter(s =>
    type === "deals" && selectedPipeline ? true : false
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar {type === "contacts" ? "Contatos" : "Negócios"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          {!file && (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Arraste ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">CSV ou Excel (.csv)</p>
              <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </label>
          )}

          {file && !result && (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{totalRows.toLocaleString()} registros encontrados</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setFile(null); setHeaders([]); setPreview([]); setAllRows([]); }}>
                  Trocar
                </Button>
              </div>

              {/* Pipeline selection for deals */}
              {type === "deals" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm">Funil de destino *</Label>
                    <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o funil" />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelines.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Etapa padrão (opcional)</Label>
                    <Select value={selectedStage} onValueChange={setSelectedStage}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Detectar da planilha" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Detectar da planilha</SelectItem>
                        {stages.filter(s => !s.is_final).map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Mapped fields */}
              <div>
                <Label className="text-sm font-medium">Campos mapeados automaticamente</Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {mappedFields.map(m => (
                    <Badge key={m.header} variant="secondary" className="text-xs">
                      {m.header} → {m.field}
                    </Badge>
                  ))}
                </div>
                {mappedFields.length === 0 && (
                  <p className="text-xs text-destructive mt-1">Nenhum campo foi mapeado. Verifique o formato do CSV.</p>
                )}
              </div>

              {/* Preview */}
              {preview.length > 0 && mappedFields.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Prévia (5 primeiros registros)</Label>
                  <div className="border rounded-lg overflow-x-auto mt-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {mappedFields.slice(0, 6).map(m => (
                            <TableHead key={m.header} className="text-xs whitespace-nowrap">{m.field}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((row, i) => (
                          <TableRow key={i}>
                            {mappedFields.slice(0, 6).map(m => (
                              <TableCell key={m.header} className="text-xs max-w-[200px] truncate">
                                {row[m.header] || "-"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Progress */}
              {importing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Importando... {progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              {/* Actions */}
              {!importing && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  <Button onClick={handleImport} disabled={mappedFields.length === 0}>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar {totalRows.toLocaleString()} registros
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3 text-center py-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <h3 className="font-semibold text-lg">Importação concluída!</h3>
              <div className="flex justify-center gap-6 text-sm">
                <div>
                  <span className="font-bold text-green-600">{result.inserted}</span>
                  <p className="text-muted-foreground">Importados</p>
                </div>
                <div>
                  <span className="font-bold text-yellow-600">{result.skipped}</span>
                  <p className="text-muted-foreground">Ignorados</p>
                </div>
                {result.total_errors > 0 && (
                  <div>
                    <span className="font-bold text-destructive">{result.total_errors}</span>
                    <p className="text-muted-foreground">Erros</p>
                  </div>
                )}
              </div>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
