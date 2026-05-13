import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Video } from "lucide-react";
import { toast } from "sonner";
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
  example: string;
  response: string;
}

const endpoints: EndpointDoc[] = [
  {
    action: "list",
    method: "GET",
    description: "Listar reuniões com todos os detalhes (responsável, briefing, transcrição, participantes)",
    params: [
      { name: "project_id", desc: "UUID do projeto", required: false },
      { name: "company_id", desc: "UUID da empresa", required: false },
      { name: "staff_id", desc: "UUID do staff responsável", required: false },
      { name: "is_finalized", desc: "true/false — filtrar finalizadas ou pendentes", required: false },
      { name: "is_internal", desc: "true/false — filtrar reuniões internas", required: false },
      { name: "date_from / date_to", desc: "Período (ISO 8601)", required: false },
      { name: "limit", desc: "Máximo de registros (padrão 500, máx 5000)", required: false },
      { name: "offset", desc: "Paginação", required: false },
    ],
    example: `GET ${API_URL}?module=project_meetings&action=list&project_id=UUID&is_finalized=true`,
    response: `{
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "meeting_title": "Kickoff - Empresa X",
      "meeting_date": "2026-04-10T14:00:00Z",
      "subject": "Reunião de kickoff",
      "notes": "Definimos os próximos passos...",
      "attendees": "João, Maria, Carlos",
      "meeting_link": "https://meet.google.com/abc-def-ghi",
      "recording_link": "https://drive.google.com/...",
      "transcript": "Transcrição completa da reunião...",
      "live_notes": "Anotações feitas durante a reunião...",
      "is_finalized": true,
      "is_no_show": false,
      "is_internal": false,
      "calendar_owner_name": "João Silva",
      "staff": {
        "id": "uuid",
        "name": "João Silva",
        "email": "joao@empresa.com",
        "role": "consultant"
      },
      "scheduled_by_staff": {
        "id": "uuid",
        "name": "Maria Santos",
        "email": "maria@empresa.com"
      },
      "project": {
        "id": "uuid",
        "product_name": "Produto X",
        "onboarding_companies": {
          "id": "uuid",
          "name": "Empresa X"
        }
      },
      "briefings": [
        {
          "id": "uuid",
          "briefing_content": "Resumo gerado pela IA...",
          "generated_at": "2026-04-10T15:00:00Z"
        }
      ],
      "created_at": "2026-04-08T10:00:00Z"
    }
  ],
  "pagination": { "limit": 500, "offset": 0 }
}`,
  },
  {
    action: "get",
    method: "GET",
    description: "Detalhes completos de uma reunião específica (inclui briefing, transcrição, staff)",
    params: [
      { name: "id", desc: "UUID da reunião", required: true },
    ],
    example: `GET ${API_URL}?module=project_meetings&action=get&id=UUID`,
    response: `{
  "data": {
    "id": "uuid",
    "meeting_title": "Reunião Semanal",
    "meeting_date": "2026-04-10T14:00:00Z",
    "subject": "Acompanhamento semanal",
    "notes": "Anotações detalhadas...",
    "attendees": "João, Maria",
    "transcript": "Transcrição completa...",
    "live_notes": "Notas ao vivo...",
    "recording_link": "https://...",
    "is_finalized": true,
    "is_no_show": false,
    "staff": { "id": "uuid", "name": "João", "role": "consultant" },
    "scheduled_by_staff": { "id": "uuid", "name": "Maria" },
    "project": { "id": "uuid", "product_name": "Produto X", "onboarding_companies": { "name": "Empresa X" } },
    "briefings": [{ "briefing_content": "Resumo IA..." }]
  }
}`,
  },
  {
    action: "create",
    method: "POST",
    description: "Criar uma nova reunião dentro de um projeto",
    params: [
      { name: "project_id", desc: "UUID do projeto (body)", required: true },
      { name: "meeting_title", desc: "Título da reunião (body)", required: true },
      { name: "meeting_date", desc: "Data/hora ISO 8601 (body)", required: true },
      { name: "subject", desc: "Assunto (body)", required: true },
      { name: "staff_id", desc: "UUID do responsável (body)", required: false },
      { name: "scheduled_by", desc: "UUID de quem agendou (body)", required: false },
      { name: "attendees", desc: "Participantes em texto (body)", required: false },
      { name: "meeting_link", desc: "Link da reunião (body)", required: false },
      { name: "notes", desc: "Anotações iniciais (body)", required: false },
      { name: "is_internal", desc: "Reunião interna - não visível ao cliente (body)", required: false },
    ],
    example: `POST ${API_URL}?module=project_meetings&action=create
Content-Type: application/json

{
  "project_id": "UUID-DO-PROJETO",
  "meeting_title": "Kickoff - Empresa X",
  "meeting_date": "2026-05-20T14:00:00-03:00",
  "subject": "Reunião de kickoff",
  "staff_id": "UUID-DO-CONSULTOR",
  "attendees": "João, Maria",
  "meeting_link": "https://meet.google.com/abc-def-ghi",
  "is_internal": false
}`,
    response: `{
  "data": {
    "id": "uuid-gerado",
    "project_id": "uuid",
    "meeting_title": "Kickoff - Empresa X",
    "meeting_date": "2026-05-20T17:00:00Z",
    "is_finalized": false,
    "created_at": "2026-05-13T10:00:00Z"
  }
}`,
  },
  {
    action: "update",
    method: "POST",
    description: "Editar/alterar dados de uma reunião existente (envie só os campos que quer mudar)",
    params: [
      { name: "id", desc: "UUID da reunião (query)", required: true },
      { name: "meeting_title", desc: "Novo título (body)", required: false },
      { name: "meeting_date", desc: "Nova data ISO 8601 (body)", required: false },
      { name: "subject", desc: "Novo assunto (body)", required: false },
      { name: "notes", desc: "Anotações (body)", required: false },
      { name: "live_notes", desc: "Notas ao vivo (body)", required: false },
      { name: "attendees", desc: "Participantes (body)", required: false },
      { name: "meeting_link", desc: "Link da reunião (body)", required: false },
      { name: "recording_link", desc: "Link da gravação (body)", required: false },
      { name: "transcript", desc: "Transcrição (body)", required: false },
      { name: "staff_id", desc: "Trocar responsável (body)", required: false },
      { name: "is_no_show", desc: "Marcar como no-show (body)", required: false },
      { name: "is_internal", desc: "Marcar como interna (body)", required: false },
    ],
    example: `POST ${API_URL}?module=project_meetings&action=update&id=UUID
Content-Type: application/json

{
  "meeting_date": "2026-05-21T15:00:00-03:00",
  "notes": "Cliente solicitou remarcar"
}`,
    response: `{
  "data": {
    "id": "uuid",
    "meeting_date": "2026-05-21T18:00:00Z",
    "notes": "Cliente solicitou remarcar",
    "updated_at": "2026-05-13T10:30:00Z"
  }
}`,
  },
  {
    action: "complete",
    method: "POST",
    description: "Concluir/finalizar uma reunião (marca is_finalized=true). Pode enviar notas, transcrição, gravação ou no-show no mesmo passo.",
    params: [
      { name: "id", desc: "UUID da reunião (query)", required: true },
      { name: "notes", desc: "Ata/anotações finais (body)", required: false },
      { name: "live_notes", desc: "Notas feitas durante (body)", required: false },
      { name: "transcript", desc: "Transcrição completa (body)", required: false },
      { name: "recording_link", desc: "Link da gravação (body)", required: false },
      { name: "is_no_show", desc: "Marcar como no-show (body)", required: false },
    ],
    example: `POST ${API_URL}?module=project_meetings&action=complete&id=UUID
Content-Type: application/json

{
  "notes": "Definimos próximos passos e responsáveis",
  "recording_link": "https://drive.google.com/file/d/..."
}`,
    response: `{
  "data": {
    "id": "uuid",
    "is_finalized": true,
    "notes": "Definimos próximos passos e responsáveis",
    "recording_link": "https://drive.google.com/file/d/...",
    "updated_at": "2026-05-13T16:00:00Z"
  }
}`,
  },
  {
    action: "delete",
    method: "POST",
    description: "Excluir permanentemente uma reunião (remove também briefings, slides e respostas CSAT vinculadas)",
    params: [
      { name: "id", desc: "UUID da reunião (query)", required: true },
    ],
    example: `POST ${API_URL}?module=project_meetings&action=delete&id=UUID`,
    response: `{ "success": true }`,
  },
];

