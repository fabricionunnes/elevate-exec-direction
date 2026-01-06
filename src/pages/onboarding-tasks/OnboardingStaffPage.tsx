import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatPhone } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, UserCheck, UserX, Search, Trash2, LogOut } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type StaffRole = "cs" | "consultant" | "admin" | "closer" | "sdr" | "rh" | "marketing" | "financeiro";

interface Staff {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  user_id: string | null;
}

const OnboardingStaffPage = () => {
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingMember, setDeletingMember] = useState<Staff | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "cs" as StaffRole,
    phone: "",
    password: "",
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_staff")
        .select("*")
        .order("name");

      if (error) throw error;
      setStaff((data || []) as Staff[]);
    } catch (error: any) {
      console.error("Error fetching staff:", error);
      toast.error("Erro ao carregar equipe");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      let userId: string | null = null;

      // Se for novo membro, criar/atualizar login via backend (sem trocar a sessão do admin)
      if (!editingStaff) {
        const { data: result, error: fnError } = await supabase.functions.invoke("create-staff-user", {
          body: {
            email: formData.email,
            password: formData.password,
            name: formData.name,
            role: formData.role,
            phone: formData.phone || null,
          },
        });

        if (fnError) throw fnError;
        userId = (result?.user_id as string | undefined) ?? null;

        if (!userId) {
          throw new Error("Não foi possível vincular o login ao membro.");
        }
      }

      if (editingStaff) {
        const { error } = await supabase
          .from("onboarding_staff")
          .update({
            name: formData.name,
            email: formData.email,
            role: formData.role,
            phone: formData.phone || null,
          })
          .eq("id", editingStaff.id);

        if (error) throw error;
        toast.success("Membro atualizado com sucesso");
      } else {
        toast.success("Membro cadastrado e login vinculado com sucesso");
      }

      setShowDialog(false);
      setEditingStaff(null);
      setFormData({ name: "", email: "", role: "cs", phone: "", password: "" });
      fetchStaff();
    } catch (error: any) {
      console.error("Error saving staff:", error);
      toast.error(error.message || "Erro ao salvar membro");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (member: Staff) => {
    try {
      const { error } = await supabase
        .from("onboarding_staff")
        .update({ is_active: !member.is_active })
        .eq("id", member.id);

      if (error) throw error;
      toast.success(member.is_active ? "Membro desativado" : "Membro ativado");
      fetchStaff();
    } catch (error: any) {
      console.error("Error toggling status:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const openDeleteDialog = (member: Staff) => {
    setDeletingMember(member);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!deletingMember) return;
    
    try {
      const { data, error } = await supabase.functions.invoke("create-staff-user", {
        method: "DELETE",
        body: {
          staff_id: deletingMember.id,
          delete_auth_user: true,
        },
      });

      if (error) throw error;
      toast.success("Membro excluído com sucesso");
      setShowDeleteDialog(false);
      setDeletingMember(null);
      fetchStaff();
    } catch (error: any) {
      console.error("Error deleting staff:", error);
      toast.error(error.message || "Erro ao excluir membro");
    }
  };

  const openEditDialog = (member: Staff) => {
    setEditingStaff(member);
    setFormData({
      name: member.name,
      email: member.email,
      role: member.role,
      phone: member.phone || "",
      password: "",
    });
    setShowDialog(true);
  };

  const openNewDialog = () => {
    setEditingStaff(null);
    setFormData({ name: "", email: "", role: "cs", phone: "", password: "" });
    setShowDialog(true);
  };

  const filteredStaff = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-amber-500">Admin</Badge>;
      case "cs":
        return <Badge className="bg-blue-500">CS</Badge>;
      case "consultant":
        return <Badge className="bg-purple-500">Consultor</Badge>;
      case "closer":
        return <Badge className="bg-green-500">Closer</Badge>;
      case "sdr":
        return <Badge className="bg-cyan-500">SDR/SS</Badge>;
      case "rh":
        return <Badge className="bg-pink-500">RH</Badge>;
      case "marketing":
        return <Badge className="bg-orange-500">Marketing</Badge>;
      case "financeiro":
        return <Badge className="bg-teal-500">Financeiro</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Equipe UNV</h1>
              <p className="text-muted-foreground">
                Gerencie CS e Consultores
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={openNewDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Membro
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/onboarding-tasks/login");
              }}
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{staff.length}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-500">
                {staff.filter((s) => s.role === "cs").length}
              </div>
              <div className="text-sm text-muted-foreground">CS</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-500">
                {staff.filter((s) => s.role === "consultant").length}
              </div>
              <div className="text-sm text-muted-foreground">Consultores</div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastrado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.map((member) => (
                <TableRow key={member.id} className={!member.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{getRoleBadge(member.role)}</TableCell>
                  <TableCell>{formatPhone(member.phone) || "-"}</TableCell>
                  <TableCell>
                    {member.is_active ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 border-red-600">
                        Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(member.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(member)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleStatus(member)}
                        title={member.is_active ? "Desativar" : "Ativar"}
                      >
                        {member.is_active ? (
                          <UserX className="h-4 w-4 text-red-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(member)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredStaff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum membro encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? "Editar Membro" : "Novo Membro da Equipe"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Função *</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData({ ...formData, role: v as StaffRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="cs">CS (Customer Success)</SelectItem>
                  <SelectItem value="consultant">Consultor</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                  <SelectItem value="sdr">SDR/SS</SelectItem>
                  <SelectItem value="rh">RH</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            {!editingStaff && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha de Acesso *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  O membro poderá usar este email e senha para fazer login
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingStaff ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deletingMember?.name}</strong>?
              {deletingMember?.user_id && (
                <span className="block mt-2 text-destructive">
                  O login deste usuário também será removido do sistema.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OnboardingStaffPage;
