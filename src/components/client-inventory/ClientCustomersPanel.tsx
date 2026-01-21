import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  User,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { ClientCustomer } from "./types";
import { BRAZILIAN_STATES } from "./types";

interface Props {
  projectId: string;
  canEdit: boolean;
}

export function ClientCustomersPanel({ projectId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<ClientCustomer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<ClientCustomer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    document: "",
    document_type: "cpf" as "cpf" | "cnpj",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    credit_limit: 0,
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_customers")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCustomers((data as ClientCustomer[]) || []);
    } catch (error) {
      console.error("Error loading customers:", error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setFormData({
      name: "",
      document: "",
      document_type: "cpf",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      postal_code: "",
      credit_limit: 0,
      notes: "",
    });
    setShowDialog(true);
  };

  const openEdit = (customer: ClientCustomer) => {
    setEditing(customer);
    setFormData({
      name: customer.name,
      document: customer.document || "",
      document_type: customer.document_type || "cpf",
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      city: customer.city || "",
      state: customer.state || "",
      postal_code: customer.postal_code || "",
      credit_limit: customer.credit_limit || 0,
      notes: customer.notes || "",
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
      if (editing) {
        const { error } = await supabase
          .from("client_customers")
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editing.id);

        if (error) throw error;
        toast.success("Cliente atualizado com sucesso");
      } else {
        const { error } = await supabase.from("client_customers").insert({
          project_id: projectId,
          ...formData,
        });

        if (error) throw error;
        toast.success("Cliente cadastrado com sucesso");
      }

      setShowDialog(false);
      loadData();
    } catch (error) {
      console.error("Error saving customer:", error);
      toast.error("Erro ao salvar cliente");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer: ClientCustomer) => {
    if (!confirm(`Deseja realmente excluir o cliente "${customer.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("client_customers")
        .update({ is_active: false })
        .eq("id", customer.id);

      if (error) throw error;
      toast.success("Cliente excluído com sucesso");
      loadData();
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error("Erro ao excluir cliente");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDocument = (doc: string, type: string) => {
    if (!doc) return "-";
    if (type === "cpf") {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.document && c.document.includes(searchTerm)) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, documento ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {canEdit && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{customers.length}</p>
            <p className="text-xs text-muted-foreground">clientes ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Limite Total</span>
            </div>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(customers.reduce((sum, c) => sum + c.credit_limit, 0))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Com Saldo</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {customers.filter((c) => c.current_balance > 0).length}
            </p>
            <p className="text-xs text-muted-foreground">clientes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Saldo Devedor</span>
            </div>
            <p className="text-lg font-bold text-red-600">
              {formatCurrency(customers.reduce((sum, c) => sum + c.current_balance, 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Documento</TableHead>
                <TableHead className="hidden md:table-cell">Contato</TableHead>
                <TableHead className="text-right">Limite</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                {canEdit && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {customer.city && customer.state
                            ? `${customer.city}/${customer.state}`
                            : customer.email || "-"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {customer.document_type?.toUpperCase() || "CPF"}
                        </Badge>
                        <span className="text-sm">
                          {formatDocument(customer.document || "", customer.document_type || "cpf")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">
                        {customer.phone && <p>{customer.phone}</p>}
                        {customer.email && (
                          <p className="text-muted-foreground">{customer.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600 font-medium">
                        {formatCurrency(customer.credit_limit)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-medium ${
                          customer.current_balance > 0 ? "text-red-600" : "text-muted-foreground"
                        }`}
                      >
                        {formatCurrency(customer.current_balance)}
                      </span>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(customer)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(customer)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do cliente"
              />
            </div>

            {/* Documento */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.document_type}
                  onValueChange={(v) =>
                    setFormData({ ...formData, document_type: v as "cpf" | "cnpj" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="document">
                  {formData.document_type === "cpf" ? "CPF" : "CNPJ"}
                </Label>
                <Input
                  id="document"
                  value={formData.document}
                  onChange={(e) =>
                    setFormData({ ...formData, document: e.target.value.replace(/\D/g, "") })
                  }
                  placeholder={formData.document_type === "cpf" ? "00000000000" : "00000000000000"}
                  maxLength={formData.document_type === "cpf" ? 11 : 14}
                />
              </div>
            </div>

            {/* Contato */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, complemento"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={formData.state}
                  onValueChange={(v) => setFormData({ ...formData, state: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal_code">CEP</Label>
                <Input
                  id="postal_code"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
            </div>

            {/* Limite de Crédito */}
            <div className="space-y-2">
              <Label htmlFor="credit_limit">Limite de Crédito</Label>
              <Input
                id="credit_limit"
                type="number"
                min={0}
                step={0.01}
                value={formData.credit_limit}
                onChange={(e) =>
                  setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações sobre o cliente..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
