import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Code2, Key, FileJson, AlertTriangle, Briefcase } from "lucide-react";
import { toast } from "sonner";

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-job-opening`;

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
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const EXAMPLE_BODY = `{
  "title": "Analista Comercial Sênior",
  "area": "Comercial",
  "job_type": "CLT",
  "project_id": "uuid-do-projeto",
  "description": "Responsável por prospecção ativa e gestão da carteira de clientes.",
  "requirements": "Experiência mínima de 3 anos em vendas B2B.",
  "differentials": "Conhecimento em CRM e metodologias de vendas.",
  "salary_range": "R$ 4.000 - R$ 6.000",
  "seniority": "senior",
  "location": "Belo Horizonte, MG",
  "is_remote": false,
  "contract_model": "presencial",
  "target_date": "2026-06-30",
  "sla_days": 30,
  "company_id": "uuid-da-empresa"
}`;

const EXAMPLE_CURL = `curl -X POST \\
  '${API_URL}' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: SUA_API_KEY_AQUI' \\
  -d '{
    "title": "Analista Comercial Sênior",
    "area": "Comercial",
    "job_type": "CLT",
    "project_id": "uuid-do-projeto"
  }'`;

const EXAMPLE_JS = `const response = await fetch('${API_URL}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'SUA_API_KEY_AQUI',
  },
  body: JSON.stringify({
    title: 'Analista Comercial Sênior',
    area: 'Comercial',
    job_type: 'CLT',
    project_id: 'uuid-do-projeto',
    description: 'Descrição da vaga...',
    salary_range: 'R$ 4.000 - R$ 6.000',
    seniority: 'senior',
    is_remote: false,
  }),
});

const data = await response.json();
console.log(data.job_opening_id);`;

const EXAMPLE_RESPONSE_SUCCESS = `{
  "success": true,
  "job_opening_id": "3f8d2a1b-...",
  "title": "Analista Comercial Sênior",
  "status": "open",
  "created_at": "2026-05-19T14:00:00Z"
}`;

const EXAMPLE_RESPONSE_ERROR_AUTH = `{
  "error": "Unauthorized: API key inválida ou ausente"
}`;

const EXAMPLE_RESPONSE_ERROR_FIELDS = `{
  "error": "Campos obrigatórios ausentes: title, area, job_type, project_id"
}`;

const fields = [
  { name: "title", type: "string", required: true, description: "Título da vaga" },
  { name: "area", type: "string", required: true, description: "Área/departamento (ex: Comercial, RH, TI)" },
  { name: "job_type", type: "string", required: true, description: "Tipo de contrato: CLT, PJ, Estágio, Freelance" },
  { name: "project_id", type: "uuid", required: true, description: "ID do projeto de RH associado" },
  { name: "description", type: "string", required: false, description: "Descrição completa da vaga" },
  { name: "requirements", type: "string", required: false, description: "Requisitos obrigatórios" },
  { name: "differentials", type: "string", required: false, description: "Diferenciais desejáveis" },
  { name: "salary_range", type: "string", required: false, description: "Faixa salarial (ex: R$ 4.000 - R$ 6.000)" },
  { name: "seniority", type: "string", required: false, description: "Senioridade: junior, pleno, senior, especialista" },
  { name: "location", type: "string", required: false, description: "Localização (ex: Belo Horizonte, MG)" },
  { name: "is_remote", type: "boolean", required: false, description: "true para remoto, false para presencial (padrão: false)" },
  { name: "contract_model", type: "string", required: false, description: "Modelo: presencial, hibrido, remoto" },
  { name: "target_date", type: "date", required: false, description: "Data alvo para contratação (YYYY-MM-DD)" },
  { name: "sla_days", type: "integer", required: false, description: "SLA em dias para preenchimento da vaga" },
  { name: "company_id", type: "uuid", required: false, description: "ID da empresa cliente (se aplicável)" },
];

export const JobOpeningApiDocs = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Briefcase className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">API — Criar Vaga</h2>
          <p className="text-sm text-muted-foreground">
            Endpoint para criação de vagas de emprego via integração externa
          </p>
        </div>
      </div>

      {/* Endpoint */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Code2 className="h-4 w-4" /> Endpoint
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-green-600 text-white font-mono text-xs">POST</Badge>
            <code className="text-xs bg-muted px-2 py-1 rounded break-all">{API_URL}</code>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Key className="h-3 w-3" />
            Autenticação via header <code className="bg-muted px-1 rounded">x-api-key</code>
          </div>
        </CardContent>
      </Card>

      {/* Fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileJson className="h-4 w-4" /> Campos do Body
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Campo</th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Tipo</th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Obrigatório</th>
                  <th className="text-left py-2 font-semibold text-muted-foreground">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fields.map((f) => (
                  <tr key={f.name} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-4">
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{f.name}</code>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground font-mono">{f.type}</td>
                    <td className="py-2 pr-4">
                      {f.required ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5">sim</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5">não</Badge>
                      )}
                    </td>
                    <td className="py-2 text-muted-foreground">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Example body */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Exemplo de Body (JSON)</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={EXAMPLE_BODY} language="json" />
        </CardContent>
      </Card>

      {/* cURL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Exemplo cURL</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={EXAMPLE_CURL} language="bash" />
        </CardContent>
      </Card>

      {/* JavaScript */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Exemplo JavaScript</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={EXAMPLE_JS} language="javascript" />
        </CardContent>
      </Card>

      {/* Responses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Respostas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-green-600 text-white text-[10px]">200 OK</Badge>
              <span className="text-xs text-muted-foreground">Vaga criada com sucesso</span>
            </div>
            <CodeBlock code={EXAMPLE_RESPONSE_SUCCESS} language="json" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="destructive" className="text-[10px]">401</Badge>
              <span className="text-xs text-muted-foreground">API key inválida</span>
            </div>
            <CodeBlock code={EXAMPLE_RESPONSE_ERROR_AUTH} language="json" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="destructive" className="text-[10px]">400</Badge>
              <span className="text-xs text-muted-foreground">Campos obrigatórios ausentes</span>
            </div>
            <CodeBlock code={EXAMPLE_RESPONSE_ERROR_FIELDS} language="json" />
          </div>
        </CardContent>
      </Card>

      {/* Note */}
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900">
        <CardContent className="pt-4">
          <div className="flex gap-2 text-xs text-yellow-800 dark:text-yellow-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Configuração necessária</p>
              <p>
                Defina o secret <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">JOB_OPENING_API_KEY</code> nas
                configurações de Edge Functions do Supabase com a chave que será usada nas requisições.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
