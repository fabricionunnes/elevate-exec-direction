import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  status: string;
}

interface InstanceAccess {
  instance_id: string;
  can_view: boolean;
  can_send: boolean;
}

interface InstanceAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
  staffName: string;
  onAccessUpdated: () => void;
}

export function InstanceAccessDialog({
  open,
  onOpenChange,
  staffId,
  staffName,
  onAccessUpdated,
}: InstanceAccessDialogProps) {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, InstanceAccess>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, staffId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all instances
      const { data: instancesData } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, display_name, status")
        .order("display_name");

      setInstances(instancesData || []);

      // Load current access for this staff
      const { data: accessData } = await supabase
        .from("whatsapp_instance_access")
        .select("instance_id, can_view, can_send")
        .eq("staff_id", staffId);

      const map: Record<string, InstanceAccess> = {};
      (accessData || []).forEach((a) => {
        map[a.instance_id] = {
          instance_id: a.instance_id,
          can_view: a.can_view,
          can_send: a.can_send,
        };
      });
      setAccessMap(map);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const toggleAccess = (instanceId: string) => {
    setAccessMap((prev) => {
      const current = prev[instanceId];
      if (current) {
        // Remove access
        const next = { ...prev };
        delete next[instanceId];
        return next;
      } else {
        // Add access
        return {
          ...prev,
          [instanceId]: {
            instance_id: instanceId,
            can_view: true,
            can_send: true,
          },
        };
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all current access for this staff
      await supabase
        .from("whatsapp_instance_access")
        .delete()
        .eq("staff_id", staffId);

      // Insert new access entries
      const entries = Object.values(accessMap);
      if (entries.length > 0) {
        const toInsert = entries.map((e) => ({
          staff_id: staffId,
          instance_id: e.instance_id,
          can_view: e.can_view,
          can_send: e.can_send,
        }));

        const { error } = await supabase
          .from("whatsapp_instance_access")
          .insert(toInsert);

        if (error) throw error;
      }

      toast.success("Acessos atualizados!");
      onAccessUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving access:", error);
      toast.error("Erro ao salvar acessos");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "connected") {
      return <Badge className="bg-green-500 text-white text-[10px]">Online</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px]">Offline</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular Conexões - {staffName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Selecione as conexões WhatsApp que este usuário pode acessar:
            </p>

            <ScrollArea className="max-h-[300px] pr-4">
              <div className="space-y-2">
                {instances.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma conexão disponível
                  </p>
                ) : (
                  instances.map((instance) => {
                    const hasAccess = !!accessMap[instance.id];
                    return (
                      <div
                        key={instance.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          hasAccess
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                        onClick={() => toggleAccess(instance.id)}
                      >
                        <Checkbox
                          checked={hasAccess}
                          onCheckedChange={() => toggleAccess(instance.id)}
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                            <MessageCircle className="h-4 w-4 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {instance.display_name || instance.instance_name}
                            </p>
                          </div>
                          {getStatusBadge(instance.status)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
