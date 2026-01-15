import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, User, Trash2 } from "lucide-react";
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
  total_points: number;
}

interface Rule {
  id: string;
  name: string;
  rule_type: string;
  points_value: number;
  multiplier: number;
}

interface Transaction {
  id: string;
  points: number;
  source: "manual" | "qr_code";
  reference_value: number | null;
  reference_quantity: number | null;
  notes: string | null;
  created_at: string;
  client: { id: string; name: string; cpf: string } | null;
  rule: { id: string; name: string } | null;
}

export default function CustomerPointsTransactions() {
  const { companyId, pointsName } = useOutletContext<ContextType>();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    client_id: "",
    rule_id: "",
    reference_value: "",
    reference_quantity: "",
    notes: "",
  });
  const [clientSearch, setClientSearch] = useState("");
  const [calculatedPoints, setCalculatedPoints] = useState(0);

  useEffect(() => {
    if (companyId) fetchData();
  }, [companyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch transactions
      const { data: transactionsData, error: txError } = await supabase
        .from("customer_points_transactions")
        .select(`
          *,
          client:customer_points_clients(id, name, cpf),
          rule:customer_points_rules(id, name)
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (txError) throw txError;
      setTransactions((transactionsData || []) as Transaction[]);

      // Fetch clients for form
      const { data: clientsData } = await supabase
        .from("customer_points_clients")
        .select("id, name, cpf, total_points")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("name");
      setClients(clientsData || []);

      // Fetch active rules
      const { data: rulesData } = await supabase
        .from("customer_points_rules")
        .select("id, name, rule_type, points_value, multiplier")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("sort_order");
      setRules(rulesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ client_id: "", rule_id: "", reference_value: "", reference_quantity: "", notes: "" });
    setClientSearch("");
    setCalculatedPoints(0);
  };

  // Calculate points when rule or values change
  useEffect(() => {
    if (!formData.rule_id) {
      setCalculatedPoints(0);
      return;
    }

    const rule = rules.find((r) => r.id === formData.rule_id);
    if (!rule) return;

    let points = rule.points_value;

    if (rule.rule_type === "per_value" && formData.reference_value) {
      const value = parseFloat(formData.reference_value);
      points = Math.floor(value / rule.multiplier) * rule.points_value;
    } else if (rule.rule_type === "per_quantity" && formData.reference_quantity) {
      const qty = parseInt(formData.reference_quantity);
      points = qty * rule.points_value;
    }

    setCalculatedPoints(points);
  }, [formData.rule_id, formData.reference_value, formData.reference_quantity, rules]);

  const handleSave = async () => {
    if (!formData.client_id) {
      toast.error("Selecione um cliente");
      return;
    }
    if (!formData.rule_id) {
      toast.error("Selecione uma regra");
      return;
    }
    if (calculatedPoints <= 0) {
      toast.error("Os pontos devem ser maiores que zero");
      return;
    }

    setSaving(true);
    try {
      const client = clients.find((c) => c.id === formData.client_id);
      
      const { error } = await supabase
        .from("customer_points_transactions")
        .insert({
          company_id: companyId,
          client_id: formData.client_id,
          cpf: client?.cpf || "",
          rule_id: formData.rule_id,
          points: calculatedPoints,
          source: "manual",
          reference_value: formData.reference_value ? parseFloat(formData.reference_value) : null,
          reference_quantity: formData.reference_quantity ? parseInt(formData.reference_quantity) : null,
          notes: formData.notes || null,
        });

      if (error) throw error;

      toast.success(`${calculatedPoints} ${pointsName} registrados!`);
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving transaction:", error);
      toast.error(error.message || "Erro ao registrar pontos");
    } finally {
      setSaving(false);
    }
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.**$4");
  };

  const deleteTransaction = async (tx: Transaction) => {
    try {
      const { error } = await supabase
        .from("customer_points_transactions")
        .delete()
        .eq("id", tx.id);
      
      if (error) throw error;
      
      toast.success("Registro excluído com sucesso");
      fetchData();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast.error("Erro ao excluir registro");
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      tx.client?.name.toLowerCase().includes(searchLower) ||
      tx.client?.cpf.includes(search.replace(/\D/g, "")) ||
      tx.rule?.name.toLowerCase().includes(searchLower)
    );
  });

  const filteredClients = clients.filter((client) => {
    if (!clientSearch) return true;
    const searchLower = clientSearch.toLowerCase();
    return (
      client.name.toLowerCase().includes(searchLower) ||
      client.cpf.includes(clientSearch.replace(/\D/g, ""))
    );
  });

  const selectedRule = rules.find((r) => r.id === formData.rule_id);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ações / Registros</h1>
          <p className="text-muted-foreground">Registre e acompanhe os {pointsName.toLowerCase()} dos clientes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Registrar {pointsName}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar {pointsName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Client Search */}
              <div>
                <Label>Cliente *</Label>
                <div className="relative">
                  <Input
                    placeholder="Buscar por nome ou CPF..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="mb-2"
                  />
                  {clientSearch && filteredClients.length > 0 && !formData.client_id && (
                    <div className="absolute z-10 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                      {filteredClients.slice(0, 5).map((client) => (
                        <button
                          key={client.id}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between"
                          onClick={() => {
                            setFormData({ ...formData, client_id: client.id });
                            setClientSearch(client.name);
                          }}
                        >
                          <div>
                            <p className="font-medium">{client.name}</p>
                            <p className="text-xs text-muted-foreground">{formatCPF(client.cpf)}</p>
                          </div>
                          <Badge variant="secondary">{client.total_points} pts</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {formData.client_id && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <User className="h-4 w-4" />
                    <span className="text-sm">{clients.find((c) => c.id === formData.client_id)?.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-6 px-2"
                      onClick={() => {
                        setFormData({ ...formData, client_id: "" });
                        setClientSearch("");
                      }}
                    >
                      Trocar
                    </Button>
                  </div>
                )}
              </div>

              {/* Rule Selection */}
              <div>
                <Label>Regra de pontuação *</Label>
                <Select
                  value={formData.rule_id}
                  onValueChange={(v) => setFormData({ ...formData, rule_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a regra..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rules.map((rule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.name} (+{rule.points_value} pts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional fields based on rule type */}
              {selectedRule?.rule_type === "per_value" && (
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 150.00"
                    value={formData.reference_value}
                    onChange={(e) => setFormData({ ...formData, reference_value: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    A cada R${selectedRule.multiplier} = +{selectedRule.points_value} pontos
                  </p>
                </div>
              )}

              {selectedRule?.rule_type === "per_quantity" && (
                <div>
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 3"
                    value={formData.reference_quantity}
                    onChange={(e) => setFormData({ ...formData, reference_quantity: e.target.value })}
                  />
                </div>
              )}

              <div>
                <Label>Observação</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observação opcional..."
                  rows={2}
                />
              </div>

              {/* Points Preview */}
              <div className="p-4 bg-primary/10 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Pontos a registrar</p>
                <p className="text-3xl font-bold text-primary">{calculatedPoints}</p>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Registrando..." : `Registrar ${calculatedPoints} ${pointsName}`}
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
                placeholder="Buscar por cliente ou regra..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "Nenhum registro encontrado" : "Nenhum registro de pontos ainda"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Regra</TableHead>
                    <TableHead className="text-right">{pointsName}</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tx.client?.name || "-"}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.client?.cpf ? formatCPF(tx.client.cpf) : "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{tx.rule?.name || "-"}</TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        +{tx.points.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <User className="h-3 w-3 mr-1" /> Manual
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {tx.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Isso excluirá permanentemente este registro de {tx.points} {pointsName.toLowerCase()} do cliente "{tx.client?.name}". Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteTransaction(tx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
