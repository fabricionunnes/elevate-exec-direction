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
  type: "evolution" | "official";
}

interface InstanceAccess {
  instance_id: string;
  can_view: boolean;
  can_send: boolean;
  type: "evolution" | "official";
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
      // Load Evolution API instances
      const { data: evolutionData } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, display_name, status")
        .order("display_name");

      // Load Official API instances
      const { data: officialData } = await supabase
        .from("whatsapp_official_instances")
        .select("id, display_name, phone_number, is_active")
        .order("display_name");

      const allInstances: WhatsAppInstance[] = [];
      
      (evolutionData || []).forEach((i) => {
        allInstances.push({
          id: i.id,
          instance_name: i.instance_name,
          display_name: i.display_name || i.instance_name,
          status: i.status,
          type: "evolution",
        });
      });
      
      (officialData || []).forEach((i: any) => {
        allInstances.push({
          id: `official:${i.id}`,
          instance_name: i.display_name || i.phone_number || "API Oficial",
          display_name: i.display_name || i.phone_number || "API Oficial",
          status: i.is_active ? "connected" : "disconnected",
          type: "official",
        });
      });

      setInstances(allInstances);

      // Load Evolution API access
      const { data: evolutionAccess } = await supabase
        .from("whatsapp_instance_access")
        .select("instance_id, can_view, can_send")
        .eq("staff_id", staffId);

      // Load Official API access
      const { data: officialAccess } = await supabase
        .from("whatsapp_official_instance_access")
        .select("instance_id, can_view, can_send")
        .eq("staff_id", staffId);

      const map: Record<string, InstanceAccess> = {};
      
      (evolutionAccess || []).forEach((a) => {
        map[a.instance_id] = {
          instance_id: a.instance_id,
          can_view: a.can_view,
          can_send: a.can_send,
          type: "evolution",
        };
      });
      
      (officialAccess || []).forEach((a) => {
        map[`official:${a.instance_id}`] = {
          instance_id: a.instance_id,
          can_view: a.can_view,
          can_send: a.can_send,
          type: "official",
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

  const toggleAccess = (instanceId: string, type: "evolution" | "official") => {
    const realId = instanceId.startsWith("official:") 
      ? instanceId.replace("official:", "") 
      : instanceId;
      
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
            instance_id: realId,
            can_view: true,
            can_send: true,
            type,
          },
        };
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all current Evolution API access for this staff
      await supabase
        .from("whatsapp_instance_access")
        .delete()
        .eq("staff_id", staffId);

      // Delete all current Official API access for this staff
      await supabase
        .from("whatsapp_official_instance_access")
        .delete()
        .eq("staff_id", staffId);

      // Separate entries by type
      const entries = Object.values(accessMap);
      const evolutionEntries = entries.filter((e) => e.type === "evolution");
      const officialEntries = entries.filter((e) => e.type === "official");

      // Insert Evolution API access entries
      if (evolutionEntries.length > 0) {
        const toInsert = evolutionEntries.map((e) => ({
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

      // Insert Official API access entries
      if (officialEntries.length > 0) {
        const toInsert = officialEntries.map((e) => ({
          staff_id: staffId,
          instance_id: e.instance_id,
          can_view: e.can_view,
          can_send: e.can_send,
        }));

        const { error } = await supabase
          .from("whatsapp_official_instance_access")
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
                    const isOfficial = instance.type === "official";
                    return (
                      <div
                        key={instance.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          hasAccess
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                        onClick={() => toggleAccess(instance.id, instance.type)}
                      >
                        <Checkbox
                          checked={hasAccess}
                          onCheckedChange={() => toggleAccess(instance.id, instance.type)}
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            isOfficial ? "bg-blue-100" : "bg-green-100"
                          }`}>
                            <MessageCircle className={`h-4 w-4 ${
                              isOfficial ? "text-blue-600" : "text-green-600"
                            }`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {instance.display_name || instance.instance_name}
                            </p>
                            {isOfficial && (
                              <p className="text-xs text-blue-600">API Oficial</p>
                            )}
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
