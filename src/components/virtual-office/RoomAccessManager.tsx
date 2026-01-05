import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Shield, Users } from "lucide-react";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface RoomAccessManagerProps {
  roomId: string;
  isRestricted: boolean;
  onRestrictedChange: (restricted: boolean) => void;
  staffMembers: StaffMember[];
  currentStaffId: string;
}

export const RoomAccessManager = ({
  roomId,
  isRestricted,
  onRestrictedChange,
  staffMembers,
  currentStaffId,
}: RoomAccessManagerProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accessList, setAccessList] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isRestricted) {
      fetchAccessList();
    }
  }, [roomId, isRestricted]);

  const fetchAccessList = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("virtual_office_room_access")
        .select("staff_id")
        .eq("room_id", roomId);

      if (error) throw error;

      setAccessList(new Set(data?.map((a) => a.staff_id) || []));
    } catch (error) {
      console.error("Error fetching access list:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStaffAccess = (staffId: string) => {
    setAccessList((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) {
        next.delete(staffId);
      } else {
        next.add(staffId);
      }
      return next;
    });
  };

  const saveAccessList = async () => {
    setSaving(true);
    try {
      // Delete all existing access for this room
      await supabase
        .from("virtual_office_room_access")
        .delete()
        .eq("room_id", roomId);

      // Insert new access entries
      if (accessList.size > 0) {
        const accessEntries = Array.from(accessList).map((staffId) => ({
          room_id: roomId,
          staff_id: staffId,
          granted_by: currentStaffId,
        }));

        const { error } = await supabase
          .from("virtual_office_room_access")
          .insert(accessEntries);

        if (error) throw error;
      }

      toast.success("Permissões atualizadas");
    } catch (error) {
      console.error("Error saving access list:", error);
      toast.error("Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  const handleRestrictedToggle = async (restricted: boolean) => {
    onRestrictedChange(restricted);
    
    if (restricted && accessList.size === 0) {
      // When enabling restriction, add the current admin by default
      setAccessList(new Set([currentStaffId]));
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Admin";
      case "cs": return "CS";
      case "consultant": return "Consultor";
      default: return role;
    }
  };

  const getStaffInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const selectByRole = (role: string) => {
    const staffIds = staffMembers.filter((s) => s.role === role).map((s) => s.id);
    setAccessList((prev) => {
      const next = new Set(prev);
      staffIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectAll = () => {
    setAccessList(new Set(staffMembers.map((s) => s.id)));
  };

  const clearAll = () => {
    setAccessList(new Set([currentStaffId])); // Keep at least the current admin
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div>
            <Label htmlFor="restricted-toggle" className="font-medium">
              Sala Restrita
            </Label>
            <p className="text-xs text-muted-foreground">
              {isRestricted 
                ? "Apenas membros selecionados podem ver esta sala" 
                : "Todos os membros da equipe podem ver esta sala"}
            </p>
          </div>
        </div>
        <Switch
          id="restricted-toggle"
          checked={isRestricted}
          onCheckedChange={handleRestrictedToggle}
        />
      </div>

      {isRestricted && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Selecionar:</span>
            <Button variant="outline" size="sm" onClick={selectAll}>
              Todos
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectByRole("admin")}>
              Admins
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectByRole("cs")}>
              CS
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectByRole("consultant")}>
              Consultores
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Limpar
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[250px] border rounded-lg">
              <div className="p-2 space-y-1">
                {staffMembers.map((staff) => {
                  const hasAccess = accessList.has(staff.id);
                  const isCurrentUser = staff.id === currentStaffId;

                  return (
                    <div
                      key={staff.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        hasAccess ? "bg-primary/10" : "hover:bg-muted/50"
                      }`}
                      onClick={() => !isCurrentUser && toggleStaffAccess(staff.id)}
                    >
                      <Checkbox
                        checked={hasAccess}
                        onCheckedChange={() => !isCurrentUser && toggleStaffAccess(staff.id)}
                        disabled={isCurrentUser}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getStaffInitials(staff.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {staff.name}
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground ml-2">(você)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{staff.email}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {getRoleLabel(staff.role)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{accessList.size} membro{accessList.size !== 1 && "s"} com acesso</span>
            </div>
            <Button onClick={saveAccessList} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Permissões
            </Button>
          </div>
        </>
      )}
    </div>
  );
};