import { useEffect, useState } from "react";
import { ImagePlus, Save, MapPin, ExternalLink, LocateFixed } from "lucide-react";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { useAuth } from "@/lib/auth";
import type { Settings } from "@/lib/types";
import { Button, Card, Input, Textarea, Spinner, useToast } from "@/components/ui";
import { Logo } from "@/pages/cliente/Layout";
import { geocodePlace, cleanAddress, mapsPin, hasCoords, currentPosition } from "@/lib/route";

export default function Configuracoes() {
  const toast = useToast();
  const { settings, reload } = useSettings(true);
  const { session } = useAuth();
  const [form, setForm] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState("");
  const [found, setFound] = useState<string | null>(null);

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

  const locateOrigin = async () => {
    const q = (form.pickup_address.split(/retirada|me chama|das \d/i)[0] ?? form.pickup_address).trim();
    if (!cleanAddress(q)) return toast("Preencha o endereço de retirada primeiro.", "err");
    setBusy(true);
    const p = await geocodePlace(q, null).catch(() => null);
    setBusy(false);
    if (!p) return toast("Não achei esse endereço no mapa. Cole as coordenadas do Google Maps nos campos ao lado.", "err");
    setForm({ ...form, origin_lat: p.lat, origin_lng: p.lng });
    setFound(p.label);
    toast("Localização encontrada. Confira no mapa e salve.");
  };

  const useGps = async () => {
    setBusy(true);
    try {
      const p = await currentPosition();
      setForm({ ...form, origin_lat: Number(p.lat.toFixed(6)), origin_lng: Number(p.lng.toFixed(6)) });
      setFound(`sua localização atual (precisão de ${Math.round(p.accuracy)} m)`);
      toast("Localização pega pelo GPS. Confira no mapa e salve.");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
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
        <div className="mt-3 grid gap-3">
          <Input label="Frase de destaque no topo do cardápio" value={form.hero_title ?? ""} onChange={(e) => set("hero_title", e.target.value)} placeholder="Feito em casa, com carinho de verdade." />
          <Textarea label="Texto de apoio (embaixo da frase)" value={form.hero_subtitle ?? ""} onChange={(e) => set("hero_subtitle", e.target.value)} placeholder="Bolos, biscoitos e outras delícias preparadas no dia…" />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_open} onChange={(e) => set("is_open", e.target.checked)} /> loja aberta pra pedidos</label>
        <div className="mt-2"><Textarea label="Mensagem quando fechada" value={form.closed_message} onChange={(e) => set("closed_message", e.target.value)} /></div>
      </Card>

      <Card title="Retirada no local">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pickup_enabled} onChange={(e) => set("pickup_enabled", e.target.checked)} /> permitir que o cliente venha buscar</label>
        <div className="mt-3"><Textarea label="Endereço e instruções pra retirada" value={form.pickup_address} onChange={(e) => set("pickup_address", e.target.value)} placeholder="Ex.: Rua das Acácias, 120, casa 7 · Alphaville Lagoa dos Ingleses · Retirada das 14h às 19h, me chama no WhatsApp ao chegar" /></div>
        <p className="mt-1 text-xs text-choco-500">Aparece no checkout quando o cliente escolhe "Retirar" e na tela do pedido.</p>
      </Card>

      <Card title={<span className="flex items-center gap-2"><MapPin size={18} /> Ponto de partida das entregas</span>}>
        <p className="mb-3 text-sm text-choco-600">A localização da sua casa. É daqui que o sistema monta a rota do dia, do pedido mais perto pro mais longe.</p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button loading={busy} onClick={useGps}><LocateFixed size={16} /> Usar minha localização atual</Button>
          <span className="text-xs text-choco-500">Estando em casa, no celular, é o jeito mais certeiro.</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Latitude" value={form.origin_lat ?? ""} onChange={(e) => set("origin_lat", e.target.value === "" ? null : Number(e.target.value.replace(",", ".")))} placeholder="-20.0812" />
          <Input label="Longitude" value={form.origin_lng ?? ""} onChange={(e) => set("origin_lng", e.target.value === "" ? null : Number(e.target.value.replace(",", ".")))} placeholder="-43.9975" />
          <div className="flex items-end gap-2">
            <Button variant="outline" loading={busy} onClick={locateOrigin}><MapPin size={16} /> Tentar pelo endereço</Button>
          </div>
        </div>
        {found && <p className="mt-2 text-xs text-choco-700">Encontrado: <b>{found}</b></p>}
        <p className="mt-2 text-xs text-choco-500">
          {hasCoords({ lat: form.origin_lat, lng: form.origin_lng })
            ? <a href={mapsPin({ lat: form.origin_lat as number, lng: form.origin_lng as number })} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-vinho-600">Conferir no Google Maps <ExternalLink size={12} /></a>
            : "Sem localização: os pedidos ficam em ordem de horário e condomínio, sem distância."}
          {" "}Pra pegar as coordenadas manualmente: no Google Maps, toque e segure em cima da sua casa e copie os dois números que aparecem.
        </p>
      </Card>

      <Card title="Pagamento e prazos">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Chave Pix" value={form.pix_key} onChange={(e) => set("pix_key", e.target.value)} />
          <Input label="Nome no Pix" value={form.pix_name} onChange={(e) => set("pix_name", e.target.value)} />
          <Input label="Antecedência mínima (dias)" type="number" min={0} value={form.min_lead_days} onChange={(e) => set("min_lead_days", Number(e.target.value))} hint="1 = pedido hoje pra amanhã" />
          <Input label="Capacidade padrão por dia" type="number" min={0} value={form.default_daily_capacity} onChange={(e) => set("default_daily_capacity", Number(e.target.value))} />
          <Input label="Meta de faturamento do mês (R$)" type="number" min={0} step="50" value={form.monthly_goal ?? 0} onChange={(e) => set("monthly_goal", Number(e.target.value))} hint="Aparece no painel inicial: quanto já fez, quanto falta e o ritmo" />
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
