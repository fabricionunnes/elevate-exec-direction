import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Code2, FileJson, Database, DollarSign, Building2, RefreshCw, CreditCard, Landmark, Plus, Trash2, Key, Eye, EyeOff, Loader2, Users, Truck, Tag, Target, FileText, Link2, Bell, AlertTriangle, BarChart3, TrendingUp } from "lucide-react";
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

const SYSTEM_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/system-api`;

const readEndpoints = [
  {
    name: "Resumo Financeiro",
    endpoint: "summary",
    icon: DollarSign,
    method: "GET",
    description: "Retorna um resumo completo: saldo bancário, recebíveis, contas a pagar, MRR e recorrências ativas.",
    params: [],
    example: `GET ${API_URL}?endpoint=summary`,
    response: `{
  "bank_balance": { "total": 150000.00, "accounts": [...] },
  "receivables": { "total_pending": 45000.00, "total_overdue": 12000.00 },
  "payables": { "total_pending": 22000.00, "total_overdue": 3000.00 },
  "mrr": 65000.00
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
    response: `{ "data": [{ "id": "uuid", "name": "Conta Principal", "current_balance": 150000.00 }] }`,
  },
  {
    name: "Transações",
    endpoint: "transactions",
    icon: RefreshCw,
    method: "GET",
    description: "Lista o extrato de transações bancárias.",
    params: [
      { name: "date_from", desc: "Data início (YYYY-MM-DD)", required: false },
      { name: "date_to", desc: "Data fim (YYYY-MM-DD)", required: false },
    ],
    example: `GET ${API_URL}?endpoint=transactions&date_from=2026-03-01`,
    response: `{ "data": [{ "type": "credit", "amount": 5000.00, "description": "Pagamento fatura" }] }`,
  },
  {
    name: "Recorrências",
    endpoint: "recurring",
    icon: RefreshCw,
    method: "GET",
    description: "Lista cobranças recorrentes ativas.",
    params: [{ name: "company_id", desc: "UUID da empresa", required: false }],
    example: `GET ${API_URL}?endpoint=recurring`,
    response: `{ "data": [{ "description": "Mensalidade", "amount": 5000.00, "recurrence": "monthly" }] }`,
  },
  {
    name: "DRE",
    endpoint: "dre",
    icon: FileText,
    method: "GET",
    description: "Demonstrativo de Resultado do Exercício.",
    params: [{ name: "date_from", desc: "Ano de referência (YYYY-01-01)", required: false }],
    example: `GET ${API_URL}?endpoint=dre&date_from=2026-01-01`,
    response: `{ "year": 2026, "realized": { "revenue": 450000, "expenses": 280000, "profit": 170000 } }`,
  },
  {
    name: "Fluxo de Caixa",
    endpoint: "cashflow",
    icon: TrendingUp,
    method: "GET",
    description: "Projeção de fluxo de caixa.",
    params: [
      { name: "date_from", desc: "Data início", required: false },
      { name: "date_to", desc: "Data fim", required: false },
    ],
    example: `GET ${API_URL}?endpoint=cashflow`,
    response: `{ "current_balance": 150000, "projection": [{ "month": "2026-01", "net": 40000 }] }`,
  },
  {
    name: "Inadimplentes",
    endpoint: "overdue_clients",
    icon: AlertTriangle,
    method: "GET",
    description: "Clientes com faturas em atraso.",
    params: [],
    example: `GET ${API_URL}?endpoint=overdue_clients`,
    response: `{ "data": [{ "company_name": "Empresa ABC", "total_overdue": 15000 }], "total_overdue": 75000 }`,
  },
  {
    name: "Cobranças (com link de pagamento)",
    endpoint: "receivables",
    icon: Link2,
    method: "GET",
    description: "Lista cobranças de uma empresa com o link de pagamento de cada uma. Ideal para enviar via WhatsApp ou N8N.",
    params: [
      { name: "company_id", desc: "UUID da empresa (obrigatório para filtrar por cliente)", required: true },
      { name: "status", desc: "pending, paid, overdue, cancelled", required: false },
      { name: "date_from", desc: "Vencimento a partir de (YYYY-MM-DD)", required: false },
      { name: "date_to", desc: "Vencimento até (YYYY-MM-DD)", required: false },
    ],
    example: `GET ${SYSTEM_API_URL}?module=invoices&action=list&company_id=UUID&status=pending`,
    response: `{
  "data": [
    {
      "id": "uuid",
      "description": "Mensalidade Maio/2026",
      "amount_cents": 700000,
      "amount": 7000.00,
      "due_date": "2026-05-15",
      "status": "pending",
      "payment_link_url": "https://link-de-pagamento...",
      "payment_method": "pix",
      "installment_number": 5,
      "total_installments": 12
    }
  ]
}`,
  },
];

