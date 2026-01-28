import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Shield, Crown } from "lucide-react";
import { STAFF_MENU_STRUCTURE, STAFF_ROLE_LABELS, StaffRole, isMasterRole } from "@/types/staffPermissions";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface StaffPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffMember | null;
  onSaved?: () => void;
}

export const StaffPermissionsDialog = ({
  open,
  onOpenChange,
  staff,
  onSaved,
}: StaffPermissionsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (open && staff) {
      fetchPermissions();
    }
  }, [open, staff]);

  const fetchPermissions = async () => {
    if (!staff) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("staff_menu_permissions")
        .select("menu_key")
        .eq("staff_id", staff.id);

      if (error) throw error;
      setPermissions((data || []).map((p) => p.menu_key));
    } catch (error) {
      console.error("Error fetching permissions:", error);
      toast.error("Erro ao carregar permissões");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (menuKey: string) => {
    setPermissions((prev) =>
      prev.includes(menuKey)
        ? prev.filter((k) => k !== menuKey)
        : [...prev, menuKey]
    );
  };

  const handleSelectAll = () => {
    const allKeys = STAFF_MENU_STRUCTURE.map((m) => m.key);
    setPermissions(allKeys);
  };

  const handleClearAll = () => {
    setPermissions([]);
  };

  const handleSave = async () => {
    if (!staff) return;
    setSaving(true);
    try {
      // Delete all existing permissions
      await supabase
        .from("staff_menu_permissions")
        .delete()
        .eq("staff_id", staff.id);

      // Insert new permissions
      if (permissions.length > 0) {
        const { error } = await supabase.from("staff_menu_permissions").insert(
          permissions.map((menu_key) => ({
            staff_id: staff.id,
            menu_key,
          }))
        );
        if (error) throw error;
      }

      toast.success("Permissões salvas com sucesso!");
      onSaved?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving permissions:", error);
      toast.error(error.message || "Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  if (!staff) return null;

  const isMaster = isMasterRole(staff.role);

  // Group menus by group
  const groupedMenus = STAFF_MENU_STRUCTURE.reduce((acc, menu) => {
    const group = menu.group || "Outros";
    if (!acc[group]) acc[group] = [];
    acc[group].push(menu);
    return acc;
  }, {} as Record<string, Array<{ key: string; label: string; description: string; group: string }>>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permissões de Acesso
          </DialogTitle>
          <DialogDescription>
            Gerenciar permissões de menu para <strong>{staff.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Master role info */}
        {isMaster && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <Crown className="h-6 w-6 text-amber-500" />
            <div>
              <p className="font-medium text-amber-800">Usuário Master</p>
              <p className="text-sm text-amber-700">
                O usuário Master possui acesso total a todas as funcionalidades do sistema. Não é possível restringir suas permissões.
              </p>
            </div>
          </div>
        )}

        {!isMaster && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6 py-4">
                {/* Quick actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{staff.role}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {permissions.length} de {STAFF_MENU_STRUCTURE.length} menus liberados
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      Marcar Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleClearAll}>
                      Desmarcar Todos
                    </Button>
                  </div>
                </div>

                {/* Permissions grid by group */}
                {Object.entries(groupedMenus).map(([groupName, menus]) => (
                  <div key={groupName} className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground border-b pb-1">
                      {groupName}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {menus.map((menu) => (
                        <label
                          key={menu.key}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            permissions.includes(menu.key)
                              ? "bg-primary/5 border-primary/30"
                              : "bg-background hover:bg-muted/50"
                          }`}
                        >
                          <Checkbox
                            checked={permissions.includes(menu.key)}
                            onCheckedChange={() => handleTogglePermission(menu.key)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{menu.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {menu.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || loading}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Permissões"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
