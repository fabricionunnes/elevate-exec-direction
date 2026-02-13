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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, LayoutGrid } from "lucide-react";
import { CLIENT_MENU_STRUCTURE } from "@/types/onboarding";

interface ProjectMenuPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export const ProjectMenuPermissionsDialog = ({
  open,
  onOpenChange,
  projectId,
}: ProjectMenuPermissionsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabledMenus, setEnabledMenus] = useState<Set<string>>(new Set());
  const [hasExistingConfig, setHasExistingConfig] = useState(false);

  useEffect(() => {
    if (open && projectId) {
      fetchPermissions();
    }
  }, [open, projectId]);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_menu_permissions")
        .select("menu_key, is_enabled")
        .eq("project_id", projectId);

      if (error) throw error;

      if (data && data.length > 0) {
        setHasExistingConfig(true);
        const enabled = new Set(
          data.filter((p) => p.is_enabled).map((p) => p.menu_key)
        );
        setEnabledMenus(enabled);
      } else {
        // No config yet = all menus enabled
        setHasExistingConfig(false);
        setEnabledMenus(new Set(CLIENT_MENU_STRUCTURE.map((m) => m.key)));
      }
    } catch (error) {
      console.error("Error fetching project menu permissions:", error);
      toast.error("Erro ao carregar permissões de menu");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (menuKey: string) => {
    setEnabledMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuKey)) {
        next.delete(menuKey);
      } else {
        next.add(menuKey);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setEnabledMenus(new Set(CLIENT_MENU_STRUCTURE.map((m) => m.key)));
  };

  const handleClearAll = () => {
    setEnabledMenus(new Set());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing config
      await supabase
        .from("project_menu_permissions")
        .delete()
        .eq("project_id", projectId);

      // Insert all menu keys with their enabled state
      const rows = CLIENT_MENU_STRUCTURE.map((menu) => ({
        project_id: projectId,
        menu_key: menu.key,
        is_enabled: enabledMenus.has(menu.key),
      }));

      const { error } = await supabase
        .from("project_menu_permissions")
        .insert(rows);

      if (error) throw error;

      toast.success("Menus do projeto atualizados com sucesso!");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving project menu permissions:", error);
      toast.error(error.message || "Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  // Group menus
  const groupedMenus = CLIENT_MENU_STRUCTURE.reduce((acc, menu) => {
    const group = menu.group || "Outros";
    if (!acc[group]) acc[group] = [];
    acc[group].push(menu);
    return acc;
  }, {} as Record<string, Array<{ key: string; label: string; group: string | null }>>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Menus do Projeto
          </DialogTitle>
          <DialogDescription>
            Defina quais menus ficarão disponíveis para os usuários clientes deste projeto.
            {!hasExistingConfig && (
              <span className="block text-xs mt-1 text-amber-600">
                Nenhuma configuração encontrada. Todos os menus estão habilitados por padrão.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Quick actions */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {enabledMenus.size} de {CLIENT_MENU_STRUCTURE.length} menus habilitados
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Marcar Todos
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearAll}>
                  Desmarcar Todos
                </Button>
              </div>
            </div>

            {/* Menus by group */}
            {Object.entries(groupedMenus).map(([groupName, menus]) => (
              <div key={groupName} className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground border-b pb-1">
                  {groupName}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {menus.map((menu) => (
                    <label
                      key={menu.key}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        enabledMenus.has(menu.key)
                          ? "bg-primary/5 border-primary/30"
                          : "bg-background hover:bg-muted/50 opacity-60"
                      }`}
                    >
                      <Checkbox
                        checked={enabledMenus.has(menu.key)}
                        onCheckedChange={() => handleToggle(menu.key)}
                      />
                      <span className="font-medium text-sm">{menu.label}</span>
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
              "Salvar Configuração"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
