// "Notificação no celular": liga/desliga neste aparelho, testa e lista os aparelhos ligados.
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Smartphone, Send, Share, PlusSquare, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dateTimeBR } from "@/lib/format";
import { currentSubscription, disablePush, enablePush, isIOS, isStandalone, logPush, pushEnv, pushSupported, sendTestPush } from "@/lib/push";
import { Button, Card, useToast } from "@/components/ui";

interface Device { id: string; device: string; created_at: string; last_ok_at: string | null; endpoint: string }

export function PushCard() {
  const toast = useToast();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [mine, setMine] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [env, setEnv] = useState(() => pushEnv());

  const ios = isIOS();
  const standalone = isStandalone();
  const supported = pushSupported();

  const load = useCallback(async () => {
    const sub = await currentSubscription().catch(() => null);
    setMine(sub?.endpoint ?? null);
    setOn(!!sub && (typeof Notification === "undefined" || Notification.permission === "granted"));
    const { data } = await supabase.from("push_subscriptions").select("id, device, created_at, last_ok_at, endpoint").order("created_at");
    setDevices((data as Device[]) ?? []);
  }, []);
  useEffect(() => { void load(); void logPush("abriu_configuracoes", true); }, [load]);

  const ligar = async () => {
    setBusy(true);
    setErro(null);
    try {
      await enablePush();
      toast("Notificação ligada neste aparelho.");
      await sendTestPush().catch(() => undefined);
    } catch (e) {
      setErro((e as Error).message);
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
      setEnv(pushEnv());
      void load();
    }
  };

  const desligar = async () => {
    setBusy(true);
    try { await disablePush(); toast("Notificação desligada neste aparelho."); } catch (e) { toast((e as Error).message, "err"); } finally { setBusy(false); void load(); }
  };

  const testar = async () => {
    setBusy(true);
    try {
      const r = await sendTestPush();
      toast(r.devices ? `Teste enviado pra ${r.sent} de ${r.devices} aparelho(s).` : "Nenhum aparelho ligado ainda.", r.sent ? "ok" : "err");
    } catch (e) { toast((e as Error).message, "err"); } finally { setBusy(false); void load(); }
  };

  return (
    <Card title={<span id="notificacoes" className="flex items-center gap-2"><Smartphone size={18} /> Notificação no celular</span>}>
      <p className="mb-3 text-sm text-choco-600">Pedido novo chega como notificação no celular, com som, mesmo com o app fechado. Toque nela e cai direto nos pedidos.</p>

      {ios && !standalone ? (
        <div className="rounded-xl bg-rosa-50 p-3 text-sm text-choco-800">
          <div className="mb-1 font-bold text-vinho-700">No iPhone, primeiro vira app:</div>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Abra este painel no <b>Safari</b>.</li>
            <li>Toque em <Share size={14} className="inline" /> <b>Compartilhar</b>, na barra de baixo.</li>
            <li>Toque em <PlusSquare size={14} className="inline" /> <b>Adicionar à Tela de Início</b> e depois em <b>Adicionar</b>.</li>
            <li>Abra o painel pelo ícone <b>Yas Painel</b> que apareceu na tela, entre e volte aqui em Configurações.</li>
            <li>Toque em <b>Ligar notificação</b> e em <b>Permitir</b>.</li>
          </ol>
        </div>
      ) : !supported ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Este navegador não recebe notificação. No Android use o Chrome; no iPhone, o Safari com o painel na Tela de Início.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {on
            ? <Button variant="outline" loading={busy} onClick={desligar}><BellOff size={16} /> Desligar neste aparelho</Button>
            : <Button loading={busy} onClick={ligar}><Bell size={16} /> Ligar notificação neste aparelho</Button>}
          <Button variant="ghost" loading={busy} onClick={testar}><Send size={16} /> Enviar teste</Button>
          <span className="text-xs text-choco-500">{on ? "Ligada aqui." : "Desligada aqui."}</span>
        </div>
      )}

      {erro && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{erro}</p>}

      <div className="mt-3 rounded-xl bg-choco-50 p-3 text-xs text-choco-700">
        <div className="mb-1 font-bold uppercase tracking-wide text-choco-500">Checagem deste aparelho</div>
        <ul className="grid gap-1 sm:grid-cols-2">
          {[
            { ok: !ios || standalone, t: ios ? (standalone ? "Aberto pelo ícone da Tela de Início" : "Aberto pelo Safari (precisa ser pelo ícone)") : "Navegador de computador ou Android" },
            { ok: env.has_push && env.has_sw, t: env.has_push && env.has_sw ? "Aparelho aceita notificação de site" : `Aparelho não aceita notificação de site${env.ios_version ? ` (iOS ${env.ios_version}, precisa 16.4+)` : ""}` },
            { ok: env.permission === "granted", t: env.permission === "granted" ? "Permissão concedida" : env.permission === "denied" ? "Permissão bloqueada no aparelho" : "Permissão ainda não pedida (toque em Ligar)" },
            { ok: !!on, t: on ? "Inscrito pra receber" : "Ainda não inscrito" },
          ].map((c, i) => (
            <li key={i} className="flex items-center gap-1.5">{c.ok ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} className="text-red-500" />} {c.t}</li>
          ))}
        </ul>
        {ios && <p className="mt-2 text-choco-500">No iPhone, o Yas Painel só aparece em Ajustes &gt; Notificações depois que você toca em Ligar aqui e escolhe Permitir.</p>}
      </div>

      {devices.length > 0 && (
        <ul className="mt-3 divide-y divide-choco-100 text-sm">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-1.5">
              <span>{d.device || "Aparelho"}{d.endpoint === mine && <b className="text-emerald-700"> · este</b>}</span>
              <span className="text-xs text-choco-500">{d.last_ok_at ? `último aviso ${dateTimeBR(d.last_ok_at)}` : `ligado ${dateTimeBR(d.created_at)}`}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
