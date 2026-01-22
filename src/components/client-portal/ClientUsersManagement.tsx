import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Copy, Eye, EyeOff, Settings2, Users } from "lucide-react";
import type { OnboardingUser, ClientRole, ClientMenuKey } from "@/types/onboarding";
import { 
  CLIENT_CREATABLE_ROLES, 
  ROLE_LABELS, 
  ROLE_COLORS, 
  CLIENT_MENU_STRUCTURE,
  CLIENT_MENU_KEYS,
  isClientRole
} from "@/types/onboarding";

interface Salesperson {
  id: string;
  name: string;
  email: string | null;
}

interface ClientUsersManagementProps {
  projectId: string;
  companyId: string;
  onClose: () => void;
}

export const ClientUsersManagement = ({
  projectId,
  companyId,
  onClose,
}: ClientUsersManagementProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<OnboardingUser[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OnboardingUser | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "" as ClientRole | "",
    salesperson_id: "",
  });

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, salespeopleRes] = await Promise.all([
        supabase
          .from("onboarding_users")
          .select("*")
          .eq("project_id", projectId)
          .order("name"),
        supabase
          .from("company_salespeople")
          .select("id, name, email")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (usersRes.error) throw usersRes.error;
      setUsers(usersRes.data || []);
      setSalespeople(salespeopleRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!formData.role) {
      toast.error("Selecione um cargo");
      return;
    }

    if (formData.role === "vendedor" && !formData.salesperson_id) {
      toast.error("Selecione um vendedor");
      return;
    }

    if (formData.role !== "vendedor") {
      if (!formData.name.trim() || !formData.email.trim()) {
        toast.error("Preencha nome e email");
        return;
      }
      if (!formData.password.trim() || formData.password.length < 6) {
        toast.error("A senha deve ter pelo menos 6 caracteres");
        return;
      }
    }

    setSaving(true);
    try {
      if (formData.role === "vendedor") {
        // Para vendedor, vincular ao vendedor existente
        const salesperson = salespeople.find(s => s.id === formData.salesperson_id);
        if (!salesperson) {
          toast.error("Vendedor não encontrado");
          return;
        }

        if (!salesperson.email) {
          toast.error("Este vendedor não possui email cadastrado");
          return;
        }

        // Check if already linked
        const existingUser = users.find(u => u.salesperson_id === formData.salesperson_id);
        if (existingUser) {
          toast.error("Este vendedor já possui um usuário vinculado");
          return;
        }

        // Create user via edge function
        const { data, error } = await supabase.functions.invoke("create-onboarding-user", {
          body: {
            email: salesperson.email.trim(),
            password: formData.password.trim(),
            name: salesperson.name.trim(),
            project_id: projectId,
            role: "vendedor",
            salesperson_id: formData.salesperson_id,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        // Para outros roles, criar usuário normalmente
        const { data, error } = await supabase.functions.invoke("create-onboarding-user", {
          body: {
            email: formData.email.trim(),
            password: formData.password.trim(),
            name: formData.name.trim(),
            project_id: projectId,
            role: formData.role,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      toast.success("Usuário criado com sucesso!");
      setShowAddDialog(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("onboarding_users")
        .delete()
        .eq("id", deleteUserId);

      if (error) throw error;

      toast.success("Usuário removido");
      setDeleteUserId(null);
      loadData();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Erro ao remover usuário");
    } finally {
      setSaving(false);
    }
  };

  const openPermissionsDialog = async (user: OnboardingUser) => {
    setSelectedUser(user);
    setUserPermissions([]);
    
    try {
      const { data, error } = await supabase
        .from("client_user_permissions")
        .select("menu_key")
        .eq("user_id", user.id);

      if (error) throw error;
      setUserPermissions((data || []).map(p => p.menu_key));
    } catch (error) {
      console.error("Error loading permissions:", error);
    }
    
    setShowPermissionsDialog(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      // Delete existing permissions
      await supabase
        .from("client_user_permissions")
        .delete()
        .eq("user_id", selectedUser.id);

      // Insert new permissions
      if (userPermissions.length > 0) {
        const { error } = await supabase
          .from("client_user_permissions")
          .insert(
            userPermissions.map(menu_key => ({
              user_id: selectedUser.id,
              menu_key,
            }))
          );

        if (error) throw error;
      }

      toast.success("Permissões salvas com sucesso!");
      setShowPermissionsDialog(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error("Error saving permissions:", error);
      toast.error(error.message || "Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (menuKey: string) => {
    setUserPermissions(prev => 
      prev.includes(menuKey) 
        ? prev.filter(k => k !== menuKey)
        : [...prev, menuKey]
    );
  };

  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password);
    toast.success("Senha copiada!");
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "",
      salesperson_id: "",
    });
  };

  const getRoleBadge = (role: string) => {
    const label = ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role;
    const colorClass = ROLE_COLORS[role as keyof typeof ROLE_COLORS] || "bg-gray-100 text-gray-800";
    return <Badge className={colorClass}>{label}</Badge>;
  };

  // Filter out already linked salespeople
  const availableSalespeople = salespeople.filter(
    sp => !users.some(u => u.salesperson_id === sp.id)
  );

  // Roles that require permission configuration (gerente included)
  const needsPermissions = (role: string) => 
    ["gerente", "vendedor", "rh_client", "estoque", "financeiro"].includes(role);

  // Filter users: only show client-side roles (not staff)
  const clientUsers = users.filter(u => isClientRole(u.role));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h3 className="font-semibold">Usuários do Sistema</h3>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {clientUsers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum usuário cadastrado. Clique em "Novo Usuário" para adicionar.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Senha</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>
                    {user.password_changed ? (
                      <span className="text-muted-foreground text-sm">Alterada</span>
                    ) : user.temp_password ? (
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-sm">
                          {showPasswords[user.id] ? user.temp_password : "••••••••"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            setShowPasswords((prev) => ({ ...prev, [user.id]: !prev[user.id] }))
                          }
                        >
                          {showPasswords[user.id] ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyPassword(user.temp_password!)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {needsPermissions(user.role) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openPermissionsDialog(user)}
                          title="Configurar permissões"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      )}
                      {/* Don't allow deleting the main client user */}
                      {user.role !== "client" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteUserId(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select 
                value={formData.role} 
                onValueChange={(v) => setFormData({ ...formData, role: v as ClientRole, salesperson_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cargo" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_CREATABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.role === "vendedor" ? (
              <>
                <div className="space-y-2">
                  <Label>Vendedor</Label>
                  <Select 
                    value={formData.salesperson_id} 
                    onValueChange={(v) => setFormData({ ...formData, salesperson_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSalespeople.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Nenhum vendedor disponível
                        </div>
                      ) : (
                        availableSalespeople.map((sp) => (
                          <SelectItem key={sp.id} value={sp.id}>
                            {sp.name} {sp.email && <span className="text-muted-foreground">({sp.email})</span>}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    O vendedor deve ter um email cadastrado para criar o acesso.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </>
            ) : formData.role ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      placeholder="Nome completo"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="email@empresa.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddUser} disabled={saving || !formData.role}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Permissões de Menus - {selectedUser?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Selecione os menus que este usuário pode acessar:
            </p>

            {CLIENT_MENU_STRUCTURE.map((menu) => (
              <div key={menu.key} className="flex items-center space-x-2">
                <Checkbox
                  id={menu.key}
                  checked={userPermissions.includes(menu.key)}
                  onCheckedChange={() => togglePermission(menu.key)}
                />
                <label
                  htmlFor={menu.key}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {menu.label}
                </label>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermissionsDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePermissions} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar Permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O usuário perderá acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
