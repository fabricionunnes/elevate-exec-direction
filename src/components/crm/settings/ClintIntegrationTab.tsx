import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, X, RefreshCw, ExternalLink, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Pipeline {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  name: string;
  pipeline_id: string;
}

interface SyncLog {
  id: string;
  crm_lead_id: string | null;
  clint_contact_id: string | null;
  clint_deal_id: string | null;
  sync_direction: string;
  sync_status: string;
  error_message: string | null;
  synced_at: string;
}

export const ClintIntegrationTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Form
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncDirection, setSyncDirection] = useState("bidirectional");
  const [defaultPipelineId, setDefaultPipelineId] = useState("");
  const [defaultStageId, setDefaultStageId] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clint-webhook`;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, pipelinesRes, stagesRes, logsRes] = await Promise.all([
        supabase.from("crm_clint_config").select("*").limit(1).maybeSingle(),
        supabase.from("crm_pipelines").select("id, name").eq("is_active", true),
        supabase.from("crm_stages").select("id, name, pipeline_id").order("sort_order"),
        supabase.from("crm_clint_sync_log").select("*").order("synced_at", { ascending: false }).limit(50),
      ]);

      setPipelines(pipelinesRes.data || []);
      setStages(stagesRes.data || []);
      setSyncLogs(logsRes.data || []);

      if (configRes.data) {
        setConfig(configRes.data);
        setSyncEnabled(configRes.data.sync_enabled);
        setSyncDirection(configRes.data.sync_direction);
        setDefaultPipelineId(configRes.data.default_pipeline_id || "");
        setDefaultStageId(configRes.data.default_stage_id || "");
        setWebhookSecret(configRes.data.webhook_secret || "");
      }
    } catch (error) {
      console.error("Error loading Clint config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        sync_enabled: syncEnabled,
        sync_direction: syncDirection,
        default_pipeline_id: defaultPipelineId || null,
        default_stage_id: defaultStageId || null,
        webhook_secret: webhookSecret || null,
        updated_at: new Date().toISOString(),
      };

      if (config?.id) {
        const { error } = await supabase
          .from("crm_clint_config")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("crm_clint_config")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setConfig(data);
      }

      toast.success("Configuração salva com sucesso");
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("clint-sync", {
        body: { lead_id: "test", action: "test_connection" },
      });

      if (error) throw error;

      if (data?.skipped) {
        toast.info("Sincronização está desabilitada. Ative-a primeiro.");
      } else if (data?.error) {
        toast.error(`Erro: ${data.error}`);
      } else {
        toast.success("Conexão com a Clint OK!");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada!");
  };

  const filteredStages = stages.filter((s) => s.pipeline_id === defaultPipelineId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔗 Integração com a Clint
          </CardTitle>
          <CardDescription>
            Sincronize contatos e negócios entre o CRM Comercial e a Clint automaticamente.
            Requer plano Elite da Clint.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sync Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">Sincronização ativa</p>
              <p className="text-sm text-muted-foreground">
                {syncEnabled ? "Dados estão sendo sincronizados" : "Sincronização pausada"}
              </p>
            </div>
            <Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} />
          </div>

          {/* Direction */}
          <div className="space-y-2">
            <Label>Direção da sincronização</Label>
            <Select value={syncDirection} onValueChange={setSyncDirection}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bidirectional">↔ Bidirecional</SelectItem>
                <SelectItem value="clint_to_crm">→ Clint → CRM (apenas receber)</SelectItem>
                <SelectItem value="crm_to_clint">← CRM → Clint (apenas enviar)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Default Pipeline */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Pipeline padrão (leads da Clint)</Label>
              <Select value={defaultPipelineId} onValueChange={setDefaultPipelineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Etapa inicial (leads da Clint)</Label>
              <Select value={defaultStageId} onValueChange={setDefaultStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredStages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Webhook Secret */}
          <div className="space-y-2">
            <Label>Webhook Secret (opcional)</Label>
            <Input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Senha para validar webhooks da Clint"
            />
            <p className="text-xs text-muted-foreground">
              Se configurado, a Clint deve enviar este valor no header <code>x-webhook-secret</code>.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar configuração
            </Button>
            <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
              {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Testar conexão
            </Button>
          </div>

          {config?.last_sync_at && (
            <p className="text-sm text-muted-foreground">
              Última sincronização: {format(new Date(config.last_sync_at), "dd/MM/yyyy HH:mm")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Webhook URL Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">URL do Webhook</CardTitle>
          <CardDescription>
            Configure esta URL na Clint (Configurações → Webhooks) para receber dados automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Como configurar na Clint:</p>
                <ol className="mt-1 text-amber-700 dark:text-amber-300 space-y-1 list-decimal list-inside">
                  <li>Acesse sua conta Clint → Configurações → Webhooks</li>
                  <li>Cole a URL acima como endpoint</li>
                  <li>Selecione os eventos: contato criado/atualizado, deal criado/atualizado</li>
                  <li>Salve e ative o webhook</li>
                </ol>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Log de sincronização</CardTitle>
            <CardDescription>Últimas 50 sincronizações</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={loadData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {syncLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma sincronização registrada ainda.
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 p-3 rounded-lg border text-sm"
                >
                  {log.sync_status === "success" ? (
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={log.sync_direction === "clint_to_crm" ? "default" : "secondary"} className="text-xs">
                        {log.sync_direction === "clint_to_crm" ? "Clint → CRM" : "CRM → Clint"}
                      </Badge>
                      {log.clint_contact_id && (
                        <span className="text-xs text-muted-foreground">
                          Contato: {log.clint_contact_id.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-red-500 mt-1 truncate">{log.error_message}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.synced_at), "dd/MM HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
