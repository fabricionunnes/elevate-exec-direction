// Sino de notificações do portal do cliente (onboarding_notifications.user_id = onboarding_users.id).
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface N { id: string; type: string; title: string; message: string | null; action_url: string | null; category: string | null; is_read: boolean; created_at: string }

export function ClientNotificationsBell({ onboardingUserId, onOpenPreferences }: { onboardingUserId: string; onOpenPreferences?: () => void }) {
  const [items, setItems] = useState<N[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const naoLidas = items.filter((i) => !i.is_read).length;

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("onboarding_notifications")
      .select("id, type, title, message, action_url, category, is_read, created_at")
      .eq("user_id", onboardingUserId).order("created_at", { ascending: false }).limit(40);
    setItems(data || []);
  }, [onboardingUserId]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`client-notif-${onboardingUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "onboarding_notifications", filter: `user_id=eq.${onboardingUserId}` }, (p) => {
        const n = p.new as N;
        setItems((prev) => [n, ...prev].slice(0, 40));
        toast(n.title, { description: n.message || undefined });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [onboardingUserId, load]);

  const abrir = async (n: N) => {
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      await (supabase as any).from("onboarding_notifications").update({ is_read: true }).eq("id", n.id);
    }
    if (n.action_url) {
      setOpen(false);
      if (/^https?:\/\//i.test(n.action_url)) window.open(n.action_url, "_blank", "noopener");
      else navigate(n.action_url.replace(/^\/?#/, ""));
    }
  };

  const lerTodas = async () => {
    const ids = items.filter((i) => !i.is_read).map((i) => i.id);
    if (!ids.length) return;
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    await (supabase as any).from("onboarding_notifications").update({ is_read: true }).in("id", ids);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full touch-manipulation relative" title="Notificações">
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] max-w-[92vw] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notificações</span>
          <div className="flex items-center gap-1">
            {naoLidas > 0 && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={lerTodas}><CheckCheck className="h-3.5 w-3.5 mr-1" />Marcar lidas</Button>}
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y">
          {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nada por aqui ainda.</p>}
          {items.map((n) => (
            <button key={n.id} type="button" onClick={() => abrir(n)} className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors ${n.is_read ? "" : "bg-primary/5"}`}>
              <div className="flex items-start gap-2">
                {!n.is_read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{n.title}</p>
                  {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{n.message}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">{n.category ? `${n.category} · ` : ""}{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        {onOpenPreferences && (
          <div className="border-t px-3 py-2">
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setOpen(false); onOpenPreferences(); }}>Escolher o que receber e ativar push</button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
