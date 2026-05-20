import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2, Building2, ExternalLink } from "lucide-react";

const BASE = "https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/system-api";

const EndpointBadge = ({ method }: { method: string }) => {
  const colors: Record<string, string> = {
    GET: "bg-blue-100 text-blue-800 border-blue-200",
    POST: "bg-green-100 text-green-800 border-green-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold border ${colors[method] ?? ""}`}>
      {method}
    </span>
  );
};

const CodeBlock = ({ code }: { code: string }) => (
  <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
    {code}
  </pre>
);

const FieldsTable = ({ fields }: { fields: { name: string; type: string; description: string; required?: boolean }[] }) => (
  <div className="overflow-x-auto rounded-md border text-sm">
    <table className="w-full text-left">
      <thead className="bg-muted/50">
        <tr>
          <th className="px-3 py-2 font-semibold text-xs text-muted-foreground">Campo</th>
          <th className="px-3 py-2 font-semibold text-xs text-muted-foreground">Tipo</th>
          <th className="px-3 py-2 font-semibold text-xs text-muted-foreground">Descrição</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((f) => (
          <tr key={f.name} className="border-t">
            <td className="px-3 py-2 font-mono text-xs">
              {f.name}
              {f.required && <span className="ml-1 text-red-500">*</span>}
            </td>
            <td className="px-3 py-2 text-xs text-muted-foreground">{f.type}</td>
            <td className="px-3 py-2 text-xs">{f.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Tab: Link de um cliente específico ───────────────────────────────────────

function SingleCompanyTab() {
  const endpoint = `${BASE}?module=companies&action=kickoff_link&id={company_id}`;

  const queryParams = [
    { name: "module", type: "string", required: true, description: 'Sempre "companies"' },
    { name: "action", type: "string", required: true, description: 'Sempre "kickoff_link"' },
    { name: "id", type: "uuid", required: true, description: "ID da empresa (company_id)" },
  ];

  const responseFields = [
    { name: "id", type: "uuid", description: "ID da empresa" },
    { name: "name", type: "string", description: "Nome da empresa" },
    { name: "status", type: "string", description: 'Status do cliente (ex: "active")' },
    { name: "email", type: "string | null", description: "E-mail do cliente" },
    { name: "phone", type: "string | null", description: "Telefone do cliente" },
    { name: "kickoff_date", type: "date | null", description: "Data de kickoff cadastrada no sistema" },
    { name: "contract_start_date", type: "date | null", description: "Início do contrato" },
    { name: "kickoff_form_url", type: "string", description: "Link completo do formulário de kickoff para enviar ao cliente" },
  ];

  const curl = `curl -G "${BASE}" \\
  -H "x-api-key: SUA_API_KEY" \\
  --data-urlencode "module=companies" \\
  --data-urlencode "action=kickoff_link" \\
  --data-urlencode "id=UUID_DA_EMPRESA"`;

  const response = `{
  "data": {
    "id": "a1b2c3d4-...",
    "name": "3D Cure MG",
    "status": "active",
    "email": "contato@3dcure.com.br",
    "phone": "31999990000",
    "kickoff_date": null,
    "contract_start_date": "2026-05-01",
    "kickoff_form_url": "https://unvholdings.com.br/#/kickoff/a1b2c3d4-..."
  }
}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Link de Kickoff de um Cliente Específico
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Retorna o link do formulário de kickoff de um cliente a partir do <code className="font-mono text-xs">company_id</code>.
            Use para enviar via WhatsApp, e-mail ou automação.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <EndpointBadge method="GET" />
            <code className="text-xs font-mono break-all">{endpoint}</code>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Parâmetros de Query</p>
            <FieldsTable fields={queryParams} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Campos da Resposta</p>
            <FieldsTable fields={responseFields} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Exemplo de Requisição (cURL)</p>
            <CodeBlock code={curl} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Exemplo de Resposta</p>
            <CodeBlock code={response} />
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <strong>Formato do link:</strong>
            <br />
            <code className="font-mono text-xs">
              https://unvholdings.com.br/#/kickoff/{"{company_id}"}
            </code>
            <br />
            <span className="text-xs mt-1 block">
              O link é público — o cliente acessa sem precisar de login ou token.
              O formulário salva as respostas diretamente no cadastro da empresa.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Lista de todos os clientes com links ─────────────────────────────────

function AllCompaniesTab() {
  const endpoint = `${BASE}?module=companies&action=kickoff_link`;

  const queryParams = [
    { name: "module", type: "string", required: true, description: 'Sempre "companies"' },
    { name: "action", type: "string", required: true, description: 'Sempre "kickoff_link"' },
    { name: "status", type: "string", description: '"active" | "inactive" | "churned" — filtra por status da empresa' },
    { name: "limit", type: "number", description: "Máximo de registros (padrão 500)" },
    { name: "offset", type: "number", description: "Paginação" },
  ];

  const curlAll = `curl -G "${endpoint}" \\
  -H "x-api-key: SUA_API_KEY"`;

  const curlActive = `curl -G "${endpoint}" \\
  -H "x-api-key: SUA_API_KEY" \\
  --data-urlencode "status=active"`;

  const response = `{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "name": "3D Cure MG",
      "status": "active",
      "email": "contato@3dcure.com.br",
      "phone": "31999990000",
      "kickoff_date": null,
      "contract_start_date": "2026-05-01",
      "kickoff_form_url": "https://unvholdings.com.br/#/kickoff/a1b2c3d4-..."
    },
    {
      "id": "e5f6g7h8-...",
      "name": "Vitale Estética",
      "status": "active",
      "email": "contato@vitale.com.br",
      "phone": "31988880000",
      "kickoff_date": "2026-04-15",
      "contract_start_date": "2026-04-01",
      "kickoff_form_url": "https://unvholdings.com.br/#/kickoff/e5f6g7h8-..."
    }
  ],
  "pagination": {
    "limit": 500,
    "offset": 0
  }
}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            Links de Kickoff de Todos os Clientes
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Retorna todos os clientes com seus respectivos links de kickoff.
            Útil para automações que enviam o formulário em massa ou checam quais clientes ainda não preencheram.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <EndpointBadge method="GET" />
            <code className="text-xs font-mono break-all">{endpoint}</code>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Parâmetros de Query</p>
            <FieldsTable fields={queryParams} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Listar todos os clientes</p>
            <CodeBlock code={curlAll} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Listar apenas clientes ativos</p>
            <CodeBlock code={curlActive} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Exemplo de Resposta</p>
            <CodeBlock code={response} />
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>Dica para automação:</strong>{" "}
            <span className="text-xs">
              Para identificar clientes que ainda não preencheram o kickoff, filtre por{" "}
              <code className="font-mono">status=active</code> e verifique se{" "}
              <code className="font-mono">kickoff_date</code> é <code className="font-mono">null</code>.
              Esses são os clientes que ainda precisam receber o link.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function KickoffLinkApiDocs() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ExternalLink className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold">Link do Formulário de Kickoff</h2>
          <p className="text-sm text-muted-foreground">
            Obtenha o link público do formulário de kickoff de um cliente ou de todos os clientes para enviar via WhatsApp, e-mail ou automação.
          </p>
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        <strong>Base URL:</strong>{" "}
        <code className="font-mono text-xs">{BASE}</code>
        <br />
        <strong>Auth:</strong>{" "}
        <code className="font-mono text-xs">x-api-key: {"<chave>"}</code>
        {" "}ou{" "}
        <code className="font-mono text-xs">Authorization: Bearer {"<jwt>"}</code>
      </div>

      <Tabs defaultValue="single" className="space-y-4">
        <TabsList>
          <TabsTrigger value="single" className="gap-2">
            <Building2 className="h-4 w-4" />
            Por Cliente
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <Link2 className="h-4 w-4" />
            Todos os Clientes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <SingleCompanyTab />
        </TabsContent>

        <TabsContent value="all">
          <AllCompaniesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
