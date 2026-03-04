import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Wand2, Loader2, Plus, Trash2, Save, GripVertical } from "lucide-react";

interface RoutineTask {
  time?: string;
  task: string;
  priority?: string;
}

interface Indicator {
  name: string;
  target: string;
  frequency: string;
}

interface Props {
  projectId: string;
  selectedResponseId: string | null;
  onContractCreated: (contractId: string) => void;
}

export const RoutineAIAdjust = ({ projectId, selectedResponseId, onContractCreated }: Props) => {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  // Contract fields
  const [employeeName, setEmployeeName] = useState("");
  const [employeeRole, setEmployeeRole] = useState("");
  const [employeeDepartment, setEmployeeDepartment] = useState("");
  const [directManager, setDirectManager] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [dailyRoutine, setDailyRoutine] = useState<RoutineTask[]>([]);
  const [weeklyRoutine, setWeeklyRoutine] = useState<RoutineTask[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [responsibilities, setResponsibilities] = useState("");
  const [observations, setObservations] = useState("");

  // Load selected response
  const { data: response } = useQuery({
    queryKey: ["routine-response", selectedResponseId],
    queryFn: async () => {
      if (!selectedResponseId) return null;
      const { data, error } = await supabase
        .from("routine_form_responses")
        .select("*")
        .eq("id", selectedResponseId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedResponseId,
  });

  // Load all responses for the select
  const { data: allResponses } = useQuery({
    queryKey: ["routine-responses-select", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_form_responses")
        .select("id, employee_name, employee_role")
        .eq("project_id", projectId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (response) {
      setEmployeeName(response.employee_name || "");
      setEmployeeRole(response.employee_role || "");
      setEmployeeDepartment(response.employee_department || "");
    }
  }, [response]);

  const generateWithAI = async () => {
    if (!response) { toast.error("Selecione uma resposta primeiro"); return; }
    setGenerating(true);
    try {
      const prompt = `Você é a "IA de Organização de Rotina UNV". Analise as respostas abaixo de um colaborador e organize sua rotina de forma estruturada e profissional.

DADOS DO COLABORADOR:
Nome: ${response.employee_name}
Cargo: ${response.employee_role || "Não informado"}
Setor: ${response.employee_department || "Não informado"}
Tempo de empresa: ${response.employee_tenure || "Não informado"}

RESPOSTAS:
Atividades diárias: ${response.daily_activities || "Não informado"}
Atividades mais importantes: ${response.most_important_activities || "Não informado"}
Tempo por atividade: ${response.time_per_activity || "Não informado"}
Atividades semanais: ${response.weekly_activities || "Não informado"} - ${response.weekly_activities_list || ""}
Contatos por dia: ${response.daily_contacts || "N/A"}
Reuniões por semana: ${response.weekly_meetings || "N/A"}
Vendas por mês: ${response.monthly_sales || "N/A"}
Responsabilidades: ${response.main_responsibilities || "Não informado"}
Desafios: ${response.main_challenges || "Não informado"}
Sugestões de melhoria: ${response.productivity_suggestions || "Não informado"}

Retorne APENAS um JSON válido com a seguinte estrutura (sem markdown, sem texto extra):
{
  "introduction": "Texto de introdução sobre a importância da rotina para este colaborador (2-3 parágrafos)",
  "daily_routine": [{"time": "08:00", "task": "Descrição", "priority": "alta"}],
  "weekly_routine": [{"time": "Segunda", "task": "Descrição", "priority": "média"}],
  "indicators": [{"name": "Nome do indicador", "target": "Meta", "frequency": "Diário"}],
  "responsibilities": "Lista clara de responsabilidades do colaborador",
  "observations": "Observações e sugestões de melhoria"
}`;

      const { data: aiData, error: aiError } = await supabase.functions.invoke("generate-routine-contract", {
        body: { prompt },
      });

      if (aiError) throw aiError;

      const result = aiData?.result;
      if (result) {
        setIntroduction(result.introduction || "");
        setDailyRoutine(result.daily_routine || []);
        setWeeklyRoutine(result.weekly_routine || []);
        setIndicators(result.indicators || []);
        setResponsibilities(result.responsibilities || "");
        setObservations(result.observations || "");
        toast.success("Rotina gerada pela IA com sucesso!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar com IA. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const saveContract = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("routine_contracts")
        .insert({
          project_id: projectId,
          form_response_id: selectedResponseId,
          employee_name: employeeName,
          employee_role: employeeRole,
          employee_department: employeeDepartment,
          direct_manager: directManager,
          introduction,
          daily_routine: dailyRoutine as any,
          weekly_routine: weeklyRoutine as any,
          performance_indicators: indicators as any,
          responsibilities,
          observations,
          generated_by_ai: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["routine-contracts"] });
      toast.success("Contrato salvo com sucesso!");
      onContractCreated(data.id);
    },
    onError: () => toast.error("Erro ao salvar contrato"),
  });

  const addDailyTask = () => setDailyRoutine([...dailyRoutine, { time: "", task: "", priority: "média" }]);
  const addWeeklyTask = () => setWeeklyRoutine([...weeklyRoutine, { time: "", task: "", priority: "média" }]);
  const addIndicator = () => setIndicators([...indicators, { name: "", target: "", frequency: "Diário" }]);

  const removeDailyTask = (i: number) => setDailyRoutine(dailyRoutine.filter((_, idx) => idx !== i));
  const removeWeeklyTask = (i: number) => setWeeklyRoutine(weeklyRoutine.filter((_, idx) => idx !== i));
  const removeIndicator = (i: number) => setIndicators(indicators.filter((_, idx) => idx !== i));

  const updateDailyTask = (i: number, field: string, value: string) => {
    const updated = [...dailyRoutine];
    (updated[i] as any)[field] = value;
    setDailyRoutine(updated);
  };

  const updateWeeklyTask = (i: number, field: string, value: string) => {
    const updated = [...weeklyRoutine];
    (updated[i] as any)[field] = value;
    setWeeklyRoutine(updated);
  };

  const updateIndicator = (i: number, field: string, value: string) => {
    const updated = [...indicators];
    (updated[i] as any)[field] = value;
    setIndicators(updated);
  };

  return (
    <div className="space-y-6">
      {/* Select Response */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Selecionar Resposta</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedResponseId || ""} onValueChange={() => {}}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um colaborador" />
            </SelectTrigger>
            <SelectContent>
              {allResponses?.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.employee_name} - {r.employee_role || "Sem cargo"}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={generateWithAI} disabled={generating || !selectedResponseId} className="w-full">
            {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando com IA...</> : <><Wand2 className="h-4 w-4 mr-2" />Gerar Rotina com IA</>}
          </Button>
        </CardContent>
      </Card>

      {/* Employee Info */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Dados do Colaborador</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Nome</Label><Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} /></div>
          <div><Label>Cargo</Label><Input value={employeeRole} onChange={(e) => setEmployeeRole(e.target.value)} /></div>
          <div><Label>Área/Setor</Label><Input value={employeeDepartment} onChange={(e) => setEmployeeDepartment(e.target.value)} /></div>
          <div><Label>Responsável direto</Label><Input value={directManager} onChange={(e) => setDirectManager(e.target.value)} /></div>
        </CardContent>
      </Card>

      {/* Introduction */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Introdução</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={introduction} onChange={(e) => setIntroduction(e.target.value)} rows={5} placeholder="Texto de introdução sobre a importância da rotina..." />
        </CardContent>
      </Card>

      {/* Daily Routine */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">📅 Rotina Diária</CardTitle>
          <Button variant="outline" size="sm" onClick={addDailyTask}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {dailyRoutine.map((task, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Input className="w-20" placeholder="08:00" value={task.time || ""} onChange={(e) => updateDailyTask(i, "time", e.target.value)} />
              <Input className="flex-1" placeholder="Atividade" value={task.task} onChange={(e) => updateDailyTask(i, "task", e.target.value)} />
              <Select value={task.priority || "média"} onValueChange={(v) => updateDailyTask(i, "priority", v)}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="média">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => removeDailyTask(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {!dailyRoutine.length && <p className="text-sm text-muted-foreground text-center py-2">Nenhuma tarefa diária adicionada</p>}
        </CardContent>
      </Card>

      {/* Weekly Routine */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">📆 Rotina Semanal</CardTitle>
          <Button variant="outline" size="sm" onClick={addWeeklyTask}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {weeklyRoutine.map((task, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Input className="w-28" placeholder="Segunda" value={task.time || ""} onChange={(e) => updateWeeklyTask(i, "time", e.target.value)} />
              <Input className="flex-1" placeholder="Atividade" value={task.task} onChange={(e) => updateWeeklyTask(i, "task", e.target.value)} />
              <Button variant="ghost" size="icon" onClick={() => removeWeeklyTask(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {!weeklyRoutine.length && <p className="text-sm text-muted-foreground text-center py-2">Nenhuma tarefa semanal adicionada</p>}
        </CardContent>
      </Card>

      {/* Indicators */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">📊 Indicadores de Performance</CardTitle>
          <Button variant="outline" size="sm" onClick={addIndicator}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {indicators.map((ind, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Input className="flex-1" placeholder="Indicador" value={ind.name} onChange={(e) => updateIndicator(i, "name", e.target.value)} />
              <Input className="w-28" placeholder="Meta" value={ind.target} onChange={(e) => updateIndicator(i, "target", e.target.value)} />
              <Input className="w-24" placeholder="Frequência" value={ind.frequency} onChange={(e) => updateIndicator(i, "frequency", e.target.value)} />
              <Button variant="ghost" size="icon" onClick={() => removeIndicator(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {!indicators.length && <p className="text-sm text-muted-foreground text-center py-2">Nenhum indicador adicionado</p>}
        </CardContent>
      </Card>

      {/* Responsibilities */}
      <Card>
        <CardHeader><CardTitle className="text-lg">🎯 Responsabilidades</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} rows={5} />
        </CardContent>
      </Card>

      {/* Observations */}
      <Card>
        <CardHeader><CardTitle className="text-lg">📝 Observações Finais</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={4} />
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={() => saveContract.mutate()} disabled={saveContract.isPending || !employeeName.trim()} size="lg" className="w-full">
        {saveContract.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : <><Save className="h-4 w-4 mr-2" />Salvar Contrato de Rotina</>}
      </Button>
    </div>
  );
};
