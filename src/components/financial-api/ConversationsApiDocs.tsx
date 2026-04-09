import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, MessageSquare, MessageCircle, Send, Search } from "lucide-react";
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
  icon: any;
  params?: { name: string; desc: string; required: boolean }[];
  bodyFields?: { name: string; desc: string; required: boolean }[];
  example: string;
  response: string;
}

const endpoints: EndpointDoc[] = [
  {
    action: "list",
    method: "GET",
    icon: Search,
    description: "Listar conversas do projeto — retorna todas as conversas com dados do contato (nome, telefone, foto)",
    params: [
      { name: "project_id", desc: "UUID do projeto (filtra conversas vinculadas ao projeto)", required: true },
      { name: "status", desc: "open, closed, archived", required: false },
      { name: "instance_id", desc: "UUID da instância WhatsApp (filtra por instância específica)", required: false },
      { name: "assigned_to", desc: "UUID do responsável atribuído à conversa", required: false },
      { name: "limit", desc: "Quantidade de resultados (default: 500, max: 5000)", required: false },
      { name: "offset", desc: "Paginação (default: 0)", required: false },
    ],
    example: `# Todas as conversas de um projeto
GET ${API_URL}?module=conversations&action=list&project_id=UUID

# Conversas abertas de uma instância específica
GET ${API_URL}?module=conversations&action=list&project_id=UUID&status=open&instance_id=UUID

# Conversas atribuídas a um responsável
GET ${API_URL}?module=conversations&action=list&project_id=UUID&assigned_to=UUID-STAFF`,
    response: `{
  "data": [
    {
      "id": "uuid-conversa",
      "instance_id": "uuid-instancia",
      "contact_id": "uuid-contato",
      "status": "open",
      "assigned_to": "uuid-staff",
      "lead_id": "uuid-lead-vinculado",
      "sector_id": null,
      "last_message": "Oi, quero saber sobre o produto",
      "last_message_at": "2026-04-09T14:30:00Z",
      "unread_count": 3,
      "project_id": "uuid-projeto",
      "contact": {
        "id": "uuid-contato",
        "phone": "5511999990000",
        "name": "Maria Silva",
        "profile_picture_url": "https://..."
      }
    }
  ],
  "pagination": { "limit": 500, "offset": 0 }
}`,
  },
  {
    action: "get",
    method: "GET",
    icon: MessageSquare,
    description: "Detalhes de uma conversa específica com dados do contato",
    params: [
      { name: "id", desc: "UUID da conversa", required: true },
    ],
    example: `GET ${API_URL}?module=conversations&action=get&id=UUID-CONVERSA`,
    response: `{
  "data": {
    "id": "uuid-conversa",
    "instance_id": "uuid-instancia",
    "contact_id": "uuid-contato",
    "status": "open",
    "assigned_to": "uuid-staff",
    "lead_id": "uuid-lead",
    "last_message": "Oi, quero saber sobre o produto",
    "last_message_at": "2026-04-09T14:30:00Z",
    "unread_count": 3,
    "project_id": "uuid-projeto",
    "contact": {
      "id": "uuid-contato",
      "phone": "5511999990000",
      "name": "Maria Silva",
      "profile_picture_url": "https://..."
    }
  }
}`,
  },
  {
    action: "messages",
    method: "GET",
    icon: MessageCircle,
    description: "Listar mensagens de uma conversa — retorna o histórico completo em ordem cronológica",
    params: [
      { name: "id", desc: "UUID da conversa (pode usar também conversation_id)", required: true },
      { name: "limit", desc: "Quantidade de mensagens (default: 500)", required: false },
      { name: "offset", desc: "Paginação (default: 0)", required: false },
    ],
    example: `# Histórico de mensagens de uma conversa
GET ${API_URL}?module=conversations&action=messages&id=UUID-CONVERSA

# Com paginação (últimas 50)
GET ${API_URL}?module=conversations&action=messages&id=UUID-CONVERSA&limit=50&offset=0`,
    response: `{
  "data": [
    {
      "id": "uuid-msg",
      "conversation_id": "uuid-conversa",
      "remote_id": "5511999990000@s.whatsapp.net",
      "content": "Oi, quero saber sobre o produto",
      "type": "text",
      "direction": "incoming",
      "status": "received",
      "media_url": null,
      "media_mimetype": null,
      "quoted_message_id": null,
      "sent_by": null,
      "created_at": "2026-04-09T14:28:00Z",
      "whatsapp_message_id": "ABCDEF123456"
    },
    {
      "id": "uuid-msg-2",
      "conversation_id": "uuid-conversa",
      "content": "Olá Maria! Temos várias opções disponíveis.",
      "type": "text",
      "direction": "outgoing",
      "status": "sent",
      "media_url": null,
      "sent_by": "uuid-staff",
      "created_at": "2026-04-09T14:30:00Z"
    }
  ],
  "pagination": { "limit": 500, "offset": 0 }
}`,
  },
  {
    action: "send_message",
    method: "POST",
    icon: Send,
    description: "Enviar mensagem de texto em uma conversa existente — envia via WhatsApp e salva no histórico",
    bodyFields: [
      { name: "conversation_id", desc: "UUID da conversa onde enviar a mensagem", required: true },
      { name: "message", desc: "Texto da mensagem a enviar", required: true },
      { name: "instance_id", desc: "UUID da instância WhatsApp (opcional, usa a da conversa se não informado)", required: false },
    ],
    example: `POST ${API_URL}?module=conversations&action=send_message

{
  "conversation_id": "UUID-CONVERSA",
  "message": "Olá! Segue as informações solicitadas."
}`,
    response: `{
  "data": {
    "id": "uuid-msg-nova",
    "conversation_id": "uuid-conversa",
    "content": "Olá! Segue as informações solicitadas.",
    "type": "text",
    "direction": "outgoing",
    "status": "sent",
    "sent_by": "uuid-staff",
    "created_at": "2026-04-09T15:00:00Z"
  },
  "evolution_response": { "key": { "id": "WHATSAPP_MSG_ID" } }
}`,
  },
];

