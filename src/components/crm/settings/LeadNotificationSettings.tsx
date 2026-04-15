import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

export const LeadNotificationSettings = () => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceName, setSelectedInstanceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: instancesData }, { data: settings }] = await Promise.all([
        supabase
          .from("whatsapp_instances")
          .select("id, instance_name, phone_number, status")
          .order("instance_name"),
        supabase
          .from("crm_settings")
          .select("setting_key, setting_value")
          .eq("setting_key", "lead_notification_instance_name"),
      ]);

      setInstances(instancesData || []);

      const current = settings?.[0]?.setting_value as string | undefined;
      setSelectedInstanceName(current || null);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleInstanceChange = async (value: string) => {
    const instanceName = value === "none" ? "" : value;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_settings")
        .upsert(
          { setting_key: "lead_notification_instance_name", setting_value: instanceName || null },
          { onConflict: "setting_key" }
        );
      if (error) throw error;
      setSelectedInstanceName(instanceName || null);
      toast.success(instanceName ? "Instância configurada!" : "Instância removida");
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const selectedInstance = instances.find((i) => i.instance_name === selectedInstanceName);

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
          <MessageSquare className="h-5 w-5" />
          Notificação de Novo Lead
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure qual instância do WhatsApp será usada para notificar a equipe (master, SDR, head comercial) quando um novo lead entrar no funil.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Instância de Envio
          </CardTitle>
          <CardDescription>
            Selecione a conexão WhatsApp que enviará as notificações de novos leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedInstanceName || "none"}
            onValueChange={handleInstanceChange}
            disabled={saving}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar instância" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma (desativado)</SelectItem>
              {instances.map((instance) => (
                <SelectItem key={instance.id} value={instance.instance_name}>
                  <div className="flex items-center gap-2">
                    <span>{instance.instance_name}</span>
                    {instance.phone_number && (
                      <span className="text-muted-foreground text-xs">
                        ({instance.phone_number})
                      </span>
                    )}
                    <Badge
                      variant={instance.status === "connected" ? "default" : "secondary"}
                      className="text-[10px] px-1.5"
                    >
                      {instance.status === "connected" ? "Conectada" : instance.status}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedInstance && selectedInstance.status !== "connected" && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle className="h-4 w-4" />
              Esta instância não está conectada. As notificações podem falhar.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={selectedInstanceName ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            {selectedInstanceName ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-700">Notificações ativas</p>
                  <p className="text-sm text-green-600">
                    Novos leads serão notificados via "{selectedInstanceName}"
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-700">Notificações desativadas</p>
                  <p className="text-sm text-amber-600">
                    Selecione uma instância para ativar as notificações de novos leads
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
