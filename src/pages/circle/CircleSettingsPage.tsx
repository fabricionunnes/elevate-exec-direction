import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  User, 
  Bell, 
  Shield, 
  Camera,
  Save,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";

export default function CircleSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useCircleCurrentProfile();

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Initialize form when profile loads
  if (profile && !initialized) {
    setDisplayName(profile.display_name || "");
    setBio((profile as any).bio || "");
    setCompanyName(profile.company_name || "");
    setRoleTitle(profile.role_title || "");
    setWhatsapp((profile as any).whatsapp || "");
    setInitialized(true);
  }

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("circle_profiles")
        .update({
          display_name: displayName,
          bio,
          company_name: companyName,
          role_title: roleTitle,
          whatsapp: whatsapp.replace(/\D/g, ""),
        })
        .eq("id", profile.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Configurações salvas!" });
      queryClient.invalidateQueries({ queryKey: ["circle-profile"] });
      queryClient.invalidateQueries({ queryKey: ["circle-profile-current"] });
    },
    onError: () => {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Perfil
          </CardTitle>
          <CardDescription>
            Gerencie suas informações públicas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">
                {profile?.display_name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm">
              <Camera className="h-4 w-4 mr-2" />
              Alterar foto
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome de exibição</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>

            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Conte um pouco sobre você..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Sua empresa"
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="Seu cargo"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações
          </CardTitle>
          <CardDescription>
            Configure como você recebe notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Notificações por email</p>
              <p className="text-sm text-muted-foreground">
                Receber atualizações importantes por email
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacidade
          </CardTitle>
          <CardDescription>
            Controle quem pode ver suas informações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Perfil público</p>
              <p className="text-sm text-muted-foreground">
                Permitir que outros usuários vejam seu perfil
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Mostrar estatísticas</p>
              <p className="text-sm text-muted-foreground">
                Exibir pontos e nível no perfil
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button 
        onClick={() => updateMutation.mutate()}
        disabled={updateMutation.isPending}
        className="w-full"
        size="lg"
      >
        {updateMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Salvar Configurações
          </>
        )}
      </Button>
    </div>
  );
}
