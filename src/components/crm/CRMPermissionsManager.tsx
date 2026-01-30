import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Shield, ChevronDown, ChevronRight, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Permission definitions
const CRM_PERMISSIONS = [
  {
    category: "Leads",
    permissions: [
      { key: "lead_create", label: "Criar leads", description: "Pode criar novos leads" },
      { key: "lead_edit", label: "Editar leads", description: "Pode editar informações de leads" },
      { key: "lead_delete", label: "Excluir leads", description: "Pode remover leads do sistema" },
      { key: "lead_move", label: "Mover entre etapas", description: "Pode mover leads no pipeline" },
      { key: "lead_win", label: "Marcar como ganho", description: "Pode marcar lead como ganho/vendido" },
      { key: "lead_lose", label: "Marcar como perdido", description: "Pode marcar lead como perdido" },
      { key: "lead_import", label: "Importar leads", description: "Pode importar leads via planilha" },
    ]
  },
  {
    category: "Atividades",
    permissions: [
      { key: "activity_create", label: "Criar atividades", description: "Pode agendar tarefas e atividades" },
      { key: "activity_edit", label: "Editar atividades", description: "Pode modificar atividades existentes" },
      { key: "activity_delete", label: "Excluir atividades", description: "Pode remover atividades" },
    ]
  },
  {
    category: "Configurações",
    permissions: [
      { key: "pipeline_manage", label: "Gerenciar pipelines", description: "Pode criar/editar/excluir pipelines e etapas" },
      { key: "tags_manage", label: "Gerenciar tags", description: "Pode criar/editar/excluir tags" },
      { key: "origins_manage", label: "Gerenciar origens", description: "Pode configurar origens de leads" },
      { key: "reasons_manage", label: "Gerenciar motivos", description: "Pode configurar motivos de perda" },
    ]
  },
  {
    category: "Relatórios",
    permissions: [
      { key: "reports_view", label: "Visualizar relatórios", description: "Pode acessar relatórios do CRM" },
      { key: "reports_export", label: "Exportar relatórios", description: "Pode exportar dados e relatórios" },
    ]
  }
];

const ROLE_LABELS: Record<string, string> = {
  master: "Master",
  admin: "Administrador",
  closer: "Closer",
  sdr: "SDR",
  head_comercial: "Head Comercial",
  social_setter: "Social Setter",
  bdr: "BDR",
  cs: "CS",
  consultant: "Consultor",
  rh: "RH",
  financeiro: "Financeiro",
  marketing: "Marketing",
};

const ROLE_COLORS: Record<string, string> = {
  master: "bg-gradient-to-r from-amber-500 to-yellow-400 text-white",
  admin: "bg-purple-100 text-purple-800",
  closer: "bg-cyan-100 text-cyan-800",
  sdr: "bg-teal-100 text-teal-800",
  head_comercial: "bg-orange-100 text-orange-800",
  social_setter: "bg-indigo-100 text-indigo-800",
  bdr: "bg-emerald-100 text-emerald-800",
  cs: "bg-blue-100 text-blue-800",
  consultant: "bg-green-100 text-green-800",
  rh: "bg-pink-100 text-pink-800",
  financeiro: "bg-slate-100 text-slate-800",
  marketing: "bg-rose-100 text-rose-800",
};

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  has_crm_access: boolean;
}

interface StaffPermissions {
  [staffId: string]: Set<string>;
}

