import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, DollarSign } from "lucide-react";
import { FINANCIAL_PERMISSION_STRUCTURE } from "@/types/staffPermissions";

interface Props {
  staffId: string;
  staffRole: string;
  hasFinancialMenuAccess: boolean;
}

export function StaffFinancialPermissions({ staffId, staffRole, hasFinancialMenuAccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (hasFinancialMenuAccess) fetchPermissions();
  }, [staffId, hasFinancialMenuAccess]);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("staff_financial_permissions")
        .select("permission_key")
        .eq("staff_id", staffId);
      if (error) throw error;
      setPermissions((data || []).map(p => p.permission_key));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: string) => {
    setPermissions(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setPermissions(FINANCIAL_PERMISSION_STRUCTURE.map(p => p.key));
  };

  const handleClearAll = () => {
    setPermissions([]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from("staff_financial_permissions").delete().eq("staff_id", staffId);
      if (permissions.length > 0) {
        const { error } = await supabase.from("staff_financial_permissions").insert(
          permissions.map(permission_key => ({ staff_id: staffId, permission_key }))
        );
        if (error) throw error;
      }
      toast.success("Permissões financeiras salvas!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (!hasFinancialMenuAccess) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        <DollarSign className="h-5 w-5 mx-auto mb-2 opacity-50" />
        Habilite o menu "Módulo Financeiro" acima para configurar sub-permissões.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grouped = FINANCIAL_PERMISSION_STRUCTURE.reduce((acc, p) => {
    if (!acc[p.group]) acc[p.group] = [];
    acc[p.group].push(p);
    return acc;
  }, {} as Record<string, typeof FINANCIAL_PERMISSION_STRUCTURE[number][]>);

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Permissões Financeiras</span>
          <Badge variant="outline" className="text-xs">{permissions.length} de {FINANCIAL_PERMISSION_STRUCTURE.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleSelectAll}>Todos</Button>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleClearAll}>Nenhum</Button>
        </div>
      </div>

      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{group}</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {items.map(item => (
              <label
                key={item.key}
                className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors text-sm ${
                  permissions.includes(item.key)
                    ? "bg-primary/5 border-primary/30"
                    : "bg-background hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  checked={permissions.includes(item.key)}
                  onCheckedChange={() => handleToggle(item.key)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end pt-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Salvar Permissões Financeiras
        </Button>
      </div>
    </div>
  );
}
