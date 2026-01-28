import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  UserPlus,
  Search,
  Building2,
  Phone,
  Calendar,
  DollarSign,
  Edit,
  RefreshCw,
  Gift,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Referral {
  id: string;
  referrer_company_id: string;
  referrer_project_id: string | null;
  referrer_name: string | null;
  referred_name: string;
  referred_phone: string;
  status: "pending" | "negotiating" | "closed" | "not_closed";
  reward_value: number;
  source: "nps" | "portal";
  notes: string | null;
  closed_at: string | null;
  notified_at: string | null;
  created_at: string;
  referrer_company?: {
    id: string;
    name: string;
  };
  referrer_project?: {
    id: string;
    product_name: string;
  };
}

const statusConfig = {
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  negotiating: { label: "Em Negociação", color: "bg-blue-100 text-blue-800 border-blue-200" },
  closed: { label: "Fechado", color: "bg-green-100 text-green-800 border-green-200" },
  not_closed: { label: "Não Fechado", color: "bg-red-100 text-red-800 border-red-200" },
};

export function ReferralsPanel() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingReferral, setEditingReferral] = useState<Referral | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      setIsAdmin(staff?.role === "admin" || staff?.role === "master");
    };

    checkAdminRole();
  }, []);

  const fetchReferrals = async () => {
    try {
      const { data, error } = await supabase
        .from("client_referrals")
        .select(`
          *,
          referrer_company:onboarding_companies(id, name),
          referrer_project:onboarding_projects(id, product_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReferrals((data as unknown as Referral[]) || []);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      toast.error("Erro ao carregar indicações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("referrals-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_referrals" },
        () => {
          fetchReferrals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateReferral = async () => {
    if (!editingReferral) return;

    try {
      const updates: any = {
        status: editingReferral.status,
        reward_value: editingReferral.reward_value,
        notes: editingReferral.notes,
      };

      // If status changed to closed, set closed_at
      if (editingReferral.status === "closed" && !editingReferral.closed_at) {
        updates.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("client_referrals")
        .update(updates)
        .eq("id", editingReferral.id);

      if (error) throw error;

      toast.success("Indicação atualizada com sucesso!");
      setShowEditDialog(false);
      setEditingReferral(null);
      fetchReferrals();
    } catch (error) {
      console.error("Error updating referral:", error);
      toast.error("Erro ao atualizar indicação");
    }
  };

  const handleDeleteReferral = async (referralId: string) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem excluir indicações");
      return;
    }

    if (!confirm("Tem certeza que deseja excluir esta indicação?")) return;

    try {
      const { error } = await supabase
        .from("client_referrals")
        .delete()
        .eq("id", referralId);

      if (error) throw error;

      toast.success("Indicação excluída com sucesso!");
      setShowEditDialog(false);
      setEditingReferral(null);
      fetchReferrals();
    } catch (error) {
      console.error("Error deleting referral:", error);
      toast.error("Erro ao excluir indicação");
    }
  };

  const filteredReferrals = referrals.filter((r) => {
    const matchesSearch =
      r.referred_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referred_phone.includes(searchTerm) ||
      r.referrer_company?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referrer_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: referrals.length,
    pending: referrals.filter((r) => r.status === "pending").length,
    negotiating: referrals.filter((r) => r.status === "negotiating").length,
    closed: referrals.filter((r) => r.status === "closed").length,
    totalRewards: referrals
      .filter((r) => r.status === "closed")
      .reduce((sum, r) => sum + (r.reward_value || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.negotiating}</p>
                <p className="text-sm text-muted-foreground">Negociando</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.closed}</p>
                <p className="text-sm text-muted-foreground">Fechados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">
                  R$ {stats.totalRewards.toLocaleString("pt-BR")}
                </p>
                <p className="text-sm text-muted-foreground">Em Recompensas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Indicações de Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="negotiating">Em Negociação</SelectItem>
                <SelectItem value="closed">Fechado</SelectItem>
                <SelectItem value="not_closed">Não Fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicado</TableHead>
                  <TableHead>Empresa Indicadora</TableHead>
                  <TableHead>Indicado Por</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReferrals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma indicação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReferrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{referral.referred_name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {referral.referred_phone}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {referral.referrer_company?.name || "-"}
                        </div>
                      </TableCell>
                      <TableCell>{referral.referrer_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {referral.source === "nps" ? "NPS" : "Portal"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[referral.status].color}>
                          {statusConfig[referral.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {referral.reward_value > 0 ? (
                          <span className="text-green-600 font-medium">
                            R$ {referral.reward_value.toLocaleString("pt-BR")}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(referral.created_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingReferral(referral);
                            setShowEditDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Indicação</DialogTitle>
          </DialogHeader>
          {editingReferral && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Indicado</Label>
                  <p className="font-medium">{editingReferral.referred_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Telefone</Label>
                  <p className="font-medium">{editingReferral.referred_phone}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingReferral.status}
                  onValueChange={(value: any) =>
                    setEditingReferral({ ...editingReferral, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="negotiating">Em Negociação</SelectItem>
                    <SelectItem value="closed">Fechado</SelectItem>
                    <SelectItem value="not_closed">Não Fechado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor da Recompensa (R$)</Label>
                <Input
                  type="number"
                  value={editingReferral.reward_value || ""}
                  onChange={(e) =>
                    setEditingReferral({
                      ...editingReferral,
                      reward_value: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={editingReferral.notes || ""}
                  onChange={(e) =>
                    setEditingReferral({ ...editingReferral, notes: e.target.value })
                  }
                  placeholder="Adicione observações sobre esta indicação..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between sm:justify-between">
            <div>
              {isAdmin && editingReferral && (
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteReferral(editingReferral.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateReferral}>Salvar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
