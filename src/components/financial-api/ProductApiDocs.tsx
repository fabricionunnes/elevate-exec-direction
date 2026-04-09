import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Briefcase, Building2, ListTodo, Users, DollarSign, BarChart3, UserCheck, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/system-api`;

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

const productModules: ModuleDoc[] = [
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
          { name: "website", desc: "Website", required: false },
          { name: "address", desc: "Endereço", required: false },
          { name: "notes", desc: "Observações", required: false },
          { name: "consultant_id", desc: "UUID do consultor", required: false },
          { name: "cs_id", desc: "UUID do CS", required: false },
          { name: "kickoff_date", desc: "Data do kickoff", required: false },
          { name: "contract_start_date", desc: "Início do contrato", required: false },
          { name: "contract_end_date", desc: "Fim do contrato", required: false },
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
    name: "Projetos",
    icon: FolderOpen,
    module: "projects",
    description: "Visualizar projetos dos clientes",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar projetos",
        params: [
          { name: "status", desc: "pending, active, completed, paused", required: false },
          { name: "company_id", desc: "UUID da empresa", required: false },
        ],
        example: `GET ${API_URL}?module=projects&action=list&company_id=UUID`,
        response: `{ "data": [{ "id": "uuid", "company_id": "uuid", "product_name": "Produto X", "status": "active" }] }`,
      },
      {
        action: "get", method: "GET", description: "Detalhes de um projeto",
        params: [{ name: "id", desc: "UUID do projeto", required: true }],
        example: `GET ${API_URL}?module=projects&action=get&id=UUID`,
        response: `{ "data": { "id": "uuid", "company_id": "uuid", ... } }`,
      },
    ],
  },
  {
    name: "Tarefas",
    icon: ListTodo,
    module: "tasks",
    description: "Criar, delegar, atualizar e excluir tarefas dos projetos",
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
        response: `{ "data": [{ "id": "uuid", "title": "Tarefa X", "status": "pending", "due_date": "2026-04-01" }] }`,
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
          { name: "observations", desc: "Observações", required: false },
        ],
        example: `POST ${API_URL}?module=tasks&action=create\n\n{ "project_id": "UUID", "title": "Implementar CRM", "due_date": "2026-04-15", "responsible_staff_id": "UUID", "priority": "high" }`,
        response: `{ "data": { "id": "uuid-gerado", "title": "Implementar CRM", "status": "pending" } }`,
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
          { name: "title", desc: "Novo título", required: false },
          { name: "description", desc: "Nova descrição", required: false },
        ],
        example: `POST ${API_URL}?module=tasks&action=update&id=UUID\n\n{ "status": "completed" }`,
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
        response: `{ "data": [{ "id": "uuid", "name": "João", "role": "admin", "is_active": true }] }`,
      },
    ],
  },
  {
    name: "Vendas",
    icon: DollarSign,
    module: "sales",
    description: "Lançar e consultar histórico de vendas dos clientes",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar histórico de vendas",
        params: [
          { name: "company_id", desc: "UUID da empresa", required: false },
          { name: "date_from / date_to", desc: "Período (YYYY-MM-DD)", required: false },
        ],
        example: `GET ${API_URL}?module=sales&action=list&company_id=UUID`,
        response: `{ "data": [{ "id": "uuid", "month_year": "2026-03-01", "revenue": 150000, "sales_count": 45 }] }`,
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
        example: `POST ${API_URL}?module=sales&action=create\n\n{ "company_id": "UUID", "month_year": "2026-03-01", "revenue": 185000, "sales_count": 52 }`,
        response: `{ "data": { "id": "uuid", "revenue": 185000 } }`,
      },
      {
        action: "update", method: "POST", description: "Atualizar venda",
        params: [{ name: "id", desc: "UUID do registro", required: true }],
        example: `POST ${API_URL}?module=sales&action=update&id=UUID\n\n{ "revenue": 200000 }`,
        response: `{ "data": { ... } }`,
      },
    ],
  },
  {
    name: "KPIs",
    icon: BarChart3,
    module: "kpis",
    description: "Dashboard de KPIs: consultar indicadores configurados, lançamentos diários dos vendedores, performance mensal e comparativos",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar todos os KPIs configurados da empresa (indicadores do funil: Leads, Atendimentos, Visitas, Calls, Propostas, Vendas, Faturamento, etc.)",
        params: [{ name: "company_id", desc: "UUID da empresa (obrigatório para filtrar)", required: true }],
        example: `GET ${API_URL}?module=kpis&action=list&company_id=UUID`,
        response: `{
  "data": [
    {
      "id": "uuid",
      "company_id": "uuid",
      "name": "Faturamento",
      "kpi_type": "monetary",
      "periodicity": "monthly",
      "target_value": 100000,
      "is_individual": true,
      "is_required": true,
      "is_active": true,
      "is_main_goal": true,
      "scope": "company",
      "sector_id": null,
      "team_id": null,
      "unit_id": null,
      "salesperson_id": null,
      "sort_order": 1
    }
  ]
}`,
      },
      {
        action: "entries", method: "GET", description: "Listar lançamentos diários dos vendedores — é aqui que ficam os dados do Dashboard de KPIs. Filtre por mês para ver performance mensal.",
        params: [
          { name: "company_id", desc: "UUID da empresa", required: true },
          { name: "kpi_id", desc: "UUID do KPI específico (ex: Faturamento)", required: false },
          { name: "salesperson_id", desc: "UUID do vendedor — para ver lançamentos de um vendedor específico", required: false },
          { name: "date_from", desc: "Data inicial (YYYY-MM-DD) — ex: 2026-04-01 para mês atual", required: false },
          { name: "date_to", desc: "Data final (YYYY-MM-DD) — ex: 2026-04-30 para mês atual", required: false },
        ],
        example: `# Lançamentos do mês atual de todos os vendedores
