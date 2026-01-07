import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, RefreshCw, Link, Building2 } from "lucide-react";

interface Salesperson {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  access_code: string;
  is_active: boolean;
  unit_id: string | null;
}

interface Unit {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

interface SalespeopleTabProps {
  companyId: string;
  isAdmin: boolean;
}

export const SalespeopleTab = ({ companyId, isAdmin }: SalespeopleTabProps) => {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Salesperson | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    unit_id: "",
  });

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      const [salespeopleRes, unitsRes] = await Promise.all([
        supabase
          .from("company_salespeople")
          .select("*")
          .eq("company_id", companyId)
          .order("name"),
        supabase
          .from("company_units")
          .select("*")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (salespeopleRes.error) throw salespeopleRes.error;
      if (unitsRes.error) throw unitsRes.error;

      setSalespeople(salespeopleRes.data || []);
      setUnits(unitsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome do vendedor é obrigatório");
      return;
    }

    // If there are multiple units, require unit selection
    if (units.length > 1 && !formData.unit_id) {
      toast.error("Selecione a unidade do vendedor");
      return;
    }

    try {
      const unitId = formData.unit_id || (units.length === 1 ? units[0].id : null);

      if (editingPerson) {
        const { error } = await supabase
          .from("company_salespeople")
          .update({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            unit_id: unitId,
          })
          .eq("id", editingPerson.id);

        if (error) throw error;
        toast.success("Vendedor atualizado");
      } else {
        const { error } = await supabase.from("company_salespeople").insert({
          company_id: companyId,
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          unit_id: unitId,
        });

        if (error) throw error;
        toast.success("Vendedor cadastrado");
      }

      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving salesperson:", error);
      toast.error("Erro ao salvar vendedor");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este vendedor?")) return;

    try {
      const { error } = await supabase
        .from("company_salespeople")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Vendedor excluído");
      fetchData();
    } catch (error) {
      console.error("Error deleting salesperson:", error);
      toast.error("Erro ao excluir vendedor");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("company_salespeople")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      toast.success(isActive ? "Vendedor ativado" : "Vendedor desativado");
      fetchData();
    } catch (error) {
      console.error("Error toggling salesperson:", error);
      toast.error("Erro ao atualizar vendedor");
    }
  };

  const handleRegenerateCode = async (id: string) => {
    try {
      const newCode = Math.random().toString(36).substring(2, 10);
      const { error } = await supabase
        .from("company_salespeople")
        .update({ access_code: newCode })
        .eq("id", id);

      if (error) throw error;
      toast.success("Código de acesso regenerado");
      fetchData();
    } catch (error) {
      console.error("Error regenerating code:", error);
      toast.error("Erro ao regenerar código");
    }
  };

  const copyAccessLink = (person: Salesperson) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/kpi-entry/${companyId}?code=${person.access_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado para a área de transferência");
  };

  const resetForm = () => {
    setEditingPerson(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      unit_id: "",
    });
  };

  const openEditDialog = (person: Salesperson) => {
    setEditingPerson(person);
    setFormData({
      name: person.name,
      email: person.email || "",
      phone: person.phone || "",
      unit_id: person.unit_id || "",
    });
    setShowDialog(true);
  };

  const getUnitName = (unitId: string | null) => {
    if (!unitId) return "-";
    const unit = units.find((u) => u.id === unitId);
    return unit ? unit.name : "-";
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vendedores</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre os vendedores que farão lançamentos de vendas
          </p>
        </div>
        {isAdmin && (
          <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Vendedor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingPerson ? "Editar Vendedor" : "Novo Vendedor"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome do vendedor"
                  />
                </div>

                {units.length > 1 && (
                  <div>
                    <Label>Unidade *</Label>
                    <Select
                      value={formData.unit_id}
                      onValueChange={(v) => setFormData({ ...formData, unit_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@empresa.com"
                  />
                </div>

                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} className="flex-1">
                    {editingPerson ? "Salvar" : "Cadastrar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {salespeople.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhum vendedor cadastrado ainda.</p>
            <p className="text-sm">Cadastre vendedores para que possam lançar suas vendas.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                {units.length > 0 && <TableHead>Unidade</TableHead>}
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Código de Acesso</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-[150px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {salespeople.map((person) => (
                <TableRow key={person.id} className={!person.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{person.name}</TableCell>
                  {units.length > 0 && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{getUnitName(person.unit_id)}</span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>{person.email || "-"}</TableCell>
                  <TableCell>{person.phone || "-"}</TableCell>
                  <TableCell>
                    <code className="bg-muted px-2 py-1 rounded text-sm">{person.access_code}</code>
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Switch
                        checked={person.is_active}
                        onCheckedChange={(v) => handleToggleActive(person.id, v)}
                      />
                    ) : (
                      <Badge variant={person.is_active ? "default" : "secondary"}>
                        {person.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => copyAccessLink(person)} title="Copiar link de acesso">
                          <Link className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleRegenerateCode(person.id)} title="Regenerar código">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(person)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(person.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};
