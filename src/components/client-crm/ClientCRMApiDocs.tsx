import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Code2, Send, Key, FileJson, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receive-external-lead`;

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
  "nome": "João Silva",
  "telefone": "5511999999999",
  "email": "joao@empresa.com",
  "empresa": "Empresa XYZ",
  "faturamento": "R$ 500.000/mês",
  "qtd_vendedores": "12",
  "desafio": "Escalar o time comercial",
  "tag": "PRIORIDADE"
}`;

const EXAMPLE_CURL = `curl -X POST \\
  '${API_URL}' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: SUA_API_KEY_AQUI' \\
  -d '${EXAMPLE_BODY}'`;

const EXAMPLE_RESPONSE_SUCCESS = `{
  "success": true,
  "lead_id": "uuid-do-lead-criado"
}`;

const EXAMPLE_RESPONSE_ERROR = `{
  "error": "Campos obrigatórios: nome, telefone, email"
}`;

const EXAMPLE_JS = `const response = await fetch(
  '${API_URL}',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'SUA_API_KEY_AQUI',
    },
    body: JSON.stringify({
      nome: 'João Silva',
      telefone: '5511999999999',
      email: 'joao@empresa.com',
      empresa: 'Empresa XYZ',
    }),
  }
);

const data = await response.json();
console.log(data); // { success: true, lead_id: "..." }`;

const EXAMPLE_PYTHON = `import requests

response = requests.post(
    '${API_URL}',
    headers={
        'Content-Type': 'application/json',
        'x-api-key': 'SUA_API_KEY_AQUI',
    },
    json={
        'nome': 'João Silva',
        'telefone': '5511999999999',
        'email': 'joao@empresa.com',
        'empresa': 'Empresa XYZ',
    }
)

print(response.json())  # {'success': True, 'lead_id': '...'}`;

interface FieldDoc {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

const fields: FieldDoc[] = [
  { name: "nome", type: "string", required: true, description: "Nome completo do lead" },
  { name: "telefone", type: "string", required: true, description: "Telefone com DDD e código do país (ex: 5511999999999)" },
  { name: "email", type: "string", required: true, description: "E-mail do lead" },
  { name: "empresa", type: "string", required: false, description: "Nome da empresa" },
  { name: "faturamento", type: "string", required: false, description: "Faturamento mensal da empresa" },
  { name: "qtd_vendedores", type: "string", required: false, description: "Quantidade de vendedores" },
  { name: "desafio", type: "string", required: false, description: "Principal desafio / dor do lead" },
  { name: "tag", type: "string", required: false, description: "Tag de classificação. Use 'PRIORIDADE' para urgência alta" },
];

type TabId = "curl" | "javascript" | "python";

export const ClientCRMApiDocs = () => {
  const [activeTab, setActiveTab] = useState<TabId>("curl");
  const [urlCopied, setUrlCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(API_URL);
    setUrlCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setUrlCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            Documentação da API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use esta API para enviar leads automaticamente de landing pages, formulários externos, ou qualquer
            sistema que suporte requisições HTTP. Os leads são criados diretamente no pipeline <strong>"Funil SE"</strong>.
          </p>

          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-[10px]">POST</Badge>
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">{API_URL}</code>
            <Button variant="outline" size="icon" className="h-7 w-7 flex-shrink-0" onClick={copyUrl}>
              {urlCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="h-4 w-4" />
            Autenticação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A API utiliza autenticação via header <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">x-api-key</code>.
            Envie sua chave de API em todas as requisições.
          </p>
          <CodeBlock
            code={`Headers:\n  Content-Type: application/json\n  x-api-key: SUA_API_KEY_AQUI`}
            language="headers"
          />
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Importante:</strong> Mantenha sua API Key em segurança. Nunca exponha em código frontend ou repositórios públicos.
              Solicite sua chave com o administrador do sistema.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Request Body */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Campos do Body (JSON)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-xs">Campo</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Obrigatório</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f, i) => (
                  <tr key={f.name} className={i < fields.length - 1 ? "border-b" : ""}>
                    <td className="px-3 py-2">
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{f.name}</code>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{f.type}</td>
                    <td className="px-3 py-2">
                      {f.required ? (
                        <Badge variant="destructive" className="text-[10px]">Sim</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Não</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Examples */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="h-4 w-4" />
            Exemplos de Uso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-1 border-b pb-2">
            {([
              { id: "curl" as TabId, label: "cURL" },
              { id: "javascript" as TabId, label: "JavaScript" },
              { id: "python" as TabId, label: "Python" },
            ]).map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {activeTab === "curl" && <CodeBlock code={EXAMPLE_CURL} language="bash" />}
          {activeTab === "javascript" && <CodeBlock code={EXAMPLE_JS} language="javascript" />}
          {activeTab === "python" && <CodeBlock code={EXAMPLE_PYTHON} language="python" />}
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
              <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 text-[10px]">200</Badge>
              <span className="text-xs text-muted-foreground">Sucesso — Lead criado</span>
            </div>
            <CodeBlock code={EXAMPLE_RESPONSE_SUCCESS} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 text-[10px]">400</Badge>
              <span className="text-xs text-muted-foreground">Campos obrigatórios faltando</span>
            </div>
            <CodeBlock code={EXAMPLE_RESPONSE_ERROR} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 text-[10px]">401</Badge>
              <span className="text-xs text-muted-foreground">API Key inválida ou ausente</span>
            </div>
            <CodeBlock code={`{ "error": "Unauthorized" }`} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 text-[10px]">500</Badge>
              <span className="text-xs text-muted-foreground">Erro interno (pipeline não encontrado, etc.)</span>
            </div>
            <CodeBlock code={`{ "error": "Pipeline \\"Funil SE\\" não encontrado" }`} />
          </div>
        </CardContent>
      </Card>

      {/* Behavior */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <h4 className="font-medium text-sm">Comportamento automático</h4>
          <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
            <li>O lead é criado na <strong>primeira etapa</strong> do pipeline "Funil SE".</li>
            <li>O responsável é atribuído automaticamente ao primeiro staff admin/master ativo.</li>
            <li>A origem é marcada como <strong>"Landing Page"</strong> (se existir nas origens cadastradas).</li>
            <li>Se a <code className="bg-muted px-1 rounded font-mono">tag</code> for <code className="bg-muted px-1 rounded font-mono">"PRIORIDADE"</code>, a urgência é definida como <strong>alta</strong>.</li>
            <li>Notificações via WhatsApp são enviadas automaticamente para os números configurados.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