export function ProjectMeetingsApiDocs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Video className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">API de Reuniões de Projetos</h2>
          <p className="text-sm text-muted-foreground">
            Consultar reuniões com todos os detalhes: responsável, participantes, transcrição, briefing IA, gravação e notas
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">URL Base & Autenticação</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <CodeBlock code={`${API_URL}?module=project_meetings&action=<action>`} language="url" />
          <p className="text-xs text-muted-foreground">
            Autenticação via <code className="bg-muted px-1 rounded">Authorization: Bearer &lt;jwt&gt;</code> ou <code className="bg-muted px-1 rounded">x-api-key: &lt;key&gt;</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Reuniões de Projetos</CardTitle>
            <Badge variant="secondary" className="text-[10px]">project_meetings</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Todas as reuniões registradas nos projetos com informações completas
          </p>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {endpoints.map((ep, idx) => (
              <AccordionItem key={idx} value={ep.action}>
                <AccordionTrigger className="text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
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
                                <td className="px-2 py-1">
                                  <Badge variant={p.required ? "default" : "secondary"} className="text-[9px]">
                                    {p.required ? "Sim" : "Não"}
                                  </Badge>
                                </td>
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
                    <CodeBlock code={`curl -X ${ep.method} "${ep.example.split("\\n")[0].replace(`${ep.method} `, "")}" \\\n  -H "apikey: SUA_CHAVE_PUBLICA" \\\n  -H "x-api-key: SUA_API_KEY"`} language="bash" />
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Campos Retornados</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Campo</th>
                  <th className="px-2 py-1.5 text-left font-medium">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["meeting_title", "Título da reunião"],
                  ["meeting_date", "Data/hora da reunião (ISO 8601)"],
                  ["subject", "Assunto da reunião"],
                  ["notes", "Anotações/ata da reunião"],
                  ["attendees", "Participantes (texto)"],
                  ["meeting_link", "Link da reunião (Google Meet, Zoom, etc.)"],
                  ["recording_link", "Link da gravação"],
                  ["transcript", "Transcrição completa da reunião"],
                  ["live_notes", "Notas feitas em tempo real durante a reunião"],
                  ["is_finalized", "Se a reunião foi finalizada"],
                  ["is_no_show", "Se o cliente não compareceu"],
                  ["is_internal", "Se é reunião interna (não visível ao cliente)"],
                  ["calendar_owner_name", "Nome do dono do calendário"],
                  ["staff", "Objeto com dados do responsável (id, name, email, role)"],
                  ["scheduled_by_staff", "Objeto com dados de quem agendou (id, name, email)"],
                  ["project", "Objeto com dados do projeto e empresa vinculada"],
                  ["briefings", "Array de briefings gerados por IA (conteúdo e data)"],
                ].map(([campo, desc]) => (
                  <tr key={campo} className="border-t">
                    <td className="px-2 py-1 font-mono text-primary">{campo}</td>
                    <td className="px-2 py-1 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
