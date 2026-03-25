import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Code2, Target, Handshake, CalendarCheck, Tag, FolderOpen } from "lucide-react";
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

const crmModules: ModuleDoc[] = [
  {
    name: "Leads",
    icon: Target,
    module: "leads",
    description: "CRM completo: todos os campos, ganho/perda, notas, tags, exclusão",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar leads com todos os campos",
        params: [
          { name: "pipeline_id", desc: "UUID do pipeline", required: false },
          { name: "stage_id", desc: "UUID da etapa", required: false },
          { name: "owner_id", desc: "UUID do responsável", required: false },
          { name: "search", desc: "Busca por nome, empresa, telefone ou email", required: false },
          { name: "date_from / date_to", desc: "Período de criação", required: false },
        ],
        example: `GET ${API_URL}?module=leads&action=list&pipeline_id=UUID&search=empresa`,
        response: `{ "data": [{ "id": "uuid", "name": "João", "company": "Empresa X", "cpf": "123.456.789-00", "city": "São Paulo", "opportunity_value": 50000, ... }] }`,
      },
      {
        action: "get", method: "GET", description: "Detalhes completos do lead (inclui tags)",
        params: [{ name: "id", desc: "UUID do lead", required: true }],
        example: `GET ${API_URL}?module=leads&action=get&id=UUID`,
        response: `{ "data": { "id": "uuid", "name": "João", "tags": [{ "id": "uuid", "name": "VIP", "color": "#f00" }], ... } }`,
      },
      {
        action: "create", method: "POST", description: "Criar lead com todos os campos possíveis",
        bodyFields: [
          { name: "name", desc: "Nome do lead", required: true },
          { name: "phone", desc: "Telefone", required: false },
          { name: "email", desc: "E-mail", required: false },
          { name: "company", desc: "Nome da empresa", required: false },
          { name: "trade_name", desc: "Nome fantasia", required: false },
          { name: "cpf", desc: "CPF do responsável", required: false },
          { name: "document", desc: "CNPJ da empresa", required: false },
          { name: "rg", desc: "RG do responsável", required: false },
          { name: "role", desc: "Cargo/função", required: false },
          { name: "city", desc: "Cidade", required: false },
          { name: "state", desc: "Estado (UF)", required: false },
          { name: "address", desc: "Endereço", required: false },
          { name: "address_number", desc: "Número", required: false },
          { name: "address_complement", desc: "Complemento", required: false },
          { name: "address_neighborhood", desc: "Bairro", required: false },
          { name: "zipcode", desc: "CEP", required: false },
          { name: "marital_status", desc: "Estado civil", required: false },
          { name: "legal_representative_name", desc: "Nome do representante legal", required: false },
          { name: "employee_count", desc: "Nº de funcionários", required: false },
          { name: "estimated_revenue", desc: "Faturamento estimado", required: false },
          { name: "pipeline_id", desc: "UUID do pipeline", required: false },
          { name: "stage_id", desc: "UUID da etapa inicial", required: false },
          { name: "plan_id", desc: "UUID do plano/produto", required: false },
          { name: "product_id", desc: "UUID do produto", required: false },
          { name: "owner_staff_id", desc: "Responsável", required: false },
          { name: "sdr_staff_id", desc: "SDR", required: false },
          { name: "closer_staff_id", desc: "Closer", required: false },
          { name: "scheduled_by_staff_id", desc: "Quem agendou", required: false },
          { name: "opportunity_value", desc: "Valor da oportunidade", required: false },
          { name: "probability", desc: "Probabilidade (0-100)", required: false },
          { name: "segment", desc: "Segmento", required: false },
          { name: "main_pain", desc: "Principal dor", required: false },
          { name: "urgency", desc: "Urgência", required: false },
          { name: "fit_score", desc: "Score de fit", required: false },
          { name: "payment_method", desc: "Forma de pagamento", required: false },
          { name: "installments", desc: "Parcelas", required: false },
          { name: "due_day", desc: "Dia de vencimento (1,5,10,15,20,25)", required: false },
          { name: "team", desc: "Equipe", required: false },
          { name: "notes", desc: "Observações", required: false },
          { name: "origin", desc: "Origem (texto)", required: false },
          { name: "origin_id", desc: "UUID da origem", required: false },
          { name: "utm_source", desc: "UTM Source", required: false },
          { name: "utm_medium", desc: "UTM Medium", required: false },
          { name: "utm_campaign", desc: "UTM Campaign", required: false },
          { name: "utm_content", desc: "UTM Content", required: false },
          { name: "tag_ids", desc: "Array de UUIDs de tags para vincular", required: false },
        ],
        example: `POST ${API_URL}?module=leads&action=create\n\n{\n  "name": "Maria Costa",\n  "phone": "11999999999",\n  "email": "maria@techcorp.com",\n  "company": "Tech Corp LTDA",\n  "document": "12.345.678/0001-00",\n  "cpf": "123.456.789-00",\n  "city": "São Paulo",\n  "state": "SP",\n  "pipeline_id": "UUID",\n  "stage_id": "UUID",\n  "opportunity_value": 25000,\n  "payment_method": "pix",\n  "tag_ids": ["uuid-tag-1", "uuid-tag-2"]\n}`,
        response: `{ "data": { "id": "uuid-gerado", "name": "Maria Costa", "document": "12.345.678/0001-00", ... } }`,
      },
      {
        action: "update", method: "POST", description: "Atualizar qualquer campo do lead",
        params: [{ name: "id", desc: "UUID do lead", required: true }],
        bodyFields: [
          { name: "*", desc: "Qualquer campo do lead (name, company, cpf, document, city, etc.)", required: false },
          { name: "tag_ids", desc: "Array de UUIDs de tags (substitui todas as tags atuais)", required: false },
        ],
        example: `POST ${API_URL}?module=leads&action=update&id=UUID\n\n{\n  "company": "Nova Razão Social",\n  "document": "98.765.432/0001-00",\n  "opportunity_value": 35000,\n  "closer_staff_id": "UUID",\n  "payment_method": "boleto",\n  "installments": "12x",\n  "tag_ids": ["uuid-tag-vip"]\n}`,
        response: `{ "data": { ... } }`,
      },
      {
        action: "move_stage", method: "POST", description: "Mover lead para outra etapa",
        params: [{ name: "id", desc: "UUID do lead", required: true }],
        bodyFields: [{ name: "stage_id", desc: "UUID da nova etapa", required: true }],
        example: `POST ${API_URL}?module=leads&action=move_stage&id=UUID\n\n{ "stage_id": "UUID-NOVA-ETAPA" }`,
        response: `{ "data": { "id": "uuid", "stage_id": "uuid-nova-etapa" } }`,
      },
      {
        action: "win", method: "POST", description: "🏆 Dar GANHO no lead (move para etapa won + cria financeiro)",
        params: [{ name: "id", desc: "UUID do lead", required: true }],
        bodyFields: [
          { name: "opportunity_value", desc: "Valor final da oportunidade", required: false },
          { name: "paid_value", desc: "Valor pago (cria fatura no financeiro)", required: false },
          { name: "closer_staff_id", desc: "UUID do closer", required: false },
          { name: "payment_method", desc: "Forma de pagamento (pix, boleto, cartao)", required: false },
          { name: "installments", desc: "Parcelas", required: false },
          { name: "due_day", desc: "Dia de vencimento", required: false },
          { name: "bank_id", desc: "UUID do banco (credita saldo)", required: false },
          { name: "company_id", desc: "UUID da empresa (vincula fatura)", required: false },
          { name: "description", desc: "Descrição da fatura", required: false },
          { name: "notes", desc: "Observações", required: false },
        ],
        example: `POST ${API_URL}?module=leads&action=win&id=UUID\n\n{\n  "paid_value": 25000,\n  "payment_method": "pix",\n  "closer_staff_id": "UUID",\n  "bank_id": "UUID-BANCO",\n  "notes": "Fechou após reunião"\n}`,
        response: `{ "success": true, "lead_id": "uuid", "status": "won", "stage": "Ganho", "invoice_id": "uuid-fatura" }`,
      },
      {
        action: "lose", method: "POST", description: "❌ Dar PERDA no lead (move para etapa lost)",
        params: [{ name: "id", desc: "UUID do lead", required: true }],
        bodyFields: [
          { name: "loss_reason_id", desc: "UUID do motivo de perda", required: false },
          { name: "notes", desc: "Observações", required: false },
        ],
        example: `POST ${API_URL}?module=leads&action=lose&id=UUID\n\n{ "loss_reason_id": "UUID-MOTIVO", "notes": "Sem orçamento" }`,
        response: `{ "success": true, "lead_id": "uuid", "status": "lost", "stage": "Perdido" }`,
      },
      {
        action: "add_note", method: "POST", description: "📝 Adicionar nota/anotação ao histórico do lead",
        params: [{ name: "id", desc: "UUID do lead", required: true }],
        bodyFields: [
          { name: "content", desc: "Conteúdo da nota", required: true },
          { name: "author_name", desc: "Nome do autor", required: false },
          { name: "staff_id", desc: "UUID do staff responsável", required: false },
        ],
        example: `POST ${API_URL}?module=leads&action=add_note&id=UUID\n\n{ "content": "Cliente pediu proposta atualizada", "author_name": "João" }`,
        response: `{ "data": { "id": "uuid", "type": "note", "title": "Nota de João", "description": "..." } }`,
      },
      {
        action: "delete", method: "POST", description: "🗑️ Excluir lead (cascata: limpa tags, atividades, histórico)",
        params: [{ name: "id", desc: "UUID do lead", required: true }],
        example: `POST ${API_URL}?module=leads&action=delete&id=UUID`,
        response: `{ "success": true }`,
      },
    ],
  },
  {
    name: "Tags",
    icon: Tag,
    module: "tags",
    description: "Gerenciar tags e vincular/desvincular de leads",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar todas as tags disponíveis",
        example: `GET ${API_URL}?module=tags&action=list`,
        response: `{ "data": [{ "id": "uuid", "name": "VIP", "color": "#f59e0b", "is_active": true }] }`,
      },
      {
        action: "create", method: "POST", description: "Criar nova tag",
        bodyFields: [
          { name: "name", desc: "Nome da tag", required: true },
          { name: "color", desc: "Cor hex (ex: #f59e0b)", required: false },
        ],
        example: `POST ${API_URL}?module=tags&action=create\n\n{ "name": "Prioridade Alta", "color": "#ef4444" }`,
        response: `{ "data": { "id": "uuid-gerado", "name": "Prioridade Alta", "color": "#ef4444" } }`,
      },
      {
        action: "add_to_lead", method: "POST", description: "Vincular tag a um lead",
        bodyFields: [
          { name: "lead_id", desc: "UUID do lead", required: true },
          { name: "tag_id", desc: "UUID da tag", required: true },
        ],
        example: `POST ${API_URL}?module=tags&action=add_to_lead\n\n{ "lead_id": "UUID-LEAD", "tag_id": "UUID-TAG" }`,
        response: `{ "data": { "id": "uuid", "lead_id": "...", "tag_id": "..." } }`,
      },
      {
        action: "remove_from_lead", method: "POST", description: "Desvincular tag de um lead",
        bodyFields: [
          { name: "lead_id", desc: "UUID do lead", required: true },
          { name: "tag_id", desc: "UUID da tag", required: true },
        ],
        example: `POST ${API_URL}?module=tags&action=remove_from_lead\n\n{ "lead_id": "UUID-LEAD", "tag_id": "UUID-TAG" }`,
        response: `{ "success": true }`,
      },
      {
        action: "lead_tags", method: "GET", description: "Listar tags de um lead específico",
        params: [{ name: "id", desc: "UUID do lead", required: true }],
        example: `GET ${API_URL}?module=tags&action=lead_tags&id=UUID-LEAD`,
        response: `{ "data": [{ "id": "uuid", "name": "VIP", "color": "#f59e0b" }] }`,
      },
    ],
  },
  {
    name: "Atividades",
    icon: Handshake,
    module: "activities",
    description: "Criar, gerenciar e excluir atividades de vendas",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar atividades",
        params: [
          { name: "lead_id", desc: "UUID do lead", required: false },
          { name: "status", desc: "pending, completed, cancelled", required: false },
          { name: "staff_id", desc: "UUID do responsável", required: false },
        ],
        example: `GET ${API_URL}?module=activities&action=list&lead_id=UUID`,
        response: `{ "data": [{ "id": "uuid", "type": "meeting", "title": "Reunião", "status": "pending" }] }`,
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
        example: `POST ${API_URL}?module=activities&action=create\n\n{ "lead_id": "UUID", "type": "meeting", "title": "Demo do produto", "scheduled_at": "2026-04-01T14:00:00Z" }`,
        response: `{ "data": { "id": "uuid-gerado", ... } }`,
      },
      {
        action: "complete", method: "POST", description: "Finalizar atividade",
        params: [{ name: "id", desc: "UUID da atividade", required: true }],
        bodyFields: [{ name: "notes", desc: "Notas de conclusão", required: false }],
        example: `POST ${API_URL}?module=activities&action=complete&id=UUID\n\n{ "notes": "Cliente demonstrou interesse" }`,
        response: `{ "data": { "id": "uuid", "status": "completed", "completed_at": "..." } }`,
      },
      {
        action: "delete", method: "POST", description: "Excluir atividade",
        params: [{ name: "id", desc: "UUID da atividade", required: true }],
        example: `POST ${API_URL}?module=activities&action=delete&id=UUID`,
        response: `{ "success": true }`,
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
        response: `{ "data": { "id": "uuid-gerado", "event_type": "scheduled" } }`,
      },
      {
        action: "finalize", method: "POST", description: "Finalizar reunião (realizada, no show, fora do ICP)",
        params: [{ name: "id", desc: "UUID do evento de agendamento", required: true }],
        bodyFields: [{ name: "event_type", desc: "realized, no_show, out_of_icp", required: true }],
        example: `POST ${API_URL}?module=meetings&action=finalize&id=UUID\n\n{ "event_type": "realized" }`,
        response: `{ "data": { "id": "uuid-novo", "event_type": "realized" } }`,
      },
    ],
  },
  {
    name: "Pipelines",
    icon: FolderOpen,
    module: "pipelines",
    description: "Consultar pipelines e etapas do CRM (inclui final_type)",
    endpoints: [
      {
        action: "list", method: "GET", description: "Listar pipelines",
        example: `GET ${API_URL}?module=pipelines&action=list`,
        response: `{ "data": [{ "id": "uuid", "name": "Pipeline Principal", "is_default": true }] }`,
      },
      {
        action: "stages", method: "GET", description: "Listar etapas (inclui final_type: won/lost)",
        params: [{ name: "pipeline_id", desc: "UUID do pipeline", required: false }],
        example: `GET ${API_URL}?module=pipelines&action=stages&pipeline_id=UUID`,
        response: `{ "data": [{ "id": "uuid", "name": "Qualificação", "sort_order": 1, "final_type": null }, { "id": "uuid", "name": "Ganho", "final_type": "won" }] }`,
      },
    ],
  },
];

export function CrmApiDocs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Target className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">API do CRM Comercial</h2>
          <p className="text-sm text-muted-foreground">
            Gerenciar leads, tags, atividades, reuniões, pipelines — dar ganho/perda, adicionar notas, fazer tudo no CRM
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

      <Tabs defaultValue="leads">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {crmModules.map(m => (
            <TabsTrigger key={m.module} value={m.module} className="text-xs gap-1.5">
              <m.icon className="h-3.5 w-3.5" />
              {m.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {crmModules.map(m => (
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
    </div>
  );
}
