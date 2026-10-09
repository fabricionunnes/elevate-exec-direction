import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { Button, Input } from "@/components/ui";
import { Logo } from "@/pages/cliente/Layout";

/**
 * Recuperação de senha.
 * - Sem sessão: pede o e-mail e envia o link (redireciona pra esta página).
 * - Com sessão de recuperação (link do e-mail): mostra o formulário de nova senha.
 */
export default function Recuperar() {
  const { settings } = useSettings();
  const nav = useNavigate();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(Boolean(session));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/admin/recuperar` });
    setBusy(false);
    if (error) return setMsg({ kind: "err", text: friendlyError(error) });
    setMsg({ kind: "ok", text: "Link enviado. Abre o e-mail e clica no link pra definir a nova senha." });
  };

  const setPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setMsg({ kind: "err", text: "Senha com pelo menos 8 caracteres." });
    if (pw !== pw2) return setMsg({ kind: "err", text: "As senhas não conferem." });
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ kind: "err", text: friendlyError(error) });
    setMsg({ kind: "ok", text: "Senha definida. Entrando no painel…" });
    setTimeout(() => nav("/admin", { replace: true }), 800);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-vinho-700 via-vinho-800 to-choco-900 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-creme p-6 shadow-soft">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size={90} url={settings?.logo_url} />
          <h1 className="text-xl font-black text-vinho-700">{hasSession ? "Definir nova senha" : "Recuperar senha"}</h1>
        </div>

        {hasSession === null ? null : hasSession ? (
          <form onSubmit={setPassword} className="space-y-3">
            <Input label="Nova senha" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
            <Input label="Repete a nova senha" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
            <Button type="submit" className="w-full" size="lg" loading={busy}>Salvar senha</Button>
          </form>
        ) : (
          <form onSubmit={sendLink} className="space-y-3">
            <p className="text-sm text-choco-600">Digite o e-mail do painel. Você recebe um link pra criar uma senha nova.</p>
            <Input label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Button type="submit" className="w-full" size="lg" loading={busy}>Enviar link</Button>
          </form>
        )}

        {msg && <p className={`rounded-xl p-3 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        <Link to="/admin/login" className="block text-center text-sm text-choco-500 hover:text-choco-800">Voltar pro login</Link>
      </div>
    </div>
  );
}
