import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Trash2, Shield, Crown } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function TenantUsersManagement() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: tenantUsers, isLoading } = useQuery({
    queryKey: ["whitelabel-tenant-users", tenant?.id],
    queryFn: async () => {
      if (!tenant) return [];
      const { data, error } = await supabase
        .from("whitelabel_tenant_users")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!tenant,
  });

  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("whitelabel_tenant_users")
        .delete()
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whitelabel-tenant-users"] });
      toast.success("Usuário removido");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase
        .from("whitelabel_tenant_users")
        .update({ role })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whitelabel-tenant-users"] });
      toast.success("Permissão atualizada");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const roleLabel = (role: string) => {
    switch (role) {
      case "owner": return "Proprietário";
      case "admin": return "Administrador";
      case "member": return "Membro";
      default: return role;
    }
  };

  const roleIcon = (role: string) => {
    switch (role) {
      case "owner": return <Crown className="h-3 w-3" />;
      case "admin": return <Shield className="h-3 w-3" />;
      default: return null;
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "owner": return "default";
      case "admin": return "secondary";
      default: return "outline" as any;
    }
  };

  if (!tenant) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum tenant ativo.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários do Tenant
            </CardTitle>
            <CardDescription>
              Gerencie quem tem acesso à administração da plataforma
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Usuário</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Email do usuário</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Permissão</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="member">Membro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  O usuário precisa ter uma conta no sistema. Após convidar, ele terá acesso ao painel administrativo.
                </p>
                <Button
                  className="w-full"
                  onClick={async () => {
                    if (!inviteEmail.trim()) return;
                    // Look up user by email
                    toast.info("Funcionalidade de convite por email será implementada com Edge Function dedicada.");
                    setDialogOpen(false);
                    setInviteEmail("");
                  }}
                >
                  Enviar Convite
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-3">
            {tenantUsers?.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    {user.user_id?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {user.user_id}
                    </p>
                    <Badge variant={roleColor(user.role)} className="text-xs gap-1">
                      {roleIcon(user.role)}
                      {roleLabel(user.role)}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.role !== "owner" && (
                    <>
                      <Select
                        value={user.role}
                        onValueChange={(role) => updateRole.mutate({ id: user.id, role })}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Membro</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeUser.mutate(user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {(!tenantUsers || tenantUsers.length === 0) && (
              <p className="text-center text-sm text-muted-foreground py-4">
                Nenhum usuário cadastrado neste tenant.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
