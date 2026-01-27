import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Bell, 
  Shield, 
  Save,
  Loader2,
  BarChart3
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";
import { CircleAvatarUpload } from "@/components/circle/CircleAvatarUpload";
import { DigestSettingsCard } from "@/components/circle/DigestSettingsCard";
import { TrustScoreBadge } from "@/components/circle/TrustScoreBadge";
import { useCircleTrustEvents } from "@/hooks/useCircleTrustScore";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  // Trust events
  const { data: trustEvents } = useCircleTrustEvents(profile?.id);

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

  const trustScore = (profile as any)?.trust_score ?? 50;
  const isVerified = (profile as any)?.is_verified ?? false;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="trust">Trust Score</TabsTrigger>
          <TabsTrigger value="privacy">Privacidade</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
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
                {profile && (
                  <CircleAvatarUpload
                    profileId={profile.id}
                    currentAvatarUrl={profile.avatar_url}
                    displayName={profile.display_name || "U"}
                    size="lg"
                    onAvatarChange={() => {
                      queryClient.invalidateQueries({ queryKey: ["circle-profile-current"] });
                    }}
                  />
                )}
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

              <Button 
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="w-full"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Perfil
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
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

          {/* Digest Settings */}
          <DigestSettingsCard />
        </TabsContent>

        {/* Trust Score Tab */}
        <TabsContent value="trust" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Seu Trust Score
              </CardTitle>
              <CardDescription>
                Sua pontuação de confiança na comunidade
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Score */}
              <div className="flex items-center justify-center py-6">
                <div className="text-center">
                  <TrustScoreBadge 
                    score={trustScore} 
                    isVerified={isVerified} 
                    size="lg"
                    showLabel
                  />
                  <p className="text-4xl font-bold mt-4">{trustScore}/100</p>
                  <p className="text-muted-foreground mt-1">
                    {isVerified ? "Conta Verificada ✓" : "Conta não verificada"}
                  </p>
                </div>
              </div>

              {/* How to improve */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-medium">Como melhorar seu Trust Score:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ Receba depoimentos positivos</li>
                  <li>✓ Participe ativamente das comunidades</li>
                  <li>✓ Mantenha interações positivas</li>
                  <li>✓ Evite comportamentos que gerem denúncias</li>
                </ul>
              </div>

              {/* Recent Events */}
              {trustEvents && trustEvents.length > 0 && (
                <div className="space-y-3">
                  <p className="font-medium">Histórico recente</p>
                  <div className="space-y-2">
                    {trustEvents.slice(0, 5).map((event: any) => (
                      <div 
                        key={event.id}
                        className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                      >
                        <div>
                          <p>{event.description || event.event_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(event.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                        <span className={event.points >= 0 ? "text-green-500" : "text-red-500"}>
                          {event.points >= 0 ? "+" : ""}{event.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-6">
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Mostrar Trust Score</p>
                  <p className="text-sm text-muted-foreground">
                    Exibir sua pontuação de confiança
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
