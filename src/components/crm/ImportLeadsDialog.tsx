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
  Download
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Pipeline {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  name: string;
  pipeline_id: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface ColumnMapping {
  csvColumn: string;
  crmField: string;
}

interface ParsedLead {
  [key: string]: string;
}

interface StageMapping {
  csvValue: string;
  stageId: string;
}

const CRM_FIELDS = [
  { value: "name", label: "Nome *", required: true },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "company", label: "Empresa" },
  { value: "role", label: "Cargo" },
  { value: "city", label: "Cidade" },
  { value: "state", label: "UF" },
  { value: "origin", label: "Origem" },
  { value: "opportunity_value", label: "Valor da Oportunidade" },
  { value: "segment", label: "Segmento" },
  { value: "main_pain", label: "Dor Principal" },
  { value: "urgency", label: "Urgência" },
  { value: "notes", label: "Observações" },
  { value: "stage_name", label: "Etapa (nome)" },
  { value: "ignore", label: "Ignorar coluna" },
];

export const ImportLeadsDialog = ({ open, onOpenChange, onSuccess }: ImportLeadsDialogProps) => {
  const [step, setStep] = useState<"upload" | "pipeline" | "mapping" | "stage-mapping" | "preview" | "importing">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<ParsedLead[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [defaultStage, setDefaultStage] = useState("");
  const [defaultOwner, setDefaultOwner] = useState("");
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [stageMappings, setStageMappings] = useState<StageMapping[]>([]);
  const [uniqueStageValues, setUniqueStageValues] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; errors: number }>({ success: 0, errors: 0 });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  useEffect(() => {
    if (selectedPipeline) {
      const pipelineStages = stages.filter(s => s.pipeline_id === selectedPipeline);
      if (pipelineStages.length > 0 && !defaultStage) {
        setDefaultStage(pipelineStages[0].id);
      }
    }
  }, [selectedPipeline, stages]);

  const loadData = async () => {
    const [pipelinesRes, stagesRes, staffRes] = await Promise.all([
      supabase.from("crm_pipelines").select("id, name").eq("is_active", true),
      supabase.from("crm_stages").select("id, name, pipeline_id").order("sort_order"),
      supabase.from("onboarding_staff").select("id, name, role")
        .eq("is_active", true)
        .in("role", ["master", "admin", "head_comercial", "closer", "sdr"]),
    ]);

    setPipelines(pipelinesRes.data || []);
    setStages(stagesRes.data || []);
    setStaffList(staffRes.data || []);
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    const isExcel = uploadedFile.name.endsWith('.xlsx') || uploadedFile.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const binaryStr = evt.target?.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<ParsedLead>(worksheet, { header: 1 });
        
        if (jsonData.length > 0) {
          const headers = (jsonData[0] as unknown as string[]).map(h => String(h || '').trim());
          const rows = jsonData.slice(1).map((row: any) => {
            const obj: ParsedLead = {};
            headers.forEach((header, index) => {
              obj[header] = String(row[index] || '').trim();
            });
            return obj;
          }).filter(row => Object.values(row).some(v => v !== ''));

          setCsvHeaders(headers.filter(h => h !== ''));
          setCsvData(rows);
          initializeColumnMappings(headers.filter(h => h !== ''));
          setStep("pipeline");
        }
      };
      reader.readAsBinaryString(uploadedFile);
    } else {
      Papa.parse(uploadedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          setCsvHeaders(headers);
          setCsvData(results.data as ParsedLead[]);
          initializeColumnMappings(headers);
          setStep("pipeline");
        },
        error: (error) => {
          toast.error(`Erro ao ler arquivo: ${error.message}`);
        }
      });
    }
  }, []);

  const initializeColumnMappings = (headers: string[]) => {
    const autoMappings: ColumnMapping[] = headers.map(header => {
      const lowerHeader = header.toLowerCase().trim();
      let crmField = "ignore";

      if (lowerHeader.includes("nome") || lowerHeader === "name") {
        crmField = "name";
      } else if (lowerHeader.includes("telefone") || lowerHeader.includes("phone") || lowerHeader.includes("whatsapp") || lowerHeader.includes("celular")) {
        crmField = "phone";
      } else if (lowerHeader.includes("email") || lowerHeader.includes("e-mail")) {
        crmField = "email";
      } else if (lowerHeader.includes("empresa") || lowerHeader.includes("company")) {
        crmField = "company";
      } else if (lowerHeader.includes("cargo") || lowerHeader.includes("role") || lowerHeader.includes("função")) {
        crmField = "role";
      } else if (lowerHeader.includes("cidade") || lowerHeader.includes("city")) {
        crmField = "city";
      } else if (lowerHeader.includes("estado") || lowerHeader.includes("uf") || lowerHeader.includes("state")) {
        crmField = "state";
      } else if (lowerHeader.includes("origem") || lowerHeader.includes("source") || lowerHeader.includes("canal")) {
        crmField = "origin";
      } else if (lowerHeader.includes("valor") || lowerHeader.includes("value") || lowerHeader.includes("oportunidade")) {
        crmField = "opportunity_value";
      } else if (lowerHeader.includes("segmento") || lowerHeader.includes("segment")) {
        crmField = "segment";
      } else if (lowerHeader.includes("dor") || lowerHeader.includes("pain") || lowerHeader.includes("necessidade")) {
        crmField = "main_pain";
      } else if (lowerHeader.includes("urgência") || lowerHeader.includes("urgencia") || lowerHeader.includes("prioridade")) {
        crmField = "urgency";
      } else if (lowerHeader.includes("observ") || lowerHeader.includes("nota") || lowerHeader.includes("notes")) {
        crmField = "notes";
      } else if (lowerHeader.includes("etapa") || lowerHeader.includes("stage") || lowerHeader.includes("fase") || lowerHeader.includes("status")) {
        crmField = "stage_name";
      }

      return { csvColumn: header, crmField };
    });

    setColumnMappings(autoMappings);
  };

  const updateColumnMapping = (csvColumn: string, crmField: string) => {
    setColumnMappings(prev => 
      prev.map(m => m.csvColumn === csvColumn ? { ...m, crmField } : m)
    );
  };

  const handlePipelineSelected = () => {
    if (!selectedPipeline || !defaultStage) {
      toast.error("Selecione um funil e uma etapa padrão");
      return;
    }
    setStep("mapping");
  };

  const handleMappingComplete = () => {
    const hasName = columnMappings.some(m => m.crmField === "name");
    if (!hasName) {
      toast.error("É necessário mapear pelo menos a coluna 'Nome'");
      return;
    }

    // Check if stage_name is mapped
    const stageNameMapping = columnMappings.find(m => m.crmField === "stage_name");
    if (stageNameMapping) {
      // Get unique stage values from CSV
      const stageValues = [...new Set(csvData.map(row => row[stageNameMapping.csvColumn]).filter(v => v && v.trim() !== ''))];
      setUniqueStageValues(stageValues);
      
      // Initialize stage mappings
      const pipelineStages = stages.filter(s => s.pipeline_id === selectedPipeline);
      const initialMappings = stageValues.map(value => {
        // Try to auto-match by name similarity
        const matchedStage = pipelineStages.find(s => 
          s.name.toLowerCase().trim() === value.toLowerCase().trim()
        );
        return {
          csvValue: value,
          stageId: matchedStage?.id || defaultStage,
        };
      });
      setStageMappings(initialMappings);
      setStep("stage-mapping");
    } else {
      setStep("preview");
    }
  };

  const handleStageMappingComplete = () => {
    setStep("preview");
  };

  const updateStageMapping = (csvValue: string, stageId: string) => {
    setStageMappings(prev => 
      prev.map(m => m.csvValue === csvValue ? { ...m, stageId } : m)
    );
  };

  const getLeadPreview = () => {
    return csvData.slice(0, 5).map(row => {
      const lead: any = {};
      columnMappings.forEach(mapping => {
        if (mapping.crmField !== "ignore") {
          lead[mapping.crmField] = row[mapping.csvColumn];
        }
      });

      // Map stage if stage_name is present
      if (lead.stage_name) {
        const stageMapping = stageMappings.find(m => m.csvValue === lead.stage_name);
        const stage = stages.find(s => s.id === (stageMapping?.stageId || defaultStage));
        lead._stageName = stage?.name || "Etapa padrão";
      } else {
        const stage = stages.find(s => s.id === defaultStage);
        lead._stageName = stage?.name || "Etapa padrão";
      }

      return lead;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setStep("importing");
    setImportProgress(0);
    setImportResults({ success: 0, errors: 0 });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!staff) throw new Error("Staff não encontrado");

      const stageNameMapping = columnMappings.find(m => m.crmField === "stage_name");
      const pipelineStages = stages.filter(s => s.pipeline_id === selectedPipeline);

      let success = 0;
      let errors = 0;
      const batchSize = 50;
      
      for (let i = 0; i < csvData.length; i += batchSize) {
        const batch = csvData.slice(i, i + batchSize);
        
        const leadsToInsert = batch.map(row => {
          const lead: any = {
            pipeline_id: selectedPipeline,
            stage_id: defaultStage,
            owner_staff_id: defaultOwner || staff.id,
            created_by: staff.id,
            entered_pipeline_at: new Date().toISOString(),
          };

          columnMappings.forEach(mapping => {
            if (mapping.crmField !== "ignore" && mapping.crmField !== "stage_name") {
              const value = row[mapping.csvColumn]?.trim();
              if (value) {
                if (mapping.crmField === "opportunity_value") {
                  const numValue = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.'));
                  lead[mapping.crmField] = isNaN(numValue) ? 0 : numValue;
                } else {
                  lead[mapping.crmField] = value;
                }
              }
            }
          });

          // Map stage if stage_name is present
          if (stageNameMapping) {
            const stageValue = row[stageNameMapping.csvColumn]?.trim();
            if (stageValue) {
              const stageMapping = stageMappings.find(m => m.csvValue === stageValue);
              if (stageMapping) {
                lead.stage_id = stageMapping.stageId;
              }
            }
          }

          return lead;
        }).filter(lead => lead.name && lead.name.trim() !== '');

        if (leadsToInsert.length > 0) {
          const { error } = await supabase.from("crm_leads").insert(leadsToInsert);
          if (error) {
            console.error("Batch error:", error);
            errors += leadsToInsert.length;
          } else {
            success += leadsToInsert.length;
          }
        }

        setImportProgress(Math.round(((i + batch.length) / csvData.length) * 100));
        setImportResults({ success, errors });
      }

      if (success > 0) {
        toast.success(`${success} leads importados com sucesso!`);
        onSuccess();
      }
      if (errors > 0) {
        toast.error(`${errors} leads com erro na importação`);
      }

    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Erro na importação");
    } finally {
      setImporting(false);
    }
  };

  const resetDialog = () => {
    setStep("upload");
    setFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setSelectedPipeline("");
    setDefaultStage("");
    setDefaultOwner("");
    setColumnMappings([]);
    setStageMappings([]);
    setUniqueStageValues([]);
    setImportProgress(0);
    setImportResults({ success: 0, errors: 0 });
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const headers = ["Nome", "Telefone", "E-mail", "Empresa", "Cargo", "Cidade", "UF", "Origem", "Valor", "Segmento", "Dor Principal", "Urgência", "Observações", "Etapa"];
    const example = ["João Silva", "(11) 99999-9999", "joao@empresa.com", "Empresa ABC", "Diretor", "São Paulo", "SP", "Indicação", "50000", "Tecnologia", "Precisa de automação", "high", "Cliente potencial", "Triagem"];
    
    const csv = [headers.join(","), example.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_importacao_leads.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const pipelineStages = stages.filter(s => s.pipeline_id === selectedPipeline);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Leads de Planilha
          </DialogTitle>
          <DialogDescription>
            Importe leads de um arquivo CSV ou Excel para o CRM
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4 border-b">
          {["upload", "pipeline", "mapping", "stage-mapping", "preview", "importing"].map((s, i) => {
            const stepLabels: Record<string, string> = {
              upload: "Arquivo",
              pipeline: "Funil",
              mapping: "Colunas",
              "stage-mapping": "Etapas",
              preview: "Revisão",
              importing: "Importando",
            };
            const isActive = step === s;
            const isPast = ["upload", "pipeline", "mapping", "stage-mapping", "preview", "importing"].indexOf(step) > i;
            
            // Skip stage-mapping step indicator if not needed
            if (s === "stage-mapping" && !columnMappings.some(m => m.crmField === "stage_name")) {
              return null;
            }

            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" :
                  isPast ? "bg-primary/20 text-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {isPast ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`text-sm ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                  {stepLabels[s]}
                </span>
                {i < 5 && s !== "stage-mapping" && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        <ScrollArea className="flex-1 px-1">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-6 py-6">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Arraste seu arquivo aqui</p>
                <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="max-w-xs mx-auto"
                />
              </div>

              <div className="flex items-center justify-center gap-4">
                <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                  <Download className="h-4 w-4" />
                  Baixar Modelo CSV
                </Button>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Dicas para importação
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• A primeira linha deve conter os cabeçalhos das colunas</li>
                  <li>• O campo "Nome" é obrigatório para cada lead</li>
                  <li>• Formatos aceitos: CSV, XLSX, XLS</li>
                  <li>• Se tiver uma coluna de "Etapa", você poderá mapear cada valor para uma etapa do funil</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Pipeline Selection */}
          {step === "pipeline" && (
            <div className="space-y-6 py-6">
              <div className="bg-muted/30 rounded-lg p-4 mb-4">
                <p className="text-sm">
                  <strong>{csvData.length}</strong> leads encontrados no arquivo <strong>{file?.name}</strong>
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Funil de Destino *</Label>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Todos os leads serão importados para este funil
                  </p>
                </div>

                {selectedPipeline && (
                  <div>
                    <Label>Etapa Padrão *</Label>
                    <Select value={defaultStage} onValueChange={setDefaultStage}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione a etapa padrão" />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelineStages.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Leads sem etapa definida serão colocados nesta etapa
                    </p>
                  </div>
                )}

                <div>
                  <Label>Responsável Padrão (opcional)</Label>
                  <Select value={defaultOwner} onValueChange={setDefaultOwner}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Voltar
                </Button>
                <Button onClick={handlePipelineSelected} disabled={!selectedPipeline || !defaultStage}>
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Column Mapping */}
          {step === "mapping" && (
            <div className="space-y-6 py-6">
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Mapeamento de Colunas</p>
                <p className="text-xs text-muted-foreground">
                  Associe cada coluna do arquivo a um campo do CRM. Campos com * são obrigatórios.
                </p>
              </div>

              <div className="space-y-3">
                {columnMappings.map((mapping, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{mapping.csvColumn}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        Ex: {csvData[0]?.[mapping.csvColumn] || "-"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Select
                      value={mapping.crmField}
                      onValueChange={(value) => updateColumnMapping(mapping.csvColumn, value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CRM_FIELDS.map(f => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mapping.crmField !== "ignore" && mapping.crmField !== "stage_name" && (
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                    {mapping.crmField === "stage_name" && (
                      <Badge variant="secondary" className="flex-shrink-0">Etapa</Badge>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("pipeline")}>
                  Voltar
                </Button>
                <Button onClick={handleMappingComplete}>
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Stage Mapping */}
          {step === "stage-mapping" && (
            <div className="space-y-6 py-6">
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Mapeamento de Etapas</p>
                <p className="text-xs text-muted-foreground">
                  Associe cada valor de etapa do arquivo a uma etapa do funil selecionado.
                </p>
              </div>

              <div className="space-y-3">
                {stageMappings.map((mapping, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex-1">
                      <Badge variant="outline">{mapping.csvValue}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {csvData.filter(row => {
                          const stageCol = columnMappings.find(m => m.crmField === "stage_name")?.csvColumn;
                          return stageCol && row[stageCol] === mapping.csvValue;
                        }).length} leads
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Select
                      value={mapping.stageId}
                      onValueChange={(value) => updateStageMapping(mapping.csvValue, value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelineStages.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  Voltar
                </Button>
                <Button onClick={handleStageMappingComplete}>
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Preview */}
          {step === "preview" && (
            <div className="space-y-6 py-6">
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Prévia da Importação</p>
                <p className="text-xs text-muted-foreground">
                  Revise os primeiros leads antes de confirmar a importação.
                </p>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Nome</th>
                      <th className="px-3 py-2 text-left">Telefone</th>
                      <th className="px-3 py-2 text-left">E-mail</th>
                      <th className="px-3 py-2 text-left">Empresa</th>
                      <th className="px-3 py-2 text-left">Etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getLeadPreview().map((lead, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">{lead.name || "-"}</td>
                        <td className="px-3 py-2">{lead.phone || "-"}</td>
                        <td className="px-3 py-2">{lead.email || "-"}</td>
                        <td className="px-3 py-2">{lead.company || "-"}</td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary">{lead._stageName}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {csvData.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  ...e mais {csvData.length - 5} leads
                </p>
              )}

              <div className="bg-primary/10 rounded-lg p-4">
                <p className="text-sm font-medium">Resumo da Importação</p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>• <strong>{csvData.length}</strong> leads serão importados</li>
                  <li>• Funil: <strong>{pipelines.find(p => p.id === selectedPipeline)?.name}</strong></li>
                  <li>• Etapa padrão: <strong>{pipelineStages.find(s => s.id === defaultStage)?.name}</strong></li>
                  {defaultOwner && (
                    <li>• Responsável: <strong>{staffList.find(s => s.id === defaultOwner)?.name}</strong></li>
                  )}
                </ul>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => {
                  if (columnMappings.some(m => m.crmField === "stage_name")) {
                    setStep("stage-mapping");
                  } else {
                    setStep("mapping");
                  }
                }}>
                  Voltar
                </Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      Importar {csvData.length} Leads
                      <Check className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 6: Importing */}
          {step === "importing" && (
            <div className="space-y-6 py-12 text-center">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
              <div>
                <p className="text-lg font-medium">Importando leads...</p>
                <p className="text-sm text-muted-foreground">Não feche esta janela</p>
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <Progress value={importProgress} />
                <p className="text-sm text-muted-foreground">{importProgress}%</p>
              </div>

              <div className="flex justify-center gap-6 mt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">{importResults.success}</p>
                  <p className="text-xs text-muted-foreground">Importados</p>
                </div>
                {importResults.errors > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-500">{importResults.errors}</p>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </div>
                )}
              </div>

              {!importing && importProgress === 100 && (
                <Button onClick={handleClose} className="mt-4">
                  Fechar
                </Button>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
