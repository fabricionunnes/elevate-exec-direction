import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Key, Users } from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { ClientUsersManagement } from "./ClientUsersManagement";

interface ClientSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  userEmail: string;
  userRole?: string;
  projectId?: string;
  companyId?: string;
}

export const ClientSettingsSheet = ({
  open,
  onOpenChange,
  userName,
  userEmail,
  userRole,
  projectId,
  companyId,
}: ClientSettingsSheetProps) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Only client and gerente can manage users
  const canManageUsers = userRole === "client" || userRole === "gerente";

  useEffect(() => {
    if (open) {
      fetchAvatarUrl();
    }
  }, [open]);

  const fetchAvatarUrl = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: onboardingUser } = await supabase
        .from("onboarding_users")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (onboardingUser) {
        setAvatarUrl(onboardingUser.avatar_url);
      }
    } catch (error) {
      console.error("Error fetching avatar:", error);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch (error) {
      console.error("Password change error:", error);
      toast.error("Erro ao alterar senha");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (url: string | null) => {
    setAvatarUrl(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] rounded-t-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Configurações</SheetTitle>
        </SheetHeader>

        {canManageUsers && projectId && companyId ? (
          <Tabs defaultValue="account" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="account" className="gap-2">
                <Key className="h-4 w-4" />
                Minha Conta
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                Usuários
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-6">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center py-4 border-b">
                <AvatarUpload
                  currentAvatarUrl={avatarUrl}
                  userName={userName || "Usuário"}
                  onAvatarChange={handleAvatarChange}
                  size="lg"
                />
              </div>

              {/* User info */}
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{userName}</p>
                <p className="text-sm text-muted-foreground">{userEmail}</p>
              </div>

              {/* Change password section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">Alterar Senha</h3>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Nova Senha</Label>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Confirmar Nova Senha</Label>
                    <Input
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={handleChangePassword}
                    className="w-full"
                    disabled={loading || !newPassword || !confirmPassword}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Alterando...
                      </>
                    ) : (
                      "Alterar Senha"
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <ClientUsersManagement
                projectId={projectId}
                companyId={companyId}
                onClose={() => {}}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center py-4 border-b">
              <AvatarUpload
                currentAvatarUrl={avatarUrl}
                userName={userName || "Usuário"}
                onAvatarChange={handleAvatarChange}
                size="lg"
              />
            </div>

            {/* User info */}
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{userName}</p>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
            </div>

            {/* Change password section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Alterar Senha</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nova Senha</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Confirmar Nova Senha</Label>
                  <Input
                    type="password"
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleChangePassword}
                  className="w-full"
                  disabled={loading || !newPassword || !confirmPassword}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Alterando...
                    </>
                  ) : (
                    "Alterar Senha"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
