// Preferências de notificação do Atendimento (crm_service_notifications).
// Quem lê: CRMNotificationsBell (novos leads, atribuições, som) e
// CRMInboundMessageNotifier (novas mensagens, agrupamento). Janela de horário e
// som valem pros dois. Ao salvar, dispara PREFS_EVENT pra eles recarregarem.
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  ChevronLeft,
  Bell,
  MessageSquare,
  UserPlus,
  Volume2,
  Clock,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  CrmNotificationPrefs,
  DEFAULT_PREFS,
  PREFS_EVENT,
  normalizePrefs,
} from "@/hooks/useCrmNotificationPrefs";

type ToggleKey = "notify_new_message" | "notify_new_lead" | "notify_assignment" | "notify_sound";

const GROUP_OPTIONS = [1, 2, 3, 5, 10, 15, 30, 60].map((m) => ({
  value: String(m),
  label: m === 1 ? "1 minuto" : `${m} minutos`,
}));

interface NotificationsSectionProps {
  onBack: () => void;
}

export const NotificationsSection = ({ onBack }: NotificationsSectionProps) => {
  const [settings, setSettings] = useState<CrmNotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  // janela editada localmente; salva no botão (evita gravar a cada tecla)
  const [janela, setJanela] = useState<{ from: string; until: string }>({ from: "", until: "" });

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
        const { data: row } = await supabase
          .from("crm_service_notifications")
          .select("*")
          .eq("staff_id", staff.id)
          .maybeSingle();
        const p = normalizePrefs(row);
        setSettings(p);
        setJanela({ from: p.notify_from || "", until: p.notify_until || "" });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const persist = async (patch: Partial<CrmNotificationPrefs>) => {
    if (!staffId) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_service_notifications")
        .upsert({ staff_id: staffId, ...patch } as any, { onConflict: "staff_id" });
      if (error) throw error;
      window.dispatchEvent(new Event(PREFS_EVENT));
      return true;
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (key: ToggleKey) => {
    const newValue = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: newValue }));
    const ok = await persist({ [key]: newValue });
    if (ok) toast.success("Preferência atualizada");
    else setSettings((prev) => ({ ...prev, [key]: !newValue }));
  };

  const toggleAll = async () => {
    const ligar = !(settings.notify_new_message || settings.notify_new_lead || settings.notify_assignment);
    const patch = { notify_new_message: ligar, notify_new_lead: ligar, notify_assignment: ligar };
    const antes = settings;
    setSettings((prev) => ({ ...prev, ...patch }));
    const ok = await persist(patch);
    if (ok) toast.success(ligar ? "Notificações ligadas" : "Notificações desligadas");
    else setSettings(antes);
  };

  const salvarJanela = async () => {
    const from = janela.from.trim();
    const until = janela.until.trim();
    if ((from && !until) || (!from && until)) {
      toast.error("Preencha início e fim, ou deixe os dois vazios");
      return;
    }
    const patch = { notify_from: from || null, notify_until: until || null };
    setSettings((prev) => ({ ...prev, ...patch }));
    const ok = await persist(patch);
    if (ok) toast.success(from ? `Avisos só das ${from} às ${until}` : "Avisos a qualquer hora");
  };

  const limparJanela = async () => {
    setJanela({ from: "", until: "" });
    setSettings((prev) => ({ ...prev, notify_from: null, notify_until: null }));
    const ok = await persist({ notify_from: null, notify_until: null });
    if (ok) toast.success("Avisos a qualquer hora");
  };

  const mudarAgrupamento = async (v: string) => {
    const minutos = Number(v);
    if (!minutos) return;
    setSettings((prev) => ({ ...prev, group_minutes: minutos }));
    const ok = await persist({ group_minutes: minutos });
    if (ok) toast.success(`No máximo um aviso por conversa a cada ${minutos} min`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const algumaLigada = settings.notify_new_message || settings.notify_new_lead || settings.notify_assignment;
  const janelaAlterada = (janela.from || "") !== (settings.notify_from || "") || (janela.until || "") !== (settings.notify_until || "");

  const linha = (
    icone: JSX.Element,
    cor: string,
    titulo: string,
    descricao: string,
    key: ToggleKey,
  ) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${cor}`}>{icone}</div>
            <div>
              <p className="font-medium">{titulo}</p>
              <p className="text-sm text-muted-foreground">{descricao}</p>
            </div>
          </div>
          <Switch checked={settings[key]} onCheckedChange={() => handleToggle(key)} disabled={saving} />
        </div>
      </CardContent>
    </Card>
  );

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
            Avisos na tela (e som) enquanto você estiver no CRM. Valem só pra você.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{algumaLigada ? "Ligadas" : "Desligadas"}</span>
          <Switch checked={algumaLigada} onCheckedChange={toggleAll} disabled={saving} title="Ligar ou desligar todos os avisos" />
        </div>
      </div>

      <div className="space-y-4 mt-6">
        {linha(
          <MessageSquare className="h-5 w-5" />, "bg-blue-100 text-blue-600",
          "Novas mensagens",
          "Aviso quando chega mensagem no WhatsApp numa conversa sua (admin também vê as sem responsável)",
          "notify_new_message",
        )}
        {linha(
          <UserPlus className="h-5 w-5" />, "bg-green-100 text-green-600",
          "Novos leads",
          "Aviso quando um lead novo entra no funil",
          "notify_new_lead",
        )}
        {linha(
          <Bell className="h-5 w-5" />, "bg-purple-100 text-purple-600",
          "Atribuições",
          "Aviso quando uma tarefa, atividade de etapa ou reunião é atribuída a você",
          "notify_assignment",
        )}
        {linha(
          <Volume2 className="h-5 w-5" />, "bg-orange-100 text-orange-600",
          "Som de notificação",
          "Tocar som junto com o aviso",
          "notify_sound",
        )}

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Janela de horário</p>
                <p className="text-sm text-muted-foreground">
                  Só avisar entre esses horários (hora do seu computador). Vazio = a qualquer hora.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3 pl-1">
              <div className="space-y-1">
                <Label htmlFor="notif-from" className="text-xs">Das</Label>
                <Input id="notif-from" type="time" step={300} value={janela.from}
                  onChange={(e) => setJanela((j) => ({ ...j, from: e.target.value }))} className="h-9 w-[120px]" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="notif-until" className="text-xs">Até</Label>
                <Input id="notif-until" type="time" step={300} value={janela.until}
                  onChange={(e) => setJanela((j) => ({ ...j, until: e.target.value }))} className="h-9 w-[120px]" />
              </div>
              <Button size="sm" onClick={salvarJanela} disabled={saving || !janelaAlterada}>Salvar horário</Button>
              {(settings.notify_from || janela.from || janela.until) && (
                <Button size="sm" variant="ghost" onClick={limparJanela} disabled={saving}>Sem limite</Button>
              )}
            </div>
            {settings.notify_from && settings.notify_until && (
              <p className="text-xs text-muted-foreground pl-1">
                Hoje: avisos das {settings.notify_from} às {settings.notify_until}
                {settings.notify_from > settings.notify_until ? " (vira a meia-noite)" : ""}.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100 text-teal-600">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Agrupar mensagens</p>
                <p className="text-sm text-muted-foreground">
                  No máximo um aviso por conversa dentro desse intervalo. Evita uma enxurrada quando o contato manda várias mensagens seguidas.
                </p>
              </div>
            </div>
            <div className="pl-1 w-[200px]">
              <SearchableSelect
                value={String(settings.group_minutes)}
                onValueChange={mudarAgrupamento}
                options={GROUP_OPTIONS}
                placeholder="Intervalo"
                emptyMessage="Sem essa opção."
                disabled={saving}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
