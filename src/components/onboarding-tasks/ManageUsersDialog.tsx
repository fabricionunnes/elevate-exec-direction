import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { OnboardingUser, OnboardingRole } from "@/types/onboarding";
import { ROLE_LABELS, ROLE_COLORS, isStaffRole as checkIsStaffRole } from "@/types/onboarding";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ManageUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  users: OnboardingUser[];
  onUsersChanged: () => void;
  isAdmin?: boolean;
}

export const ManageUsersDialog = ({
  open,
  onOpenChange,
  projectId,
  users,
  onUsersChanged,
  isAdmin = false,
}: ManageUsersDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "client" as OnboardingRole,
  });
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Vendedores já cadastrados na empresa (pra criar o acesso deles daqui)
  const [salespeople, setSalespeople] = useState<
    { id: string; name: string; email: string | null; user_id: string | null; is_active: boolean }[]
  >([]);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string>("");
  const isSalespersonType = (newUser.role as string) === "salesperson";

  const fetchSalespeople = async () => {
    const { data: proj } = await supabase
      .from("onboarding_projects")
      .select("onboarding_company_id")
      .eq("id", projectId)
      .maybeSingle();
    if (!proj?.onboarding_company_id) return;
    const { data } = await supabase
      .from("company_salespeople")
      .select("id, name, email, user_id, is_active")
      .eq("company_id", proj.onboarding_company_id)
      .order("name");
    setSalespeople((data as any) || []);
  };

  useEffect(() => {
    if (open) fetchSalespeople();
  }, [open, projectId]);
  
  // Change password state
  const [changingPasswordUserId, setChangingPasswordUserId] = useState<string | null>(null);
  const [changingSalespersonId, setChangingSalespersonId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (open) {
      fetchStaffMembers();
    }
  }, [open]);

  const fetchStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_staff")
        .select("id, name, email, role")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
    }
  };

  const generateTempPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const isStaffRole = (role: OnboardingRole) => checkIsStaffRole(role);

  const handleAddUser = async () => {
    // Vendedor existente: cria o login pelo caminho oficial (system-api
    // salespeople/create_login — mesmo usado na aba Vendedores)
    if (isSalespersonType) {
      const sp = salespeople.find((s) => s.id === selectedSalespersonId);
      if (!sp) {
        toast.error("Selecione um vendedor");
        return;
      }
      if (!sp.email) {
        toast.error("Esse vendedor não tem e-mail cadastrado — atualize o cadastro dele primeiro.");
        return;
      }
      if (newUser.password.trim().length < 6) {
        toast.error("Defina uma senha com pelo menos 6 caracteres");
        return;
      }
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error("Sessão expirada — recarregue a página.");
        const params = new URLSearchParams({ module: "salespeople", action: "create_login", id: sp.id });
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/system-api?${params}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ password: newUser.password.trim() }),
          },
        );
        const result = await res.json();
        if (result?.error) throw new Error(result.error);
        toast.success(`Login criado pro vendedor ${sp.name}!`);
        resetForm();
        fetchSalespeople();
        onUsersChanged();
      } catch (error: any) {
        toast.error(error.message || "Erro ao criar login do vendedor");
      } finally {
        setLoading(false);
      }
      return;
    }

    const isStaff = isStaffRole(newUser.role);

    if (isStaff) {
      // Para CS e Consultor, usar staff selecionado
      if (!selectedStaffId) {
        toast.error("Selecione um membro da equipe");
        return;
      }

      const selectedStaff = staffMembers.find((s) => s.id === selectedStaffId);
      if (!selectedStaff) {
        toast.error("Membro da equipe não encontrado");
        return;
      }

      setLoading(true);
      try {
        // Verificar se já existe um usuário com esse email no projeto
        const { data: existingUser } = await supabase
          .from("onboarding_users")
          .select("id")
          .eq("project_id", projectId)
          .eq("email", selectedStaff.email)
          .maybeSingle();

        if (existingUser) {
          toast.error("Este membro já está vinculado ao projeto");
          setLoading(false);
          return;
        }

        // Buscar user_id da tabela onboarding_staff
        const { data: staffRecord } = await supabase
          .from("onboarding_staff")
          .select("user_id")
          .eq("id", selectedStaffId)
          .single();

        // Inserir diretamente na tabela onboarding_users (sem criar auth user)
        const { error } = await supabase.from("onboarding_users").insert({
          project_id: projectId,
          name: selectedStaff.name,
          email: selectedStaff.email,
          role: newUser.role,
          user_id: staffRecord?.user_id || null,
          password_changed: true, // Staff já tem conta
        });

        if (error) throw error;

        toast.success("Membro da equipe vinculado ao projeto!");
        resetForm();
        onUsersChanged();
      } catch (error: any) {
        console.error("Error adding staff user:", error);
        toast.error(error.message || "Erro ao vincular membro");
      } finally {
        setLoading(false);
      }
    } else {
      // Para Cliente, criar usuário com email e senha definida pelo staff
      if (!newUser.name.trim() || !newUser.email.trim()) {
        toast.error("Preencha nome e email");
        return;
      }

      if (!newUser.password.trim() || newUser.password.length < 6) {
        toast.error("Defina uma senha com pelo menos 6 caracteres");
        return;
      }

      setLoading(true);
      try {
        // Use edge function to create user with the password defined by staff
        const { data, error } = await supabase.functions.invoke("create-onboarding-user", {
          body: {
            email: newUser.email.trim(),
            password: newUser.password.trim(),
            name: newUser.name.trim(),
            project_id: projectId,
            role: newUser.role,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast.success("Cliente criado com sucesso!");
        resetForm();
        onUsersChanged();
      } catch (error: any) {
        console.error("Error adding user:", error);
        toast.error(error.message || "Erro ao criar usuário");
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setNewUser({ name: "", email: "", password: "", role: "client" });
    setSelectedStaffId("");
    setShowAddForm(false);
    setShowNewPassword(false);
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("onboarding_users")
        .delete()
        .eq("id", userId);

      if (error) throw error;
      toast.success("Usuário removido");
      onUsersChanged();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error("Erro ao remover usuário");
    }
  };

  const handleDeleteSalespersonLogin = async (spId: string, spName: string) => {
    if (!window.confirm(`Remover o acesso de ${spName}? O cadastro do vendedor e os KPIs continuam — só o login é apagado.`)) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Sessão expirada — recarregue a página.");
      const params = new URLSearchParams({ module: "salespeople", action: "delete_login", id: spId });
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/system-api?${params}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}" },
      );
      const result = await res.json();
      if (result?.error) throw new Error(result.error);
      toast.success(`Acesso de ${spName} removido`);
      fetchSalespeople();
      onUsersChanged();
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover o acesso");
    }
  };

  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password);
    toast.success("Senha copiada!");
  };

  const handleChangePassword = async () => {
    if ((!changingPasswordUserId && !changingSalespersonId) || !newPassword.trim()) {
      toast.error("Digite a nova senha");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    // Senha de VENDEDOR: caminho oficial do system-api (reset_password)
    if (changingSalespersonId) {
      setChangingPassword(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error("Sessão expirada — recarregue a página.");
        const params = new URLSearchParams({ module: "salespeople", action: "reset_password", id: changingSalespersonId });
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/system-api?${params}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ new_password: newPassword.trim() }),
        });
        const result = await res.json();
        if (result?.error) throw new Error(result.error);
        toast.success("Senha do vendedor alterada!");
        setChangingPasswordUserId(null);
        setChangingSalespersonId(null);
        setNewPassword("");
      } catch (error: any) {
        toast.error(error.message || "Erro ao alterar a senha do vendedor");
      } finally {
        setChangingPassword(false);
      }
      return;
    }

    const user = users.find(u => u.id === changingPasswordUserId);
    if (!user) return;

    setChangingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-onboarding-user", {
        body: {
          email: user.email,
          password: newPassword.trim(),
          name: user.name,
          project_id: projectId,
          role: user.role,
          is_password_reset: true,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Senha alterada com sucesso!");
      setChangingPasswordUserId(null);
      setNewPassword("");
      setShowChangePassword(false);
      onUsersChanged();
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast.error(error.message || "Erro ao alterar senha");
    } finally {
      setChangingPassword(false);
    }
  };

  const openChangePasswordDialog = (userId: string) => {
    setChangingPasswordUserId(userId);
    setNewPassword("");
    setShowChangePassword(false);
  };

  const getRoleBadge = (role: OnboardingRole) => {
    const label = ROLE_LABELS[role] || role;
    const colorClass = ROLE_COLORS[role] || "bg-gray-100 text-gray-800";
    return <Badge className={colorClass}>{label}</Badge>;
  };

  const filteredStaff = staffMembers.filter((staff) => {
    if (newUser.role === "cs") return staff.role === "cs";
    if (newUser.role === "consultant") return staff.role === "consultant";
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Usuários</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Users table (contida: e-mails longos não estouram o modal) */}
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Senha Temp.</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium max-w-[160px] truncate" title={user.name}>{user.name}</TableCell>
                  <TableCell className="max-w-[230px] truncate" title={user.email}>{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>
                    {user.role !== "client" ? (
                      <span className="text-muted-foreground text-sm">Staff</span>
                    ) : user.password_changed ? (
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
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {isAdmin && user.role === "client" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openChangePasswordDialog(user.id)}
                          title="Alterar senha"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {/* Vendedores da empresa com login de acesso */}
              {salespeople.filter((sp) => sp.user_id).map((sp) => (
                <TableRow key={`sp-${sp.id}`}>
                  <TableCell className="font-medium max-w-[160px] truncate" title={sp.name}>{sp.name}</TableCell>
                  <TableCell className="max-w-[230px] truncate" title={sp.email || ""}>{sp.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-0">
                      Vendedor
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-sm">Definida no cadastro</span>
                  </TableCell>
                  <TableCell>
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setChangingSalespersonId(sp.id);
                            setChangingPasswordUserId(null);
                            setNewPassword("");
                            setShowChangePassword(false);
                          }}
                          title="Alterar senha do vendedor"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteSalespersonLogin(sp.id, sp.name)}
                          title="Remover o acesso deste vendedor (o cadastro e os KPIs permanecem)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && salespeople.filter((sp) => sp.user_id).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário adicionado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>

          {/* Add user form */}
          {showAddForm ? (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Novo Usuário</h4>
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Usuário</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value: string) => {
                      setNewUser({ ...newUser, role: value as any, name: "", email: "", password: "" });
                      setSelectedStaffId("");
                      setSelectedSalespersonId("");
                      setShowNewPassword(false);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Cliente (Dono da Empresa)</SelectItem>
                      <SelectItem value="cs">CS (Customer Success)</SelectItem>
                      <SelectItem value="consultant">Consultor</SelectItem>
                      <SelectItem value="salesperson">Vendedor (já cadastrado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isSalespersonType ? (
                  // Vendedor existente da empresa: escolhe e define a senha de acesso
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Selecionar Vendedor</Label>
                      <Select value={selectedSalespersonId} onValueChange={setSelectedSalespersonId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione um vendedor da empresa" />
                        </SelectTrigger>
                        <SelectContent>
                          {salespeople.filter((s) => s.is_active).length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              Nenhum vendedor cadastrado nesta empresa
                            </div>
                          ) : (
                            salespeople
                              .filter((s) => s.is_active)
                              .map((sp) => (
                                <SelectItem key={sp.id} value={sp.id} disabled={!!sp.user_id || !sp.email}>
                                  <span>{sp.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {sp.user_id ? "(já tem acesso)" : !sp.email ? "(sem e-mail no cadastro)" : `(${sp.email})`}
                                  </span>
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        O login usa o e-mail do cadastro do vendedor. Quem já tem acesso aparece desabilitado.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Senha do Vendedor</Label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Mínimo 6 caracteres"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : isStaffRole(newUser.role) ? (
                  // Seleção de Staff existente
                  <div className="space-y-2">
                    <Label>Selecionar {newUser.role === "cs" ? "CS" : "Consultor"}</Label>
                    <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={`Selecione um ${newUser.role === "cs" ? "CS" : "Consultor"}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredStaff.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            Nenhum {newUser.role === "cs" ? "CS" : "Consultor"} cadastrado
                          </div>
                        ) : (
                          filteredStaff.map((staff) => (
                            <SelectItem key={staff.id} value={staff.id}>
                              <span>{staff.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">({staff.email})</span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      O membro da equipe será vinculado a este projeto com acesso imediato.
                    </p>
                  </div>
                ) : (
                  // Formulário para Cliente
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nome do Cliente</Label>
                        <Input
                          placeholder="Nome completo"
                          value={newUser.name}
                          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email do Cliente</Label>
                        <Input
                          type="email"
                          placeholder="email@empresa.com"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Senha do Cliente</Label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Mínimo 6 caracteres"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Defina a senha que o cliente usará para acessar o sistema.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button onClick={handleAddUser} disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {isSalespersonType ? "Criar Login do Vendedor" : isStaffRole(newUser.role) ? "Vincular ao Projeto" : "Criar Cliente"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddForm(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Usuário
            </Button>
          )}

          {/* Change Password Dialog */}
          {(changingPasswordUserId || changingSalespersonId) && (
            <div className="border rounded-lg p-4 space-y-4 bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-amber-600" />
                  Alterar Senha
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setChangingPasswordUserId(null);
                    setChangingSalespersonId(null);
                    setNewPassword("");
                    setShowChangePassword(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Alterando senha de: <span className="font-medium text-foreground">{changingSalespersonId ? `${salespeople.find(sp => sp.id === changingSalespersonId)?.name} (vendedor)` : users.find(u => u.id === changingPasswordUserId)?.name}</span>
                </p>
                
                <div className="space-y-2">
                  <Label>Nova Senha</Label>
                  <div className="relative">
                    <Input
                      type={showChangePassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowChangePassword(!showChangePassword)}
                    >
                      {showChangePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleChangePassword} disabled={changingPassword}>
                    {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Alterar Senha
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
