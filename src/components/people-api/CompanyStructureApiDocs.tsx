import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Code2, Key, Building2, Users, Layers, BarChart3, Briefcase } from "lucide-react";
import { toast } from "sonner";

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
    <div className="relative rounded-lg border border-border bg-muted/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted border-b border-border">
        <span className="text-[10px] uppercase font-mono text-muted-foreground">{language}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed"><code>{code}</code></pre>
    </div>
  );
};

const FieldsTable = ({ fields }: { fields: { name: string; type: string; required: boolean; description: string }[] }) => (
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
            <td className="py-2 pr-4"><code className="bg-muted px-1.5 py-0.5 rounded font-mono">{f.name}</code></td>
            <td className="py-2 pr-4 text-muted-foreground font-mono">{f.type}</td>
            <td className="py-2 pr-4">
              {f.required
                ? <Badge variant="destructive" className="text-[10px] px-1.5">sim</Badge>
                : <Badge variant="outline" className="text-[10px] px-1.5">não</Badge>}
            </td>
            <td className="py-2 text-muted-foreground">{f.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const EndpointBadge = ({ method, path }: { method: string; path: string }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <Badge className="bg-green-600 text-white font-mono text-xs">{method}</Badge>
    <code className="text-xs bg-muted px-2 py-1 rounded break-all">{path}</code>
  </div>
);

// ─── UNITS ───────────────────────────────────────────────────────────────────

const UnitsSection = () => {
  const createFields = [
    { name: "company_id", type: "uuid", required: true, description: "ID da empresa" },
    { name: "name", type: "string", required: true, description: "Nome da unidade" },
    { name: "code", type: "string", required: false, description: "Código identificador da unidade" },
  ];
  const updateFields = [
    { name: "name", type: "string", required: false, description: "Novo nome da unidade" },
    { name: "code", type: "string", required: false, description: "Novo código" },
    { name: "is_active", type: "boolean", required: false, description: "true para ativar, false para inativar" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Módulo: <code className="bg-muted px-1 rounded">units</code></h3>
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Listar Unidades</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EndpointBadge method="GET" path={`${API_URL}?module=units&action=list&company_id=<uuid>`} />
          <CodeBlock language="bash" code={`curl '${API_URL}?module=units&action=list&company_id=SEU_COMPANY_ID' \\
  -H 'x-api-key: SUA_API_KEY'`} />
        </CardContent>
      </Card>

      {/* Create */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Criar Unidade</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EndpointBadge method="POST" path={`${API_URL}?module=units&action=create`} />
          <FieldsTable fields={createFields} />
          <CodeBlock language="bash" code={`curl -X POST '${API_URL}?module=units&action=create' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: SUA_API_KEY' \\
  -d '{"company_id": "uuid-da-empresa", "name": "Unidade BH", "code": "BH"}'`} />
          <CodeBlock language="json" code={`{ "data": { "id": "uuid...", "company_id": "uuid...", "name": "Unidade BH", "code": "BH", "is_active": true } }`} />
        </CardContent>
      </Card>

      {/* Update */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Editar Unidade</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EndpointBadge method="POST" path={`${API_URL}?module=units&action=update&id=<uuid>`} />
          <FieldsTable fields={updateFields} />
          <CodeBlock language="bash" code={`curl -X POST '${API_URL}?module=units&action=update&id=UUID_DA_UNIDADE' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: SUA_API_KEY' \\
  -d '{"name": "Unidade Nova Lima", "is_active": true}'`} />
        </CardContent>
      </Card>
    </div>
  );
};

// ─── SECTORS ─────────────────────────────────────────────────────────────────

const SectorsSection = () => {
  const createFields = [
    { name: "company_id", type: "uuid", required: true, description: "ID da empresa" },
    { name: "name", type: "string", required: true, description: "Nome do setor" },
    { name: "code", type: "string", required: false, description: "Código do setor" },
    { name: "description", type: "string", required: false, description: "Descrição do setor" },
    { name: "unit_id", type: "uuid", required: false, description: "ID da unidade vinculada" },
    { name: "sort_order", type: "integer", required: false, description: "Ordem de exibição (padrão: 0)" },
  ];
  const updateFields = [
    { name: "name", type: "string", required: false, description: "Novo nome" },
    { name: "code", type: "string", required: false, description: "Novo código" },
    { name: "description", type: "string", required: false, description: "Nova descrição" },
    { name: "unit_id", type: "uuid", required: false, description: "Nova unidade vinculada" },
    { name: "is_active", type: "boolean", required: false, description: "Ativar/inativar setor" },
    { name: "sort_order", type: "integer", required: false, description: "Nova ordem de exibição" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Módulo: <code className="bg-muted px-1 rounded">sectors</code></h3>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Listar Setores</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EndpointBadge method="GET" path={`${API_URL}?module=sectors&action=list&company_id=<uuid>`} />
          <CodeBlock language="bash" code={`curl '${API_URL}?module=sectors&action=list&company_id=SEU_COMPANY_ID' \\
  -H 'x-api-key: SUA_API_KEY'`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Criar Setor</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EndpointBadge method="POST" path={`${API_URL}?module=sectors&action=create`} />
          <FieldsTable fields={createFields} />
          <CodeBlock language="bash" code={`curl -X POST '${API_URL}?module=sectors&action=create' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: SUA_API_KEY' \\
  -d '{"company_id": "uuid...", "name": "Comercial Interno", "code": "CI", "unit_id": "uuid-da-unidade"}'`} />
          <CodeBlock language="json" code={`{ "data": { "id": "uuid...", "company_id": "uuid...", "name": "Comercial Interno", "code": "CI", "is_active": true } }`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Editar Setor</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EndpointBadge method="POST" path={`${API_URL}?module=sectors&action=update&id=<uuid>`} />
          <FieldsTable fields={updateFields} />
          <CodeBlock language="bash" code={`curl -X POST '${API_URL}?module=sectors&action=update&id=UUID_DO_SETOR' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: SUA_API_KEY' \\
  -d '{"name": "Comercial Externo", "sort_order": 1}'`} />
        </CardContent>
      </Card>
    </div>
  );
};

// ─── TEAMS ───────────────────────────────────────────────────────────────────

const TeamsSection = () => {
  const createFields = [
    { name: "company_id", type: "uuid", required: true, description: "ID da empresa" },
    { name: "name", type: "string", required: true, description: "Nome da equipe" },
    { name: "code", type: "string", required: false, description: "Código da equipe" },
    { name: "unit_id", type: "uuid", required: false, description: "ID da unidade vinculada" },
  ];
  const updateFields = [
    { name: "name", type: "string", required: false, description: "Novo nome" },
    { name: "code", type: "string", required: false, description: "Novo código" },
    { name: "unit_id", type: "uuid", required: false, description: "Nova unidade vinculada" },
    { name: "is_active", type: "boolean", required: false, description: "Ativar/inativar equipe" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Módulo: <code className="bg-muted px-1 rounded">teams</code></h3>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Listar Equipes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EndpointBadge method="GET" path={`${API_URL}?module=teams&action=list&company_id=<uuid>`} />
          <CodeBlock language="bash" code={`curl '${API_URL}?module=teams&action=list&company_id=SEU_COMPANY_ID' \\
  -H 'x-api-key: SUA_API_KEY'`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Criar Equipe</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EndpointBadge method="POST" path={`${API_URL}?module=teams&action=create`} />
          <FieldsTable fields={createFields} />
          <CodeBlock language="bash" code={`curl -X POST '${API_URL}?module=teams&action=create' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: SUA_API_KEY' \\
  -d '{"company_id": "uuid...", "name": "Equipe Alpha", "code": "ALPHA"}'`} />
          <CodeBlock language="json" code={`{ "data": { "id": "uuid...", "company_id": "uuid...", "name": "Equipe Alpha", "is_active": true } }`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Editar Equipe</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EndpointBadge method="POST" path={`${API_URL}?module=teams&action=update&id=<uuid>`} />
          <FieldsTable fields={updateFields} />
          <CodeBlock language="bash" code={`curl -X POST '${API_URL}?module=teams&action=update&id=UUID_DA_EQUIPE' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: SUA_API_KEY' \\
  -d '{"name": "Equipe Beta", "unit_id": "uuid-da-unidade"}'`} />
        </CardContent>
      </Card>
    </div>
  );
};

// ─── SALESPEOPLE ──────────────────────────────────────────────────────────────

const SalespeopleSection = () => {
  const updateFields = [
    { name: "name", type: "string", required: false, description: "Novo nome do vendedor" },
    { name: "email", type: "string", required: false, description: "Novo e-mail" },
    { name: "phone", type: "string", required: false, description: "Novo telefone" },
    { name: "unit_id", type: "uuid", required: false, description: "Nova unidade" },
    { name: "team_id", type: "uuid", required: false, description: "Nova equipe" },
    { name: "sector_id", type: "uuid", required: false, description: "Novo setor" },
    { name: "is_active", type: "boolean", required: false, description: "Ativar/inativar vendedor" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Módulo: <code className="bg-muted px-1 rounded">salespeople</code> — Novas ações</h3>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Editar Vendedor</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EndpointBadge method="POST" path={`${API_URL}?module=salespeople&action=update&id=<uuid>`} />
          <FieldsTable fields={updateFields} />
          <CodeBlock language="bash" code={`curl -X POST '${API_URL}?module=salespeople&action=update&id=UUID_DO_VENDEDOR' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: SUA_API_KEY' \\
  -d '{"name": "João Silva", "team_id": "uuid-da-equipe", "is_active": true}'`} />
          <CodeBlock language="json" code={`{ "data": { "id": "uuid...", "name": "João Silva", "is_active": true, ... } }`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Excluir Vendedor</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EndpointBadge method="POST" path={`${API_URL}?module=salespeople&action=delete&id=<uuid>`} />
          <div className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded p-2">
            ⚠️ A exclusão é permanente. Recomendamos inativar (<code>is_active: false</code>) em vez de excluir para preservar o histórico de KPIs.
          </div>
          <CodeBlock language="bash" code={`curl -X POST '${API_URL}?module=salespeople&action=delete&id=UUID_DO_VENDEDOR' \\
  -H 'x-api-key: SUA_API_KEY'`} />
          <CodeBlock language="json" code={`{ "success": true, "deleted_id": "uuid..." }`} />
        </CardContent>
      </Card>
    </div>
  );
};

// ─── KPIs ─────────────────────────────────────────────────────────────────────

const KpisSection = () => {
  const updateKpiFields = [
    { name: "name", type: "string", required: false, description: "Novo nome do KPI" },
    { name: "kpi_type", type: "string", required: false, description: "monetary | numeric | percentage" },
    { name: "periodicity", type: "string", required: false, description: "daily | weekly | monthly" },
    { name: "target_value", type: "number", required: false, description: "Novo valor de meta padrão" },
    { name: "is_individual", type: "boolean", required: false, description: "true = por vendedor, false = por equipe" },
    { name: "is_required", type: "boolean", required: false, description: "KPI obrigatório" },
    { name: "is_active", type: "boolean", required: false, description: "Ativar/inativar KPI" },
    { name: "sector_id", type: "uuid", required: false, description: "Vincular ao setor" },
    { name: "team_id", type: "uuid", required: false, description: "Vincular à equipe" },
    { name: "unit_id", type: "uuid", required: false, description: "Vincular à unidade" },
    { name: "sort_order", type: "integer", required: false, description: "Ordem de exibição" },
  ];
  const updateEntryFields = [
    { name: "value", type: "number", required: false, description: "Novo valor lançado" },
    { name: "observations", type: "string", required: false, description: "Nova observação" },
    { name: "entry_date", type: "date", required: false, description: "Nova data (YYYY-MM-DD)" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Módulo: <code className="bg-muted px-1 rounded">kpis</code> — Novas ações</h3>
      </div>

      {/* Update KPI definition */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Editar KPI</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EndpointBadge method="POST" path={`${API_URL}?module=kpis&action=update&id=<uuid>`} />
          <FieldsTable fields={updateKpiFields} />
          <CodeBlock language="bash" code={`curl -X POST '${API_URL}?module=kpis&action=update&id=UUID_DO_KPI' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: SUA_API_KEY' \\
  -d '{"name": "Vendas Ativas", "target_value": 50, "is_active": true}'`} />
          <CodeBlock language="json" code={`{ "data": { "id": "uuid...", "name": "Vendas Ativas", "target_value": 50, "is_active": true, ... } }`} />
        </CardContent>
      </Card>

      {/* Update KPI entry */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Editar Lançamento de KPI</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EndpointBadge method="POST" path={`${API_URL}?module=kpis&action=update_entry&id=<uuid>`} />
          <p className="text-xs text-muted-foreground">Edita um lançamento existente pelo seu <code>id</code>. Para criar ou substituir um lançamento, use <code>action=create_entry</code>.</p>
          <FieldsTable fields={updateEntryFields} />
          <CodeBlock language="bash" code={`curl -X POST '${API_URL}?module=kpis&action=update_entry&id=UUID_DO_LANCAMENTO' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: SUA_API_KEY' \\
  -d '{"value": 42, "observations": "Corrigido"}'`} />
          <CodeBlock language="json" code={`{ "data": { "id": "uuid...", "value": 42, "observations": "Corrigido", ... } }`} />
        </CardContent>
      </Card>
    </div>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export const CompanyStructureApiDocs = () => (
  <div className="space-y-6">
    {/* Header */}
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-primary/10">
        <Code2 className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-bold">API — Estrutura Comercial & KPIs</h2>
        <p className="text-sm text-muted-foreground">
          Endpoints para gerenciar Unidades, Setores, Equipes, Vendedores e KPIs
        </p>
      </div>
    </div>

    {/* Auth note */}
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Key className="h-4 w-4" /> Autenticação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Todos os endpoints usam a mesma base URL da System API e aceitam autenticação via <code className="bg-muted px-1 rounded">x-api-key</code> ou <code className="bg-muted px-1 rounded">Authorization: Bearer &lt;jwt&gt;</code>.
        </p>
        <CodeBlock language="text" code={`Base URL: ${API_URL}
Header:   x-api-key: SUA_API_KEY
          Authorization: Bearer SEU_JWT`} />
      </CardContent>
    </Card>

    {/* Tabs por módulo */}
    <Tabs defaultValue="units">
      <TabsList className="grid w-full grid-cols-5 h-auto">
        <TabsTrigger value="units" className="gap-1 text-xs">
          <Building2 className="h-3 w-3" /> Unidades
        </TabsTrigger>
        <TabsTrigger value="sectors" className="gap-1 text-xs">
          <Layers className="h-3 w-3" /> Setores
        </TabsTrigger>
        <TabsTrigger value="teams" className="gap-1 text-xs">
          <Users className="h-3 w-3" /> Equipes
        </TabsTrigger>
        <TabsTrigger value="salespeople" className="gap-1 text-xs">
          <Briefcase className="h-3 w-3" /> Vendedores
        </TabsTrigger>
        <TabsTrigger value="kpis" className="gap-1 text-xs">
          <BarChart3 className="h-3 w-3" /> KPIs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="units" className="mt-4"><UnitsSection /></TabsContent>
      <TabsContent value="sectors" className="mt-4"><SectorsSection /></TabsContent>
      <TabsContent value="teams" className="mt-4"><TeamsSection /></TabsContent>
      <TabsContent value="salespeople" className="mt-4"><SalespeopleSection /></TabsContent>
      <TabsContent value="kpis" className="mt-4"><KpisSection /></TabsContent>
    </Tabs>
  </div>
);
