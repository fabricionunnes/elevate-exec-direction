import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/useSettings";
import { friendlyError, supabaseConfigured } from "@/lib/supabase";
import { Button, Input } from "@/components/ui";
import { YasFoodMark, YasFoodWord } from "@/components/Brand";
import { Logo } from "@/pages/cliente/Layout";

export default function Login() {
  const { session, isAdmin, loading, signIn } = useAuth();
  const { settings } = useSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session && isAdmin) return <Navigate to="/admin" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const error = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setErr(friendlyError({ message: error }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-vinho-700 via-vinho-800 to-choco-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl bg-creme p-6 shadow-soft">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size={110} url={settings?.logo_url} />
          <h1 className="text-2xl font-black text-vinho-700">{settings?.business_name ?? "Yas Delícias"}</h1>
          <p className="text-sm text-choco-500">Painel da Yasmim</p>
        </div>
        {!supabaseConfigured && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Supabase não configurado. Preencha o arquivo .env (veja .env.example).</p>}
        {session && !isAdmin && !loading && <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">Este usuário não tem acesso ao painel. Cadastre o ID dele na tabela admins.</p>}
        <Input label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Senha" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Button type="submit" className="w-full" size="lg" loading={busy}>Entrar</Button>
        <div className="flex items-center justify-center gap-1 text-[10px] text-choco-300"><YasFoodMark size={14} className="!rounded" /> feito com <YasFoodWord size="text-[11px]" /></div>
      </form>
    </div>
  );
}
