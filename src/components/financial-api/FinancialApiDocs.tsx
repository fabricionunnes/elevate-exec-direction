import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Code2, FileJson, Database, DollarSign, Building2, RefreshCw, CreditCard, Landmark, Plus, Trash2, Key, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/financial-api`;

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

const endpoints = [
  {
    name: "Resumo Financeiro",
    endpoint: "summary",
    icon: DollarSign,
    method: "GET",
    description: "Retorna um resumo completo: saldo bancário, recebíveis, contas a pagar, MRR e recorrências ativas.",
    params: [],
    example: `GET ${API_URL}?endpoint=summary`,
    response: `{
  "date": "2026-03-25",
  "bank_balance": {
    "total": 150000.00,
    "accounts": [
      { "id": "uuid", "name": "Conta Principal", "balance": 150000.00 }
    ]
  },
  "receivables": {
    "total_pending": 45000.00,
    "total_overdue": 12000.00,
    "received_this_month": 38000.00,
    "count_pending": 15,
    "count_overdue": 4
  },
  "payables": {
    "total_pending": 22000.00,
    "total_overdue": 3000.00,
    "count_pending": 8,
    "count_overdue": 2
  },
  "mrr": 65000.00,
  "active_recurring_charges": 42
}`,
  },
  {
    name: "Contas a Receber",
    endpoint: "receivables",
    icon: CreditCard,
    method: "GET",
    description: "Lista todas as faturas/contas a receber com filtros por status, data e empresa.",
    params: [
      { name: "status", desc: "pending, paid, overdue, cancelled, partial", required: false },
      { name: "date_from", desc: "Data início (YYYY-MM-DD)", required: false },
      { name: "date_to", desc: "Data fim (YYYY-MM-DD)", required: false },
      { name: "company_id", desc: "UUID da empresa", required: false },
      { name: "limit", desc: "Máx. registros (padrão 500, máx 2000)", required: false },
      { name: "offset", desc: "Paginação (padrão 0)", required: false },
    ],
    example: `GET ${API_URL}?endpoint=receivables&status=pending&date_from=2026-01-01`,
    response: `{
  "data": [
    {
      "id": "uuid",
      "company_id": "uuid",
      "description": "Mensalidade Jan/2026",
      "amount": 5000.00,
      "due_date": "2026-01-15",
      "status": "pending",
      "paid_at": null,
      "paid_amount": null,
      "late_fee": 0,
      "interest": 0,
      "discount": 0,
      "total_with_fees": 5000.00,
      "payment_method": null,
      "installment_number": 1,
      "total_installments": 1
    }
  ],
  "pagination": { "limit": 500, "offset": 0 }
}`,
  },
  {
    name: "Contas a Pagar",
    endpoint: "payables",
    icon: Database,
    method: "GET",
    description: "Lista todas as contas a pagar com filtros por status e período.",
    params: [
      { name: "status", desc: "pending, paid, overdue, cancelled", required: false },
      { name: "date_from", desc: "Data início (YYYY-MM-DD)", required: false },
      { name: "date_to", desc: "Data fim (YYYY-MM-DD)", required: false },
      { name: "limit", desc: "Máx. registros (padrão 500, máx 2000)", required: false },
      { name: "offset", desc: "Paginação (padrão 0)", required: false },
    ],
    example: `GET ${API_URL}?endpoint=payables&status=pending`,
    response: `{
  "data": [
    {
      "id": "uuid",
      "supplier_name": "Fornecedor XYZ",
      "description": "Aluguel escritório",
      "amount": 8500.00,
      "due_date": "2026-03-10",
      "status": "pending",
      "paid_date": null,
      "paid_amount": null,
      "payment_method": "pix",
      "cost_type": "fixed"
    }
  ],
  "pagination": { "limit": 500, "offset": 0 }
}`,
  },
  {
    name: "Contas Bancárias",
    endpoint: "banks",
    icon: Landmark,
    method: "GET",
    description: "Lista todas as contas bancárias com saldos atuais.",
    params: [],
    example: `GET ${API_URL}?endpoint=banks`,
    response: `{
  "data": [
    {
      "id": "uuid",
      "name": "Conta Principal",
      "bank_code": "341",
      "agency": "1234",
      "account_number": "56789-0",
      "initial_balance": 100000.00,
      "current_balance": 150000.00,
      "is_active": true
    }
  ]
}`,
  },
  {
    name: "Transações Bancárias",
    endpoint: "transactions",
    icon: RefreshCw,
    method: "GET",
    description: "Lista o extrato de transações bancárias (créditos e débitos).",
    params: [
      { name: "date_from", desc: "Data início (YYYY-MM-DD)", required: false },
      { name: "date_to", desc: "Data fim (YYYY-MM-DD)", required: false },
      { name: "limit", desc: "Máx. registros (padrão 500, máx 2000)", required: false },
      { name: "offset", desc: "Paginação (padrão 0)", required: false },
    ],
    example: `GET ${API_URL}?endpoint=transactions&date_from=2026-03-01`,
    response: `{
  "data": [
    {
      "id": "uuid",
      "bank_id": "uuid",
      "type": "credit",
      "amount": 5000.00,
      "description": "Pagamento fatura #123",
      "reference_type": "invoice",
      "reference_id": "uuid",
      "discount": 0,
      "interest": 0,
      "fee": 1.99
    }
  ],
  "pagination": { "limit": 500, "offset": 0 }
}`,
  },
  {
    name: "Recorrências",
    endpoint: "recurring",
    icon: RefreshCw,
    method: "GET",
    description: "Lista as cobranças recorrentes ativas.",
    params: [
      { name: "company_id", desc: "UUID da empresa (opcional)", required: false },
    ],
    example: `GET ${API_URL}?endpoint=recurring`,
    response: `{
  "data": [
    {
      "id": "uuid",
      "company_id": "uuid",
      "description": "Mensalidade Consultoria",
      "amount": 5000.00,
      "recurrence": "monthly",
      "next_charge_date": "2026-04-01",
      "is_active": true,
      "customer_name": "Empresa XYZ"
    }
  ]
}`,
  },
  {
    name: "Empresas (Financeiro)",
    endpoint: "companies",
    icon: Building2,
    method: "GET",
    description: "Lista empresas com dados financeiros básicos (valor contrato, segmento, etc.).",
    params: [
      { name: "status", desc: "active, inactive, churned", required: false },
    ],
    example: `GET ${API_URL}?endpoint=companies&status=active`,
    response: `{
  "data": [
    {
      "id": "uuid",
      "name": "Empresa ABC",
      "status": "active",
      "contract_value": 5000,
      "segment": "Tecnologia",
      "billing_day": 10,
      "contact_email": "financeiro@abc.com",
      "cnpj": "12.345.678/0001-00"
    }
  ]
}`,
  },
];

function ApiKeyManager() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const fetchKeys = async () => {
    const { data } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
    setKeys(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const createKey = async () => {
    if (!newKeyName.trim()) { toast.error("Informe um nome para a chave"); return; }
    setCreating(true);
    const { error } = await supabase.from("api_keys").insert({ name: newKeyName.trim() } as any);
    if (error) { toast.error("Erro ao criar chave"); console.error(error); }
    else { toast.success("Chave criada!"); setNewKeyName(""); await fetchKeys(); }
    setCreating(false);
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Chave excluída"); await fetchKeys(); }
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Nome da chave (ex: Integração ERP)"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={createKey} disabled={creating} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Criar Chave
        </Button>
      </div>

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma chave API criada ainda.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Nome</th>
                <th className="text-left px-3 py-2 font-medium">Chave</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Criada em</th>
                <th className="text-right px-3 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{k.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <span>{visibleKeys.has(k.id) ? k.key : `${k.key?.slice(0, 8)}${"•".repeat(20)}`}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleVisibility(k.id)}>
                        {visibleKeys.has(k.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(k.key); toast.success("Chave copiada!"); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={k.is_active ? "default" : "secondary"} className="text-[10px]">
                      {k.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {new Date(k.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir chave "{k.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>Integrações usando esta chave deixarão de funcionar imediatamente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteKey(k.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function FinancialApiDocs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Code2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">API Financeira</h2>
          <p className="text-sm text-muted-foreground">
            Acesse todos os dados financeiros programaticamente
          </p>
        </div>
      </div>

      {/* API Keys Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Chaves de API
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApiKeyManager />
        </CardContent>
      </Card>

      {/* Auth */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Autenticação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Todas as requisições devem incluir autenticação via um dos métodos:
          </p>
          <div className="space-y-2">
            <div>
              <Badge variant="outline" className="mb-1">Opção 1: Bearer Token</Badge>
              <CodeBlock code={`Authorization: Bearer <seu_token_jwt>`} language="header" />
            </div>
            <div>
              <Badge variant="outline" className="mb-1">Opção 2: API Key</Badge>
              <CodeBlock code={`x-api-key: <sua_chave_api>`} language="header" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Também envie o header <code className="bg-muted px-1 rounded">apikey</code> com a chave pública do projeto.
          </p>
        </CardContent>
      </Card>

      {/* Base URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">URL Base</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={API_URL} language="url" />
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Tabs defaultValue="summary">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {endpoints.map((ep) => (
            <TabsTrigger key={ep.endpoint} value={ep.endpoint} className="text-xs gap-1.5">
              <ep.icon className="h-3.5 w-3.5" />
              {ep.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {endpoints.map((ep) => (
          <TabsContent key={ep.endpoint} value={ep.endpoint} className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">{ep.method}</Badge>
                  <CardTitle className="text-base">{ep.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{ep.description}</p>

                {ep.params.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Parâmetros (Query String)</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Parâmetro</th>
                            <th className="text-left px-3 py-2 font-medium">Descrição</th>
                            <th className="text-left px-3 py-2 font-medium">Obrigatório</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ep.params.map((p) => (
                            <tr key={p.name} className="border-t">
                              <td className="px-3 py-2 font-mono text-primary">{p.name}</td>
                              <td className="px-3 py-2 text-muted-foreground">{p.desc}</td>
                              <td className="px-3 py-2">
                                <Badge variant={p.required ? "default" : "secondary"} className="text-[10px]">
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
                  <h4 className="text-sm font-medium mb-2">Exemplo de Requisição</h4>
                  <CodeBlock code={ep.example} language="http" />
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Exemplo de Resposta</h4>
                  <CodeBlock code={ep.response} language="json" />
                </div>

                {/* cURL example */}
                <div>
                  <h4 className="text-sm font-medium mb-2">cURL</h4>
                  <CodeBlock
                    code={`curl -X GET "${ep.example.replace("GET ", "")}" \\
  -H "apikey: SUA_CHAVE_PUBLICA" \\
  -H "Authorization: Bearer SEU_TOKEN"`}
                    language="bash"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
