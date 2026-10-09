import { useEffect, useState } from "react";
import { ImagePlus, Save } from "lucide-react";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { useAuth } from "@/lib/auth";
import type { Settings } from "@/lib/types";
import { Button, Card, Input, Textarea, Spinner, useToast } from "@/components/ui";
import { Logo } from "@/pages/cliente/Layout";

export default function Configuracoes() {
  const toast = useToast();
  const { settings, reload } = useSettings(true);
  const { session } = useAuth();
  const [form, setForm] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState("");

  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  if (!form) return <Spinner />;

  const set = (k: keyof Settings, v: unknown) => setForm({ ...form, [k]: v } as Settings);

  const save = async () => {
    setBusy(true);
    const { id, ...rest } = form;
    const { error } = await supabase.from("settings").update(rest).eq("id", 1);
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    toast("Configurações salvas.");
    void reload();
  };

  const uploadLogo = async (file: File) => {
    setBusy(true);
    const path = `logo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("produtos").upload(path, file, { upsert: true });
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    const { data } = supabase.storage.from("produtos").getPublicUrl(path);
    set("logo_url", data.publicUrl);
    await supabase.from("settings").update({ logo_url: data.publicUrl }).eq("id", 1);
    void reload();
    toast("Logo atualizada.");
  };

  const changePassword = async () => {
    if (pw.length < 8) return toast("Senha com pelo menos 8 caracteres.", "err");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast(friendlyError(error), "err");
    setPw("");
    toast("Senha alterada.");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-choco-900">Configurações</h1>

      <Card title="Loja">
        <div className="mb-3 flex items-center gap-4">
          <Logo size={72} url={form.logo_url} />
          <label className="cursor-pointer"><span className="inline-flex items-center gap-2 rounded-xl border border-choco-200 bg-white px-3 py-2 text-sm font-semibold"><ImagePlus size={16} /> {busy ? "Enviando…" : "Trocar logo"}</span><input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nome" value={form.business_name} onChange={(e) => set("business_name", e.target.value)} />
          <Input label="WhatsApp (só números, com 55)" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value.replace(/\D/g, ""))} hint="Ex.: 5531992372507" />
          <Input label="Instagram" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@yasdelicias" />
          <Input label="Endereço do site" value={form.site_url} onChange={(e) => set("site_url", e.target.value)} placeholder="https://yasdelicias.com.br" hint="Usado nos links de rastreio enviados por WhatsApp" />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_open} onChange={(e) => set("is_open", e.target.checked)} /> loja aberta pra pedidos</label>
        <div className="mt-2"><Textarea label="Mensagem quando fechada" value={form.closed_message} onChange={(e) => set("closed_message", e.target.value)} /></div>
      </Card>

      <Card title="Retirada no local">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pickup_enabled} onChange={(e) => set("pickup_enabled", e.target.checked)} /> permitir que o cliente venha buscar</label>
        <div className="mt-3"><Textarea label="Endereço e instruções pra retirada" value={form.pickup_address} onChange={(e) => set("pickup_address", e.target.value)} placeholder="Ex.: Rua das Acácias, 120, casa 7 · Alphaville Lagoa dos Ingleses · Retirada das 14h às 19h, me chama no WhatsApp ao chegar" /></div>
        <p className="mt-1 text-xs text-choco-500">Aparece no checkout quando o cliente escolhe "Retirar" e na tela do pedido.</p>
      </Card>

      <Card title="Pagamento e prazos">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Chave Pix" value={form.pix_key} onChange={(e) => set("pix_key", e.target.value)} />
          <Input label="Nome no Pix" value={form.pix_name} onChange={(e) => set("pix_name", e.target.value)} />
          <Input label="Antecedência mínima (dias)" type="number" min={0} value={form.min_lead_days} onChange={(e) => set("min_lead_days", Number(e.target.value))} hint="1 = pedido hoje pra amanhã" />
          <Input label="Capacidade padrão por dia" type="number" min={0} value={form.default_daily_capacity} onChange={(e) => set("default_daily_capacity", Number(e.target.value))} />
        </div>
      </Card>

      <Button loading={busy} onClick={save}><Save size={16} /> Salvar configurações</Button>

      <Card title="Minha conta">
        <p className="mb-2 text-sm text-choco-600">Logada como <b>{session?.user.email}</b></p>
        <div className="flex max-w-md gap-2">
          <Input type="password" placeholder="Nova senha" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button variant="outline" onClick={changePassword}>Trocar senha</Button>
        </div>
      </Card>
    </div>
  );
}