const writeEndpoints = [
  {
    name: "Criar Conta a Receber",
    module: "receivables",
    action: "create",
    method: "POST",
    icon: CreditCard,
    description: "Cria uma nova conta a receber no financeiro.",
    bodyFields: [
      { name: "description", type: "string", required: true, desc: "Descrição do recebível" },
      { name: "amount", type: "number", required: true, desc: "Valor em reais (ex: 1500.00)" },
      { name: "due_date", type: "string", required: true, desc: "Data de vencimento (YYYY-MM-DD)" },
      { name: "company_id", type: "uuid", required: false, desc: "UUID da empresa (se vinculado)" },
      { name: "custom_receiver_name", type: "string", required: false, desc: "Nome do cliente (se sem empresa)" },
      { name: "payment_method", type: "string", required: false, desc: "pix, boleto, credit_card, transfer" },
      { name: "category_id", type: "uuid", required: false, desc: "UUID da categoria financeira" },
      { name: "bank_account_id", type: "uuid", required: false, desc: "UUID da conta bancária" },
      { name: "notes", type: "string", required: false, desc: "Observações" },
    ],
    example: `curl -X POST "${SYSTEM_API_URL}?module=receivables&action=create" \\
  -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"description":"Consultoria Mar/2026","amount":5000,"due_date":"2026-03-31","custom_receiver_name":"Cliente XYZ"}'`,
    response: `{ "data": { "id": "uuid", "description": "Consultoria Mar/2026", "amount": 5000, "status": "pending" } }`,
  },
  {
    name: "Marcar Recebível como Pago",
    module: "receivables",
    action: "mark_paid",
    method: "POST",
    icon: Check,
    description: "Dá baixa em uma conta a receber. Se informar bank_id, credita o saldo automaticamente.",
    bodyFields: [
      { name: "id (query)", type: "uuid", required: true, desc: "UUID do recebível (na query string)" },
      { name: "paid_amount", type: "number", required: false, desc: "Valor pago (padrão: valor total)" },
      { name: "paid_date", type: "string", required: false, desc: "Data do pagamento (YYYY-MM-DD)" },
      { name: "bank_id", type: "uuid", required: false, desc: "UUID do banco para creditar saldo" },
      { name: "payment_method", type: "string", required: false, desc: "Método de pagamento" },
      { name: "discount_amount", type: "number", required: false, desc: "Valor do desconto" },
      { name: "interest_amount", type: "number", required: false, desc: "Valor dos juros" },
    ],
    example: `curl -X POST "${SYSTEM_API_URL}?module=receivables&action=mark_paid&id=UUID" \\
  -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"bank_id":"uuid-banco","payment_method":"pix"}'`,
    response: `{ "data": { "id": "uuid", "status": "paid", "paid_amount": 5000 }, "bank_credited": true }`,
  },
  {
    name: "Reverter Pagamento (Recebível)",
    module: "receivables",
    action: "mark_unpaid",
    method: "POST",
    icon: RefreshCw,
    description: "Reverte o status de um recebível para pendente.",
    bodyFields: [
      { name: "id (query)", type: "uuid", required: true, desc: "UUID do recebível" },
    ],
    example: `curl -X POST "${SYSTEM_API_URL}?module=receivables&action=mark_unpaid&id=UUID" \\
  -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" -d '{}'`,
    response: `{ "data": { "id": "uuid", "status": "pending", "paid_amount": null } }`,
  },
  {
    name: "Criar Conta a Pagar",
    module: "payables",
    action: "create",
    method: "POST",
    icon: Database,
    description: "Cria uma nova conta a pagar para um fornecedor.",
    bodyFields: [
      { name: "supplier_name", type: "string", required: true, desc: "Nome do fornecedor" },
      { name: "description", type: "string", required: true, desc: "Descrição da despesa" },
      { name: "amount", type: "number", required: true, desc: "Valor em reais" },
      { name: "due_date", type: "string", required: true, desc: "Data de vencimento (YYYY-MM-DD)" },
      { name: "payment_method", type: "string", required: false, desc: "Método de pagamento" },
      { name: "category_id", type: "uuid", required: false, desc: "UUID da categoria" },
      { name: "bank_id", type: "uuid", required: false, desc: "UUID do banco" },
      { name: "cost_type", type: "string", required: false, desc: "fixed, variable" },
      { name: "notes", type: "string", required: false, desc: "Observações" },
    ],
    example: `curl -X POST "${SYSTEM_API_URL}?module=payables&action=create" \\
  -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"supplier_name":"Fornecedor ABC","description":"Aluguel escritório","amount":8500,"due_date":"2026-04-10"}'`,
    response: `{ "data": { "id": "uuid", "supplier_name": "Fornecedor ABC", "amount": 8500, "status": "pending" } }`,
  },
  {
    name: "Marcar Pagável como Pago",
    module: "payables",
    action: "mark_paid",
    method: "POST",
    icon: Check,
    description: "Dá baixa em uma conta a pagar. Se informar bank_id, debita o saldo automaticamente.",
    bodyFields: [
      { name: "id (query)", type: "uuid", required: true, desc: "UUID da conta a pagar" },
      { name: "paid_amount", type: "number", required: false, desc: "Valor pago (padrão: valor total)" },
      { name: "paid_date", type: "string", required: false, desc: "Data do pagamento" },
      { name: "bank_id", type: "uuid", required: false, desc: "UUID do banco para debitar" },
      { name: "payment_method", type: "string", required: false, desc: "Método de pagamento" },
    ],
    example: `curl -X POST "${SYSTEM_API_URL}?module=payables&action=mark_paid&id=UUID" \\
  -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"bank_id":"uuid-banco","payment_method":"transfer"}'`,
    response: `{ "data": { "id": "uuid", "status": "paid" }, "bank_debited": true }`,
  },
  {
    name: "Criar Fatura (Empresa)",
    module: "invoices",
    action: "create",
    method: "POST",
    icon: FileText,
    description: "Cria uma fatura vinculada a uma empresa.",
    bodyFields: [
      { name: "description", type: "string", required: true, desc: "Descrição da fatura" },
      { name: "amount_cents", type: "number", required: true, desc: "Valor em centavos (ex: 500000 = R$ 5.000)" },
      { name: "due_date", type: "string", required: true, desc: "Data de vencimento" },
      { name: "company_id", type: "uuid", required: false, desc: "UUID da empresa" },
      { name: "custom_receiver_name", type: "string", required: false, desc: "Nome do pagador (se sem empresa)" },
      { name: "payment_method", type: "string", required: false, desc: "Método de pagamento" },
      { name: "bank_id", type: "uuid", required: false, desc: "UUID do banco" },
      { name: "notes", type: "string", required: false, desc: "Observações" },
    ],
    example: `curl -X POST "${SYSTEM_API_URL}?module=invoices&action=create" \\
  -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"description":"Mensalidade Abr/2026","amount_cents":500000,"due_date":"2026-04-15","company_id":"uuid"}'`,
    response: `{ "data": { "id": "uuid", "amount_cents": 500000, "status": "pending" } }`,
  },
  {
    name: "Marcar Fatura como Paga",
    module: "invoices",
    action: "mark_paid",
    method: "POST",
    icon: Check,
    description: "Dá baixa em uma fatura. Credita banco automaticamente se bank_id informado.",
    bodyFields: [
      { name: "id (query)", type: "uuid", required: true, desc: "UUID da fatura" },
      { name: "paid_amount_cents", type: "number", required: false, desc: "Valor pago em centavos" },
      { name: "bank_id", type: "uuid", required: false, desc: "UUID do banco para creditar" },
      { name: "payment_method", type: "string", required: false, desc: "Método de pagamento" },
      { name: "late_fee_cents", type: "number", required: false, desc: "Multa em centavos" },
      { name: "interest_cents", type: "number", required: false, desc: "Juros em centavos" },
      { name: "discount_cents", type: "number", required: false, desc: "Desconto em centavos" },
    ],
    example: `curl -X POST "${SYSTEM_API_URL}?module=invoices&action=mark_paid&id=UUID" \\
  -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"bank_id":"uuid-banco"}'`,
    response: `{ "data": { "id": "uuid", "status": "paid" }, "bank_credited": true }`,
  },
  {
    name: "Criar Cobrança Asaas",
    module: "asaas",
    action: "create_charge",
    method: "POST",
    icon: CreditCard,
    description: "Cria uma cobrança no Asaas (PIX, Boleto ou Cartão). Retorna QR Code PIX, link de boleto ou status do cartão. Cria automaticamente um recebível no financeiro.",
    bodyFields: [
      { name: "customer_name", type: "string", required: true, desc: "Nome do cliente" },
      { name: "amount_cents", type: "number", required: true, desc: "Valor em centavos" },
      { name: "payment_method", type: "string", required: true, desc: "pix, boleto, credit_card" },
      { name: "customer_email", type: "string", required: false, desc: "E-mail do cliente" },
      { name: "customer_phone", type: "string", required: false, desc: "Telefone do cliente" },
      { name: "customer_document", type: "string", required: false, desc: "CPF ou CNPJ" },
      { name: "description", type: "string", required: false, desc: "Descrição da cobrança" },
      { name: "due_date", type: "string", required: false, desc: "Vencimento (YYYY-MM-DD, padrão: +3 dias)" },
      { name: "installments", type: "number", required: false, desc: "Parcelas (cartão, padrão: 1)" },
      { name: "company_id", type: "uuid", required: false, desc: "UUID da empresa vinculada" },
      { name: "create_receivable", type: "boolean", required: false, desc: "Criar recebível (padrão: true)" },
    ],
    example: `curl -X POST "${SYSTEM_API_URL}?module=asaas&action=create_charge" \\
  -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"customer_name":"João Silva","customer_document":"123.456.789-00","amount_cents":15000,"payment_method":"pix","description":"Serviço de consultoria"}'`,
    response: `{
  "success": true,
  "asaas_payment_id": "pay_abc123",
  "status": "PENDING",
  "billing_type": "PIX",
  "invoice_url": "https://www.asaas.com/i/...",
  "pix_qr_code": "00020126...",
  "pix_qr_code_base64": "iVBOR...",
  "receivable_id": "uuid"
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

      {/* Read Endpoints */}
      <h3 className="text-lg font-semibold mt-2">📊 Consultas (Leitura)</h3>
      <Tabs defaultValue="summary">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {readEndpoints.map((ep) => (
            <TabsTrigger key={ep.endpoint} value={ep.endpoint} className="text-xs gap-1.5">
              <ep.icon className="h-3.5 w-3.5" />
              {ep.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {readEndpoints.map((ep) => (
          <TabsContent key={ep.endpoint} value={ep.endpoint} className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{ep.method}</Badge>
                  <CardTitle className="text-base">{ep.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{ep.description}</p>
                {ep.params.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Parâmetros</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted"><tr><th className="text-left px-3 py-2">Parâmetro</th><th className="text-left px-3 py-2">Descrição</th></tr></thead>
                        <tbody>
                          {ep.params.map((p) => (
                            <tr key={p.name} className="border-t">
                              <td className="px-3 py-2 font-mono text-primary">{p.name}</td>
                              <td className="px-3 py-2 text-muted-foreground">{p.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-medium mb-2">Exemplo</h4>
                  <CodeBlock code={ep.example} language="http" />
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Resposta</h4>
                  <CodeBlock code={ep.response} language="json" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Write Endpoints */}
      <h3 className="text-lg font-semibold mt-6">✏️ Operações (Escrita)</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Todas as operações de escrita usam a URL: <code className="bg-muted px-1 rounded text-xs">{SYSTEM_API_URL}</code>
      </p>
      <Tabs defaultValue={writeEndpoints[0]?.action || "create"}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {writeEndpoints.map((ep, i) => (
            <TabsTrigger key={`${ep.module}-${ep.action}-${i}`} value={`${ep.module}-${ep.action}-${i}`} className="text-xs gap-1.5">
              <ep.icon className="h-3.5 w-3.5" />
              {ep.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {writeEndpoints.map((ep, i) => (
          <TabsContent key={`${ep.module}-${ep.action}-${i}`} value={`${ep.module}-${ep.action}-${i}`} className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20">{ep.method}</Badge>
                  <CardTitle className="text-base">{ep.name}</CardTitle>
                </div>
                <code className="text-xs text-muted-foreground">?module={ep.module}&action={ep.action}</code>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{ep.description}</p>
                <div>
                  <h4 className="text-sm font-medium mb-2">Campos do Body (JSON)</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-3 py-2">Campo</th>
                          <th className="text-left px-3 py-2">Tipo</th>
                          <th className="text-left px-3 py-2">Obrigatório</th>
                          <th className="text-left px-3 py-2">Descrição</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ep.bodyFields.map((f) => (
                          <tr key={f.name} className="border-t">
                            <td className="px-3 py-2 font-mono text-primary">{f.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{f.type}</td>
                            <td className="px-3 py-2">
                              <Badge variant={f.required ? "default" : "secondary"} className="text-[10px]">
                                {f.required ? "Sim" : "Não"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{f.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">cURL</h4>
                  <CodeBlock code={ep.example} language="bash" />
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Resposta</h4>
                  <CodeBlock code={ep.response} language="json" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
