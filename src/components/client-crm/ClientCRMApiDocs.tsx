import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Code2, Send, Key, FileJson, AlertTriangle, Trophy } from "lucide-react";
import { toast } from "sonner";

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receive-external-lead`;
const UPDATE_STATUS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-lead-status`;

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
  "tag": "PRIORIDADE",
  "pipeline_id": "uuid-do-pipeline",
  "origin_name": "Landing Page Black Friday",
  "utm_source": "instagram",
  "utm_medium": "ads",
  "utm_campaign": "black-friday-2025"
}`;

const EXAMPLE_CURL = `curl -X POST \\
  '${API_URL}' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: SUA_API_KEY_AQUI' \\
  -d '{
    "nome": "João Silva",
    "telefone": "5511999999999",
    "email": "joao@empresa.com",
    "empresa": "Empresa XYZ",
    "pipeline_id": "uuid-do-pipeline",
    "utm_source": "instagram"
  }'`;

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
      pipeline_id: 'uuid-do-pipeline',  // opcional
      pipeline_name: 'Funil Inbound',   // alternativa ao pipeline_id
      origin_name: 'Landing Page',
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'campanha-q4',
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
        'pipeline_id': 'uuid-do-pipeline',
        'utm_source': 'facebook',
        'utm_medium': 'social',
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
  { name: "pipeline_id", type: "uuid", required: false, description: "ID do pipeline de destino. Se omitido, usa 'Funil SE'" },
  { name: "pipeline_name", type: "string", required: false, description: "Nome do pipeline (alternativa ao pipeline_id). Busca parcial" },
  { name: "origin_name", type: "string", required: false, description: "Nome da origem para rastreio. Se omitido, usa 'Landing Page'" },
  { name: "utm_source", type: "string", required: false, description: "Fonte do tráfego (ex: google, instagram, facebook)" },
  { name: "utm_medium", type: "string", required: false, description: "Meio do tráfego (ex: cpc, ads, email, social)" },
  { name: "utm_campaign", type: "string", required: false, description: "Nome da campanha (ex: black-friday-2025)" },
  { name: "utm_content", type: "string", required: false, description: "Variante do conteúdo para testes A/B" },
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
            sistema que suporte requisições HTTP. Os leads podem ser criados em <strong>qualquer pipeline</strong> — 
            basta informar o <code className="text-xs bg-muted px-1 rounded font-mono">pipeline_id</code> ou{" "}
            <code className="text-xs bg-muted px-1 rounded font-mono">pipeline_name</code>. 
            Se omitido, o lead vai para o pipeline padrão ("Funil SE").
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
              <span className="text-xs text-muted-foreground">Campos obrigatórios faltando ou pipeline não encontrado</span>
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
        </CardContent>
      </Card>

      {/* Behavior */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <h4 className="font-medium text-sm">Comportamento automático</h4>
          <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
            <li>O lead é criado na <strong>primeira etapa</strong> do pipeline selecionado.</li>
            <li>Se <code className="bg-muted px-1 rounded font-mono">pipeline_id</code> ou <code className="bg-muted px-1 rounded font-mono">pipeline_name</code> não forem informados, o pipeline padrão ("Funil SE") é usado.</li>
            <li>O responsável é atribuído automaticamente ao primeiro staff admin/master ativo.</li>
            <li>A origem é identificada pelo campo <code className="bg-muted px-1 rounded font-mono">origin_name</code> (padrão: "Landing Page").</li>
            <li>Parâmetros UTM (<code className="bg-muted px-1 rounded font-mono">utm_source</code>, <code className="bg-muted px-1 rounded font-mono">utm_medium</code>, <code className="bg-muted px-1 rounded font-mono">utm_campaign</code>, <code className="bg-muted px-1 rounded font-mono">utm_content</code>) são salvos no lead para rastreio.</li>
            <li>Se a <code className="bg-muted px-1 rounded font-mono">tag</code> for <code className="bg-muted px-1 rounded font-mono">"PRIORIDADE"</code>, a urgência é definida como <strong>alta</strong>.</li>
            <li>Notificações via WhatsApp são enviadas automaticamente para os números configurados.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Pipeline Forms */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <h4 className="font-medium text-sm">📋 Formulários por Pipeline</h4>
          <p className="text-xs text-muted-foreground">
            Além da API, você pode criar <strong>formulários públicos</strong> para cada pipeline nas Configurações → Formulários. 
            Cada formulário gera um link único que pode ser incorporado em landing pages ou compartilhado diretamente. 
            Os leads criados pelo formulário entram automaticamente no pipeline correto, com rastreio de UTM via parâmetros na URL.
          </p>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-[11px] text-muted-foreground font-mono">
              Exemplo: seusite.com/#/form/TOKEN?utm_source=instagram&utm_medium=ads
            </p>
          </div>
        </CardContent>
      </Card>

      {/* === UPDATE LEAD STATUS ENDPOINT === */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Marcar Lead como Ganho/Perdido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use este endpoint para atualizar o status de um lead existente para <strong>Ganho</strong> ou <strong>Perdido</strong> via API.
            O lead será movido automaticamente para a etapa correspondente no funil.
          </p>

          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-[10px]">POST</Badge>
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">{UPDATE_STATUS_URL}</code>
            <Button variant="outline" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => {
              navigator.clipboard.writeText(UPDATE_STATUS_URL);
              toast.success("URL copiada!");
            }}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Update Status Fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Campos — Atualizar Status
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
                {[
                  { name: "lead_id", type: "uuid", required: true, description: "ID do lead a ser atualizado" },
                  { name: "status", type: "string", required: true, description: 'Status do lead: "won" (ganho) ou "lost" (perdido)' },
                  { name: "opportunity_value", type: "number", required: false, description: "Valor do negócio em reais (ex: 5000)" },
                  { name: "paid_value", type: "number", required: false, description: "Valor pago em reais. Se informado, cria um Contas a Receber já como pago" },
                  { name: "bank_id", type: "uuid", required: false, description: "ID do banco onde o pagamento foi recebido. Se informado junto com paid_value, credita o banco" },
                  { name: "payment_method", type: "string", required: false, description: 'Forma de pagamento (ex: "pix", "cartao", "boleto", "transferencia"). Padrão: "pix"' },
                  { name: "description", type: "string", required: false, description: "Descrição do recebível financeiro. Padrão: nome da empresa/lead" },
                  { name: "company_id", type: "uuid", required: false, description: "ID da empresa no financeiro (para vincular ao cliente correto)" },
                  { name: "closer_staff_id", type: "uuid", required: false, description: "ID do closer responsável pelo fechamento" },
                  { name: "notes", type: "string", required: false, description: "Observações sobre o fechamento" },
                ].map((f, i) => (
                  <tr key={f.name} className={i < 9 ? "border-b" : ""}>
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

      {/* Update Status Examples */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="h-4 w-4" />
            Exemplo — Marcar como Ganho com Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock code={`curl -X POST \\
  '${UPDATE_STATUS_URL}' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: SUA_API_KEY_AQUI' \\
  -d '{
    "lead_id": "uuid-do-lead",
    "status": "won",
    "paid_value": 5000,
    "bank_id": "uuid-do-banco",
    "payment_method": "pix",
    "description": "Venda Empresa XYZ - Plano Premium",
    "notes": "Pagamento confirmado via PIX"
  }'`} language="bash" />

          <CodeBlock code={`// Resposta de sucesso:
{
  "success": true,
  "lead_id": "uuid-do-lead",
  "status": "won",
  "stage": "Ganho",
  "receivable_id": "uuid-do-recebivel",
  "bank": "Banco Inter"
}`} language="json" />

          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Code2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Exemplo simples</strong> (só mover para ganho, sem financeiro):</p>
              <code className="block bg-muted px-2 py-1 rounded font-mono text-[11px]">
                {`{ "lead_id": "uuid", "status": "won", "opportunity_value": 5000 }`}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Update Status Behavior */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <h4 className="font-medium text-sm">Comportamento — Atualizar Status</h4>
          <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
            <li>O lead é movido automaticamente para a etapa <strong>"Ganho"</strong> ou <strong>"Perdido"</strong> do pipeline atual.</li>
            <li>A data de fechamento (<code className="bg-muted px-1 rounded font-mono">closed_at</code>) é registrada automaticamente.</li>
            <li>Se marcado como ganho, uma notificação é enviada ao grupo do WhatsApp (se configurado).</li>
            <li>O <code className="bg-muted px-1 rounded font-mono">opportunity_value</code> atualiza o valor do negócio.</li>
            <li>Usa a mesma <code className="bg-muted px-1 rounded font-mono">x-api-key</code> do endpoint de criação de leads.</li>
          </ul>

          <h4 className="font-medium text-sm mt-4">💰 Financeiro automático (quando <code className="bg-muted px-1 rounded font-mono text-xs">paid_value</code> é informado)</h4>
          <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
            <li>Cria um registro em <strong>Contas a Receber</strong> já com status <strong>"Pago"</strong>.</li>
            <li>Se <code className="bg-muted px-1 rounded font-mono">bank_id</code> for informado, credita o valor no banco correspondente.</li>
            <li>O nome do banco é retornado na resposta para confirmação.</li>
            <li>A forma de pagamento pode ser: <code className="bg-muted px-1 rounded font-mono">pix</code>, <code className="bg-muted px-1 rounded font-mono">cartao</code>, <code className="bg-muted px-1 rounded font-mono">boleto</code>, <code className="bg-muted px-1 rounded font-mono">transferencia</code>.</li>
          </ul>
        </CardContent>
      </Card>

      {/* How to get bank_id */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <h4 className="font-medium text-sm">🏦 Como obter o <code className="bg-muted px-1 rounded font-mono text-xs">bank_id</code>?</h4>
          <p className="text-xs text-muted-foreground">
            Para obter o ID do banco, acesse o menu <strong>Financeiro → Bancos</strong> e copie o ID do banco desejado. 
            Ou entre em contato com o administrador do sistema. Os bancos cadastrados são os mesmos que aparecem no módulo financeiro.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
