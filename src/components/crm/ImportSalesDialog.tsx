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
import { Label } from "@/components/ui/label";
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
  AlertTriangle,
  Loader2,
  Download,
  ArrowLeft
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface ImportSalesDialogProps {
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
  salesField: string;
}

interface ParsedRow {
  [key: string]: string;
}

const SALES_FIELDS = [
  { value: "sale_date", label: "Data da Venda *", required: true },
  { value: "closer_name", label: "Closer (Nome)" },
  { value: "billing_value", label: "Faturamento" },
  { value: "revenue_value", label: "Receita" },
  { value: "product_name", label: "Produto" },
  { value: "quantity", label: "Quantidade de Vendas" },
  { value: "notes", label: "Observações" },
  { value: "ignore", label: "Ignorar coluna" },
];

export const ImportSalesDialog = ({ open, onOpenChange, onSuccess }: ImportSalesDialogProps) => {
  const [step, setStep] = useState<"upload" | "mapping" | "closer-mapping" | "preview" | "importing">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<ParsedRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [closerMappings, setCloserMappings] = useState<Record<string, string>>({});
  const [uniqueCloserNames, setUniqueCloserNames] = useState<string[]>([]);
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
    setCloserMappings({});
    setUniqueCloserNames([]);
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
      let salesField = "ignore";
      
      if (lowerHeader.includes("data")) salesField = "sale_date";
      else if (lowerHeader.includes("closer") || lowerHeader.includes("vendedor")) salesField = "closer_name";
      else if (lowerHeader.includes("faturamento")) salesField = "billing_value";
      else if (lowerHeader.includes("receita")) salesField = "revenue_value";
      else if (lowerHeader.includes("produto")) salesField = "product_name";
      else if (lowerHeader.includes("quantidade")) salesField = "quantity";
      else if (lowerHeader.includes("observ") || lowerHeader.includes("notas")) salesField = "notes";
      
      return { csvColumn: header, salesField };
    });
    
    setColumnMappings(mappings);
  };

  const updateColumnMapping = (csvColumn: string, salesField: string) => {
    setColumnMappings(prev => 
      prev.map(m => m.csvColumn === csvColumn ? { ...m, salesField } : m)
    );
  };

  const handleMappingComplete = () => {
    // Check required fields
    const hasDate = columnMappings.some(m => m.salesField === "sale_date");
    const hasBillingOrRevenue = columnMappings.some(m => m.salesField === "billing_value" || m.salesField === "revenue_value");
    
    if (!hasDate) {
      toast.error("A coluna 'Data da Venda' é obrigatória");
      return;
    }
    
    if (!hasBillingOrRevenue) {
      toast.error("É necessário mapear 'Faturamento' ou 'Receita'");
      return;
    }
    
    // Extract unique closer names
    const closerMapping = columnMappings.find(m => m.salesField === "closer_name");
    if (closerMapping) {
      const closerColumn = closerMapping.csvColumn;
      const uniqueNames = [...new Set(csvData.map(row => row[closerColumn]).filter(Boolean))];
      setUniqueCloserNames(uniqueNames);
      
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
      setCloserMappings(autoMappings);
      setStep("closer-mapping");
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
    // Remove currency symbols, spaces, and handle Brazilian number format
    const cleaned = value
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  const getPreviewData = () => {
    const dateColumn = columnMappings.find(m => m.salesField === "sale_date")?.csvColumn;
    const closerColumn = columnMappings.find(m => m.salesField === "closer_name")?.csvColumn;
    const billingColumn = columnMappings.find(m => m.salesField === "billing_value")?.csvColumn;
    const revenueColumn = columnMappings.find(m => m.salesField === "revenue_value")?.csvColumn;
    const productColumn = columnMappings.find(m => m.salesField === "product_name")?.csvColumn;
    const quantityColumn = columnMappings.find(m => m.salesField === "quantity")?.csvColumn;
    
    return csvData.slice(0, 10).map((row, idx) => {
      const quantity = quantityColumn ? parseInt(row[quantityColumn]) || 1 : 1;
      const billing = billingColumn ? parseNumber(row[billingColumn]) : 0;
      const revenue = revenueColumn ? parseNumber(row[revenueColumn]) : billing;
      
      return {
        idx,
        date: dateColumn ? parseDate(row[dateColumn]) : null,
        closer: closerColumn ? row[closerColumn] : "-",
        billing: billing / quantity,
        revenue: revenue / quantity,
        product: productColumn ? row[productColumn] : "-",
        quantity,
      };
    });
  };

  const handleImport = async () => {
    setStep("importing");
    setImporting(true);
    setImportProgress(0);
    setImportedCount(0);
    setErrorCount(0);

    const dateColumn = columnMappings.find(m => m.salesField === "sale_date")?.csvColumn;
    const closerColumn = columnMappings.find(m => m.salesField === "closer_name")?.csvColumn;
    const billingColumn = columnMappings.find(m => m.salesField === "billing_value")?.csvColumn;
    const revenueColumn = columnMappings.find(m => m.salesField === "revenue_value")?.csvColumn;
    const productColumn = columnMappings.find(m => m.salesField === "product_name")?.csvColumn;
    const quantityColumn = columnMappings.find(m => m.salesField === "quantity")?.csvColumn;
    const notesColumn = columnMappings.find(m => m.salesField === "notes")?.csvColumn;

    let imported = 0;
    let errors = 0;
    const batchSize = 50;
    
    // Prepare all sales records
    const salesToInsert: any[] = [];
    
    for (const row of csvData) {
      const dateStr = dateColumn ? row[dateColumn] : null;
      const parsedDate = dateStr ? parseDate(dateStr) : null;
      
      if (!parsedDate) {
        errors++;
        continue;
      }
      
      const closerName = closerColumn ? row[closerColumn] : null;
      const closerStaffId = closerName ? closerMappings[closerName] || null : null;
      
      const quantity = quantityColumn ? parseInt(row[quantityColumn]) || 1 : 1;
      const totalBilling = billingColumn ? parseNumber(row[billingColumn]) : 0;
      const totalRevenue = revenueColumn ? parseNumber(row[revenueColumn]) : totalBilling;
      
      // If quantity > 1, divide values and create multiple records
      const billingPerSale = totalBilling / quantity;
      const revenuePerSale = totalRevenue / quantity;
      
      for (let i = 0; i < quantity; i++) {
        salesToInsert.push({
          sale_date: parsedDate,
          closer_staff_id: closerStaffId,
          billing_value: billingPerSale,
          revenue_value: revenuePerSale || billingPerSale,
          product_name: productColumn ? row[productColumn] : null,
          notes: notesColumn ? row[notesColumn] : null,
          payment_status: "completed",
        });
      }
    }

    // Insert in batches
    for (let i = 0; i < salesToInsert.length; i += batchSize) {
      const batch = salesToInsert.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from("crm_sales")
        .insert(batch);
      
      if (error) {
        console.error("Import error:", error);
        errors += batch.length;
      } else {
        imported += batch.length;
      }
      
      setImportProgress(Math.round(((i + batch.length) / salesToInsert.length) * 100));
      setImportedCount(imported);
      setErrorCount(errors);
    }

    setImporting(false);
    
    if (imported > 0) {
      toast.success(`${imported} vendas importadas com sucesso!`);
      onSuccess();
      setTimeout(() => {
        onOpenChange(false);
        resetDialog();
      }, 1500);
    } else {
      toast.error("Nenhuma venda foi importada");
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
            Importar Histórico de Vendas
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Selecione um arquivo CSV ou Excel com o histórico de vendas"}
            {step === "mapping" && "Mapeie as colunas do arquivo para os campos de vendas"}
            {step === "closer-mapping" && "Associe os nomes dos closers aos usuários do sistema"}
            {step === "preview" && "Revise os dados antes de importar"}
            {step === "importing" && "Importando vendas..."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step: Upload */}
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors w-full max-w-md">
                <input
                  type="file"
                  id="file-upload"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Arraste ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground">CSV ou Excel (XLSX)</p>
                </label>
              </div>
              
              <div className="mt-6 text-sm text-muted-foreground">
                <p className="font-medium mb-2">Colunas esperadas:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Data da Venda (obrigatório)</li>
                  <li>Faturamento ou Receita (pelo menos um)</li>
                  <li>Closer/Vendedor (opcional)</li>
                  <li>Produto (opcional)</li>
                  <li>Quantidade de Vendas (opcional, padrão: 1)</li>
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
                        value={mapping?.salesField || "ignore"}
                        onValueChange={(value) => updateColumnMapping(header, value)}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SALES_FIELDS.map(field => (
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

          {/* Step: Closer Mapping */}
          {step === "closer-mapping" && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Associe os nomes dos closers encontrados na planilha aos usuários cadastrados no sistema.
                  Closers não mapeados serão importados sem responsável.
                </p>
                
                {uniqueCloserNames.map(name => (
                  <div key={name} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {csvData.filter(row => {
                          const closerCol = columnMappings.find(m => m.salesField === "closer_name")?.csvColumn;
                          return closerCol && row[closerCol] === name;
                        }).length} vendas
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Select
                      value={closerMappings[name] || "none"}
                      onValueChange={(value) => setCloserMappings(prev => ({
                        ...prev,
                        [name]: value === "none" ? "" : value
                      }))}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não mapear</SelectItem>
                        {staffList.map(staff => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {closerMappings[name] && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {csvData.length} linhas para importar
                </Badge>
              </div>
              
              <ScrollArea className="h-[300px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Data</th>
                      <th className="text-left p-2">Closer</th>
                      <th className="text-right p-2">Faturamento</th>
                      <th className="text-right p-2">Receita</th>
                      <th className="text-left p-2">Produto</th>
                      <th className="text-center p-2">Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPreviewData().map((row) => (
                      <tr key={row.idx} className="border-b">
                        <td className="p-2">{row.date || <span className="text-red-500">Inválida</span>}</td>
                        <td className="p-2">{row.closer}</td>
                        <td className="p-2 text-right">
                          {row.billing.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="p-2 text-right">
                          {row.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="p-2">{row.product}</td>
                        <td className="p-2 text-center">{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 10 && (
                  <p className="text-center text-muted-foreground py-2">
                    ... e mais {csvData.length - 10} linhas
                  </p>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Step: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-lg font-medium">Importando vendas...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {importedCount} importadas • {errorCount} erros
                </p>
              </div>
              <Progress value={importProgress} className="w-64" />
              <p className="text-sm text-muted-foreground">{importProgress}%</p>
            </div>
          )}
        </div>

        {/* Footer with actions */}
        {step !== "importing" && (
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={() => {
              if (step === "mapping") setStep("upload");
              else if (step === "closer-mapping") setStep("mapping");
              else if (step === "preview") {
                if (uniqueCloserNames.length > 0) setStep("closer-mapping");
                else setStep("mapping");
              }
              else handleClose();
            }}>
              {step === "upload" ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </>
              ) : (
                <>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </>
              )}
            </Button>
            
            {step === "mapping" && (
              <Button onClick={handleMappingComplete}>
                Continuar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            
            {step === "closer-mapping" && (
              <Button onClick={() => setStep("preview")}>
                Continuar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            
            {step === "preview" && (
              <Button onClick={handleImport} disabled={importing}>
                Importar {csvData.length} Vendas
                <Check className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
