import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, UserCheck, UserX, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Staff {
  id: string;
  name: string;
  email: string;
  role: "cs" | "consultant" | "admin";
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

const OnboardingStaffPage = () => {
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "cs" as "cs" | "consultant" | "admin",
    phone: "",
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
    
    try {
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
        const { error } = await supabase
          .from("onboarding_staff")
          .insert({
            name: formData.name,
            email: formData.email,
            role: formData.role,
            phone: formData.phone || null,
          });

        if (error) throw error;
        toast.success("Membro cadastrado com sucesso");
      }

      setShowDialog(false);
      setEditingStaff(null);
      setFormData({ name: "", email: "", role: "cs", phone: "" });
      fetchStaff();
    } catch (error: any) {
      console.error("Error saving staff:", error);
      toast.error(error.message || "Erro ao salvar membro");
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

  const openEditDialog = (member: Staff) => {
    setEditingStaff(member);
    setFormData({
      name: member.name,
      email: member.email,
      role: member.role,
      phone: member.phone || "",
    });
    setShowDialog(true);
  };

  const openNewDialog = () => {
    setEditingStaff(null);
    setFormData({ name: "", email: "", role: "cs", phone: "" });
    setShowDialog(true);
  };

  const filteredStaff = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    return role === "cs" ? (
      <Badge className="bg-blue-500">CS</Badge>
    ) : (
      <Badge className="bg-purple-500">Consultor</Badge>
    );
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
          <Button onClick={openNewDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Membro
          </Button>
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
                  <TableCell>{member.phone || "-"}</TableCell>
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
                      >
                        {member.is_active ? (
                          <UserX className="h-4 w-4 text-red-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-500" />
                        )}
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
                onValueChange={(v) => setFormData({ ...formData, role: v as "cs" | "consultant" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cs">CS (Customer Success)</SelectItem>
                  <SelectItem value="consultant">Consultor</SelectItem>
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
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingStaff ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OnboardingStaffPage;
