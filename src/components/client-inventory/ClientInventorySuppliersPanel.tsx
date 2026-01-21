import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Truck, Search, Phone, Mail } from "lucide-react";
import type { InventorySupplier } from "./types";

interface Props {
  projectId: string;
  canEdit: boolean;
}

export function ClientInventorySuppliersPanel({ projectId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<InventorySupplier | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    document: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_inventory_suppliers")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error loading suppliers:", error);
      toast.error("Erro ao carregar fornecedores");
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setFormData({
      name: "",
      document: "",
      contact_name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    });
    setShowDialog(true);
  };

  const openEdit = (supplier: InventorySupplier) => {
    setEditing(supplier);
    setFormData({
      name: supplier.name,
      document: supplier.document || "",
      contact_name: supplier.contact_name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        project_id: projectId,
        name: formData.name.trim(),
        document: formData.document.trim() || null,
        contact_name: formData.contact_name.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        notes: formData.notes.trim() || null,
      };

      if (editing) {
        const { error } = await supabase
          .from("client_inventory_suppliers")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Fornecedor atualizado");
      } else {
        const { error } = await supabase
          .from("client_inventory_suppliers")
          .insert(payload);
        if (error) throw error;
        toast.success("Fornecedor criado");
      }

      setShowDialog(false);
      loadData();
    } catch (error: any) {
      console.error("Error saving supplier:", error);
      toast.error(error.message || "Erro ao salvar fornecedor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier: InventorySupplier) => {
    if (!confirm(`Excluir fornecedor "${supplier.name}"?`)) return;

    try {
      const { error } = await supabase
        .from("client_inventory_suppliers")
        .update({ is_active: false })
        .eq("id", supplier.id);
      if (error) throw error;
      toast.success("Fornecedor excluído");
      loadData();
    } catch (error: any) {
      console.error("Error deleting supplier:", error);
      toast.error(error.message || "Erro ao excluir fornecedor");
    }
  };

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.document && s.document.includes(searchTerm))
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Fornecedores</h2>
          <p className="text-sm text-muted-foreground">
            {suppliers.length} fornecedor{suppliers.length !== 1 ? "es" : ""} cadastrado{suppliers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar fornecedores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {canEdit && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Novo
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>CNPJ/CPF</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                {canEdit && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 6 : 5} className="text-center py-8">
                    <Truck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhum fornecedor encontrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <p className="font-medium">{supplier.name}</p>
                    </TableCell>
                    <TableCell>
                      {supplier.document || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {supplier.contact_name || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {supplier.phone ? (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {supplier.phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {supplier.email ? (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {supplier.email}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(supplier)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(supplier)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do fornecedor"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CNPJ/CPF</Label>
                <Input
                  value={formData.document}
                  onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div>
                <Label>Contato</Label>
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="Nome do contato"
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

              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div>
              <Label>Endereço</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Endereço completo"
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
