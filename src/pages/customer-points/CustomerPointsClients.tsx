// @ts-nocheck
import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Edit2, UserX, UserCheck, Trash2, Gift } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContextType {
  companyId: string;
  pointsName: string;
}

interface Client {
  id: string;
  name: string;
  cpf: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  notes: string | null;
  total_points: number;
  status: "active" | "inactive";
  last_activity_at: string | null;
  created_at: string;
}

export default function CustomerPointsClients() {
  const { companyId, pointsName } = useOutletContext<ContextType>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);

  // Redemption dialog state
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [redeemingClient, setRedeemingClient] = useState<Client | null>(null);
  const [redeemPoints, setRedeemPoints] = useState("");
  const [redeemDescription, setRedeemDescription] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    phone: "",
    email: "",
    birth_date: "",
    notes: "",
  });

  useEffect(() => {
    if (companyId) fetchClients();
  }, [companyId, statusFilter]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("customer_points_clients")
        .select("*")
        .eq("company_id", companyId)
        .order("total_points", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setClients((data || []) as Client[]);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    return cleaned
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .slice(0, 14);
  };

  const validateCPF = (cpf: string): boolean => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return false;
    if (/^(\d)\1+$/.test(cleaned)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned[i]) * (10 - i);
    }
    let digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== parseInt(cleaned[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned[i]) * (11 - i);
    }
    digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== parseInt(cleaned[10])) return false;

    return true;
  };

  const resetForm = () => {
    setFormData({ name: "", cpf: "", phone: "", email: "", birth_date: "", notes: "" });
    setEditingClient(null);
  };

  const openEditDialog = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      cpf: formatCPF(client.cpf),
      phone: client.phone || "",
      email: client.email || "",
      birth_date: client.birth_date || "",
      notes: client.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const cleanedCPF = formData.cpf.replace(/\D/g, "");
    if (!validateCPF(cleanedCPF)) {
      toast.error("CPF inválido");
      return;
    }

    setSaving(true);
    try {
      // Check for duplicate CPF
      const { data: existing } = await supabase
        .from("customer_points_clients")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("cpf", cleanedCPF)
        .neq("id", editingClient?.id || "00000000-0000-0000-0000-000000000000")
        .maybeSingle();

      if (existing) {
        toast.error(`CPF já cadastrado para o cliente: ${existing.name}`);
        setSaving(false);
        return;
      }

      const clientData = {
        company_id: companyId,
        name: formData.name.trim(),
        cpf: cleanedCPF,
        phone: formData.phone || null,
        email: formData.email || null,
        birth_date: formData.birth_date || null,
        notes: formData.notes || null,
      };

      if (editingClient) {
        const { error } = await supabase
          .from("customer_points_clients")
          .update(clientData)
          .eq("id", editingClient.id);
        if (error) throw error;
        toast.success("Cliente atualizado!");
      } else {
        const { error } = await supabase
          .from("customer_points_clients")
          .insert(clientData);
        if (error) throw error;
        toast.success("Cliente cadastrado!");
      }

      setDialogOpen(false);
      resetForm();
      fetchClients();
    } catch (error: any) {
      console.error("Error saving client:", error);
      toast.error(error.message || "Erro ao salvar cliente");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (client: Client) => {
    const newStatus = client.status === "active" ? "inactive" : "active";
    try {
      const { error } = await supabase
        .from("customer_points_clients")
        .update({ status: newStatus })
        .eq("id", client.id);
      if (error) throw error;
      toast.success(`Cliente ${newStatus === "active" ? "ativado" : "desativado"}`);
      fetchClients();
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const deleteClient = async (client: Client) => {
    try {
      // First delete all transactions for this client
      const { error: txError } = await supabase
        .from("customer_points_transactions")
        .delete()
        .eq("client_id", client.id);
      
      if (txError) throw txError;

      // Then delete the client
      const { error } = await supabase
        .from("customer_points_clients")
        .delete()
        .eq("id", client.id);
      
      if (error) throw error;
      
      toast.success("Cliente excluído com sucesso");
      fetchClients();
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error("Erro ao excluir cliente");
    }
  };

  // Redemption functions
  const openRedeemDialog = (client: Client) => {
    setRedeemingClient(client);
    setRedeemPoints("");
    setRedeemDescription("");
    setRedeemDialogOpen(true);
  };

  const handleRedeem = async () => {
    if (!redeemingClient) return;

    const pointsToRedeem = parseInt(redeemPoints);
    if (isNaN(pointsToRedeem) || pointsToRedeem <= 0) {
      toast.error("Informe uma quantidade válida de pontos");
      return;
    }

    if (pointsToRedeem > redeemingClient.total_points) {
      toast.error(`O cliente possui apenas ${redeemingClient.total_points.toLocaleString()} ${pointsName.toLowerCase()}`);
      return;
    }

    setRedeeming(true);
    try {
      // Create redemption transaction (negative points)
      const { error: txError } = await supabase
        .from("customer_points_transactions")
        .insert({
          client_id: redeemingClient.id,
          company_id: companyId,
          cpf: redeemingClient.cpf,
          points: -pointsToRedeem, // Negative to subtract
          source: "redemption",
          form_responses: {
            description: redeemDescription || "Resgate de pontos",
            redeemed_points: pointsToRedeem,
          },
        });

      if (txError) throw txError;

      // Update client total points
      const newTotal = redeemingClient.total_points - pointsToRedeem;
      const { error: updateError } = await supabase
        .from("customer_points_clients")
        .update({ 
          total_points: newTotal,
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", redeemingClient.id);

      if (updateError) throw updateError;

      toast.success(`${pointsToRedeem.toLocaleString()} ${pointsName.toLowerCase()} resgatados com sucesso!`);
      setRedeemDialogOpen(false);
      fetchClients();
    } catch (error: any) {
      console.error("Error redeeming points:", error);
      toast.error(error.message || "Erro ao resgatar pontos");
    } finally {
      setRedeeming(false);
    }
  };

  const filteredClients = clients.filter((client) => {
    const searchLower = search.toLowerCase();
    return (
      client.name.toLowerCase().includes(searchLower) ||
      client.cpf.includes(search.replace(/\D/g, "")) ||
      client.email?.toLowerCase().includes(searchLower) ||
      client.phone?.includes(search)
    );
  });

  const displayCPF = (cpf: string) => formatCPF(cpf);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gerencie os clientes finais e seus pontos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <Label htmlFor="birth_date">Data de nascimento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações sobre o cliente..."
                  rows={3}
                />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Salvando..." : editingClient ? "Salvar alterações" : "Cadastrar cliente"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF, e-mail ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-right">{pointsName}</TableHead>
                    <TableHead>Última atividade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{displayCPF(client.cpf)}</TableCell>
                      <TableCell>{client.phone || "-"}</TableCell>
                      <TableCell className="text-right font-bold">
                        {client.total_points.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {client.last_activity_at
                          ? format(new Date(client.last_activity_at), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={client.status === "active" ? "default" : "secondary"}>
                          {client.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {client.total_points > 0 && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => openRedeemDialog(client)}
                              title="Converter pontos em crédito"
                            >
                              <Gift className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(client)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleStatus(client)}>
                            {client.status === "active" ? (
                              <UserX className="h-4 w-4 text-destructive" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Isso excluirá permanentemente o cliente "{client.name}" e todo o histórico de {pointsName.toLowerCase()}. Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteClient(client)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redemption Dialog */}
      <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Converter {pointsName} em Crédito
            </DialogTitle>
            <DialogDescription>
              Cliente: <strong>{redeemingClient?.name}</strong>
              <br />
              Saldo atual: <strong>{redeemingClient?.total_points.toLocaleString()} {pointsName.toLowerCase()}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="redeemPoints">Quantidade de {pointsName.toLowerCase()} a resgatar *</Label>
              <Input
                id="redeemPoints"
                type="number"
                min="1"
                max={redeemingClient?.total_points || 0}
                value={redeemPoints}
                onChange={(e) => setRedeemPoints(e.target.value)}
                placeholder={`Máximo: ${redeemingClient?.total_points.toLocaleString() || 0}`}
              />
            </div>
            <div>
              <Label htmlFor="redeemDescription">Descrição / Motivo</Label>
              <Textarea
                id="redeemDescription"
                value={redeemDescription}
                onChange={(e) => setRedeemDescription(e.target.value)}
                placeholder="Ex: Desconto de R$ 50,00 na compra"
                rows={2}
              />
            </div>
            <Button 
              onClick={handleRedeem} 
              disabled={redeeming || !redeemPoints} 
              className="w-full gap-2"
            >
              <Gift className="h-4 w-4" />
              {redeeming ? "Processando..." : `Resgatar ${redeemPoints ? parseInt(redeemPoints).toLocaleString() : 0} ${pointsName.toLowerCase()}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
