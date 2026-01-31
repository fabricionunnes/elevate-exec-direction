import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Search, Users } from "lucide-react";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: string;
}

interface InstanceUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  instanceName: string;
  onAccessUpdated?: () => void;
}

export function InstanceUsersDialog({
  open,
  onOpenChange,
  instanceId,
  instanceName,
  onAccessUpdated,
}: InstanceUsersDialogProps) {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, instanceId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all active staff members
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name, email, avatar_url, role")
        .eq("is_active", true)
        .order("name");

      setStaffMembers(staffData || []);

      // Load current access for this instance
      const { data: accessData } = await supabase
        .from("whatsapp_instance_access")
        .select("staff_id")
        .eq("instance_id", instanceId)
        .eq("can_view", true);

      const map: Record<string, boolean> = {};
      (accessData || []).forEach((a) => {
        map[a.staff_id] = true;
      });
      setAccessMap(map);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const toggleAccess = (staffId: string) => {
    setAccessMap((prev) => ({
      ...prev,
      [staffId]: !prev[staffId],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all current access for this instance
      await supabase
        .from("whatsapp_instance_access")
        .delete()
        .eq("instance_id", instanceId);

      // Insert new access entries for staff members with access
      const staffWithAccess = Object.entries(accessMap)
        .filter(([_, hasAccess]) => hasAccess)
        .map(([staffId]) => staffId);

      if (staffWithAccess.length > 0) {
        const toInsert = staffWithAccess.map((staffId) => ({
          staff_id: staffId,
          instance_id: instanceId,
          can_view: true,
          can_send: true,
        }));

        const { error } = await supabase
          .from("whatsapp_instance_access")
          .insert(toInsert);

        if (error) throw error;
      }

      toast.success("Acessos atualizados!");
      onAccessUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving access:", error);
      toast.error("Erro ao salvar acessos");
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleLabels: Record<string, string> = {
      master: "Master",
      admin: "Administrador",
      cs: "CS",
      consultant: "Consultor",
      rh: "RH",
      closer: "Closer",
      sdr: "SDR",
    };
    return (
      <Badge variant="secondary" className="text-[10px]">
        {roleLabels[role] || role}
      </Badge>
    );
  };

  const filteredStaff = staffMembers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCount = Object.values(accessMap).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários - {instanceName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Selecione os usuários que podem usar esta instância:
            </p>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="max-h-[300px] pr-4">
              <div className="space-y-2">
                {filteredStaff.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum usuário encontrado
                  </p>
                ) : (
                  filteredStaff.map((staff) => {
                    const hasAccess = !!accessMap[staff.id];
                    return (
                      <div
                        key={staff.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          hasAccess
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                        onClick={() => toggleAccess(staff.id)}
                      >
                        <Checkbox
                          checked={hasAccess}
                          onCheckedChange={() => toggleAccess(staff.id)}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={staff.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {staff.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{staff.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {staff.email}
                          </p>
                        </div>
                        {getRoleBadge(staff.role)}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                {selectedCount} usuário(s) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
