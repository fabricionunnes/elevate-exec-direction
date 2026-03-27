import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

interface GroupItem {
  id: string;
  subject: string;
}

export function GamificationReportSettingsDialog({ open, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [instanceId, setInstanceId] = useState<string>("");
  const [groupJid, setGroupJid] = useState<string>("");
  const [sendTime, setSendTime] = useState("08:00");

  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    loadConfig();
    loadInstances();
  }, [open]);

  const loadConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("gamification_report_config")
      .select("setting_key, setting_value");

    if (data) {
      data.forEach((row) => {
        if (row.setting_key === "enabled") setEnabled(row.setting_value === "true");
        if (row.setting_key === "instance_id") setInstanceId(row.setting_value || "");
        if (row.setting_key === "group_jid") setGroupJid(row.setting_value || "");
        if (row.setting_key === "send_time") setSendTime(row.setting_value || "08:00");
      });
    }
    setLoading(false);
  };

  const loadInstances = async () => {
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, phone_number, status")
      .eq("status", "connected")
      .order("instance_name");
    setInstances(data || []);
  };

  const loadGroups = async (instId: string) => {
    if (!instId) return;
    setLoadingGroups(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=fetchGroups`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ instanceId: instId }),
        }
      );
      const result = await resp.json();
      if (Array.isArray(result)) {
        const mapped: GroupItem[] = result.map((g: any) => ({
          id: g.id || g.jid || g.groupJid || "",
          subject: g.subject || g.name || g.id || "",
        }));
        setGroups(mapped);
      }
    } catch (e) {
      console.error("Error fetching groups:", e);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    if (instanceId) {
      loadGroups(instanceId);
    } else {
      setGroups([]);
    }
  }, [instanceId]);

  const handleSave = async () => {
    setSaving(true);
    const updates = [
      { key: "enabled", value: enabled ? "true" : "false" },
      { key: "instance_id", value: instanceId || null },
      { key: "group_jid", value: groupJid || null },
      { key: "send_time", value: sendTime },
    ];

    for (const u of updates) {
      await supabase
        .from("gamification_report_config")
        .update({ setting_value: u.value, updated_at: new Date().toISOString() })
        .eq("setting_key", u.key);
    }
    toast.success("Configurações salvas!");
    setSaving(false);
    onClose();
  };

  const filteredGroups = groups.filter((g) =>
    g.subject.toLowerCase().includes(groupSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Relatório Diário - WhatsApp</DialogTitle>
          <DialogDescription>
            Configure o envio automático do ranking para um grupo do WhatsApp
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Envio automático diário</Label>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="space-y-2">
              <Label>Instância WhatsApp</Label>
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.instance_name} {inst.phone_number ? `(${inst.phone_number})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Grupo do WhatsApp</Label>
              {loadingGroups ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando grupos...
                </div>
              ) : groups.length > 0 ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar grupo..."
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-md">
                    {filteredGroups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setGroupJid(g.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${
                          groupJid === g.id ? "bg-primary/10 font-medium" : ""
                        }`}
                      >
                        {g.subject}
                      </button>
                    ))}
                    {filteredGroups.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">Nenhum grupo encontrado</p>
                    )}
                  </div>
                </>
              ) : instanceId ? (
                <p className="text-xs text-muted-foreground">Nenhum grupo encontrado nesta instância</p>
              ) : (
                <p className="text-xs text-muted-foreground">Selecione uma instância primeiro</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Horário de envio</Label>
              <Input
                type="time"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                className="w-32"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
