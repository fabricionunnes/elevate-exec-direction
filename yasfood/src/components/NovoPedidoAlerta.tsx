// Pedido novo (status "recebido") pisca no painel e toca um som até a Yasmim aceitar.
// Fica em todas as telas do admin. O som usa o Web Audio (sem arquivo); o navegador só
// libera áudio depois de um toque na página, por isso o aviso "toque na tela".
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BellOff, Check, ExternalLink } from "lucide-react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { brl, dayLong } from "@/lib/format";
import { useToast } from "@/components/ui";
import { notifyNewOrders, currentSubscription } from "@/lib/push";

interface Pending {
  id: string;
  code: string;
  customer_name: string;
  total: number;
  scheduled_date: string;
  window_label: string | null;
  fulfillment: "entrega" | "retirada";
  created_at: string;
}

const MUTE_KEY = "yasfood_alert_mute_until";
const BEEP_EVERY_MS = 3000;

export function NovoPedidoAlerta() {
  const toast = useToast();
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [audioOk, setAudioOk] = useState(false);
  const [muteUntil, setMuteUntil] = useState<number>(() => { try { return Number(localStorage.getItem(MUTE_KEY) ?? 0); } catch { return 0; } });
  const [notif] = useState<NotificationPermission | "none">(() => ("Notification" in window ? Notification.permission : "none"));
  const [pushOn, setPushOn] = useState(true);
  useEffect(() => { void currentSubscription().then((s) => setPushOn(!!s)).catch(() => setPushOn(false)); }, []);
  const ctxRef = useRef<AudioContext | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, code, customer_name, total, scheduled_date, window_label, fulfillment, created_at")
      .eq("status", "recebido")
      .order("created_at");
    setPending((data as Pending[]) ?? []);
  }, []);

  // carrega, escuta em tempo real e revisa a cada 45 s (se o tempo real cair)
  useEffect(() => {
    void load();
    const ch = supabase
      .channel("orders-alert")
      .on("postgres_changes", { event: "*", schema: "yasfood", table: "orders" }, () => void load())
      .subscribe();
    const t = setInterval(() => void load(), 45000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [load]);

  // áudio só destrava depois de um toque na página
  const ensureAudio = useCallback(async () => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return false;
      ctxRef.current = ctxRef.current ?? new Ctx();
      if (ctxRef.current.state !== "running") await ctxRef.current.resume();
      const ok = ctxRef.current.state === "running";
      setAudioOk(ok);
      return ok;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const unlock = () => void ensureAudio();
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    void ensureAudio();
    return () => { document.removeEventListener("pointerdown", unlock); document.removeEventListener("keydown", unlock); };
  }, [ensureAudio]);

  const beep = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    // duas notas curtas, tipo campainha de balcão
    const play = (freq: number, at: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(at);
      o.stop(at + 0.4);
    };
    const t = ctx.currentTime;
    play(880, t);
    play(1175, t + 0.22);
  }, []);

  const muted = Date.now() < muteUntil;
  const count = pending.length;

  // som a cada 3 s enquanto tiver pedido esperando (e não estiver silenciado)
  useEffect(() => {
    if (!count || muted) return;
    beep();
    const t = setInterval(beep, BEEP_EVERY_MS);
    return () => clearInterval(t);
  }, [count, muted, beep, audioOk]);

  // título da aba piscando
  useEffect(() => {
    if (!count) return;
    const original = document.title;
    let on = false;
    const t = setInterval(() => { on = !on; document.title = on ? `NOVO PEDIDO (${count})` : original; }, 1000);
    return () => { clearInterval(t); document.title = original; };
  }, [count]);

  // aviso do navegador quando chega pedido novo (se a Yasmim liberou)
  useEffect(() => {
    const fresh = pending.filter((p) => !seen.current.has(p.id));
    for (const p of pending) seen.current.add(p.id);
    // reforço: com o painel aberto em qualquer aparelho, garante que o celular também receba (o servidor avisa cada pedido uma vez só)
    if (fresh.length) notifyNewOrders();
    if (first.current) { first.current = false; return; }
    if (!fresh.length || notif !== "granted" || pushOn) return; // com push ligado, quem avisa é o celular
    try {
      for (const p of fresh) new Notification(`Novo pedido ${p.code}`, { body: `${p.customer_name} · ${brl(p.total)} · ${dayLong(p.scheduled_date)}`, tag: p.id });
    } catch { /* sem suporte */ }
  }, [pending, notif, pushOn]);

  const accept = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("set_order_status", { p_order_id: id, p_status: "confirmado", p_note: "" });
    setBusy(null);
    if (error) return toast(friendlyError(error), "err");
    toast("Pedido aceito.");
    void load();
  };

  const mute = (min: number) => {
    const until = Date.now() + min * 60000;
    setMuteUntil(until);
    try { localStorage.setItem(MUTE_KEY, String(until)); } catch { /* sem storage */ }
  };


  if (!count) return null;

  return (
    <div className="sticky top-0 z-40 lg:top-0">
      <style>{`@keyframes yas-blink { 0%, 100% { background-color: #b91c1c; } 50% { background-color: #ec4899; } }`}</style>
      <div className="px-3 pt-3 lg:px-6 lg:pt-4">
        <div className="rounded-2xl p-3 text-white shadow-lg ring-4 ring-rosa-200" style={{ animation: "yas-blink 0.9s ease-in-out infinite" }}>
          <div className="flex flex-wrap items-center gap-2">
            <Bell className="animate-bounce" size={22} />
            <div className="text-lg font-black">{count === 1 ? "Pedido novo esperando você aceitar" : `${count} pedidos novos esperando você aceitar`}</div>
            <div className="ml-auto flex flex-wrap items-center gap-1 text-xs">
              {!audioOk && <span className="rounded-full bg-white/20 px-2 py-1 font-semibold">Toque na tela pra ligar o som</span>}
              {!pushOn && <Link to="/admin/configuracoes#notificacoes" className="rounded-full bg-white/20 px-2 py-1 font-semibold hover:bg-white/30">Receber no celular com o app fechado</Link>}
              {muted
                ? <button type="button" onClick={() => mute(0)} className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 font-semibold hover:bg-white/30"><Bell size={12} /> Ligar o som</button>
                : <button type="button" onClick={() => mute(10)} className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 font-semibold hover:bg-white/30"><BellOff size={12} /> Silenciar 10 min</button>}
            </div>
          </div>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-choco-900">
                <div className="min-w-0 flex-1">
                  <div className="font-black">{p.code} · {p.customer_name}</div>
                  <div className="text-xs text-choco-600">{brl(p.total)} · {p.fulfillment === "entrega" ? "entrega" : "retirada"} · <span className="capitalize">{dayLong(p.scheduled_date)}</span>{p.window_label ? ` · ${p.window_label}` : ""}</div>
                </div>
                <Link to="/admin/pedidos" className="inline-flex items-center gap-1 rounded-full bg-choco-100 px-3 py-1.5 text-xs font-semibold text-choco-800 hover:bg-choco-200"><ExternalLink size={12} /> Ver</Link>
                <button type="button" disabled={busy === p.id} onClick={() => void accept(p.id)} className={clsx("inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50")}><Check size={14} /> {busy === p.id ? "Aceitando…" : "Aceitar"}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
