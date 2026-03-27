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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Search, X, CheckSquare, SendHorizonal } from "lucide-react";

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
  const [testSending, setTestSending] = useState(false);
  const [testGroupId, setTestGroupId] = useState<string>("");

  const [enabled, setEnabled] = useState(false);
  const [instanceId, setInstanceId] = useState<string>("");
  const [selectedGroups, setSelectedGroups] = useState<GroupItem[]>([]);
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
        if (row.setting_key === "group_jids") {
          try {
            const parsed = JSON.parse(row.setting_value || "[]");
            setSelectedGroups(Array.isArray(parsed) ? parsed : []);
          } catch {
            // Legacy single group_jid migration
            if (row.setting_value) {
              setSelectedGroups([{ id: row.setting_value, subject: row.setting_value }]);
            }
          }
        }
        // Legacy fallback
        if (row.setting_key === "group_jid" && row.setting_value) {
          setSelectedGroups((prev) =>
            prev.length === 0 ? [{ id: row.setting_value!, subject: row.setting_value! }] : prev
          );
        }
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

  const toggleGroup = (group: GroupItem) => {
    setSelectedGroups((prev) => {
      const exists = prev.some((g) => g.id === group.id);
      if (exists) return prev.filter((g) => g.id !== group.id);
      return [...prev, group];
    });
  };

  const selectAllFiltered = () => {
    setSelectedGroups((prev) => {
      const existingIds = new Set(prev.map((g) => g.id));
      const newOnes = filteredGroups.filter((g) => !existingIds.has(g.id));
      return [...prev, ...newOnes];
    });
  };

  const deselectAllFiltered = () => {
    const filteredIds = new Set(filteredGroups.map((g) => g.id));
    setSelectedGroups((prev) => prev.filter((g) => !filteredIds.has(g.id)));
  };

  const removeGroup = (groupId: string) => {
    setSelectedGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const handleSave = async () => {
    setSaving(true);

    // Upsert group_jids key
    const groupJidsValue = JSON.stringify(selectedGroups);

    const updates = [
      { key: "enabled", value: enabled ? "true" : "false" },
      { key: "instance_id", value: instanceId || null },
      { key: "group_jids", value: groupJidsValue },
      { key: "send_time", value: sendTime },
    ];

    for (const u of updates) {
      // Try update first, then insert if not exists
      const { data } = await supabase
        .from("gamification_report_config")
        .update({ setting_value: u.value, updated_at: new Date().toISOString() })
        .eq("setting_key", u.key)
        .select();

      if (!data || data.length === 0) {
        await supabase
          .from("gamification_report_config")
          .insert({ setting_key: u.key, setting_value: u.value });
      }
    }
    toast.success("Configurações salvas!");
    setSaving(false);
    onClose();
  };

  const filteredGroups = groups.filter((g) =>
    g.subject.toLowerCase().includes(groupSearch.toLowerCase())
  );

  const allFilteredSelected = filteredGroups.length > 0 && filteredGroups.every((g) =>
    selectedGroups.some((sg) => sg.id === g.id)
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatório Diário - WhatsApp</DialogTitle>
          <DialogDescription>
            Configure o envio automático do ranking para grupos do WhatsApp
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

            {/* Selected groups badges */}
            {selectedGroups.length > 0 && (
              <div className="space-y-2">
                <Label>Grupos selecionados ({selectedGroups.length})</Label>
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-muted/30 max-h-24 overflow-y-auto">
                  {selectedGroups.map((g) => (
                    <Badge
                      key={g.id}
                      variant="secondary"
                      className="gap-1 text-xs cursor-pointer hover:bg-destructive/20"
                      onClick={() => removeGroup(g.id)}
                    >
                      {g.subject.length > 25 ? g.subject.substring(0, 25) + "..." : g.subject}
                      <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Grupos do WhatsApp</Label>
              {loadingGroups ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando grupos...
                </div>
              ) : groups.length > 0 ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar grupo..."
                        value={groupSearch}
                        onChange={(e) => setGroupSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1 text-xs"
                      onClick={allFilteredSelected ? deselectAllFiltered : selectAllFiltered}
                    >
                      <CheckSquare className="h-3 w-3" />
                      {allFilteredSelected ? "Desmarcar" : "Todos"}
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-md">
                    {filteredGroups.map((g) => {
                      const isSelected = selectedGroups.some((sg) => sg.id === g.id);
                      return (
                        <button
                          key={g.id}
                          onClick={() => toggleGroup(g)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2 ${
                            isSelected ? "bg-primary/10" : ""
                          }`}
                        >
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          <span className={isSelected ? "font-medium" : ""}>{g.subject}</span>
                        </button>
                      );
                    })}
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

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Select value={testGroupId} onValueChange={setTestGroupId}>
              <SelectTrigger className="h-9 text-xs flex-1">
                <SelectValue placeholder="Grupo para teste..." />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id} className="text-xs">
                    {g.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1 shrink-0"
              disabled={!testGroupId || !instanceId || testSending}
              onClick={async () => {
                setTestSending(true);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) { toast.error("Não autenticado"); return; }
                  const resp = await fetch(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gamification-daily-report`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                      },
                      body: JSON.stringify({ testGroupId, testInstanceId: instanceId }),
                    }
                  );
                  const result = await resp.json();
                  if (result.error) throw new Error(result.error);
                  toast.success("Teste enviado com sucesso!");
                } catch (e: any) {
                  toast.error(e.message || "Erro ao enviar teste");
                } finally {
                  setTestSending(false);
                }
              }}
            >
              {testSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <SendHorizonal className="h-3 w-3" />}
              Testar
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
