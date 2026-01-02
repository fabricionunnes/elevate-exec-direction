import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Key } from "lucide-react";

interface ClientSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  userEmail: string;
}

export const ClientSettingsSheet = ({
  open,
  onOpenChange,
  userName,
  userEmail,
}: ClientSettingsSheetProps) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
      setCurrentPassword("");
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Configurações</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
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
      </SheetContent>
    </Sheet>
  );
};
