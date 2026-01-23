import { useOutletContext } from "react-router-dom";
import { AcademyUserContext } from "./AcademyLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Bell, Palette, Shield, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const AcademySettingsPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [saving, setSaving] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    platformName: "UNV Academy",
    welcomeMessage: "Bem-vindo à UNV Academy! Comece sua jornada de aprendizado.",
    enableEmailNotifications: true,
    enableProgressNotifications: true,
    enableBadgeNotifications: true,
    enableRankingNotifications: false,
    primaryColor: "#8B5CF6",
    darkModeDefault: false,
    requireEmailVerification: true,
    allowSelfEnrollment: false,
  });

  if (!userContext.isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Acesso restrito a administradores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    // Simulate save - in production this would save to database
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    toast.success("Configurações salvas com sucesso!");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configurações
          </h1>
          <p className="text-muted-foreground">
            Gerencie as configurações gerais da plataforma
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configurações Gerais</CardTitle>
            <CardDescription>
              Personalize as informações básicas da plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platformName">Nome da Plataforma</Label>
              <Input
                id="platformName"
                value={settings.platformName}
                onChange={(e) => setSettings(s => ({ ...s, platformName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Mensagem de Boas-vindas</Label>
              <Textarea
                id="welcomeMessage"
                value={settings.welcomeMessage}
                onChange={(e) => setSettings(s => ({ ...s, welcomeMessage: e.target.value }))}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
            <CardDescription>
              Configure as notificações da plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Notificações por E-mail</Label>
                <p className="text-sm text-muted-foreground">Enviar e-mails sobre atividades</p>
              </div>
              <Switch
                checked={settings.enableEmailNotifications}
                onCheckedChange={(checked) => setSettings(s => ({ ...s, enableEmailNotifications: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Progresso de Aulas</Label>
                <p className="text-sm text-muted-foreground">Notificar ao completar aulas</p>
              </div>
              <Switch
                checked={settings.enableProgressNotifications}
                onCheckedChange={(checked) => setSettings(s => ({ ...s, enableProgressNotifications: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Conquista de Badges</Label>
                <p className="text-sm text-muted-foreground">Notificar novos badges</p>
              </div>
              <Switch
                checked={settings.enableBadgeNotifications}
                onCheckedChange={(checked) => setSettings(s => ({ ...s, enableBadgeNotifications: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Mudanças no Ranking</Label>
                <p className="text-sm text-muted-foreground">Notificar alterações de posição</p>
              </div>
              <Switch
                checked={settings.enableRankingNotifications}
                onCheckedChange={(checked) => setSettings(s => ({ ...s, enableRankingNotifications: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Aparência
            </CardTitle>
            <CardDescription>
              Customize a aparência da plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Cor Primária</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings(s => ({ ...s, primaryColor: e.target.value }))}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={settings.primaryColor}
                  onChange={(e) => setSettings(s => ({ ...s, primaryColor: e.target.value }))}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Modo Escuro como Padrão</Label>
                <p className="text-sm text-muted-foreground">Novos usuários iniciam em modo escuro</p>
              </div>
              <Switch
                checked={settings.darkModeDefault}
                onCheckedChange={(checked) => setSettings(s => ({ ...s, darkModeDefault: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Segurança & Acesso
            </CardTitle>
            <CardDescription>
              Configure as regras de acesso à plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Verificação de E-mail</Label>
                <p className="text-sm text-muted-foreground">Exigir verificação de e-mail</p>
              </div>
              <Switch
                checked={settings.requireEmailVerification}
                onCheckedChange={(checked) => setSettings(s => ({ ...s, requireEmailVerification: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-inscrição</Label>
                <p className="text-sm text-muted-foreground">Permitir usuários se inscreverem em trilhas</p>
              </div>
              <Switch
                checked={settings.allowSelfEnrollment}
                onCheckedChange={(checked) => setSettings(s => ({ ...s, allowSelfEnrollment: checked }))}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AcademySettingsPage;