export function ConversationsApiDocs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <MessageSquare className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">API de Conversas</h2>
          <p className="text-sm text-muted-foreground">
            Visualizar conversas WhatsApp dos projetos, ler histórico de mensagens e enviar mensagens
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Conversas</CardTitle>
            <Badge variant="secondary" className="text-[10px]">conversations</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Módulo para acessar conversas WhatsApp vinculadas aos projetos dos clientes, ler mensagens e enviar respostas
          </p>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {endpoints.map((ep, idx) => {
              const Icon = ep.icon;
              return (
                <AccordionItem key={idx} value={ep.action}>
                  <AccordionTrigger className="text-sm hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Badge className={ep.method === "GET" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" : "bg-amber-500/10 text-amber-600 border-amber-200"}>
                        {ep.method}
                      </Badge>
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs">{ep.action}</span>
                      <span className="text-muted-foreground font-normal text-left">— {ep.description}</span>
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
                      <CodeBlock code={`curl -X ${ep.method} "${ep.example.split("\n")[0].replace(`${ep.method} `, "").replace(/^#.*\n/gm, "").trim()}" \\\n  -H "apikey: SUA_CHAVE_PUBLICA" \\\n  -H "x-api-key: SUA_API_KEY"${ep.method === "POST" ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${ep.example.includes("\n\n") ? ep.example.split("\n\n").slice(1).join("\n\n").replace(/\n/g, "") : "{}"}'` : ""}`} language="bash" />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Guia Prático: Lendo e Enviando Mensagens
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-3">
            <p className="text-muted-foreground">
              Para reproduzir a visão do menu <strong>Conversas</strong> dentro de um projeto via API:
            </p>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">1️⃣ Listar conversas do projeto</h4>
              <CodeBlock code={`GET ${API_URL}?module=conversations&action=list&project_id=UUID-PROJETO`} language="http" />
              <p className="text-xs text-muted-foreground">Retorna todas as conversas com nome e telefone do contato. Use <code>status=open</code> para ver apenas conversas ativas.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">2️⃣ Abrir o histórico de uma conversa</h4>
              <CodeBlock code={`GET ${API_URL}?module=conversations&action=messages&id=UUID-CONVERSA`} language="http" />
              <p className="text-xs text-muted-foreground">
                Cada mensagem tem <code>direction</code> (<strong>incoming</strong> = recebida, <strong>outgoing</strong> = enviada) 
                e <code>type</code> (text, image, document, audio, video). Mensagens com mídia incluem <code>media_url</code>.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">3️⃣ Enviar uma mensagem</h4>
              <CodeBlock code={`POST ${API_URL}?module=conversations&action=send_message

{
  "conversation_id": "UUID-CONVERSA",
  "message": "Olá! Como posso ajudar?"
}`} language="http" />
              <p className="text-xs text-muted-foreground">
                A mensagem é enviada via WhatsApp e automaticamente salva no histórico da conversa. 
                O campo <code>last_message</code> da conversa é atualizado.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">📌 Campos importantes das mensagens</h4>
              <div className="border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b"><td className="px-2 py-1 font-mono text-primary">direction</td><td className="px-2 py-1 text-muted-foreground"><strong>incoming</strong> (cliente enviou) ou <strong>outgoing</strong> (equipe enviou)</td></tr>
                    <tr className="border-b"><td className="px-2 py-1 font-mono text-primary">type</td><td className="px-2 py-1 text-muted-foreground">text, image, document, audio, video, sticker</td></tr>
                    <tr className="border-b"><td className="px-2 py-1 font-mono text-primary">media_url</td><td className="px-2 py-1 text-muted-foreground">URL do arquivo (se for mídia)</td></tr>
                    <tr className="border-b"><td className="px-2 py-1 font-mono text-primary">status</td><td className="px-2 py-1 text-muted-foreground">sent, delivered, read, received</td></tr>
                    <tr><td className="px-2 py-1 font-mono text-primary">sent_by</td><td className="px-2 py-1 text-muted-foreground">UUID do staff que enviou (null se foi o cliente)</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
