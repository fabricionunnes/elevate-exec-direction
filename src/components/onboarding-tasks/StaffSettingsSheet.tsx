import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Key, Phone } from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { PhoneInput } from "@/components/ui/phone-input";

interface StaffSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StaffSettingsSheet = ({
  open,
  onOpenChange,
}: StaffSettingsSheetProps) => {
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    if (open) {
      fetchUserData();
    }
  }, [open]);

  const fetchUserData = async () => {
    setLoadingUser(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email || "");

      // Try to get staff data
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, name, avatar_url, phone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (staff) {
        setUserName(staff.name);
        setAvatarUrl(staff.avatar_url);
        setStaffId(staff.id);
        setPhone(staff.phone || "");
        return;
      }

      // Try to get onboarding user data
      const { data: onboardingUser } = await supabase
        .from("onboarding_users")
        .select("name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (onboardingUser) {
        setUserName(onboardingUser.name);
        setAvatarUrl(onboardingUser.avatar_url);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoadingUser(false);
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

  const handleSavePhone = async () => {
    if (!staffId) return;
    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from("onboarding_staff")
        .update({ phone: phone || null })
        .eq("id", staffId);

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Telefone atualizado. É pra esse número que suas notificações do WhatsApp vão.");
    } catch (error) {
      console.error("Phone update error:", error);
      toast.error("Erro ao salvar o telefone");
    } finally {
      setSavingPhone(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Meu Perfil</SheetTitle>
        </SheetHeader>

        {loadingUser ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
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

            {/* Telefone (WhatsApp) */}
            {staffId && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">Telefone</h3>
                </div>
                <div className="space-y-2">
                  <Label>Seu WhatsApp</Label>
                  <PhoneInput value={phone} onChange={setPhone} />
                  <p className="text-xs text-muted-foreground">
                    É pra esse número que suas notificações do WhatsApp são enviadas.
                  </p>
                </div>
                <Button
                  onClick={handleSavePhone}
                  variant="outline"
                  className="w-full"
                  disabled={savingPhone}
                >
                  {savingPhone ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar telefone"
                  )}
                </Button>
              </div>
            )}

            <NotificationPreferences audience="staff" />

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
