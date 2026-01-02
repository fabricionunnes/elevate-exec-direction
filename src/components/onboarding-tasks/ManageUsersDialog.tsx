import { useState } from "react";
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
import { Loader2, Plus, Trash2, Copy, Eye, EyeOff } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OnboardingUser {
  id: string;
  name: string;
  email: string;
  role: "cs" | "consultant" | "client";
  password_changed: boolean;
  temp_password?: string;
}

interface ManageUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  users: OnboardingUser[];
  onUsersChanged: () => void;
}

export const ManageUsersDialog = ({
  open,
  onOpenChange,
  projectId,
  users,
  onUsersChanged,
}: ManageUsersDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "client" as "cs" | "consultant" | "client",
  });
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const generateTempPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleAddUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      toast.error("Preencha nome e email");
      return;
    }

    setLoading(true);
    try {
      const tempPassword = generateTempPassword();

      // Use edge function to create user
      const { data, error } = await supabase.functions.invoke("create-onboarding-user", {
        body: {
          email: newUser.email.trim(),
          password: tempPassword,
          name: newUser.name.trim(),
          project_id: projectId,
          role: newUser.role,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Usuário criado com sucesso!");
      setNewUser({ name: "", email: "", role: "client" });
      setShowAddForm(false);
      onUsersChanged();
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Erro ao criar usuário");
    } finally {
      setLoading(false);
    }
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

  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password);
    toast.success("Senha copiada!");
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "cs":
        return <Badge className="bg-blue-500">CS</Badge>;
      case "consultant":
        return <Badge className="bg-purple-500">Consultor</Badge>;
      case "client":
        return <Badge variant="outline">Cliente</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Usuários</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Users table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Senha Temp.</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
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
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário adicionado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Add user form */}
          {showAddForm ? (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    placeholder="Nome do usuário"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@empresa.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: "cs" | "consultant" | "client") =>
                    setNewUser({ ...newUser, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cs">CS (Customer Success)</SelectItem>
                    <SelectItem value="consultant">Consultor</SelectItem>
                    <SelectItem value="client">Cliente (Dono da Empresa)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddUser} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Adicionar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddForm(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Usuário
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
