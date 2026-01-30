import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronLeft,
  Bell,
  MessageSquare,
  UserPlus,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

interface NotificationSettings {
  notify_new_message: boolean;
  notify_new_lead: boolean;
  notify_assignment: boolean;
  notify_sound: boolean;
}

interface NotificationsSectionProps {
  onBack: () => void;
}

export const NotificationsSection = ({ onBack }: NotificationsSectionProps) => {
  const [settings, setSettings] = useState<NotificationSettings>({
    notify_new_message: true,
    notify_new_lead: true,
    notify_assignment: true,
    notify_sound: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) return;

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", session.session.user.id)
        .single();

      if (staff) {
        setStaffId(staff.id);
        
        const { data: notifSettings } = await supabase
          .from("crm_service_notifications")
          .select("*")
          .eq("staff_id", staff.id)
          .single();

        if (notifSettings) {
          setSettings({
            notify_new_message: notifSettings.notify_new_message,
            notify_new_lead: notifSettings.notify_new_lead,
            notify_assignment: notifSettings.notify_assignment,
            notify_sound: notifSettings.notify_sound,
          });
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationSettings) => {
    if (!staffId) return;
    
    const newValue = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newValue }));
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_service_notifications")
        .upsert({
          staff_id: staffId,
          [key]: newValue,
        }, { onConflict: "staff_id" });

      if (error) throw error;
      toast.success("Preferência atualizada");
    } catch (error: any) {
      // Revert on error
      setSettings(prev => ({ ...prev, [key]: !newValue }));
      toast.error(error.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button onClick={onBack} className="hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Configurações
        </button>
        <span>/</span>
        <span className="text-foreground">Notificações</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Notificações</h2>
          <p className="text-sm text-muted-foreground">
            Configure suas preferências de notificação
          </p>
        </div>
        <Switch
          checked={Object.values(settings).some(v => v)}
          onCheckedChange={() => {
            // Toggle all
          }}
        />
      </div>

      <div className="space-y-4 mt-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Novas mensagens</p>
                  <p className="text-sm text-muted-foreground">
                    Receber notificações quando chegar uma nova mensagem
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.notify_new_message}
                onCheckedChange={() => handleToggle("notify_new_message")}
                disabled={saving}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 text-green-600">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Novos leads</p>
                  <p className="text-sm text-muted-foreground">
                    Receber notificações quando um novo lead entrar
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.notify_new_lead}
                onCheckedChange={() => handleToggle("notify_new_lead")}
                disabled={saving}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Atribuições</p>
                  <p className="text-sm text-muted-foreground">
                    Receber notificações quando for atribuído a um atendimento
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.notify_assignment}
                onCheckedChange={() => handleToggle("notify_assignment")}
                disabled={saving}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                  <Volume2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Som de notificação</p>
                  <p className="text-sm text-muted-foreground">
                    Tocar som quando receber notificações
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.notify_sound}
                onCheckedChange={() => handleToggle("notify_sound")}
                disabled={saving}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
