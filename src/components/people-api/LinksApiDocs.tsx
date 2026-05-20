import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2, Users, Briefcase } from "lucide-react";

const BASE = "https://rchsygtqwikprqakiqom.supabase.co/functions/v1/system-api";

const EndpointBadge = ({ method }: { method: string }) => {
  const colors: Record<string, string> = {
    GET: "bg-blue-100 text-blue-800 border-blue-200",
    POST: "bg-green-100 text-green-800 border-green-200",
    PUT: "bg-amber-100 text-amber-800 border-amber-200",
    DELETE: "bg-red-100 text-red-800 border-red-200",
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

// ─── KPI Links ───────────────────────────────────────────────────────────────

function KpiLinksTab() {
  const endpoint = `${BASE}?module=salespeople&action=kpi_links`;

  const queryParams = [
    { name: "module", type: "string", required: true, description: 'Sempre "salespeople"' },
    { name: "action", type: "string", required: true, description: 'Sempre "kpi_links"' },
    { name: "company_id", type: "uuid", description: "Filtrar por empresa (recomendado)" },
    { name: "status", type: "string", description: '"active" | "inactive" — filtra por is_active' },
  ];

  const responseFields = [
    { name: "id", type: "uuid", description: "ID do vendedor" },
    { name: "company_id", type: "uuid", description: "ID da empresa" },
    { name: "name", type: "string", description: "Nome do vendedor" },
    { name: "email", type: "string", description: "E-mail do vendedor" },
    { name: "phone", type: "string", description: "Telefone do vendedor" },
    { name: "is_active", type: "boolean", description: "Se o vendedor está ativo" },
    { name: "access_code", type: "string", description: "Código de acesso (8 chars hex) usado na URL" },
    { name: "kpi_entry_url", type: "string | null", description: "Link completo para lançamento de KPI do vendedor. Null se não houver access_code gerado." },
    { name: "unit_id", type: "uuid | null", description: "Unidade do vendedor" },
    { name: "team_id", type: "uuid | null", description: "Equipe do vendedor" },
    { name: "sector_id", type: "uuid | null", description: "Setor do vendedor" },
  ];

  const curl = `curl -G "${endpoint}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN" \\
  --data-urlencode "company_id=UUID_DA_EMPRESA" \\
  --data-urlencode "status=active"`;

  const responseExample = `{
  "data": [
    {
      "id": "abc123...",
      "company_id": "empresa-uuid...",
      "name": "João Silva",
      "email": "joao@empresa.com",
      "phone": "31999990000",
      "is_active": true,
      "access_code": "a1b2c3d4",
      "kpi_entry_url": "https://unvholdings.com.br/#/kpi-entry/empresa-uuid?code=a1b2c3d4",
      "unit_id": null,
      "team_id": "team-uuid...",
      "sector_id": null
    }
  ]
}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Links de Lançamento de KPI por Vendedor
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Retorna a lista de vendedores de uma empresa com o link individual de lançamento de KPI.
            O link é gerado automaticamente a partir do <code className="font-mono text-xs">access_code</code> de cada vendedor.
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
            <p className="text-sm font-medium mb-2">Exemplo de Requisição</p>
            <CodeBlock code={curl} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Exemplo de Resposta</p>
            <CodeBlock code={responseExample} />
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <strong>Formato do link:</strong>
            <br />
            <code className="font-mono text-xs">
              https://unvholdings.com.br/#/kpi-entry/{"{company_id}"}?code={"{access_code}"}
            </code>
            <br />
            <span className="text-xs mt-1 block">
              O <code className="font-mono">access_code</code> é gerado automaticamente (8 chars hex) ao cadastrar o vendedor.
              Se o campo for nulo, o link não estará disponível — acesse o painel e regenere o código de acesso.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Job Opening Links ────────────────────────────────────────────────────────

function JobOpeningLinksTab() {
  const endpoint = `${BASE}?module=job_openings&action=list`;

  const queryParams = [
    { name: "module", type: "string", required: true, description: 'Sempre "job_openings"' },
    { name: "action", type: "string", required: true, description: 'Sempre "list"' },
    { name: "project_id", type: "uuid", description: "Filtrar vagas por projeto" },
    { name: "status", type: "string", description: '"open" | "paused" | "closed" — filtra por status da vaga' },
  ];

  const responseFields = [
    { name: "id", type: "uuid", description: "ID da vaga" },
    { name: "project_id", type: "uuid", description: "ID do projeto associado" },
    { name: "company_id", type: "uuid | null", description: "ID da empresa (enriquecido via projeto)" },
    { name: "title", type: "string", description: "Título da vaga" },
    { name: "description", type: "string | null", description: "Descrição da vaga" },
    { name: "location", type: "string | null", description: "Local de trabalho" },
    { name: "salary_range", type: "string | null", description: "Faixa salarial" },
    { name: "employment_type", type: "string | null", description: 'Tipo: "clt", "pj", "freelancer", etc.' },
    { name: "requirements", type: "string | null", description: "Requisitos da vaga" },
    { name: "benefits", type: "string | null", description: "Benefícios oferecidos" },
    { name: "status", type: "string", description: '"open" | "paused" | "closed"' },
    { name: "application_url", type: "string", description: "Link público para candidatura (página de formulário)" },
    { name: "created_at", type: "timestamp", description: "Data de criação da vaga" },
    { name: "updated_at", type: "timestamp", description: "Última atualização" },
    { name: "closed_at", type: "timestamp | null", description: "Data de fechamento, se encerrada" },
  ];

  const curlAll = `curl -G "${endpoint}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`;

  const curlFiltered = `curl -G "${endpoint}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN" \\
  --data-urlencode "project_id=UUID_DO_PROJETO" \\
  --data-urlencode "status=open"`;

  const responseExample = `{
  "data": [
    {
      "id": "vaga-uuid...",
      "project_id": "projeto-uuid...",
      "company_id": "empresa-uuid...",
      "title": "Vendedor(a) Sênior",
      "description": "Buscamos profissional com experiência em vendas consultivas...",
      "location": "Belo Horizonte - MG",
      "salary_range": "R$ 3.000 - R$ 5.000 + comissão",
      "employment_type": "clt",
      "requirements": "Experiência mínima de 2 anos em vendas B2B...",
      "benefits": "Plano de saúde, VR, comissão...",
      "status": "open",
      "application_url": "https://unvholdings.com.br/#/job-application?job=vaga-uuid",
      "created_at": "2025-05-01T10:00:00Z",
      "updated_at": "2025-05-01T10:00:00Z",
      "closed_at": null
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
            <Briefcase className="h-4 w-4 text-primary" />
            Vagas em Aberto com Link de Candidatura
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Retorna todas as vagas de emprego cadastradas no módulo de RH, enriquecidas com o link
            público de candidatura. Filtre por projeto ou status para obter apenas as vagas ativas.
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
            <p className="text-sm font-medium mb-2">Listar todas as vagas</p>
            <CodeBlock code={curlAll} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Listar apenas vagas abertas de um projeto</p>
            <CodeBlock code={curlFiltered} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Exemplo de Resposta</p>
            <CodeBlock code={responseExample} />
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <strong>Formato do link de candidatura:</strong>
            <br />
            <code className="font-mono text-xs">
              https://unvholdings.com.br/#/job-application?job={"{job_id}"}
            </code>
            <br />
            <span className="text-xs mt-1 block">
              O link é público — qualquer pessoa com a URL pode acessar o formulário de candidatura sem autenticação.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function LinksApiDocs() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link2 className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold">Links Públicos</h2>
          <p className="text-sm text-muted-foreground">
            Endpoints para obter links públicos de lançamento de KPI por vendedor e de candidatura em vagas abertas do RH.
          </p>
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        <strong>Base URL:</strong>{" "}
        <code className="font-mono text-xs">{BASE}</code>
        <br />
        <strong>Auth:</strong>{" "}
        <code className="font-mono text-xs">Authorization: Bearer {"<jwt>"}</code>
        {" "}ou{" "}
        <code className="font-mono text-xs">x-api-key: {"<chave>"}</code>
      </div>

      <Tabs defaultValue="kpi_links" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kpi_links" className="gap-2">
            <Users className="h-4 w-4" />
            Links de KPI (Vendedores)
          </TabsTrigger>
          <TabsTrigger value="job_openings" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Links de Vagas (RH)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kpi_links">
          <KpiLinksTab />
        </TabsContent>

        <TabsContent value="job_openings">
          <JobOpeningLinksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
