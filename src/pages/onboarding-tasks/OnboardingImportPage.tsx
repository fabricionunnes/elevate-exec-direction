import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Upload, 
  FileSpreadsheet, 
  Building2, 
  FolderOpen, 
  ListTodo,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Users
} from 'lucide-react';
import { addDays, parse, isValid } from 'date-fns';
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";

interface ParsedTask {
  taskId: string;
  name: string;
  section: string;
  assignee: string;
  assigneeEmail: string;
  startDate: string | null;
  dueDate: string | null;
  notes: string;
  createdAt: string;
  completedAt: string | null;
  status: 'pending' | 'in_progress' | 'completed';
}

interface ParsedData {
  companyName: string;
  tasks: ParsedTask[];
  sections: string[];
  contractValue: number | null;
}

interface Service {
  id: string;
  name: string;
  slug: string;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface ImportResult {
  companyId: string;
  companyName: string;
  projectId: string;
  projectName: string;
  tasksImported: number;
}

export default function OnboardingImportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedCS, setSelectedCS] = useState<string>('');
  const [selectedConsultant, setSelectedConsultant] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [editedCompanyName, setEditedCompanyName] = useState<string>('');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch services and staff on mount
  useState(() => {
    const fetchData = async () => {
      // Fetch services
      const { data: servicesData } = await supabase
        .from('onboarding_services')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');
      
      if (servicesData) setServices(servicesData);

      // Fetch staff (CS and Consultants)
      const { data: staffData } = await supabase
        .from('onboarding_staff')
        .select('id, name, role')
        .eq('is_active', true)
        .in('role', ['cs', 'consultant', 'admin'])
        .order('name');
      
      if (staffData) setStaff(staffData);
    };
    fetchData();
  });

  const parseCSV = useCallback((content: string): ParsedData | null => {
    try {
      const lines = content.split('\n');
      if (lines.length < 2) throw new Error('Arquivo vazio ou inválido');

      // Parse header
      const headerLine = lines[0];
      const headers = parseCSVLine(headerLine);
      
      // Find column indices
      const colIndex = {
        taskId: headers.findIndex(h => h.toLowerCase().includes('task id')),
        createdAt: headers.findIndex(h => h.toLowerCase() === 'created at'),
        completedAt: headers.findIndex(h => h.toLowerCase() === 'completed at'),
        name: headers.findIndex(h => h.toLowerCase() === 'name'),
        section: headers.findIndex(h => h.toLowerCase().includes('section')),
        assignee: headers.findIndex(h => h.toLowerCase() === 'assignee'),
        assigneeEmail: headers.findIndex(h => h.toLowerCase().includes('assignee email')),
        startDate: headers.findIndex(h => h.toLowerCase() === 'start date'),
        dueDate: headers.findIndex(h => h.toLowerCase() === 'due date'),
        notes: headers.findIndex(h => h.toLowerCase() === 'notes'),
        projects: headers.findIndex(h => h.toLowerCase() === 'projects'),
        contractValue: headers.findIndex(h => h.toLowerCase().includes('valor do contrato')),
      };

      // Parse rows
      const tasks: ParsedTask[] = [];
      const sectionsSet = new Set<string>();
      let companyName = '';
      let contractValue: number | null = null;

      // Join multi-line content properly
      let currentRow = '';
      let inQuote = false;
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if we're inside quotes
        for (const char of line) {
          if (char === '"') inQuote = !inQuote;
        }
        
        currentRow += (currentRow ? '\n' : '') + line;
        
        if (!inQuote) {
          // Process complete row
          const values = parseCSVLine(currentRow);
          
          if (values.length >= Math.max(...Object.values(colIndex)) + 1) {
            const name = values[colIndex.name]?.trim();
            const section = values[colIndex.section]?.trim();
            const projects = values[colIndex.projects]?.trim();
            
            // Extract company name from projects field
            if (projects && !companyName) {
              // Format: "COMPANY NAME / TRADING NAME"
              companyName = projects.split('/')[0]?.trim() || projects;
            }

            // Extract contract value
            if (colIndex.contractValue >= 0 && !contractValue) {
              const valStr = values[colIndex.contractValue];
              if (valStr) {
                const parsed = parseFloat(valStr.replace(/[^\d.,]/g, '').replace(',', '.'));
                if (!isNaN(parsed)) contractValue = parsed;
              }
            }

            if (name && section) {
              sectionsSet.add(section);
              
              const completedAt = values[colIndex.completedAt]?.trim() || null;
              
              tasks.push({
                taskId: values[colIndex.taskId]?.trim() || '',
                name,
                section,
                assignee: values[colIndex.assignee]?.trim() || '',
                assigneeEmail: values[colIndex.assigneeEmail]?.trim() || '',
                startDate: parseAsanaDate(values[colIndex.startDate]),
                dueDate: parseAsanaDate(values[colIndex.dueDate]),
                notes: cleanNotes(values[colIndex.notes] || ''),
                createdAt: values[colIndex.createdAt]?.trim() || '',
                completedAt,
                status: completedAt ? 'completed' : 'pending',
              });
            }
          }
          
          currentRow = '';
          inQuote = false;
        }
      }

      if (!companyName) throw new Error('Não foi possível identificar o nome da empresa');
      if (tasks.length === 0) throw new Error('Nenhuma tarefa encontrada no arquivo');

      return {
        companyName,
        tasks,
        sections: Array.from(sectionsSet).sort(),
        contractValue,
      };
    } catch (err: any) {
      console.error('CSV Parse error:', err);
      throw new Error(err.message || 'Erro ao processar arquivo CSV');
    }
  }, []);

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  };

  const parseAsanaDate = (dateStr: string | undefined): string | null => {
    if (!dateStr) return null;
    const trimmed = dateStr.trim();
    if (!trimmed) return null;
    
    // Asana exports as YYYY-MM-DD
    const date = parse(trimmed, 'yyyy-MM-dd', new Date());
    if (isValid(date)) {
      return trimmed;
    }
    return null;
  };

  const cleanNotes = (notes: string): string => {
    // Remove Asana asset links and clean up
    return notes
      .replace(/https:\/\/app\.asana\.com\/app\/asana\/-\/get_asset\?asset_id=\d+/g, '')
      .trim();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setParsedData(null);
    setImportResult(null);
    setSelectedSections([]);

    try {
      const content = await file.text();
      const data = parseCSV(content);
      
      if (data) {
        setParsedData(data);
        setEditedCompanyName(data.companyName); // Set editable company name
        setSelectedSections(data.sections); // Select all by default
        toast.success(`${data.tasks.length} tarefas encontradas em ${data.sections.length} seções`);
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleSection = (section: string) => {
    setSelectedSections(prev => 
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleImport = async () => {
    if (!parsedData || !selectedService) {
      toast.error('Selecione um serviço para importar');
      return;
    }

    if (selectedSections.length === 0) {
      toast.error('Selecione pelo menos uma seção para importar');
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      const service = services.find(s => s.id === selectedService);
      if (!service) throw new Error('Serviço não encontrado');

      setProgress(10);

      // 1. Create or find company
      let companyId: string;
      const companyNameToUse = editedCompanyName.trim() || parsedData.companyName;
      
      const { data: existingCompany } = await supabase
        .from('onboarding_companies')
        .select('id')
        .ilike('name', companyNameToUse)
        .single();

      if (existingCompany) {
        companyId = existingCompany.id;
        
        // Update CS and Consultant if provided
        if (selectedCS || selectedConsultant) {
          await supabase
            .from('onboarding_companies')
            .update({
              cs_id: selectedCS || null,
              consultant_id: selectedConsultant || null,
            })
            .eq('id', companyId);
        }
      } else {
        const { data: newCompany, error: companyError } = await supabase
          .from('onboarding_companies')
          .insert({
            name: companyNameToUse,
            contract_value: parsedData.contractValue,
            status: 'active',
            cs_id: selectedCS || null,
            consultant_id: selectedConsultant || null,
          })
          .select('id')
          .single();

        if (companyError) throw companyError;
        companyId = newCompany.id;
      }

      setProgress(30);

      // 2. Create project
      const { data: existingProjects } = await supabase
        .from('onboarding_projects')
        .select('id, product_name')
        .eq('onboarding_company_id', companyId)
        .ilike('product_id', service.slug);

      const projectNumber = (existingProjects?.length || 0) + 1;
      const projectName = projectNumber > 1 
        ? `${companyNameToUse} - ${service.name} (${projectNumber})`
        : `${companyNameToUse} - ${service.name}`;

      const { data: newProject, error: projectError } = await supabase
        .from('onboarding_projects')
        .insert({
          onboarding_company_id: companyId,
          product_id: service.slug,
          product_name: projectName,
          status: 'active',
          cs_id: selectedCS || null,
          consultant_id: selectedConsultant || null,
        })
        .select('id')
        .single();

      if (projectError) throw projectError;

      // 3. Create staff as project users
      const staffToAdd: { staff_id: string; role: 'cs' | 'consultant' }[] = [];
      if (selectedCS) staffToAdd.push({ staff_id: selectedCS, role: 'cs' });
      if (selectedConsultant && selectedConsultant !== selectedCS) {
        staffToAdd.push({ staff_id: selectedConsultant, role: 'consultant' });
      }

      for (const staffMember of staffToAdd) {
        // Get staff info
        const staffInfo = staff.find(s => s.id === staffMember.staff_id);
        if (!staffInfo) continue;

        // Get staff's auth user_id
        const { data: staffData } = await supabase
          .from('onboarding_staff')
          .select('user_id, email, name')
          .eq('id', staffMember.staff_id)
          .single();

        if (staffData?.user_id) {
          // Check if user already exists for this project
          const { data: existingUser } = await supabase
            .from('onboarding_users')
            .select('id')
            .eq('project_id', newProject.id)
            .eq('user_id', staffData.user_id)
            .single();

          if (!existingUser) {
            await supabase
              .from('onboarding_users')
              .insert({
                project_id: newProject.id,
                user_id: staffData.user_id,
                email: staffData.email,
                name: staffData.name,
                role: staffMember.role,
                password_changed: true,
              });
          }
        }
      }

      setProgress(50);

      // 3. Import tasks
      const tasksToImport = parsedData.tasks.filter(t => 
        selectedSections.includes(t.section)
      );

      const tasksData = tasksToImport.map((task, index) => ({
        project_id: newProject.id,
        title: task.name,
        description: task.notes || null,
        status: task.status,
        priority: 'medium',
        due_date: task.dueDate,
        start_date: task.startDate,
        completed_at: task.completedAt,
        sort_order: index,
        tags: [task.section],
      }));

      // Insert in batches of 50
      const batchSize = 50;
      let imported = 0;

      for (let i = 0; i < tasksData.length; i += batchSize) {
        const batch = tasksData.slice(i, i + batchSize);
        const { error: tasksError } = await supabase
          .from('onboarding_tasks')
          .insert(batch);

        if (tasksError) throw tasksError;
        
        imported += batch.length;
        setProgress(50 + Math.floor((imported / tasksData.length) * 45));
      }

      setProgress(100);

      setImportResult({
        companyId,
        companyName: companyNameToUse,
        projectId: newProject.id,
        projectName,
        tasksImported: imported,
      });

      toast.success(`Importação concluída! ${imported} tarefas importadas.`);
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(`Erro na importação: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const getTaskCountForSection = (section: string) => {
    return parsedData?.tasks.filter(t => t.section === section).length || 0;
  };

  const getSelectedTaskCount = () => {
    return parsedData?.tasks.filter(t => selectedSections.includes(t.section)).length || 0;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/onboarding-tasks')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <NexusHeader title="Importar Asana" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Step 1: Upload File */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              1. Upload do Arquivo CSV
            </CardTitle>
            <CardDescription>
              Exporte seu projeto do Asana como CSV e faça upload aqui
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              {loading ? (
                <Loader2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-spin" />
              ) : (
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              )}
              <p className="text-muted-foreground">
                Clique para selecionar ou arraste o arquivo CSV
              </p>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <span className="text-destructive">{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Preview & Configure */}
        {parsedData && !importResult && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  2. Dados Identificados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground mb-2 block">Empresa</Label>
                    <Input 
                      value={editedCompanyName}
                      onChange={(e) => setEditedCompanyName(e.target.value)}
                      placeholder="Nome da empresa"
                      className="font-medium"
                    />
                  </div>
                  {parsedData.contractValue && (
                    <div>
                      <Label className="text-muted-foreground">Valor do Contrato</Label>
                      <p className="font-medium">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsedData.contractValue)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{parsedData.tasks.length}</p>
                    <p className="text-sm text-muted-foreground">Tarefas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{parsedData.sections.length}</p>
                    <p className="text-sm text-muted-foreground">Seções</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {parsedData.tasks.filter(t => t.status === 'completed').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Concluídas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  3. Equipe Responsável
                </CardTitle>
                <CardDescription>
                  Selecione o CS e Consultor responsáveis pela empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">CS Responsável</Label>
                  <Select value={selectedCS} onValueChange={setSelectedCS}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um CS..." />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.filter(s => s.role === 'cs' || s.role === 'admin').map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block">Consultor Responsável</Label>
                  <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um Consultor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.filter(s => s.role === 'consultant' || s.role === 'admin').map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  4. Selecione o Serviço
                </CardTitle>
                <CardDescription>
                  Escolha qual serviço será associado a este projeto
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um serviço..." />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map(service => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListTodo className="h-5 w-5" />
                  5. Seções a Importar
                </CardTitle>
                <CardDescription>
                  Selecione quais seções deseja importar ({getSelectedTaskCount()} tarefas selecionadas)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {parsedData.sections.map(section => (
                      <div 
                        key={section} 
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleSection(section)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={selectedSections.includes(section)}
                            onCheckedChange={() => toggleSection(section)}
                          />
                          <span className="font-medium">{section}</span>
                        </div>
                        <Badge variant="secondary">
                          {getTaskCountForSection(section)} tarefas
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setParsedData(null);
                  setError(null);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button 
                onClick={handleImport}
                disabled={importing || !selectedService || selectedSections.length === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar {getSelectedTaskCount()} Tarefas
                  </>
                )}
              </Button>
            </div>

            {importing && (
              <div className="mt-6">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Importando... {progress}%
                </p>
              </div>
            )}
          </>
        )}

        {/* Step 5: Success */}
        {importResult && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-green-800 mb-2">
                  Importação Concluída!
                </h2>
                <p className="text-green-700 mb-6">
                  {importResult.tasksImported} tarefas foram importadas com sucesso
                </p>

                <div className="bg-white rounded-lg p-4 mb-6 text-left">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Empresa</Label>
                      <p className="font-medium">{importResult.companyName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Projeto</Label>
                      <p className="font-medium">{importResult.projectName}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center gap-4">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setParsedData(null);
                      setImportResult(null);
                      setSelectedSections([]);
                    }}
                  >
                    Nova Importação
                  </Button>
                  <Button onClick={() => navigate(`/onboarding-tasks/${importResult.projectId}`)}>
                    Ver Projeto
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
