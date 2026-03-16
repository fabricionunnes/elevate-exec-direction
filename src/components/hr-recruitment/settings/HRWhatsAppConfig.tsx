import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageCircle, Save, Loader2 } from "lucide-react";

interface Props {
  projectId: string;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  status: string | null;
}

interface HRWhatsAppConfig {
  id: string;
  project_id: string;
  instance_id: string | null;
  notify_on_stage_change: boolean;
  notify_phone: string | null;
  notify_group_jid: string | null;
  message_template: string | null;
}

const DEFAULT_TEMPLATE = 'O candidato {candidate_name} avançou para a etapa "{stage_name}" na vaga "{job_title}".';

export function HRWhatsAppConfig({ projectId }: Props) {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [config, setConfig] = useState<HRWhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [notifyPhone, setNotifyPhone] = useState("");
  const [notifyGroupJid, setNotifyGroupJid] = useState("");
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    const [instancesRes, configRes] = await Promise.all([
      supabase
        .from("whatsapp_instances")
        .select("id, instance_name, display_name, status")
        .order("display_name"),
      supabase
        .from("hr_whatsapp_config")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);

    setInstances(instancesRes.data || []);

    if (configRes.data) {
      const c = configRes.data as HRWhatsAppConfig;
      setConfig(c);
      setSelectedInstance(c.instance_id || "");
      setNotifyEnabled(c.notify_on_stage_change);
      setNotifyPhone(c.notify_phone || "");
      setNotifyGroupJid(c.notify_group_jid || "");
      setMessageTemplate(c.message_template || DEFAULT_TEMPLATE);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!selectedInstance) {
      toast.error("Selecione uma instância do WhatsApp");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        project_id: projectId,
        instance_id: selectedInstance,
        notify_on_stage_change: notifyEnabled,
        notify_phone: notifyPhone.trim() || null,
        notify_group_jid: notifyGroupJid.trim() || null,
        message_template: messageTemplate.trim() || DEFAULT_TEMPLATE,
        updated_at: new Date().toISOString(),
      };

      if (config) {
        const { error } = await supabase
          .from("hr_whatsapp_config")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("hr_whatsapp_config")
          .insert(payload);
        if (error) throw error;
      }

      toast.success("Configuração salva com sucesso!");
      await fetchData();
    } catch (error: any) {
      console.error("Error saving HR WhatsApp config:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-600" />
          Notificações WhatsApp - Pipeline
        </CardTitle>
        <CardDescription>
          Configure o envio automático de mensagens ao cliente quando candidatos avançarem nas etapas do pipeline
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label>Ativar notificações</Label>
            <p className="text-xs text-muted-foreground">
              Enviar mensagem ao cliente a cada mudança de etapa
            </p>
          </div>
          <Switch checked={notifyEnabled} onCheckedChange={setNotifyEnabled} />
        </div>

        <div className="space-y-2">
          <Label>Instância do WhatsApp</Label>
          <Select value={selectedInstance} onValueChange={setSelectedInstance}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma instância" />
            </SelectTrigger>
            <SelectContent>
              {instances.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        inst.status === "open" || inst.status === "connected"
                          ? "bg-green-500"
                          : "bg-red-400"
                      }`}
                    />
                    <span>{inst.display_name}</span>
                    <span className="text-xs text-muted-foreground">({inst.instance_name})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Telefone do cliente (com DDI)</Label>
          <Input
            placeholder="5511999999999"
            value={notifyPhone}
            onChange={(e) => setNotifyPhone(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Número que receberá as notificações. Deixe vazio se usar grupo.
          </p>
        </div>

        <div className="space-y-2">
          <Label>JID do Grupo (opcional)</Label>
          <Input
            placeholder="120363XXXXXXX@g.us"
            value={notifyGroupJid}
            onChange={(e) => setNotifyGroupJid(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Se preferir enviar para um grupo do WhatsApp, informe o JID do grupo.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Modelo da mensagem</Label>
          <Textarea
            rows={3}
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Variáveis disponíveis: {"{candidate_name}"}, {"{stage_name}"}, {"{job_title}"}
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? "Salvando..." : "Salvar Configuração"}
        </Button>
      </CardContent>
    </Card>
  );
}
