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
import { toast } from "sonner";
import { Plus, Copy, ExternalLink, Link2, ArrowLeft } from "lucide-react";
import { getPublicBaseUrl } from "@/lib/publicDomain";

interface Salesperson {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  access_code: string;
  is_active: boolean;
}

interface ClientSalesLinksPanelProps {
  companyId: string;
  onBack?: () => void;
  canAddSalespeople?: boolean;
}

export const ClientSalesLinksPanel = ({
  companyId,
  onBack,
  canAddSalespeople = true,
}: ClientSalesLinksPanelProps) => {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    fetchSalespeople();
  }, [companyId]);

  const fetchSalespeople = async () => {
    try {
      const { data, error } = await supabase
        .from("company_salespeople")
        .select("id, name, email, phone, access_code, is_active")
        .eq("company_id", companyId)
        .order("name");

      if (error) throw error;
      setSalespeople(data || []);
    } catch (error) {
      console.error("Error fetching salespeople:", error);
      toast.error("Erro ao carregar vendedores");
    } finally {
      setLoading(false);
    }
  };

  const getEntryLink = (accessCode: string) => {
    return `${getPublicBaseUrl()}/#/kpi-entry/${companyId}?code=${accessCode}`;
  };

  const copyLink = (person: Salesperson) => {
    navigator.clipboard.writeText(getEntryLink(person.access_code));
    toast.success(`Link do ${person.name} copiado!`);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const openLink = (person: Salesperson) => {
    window.open(getEntryLink(person.access_code), "_blank");
  };

  const handleAddSalesperson = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("company_salespeople").insert({
        company_id: companyId,
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
      });

      if (error) throw error;
      toast.success("Vendedor cadastrado!");
      setShowAddDialog(false);
      setFormData({ name: "", email: "", phone: "" });
      fetchSalespeople();
    } catch (error: any) {
      console.error("Error adding salesperson:", error);
      toast.error(error.message || "Erro ao cadastrar vendedor");
    } finally {
      setSaving(false);
    }
  };

  const activeSalespeople = salespeople.filter((sp) => sp.is_active);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Links de Lançamento
            </h3>
            <p className="text-sm text-muted-foreground">
              Links individuais para cada vendedor lançar vendas
            </p>
          </div>
        </div>
        {canAddSalespeople && (
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Vendedor
          </Button>
        )}
      </div>

      {/* Salespeople list */}
      {activeSalespeople.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhum vendedor ativo cadastrado.</p>
            {canAddSalespeople && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Vendedor
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeSalespeople.map((person) => (
                <TableRow key={person.id}>
                  <TableCell className="font-medium">{person.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {person.email || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="font-mono cursor-pointer hover:bg-secondary/80"
                      onClick={() => copyCode(person.access_code)}
                    >
                      {person.access_code}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyLink(person)}
                        title="Copiar link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openLink(person)}
                        title="Abrir link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Salesperson Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Vendedor</DialogTitle>
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
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddSalesperson} disabled={saving}>
              {saving ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
