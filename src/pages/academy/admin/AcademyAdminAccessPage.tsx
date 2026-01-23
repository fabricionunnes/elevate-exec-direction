import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Users,
  Plus,
  Search,
  Trash2,
  Building,
  User,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import type { AcademyUserContext } from "../AcademyLayout";

interface Company {
  id: string;
  name: string;
}

interface OnboardingUser {
  id: string;
  name: string;
  email: string | null;
  company_id: string | null;
  company_name: string | null;
}

interface Track {
  id: string;
  name: string;
}

interface AccessEntry {
  id: string;
  onboarding_user_id: string | null;
  company_id: string | null;
  track_id: string | null;
  access_level: string;
  is_active: boolean;
  granted_at: string;
  user_name: string | null;
  company_name: string | null;
  track_name: string | null;
}

export const AcademyAdminAccessPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [accessList, setAccessList] = useState<AccessEntry[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<OnboardingUser[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accessType, setAccessType] = useState<"user" | "company">("user");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedTrackId, setSelectedTrackId] = useState<string>("all");

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load companies
      const { data: companiesData } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .order("name");
      setCompanies(companiesData || []);

      // Load users with company info
      const { data: usersData } = await supabase
        .from("onboarding_users")
        .select(`
          id, name, email,
          onboarding_projects!inner(onboarding_company_id, onboarding_companies(name))
        `)
        .order("name");

      setUsers(
        (usersData || []).map((u) => {
          const project = u.onboarding_projects as any;
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            company_id: project?.onboarding_company_id || null,
            company_name: project?.onboarding_companies?.name || null,
          };
        })
      );

      // Load tracks
      const { data: tracksData } = await supabase
        .from("academy_tracks")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setTracks(tracksData || []);

      // Load access entries
      const { data: accessData } = await supabase
        .from("academy_user_access")
        .select(`
          *,
          onboarding_users(name),
          onboarding_companies(name),
          academy_tracks(name)
        `)
        .order("granted_at", { ascending: false });

      setAccessList(
        (accessData || []).map((a) => ({
          id: a.id,
          onboarding_user_id: a.onboarding_user_id,
          company_id: a.company_id,
          track_id: a.track_id,
          access_level: a.access_level,
          is_active: a.is_active,
          granted_at: a.granted_at,
          user_name: (a.onboarding_users as any)?.name || null,
          company_name: (a.onboarding_companies as any)?.name || null,
          track_name: (a.academy_tracks as any)?.name || null,
        }))
      );
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    try {
      const accessData: any = {
        access_level: "full",
        is_active: true,
        granted_by: userContext.staffId,
      };

      if (accessType === "user" && selectedUserId) {
        accessData.onboarding_user_id = selectedUserId;
      } else if (accessType === "company" && selectedCompanyId) {
        accessData.company_id = selectedCompanyId;
      } else {
        toast.error("Selecione um usuário ou empresa");
        return;
      }

      if (selectedTrackId !== "all") {
        accessData.track_id = selectedTrackId;
      }

      await supabase.from("academy_user_access").insert([accessData]);
      toast.success("Acesso concedido!");
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error granting access:", error);
      toast.error("Erro ao conceder acesso");
    }
  };

  const handleToggleActive = async (id: string, currentValue: boolean) => {
    try {
      await supabase
        .from("academy_user_access")
        .update({ is_active: !currentValue })
        .eq("id", id);
      
      setAccessList((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: !currentValue } : a))
      );
      toast.success(currentValue ? "Acesso desativado" : "Acesso ativado");
    } catch (error) {
      console.error("Error toggling access:", error);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await supabase.from("academy_user_access").delete().eq("id", deleteId);
      toast.success("Acesso removido!");
      setDeleteId(null);
      loadData();
    } catch (error) {
      console.error("Error deleting access:", error);
      toast.error("Erro ao remover acesso");
    }
  };

  const resetForm = () => {
    setAccessType("user");
    setSelectedUserId("");
    setSelectedCompanyId("");
    setSelectedTrackId("all");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  const filteredAccess = accessList.filter((a) => {
    const searchLower = search.toLowerCase();
    return (
      a.user_name?.toLowerCase().includes(searchLower) ||
      a.company_name?.toLowerCase().includes(searchLower) ||
      a.track_name?.toLowerCase().includes(searchLower)
    );
  });

  if (!userContext.isAdmin) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <h3 className="font-semibold mb-2">Acesso negado</h3>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Acessos</h1>
          <p className="text-muted-foreground mt-1">
            Libere acesso à Academy para usuários e empresas
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Acesso
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, empresa ou trilha..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Access Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Trilha</TableHead>
                <TableHead>Concedido em</TableHead>
                <TableHead className="text-center">Ativo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccess.map((access) => (
                <TableRow key={access.id}>
                  <TableCell>
                    {access.onboarding_user_id ? (
                      <Badge variant="outline" className="gap-1">
                        <User className="h-3 w-3" />
                        Usuário
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Building className="h-3 w-3" />
                        Empresa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {access.user_name || access.company_name || "-"}
                  </TableCell>
                  <TableCell>
                    {access.track_name ? (
                      <Badge variant="secondary" className="gap-1">
                        <BookOpen className="h-3 w-3" />
                        {access.track_name}
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">Todas as trilhas</Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(access.granted_at)}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={access.is_active}
                      onCheckedChange={() => handleToggleActive(access.id, access.is_active)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(access.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredAccess.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Nenhum acesso configurado</h3>
              <p className="text-muted-foreground">
                Adicione acessos para usuários ou empresas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grant Access Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder Acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de acesso</Label>
              <Select value={accessType} onValueChange={(v: "user" | "company") => setAccessType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário individual</SelectItem>
                  <SelectItem value="company">Empresa inteira</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {accessType === "user" ? (
              <div>
                <Label>Usuário</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} {u.company_name && `(${u.company_name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Empresa</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Trilha</Label>
              <Select value={selectedTrackId} onValueChange={setSelectedTrackId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as trilhas</SelectItem>
                  {tracks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGrantAccess}>
                Conceder Acesso
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover permanentemente este acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AcademyAdminAccessPage;
