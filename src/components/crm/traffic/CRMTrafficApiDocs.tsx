import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Check,
  Code2,
  Database,
  RefreshCw,
  Link2,
  AlertTriangle,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SYNC_URL = `${SUPABASE_URL}/functions/v1/crm-meta-ads-sync`;
const REST_BASE = `${SUPABASE_URL}/rest/v1`;

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

const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>
);

const Endpoint = ({
  method,
  path,
  description,
}: {
  method: string;
  path: string;
  description?: string;
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
    <Badge
      variant={method === "POST" ? "default" : "secondary"}
      className="font-mono text-[10px] w-fit"
    >
      {method}
    </Badge>
    <code className="text-xs font-mono break-all flex-1">{path}</code>
    {description && (
      <span className="text-xs text-muted-foreground">{description}</span>
    )}
  </div>
);

// ---------- Examples ----------

const AUTH_URL_BODY = `{
  "action": "auth_url",
  "tenant_id": "uuid-do-tenant",
  "redirect_uri": "https://elevate-exec-direction.lovable.app/meta-ads-callback",
  "return_origin": "https://app.unvholdings.com.br/#/crm/trafego-pago"
}`;

const CONNECT_BODY = `{
  "action": "connect",
  "code": "CODE_RETORNADO_PELO_FACEBOOK",
  "redirect_uri": "https://elevate-exec-direction.lovable.app/meta-ads-callback"
}`;

const SAVE_BODY = `{
  "action": "save_connection",
  "tenant_id": "uuid-do-tenant",
  "ad_account_id": "act_1234567890",
  "ad_account_name": "Minha Conta de Anúncios",
  "access_token": "TOKEN_LONGO_DO_FACEBOOK",
  "expires_at": "2026-05-01T00:00:00Z",
  "user_id": "uuid-do-staff"
}`;

const SYNC_BODY = `{
  "action": "sync",
  "account_id": "uuid-da-conta-em-crm_meta_ads_accounts",
  "days": 30
}`;

const DISCONNECT_BODY = `{
  "action": "disconnect",
  "account_id": "uuid-da-conta"
}`;

const SYNC_RESPONSE = `{
  "success": true,
  "campaigns": 12,
  "adsets": 38,
  "ads": 104,
  "range": { "since": "2026-04-08", "until": "2026-05-08" }
}`;

const SYNC_CURL = `curl -X POST '${SYNC_URL}' \\
  -H 'Authorization: Bearer SEU_JWT_DE_USUARIO' \\
  -H 'apikey: ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.slice(0, 20) ?? "SUPABASE_ANON_KEY"}...' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "action": "sync",
    "account_id": "uuid-da-conta",
    "days": 30
  }'`;

const READ_CAMPAIGNS_CURL = `curl -G '${REST_BASE}/crm_meta_ads_campaigns' \\
  -H 'Authorization: Bearer SEU_JWT_DE_USUARIO' \\
  -H 'apikey: SUPABASE_ANON_KEY' \\
  --data-urlencode 'select=campaign_name,spend,clicks,leads,conversions,date_start,date_stop' \\
  --data-urlencode 'date_start=gte.2026-04-01' \\
  --data-urlencode 'date_stop=lte.2026-04-30' \\
  --data-urlencode 'order=spend.desc'`;

const READ_JS = `import { supabase } from "@/integrations/supabase/client";

// Buscar performance de campanhas no mês corrente
const { data, error } = await supabase
  .from("crm_meta_ads_campaigns")
  .select("campaign_name, spend, clicks, leads, conversions, date_start, date_stop")
  .gte("date_start", "2026-05-01")
  .lte("date_stop",  "2026-05-31")
  .order("spend", { ascending: false });

// Agregar por campanha (já vem 1 linha por dia/campanha)
const totals = (data ?? []).reduce((acc, row) => {
  const key = row.campaign_name ?? "—";
  acc[key] = acc[key] ?? { spend: 0, clicks: 0, leads: 0, conversions: 0 };
  acc[key].spend       += Number(row.spend       ?? 0);
  acc[key].clicks      += Number(row.clicks      ?? 0);
  acc[key].leads       += Number(row.leads       ?? 0);
  acc[key].conversions += Number(row.conversions ?? 0);
  return acc;
}, {} as Record<string, any>);`;

const SYNC_JS = `import { supabase } from "@/integrations/supabase/client";

const { data, error } = await supabase.functions.invoke("crm-meta-ads-sync", {
  body: { action: "sync", account_id: "uuid-da-conta", days: 30 }
});`;

const SCHEMA_ACCOUNTS = `crm_meta_ads_accounts
├── id                uuid PK
├── tenant_id         uuid          → multi-tenant
├── ad_account_id     text          → "act_XXXXXXXX" (Meta)
├── ad_account_name   text
├── access_token      text          → token long-lived
├── token_expires_at  timestamptz
├── is_connected      boolean
├── last_synced_at    timestamptz
└── connected_by      uuid          → onboarding_staff.id`;

const SCHEMA_METRICS = `crm_meta_ads_campaigns / _adsets / _ads
├── tenant_id, account_id           → escopo
├── campaign_id / adset_id / ad_id  → ID nativo Meta
├── *_name, status, objective       → metadados
├── daily_budget, lifetime_budget   → R$ (já dividido por 100)
│
├── impressions, reach, clicks      → bigint
├── spend                           → numeric (R$)
├── cpc, cpm, ctr, frequency        → numeric
├── leads                           → soma de actions[lead, fb_pixel_lead]
├── conversions                     → soma de actions[purchase, complete_registration]
├── conversion_value                → soma de action_values[purchase] (R$)
│
├── date_start, date_stop           → date  (1 linha por DIA)
└── synced_at                       → timestamptz da última sync`;

const ACTIONS = [
  { action: "auth_url",        purpose: "Gera URL OAuth do Facebook para o usuário autorizar a conta de anúncios" },
  { action: "connect",         purpose: "Troca o code do OAuth por access_token e lista as ad accounts disponíveis" },
  { action: "save_connection", purpose: "Persiste a conta escolhida e desativa qualquer outra conta do mesmo tenant" },
  { action: "sync",            purpose: "Busca campanhas/adsets/ads + insights diários e faz upsert nas tabelas do CRM" },
  { action: "disconnect",      purpose: "Marca a conta como inativa (mantém histórico)" },
];

export const CRMTrafficApiDocs = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">API · Tráfego Pago (Meta Ads)</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Integração interna do CRM Comercial para puxar dados do Meta Ads Graph API,
          armazenar métricas por dia em tabelas próprias e expor leitura via Supabase REST.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="outline">Multi-tenant</Badge>
          <Badge variant="outline">OAuth Meta v21</Badge>
          <Badge variant="outline">Breakdown diário (time_increment=1)</Badge>
          <Badge variant="outline">Upsert idempotente</Badge>
        </div>
      </div>

      {/* Visão geral */}
      <Section icon={Code2} title="Visão geral">
        <p className="text-sm text-muted-foreground">
          O dashboard é alimentado por uma <strong>Edge Function única</strong> (
          <code className="text-xs">crm-meta-ads-sync</code>) com múltiplas
          <em> actions</em>. A leitura dos dados pode ser feita diretamente na API REST do
          Supabase, respeitando as RLS por tenant.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Endpoint de escrita / sync
            </p>
            <code className="text-xs font-mono break-all">{SYNC_URL}</code>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Endpoint de leitura (REST)
            </p>
            <code className="text-xs font-mono break-all">
              {REST_BASE}/crm_meta_ads_&#123;campaigns | adsets | ads&#125;
            </code>
          </div>
        </div>
      </Section>

      {/* Auth */}
      <Section icon={ShieldCheck} title="Autenticação">
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>
            Toda chamada exige <strong>JWT do usuário</strong> logado no CRM (header{" "}
            <code className="text-xs">Authorization: Bearer …</code>) + a{" "}
            <code className="text-xs">apikey</code> (anon key) do Supabase.
          </li>
          <li>
            A função usa internamente <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            para gravar nas tabelas; o cliente nunca recebe esse token.
          </li>
          <li>
            O <strong>access_token do Facebook</strong> é armazenado em{" "}
            <code className="text-xs">crm_meta_ads_accounts.access_token</code> e nunca é
            exposto via REST (RLS bloqueia leitura da coluna).
          </li>
          <li>
            Escopos OAuth solicitados: <code className="text-xs">ads_read</code>,{" "}
            <code className="text-xs">ads_management</code>,{" "}
            <code className="text-xs">business_management</code>,{" "}
            <code className="text-xs">instagram_basic</code>,{" "}
            <code className="text-xs">instagram_manage_insights</code>.
          </li>
        </ul>
      </Section>

      {/* Actions */}
      <Section icon={Link2} title="Actions disponíveis">
        <Endpoint method="POST" path="/functions/v1/crm-meta-ads-sync" description="Roteador único" />
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">action</th>
                <th className="px-3 py-2 font-medium">O que faz</th>
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map((a) => (
                <tr key={a.action} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{a.action}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{a.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            1 · auth_url — gera link de autorização
          </p>
          <CodeBlock code={AUTH_URL_BODY} />

          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
            2 · connect — troca code por token e lista ad accounts
          </p>
          <CodeBlock code={CONNECT_BODY} />

          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
            3 · save_connection — persiste a conta escolhida
          </p>
          <CodeBlock code={SAVE_BODY} />

          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
            4 · sync — busca dados do Meta e popula as tabelas
          </p>
          <CodeBlock code={SYNC_BODY} />
          <p className="text-xs text-muted-foreground">
            Resposta de sucesso:
          </p>
          <CodeBlock code={SYNC_RESPONSE} />

          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
            5 · disconnect — desativa a conta
          </p>
          <CodeBlock code={DISCONNECT_BODY} />
        </div>
      </Section>

      {/* Exemplos sync */}
      <Section icon={RefreshCw} title="Exemplos · disparar sync">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">cURL</p>
        <CodeBlock code={SYNC_CURL} language="bash" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
          JavaScript (Supabase SDK)
        </p>
        <CodeBlock code={SYNC_JS} language="ts" />
      </Section>

      {/* Leitura */}
      <Section icon={Database} title="Leitura · consumir métricas do dashboard">
        <p className="text-sm text-muted-foreground">
          Use o cliente Supabase (ou REST direto) sobre as tabelas{" "}
          <code className="text-xs">crm_meta_ads_campaigns</code>,{" "}
          <code className="text-xs">crm_meta_ads_adsets</code> e{" "}
          <code className="text-xs">crm_meta_ads_ads</code>. Cada linha representa{" "}
          <strong>1 dia</strong> de performance, então sempre faça filtro por{" "}
          <code className="text-xs">date_start</code>/<code className="text-xs">date_stop</code> e
          agregue no cliente.
        </p>

        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
          cURL · campanhas do mês
        </p>
        <CodeBlock code={READ_CAMPAIGNS_CURL} language="bash" />

        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
          JavaScript · agregar performance por campanha
        </p>
        <CodeBlock code={READ_JS} language="ts" />
      </Section>

      {/* Schema */}
      <Section icon={Database} title="Schema das tabelas">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          crm_meta_ads_accounts (1 linha por conta conectada)
        </p>
        <CodeBlock code={SCHEMA_ACCOUNTS} language="text" />

        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
          crm_meta_ads_campaigns / _adsets / _ads (1 linha por dia)
        </p>
        <CodeBlock code={SCHEMA_METRICS} language="text" />

        <p className="text-xs text-muted-foreground pt-1">
          Chaves de upsert:
          <br />• campaigns: <code className="text-xs">(account_id, campaign_id, date_start, date_stop)</code>
          <br />• adsets: <code className="text-xs">(account_id, adset_id, date_start, date_stop)</code>
          <br />• ads: <code className="text-xs">(account_id, ad_id, date_start, date_stop)</code>
        </p>
      </Section>

      {/* Mapeamento de actions */}
      <Section icon={BarChart3} title="Como leads e conversões são extraídos">
        <p className="text-sm text-muted-foreground">
          O Meta retorna um array <code className="text-xs">actions[]</code> heterogêneo. A função
          soma os seguintes <code className="text-xs">action_type</code> em cada métrica:
        </p>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <p className="font-semibold mb-1">leads</p>
            <code className="block">lead</code>
            <code className="block">onsite_conversion.lead_grouped</code>
            <code className="block">offsite_conversion.fb_pixel_lead</code>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <p className="font-semibold mb-1">conversions</p>
            <code className="block">purchase</code>
            <code className="block">offsite_conversion.fb_pixel_purchase</code>
            <code className="block">onsite_conversion.purchase</code>
            <code className="block">complete_registration</code>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/30 sm:col-span-2">
            <p className="font-semibold mb-1">conversion_value (R$)</p>
            <code className="block">purchase</code>
            <code className="block">offsite_conversion.fb_pixel_purchase</code>
            <code className="block">onsite_conversion.purchase</code>
          </div>
        </div>
      </Section>

      {/* Erros */}
      <Section icon={AlertTriangle} title="Erros comuns">
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>
            <strong>OAuth falhou</strong> — code expirou (≤ 60s) ou{" "}
            <code className="text-xs">redirect_uri</code> diferente do registrado no app Meta.
          </li>
          <li>
            <strong>Conta não encontrada</strong> — <code className="text-xs">account_id</code>{" "}
            inexistente em <code className="text-xs">crm_meta_ads_accounts</code> ou pertence a outro
            tenant.
          </li>
          <li>
            <strong>Token expirado</strong> — refazer o fluxo <code className="text-xs">auth_url</code>{" "}
            → <code className="text-xs">connect</code> → <code className="text-xs">save_connection</code>.
          </li>
          <li>
            <strong>Sync vazio</strong> — conta sem campanhas no período ou{" "}
            <code className="text-xs">days</code> muito pequeno (default 30).
          </li>
        </ul>
      </Section>
    </div>
  );
};
