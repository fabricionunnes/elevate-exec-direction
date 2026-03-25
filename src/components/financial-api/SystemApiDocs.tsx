import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Code2, Building2, ListTodo, Users, Target, Handshake, CalendarCheck, DollarSign, BarChart3, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/system-api`;
const FIN_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/financial-api`;

const CodeBlock = ({ code, language = "json" }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-lg border border-border bg-muted/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted border-b border-border">
        <span className="text-[10px] uppercase font-mono text-muted-foreground">{language}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed"><code>{code}</code></pre>
    </div>
  );
};

interface EndpointDoc {
  action: string;
  method: string;
  description: string;
  params?: { name: string; desc: string; required: boolean }[];
  bodyFields?: { name: string; desc: string; required: boolean }[];
  example: string;
  response: string;
}

interface ModuleDoc {
  name: string;
  icon: any;
  module: string;
  description: string;
  endpoints: EndpointDoc[];
}

const systemModules: ModuleDoc[] = [
  {
    name: "Empresas",
    icon: Building2,
    module: "companies",
    description: "CRUD completo de empresas/clientes",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar empresas",
        params: [{ name: "status", desc: "active, inactive, churned", required: false }],
        example: `GET ${API_URL}?module=companies&action=list&status=active`,
        response: `{ "data": [{ "id": "uuid", "name": "Empresa ABC", "status": "active", "contract_value": 5000 }] }`,
      },
      {
        action: "get", method: "GET", description: "Detalhes de uma empresa",
        params: [{ name: "id", desc: "UUID da empresa", required: true }],
        example: `GET ${API_URL}?module=companies&action=get&id=UUID`,
        response: `{ "data": { "id": "uuid", "name": "Empresa ABC", "cnpj": "...", ... } }`,
      },
      {
        action: "create", method: "POST", description: "Criar nova empresa",
        bodyFields: [
          { name: "name", desc: "Nome da empresa", required: true },
          { name: "cnpj", desc: "CNPJ", required: false },
          { name: "segment", desc: "Segmento", required: false },
          { name: "contract_value", desc: "Valor do contrato", required: false },
          { name: "billing_day", desc: "Dia de cobrança", required: false },
          { name: "email", desc: "E-mail", required: false },
          { name: "phone", desc: "Telefone", required: false },
          { name: "consultant_id", desc: "UUID do consultor", required: false },
          { name: "cs_id", desc: "UUID do CS", required: false },
        ],
        example: `POST ${API_URL}?module=companies&action=create\n\n{ "name": "Nova Empresa", "cnpj": "12.345.678/0001-00", "segment": "Tecnologia", "contract_value": 5000 }`,
        response: `{ "data": { "id": "uuid-gerado", "name": "Nova Empresa", ... } }`,
      },
      {
        action: "update", method: "POST", description: "Atualizar empresa",
        params: [{ name: "id", desc: "UUID da empresa", required: true }],
        bodyFields: [{ name: "*", desc: "Qualquer campo da empresa", required: false }],
        example: `POST ${API_URL}?module=companies&action=update&id=UUID\n\n{ "status": "churned", "notes": "Cliente cancelou" }`,
        response: `{ "data": { "id": "uuid", "status": "churned", ... } }`,
      },
    ],
  },
  {
    name: "Tarefas",
    icon: ListTodo,
    module: "tasks",
    description: "Criar, delegar, atualizar e excluir tarefas",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar tarefas",
        params: [
          { name: "project_id", desc: "UUID do projeto", required: false },
          { name: "status", desc: "pending, in_progress, completed", required: false },
          { name: "staff_id", desc: "UUID do responsável", required: false },
          { name: "date_from / date_to", desc: "Período (YYYY-MM-DD)", required: false },
        ],
        example: `GET ${API_URL}?module=tasks&action=list&project_id=UUID&status=pending`,
        response: `{ "data": [{ "id": "uuid", "title": "Tarefa X", "status": "pending", "due_date": "2026-04-01", "responsible_staff_id": "uuid" }] }`,
      },
      {
        action: "create", method: "POST", description: "Criar tarefa",
        bodyFields: [
          { name: "project_id", desc: "UUID do projeto", required: true },
          { name: "title", desc: "Título da tarefa", required: true },
          { name: "description", desc: "Descrição", required: false },
          { name: "due_date", desc: "Data de conclusão (YYYY-MM-DD)", required: false },
          { name: "start_date", desc: "Data de início", required: false },
          { name: "priority", desc: "low, medium, high, urgent", required: false },
          { name: "responsible_staff_id", desc: "UUID do responsável (staff)", required: false },
          { name: "assignee_id", desc: "UUID do responsável (cliente)", required: false },
          { name: "tags", desc: "Array de tags", required: false },
          { name: "estimated_hours", desc: "Horas estimadas", required: false },
        ],
        example: `POST ${API_URL}?module=tasks&action=create\n\n{ "project_id": "UUID", "title": "Implementar CRM", "due_date": "2026-04-15", "responsible_staff_id": "UUID", "priority": "high" }`,
        response: `{ "data": { "id": "uuid-gerado", "title": "Implementar CRM", "status": "pending", ... } }`,
      },
      {
        action: "update", method: "POST", description: "Atualizar tarefa (status, responsável, data, etc.)",
        params: [{ name: "id", desc: "UUID da tarefa", required: true }],
        bodyFields: [
          { name: "status", desc: "pending, in_progress, completed", required: false },
          { name: "responsible_staff_id", desc: "Novo responsável", required: false },
          { name: "due_date", desc: "Nova data de conclusão", required: false },
          { name: "priority", desc: "Nova prioridade", required: false },
          { name: "observations", desc: "Observações", required: false },
        ],
        example: `POST ${API_URL}?module=tasks&action=update&id=UUID\n\n{ "status": "completed", "observations": "Finalizado com sucesso" }`,
        response: `{ "data": { "id": "uuid", "status": "completed", "completed_at": "2026-03-25T..." } }`,
      },
      {
        action: "delete", method: "POST", description: "Excluir tarefa",
        params: [{ name: "id", desc: "UUID da tarefa", required: true }],
        example: `POST ${API_URL}?module=tasks&action=delete&id=UUID`,
        response: `{ "success": true }`,
      },
    ],
  },
  {
    name: "Leads (CRM)",
    icon: Target,
    module: "leads",
    description: "Criar, atualizar e mover leads entre etapas",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar leads",
        params: [
          { name: "pipeline_id", desc: "UUID do pipeline", required: false },
          { name: "stage_id", desc: "UUID da etapa", required: false },
          { name: "owner_id", desc: "UUID do responsável", required: false },
        ],
        example: `GET ${API_URL}?module=leads&action=list&pipeline_id=UUID`,
        response: `{ "data": [{ "id": "uuid", "name": "João Silva", "company": "Empresa X", "stage_id": "uuid", "opportunity_value": 50000 }] }`,
      },
      {
        action: "create", method: "POST", description: "Criar lead",
        bodyFields: [
          { name: "name", desc: "Nome do lead", required: true },
          { name: "phone", desc: "Telefone", required: false },
          { name: "email", desc: "E-mail", required: false },
          { name: "company", desc: "Empresa", required: false },
          { name: "pipeline_id", desc: "UUID do pipeline", required: false },
          { name: "stage_id", desc: "UUID da etapa inicial", required: false },
          { name: "owner_staff_id", desc: "Responsável", required: false },
          { name: "sdr_staff_id", desc: "SDR", required: false },
          { name: "closer_staff_id", desc: "Closer", required: false },
          { name: "opportunity_value", desc: "Valor da oportunidade", required: false },
          { name: "segment", desc: "Segmento", required: false },
          { name: "main_pain", desc: "Principal dor", required: false },
        ],
        example: `POST ${API_URL}?module=leads&action=create\n\n{ "name": "Maria Costa", "phone": "11999999999", "company": "Tech Corp", "pipeline_id": "UUID", "stage_id": "UUID", "opportunity_value": 25000 }`,
        response: `{ "data": { "id": "uuid-gerado", "name": "Maria Costa", ... } }`,
      },
      {
        action: "update", method: "POST", description: "Atualizar lead",
        params: [{ name: "id", desc: "UUID do lead", required: true }],
        example: `POST ${API_URL}?module=leads&action=update&id=UUID\n\n{ "opportunity_value": 35000, "closer_staff_id": "UUID" }`,
        response: `{ "data": { ... } }`,
      },
      {
        action: "move_stage", method: "POST", description: "Mover lead para outra etapa",
        params: [{ name: "id", desc: "UUID do lead", required: true }],
        bodyFields: [{ name: "stage_id", desc: "UUID da nova etapa", required: true }],
        example: `POST ${API_URL}?module=leads&action=move_stage&id=UUID\n\n{ "stage_id": "UUID-NOVA-ETAPA" }`,
        response: `{ "data": { "id": "uuid", "stage_id": "uuid-nova-etapa" } }`,
      },
    ],
  },
  {
    name: "Atividades (CRM)",
    icon: Handshake,
    module: "activities",
    description: "Criar e gerenciar atividades de vendas",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar atividades",
        params: [
          { name: "lead_id", desc: "UUID do lead", required: false },
          { name: "status", desc: "pending, completed, cancelled", required: false },
          { name: "staff_id", desc: "UUID do responsável", required: false },
        ],
        example: `GET ${API_URL}?module=activities&action=list&lead_id=UUID`,
        response: `{ "data": [{ "id": "uuid", "type": "meeting", "title": "Reunião de apresentação", "status": "pending" }] }`,
      },
      {
        action: "create", method: "POST", description: "Criar atividade",
        bodyFields: [
          { name: "lead_id", desc: "UUID do lead", required: true },
          { name: "type", desc: "call, whatsapp, email, meeting, followup, proposal, note, other", required: true },
          { name: "title", desc: "Título", required: true },
          { name: "description", desc: "Descrição", required: false },
          { name: "scheduled_at", desc: "Data/hora agendada (ISO 8601)", required: false },
          { name: "responsible_staff_id", desc: "UUID responsável", required: false },
          { name: "meeting_link", desc: "Link da reunião", required: false },
        ],
        example: `POST ${API_URL}?module=activities&action=create\n\n{ "lead_id": "UUID", "type": "meeting", "title": "Demo do produto", "scheduled_at": "2026-04-01T14:00:00Z", "responsible_staff_id": "UUID" }`,
        response: `{ "data": { "id": "uuid-gerado", ... } }`,
      },
      {
        action: "complete", method: "POST", description: "Finalizar atividade",
        params: [{ name: "id", desc: "UUID da atividade", required: true }],
        bodyFields: [{ name: "notes", desc: "Notas de conclusão", required: false }],
        example: `POST ${API_URL}?module=activities&action=complete&id=UUID\n\n{ "notes": "Cliente demonstrou interesse" }`,
        response: `{ "data": { "id": "uuid", "status": "completed", "completed_at": "..." } }`,
      },
    ],
  },
  {
    name: "Reuniões",
    icon: CalendarCheck,
    module: "meetings",
    description: "Agendar e finalizar reuniões do CRM",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar reuniões",
        params: [
          { name: "pipeline_id", desc: "UUID do pipeline", required: false },
          { name: "event_type", desc: "scheduled, realized, no_show, out_of_icp", required: false },
          { name: "staff_id", desc: "UUID do creditado", required: false },
          { name: "date_from / date_to", desc: "Período", required: false },
        ],
        example: `GET ${API_URL}?module=meetings&action=list&event_type=scheduled`,
        response: `{ "data": [{ "id": "uuid", "lead_id": "uuid", "event_type": "scheduled", "event_date": "2026-04-01T14:00:00Z" }] }`,
      },
      {
        action: "schedule", method: "POST", description: "Agendar reunião",
        bodyFields: [
          { name: "lead_id", desc: "UUID do lead", required: true },
          { name: "pipeline_id", desc: "UUID do pipeline", required: true },
          { name: "credited_staff_id", desc: "UUID do responsável creditado", required: true },
          { name: "triggered_by_staff_id", desc: "UUID de quem agendou", required: false },
          { name: "stage_id", desc: "UUID da etapa", required: false },
          { name: "event_date", desc: "Data/hora (ISO 8601)", required: false },
        ],
        example: `POST ${API_URL}?module=meetings&action=schedule\n\n{ "lead_id": "UUID", "pipeline_id": "UUID", "credited_staff_id": "UUID", "event_date": "2026-04-02T10:00:00Z" }`,
        response: `{ "data": { "id": "uuid-gerado", "event_type": "scheduled", ... } }`,
      },
      {
        action: "finalize", method: "POST", description: "Finalizar reunião (realizada, no show, fora do ICP)",
        params: [{ name: "id", desc: "UUID do evento de agendamento", required: true }],
        bodyFields: [{ name: "event_type", desc: "realized, no_show, out_of_icp", required: true }],
        example: `POST ${API_URL}?module=meetings&action=finalize&id=UUID\n\n{ "event_type": "realized" }`,
        response: `{ "data": { "id": "uuid-novo", "event_type": "realized", ... } }`,
      },
    ],
  },
  {
    name: "Vendas",
    icon: DollarSign,
    module: "sales",
    description: "Lançar e consultar histórico de vendas",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar histórico de vendas",
        params: [
          { name: "company_id", desc: "UUID da empresa", required: false },
          { name: "date_from / date_to", desc: "Período (YYYY-MM-DD)", required: false },
        ],
        example: `GET ${API_URL}?module=sales&action=list&company_id=UUID`,
        response: `{ "data": [{ "id": "uuid", "company_id": "uuid", "month_year": "2026-03-01", "revenue": 150000, "sales_count": 45 }] }`,
      },
      {
        action: "create", method: "POST", description: "Lançar venda mensal (upsert por empresa+mês)",
        bodyFields: [
          { name: "company_id", desc: "UUID da empresa", required: true },
          { name: "month_year", desc: "Mês (YYYY-MM-01)", required: true },
          { name: "revenue", desc: "Faturamento total", required: false },
          { name: "sales_count", desc: "Número de vendas", required: false },
          { name: "target_revenue", desc: "Meta de faturamento", required: false },
          { name: "notes", desc: "Observações", required: false },
        ],
        example: `POST ${API_URL}?module=sales&action=create\n\n{ "company_id": "UUID", "month_year": "2026-03-01", "revenue": 185000, "sales_count": 52, "target_revenue": 200000 }`,
        response: `{ "data": { "id": "uuid", "revenue": 185000, ... } }`,
      },
    ],
  },
  {
    name: "KPIs",
    icon: BarChart3,
    module: "kpis",
    description: "Consultar KPIs e lançar resultados",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar KPIs configurados",
        params: [{ name: "company_id", desc: "UUID da empresa", required: false }],
        example: `GET ${API_URL}?module=kpis&action=list&company_id=UUID`,
        response: `{ "data": [{ "id": "uuid", "name": "Vendas Mensais", "kpi_type": "monetary", "target_value": 100000 }] }`,
      },
      {
        action: "entries", method: "GET", description: "Listar lançamentos de KPIs",
        params: [
          { name: "company_id", desc: "UUID da empresa", required: false },
          { name: "kpi_id", desc: "UUID do KPI", required: false },
          { name: "salesperson_id", desc: "UUID do vendedor", required: false },
          { name: "date_from / date_to", desc: "Período", required: false },
        ],
        example: `GET ${API_URL}?module=kpis&action=entries&company_id=UUID&kpi_id=UUID`,
        response: `{ "data": [{ "id": "uuid", "kpi_id": "uuid", "salesperson_id": "uuid", "entry_date": "2026-03-25", "value": 15000 }] }`,
      },
      {
        action: "create_entry", method: "POST", description: "Lançar resultado de KPI (upsert por vendedor+KPI+data)",
        bodyFields: [
          { name: "company_id", desc: "UUID da empresa", required: true },
          { name: "salesperson_id", desc: "UUID do vendedor", required: true },
          { name: "kpi_id", desc: "UUID do KPI", required: true },
          { name: "entry_date", desc: "Data (YYYY-MM-DD)", required: false },
          { name: "value", desc: "Valor numérico", required: false },
          { name: "observations", desc: "Observações", required: false },
        ],
        example: `POST ${API_URL}?module=kpis&action=create_entry\n\n{ "company_id": "UUID", "salesperson_id": "UUID", "kpi_id": "UUID", "entry_date": "2026-03-25", "value": 15000 }`,
        response: `{ "data": { "id": "uuid", "value": 15000, ... } }`,
      },
    ],
  },
  {
    name: "Vendedores",
    icon: UserCheck,
    module: "salespeople",
    description: "Gerenciar vendedores das empresas",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar vendedores",
        params: [
          { name: "company_id", desc: "UUID da empresa", required: false },
          { name: "status", desc: "active, inactive", required: false },
        ],
        example: `GET ${API_URL}?module=salespeople&action=list&company_id=UUID`,
        response: `{ "data": [{ "id": "uuid", "name": "Carlos Silva", "company_id": "uuid", "is_active": true }] }`,
      },
      {
        action: "create", method: "POST", description: "Criar vendedor",
        bodyFields: [
          { name: "company_id", desc: "UUID da empresa", required: true },
          { name: "name", desc: "Nome", required: true },
          { name: "email", desc: "E-mail", required: false },
          { name: "phone", desc: "Telefone", required: false },
        ],
        example: `POST ${API_URL}?module=salespeople&action=create\n\n{ "company_id": "UUID", "name": "Ana Costa", "email": "ana@empresa.com" }`,
        response: `{ "data": { "id": "uuid-gerado", "name": "Ana Costa", ... } }`,
      },
    ],
  },
  {
    name: "Colaboradores",
    icon: Users,
    module: "staff",
    description: "Listar colaboradores do sistema",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar colaboradores",
        params: [
          { name: "status", desc: "active, inactive", required: false },
          { name: "role", desc: "admin, cs, consultant, master, closer, sdr, etc.", required: false },
        ],
        example: `GET ${API_URL}?module=staff&action=list&status=active`,
        response: `{ "data": [{ "id": "uuid", "name": "João Admin", "email": "joao@empresa.com", "role": "admin", "is_active": true }] }`,
      },
    ],
  },
  {
    name: "Pipelines",
    icon: Target,
    module: "pipelines",
    description: "Consultar pipelines e etapas do CRM",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar pipelines",
        example: `GET ${API_URL}?module=pipelines&action=list`,
        response: `{ "data": [{ "id": "uuid", "name": "Pipeline Principal", "is_default": true }] }`,
      },
      {
        action: "stages", method: "GET", description: "Listar etapas de um pipeline",
        params: [{ name: "pipeline_id", desc: "UUID do pipeline", required: false }],
        example: `GET ${API_URL}?module=pipelines&action=stages&pipeline_id=UUID`,
        response: `{ "data": [{ "id": "uuid", "name": "Qualificação", "sort_order": 1, "color": "#3b82f6" }] }`,
      },
    ],
  },
];

