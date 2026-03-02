import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  is_subscribed: boolean;
}

export function PaymentNotificationConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [staffRes, subsRes] = await Promise.all([
        supabase
          .from("onboarding_staff")
          .select("id, name, email, role")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("payment_notification_subscribers")
          .select("staff_id")
          .eq("is_active", true),
      ]);

      const subscribedIds = new Set((subsRes.data || []).map(s => s.staff_id));

      setStaffMembers(
        (staffRes.data || []).map(s => ({
          ...s,
          is_subscribed: subscribedIds.has(s.id),
        }))
      );
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const toggleSubscription = async (staffId: string, currentlySubscribed: boolean) => {
    setSaving(staffId);
    try {
      if (currentlySubscribed) {
        await supabase
          .from("payment_notification_subscribers")
          .delete()
          .eq("staff_id", staffId);
      } else {
        await supabase
          .from("payment_notification_subscribers")
          .upsert({ staff_id: staffId, is_active: true }, { onConflict: "staff_id" });
      }

      setStaffMembers(prev =>
        prev.map(s =>
          s.id === staffId ? { ...s, is_subscribed: !currentlySubscribed } : s
        )
      );
      toast.success(currentlySubscribed ? "Notificação desativada" : "Notificação ativada");
    } catch (error) {
      console.error("Error toggling subscription:", error);
      toast.error("Erro ao alterar configuração");
    } finally {
      setSaving(null);
    }
  };

  const subscribedCount = staffMembers.filter(s => s.is_subscribed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          Notificações de Pagamento
        </h2>
        <p className="text-muted-foreground mt-1">
          Selecione quais membros da equipe receberão notificações quando um pagamento for confirmado (baixa).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Membros da Equipe
            </span>
            <Badge variant="secondary">
              {subscribedCount} ativo{subscribedCount !== 1 ? "s" : ""}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {staffMembers.map(staff => (
              <div
                key={staff.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="font-medium text-sm">{staff.name}</p>
                  <p className="text-xs text-muted-foreground">{staff.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    {staff.role}
                  </Badge>
                  {saving === staff.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Switch
                      checked={staff.is_subscribed}
                      onCheckedChange={() =>
                        toggleSubscription(staff.id, staff.is_subscribed)
                      }
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
