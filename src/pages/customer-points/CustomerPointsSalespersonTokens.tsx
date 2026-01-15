import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Users, Link2, ExternalLink, UserPlus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContextType {
  companyId: string;
  pointsName: string;
}

interface SalespersonToken {
  id: string;
  name: string;
  access_token: string;
  is_active: boolean;
  created_at: string;
}

interface RegisteredSalesperson {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export default function CustomerPointsSalespersonTokens() {
  const { companyId, pointsName } = useOutletContext<ContextType>();
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<SalespersonToken[]>([]);
  const [registeredSalespeople, setRegisteredSalespeople] = useState<RegisteredSalesperson[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("");
  const [createMode, setCreateMode] = useState<"existing" | "new">("existing");

  const publicDomain = "https://unvholdings.com.br";

  useEffect(() => {
    if (companyId) {
      fetchTokens();
      fetchRegisteredSalespeople();
    }
  }, [companyId]);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_points_salesperson_tokens")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error("Error fetching tokens:", error);
      toast.error("Erro ao carregar tokens");
    } finally {
      setLoading(false);
    }
  };

  const fetchRegisteredSalespeople = async () => {
    try {
      const { data, error } = await supabase
        .from("company_salespeople")
        .select("id, name, email, phone")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setRegisteredSalespeople(data || []);
    } catch (error) {
      console.error("Error fetching salespeople:", error);
    }
  };

  // Get salespeople that don't have a token yet
  const availableSalespeople = registeredSalespeople.filter(
    (sp) => !tokens.some((t) => t.name.toLowerCase() === sp.name.toLowerCase())
  );

  const handleCreate = async () => {
    let salespersonName = "";

    if (createMode === "existing") {
      if (!selectedSalesperson) {
        toast.error("Selecione um vendedor");
        return;
      }
      const sp = registeredSalespeople.find((s) => s.id === selectedSalesperson);
      if (!sp) {
        toast.error("Vendedor não encontrado");
        return;
      }
      salespersonName = sp.name;
    } else {
      if (!newName.trim()) {
        toast.error("Nome do vendedor é obrigatório");
        return;
      }
      salespersonName = newName.trim();
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("customer_points_salesperson_tokens")
        .insert({
          company_id: companyId,
          name: salespersonName,
        });

      if (error) throw error;

      toast.success("Link criado com sucesso!");
      setDialogOpen(false);
      setNewName("");
      setSelectedSalesperson("");
      fetchTokens();
    } catch (error) {
      console.error("Error creating token:", error);
      toast.error("Erro ao criar link");
    } finally {
      setSaving(false);
    }
  };

  const createAllLinks = async () => {
    if (availableSalespeople.length === 0) {
      toast.info("Todos os vendedores já possuem links");
      return;
    }

    setSaving(true);
    try {
      const inserts = availableSalespeople.map((sp) => ({
        company_id: companyId,
        name: sp.name,
      }));

      const { error } = await supabase
        .from("customer_points_salesperson_tokens")
        .insert(inserts);

      if (error) throw error;

      toast.success(`${availableSalespeople.length} links criados!`);
      fetchTokens();
    } catch (error) {
      console.error("Error creating all tokens:", error);
      toast.error("Erro ao criar links");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (token: SalespersonToken) => {
    try {
      const { error } = await supabase
        .from("customer_points_salesperson_tokens")
        .update({ is_active: !token.is_active })
        .eq("id", token.id);

      if (error) throw error;
      toast.success(token.is_active ? "Link desativado" : "Link ativado");
      fetchTokens();
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const deleteToken = async (tokenId: string) => {
    try {
      const { error } = await supabase
        .from("customer_points_salesperson_tokens")
        .delete()
        .eq("id", tokenId);

      if (error) throw error;
      toast.success("Link excluído");
      fetchTokens();
    } catch (error) {
      console.error("Error deleting token:", error);
      toast.error("Erro ao excluir link");
    }
  };

  const getFormUrl = (token: SalespersonToken) => {
    return `${publicDomain}/#/points-salesperson?token=${token.access_token}`;
  };

  const copyLink = async (token: SalespersonToken) => {
    await navigator.clipboard.writeText(getFormUrl(token));
    toast.success("Link copiado!");
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Links para Vendedores</h1>
          <p className="text-muted-foreground">
            Gere links para vendedores registrarem {pointsName.toLowerCase()} de clientes
          </p>
        </div>
        <div className="flex gap-2">
          {availableSalespeople.length > 0 && (
            <Button variant="outline" className="gap-2" onClick={createAllLinks} disabled={saving}>
              <UserPlus className="h-4 w-4" />
              Criar para todos ({availableSalespeople.length})
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Link para Vendedor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {registeredSalespeople.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant={createMode === "existing" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCreateMode("existing")}
                    >
                      Vendedor cadastrado
                    </Button>
                    <Button
                      variant={createMode === "new" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCreateMode("new")}
                    >
                      Novo nome
                    </Button>
                  </div>
                )}

                {createMode === "existing" && registeredSalespeople.length > 0 ? (
                  <div>
                    <Label>Selecione o vendedor *</Label>
                    <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um vendedor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSalespeople.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            Todos os vendedores já possuem links
                          </div>
                        ) : (
                          availableSalespeople.map((sp) => (
                            <SelectItem key={sp.id} value={sp.id}>
                              {sp.name}
                              {sp.email && <span className="text-muted-foreground ml-2">({sp.email})</span>}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vendedores cadastrados no sistema de KPIs
                    </p>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="name">Nome do vendedor *</Label>
                    <Input
                      id="name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ex: João Silva"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Este nome aparecerá no formulário e nas transações registradas
                    </p>
                  </div>
                )}
                
                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving ? "Criando..." : "Criar Link"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Registered Salespeople Info */}
      {registeredSalespeople.length > 0 && (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {registeredSalespeople.length} vendedor(es) cadastrado(s) no projeto
                </p>
                <p className="text-xs text-muted-foreground">
                  {availableSalespeople.length > 0
                    ? `${availableSalespeople.length} ainda sem link criado`
                    : "Todos já possuem links"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tokens List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Links Criados
          </CardTitle>
          <CardDescription>
            Cada vendedor tem um link único para registrar pontos
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {tokens.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum link criado ainda. Crie o primeiro link para seus vendedores.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">{token.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          ...{token.access_token.slice(-8)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyLink(token)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => window.open(getFormUrl(token), "_blank")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(token.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={token.is_active}
                          onCheckedChange={() => toggleStatus(token)}
                        />
                        <Badge variant={token.is_active ? "default" : "secondary"}>
                          {token.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir link?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O link do vendedor "{token.name}" será excluído permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteToken(token.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
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
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1. Crie um link para cada vendedor da sua equipe</p>
          <p>2. Envie o link para o vendedor (WhatsApp, e-mail, etc.)</p>
          <p>3. O vendedor abre o link no celular e registra os pontos dos clientes</p>
          <p>4. Não é necessário login - basta o CPF do cliente</p>
          <p>5. Você pode ver todas as transações registradas na aba "Transações"</p>
        </CardContent>
      </Card>
    </div>
  );
}
