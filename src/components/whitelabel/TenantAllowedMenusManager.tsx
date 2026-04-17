import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Building2, Users } from "lucide-react";
import { STAFF_MENU_STRUCTURE } from "@/types/staffPermissions";
import { CLIENT_MENU_STRUCTURE } from "@/types/onboarding";

export interface AllowedMenusConfig {
  staff: string[];
  client: string[];
}

interface Props {
  tenantId: string;
  tenantName: string;
  initialAllowed: AllowedMenusConfig | null;
  onSaved?: () => void;
}

const ALL_STAFF_KEYS = STAFF_MENU_STRUCTURE.map((m) => m.key as string);
const ALL_CLIENT_KEYS = CLIENT_MENU_STRUCTURE.map((m) => m.key as string);

export function TenantAllowedMenusManager({
  tenantId,
  tenantName,
  initialAllowed,
  onSaved,
}: Props) {
  // null/undefined = nunca configurado → considerar tudo liberado
  const [staff, setStaff] = useState<Set<string>>(new Set());
  const [client, setClient] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStaff(new Set(initialAllowed?.staff ?? ALL_STAFF_KEYS));
    setClient(new Set(initialAllowed?.client ?? ALL_CLIENT_KEYS));
  }, [initialAllowed, tenantId]);

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const groupedStaff = useMemo(() => groupBy(STAFF_MENU_STRUCTURE), []);
  const groupedClient = useMemo(() => groupBy(CLIENT_MENU_STRUCTURE), []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { staff: [...staff], client: [...client] };
      const { error } = await supabase
        .from("whitelabel_tenants")
        .update({
          allowed_menus: payload as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId);
      if (error) throw error;
      toast.success(`Menus liberados atualizados para "${tenantName}"`);
      onSaved?.();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground border-b border-border pb-2">
        Marque os menus que o WL <strong className="text-foreground">{tenantName}</strong> poderá
        habilitar internamente (Staff) e repassar aos clientes dele.
      </div>

      <Tabs defaultValue="client" className="space-y-4">
        <TabsList>
          <TabsTrigger value="client" className="gap-1.5">
            <Users className="h-4 w-4" />
            Menus do Cliente ({client.size}/{ALL_CLIENT_KEYS.length})
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            Menus do Staff WL ({staff.size}/{ALL_STAFF_KEYS.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="client" className="space-y-3">
          <BulkActions
            onAll={() => setClient(new Set(ALL_CLIENT_KEYS))}
            onNone={() => setClient(new Set())}
          />
          <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-4">
            {Object.entries(groupedClient).map(([group, items]) => (
              <MenuGroup
                key={group}
                title={group}
                items={items}
                selected={client}
                onToggle={(k) => toggle(client, k, setClient)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="staff" className="space-y-3">
          <BulkActions
            onAll={() => setStaff(new Set(ALL_STAFF_KEYS))}
            onNone={() => setStaff(new Set())}
          />
          <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-4">
            {Object.entries(groupedStaff).map(([group, items]) => (
              <MenuGroup
                key={group}
                title={group}
                items={items}
                selected={staff}
                onToggle={(k) => toggle(staff, k, setStaff)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Salvando..." : "Salvar menus liberados"}
      </Button>
    </div>
  );
}

function BulkActions({ onAll, onNone }: { onAll: () => void; onNone: () => void }) {
  return (
    <div className="flex gap-2 justify-end">
      <Button variant="outline" size="sm" onClick={onAll}>Marcar todos</Button>
      <Button variant="outline" size="sm" onClick={onNone}>Desmarcar todos</Button>
    </div>
  );
}

function MenuGroup({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: Array<{ key: string; label: string; description?: string }>;
  selected: Set<string>;
  onToggle: (k: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-1">
        {title}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((m) => {
          const checked = selected.has(m.key);
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onToggle(m.key)}
              className={`flex items-start gap-2 rounded-md border p-2.5 text-left transition-colors ${
                checked
                  ? "border-primary/40 bg-primary/5"
                  : "border-border hover:bg-muted/40 opacity-70"
              }`}
            >
              <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.label}</p>
                {m.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function groupBy<T extends { group?: string | null; key: string; label: string; description?: string }>(
  arr: readonly T[],
): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const g = item.group || "Outros";
    (acc[g] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
