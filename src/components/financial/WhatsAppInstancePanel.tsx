import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { invalidateDefaultInstanceCache } from "@/utils/whatsapp-defaults";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  status: string | null;
}

export function WhatsAppInstancePanel() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [currentInstance, setCurrentInstance] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [instancesRes, configRes] = await Promise.all([
        supabase
          .from("whatsapp_instances")
          .select("id, instance_name, display_name, status")
          .order("instance_name"),
        supabase
          .from("whatsapp_default_config")
          .select("setting_value")
          .eq("setting_key", "default_instance")
          .maybeSingle(),
      ]);

      if (instancesRes.data) setInstances(instancesRes.data);
      if (configRes.data?.setting_value) setCurrentInstance(configRes.data.setting_value);
    } catch (error) {
      console.error("Error loading instances:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = async (value: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_default_config")
        .upsert(
          { setting_key: "default_instance", setting_value: value },
          { onConflict: "setting_key" }
        );

      if (error) throw error;

      setCurrentInstance(value);
      invalidateDefaultInstanceCache();
      toast.success("Instância padrão atualizada com sucesso!");
    } catch (error) {
      console.error("Error saving instance:", error);
      toast.error("Erro ao salvar instância padrão");
    } finally {
      setIsSaving(false);
    }
  };

  const isConnected = (status: string | null) =>
    status === "connected" || status === "connecting";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Instância Padrão de WhatsApp
          </CardTitle>
          <CardDescription>
            Selecione a instância que será usada para envio de mensagens em Contas a Receber, Régua de Cobranças e demais módulos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={currentInstance} onValueChange={handleChange} disabled={isSaving}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecione uma instância..." />
            </SelectTrigger>
            <SelectContent>
              {instances.map((inst) => (
                <SelectItem key={inst.id} value={inst.instance_name}>
                  <span className="flex items-center gap-2">
                    {isConnected(inst.status) ? (
                      <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 text-destructive" />
                    )}
                    {inst.display_name || inst.instance_name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentInstance && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Instância ativa:
              <Badge variant="secondary" className="font-mono">
                {currentInstance}
              </Badge>
              {(() => {
                const inst = instances.find((i) => i.instance_name === currentInstance);
                if (!inst) return null;
                return isConnected(inst.status) ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Conectada</Badge>
                ) : (
                  <Badge variant="destructive">Desconectada</Badge>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instances overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todas as Instâncias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {instances.map((inst) => (
              <div
                key={inst.id}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  inst.instance_name === currentInstance
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <div className={`h-2.5 w-2.5 rounded-full ${
                  isConnected(inst.status) ? "bg-emerald-500" : "bg-destructive"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inst.display_name || inst.instance_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {isConnected(inst.status) ? "Conectada" : "Desconectada"}
                  </p>
                </div>
                {inst.instance_name === currentInstance && (
                  <Badge variant="outline" className="text-xs shrink-0">Padrão</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
