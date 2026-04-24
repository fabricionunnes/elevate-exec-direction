import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, Shield, Search, Loader2, Save, Crown, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PROFILE_MENU_STRUCTURE,
  PROFILE_GROUPS,
  type ProfileMenuKey,
} from "@/types/profilePermissions";
import { isMasterRole, STAFF_ROLE_LABELS, type StaffRole } from "@/types/staffPermissions";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  avatar_url: string | null;
  is_active: boolean;
}

const ALL_PROFILE_KEYS = PROFILE_MENU_STRUCTURE.map((m) => m.key);

export default function UNVProfilePermissionsPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [permissions, setPermissions] = useState<Set<ProfileMenuKey>>(new Set());
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const { data, error } = await supabase
        .from("onboarding_staff")
        .select("id, name, email, role, avatar_url, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setStaffList((data || []) as StaffMember[]);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar equipe: " + (err.message || ""));
    } finally {
      setLoadingStaff(false);
    }
  };

  const loadPermissions = async (staff: StaffMember) => {
    setLoadingPerms(true);
    setSelectedStaff(staff);
    try {
      const { data, error } = await supabase
        .from("staff_menu_permissions")
        .select("menu_key")
        .eq("staff_id", staff.id);
      if (error) throw error;
      const profileOnly = (data || [])
        .map((r) => r.menu_key as string)
        .filter((k): k is ProfileMenuKey => ALL_PROFILE_KEYS.includes(k as ProfileMenuKey));
      setPermissions(new Set(profileOnly));
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar permissões: " + (err.message || ""));
    } finally {
      setLoadingPerms(false);
    }
  };

  const toggle = (key: ProfileMenuKey) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectAll = () => setPermissions(new Set(ALL_PROFILE_KEYS));
  const handleClearAll = () => setPermissions(new Set());

  const handleSave = async () => {
    if (!selectedStaff) return;
    setSaving(true);
    try {
      // Remove apenas as permissões do escopo Profile (mantém outras intactas)
      await supabase
        .from("staff_menu_permissions")
        .delete()
        .eq("staff_id", selectedStaff.id)
        .in("menu_key", ALL_PROFILE_KEYS as unknown as string[]);

      const rows = [...permissions].map((menu_key) => ({
        staff_id: selectedStaff.id,
        menu_key,
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from("staff_menu_permissions").insert(rows);
        if (error) throw error;
      }
      toast.success(`Permissões salvas para ${selectedStaff.name}`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [staffList, search]);

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const isMaster = selectedStaff ? isMasterRole(selectedStaff.role) : false;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" /> Permissões do UNV Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Libere quais menus do UNV Profile cada membro da equipe (Staff) pode visualizar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Lista de staff */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Equipe Staff
            </CardTitle>
            <div className="relative mt-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou e-mail"
                className="pl-8 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-2">
            {loadingStaff ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredStaff.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhum membro encontrado.
              </p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-1">
                {filteredStaff.map((s) => {
                  const active = selectedStaff?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => loadPermissions(s)}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors",
                        active
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted border border-transparent",
                      )}
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={s.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {initials(s.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {STAFF_ROLE_LABELS[s.role] || s.role}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Painel de permissões */}
        <Card>
          {!selectedStaff ? (
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-50" />
              Selecione um membro da equipe ao lado para configurar as permissões dele no UNV Profile.
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={selectedStaff.avatar_url || undefined} />
                      <AvatarFallback>{initials(selectedStaff.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{selectedStaff.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{selectedStaff.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{STAFF_ROLE_LABELS[selectedStaff.role] || selectedStaff.role}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {isMaster ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 flex items-start gap-3">
                    <Crown className="w-5 h-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900 dark:text-amber-200">Usuário Master</p>
                      <p className="text-sm text-amber-800/80 dark:text-amber-300/80">
                        Possui acesso total ao UNV Profile. Não é possível restringir suas permissões.
                      </p>
                    </div>
                  </div>
                ) : loadingPerms ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm text-muted-foreground">
                        {permissions.size} de {ALL_PROFILE_KEYS.length} menus liberados
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleSelectAll}>
                          Marcar todos
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleClearAll}>
                          Desmarcar todos
                        </Button>
                      </div>
                    </div>

                    <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-5">
                      {PROFILE_GROUPS.map((group) => {
                        const items = PROFILE_MENU_STRUCTURE.filter((m) => m.group === group);
                        if (items.length === 0) return null;
                        return (
                          <div key={group} className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">
                              {group}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {items.map((m) => {
                                const checked = permissions.has(m.key);
                                return (
                                  <button
                                    key={m.key}
                                    type="button"
                                    onClick={() => toggle(m.key)}
                                    className={cn(
                                      "flex items-start gap-2 rounded-md border p-2.5 text-left transition-colors",
                                      checked
                                        ? "border-primary/40 bg-primary/5"
                                        : "border-border hover:bg-muted/40 opacity-80",
                                    )}
                                  >
                                    <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground">{m.label}</p>
                                      <p className="text-xs text-muted-foreground line-clamp-2">
                                        {m.description}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-end pt-3 border-t">
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Salvando…
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Salvar permissões
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
