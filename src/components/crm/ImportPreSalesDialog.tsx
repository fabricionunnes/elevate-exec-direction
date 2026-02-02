import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Upload, 
  FileSpreadsheet, 
  ArrowRight, 
  Check, 
  X,
  Loader2,
  ArrowLeft
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface ImportPreSalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface StaffMember {
  id: string;
  name: string;
}

interface ColumnMapping {
  csvColumn: string;
  field: string;
}

interface ParsedRow {
  [key: string]: string;
}

const PRESALES_FIELDS = [
  { value: "activity_date", label: "Data *", required: true },
  { value: "staff_name", label: "SDR / Colaborador (Nome)" },
  { value: "approaches", label: "Abordagens" },
  { value: "connections", label: "Conexões" },
  { value: "scheduled", label: "Reuniões Agendadas" },
  { value: "qualifications", label: "Reuniões Realizadas / Qualificações" },
  { value: "ignore", label: "Ignorar coluna" },
];

export const ImportPreSalesDialog = ({ open, onOpenChange, onSuccess }: ImportPreSalesDialogProps) => {
  const [step, setStep] = useState<"upload" | "mapping" | "staff-mapping" | "preview" | "importing">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<ParsedRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [staffMappings, setStaffMappings] = useState<Record<string, string>>({});
  const [uniqueStaffNames, setUniqueStaffNames] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    if (open) {
      fetchStaff();
    }
  }, [open]);

  const fetchStaff = async () => {
    const { data, error } = await supabase
      .from("onboarding_staff")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    
    if (data) setStaffList(data);
  };

  const resetDialog = useCallback(() => {
    setStep("upload");
    setFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMappings([]);
    setStaffMappings({});
    setUniqueStaffNames([]);
    setImporting(false);
    setImportProgress(0);
    setImportedCount(0);
    setErrorCount(0);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            const headers = Object.keys(results.data[0] as object);
            setCsvHeaders(headers);
            setCsvData(results.data as ParsedRow[]);
            initializeColumnMappings(headers);
            setStep("mapping");
          }
        },
        error: (error) => {
          toast.error("Erro ao processar arquivo: " + error.message);
        }
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(firstSheet, { defval: "" });
          
          if (jsonData.length > 0) {
            const headers = Object.keys(jsonData[0]);
            setCsvHeaders(headers);
            setCsvData(jsonData);
            initializeColumnMappings(headers);
            setStep("mapping");
          }
        } catch (error) {
          toast.error("Erro ao processar arquivo Excel");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Formato não suportado. Use CSV ou Excel.");
    }
  };

  const initializeColumnMappings = (headers: string[]) => {
    const mappings: ColumnMapping[] = headers.map(header => {
      const lowerHeader = header.toLowerCase().trim();
      let field = "ignore";
      
      if (lowerHeader.includes("data")) field = "activity_date";
      else if (lowerHeader.includes("sdr") || lowerHeader.includes("colaborador") || lowerHeader.includes("nome") || lowerHeader.includes("vendedor")) field = "staff_name";
      else if (lowerHeader.includes("abordagem") || lowerHeader.includes("abordagens")) field = "approaches";
      else if (lowerHeader.includes("conex") || lowerHeader.includes("conexões")) field = "connections";
      else if (lowerHeader.includes("agendad") || lowerHeader.includes("agendamento")) field = "scheduled";
      else if (lowerHeader.includes("realizad") || lowerHeader.includes("qualifica") || lowerHeader.includes("reuniões realizadas")) field = "qualifications";
      
      return { csvColumn: header, field };
    });
    
    setColumnMappings(mappings);
  };

  const updateColumnMapping = (csvColumn: string, field: string) => {
    setColumnMappings(prev => 
      prev.map(m => m.csvColumn === csvColumn ? { ...m, field } : m)
    );
  };

  const handleMappingComplete = () => {
    // Check required fields
    const hasDate = columnMappings.some(m => m.field === "activity_date");
    const hasMetrics = columnMappings.some(m => 
      m.field === "approaches" || 
      m.field === "connections" || 
      m.field === "scheduled" || 
      m.field === "qualifications"
    );
    
    if (!hasDate) {
      toast.error("A coluna 'Data' é obrigatória");
      return;
    }
    
    if (!hasMetrics) {
      toast.error("É necessário mapear pelo menos uma métrica (abordagens, conexões, agendadas ou realizadas)");
      return;
    }
    
    // Extract unique staff names
    const staffMapping = columnMappings.find(m => m.field === "staff_name");
    if (staffMapping) {
      const staffColumn = staffMapping.csvColumn;
      const uniqueNames = [...new Set(csvData.map(row => row[staffColumn]).filter(Boolean))];
      setUniqueStaffNames(uniqueNames);
      
      // Try to auto-match by name
      const autoMappings: Record<string, string> = {};
      uniqueNames.forEach(name => {
        const normalizedName = name.toLowerCase().trim();
        const matchedStaff = staffList.find(s => 
          s.name.toLowerCase().trim() === normalizedName ||
          s.name.toLowerCase().includes(normalizedName) ||
          normalizedName.includes(s.name.toLowerCase())
        );
        if (matchedStaff) {
          autoMappings[name] = matchedStaff.id;
        }
      });
      setStaffMappings(autoMappings);
      setStep("staff-mapping");
    } else {
      setStep("preview");
    }
  };

  const parseDate = (dateStr: string): string | null => {
    if (!dateStr) return null;
    
    // Try different date formats
    const formats = [
      // DD/MM/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // DD-MM-YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      // YYYY-MM-DD
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[2]) {
          // YYYY-MM-DD
          return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else {
          // DD/MM/YYYY or DD-MM-YYYY
          return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
      }
    }
    
    // Try Excel serial date
    const num = parseFloat(dateStr);
    if (!isNaN(num) && num > 1) {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    return null;
  };

  const parseNumber = (value: string): number => {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^\d.-]/g, '');
    return parseInt(cleaned) || 0;
  };

  const getPreviewData = () => {
    const dateColumn = columnMappings.find(m => m.field === "activity_date")?.csvColumn;
    const staffColumn = columnMappings.find(m => m.field === "staff_name")?.csvColumn;
    const approachesColumn = columnMappings.find(m => m.field === "approaches")?.csvColumn;
    const connectionsColumn = columnMappings.find(m => m.field === "connections")?.csvColumn;
    const scheduledColumn = columnMappings.find(m => m.field === "scheduled")?.csvColumn;
    const qualificationsColumn = columnMappings.find(m => m.field === "qualifications")?.csvColumn;
    
    return csvData.slice(0, 10).map((row, idx) => ({
      idx,
      date: dateColumn ? parseDate(row[dateColumn]) : null,
      staff: staffColumn ? row[staffColumn] : "-",
      approaches: approachesColumn ? parseNumber(row[approachesColumn]) : 0,
      connections: connectionsColumn ? parseNumber(row[connectionsColumn]) : 0,
      scheduled: scheduledColumn ? parseNumber(row[scheduledColumn]) : 0,
      qualifications: qualificationsColumn ? parseNumber(row[qualificationsColumn]) : 0,
    }));
  };

  const handleImport = async () => {
    setStep("importing");
    setImporting(true);
    setImportProgress(0);
    setImportedCount(0);
    setErrorCount(0);

    const dateColumn = columnMappings.find(m => m.field === "activity_date")?.csvColumn;
    const staffColumn = columnMappings.find(m => m.field === "staff_name")?.csvColumn;
    const approachesColumn = columnMappings.find(m => m.field === "approaches")?.csvColumn;
    const connectionsColumn = columnMappings.find(m => m.field === "connections")?.csvColumn;
    const scheduledColumn = columnMappings.find(m => m.field === "scheduled")?.csvColumn;
    const qualificationsColumn = columnMappings.find(m => m.field === "qualifications")?.csvColumn;

    let imported = 0;
    let errors = 0;
    const batchSize = 50;
    
    // Group records by staff_id + activity_date for upsert
    const recordsMap = new Map<string, {
      staff_id: string;
      activity_date: string;
      approaches: number;
      connections: number;
      scheduled: number;
      qualifications: number;
    }>();
    
    for (const row of csvData) {
      const dateStr = dateColumn ? row[dateColumn] : null;
      const parsedDate = dateStr ? parseDate(dateStr) : null;
      
      if (!parsedDate) {
        errors++;
        continue;
      }
      
      const staffName = staffColumn ? row[staffColumn] : null;
      const staffId = staffName ? staffMappings[staffName] : null;
      
      if (!staffId) {
        errors++;
        continue;
      }
      
      const key = `${staffId}:${parsedDate}`;
      const existing = recordsMap.get(key);
      
      const approaches = approachesColumn ? parseNumber(row[approachesColumn]) : 0;
      const connections = connectionsColumn ? parseNumber(row[connectionsColumn]) : 0;
      const scheduled = scheduledColumn ? parseNumber(row[scheduledColumn]) : 0;
      const qualifications = qualificationsColumn ? parseNumber(row[qualificationsColumn]) : 0;
      
      if (existing) {
        // Aggregate values for same staff/date
        existing.approaches += approaches;
        existing.connections += connections;
        existing.scheduled += scheduled;
        existing.qualifications += qualifications;
      } else {
        recordsMap.set(key, {
          staff_id: staffId,
          activity_date: parsedDate,
          approaches,
          connections,
          scheduled,
          qualifications,
        });
      }
    }

    const recordsToInsert = Array.from(recordsMap.values());

    // Insert/Update in batches
    for (let i = 0; i < recordsToInsert.length; i += batchSize) {
      const batch = recordsToInsert.slice(i, i + batchSize);
      
      // Use upsert to handle existing records
      const { error } = await supabase
        .from("crm_daily_activities")
        .upsert(batch, { 
          onConflict: "staff_id,activity_date",
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error("Import error:", error);
        // If upsert fails, try individual inserts
        for (const record of batch) {
          const { error: insertError } = await supabase
            .from("crm_daily_activities")
            .insert(record);
          
          if (insertError) {
            errors++;
          } else {
            imported++;
          }
        }
      } else {
        imported += batch.length;
      }
      
      setImportProgress(Math.round(((i + batch.length) / recordsToInsert.length) * 100));
      setImportedCount(imported);
      setErrorCount(errors);
    }

    setImporting(false);
    
    if (imported > 0) {
      toast.success(`${imported} registros importados com sucesso!`);
      onSuccess();
      setTimeout(() => {
        onOpenChange(false);
        resetDialog();
      }, 1500);
    } else {
      toast.error("Nenhum registro foi importado");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    resetDialog();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Histórico de Pré-Vendas
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Selecione um arquivo CSV ou Excel com o histórico de atividades de pré-vendas"}
            {step === "mapping" && "Mapeie as colunas do arquivo para os campos de atividades"}
            {step === "staff-mapping" && "Associe os nomes dos colaboradores aos usuários do sistema"}
            {step === "preview" && "Revise os dados antes de importar"}
            {step === "importing" && "Importando atividades..."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step: Upload */}
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors w-full max-w-md">
                <input
                  type="file"
                  id="presales-file-upload"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="presales-file-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Arraste ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground">CSV ou Excel (XLSX)</p>
                </label>
              </div>
              
              <div className="mt-6 text-sm text-muted-foreground">
                <p className="font-medium mb-2">Colunas esperadas:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Data (obrigatório)</li>
                  <li>SDR / Colaborador (obrigatório)</li>
                  <li>Abordagens (opcional)</li>
                  <li>Conexões (opcional)</li>
                  <li>Reuniões Agendadas (opcional)</li>
                  <li>Reuniões Realizadas / Qualificações (opcional)</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step: Column Mapping */}
          {step === "mapping" && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="outline">{csvData.length} linhas encontradas</Badge>
                </div>
                
                {csvHeaders.map(header => {
                  const mapping = columnMappings.find(m => m.csvColumn === header);
                  const sampleValues = csvData.slice(0, 3).map(row => row[header]).filter(Boolean);
                  
                  return (
                    <div key={header} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{header}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Ex: {sampleValues.slice(0, 2).join(", ") || "-"}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Select
                        value={mapping?.field || "ignore"}
                        onValueChange={(value) => updateColumnMapping(header, value)}
                      >
                        <SelectTrigger className="w-[250px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESALES_FIELDS.map(field => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Step: Staff Mapping */}
          {step === "staff-mapping" && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Associe os nomes encontrados na planilha aos usuários cadastrados no sistema.
                </p>
                
                {uniqueStaffNames.map(name => (
                  <div key={name} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{name}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Select
                      value={staffMappings[name] || ""}
                      onValueChange={(value) => setStaffMappings(prev => ({ ...prev, [name]: value }))}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staffList.map(staff => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {staffMappings[name] ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge variant="outline">{csvData.length} registros para importar</Badge>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Data</th>
                        <th className="p-2 text-left">Colaborador</th>
                        <th className="p-2 text-right">Abordagens</th>
                        <th className="p-2 text-right">Conexões</th>
                        <th className="p-2 text-right">Agendadas</th>
                        <th className="p-2 text-right">Realizadas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPreviewData().map((row) => (
                        <tr key={row.idx} className="border-t">
                          <td className="p-2">{row.date || "-"}</td>
                          <td className="p-2">{row.staff}</td>
                          <td className="p-2 text-right">{row.approaches}</td>
                          <td className="p-2 text-right">{row.connections}</td>
                          <td className="p-2 text-right">{row.scheduled}</td>
                          <td className="p-2 text-right">{row.qualifications}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {csvData.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Mostrando primeiros 10 registros de {csvData.length}
                  </p>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Step: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="w-full max-w-md space-y-2">
                <Progress value={importProgress} />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{importProgress}% concluído</span>
                  <span>{importedCount} importados, {errorCount} erros</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex justify-between pt-4 border-t">
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          )}
          
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleMappingComplete}>
                Continuar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
          
          {step === "staff-mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button 
                onClick={() => setStep("preview")}
                disabled={Object.keys(staffMappings).length === 0}
              >
                Continuar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
          
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => uniqueStaffNames.length > 0 ? setStep("staff-mapping") : setStep("mapping")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleImport}>
                <Check className="h-4 w-4 mr-2" />
                Importar {csvData.length} registros
              </Button>
            </>
          )}
          
          {step === "importing" && (
            <div className="w-full" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
