import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Send, MessageSquare, List } from "lucide-react";
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

export function WhatsAppSendApiDocs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Send className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">API de Envio de WhatsApp</h2>
          <p className="text-sm text-muted-foreground">
            Enviar mensagens WhatsApp para qualquer telefone escolhendo a instância de envio
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">URL Base & Autenticação</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <CodeBlock code={API_URL} language="url" />
          <CodeBlock
            code={`# Opção 1: Bearer Token (JWT)\nAuthorization: Bearer <token>\napikey: <chave_publica>\n\n# Opção 2: API Key\nx-api-key: <sua_chave>\napikey: <chave_publica>`}
            language="headers"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">WhatsApp</CardTitle>
            <Badge variant="secondary" className="text-[10px]">whatsapp</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Liste as instâncias WhatsApp disponíveis e envie mensagens diretas escolhendo qual instância usar.
            O contato e a conversa são criados automaticamente se não existirem.
          </p>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="list_instances">
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">GET</Badge>
                  <List className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs">list_instances</span>
                  <span className="text-muted-foreground font-normal text-left">
                    — Listar todas as instâncias WhatsApp disponíveis (id, nome, status)
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div>
                  <h4 className="text-xs font-medium mb-1 text-muted-foreground">EXEMPLO</h4>
                  <CodeBlock code={`GET ${API_URL}?module=whatsapp&action=list_instances`} language="http" />
                </div>
                <div>
                  <h4 className="text-xs font-medium mb-1 text-muted-foreground">RESPOSTA</h4>
                  <CodeBlock
                    code={`{
  "data": [
    {
      "id": "uuid-instancia-1",
      "instance_name": "comercial-01",
      "status": "connected",
      "phone_number": "5511999990000"
    },
    {
      "id": "uuid-instancia-2",
      "instance_name": "suporte",
      "status": "connected",
      "phone_number": "5511988880000"
    }
  ]
}`}
                    language="json"
                  />
                </div>
                <div>
                  <h4 className="text-xs font-medium mb-1 text-muted-foreground">cURL</h4>
                  <CodeBlock
                    code={`curl -X GET "${API_URL}?module=whatsapp&action=list_instances" \\
  -H "apikey: SUA_CHAVE_PUBLICA" \\
  -H "x-api-key: SUA_API_KEY"`}
                    language="bash"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="send">
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">POST</Badge>
                  <Send className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs">send</span>
                  <span className="text-muted-foreground font-normal text-left">
                    — Enviar mensagem de texto via WhatsApp escolhendo a instância
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div>
                  <h4 className="text-xs font-medium mb-1 text-muted-foreground">BODY (JSON)</h4>
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody>
                        <tr className="border-t first:border-t-0">
                          <td className="px-2 py-1 font-mono text-primary">instance_id</td>
                          <td className="px-2 py-1 text-muted-foreground">UUID da instância WhatsApp (obtido em list_instances)</td>
                          <td className="px-2 py-1"><Badge className="text-[9px]">Sim</Badge></td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-2 py-1 font-mono text-primary">phone</td>
                          <td className="px-2 py-1 text-muted-foreground">Telefone do destinatário (BR — normalizado para E.164 13 dígitos)</td>
                          <td className="px-2 py-1"><Badge className="text-[9px]">Sim</Badge></td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-2 py-1 font-mono text-primary">message</td>
                          <td className="px-2 py-1 text-muted-foreground">Texto da mensagem a enviar</td>
                          <td className="px-2 py-1"><Badge className="text-[9px]">Sim</Badge></td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-2 py-1 font-mono text-primary">lead_id</td>
                          <td className="px-2 py-1 text-muted-foreground">UUID do lead para vincular contato/conversa</td>
                          <td className="px-2 py-1"><Badge variant="secondary" className="text-[9px]">Não</Badge></td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-2 py-1 font-mono text-primary">project_id</td>
                          <td className="px-2 py-1 text-muted-foreground">UUID do projeto para vincular a conversa</td>
                          <td className="px-2 py-1"><Badge variant="secondary" className="text-[9px]">Não</Badge></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-medium mb-1 text-muted-foreground">EXEMPLO</h4>
                  <CodeBlock
                    code={`POST ${API_URL}?module=whatsapp&action=send

{
  "instance_id": "UUID-INSTANCIA",
  "phone": "5511999990000",
  "message": "Olá! Tudo bem?",
  "lead_id": "UUID-LEAD"
}`}
                    language="http"
                  />
                </div>

                <div>
                  <h4 className="text-xs font-medium mb-1 text-muted-foreground">RESPOSTA</h4>
                  <CodeBlock
                    code={`{
  "data": {
    "conversation_id": "uuid-conversa",
    "contact_id": "uuid-contato",
    "instance_id": "uuid-instancia",
    "instance_name": "comercial-01",
    "phone": "5511999990000",
    "message_id": "uuid-mensagem",
    "remote_id": "WHATSAPP_MSG_ID"
  },
  "evolution_response": { "key": { "id": "WHATSAPP_MSG_ID" } }
}`}
                    language="json"
                  />
                </div>

                <div>
                  <h4 className="text-xs font-medium mb-1 text-muted-foreground">cURL</h4>
                  <CodeBlock
                    code={`curl -X POST "${API_URL}?module=whatsapp&action=send" \\
  -H "apikey: SUA_CHAVE_PUBLICA" \\
  -H "x-api-key: SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "instance_id": "UUID-INSTANCIA",
    "phone": "5511999990000",
    "message": "Olá! Tudo bem?"
  }'`}
                    language="bash"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Fluxo recomendado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <h4 className="font-semibold">1️⃣ Listar instâncias disponíveis</h4>
            <p className="text-xs text-muted-foreground">
              Chame <code>list_instances</code> uma vez para descobrir os UUIDs e nomes das instâncias conectadas.
            </p>
          </div>
          <div>
            <h4 className="font-semibold">2️⃣ Enviar a mensagem</h4>
            <p className="text-xs text-muted-foreground">
              Chame <code>send</code> com o <code>instance_id</code> escolhido + telefone + mensagem.
              O contato e a conversa são criados/atualizados automaticamente, e a mensagem aparece no inbox.
            </p>
          </div>
          <div>
            <h4 className="font-semibold">📌 Observações</h4>
            <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
              <li>Telefone aceito em qualquer formato: o sistema normaliza para 13 dígitos com DDI 55.</li>
              <li>A instância precisa estar com status <code>connected</code> para o envio funcionar.</li>
              <li>Cada conversa é única por par <strong>contato + instância</strong>.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