export const CRMPermissionsManager = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingAccess, setTogglingAccess] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [permissions, setPermissions] = useState<StaffPermissions>({});
  const [originalPermissions, setOriginalPermissions] = useState<StaffPermissions>({});
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Check for changes
    const changed = Object.keys(permissions).some(staffId => {
      const current = permissions[staffId];
      const original = originalPermissions[staffId] || new Set();
      if (current.size !== original.size) return true;
      for (const perm of current) {
        if (!original.has(perm)) return true;
      }
      return false;
    });
    setHasChanges(changed);
  }, [permissions, originalPermissions]);

  // Roles that should appear in CRM access management
  const CRM_VISIBLE_ROLES = ["master", "admin", "closer", "sdr", "head_comercial", "social_setter", "bdr"];

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch only staff from commercial sector + admins (exclude cs and consultant)
      const { data: staff, error: staffError } = await supabase
        .from("onboarding_staff")
        .select("id, name, email, role, avatar_url")
        .eq("is_active", true)
        .in("role", CRM_VISIBLE_ROLES)
        .order("name");

      if (staffError) throw staffError;

      // Fetch CRM menu permissions
      const { data: menuPerms, error: menuError } = await supabase
        .from("staff_menu_permissions")
        .select("staff_id")
        .eq("menu_key", "crm");

      if (menuError) throw menuError;

      const crmAccessSet = new Set((menuPerms || []).map(p => p.staff_id));

      // Map all staff with their CRM access status - only master has automatic access
      const allStaff: StaffMember[] = (staff || []).map(s => ({
        ...s,
        has_crm_access: s.role === "master" || crmAccessSet.has(s.id)
      }));

      // Fetch granular permissions only for those with CRM access
      const staffWithAccess = allStaff.filter(s => s.has_crm_access);
      const staffIds = staffWithAccess.map(s => s.id);
      
      const { data: granularPerms, error: permError } = await supabase
        .from("crm_staff_permissions")
        .select("staff_id, permission_key")
        .in("staff_id", staffIds);

      if (permError) throw permError;

      // Build permissions map
      const permsMap: StaffPermissions = {};
      for (const s of allStaff) {
        permsMap[s.id] = new Set();
      }
      for (const p of granularPerms || []) {
        if (permsMap[p.staff_id]) {
          permsMap[p.staff_id].add(p.permission_key);
        }
      }

      setStaffMembers(allStaff);
      setPermissions(permsMap);
      
      // Deep clone for original
      const clonedPerms: StaffPermissions = {};
      for (const [key, value] of Object.entries(permsMap)) {
        clonedPerms[key] = new Set(value);
      }
      setOriginalPermissions(clonedPerms);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCRMAccess = async (member: StaffMember) => {
    // Only master has automatic access that can't be toggled
    if (member.role === "master") {
      toast.info("O usuário Master sempre tem acesso ao CRM");
      return;
    }

    setTogglingAccess(member.id);
    try {
      if (member.has_crm_access) {
        // Remove CRM access
        const { error } = await supabase
          .from("staff_menu_permissions")
          .delete()
          .eq("staff_id", member.id)
          .eq("menu_key", "crm");
        
        if (error) throw error;
        
        // Also remove all granular permissions
        await supabase
          .from("crm_staff_permissions")
          .delete()
          .eq("staff_id", member.id);

        toast.success(`Acesso ao CRM removido para ${member.name}`);
      } else {
        // Grant CRM access
        const { error } = await supabase
          .from("staff_menu_permissions")
          .insert({ staff_id: member.id, menu_key: "crm" });
        
        if (error) throw error;
        toast.success(`Acesso ao CRM concedido para ${member.name}`);
      }

      // Reload data to refresh state
      await loadData();
    } catch (error: any) {
      console.error("Error toggling access:", error);
      toast.error(error.message || "Erro ao alterar acesso");
    } finally {
      setTogglingAccess(null);
    }
  };

  const togglePermission = (staffId: string, permissionKey: string) => {
    setPermissions(prev => {
      const newPerms = { ...prev };
      const staffPerms = new Set(prev[staffId] || []);
      
      if (staffPerms.has(permissionKey)) {
        staffPerms.delete(permissionKey);
      } else {
        staffPerms.add(permissionKey);
      }
      
      newPerms[staffId] = staffPerms;
      return newPerms;
    });
  };

  const toggleAllForStaff = (staffId: string, grant: boolean) => {
    setPermissions(prev => {
      const newPerms = { ...prev };
      if (grant) {
        const allKeys = CRM_PERMISSIONS.flatMap(cat => cat.permissions.map(p => p.key));
        newPerms[staffId] = new Set(allKeys);
      } else {
        newPerms[staffId] = new Set();
      }
      return newPerms;
    });
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      for (const staffId of Object.keys(permissions)) {
        const staff = staffMembers.find(s => s.id === staffId);
        // Only skip master (they have full access) and those without CRM access
        if (!staff || staff.role === "master" || !staff.has_crm_access) continue;

        const currentPerms = permissions[staffId];
        const originalPerms = originalPermissions[staffId] || new Set();

        const toAdd = Array.from(currentPerms).filter(p => !originalPerms.has(p));
        const toRemove = Array.from(originalPerms).filter(p => !currentPerms.has(p));

        if (toRemove.length > 0) {
          const { error } = await supabase
            .from("crm_staff_permissions")
            .delete()
            .eq("staff_id", staffId)
            .in("permission_key", toRemove);
          
          if (error) throw error;
        }

        if (toAdd.length > 0) {
          const { error } = await supabase
            .from("crm_staff_permissions")
            .insert(toAdd.map(key => ({ staff_id: staffId, permission_key: key })));
          
          if (error) throw error;
        }
      }

      toast.success("Permissões salvas com sucesso!");
      
      // Update original permissions
      const newOriginal: StaffPermissions = {};
      for (const [staffId, perms] of Object.entries(permissions)) {
        newOriginal[staffId] = new Set(perms);
      }
      setOriginalPermissions(newOriginal);
      setHasChanges(false);

    } catch (error: any) {
      console.error("Error saving permissions:", error);
      toast.error(error.message || "Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  const toggleExpanded = (staffId: string) => {
    setExpandedStaff(prev => {
      const next = new Set(prev);
      if (next.has(staffId)) {
        next.delete(staffId);
      } else {
        next.add(staffId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Only master has automatic full access now
  const isMasterRole = (role: string) => role === "master";
  const allPermsCount = CRM_PERMISSIONS.reduce((acc, cat) => acc + cat.permissions.length, 0);

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Settings2 className="h-6 w-6 text-blue-600 mt-0.5" />
            <div>
            <h3 className="font-semibold text-blue-900">Acessos e Permissões do CRM</h3>
              <p className="text-sm text-blue-700 mt-1">
                Habilite ou desabilite o acesso ao CRM para cada membro e clique para expandir e configurar permissões específicas.
                Somente o Master tem acesso total automático. Administradores precisam de liberação explícita.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur p-4 border rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Você tem alterações não salvas</p>
            <Button onClick={savePermissions} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Permissões
            </Button>
          </div>
        </div>
      )}

      {/* Staff List */}
      {staffMembers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum membro da equipe encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {staffMembers.map(member => {
            const isMaster = isMasterRole(member.role);
            const isExpanded = expandedStaff.has(member.id);
            const memberPerms = permissions[member.id] || new Set();
            const grantedCount = isMaster ? allPermsCount : memberPerms.size;
            const canExpand = member.has_crm_access;

            return (
              <Card key={member.id} className={!member.has_crm_access ? "opacity-60" : ""}>
                <div className="flex items-center justify-between p-4">
                  <div 
                    className={`flex items-center gap-3 flex-1 ${canExpand ? "cursor-pointer" : ""}`}
                    onClick={() => canExpand && toggleExpanded(member.id)}
                  >
                    {canExpand && (
                      isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )
                    )}
                    {!canExpand && <div className="w-5" />}
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback>
                        {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.name}</span>
                        <Badge className={ROLE_COLORS[member.role] || "bg-gray-100 text-gray-800"}>
                          {ROLE_LABELS[member.role] || member.role}
                        </Badge>
                        {isMaster && (
                          <Badge variant="outline" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Acesso total
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {member.has_crm_access && (
                      <div className="text-right mr-2">
                        <span className="text-sm font-medium">
                          {grantedCount}/{allPermsCount}
                        </span>
                        <p className="text-xs text-muted-foreground">permissões</p>
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-1">
                      <Switch
                        checked={member.has_crm_access}
                        onCheckedChange={() => handleToggleCRMAccess(member)}
                        disabled={togglingAccess === member.id || isMaster}
                      />
                      <span className="text-xs text-muted-foreground">
                        {member.has_crm_access ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Permissions */}
                {canExpand && isExpanded && (
                  <CardContent className="pt-0 border-t">
                    {isMaster ? (
                      <div className="bg-muted/50 p-4 rounded-lg text-center mt-4">
                        <Shield className="h-8 w-8 mx-auto text-primary mb-2" />
                        <p className="text-sm text-muted-foreground">
                          O usuário Master tem acesso total automático a todas as funcionalidades do CRM.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6 mt-4">
                        {/* Quick Actions */}
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAllForStaff(member.id, true);
                            }}
                          >
                            Marcar todas
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAllForStaff(member.id, false);
                            }}
                          >
                            Desmarcar todas
                          </Button>
                        </div>

                        {/* Permission Categories */}
                        {CRM_PERMISSIONS.map(category => (
                          <div key={category.category}>
                            <h4 className="font-medium text-sm mb-3">{category.category}</h4>
                            <div className="grid sm:grid-cols-2 gap-3">
                              {category.permissions.map(perm => (
                                <div
                                  key={perm.key}
                                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Checkbox
                                    id={`${member.id}-${perm.key}`}
                                    checked={memberPerms.has(perm.key)}
                                    onCheckedChange={() => togglePermission(member.id, perm.key)}
                                  />
                                  <label 
                                    htmlFor={`${member.id}-${perm.key}`}
                                    className="flex-1 cursor-pointer"
                                  >
                                    <span className="font-medium text-sm">{perm.label}</span>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {perm.description}
                                    </p>
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
