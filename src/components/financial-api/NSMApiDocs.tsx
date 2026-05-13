import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Target, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nsm-api`;

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

export function NSMApiDocs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Target className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">API da North Star Metric (NSM)</h2>
          <p className="text-sm text-muted-foreground">
            Definir e consultar a meta mensal de faturamento (NSM) de cada empresa cliente.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">URL Base & Autenticação</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <CodeBlock code={API_URL} language="url" />
          <CodeBlock
            code={`x-api-key: <NSM_API_KEY>\nContent-Type: application/json`}
            language="headers"
          />
          <p className="text-xs text-muted-foreground">
            A chave <code className="font-mono">NSM_API_KEY</code> é gerada nas configurações de
            integrações. Sem ela, a requisição retorna 401 Unauthorized.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Endpoints
            <Badge variant="secondary" className="text-[10px]">nsm</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            A empresa pode ser identificada por <code className="font-mono">company_id</code> (UUID)
            ou por <code className="font-mono">company_name</code> (busca parcial, case-insensitive).
          </p>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {/* GET status */}
            <AccordionItem value="get_status">
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">GET</Badge>
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs">/nsm-api</span>
                  <span className="text-muted-foreground font-normal text-left">
                    — Consulta a NSM atual e o realizado do mês corrente
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <p className="text-xs font-semibold mb-1">Query params</p>
                  <CodeBlock
                    code={`company_id=<uuid>          # opcional (prioridade)\ncompany_name=<string>      # opcional (busca por nome)`}
                    language="query"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">Exemplo (curl)</p>
                  <CodeBlock
                    code={`curl -X GET "${API_URL}?company_name=Acme" \\\n  -H "x-api-key: $NSM_API_KEY"`}
                    language="bash"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">Resposta 200</p>
                  <CodeBlock
                    code={`{
  "success": true,
  "company_id": "9b1c...",
  "company_name": "Acme Comércio Ltda",
  "target_value": 500000,
  "target_value_cents": 50000000,
  "label": "Meta Mensal de Faturamento",
  "current_month_achieved": 312450.75,
  "progress_percent": 62.5
}`}
                    language="json"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* POST update */}
            <AccordionItem value="post_update">
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">POST</Badge>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs">/nsm-api</span>
                  <span className="text-muted-foreground font-normal text-left">
                    — Define ou atualiza a meta NSM da empresa
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <p className="text-xs font-semibold mb-1">Body</p>
                  <CodeBlock
                    code={`{
  "company_id": "9b1c...",          // opcional (prioridade)
  "company_name": "Acme",           // opcional (busca por nome)
  "target_value": 500000.00,        // em REAIS (use este OU target_value_cents)
  "target_value_cents": 50000000,   // em CENTAVOS (alternativa precisa)
  "label": "Meta Mensal de Faturamento" // opcional
}`}
                    language="json"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">Exemplo (curl)</p>
                  <CodeBlock
                    code={`curl -X POST "${API_URL}" \\\n  -H "x-api-key: $NSM_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "company_name": "Acme",\n    "target_value": 500000\n  }'`}
                    language="bash"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">Resposta 200</p>
                  <CodeBlock
                    code={`{
  "success": true,
  "company_id": "9b1c...",
  "company_name": "Acme Comércio Ltda",
  "target_value": 500000,
  "target_value_cents": 50000000,
  "label": "Meta Mensal de Faturamento"
}`}
                    language="json"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">Erros possíveis</p>
                  <CodeBlock
                    code={`401 { "error": "Unauthorized" }                          // x-api-key inválida\n400 { "error": "Informe target_value ou target_value_cents." }\n404 { "error": "Empresa não encontrada..." }              // company_id/name não bate\n500 { "error": "Erro ao atualizar NSM", "details": "..." }`}
                    language="json"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Comportamento</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Atualizar a meta dispara automaticamente os alertas de 70% / 90% / 100% pelo cron de NSM.</p>
          <p>• O realizado do mês considera apenas KPIs monetários marcados como <em>main goal</em> da empresa.</p>
          <p>• Atingir 100% no mês permite arquivar a meta e definir uma nova pelo card no dashboard.</p>
        </CardContent>
      </Card>
    </div>
  );
}