export function SystemApiDocs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Code2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">API do Sistema (Gestão)</h2>
          <p className="text-sm text-muted-foreground">
            API completa para gerenciar empresas, tarefas, CRM, reuniões, vendas e KPIs
          </p>
        </div>
      </div>

      {/* URLs */}
      <Card>
        <CardHeader><CardTitle className="text-base">URLs Base</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div>
            <Badge variant="outline" className="mb-1">API de Gestão (escrita/leitura)</Badge>
            <CodeBlock code={API_URL} language="url" />
          </div>
          <div>
            <Badge variant="outline" className="mb-1">API Financeira (leitura)</Badge>
            <CodeBlock code={FIN_API_URL} language="url" />
          </div>
        </CardContent>
      </Card>

      {/* Auth */}
      <Card>
        <CardHeader><CardTitle className="text-base">Autenticação</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <CodeBlock code={`# Opção 1: Bearer Token (JWT do sistema)\nAuthorization: Bearer <token>\napikey: <chave_publica>\n\n# Opção 2: API Key (gerada na aba API do Financeiro)\nx-api-key: <sua_chave>\napikey: <chave_publica>`} language="headers" />
        </CardContent>
      </Card>

      {/* Pattern */}
      <Card>
        <CardHeader><CardTitle className="text-base">Padrão de Uso</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <CodeBlock code={`# Leitura (GET)\nGET ${API_URL}?module=<modulo>&action=<acao>&id=<uuid>&<filtros>\n\n# Escrita (POST com body JSON)\nPOST ${API_URL}?module=<modulo>&action=<acao>&id=<uuid>\nContent-Type: application/json\n\n{ "campo": "valor" }`} language="http" />
        </CardContent>
      </Card>

      {/* Modules */}
      <Tabs defaultValue="companies">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {systemModules.map(m => (
            <TabsTrigger key={m.module} value={m.module} className="text-xs gap-1.5">
              <m.icon className="h-3.5 w-3.5" />
              {m.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {systemModules.map(m => (
          <TabsContent key={m.module} value={m.module} className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <m.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{m.name}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">{m.module}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{m.description}</p>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {m.endpoints.map((ep, idx) => (
                    <AccordionItem key={idx} value={`${m.module}-${ep.action}`}>
                      <AccordionTrigger className="text-sm hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Badge className={ep.method === "GET" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" : "bg-amber-500/10 text-amber-600 border-amber-200"}>
                            {ep.method}
                          </Badge>
                          <span className="font-mono text-xs">{ep.action}</span>
                          <span className="text-muted-foreground font-normal">— {ep.description}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pt-2">
                        {ep.params && ep.params.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium mb-1 text-muted-foreground">QUERY PARAMS</h4>
                            <div className="border rounded overflow-hidden">
                              <table className="w-full text-xs">
                                <tbody>
                                  {ep.params.map(p => (
                                    <tr key={p.name} className="border-t first:border-t-0">
                                      <td className="px-2 py-1 font-mono text-primary">{p.name}</td>
                                      <td className="px-2 py-1 text-muted-foreground">{p.desc}</td>
                                      <td className="px-2 py-1"><Badge variant={p.required ? "default" : "secondary"} className="text-[9px]">{p.required ? "Sim" : "Não"}</Badge></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {ep.bodyFields && ep.bodyFields.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium mb-1 text-muted-foreground">BODY (JSON)</h4>
                            <div className="border rounded overflow-hidden">
                              <table className="w-full text-xs">
                                <tbody>
                                  {ep.bodyFields.map(f => (
                                    <tr key={f.name} className="border-t first:border-t-0">
                                      <td className="px-2 py-1 font-mono text-primary">{f.name}</td>
                                      <td className="px-2 py-1 text-muted-foreground">{f.desc}</td>
                                      <td className="px-2 py-1"><Badge variant={f.required ? "default" : "secondary"} className="text-[9px]">{f.required ? "Sim" : "Não"}</Badge></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        <div>
                          <h4 className="text-xs font-medium mb-1 text-muted-foreground">EXEMPLO</h4>
                          <CodeBlock code={ep.example} language="http" />
                        </div>
                        <div>
                          <h4 className="text-xs font-medium mb-1 text-muted-foreground">RESPOSTA</h4>
                          <CodeBlock code={ep.response} language="json" />
                        </div>
                        <div>
                          <h4 className="text-xs font-medium mb-1 text-muted-foreground">cURL</h4>
                          <CodeBlock code={`curl -X ${ep.method} "${ep.example.split("\n")[0].replace(`${ep.method} `, "")}" \\\n  -H "apikey: SUA_CHAVE_PUBLICA" \\\n  -H "x-api-key: SUA_API_KEY"${ep.method === "POST" ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${ep.example.includes("\n\n") ? ep.example.split("\n\n")[1] : "{}"}'` : ""}`} language="bash" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Discover endpoint */}
      <Card>
        <CardHeader><CardTitle className="text-base">Descobrir Endpoints</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">Para listar todos os módulos e ações disponíveis:</p>
          <CodeBlock code={`GET ${API_URL}?module=system&action=endpoints`} language="http" />
        </CardContent>
      </Card>
    </div>
  );
}
