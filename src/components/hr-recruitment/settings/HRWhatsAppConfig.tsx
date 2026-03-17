import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { MessageCircle, Save, Loader2, RefreshCw, Users, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  status: string | null;
  api_url: string | null;
  api_key: string | null;
}

interface WhatsAppGroup {
  id: string;
  subject: string;
  size: number;
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

const DEFAULT_TEMPLATE = `📋 *Atualização de Processo Seletivo*

👤 *Candidato:* {candidate_name}
💼 *Vaga:* {job_title}
🔄 *Nova etapa:* {stage_name}

✅ O candidato avançou no pipeline de recrutamento.
Acompanhe o progresso pelo painel de RH.`;
export function HRWhatsAppConfig({ projectId }: Props) {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [config, setConfig] = useState<HRWhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupsLoadedForInstance, setGroupsLoadedForInstance] = useState<string>("");

  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [notifyPhone, setNotifyPhone] = useState("");
  const [notifyGroupJid, setNotifyGroupJid] = useState("");
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  useEffect(() => {
    if (selectedInstance && selectedInstance !== groupsLoadedForInstance) {
      fetchGroups(selectedInstance);
    } else if (!selectedInstance) {
      setGroups([]);
      setGroupsLoadedForInstance("");
    }
  }, [selectedInstance]);

  const fetchData = async () => {
    setLoading(true);
    const [instancesRes, configRes, projectRes] = await Promise.all([
      supabase
        .from("whatsapp_instances")
        .select("id, instance_name, display_name, status, api_url, api_key")
        .order("display_name"),
      supabase
        .from("hr_whatsapp_config")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("onboarding_projects")
        .select("onboarding_company_id")
        .eq("id", projectId)
        .maybeSingle(),
    ]);

    setInstances(instancesRes.data || []);

    // Fetch company phone
    let companyPhone = "";
    if (projectRes.data?.onboarding_company_id) {
      const { data: company } = await supabase
        .from("onboarding_companies")
        .select("phone")
        .eq("id", projectRes.data.onboarding_company_id)
        .maybeSingle();
      companyPhone = company?.phone || "";
    }

    if (configRes.data) {
      const c = configRes.data as HRWhatsAppConfig;
      setConfig(c);
      setSelectedInstance(c.instance_id || "");
      setNotifyEnabled(c.notify_on_stage_change);
      setNotifyPhone(c.notify_phone || companyPhone);
      setNotifyGroupJid(c.notify_group_jid || "");
      setMessageTemplate(c.message_template || DEFAULT_TEMPLATE);
    } else {
      // No config yet - pre-fill with company phone
      setNotifyPhone(companyPhone);
    }
    setLoading(false);
  };

  const fetchGroups = async (instanceId: string) => {
    const instance = instances.find((i) => i.id === instanceId);
    if (!instance?.api_url || !instance?.api_key || !instance?.instance_name) {
      setGroups([]);
      return;
    }

    setLoadingGroups(true);
    try {
      const baseUrl = instance.api_url.replace(/\/$/, "");
      const response = await fetch(
        `${baseUrl}/group/fetchAllGroups/${instance.instance_name}?getParticipants=false`,
        {
          headers: { apikey: instance.api_key },
        }
      );

      if (!response.ok) throw new Error("Erro ao buscar grupos");

      const data = await response.json();
      const groupList: WhatsAppGroup[] = (Array.isArray(data) ? data : []).map((g: any) => ({
        id: g.id || g.jid,
        subject: g.subject || g.name || "Sem nome",
        size: g.size || g.participants?.length || 0,
      }));

      setGroups(groupList);
      setGroupsLoadedForInstance(instanceId);
    } catch (error) {
      console.error("Error fetching groups:", error);
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
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
        notify_group_jid: notifyGroupJid.trim() && notifyGroupJid !== "none" ? notifyGroupJid.trim() : null,
        message_template: messageTemplate.trim() || DEFAULT_TEMPLATE,
        updated_at: new Date().toISOString(),
      };

      if (config) {
        // Don't include project_id in update to avoid conflicts
        const { project_id, ...updatePayload } = payload;
        const { error } = await supabase
          .from("hr_whatsapp_config")
          .update(updatePayload)
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
      console.error("Error saving HR WhatsApp config:", error?.message || error?.code || error);
      toast.error(`Erro ao salvar configuração: ${error?.message || "erro desconhecido"}`);
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
          <div className="flex items-center justify-between">
            <Label>Grupo do WhatsApp (opcional)</Label>
            {selectedInstance && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchGroups(selectedInstance)}
                disabled={loadingGroups}
                className="h-7 text-xs gap-1"
              >
                {loadingGroups ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Atualizar
              </Button>
            )}
          </div>

          {loadingGroups ? (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Buscando grupos...</span>
            </div>
          ) : groups.length > 0 ? (
            <Popover open={groupOpen} onOpenChange={setGroupOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={groupOpen}
                  className="w-full justify-between font-normal"
                >
                  {notifyGroupJid && notifyGroupJid !== "none"
                    ? (() => {
                        const selected = groups.find((g) => g.id === notifyGroupJid);
                        return selected ? (
                          <span className="flex items-center gap-2 truncate">
                            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {selected.subject}
                            <span className="text-xs text-muted-foreground">({selected.size} membros)</span>
                          </span>
                        ) : notifyGroupJid;
                      })()
                    : <span className="text-muted-foreground">Selecione um grupo (ou deixe vazio)</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar grupo pelo nome..." />
                  <CommandList>
                    <CommandEmpty>Nenhum grupo encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="none"
                        onSelect={() => {
                          setNotifyGroupJid("none");
                          setGroupOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", (!notifyGroupJid || notifyGroupJid === "none") ? "opacity-100" : "opacity-0")} />
                        <span className="text-muted-foreground">Nenhum (enviar para telefone)</span>
                      </CommandItem>
                      {groups.map((group) => (
                        <CommandItem
                          key={group.id}
                          value={group.subject}
                          onSelect={() => {
                            setNotifyGroupJid(group.id);
                            setGroupOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", notifyGroupJid === group.id ? "opacity-100" : "opacity-0")} />
                          <Users className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{group.subject}</span>
                          <span className="ml-auto text-xs text-muted-foreground">({group.size} membros)</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {selectedInstance
                  ? "Nenhum grupo encontrado. Verifique se a instância está conectada."
                  : "Selecione uma instância para carregar os grupos."}
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Se preferir enviar para um grupo do WhatsApp, selecione acima.
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