GET ${API_URL}?module=kpis&action=entries&company_id=UUID&date_from=2026-04-01&date_to=2026-04-30

# Lançamentos de um vendedor específico no mês anterior
GET ${API_URL}?module=kpis&action=entries&company_id=UUID&salesperson_id=UUID&date_from=2026-03-01&date_to=2026-03-31

# Lançamentos de um KPI específico (ex: só Faturamento)
GET ${API_URL}?module=kpis&action=entries&company_id=UUID&kpi_id=UUID&date_from=2026-04-01&date_to=2026-04-30`,
        response: `{
  "data": [
    {
      "id": "uuid",
      "company_id": "uuid",
      "salesperson_id": "uuid-vendedor",
      "kpi_id": "uuid-kpi",
      "entry_date": "2026-04-08",
      "value": 15000,
      "observations": "Venda para cliente X",
      "unit_id": "uuid-unidade",
      "team_id": "uuid-equipe",
      "sector_id": "uuid-setor",
      "created_at": "2026-04-08T14:30:00Z"
    }
  ]
}`,
      },
      {
        action: "create_entry", method: "POST", description: "Lançar resultado diário de KPI para um vendedor (upsert: se já existir lançamento para vendedor+KPI+data, atualiza o valor)",
        bodyFields: [
          { name: "company_id", desc: "UUID da empresa", required: true },
          { name: "salesperson_id", desc: "UUID do vendedor que fez a venda/resultado", required: true },
          { name: "kpi_id", desc: "UUID do KPI (ex: Faturamento, Leads, Visitas)", required: true },
          { name: "entry_date", desc: "Data do lançamento (YYYY-MM-DD). Default: hoje", required: false },
          { name: "value", desc: "Valor numérico (ex: 15000 para faturamento, 5 para leads)", required: true },
          { name: "observations", desc: "Observações sobre o lançamento", required: false },
          { name: "unit_id", desc: "UUID da unidade (se a empresa usa hierarquia organizacional)", required: false },
          { name: "team_id", desc: "UUID da equipe", required: false },
          { name: "sector_id", desc: "UUID do setor", required: false },
        ],
        example: `POST ${API_URL}?module=kpis&action=create_entry\n\n{
  "company_id": "UUID",
  "salesperson_id": "UUID-VENDEDOR",
  "kpi_id": "UUID-KPI-FATURAMENTO",
  "entry_date": "2026-04-08",
  "value": 15000,
  "observations": "Venda para cliente X"
}`,
        response: `{ "data": { "id": "uuid", "salesperson_id": "uuid", "kpi_id": "uuid", "entry_date": "2026-04-08", "value": 15000 } }`,
      },
    ],
  },
  {
    name: "Vendedores",
    icon: UserCheck,
    module: "salespeople",
    description: "Gerenciar vendedores das empresas clientes — necessário para cruzar com os lançamentos de KPI",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar vendedores da empresa (use para cruzar com os lançamentos e montar o dashboard por vendedor)",
        params: [
          { name: "company_id", desc: "UUID da empresa", required: true },
          { name: "status", desc: "active (ativos) ou inactive (inativos)", required: false },
        ],
        example: `GET ${API_URL}?module=salespeople&action=list&company_id=UUID&status=active`,
        response: `{
  "data": [
    {
      "id": "uuid",
      "company_id": "uuid",
      "name": "Carlos Silva",
      "email": "carlos@empresa.com",
      "phone": "(11) 99999-0000",
      "is_active": true,
      "unit_id": "uuid-unidade",
      "team_id": "uuid-equipe",
      "sector_id": "uuid-setor",
      "access_code": "ABC123"
    }
  ]
}`,
      },
      {
        action: "create", method: "POST", description: "Criar vendedor",
        bodyFields: [
          { name: "company_id", desc: "UUID da empresa", required: true },
          { name: "name", desc: "Nome do vendedor", required: true },
          { name: "email", desc: "E-mail", required: false },
          { name: "phone", desc: "Telefone", required: false },
          { name: "unit_id", desc: "UUID da unidade", required: false },
          { name: "team_id", desc: "UUID da equipe", required: false },
          { name: "sector_id", desc: "UUID do setor", required: false },
        ],
        example: `POST ${API_URL}?module=salespeople&action=create\n\n{ "company_id": "UUID", "name": "Ana Costa", "email": "ana@empresa.com" }`,
        response: `{ "data": { "id": "uuid-gerado", "name": "Ana Costa" } }`,
      },
      {
        action: "update", method: "POST", description: "Atualizar vendedor",
        params: [{ name: "id", desc: "UUID do vendedor", required: true }],
        example: `POST ${API_URL}?module=salespeople&action=update&id=UUID\n\n{ "is_active": false }`,
        response: `{ "data": { ... } }`,
      },
    ],
  },
];

export function ProductApiDocs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Briefcase className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">API do Produto</h2>
          <p className="text-sm text-muted-foreground">
            Criar empresas, gerenciar projetos, tarefas, colaboradores, vendas, KPIs e vendedores dos clientes
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">URL Base & Autenticação</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <CodeBlock code={API_URL} language="url" />
          <CodeBlock code={`# Opção 1: Bearer Token (JWT)\nAuthorization: Bearer <token>\napikey: <chave_publica>\n\n# Opção 2: API Key\nx-api-key: <sua_chave>\napikey: <chave_publica>`} language="headers" />
        </CardContent>
      </Card>

      <Tabs defaultValue="companies">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {productModules.map(m => (
            <TabsTrigger key={m.module} value={m.module} className="text-xs gap-1.5">
              <m.icon className="h-3.5 w-3.5" />
              {m.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {productModules.map(m => (
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
                            <div className="border rounded overflow-hidden max-h-[400px] overflow-y-auto">
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
                          <CodeBlock code={`curl -X ${ep.method} "${ep.example.split("\n")[0].replace(`${ep.method} `, "")}" \\\n  -H "apikey: SUA_CHAVE_PUBLICA" \\\n  -H "x-api-key: SUA_API_KEY"${ep.method === "POST" ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${ep.example.includes("\n\n") ? ep.example.split("\n\n").slice(1).join("\n\n") : "{}"}'` : ""}`} language="bash" />
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

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Guia Prático: Montando o Dashboard de KPIs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-3">
            <p className="text-muted-foreground">
              Para reproduzir a visão do menu <strong>KPI → Dashboard</strong> via API, siga estes passos:
            </p>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">1️⃣ Listar vendedores ativos</h4>
              <CodeBlock code={`GET ${API_URL}?module=salespeople&action=list&company_id=UUID&status=active`} language="http" />
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">2️⃣ Listar KPIs configurados</h4>
              <CodeBlock code={`GET ${API_URL}?module=kpis&action=list&company_id=UUID`} language="http" />
              <p className="text-xs text-muted-foreground">O KPI com <code>is_main_goal: true</code> é o Faturamento (meta principal).</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">3️⃣ Buscar lançamentos do mês desejado</h4>
              <CodeBlock code={`# Mês atual (Abril/2026)
GET ${API_URL}?module=kpis&action=entries&company_id=UUID&date_from=2026-04-01&date_to=2026-04-30

# Mês anterior (Março/2026)
GET ${API_URL}?module=kpis&action=entries&company_id=UUID&date_from=2026-03-01&date_to=2026-03-31`} language="http" />
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">4️⃣ Cruzar os dados</h4>
              <p className="text-xs text-muted-foreground">
                Com os 3 retornos acima, agrupe os <strong>entries</strong> por <code>salesperson_id</code> e <code>kpi_id</code>, 
                some os <code>value</code> de cada agrupamento, e compare com o <code>target_value</code> do KPI para calcular o percentual de atingimento.
              </p>
              <CodeBlock code={`// Exemplo de cálculo em JavaScript:
const vendedorEntries = entries.filter(e => e.salesperson_id === vendedor.id);
const faturamentoKpi = kpis.find(k => k.is_main_goal);
const totalFaturamento = vendedorEntries
  .filter(e => e.kpi_id === faturamentoKpi.id)
  .reduce((sum, e) => sum + e.value, 0);
const percentMeta = (totalFaturamento / faturamentoKpi.target_value) * 100;

console.log(\`\${vendedor.name}: R$ \${totalFaturamento} (\${percentMeta.toFixed(1)}% da meta)\`);`} language="javascript" />
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">5️⃣ Ver lançamentos diários de um vendedor específico</h4>
              <CodeBlock code={`GET ${API_URL}?module=kpis&action=entries&company_id=UUID&salesperson_id=UUID-VENDEDOR&date_from=2026-04-01&date_to=2026-04-30`} language="http" />
              <p className="text-xs text-muted-foreground">
                Retorna todos os lançamentos diários daquele vendedor no mês, com data, valor e KPI de cada lançamento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
