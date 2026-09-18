// Preferências de notificação de cada pessoa (equipe ou cliente): ativar push neste aparelho
// e escolher, por tipo, o que aparece no sino e o que chega como push.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff, BellRing, Loader2, Megaphone, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";
import { SendAnnouncementDialog } from "@/components/notifications/SendAnnouncementDialog";

interface NType { key: string; audience: string; category: string; label: string; description: string | null; default_inapp: boolean; default_push: boolean; mandatory: boolean; sort: number }
interface Pref { type_key: string; inapp: boolean; push: boolean }

export function NotificationPreferences({ audience }: { audience: "staff" | "client" }) {
  const [types, setTypes] = useState<NType[]>([]);
  const [prefs, setPrefs] = useState<Record<string, Pref>>({});
  const [uid, setUid] = useState<string | null>(null);
  const [push, setPush] = useState<PushState>("off");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [podeComunicar, setPodeComunicar] = useState(false);
  const [comunicadoOpen, setComunicadoOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUid(user?.id || null);
      const sb = supabase as any;
      const [{ data: t }, { data: p }] = await Promise.all([
        sb.from("notification_types").select("*").in("audience", [audience, "both"]).order("sort"),
        user ? sb.from("notification_preferences").select("type_key, inapp, push").eq("auth_user_id", user.id) : Promise.resolve({ data: [] }),
      ]);
      setTypes(t || []);
      setPrefs(Object.fromEntries((p || []).map((x: Pref) => [x.type_key, x])));
      if (audience === "staff" && user) {
        const { data: st } = await supabase.from("onboarding_staff").select("role").eq("user_id", user.id).eq("is_active", true).maybeSingle();
        setPodeComunicar(["master", "admin"].includes(String(st?.role || "")));
      }
      setPush(await getPushState());
      setLoading(false);
    })();
  }, [audience]);

  const grupos = useMemo(() => {
    const m = new Map<string, NType[]>();
    for (const t of types) { if (!m.has(t.category)) m.set(t.category, []); m.get(t.category)!.push(t); }
    return [...m.entries()];
  }, [types]);

  const valor = (t: NType): Pref => prefs[t.key] || { type_key: t.key, inapp: t.default_inapp, push: t.default_push };

  const mudar = async (t: NType, campo: "inapp" | "push", v: boolean) => {
    if (!uid) return;
    const novo = { ...valor(t), [campo]: v };
    setPrefs((prev) => ({ ...prev, [t.key]: novo }));
    const { error } = await (supabase as any).from("notification_preferences")
      .upsert({ auth_user_id: uid, type_key: t.key, inapp: novo.inapp, push: novo.push, updated_at: new Date().toISOString() }, { onConflict: "auth_user_id,type_key" });
    if (error) toast.error("Não consegui salvar: " + error.message);
  };

  const alternarPush = async () => {
    setBusy(true);
    try {
      if (push === "on") { setPush(await disablePush()); toast.success("Push desligado neste aparelho."); }
      else {
        const r = await enablePush(); setPush(r);
        if (r === "on") toast.success("Pronto. Este aparelho vai receber as notificações.");
        else if (r === "denied") toast.error("O navegador bloqueou as notificações. Libere nas configurações do site e tente de novo.");
      }
    } catch (e: any) { toast.error(e?.message || "Não consegui ativar o push"); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="text-sm text-muted-foreground flex items-center gap-2 py-4"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Notificações</h3>
        </div>
        {podeComunicar && (
          <Button size="sm" variant="outline" onClick={() => setComunicadoOpen(true)}><Megaphone className="h-4 w-4 mr-1.5" />Enviar comunicado</Button>
        )}
      </div>
      {podeComunicar && <SendAnnouncementDialog open={comunicadoOpen} onOpenChange={setComunicadoOpen} />}

      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium flex items-center gap-1.5"><Smartphone className="h-4 w-4" />Push neste aparelho</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {push === "on" && "Ativado. Você recebe os avisos mesmo com o sistema fechado."}
              {push === "off" && "Desativado. Ative pra receber os avisos mesmo com o sistema fechado."}
              {push === "denied" && "Bloqueado pelo navegador. Libere as notificações deste site nas configurações do navegador."}
              {push === "ios_needs_install" && "No iPhone, primeiro instale o app: toque em Compartilhar e em \"Adicionar à Tela de Início\". Depois abra por lá e ative aqui."}
              {push === "unsupported" && "Este navegador não tem suporte a push. Use o Chrome, Edge ou o app instalado."}
            </p>
          </div>
          {(push === "on" || push === "off") && (
            <Button size="sm" variant={push === "on" ? "outline" : "default"} onClick={alternarPush} disabled={busy} className="shrink-0">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : push === "on" ? <><BellOff className="h-4 w-4 mr-1.5" />Desligar</> : <><BellRing className="h-4 w-4 mr-1.5" />Ativar</>}
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">Vale por aparelho: ative no celular e no computador se quiser receber nos dois.</p>
      </div>

      <div className="rounded-lg border divide-y">
        <div className="grid grid-cols-[1fr_56px_56px] items-center px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          <span>O que receber</span><span className="text-center">No app</span><span className="text-center">Push</span>
        </div>
        {grupos.map(([cat, itens]) => (
          <div key={cat}>
            <p className="px-3 pt-2.5 pb-1 text-xs font-semibold text-muted-foreground">{cat}</p>
            {itens.map((t) => { const v = valor(t); return (
              <div key={t.key} className="grid grid-cols-[1fr_56px_56px] items-center px-3 py-1.5 gap-y-0.5">
                <div className="min-w-0 pr-2">
                  <p className="text-sm leading-tight">{t.label}{t.mandatory && <span className="ml-1.5 text-[10px] text-muted-foreground">(obrigatório)</span>}</p>
                  {t.description && <p className="text-[11px] text-muted-foreground leading-tight">{t.description}</p>}
                </div>
                <div className="flex justify-center"><Switch checked={t.mandatory || v.inapp} disabled={t.mandatory} onCheckedChange={(x) => mudar(t, "inapp", x)} /></div>
                <div className="flex justify-center"><Switch checked={t.mandatory || (v.push && v.inapp)} disabled={t.mandatory || !v.inapp} onCheckedChange={(x) => mudar(t, "push", x)} /></div>
              </div>
            ); })}
          </div>
        ))}
      </div>
    </div>
  );
}
