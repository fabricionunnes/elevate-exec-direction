import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GroupSelector } from "@/components/whatsapp/GroupSelector";
import {
  Bell,
  MessageSquare,
  Users,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

interface WonNotificationConfig {
  enabled: boolean;
  instanceId: string | null;
  groupJid: string | null;
  groupName: string | null;
}

export const WonNotificationSettings = () => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [config, setConfig] = useState<WonNotificationConfig>({
    enabled: false,
    instanceId: null,
    groupJid: null,
    groupName: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showGroupSelector, setShowGroupSelector] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load WhatsApp instances
      const { data: instancesData } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, phone_number, status")
        .order("instance_name");

      setInstances(instancesData || []);

      // Load current settings
      const { data: settings } = await supabase
        .from("crm_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "won_notification_enabled",
          "won_notification_instance_id",
          "won_notification_group_jid",
          "won_notification_group_name",
        ]);

      if (settings) {
        const settingsMap = settings.reduce((acc, s) => {
          acc[s.setting_key] = s.setting_value as string;
          return acc;
        }, {} as Record<string, string>);

        setConfig({
          enabled: settingsMap["won_notification_enabled"] === "true",
          instanceId: settingsMap["won_notification_instance_id"] || null,
          groupJid: settingsMap["won_notification_group_jid"] || null,
          groupName: settingsMap["won_notification_group_name"] || null,
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from("crm_settings")
      .upsert({ setting_key: key, setting_value: value }, { onConflict: "setting_key" });
    if (error) throw error;
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    setSaving(true);
    try {
      await saveSetting("won_notification_enabled", enabled.toString());
      setConfig((prev) => ({ ...prev, enabled }));
      toast.success(enabled ? "Notificações ativadas" : "Notificações desativadas");
    } catch (error) {
      console.error("Error saving setting:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const handleInstanceChange = async (instanceId: string) => {
    setSaving(true);
    try {
      const actualId = instanceId === "none" ? "" : instanceId;
      await saveSetting("won_notification_instance_id", actualId);
      setConfig((prev) => ({
        ...prev,
        instanceId: actualId || null,
        // Reset group when instance changes
        groupJid: null,
        groupName: null,
      }));
      // Clear group settings
      await saveSetting("won_notification_group_jid", "");
      await saveSetting("won_notification_group_name", "");
      toast.success("Instância selecionada");
    } catch (error) {
      console.error("Error saving setting:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const handleGroupSelect = async (groups: Array<{ id: string; name: string; size: number }>) => {
    if (groups.length === 0) return;

    const group = groups[0]; // Only use first group
    setSaving(true);
    try {
      await saveSetting("won_notification_group_jid", group.id);
      await saveSetting("won_notification_group_name", group.name);
      setConfig((prev) => ({
        ...prev,
        groupJid: group.id,
        groupName: group.name,
      }));
      toast.success("Grupo selecionado");
    } catch (error) {
      console.error("Error saving setting:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveGroup = async () => {
    setSaving(true);
    try {
      await saveSetting("won_notification_group_jid", "");
      await saveSetting("won_notification_group_name", "");
      setConfig((prev) => ({
        ...prev,
        groupJid: null,
        groupName: null,
      }));
      toast.success("Grupo removido");
    } catch (error) {
      console.error("Error saving setting:", error);
      toast.error("Erro ao remover grupo");
    } finally {
      setSaving(false);
    }
  };

  const selectedInstance = instances.find((i) => i.id === config.instanceId);
  const isConfigComplete = config.enabled && config.instanceId && config.groupJid;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificação de Venda (Ganho)
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure o envio automático de mensagem quando um lead for marcado como "Ganho"
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Ativar Notificações</CardTitle>
            <Switch
              checked={config.enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={saving}
            />
          </div>
          <CardDescription>
            Quando ativado, uma mensagem será enviada automaticamente para o grupo configurado
          </CardDescription>
        </CardHeader>
      </Card>

      {config.enabled && (
        <>
          {/* Instance Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Instância do WhatsApp
              </CardTitle>
              <CardDescription>
                Selecione a conexão que será usada para enviar as mensagens
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={config.instanceId || "none"}
                onValueChange={handleInstanceChange}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar instância" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      <div className="flex items-center gap-2">
                        <span>{instance.instance_name}</span>
                        {instance.phone_number && (
                          <span className="text-muted-foreground text-xs">
                            ({instance.phone_number})
                          </span>
                        )}
                        <Badge
                          variant={instance.status === "open" ? "default" : "secondary"}
                          className="text-[10px] px-1.5"
                        >
                          {instance.status === "open" ? "Conectada" : "Desconectada"}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedInstance && selectedInstance.status !== "open" && (
                <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  Esta instância não está conectada. As notificações podem falhar.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Group Selection */}
          {config.instanceId && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Grupo de Destino
                </CardTitle>
                <CardDescription>
                  Selecione o grupo que receberá as notificações de venda
                </CardDescription>
              </CardHeader>
              <CardContent>
                {config.groupJid ? (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{config.groupName}</p>
                        <p className="text-xs text-muted-foreground">Grupo selecionado</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveGroup}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowGroupSelector(true)}
                    disabled={saving}
                    className="w-full"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Selecionar Grupo
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status Summary */}
          <Card className={isConfigComplete ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                {isConfigComplete ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-700">Configuração completa</p>
                      <p className="text-sm text-green-600">
                        Mensagens serão enviadas para "{config.groupName}" quando leads forem marcados como Ganho
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-700">Configuração incompleta</p>
                      <p className="text-sm text-amber-600">
                        {!config.instanceId
                          ? "Selecione uma instância do WhatsApp"
                          : "Selecione o grupo de destino"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Message Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preview da Mensagem</CardTitle>
              <CardDescription>
                Este é o formato da mensagem que será enviada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg">
                <div className="bg-background rounded-lg p-3 max-w-sm shadow-sm border">
                  <pre className="text-sm whitespace-pre-wrap font-sans text-foreground">
{`🎉 *NOVA VENDA FECHADA!* 🎉

📅 *Data:* 04/02/2026
👥 *SDR:* João Silva
👔 *Closer:* Maria Santos

📋 *DADOS DO NEGÓCIO*
🏢 *Serviço:* UNV Core
🏪 *Empresa:* Empresa LTDA
📝 *Nome Fantasia:* Loja do João
📄 *CNPJ:* 12.345.678/0001-90
🏷️ *Segmento:* Varejo
📦 *Plano:* Anual

💰 *FINANCEIRO*
💵 *Valor:* R$ 15.000,00
🔢 *Parcelas:* Entrada + 3x
📆 *Vencimento:* Dia 10
💳 *Forma:* PIX

👤 *CONTATO*
📛 *Nome:* José da Silva
📱 *Telefone:* (11) 99999-9999
✉️ *E-mail:* jose@empresa.com

📍 *ENDEREÇO*
🏙️ *Cidade:* São Paulo
🗺️ *Estado:* SP
📮 *CEP:* 01234-567

📝 *BRIEFING*
Cliente interessado em automação...

🚀 *Parabéns à equipe!*`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Group Selector Dialog */}
      <GroupSelector
        open={showGroupSelector}
        onOpenChange={setShowGroupSelector}
        instanceId={config.instanceId || ""}
        onSelectGroups={handleGroupSelect}
      />
    </div>
  );
};
