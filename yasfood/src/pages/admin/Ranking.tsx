// Ranking de bairros e ruas (pra mandar no grupo) e sorteio entre quem pediu na rua campeã.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trophy, Gift, Copy, Send, ImageDown, Dices, Check, MapPin, Trash2, PartyPopper } from "lucide-react";
import { clsx } from "clsx";
import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { dateBR, dateTimeBR, formatPhone } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { Button, Card, Input, Select, Stat, Spinner, Empty, Modal, Textarea, useToast } from "@/components/ui";

interface Row { key: string; name: string; orders: number; customers: number; total: number; bairro?: string | null }
interface SemBairro { id: string; name: string; address: string; geo_address: string | null }
interface RankingData { orders: number; sem_bairro: number; sem_rua: number; bairros: Row[]; ruas: Row[]; sem_bairro_clientes: SemBairro[] }
interface Raffle { id: string; created_at: string; period_from: string | null; period_to: string | null; scope: "rua" | "bairro" | "todos"; scope_label: string; prize: string; weighted: boolean; participants: number; tickets: number; winner_name: string; winner_phone: string; delivered_at: string | null }
interface DrawResult { id: string; winner: { name: string; phone: string; tickets: number }; participants: number; tickets: number; entries: { name: string; tickets: number }[] }

type Periodo = "mes" | "mes_passado" | "30d" | "ano" | "tudo" | "custom";
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const first = (n: string) => n.trim().split(/\s+/)[0] ?? n;
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
const MEDAL = ["bg-amber-400 text-white", "bg-slate-300 text-choco-900", "bg-orange-300 text-choco-900"];

function periodRange(p: Periodo, from: string, to: string): { from: string | null; to: string | null; label: string } {
  const now = new Date();
  if (p === "mes") return { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)), label: format(now, "MMMM", { locale: ptBR }) };
  if (p === "mes_passado") { const m = subMonths(now, 1); return { from: iso(startOfMonth(m)), to: iso(endOfMonth(m)), label: format(m, "MMMM", { locale: ptBR }) }; }
  if (p === "30d") return { from: iso(subDays(now, 29)), to: iso(now), label: "últimos 30 dias" };
  if (p === "ano") return { from: iso(startOfYear(now)), to: iso(now), label: format(now, "yyyy") };
  if (p === "custom") return { from: from || null, to: to || null, label: `${from ? dateBR(from) : "início"} a ${to ? dateBR(to) : "hoje"}` };
  return { from: null, to: null, label: "de todos os tempos" };
}

/** Sugestão de bairro a partir do endereço que o mapa achou ("120, Rua X, Bairro, Nova Lima, ..."). */
function bairroFromGeo(geo: string | null) {
  if (!geo) return "";
  const parts = geo.split(",").map((s) => s.trim());
  const i = parts.findIndex((s) => /nova lima|belo horizonte|brumadinho|rio acima|sabar/i.test(s));
  const cand = i > 0 ? parts[i - 1] : "";
  return /^(rua|avenida|alameda|travessa|\d)/i.test(cand) ? "" : cand;
}

function RankList({ rows, unit, sub }: { rows: Row[]; unit: [string, string]; sub?: (r: Row) => string | null | undefined }) {
  if (!rows.length) return <Empty>Ainda sem pedidos com esse dado no período.</Empty>;
  const max = Math.max(...rows.map((r) => r.orders));
  return (
    <ol className="space-y-2">
      {rows.map((r, i) => (
        <li key={r.key} className="flex items-center gap-3">
          <span className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black", MEDAL[i] ?? "bg-rosa-100 text-vinho-700")}>{i + 1}º</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-semibold text-choco-900">{r.name}</span>
              <span className="shrink-0 text-sm font-bold text-vinho-700">{plural(r.orders, unit[0], unit[1])}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-rosa-100"><div className="h-full rounded-full bg-gradient-to-r from-rosa-500 to-vinho-600" style={{ width: `${Math.max(6, (r.orders / max) * 100)}%` }} /></div>
            <div className="mt-0.5 text-xs text-choco-500">{plural(r.customers, "cliente", "clientes")}{sub?.(r) ? ` · ${sub(r)}` : ""}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Imagem do ranking pro grupo (1080x1440). */
async function rankingImage(opts: { title: string; period: string; bairros: Row[]; ruas: Row[]; prize: string; site: string }) {
  const W = 1080, H = 1440;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  await document.fonts?.ready;
  g.fillStyle = "#fbf3ea"; g.fillRect(0, 0, W, H);
  // bolinhas de fundo
  g.fillStyle = "#fce4ec";
  for (let i = 0; i < 70; i++) { const x = (i * 157) % W, y = (i * 263) % H, r = 6 + (i % 5) * 2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  // faixa de chocolate com pingos
  g.fillStyle = "#4a2c20"; g.fillRect(0, 0, W, 70);
  for (let x = 10; x < W; x += 74) { const len = 30 + ((x * 37) % 70); g.beginPath(); g.roundRect(x, 40, 30, len, 15); g.fill(); }
  const logo = new Image(); logo.src = "/logo.webp";
  await new Promise((r) => { logo.onload = r; logo.onerror = r; });
  if (logo.complete && logo.naturalWidth) g.drawImage(logo, W / 2 - 110, 120, 220, 220);
  g.textAlign = "center";
  g.fillStyle = "#b0123a"; g.font = "900 64px Inter, sans-serif"; g.fillText(opts.title, W / 2, 410);
  g.fillStyle = "#785442"; g.font = "600 32px Inter, sans-serif"; g.fillText(opts.period, W / 2, 458);

  const block = (label: string, rows: Row[], y0: number, n: number) => {
    g.textAlign = "left"; g.fillStyle = "#4a2c20"; g.font = "800 36px Inter, sans-serif"; g.fillText(label, 90, y0);
    const max = Math.max(1, ...rows.map((r) => r.orders));
    rows.slice(0, n).forEach((r, i) => {
      const y = y0 + 40 + i * 84;
      const medal = ["#f2b632", "#c7ccd4", "#e9a26b"][i] ?? "#fbd2df";
      g.fillStyle = medal; g.beginPath(); g.arc(120, y + 30, 30, 0, Math.PI * 2); g.fill();
      g.fillStyle = i < 3 ? "#ffffff" : "#b0123a"; g.font = "900 28px Inter, sans-serif"; g.textAlign = "center"; g.fillText(`${i + 1}º`, 120, y + 40);
      g.textAlign = "left"; g.fillStyle = "#2b1810"; g.font = "700 32px Inter, sans-serif";
      let name = r.name; while (g.measureText(name).width > 620 && name.length > 4) name = name.slice(0, -2);
      g.fillText(name === r.name ? name : `${name}…`, 172, y + 26);
      g.fillStyle = "#fce4ec"; g.beginPath(); g.roundRect(172, y + 40, 640, 16, 8); g.fill();
      const grad = g.createLinearGradient(172, 0, 812, 0); grad.addColorStop(0, "#ec4879"); grad.addColorStop(1, "#b0123a");
      g.fillStyle = grad; g.beginPath(); g.roundRect(172, y + 40, Math.max(30, (r.orders / max) * 640), 16, 8); g.fill();
      g.textAlign = "right"; g.fillStyle = "#b0123a"; g.font = "800 30px Inter, sans-serif"; g.fillText(plural(r.orders, "pedido", "pedidos"), 990, y + 26);
    });
  };
  const nb = Math.min(3, opts.bairros.length), nr = Math.min(opts.bairros.length ? 3 : 7, opts.ruas.length);
  let y = 540;
  if (nb) { block("Bairros que mais pediram", opts.bairros, y, nb); y += 70 + nb * 84; }
  if (nr) block("Ruas campeãs", opts.ruas, y, nr);
  // rodapé
  g.textAlign = "center";
  g.fillStyle = "#ec4879"; g.beginPath(); g.roundRect(140, H - 200, W - 280, 92, 46); g.fill();
  g.fillStyle = "#ffffff"; g.font = "800 34px Inter, sans-serif";
  g.fillText(opts.prize ? `A rua campeã concorre a ${opts.prize}!`.slice(0, 48) : "Coloque sua rua no topo!", W / 2, H - 142);
  g.fillStyle = "#b0123a"; g.font = "700 30px Inter, sans-serif"; g.fillText(opts.site.replace(/^https?:\/\//, ""), W / 2, H - 50);
  return new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
}

export default function Ranking() {
  const toast = useToast();
  const { settings } = useSettings();
  const site = (settings?.site_url || window.location.origin).replace(/\/$/, "");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = useMemo(() => periodRange(periodo, from, to), [periodo, from, to]);
  const [data, setData] = useState<RankingData | null>(null);
  const [history, setHistory] = useState<Raffle[]>([]);
  const [prize, setPrize] = useState("");
  const [msg, setMsg] = useState("");
  const [msgTouched, setMsgTouched] = useState(false);
  const [products, setProducts] = useState<string[]>([]);
  const [fix, setFix] = useState<Record<string, string>>({});

  // sorteio
  const [scope, setScope] = useState<"rua" | "bairro" | "todos">("rua");
  const [scopeKey, setScopeKey] = useState("");
  const [weighted, setWeighted] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<DrawResult | null>(null);
  const [reel, setReel] = useState<string>("");
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    setData(null);
    const { data: d, error } = await supabase.rpc("neighborhood_ranking", { p_from: range.from, p_to: range.to });
    if (error) { toast(friendlyError(error), "err"); return; }
    setData(d as RankingData);
  }, [range.from, range.to, toast]);
  const loadHistory = useCallback(async () => {
    const { data: h } = await supabase.from("raffles").select("*").order("created_at", { ascending: false }).limit(30);
    setHistory((h as Raffle[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);
  useEffect(() => { void supabase.from("products").select("name").eq("active", true).order("name").then(({ data: p }) => setProducts(((p as { name: string }[]) ?? []).map((x) => x.name))); }, []);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  // opção padrão do sorteio: a campeã
  useEffect(() => {
    if (!data) return;
    const list = scope === "rua" ? data.ruas : scope === "bairro" ? data.bairros : [];
    if (scope !== "todos" && !list.some((r) => r.key === scopeKey)) setScopeKey(list[0]?.key ?? "");
  }, [data, scope, scopeKey]);

  const business = settings?.business_name || "Yas Delícias";
  const autoMsg = useMemo(() => {
    if (!data) return "";
    const lines = [`*Ranking ${business} · ${range.label.replace(/^\w/, (c) => c.toUpperCase())}*`, ""];
    if (data.bairros.length) {
      lines.push("*Bairros que mais pediram*");
      data.bairros.slice(0, 5).forEach((r, i) => lines.push(`${i + 1}º ${r.name} · ${plural(r.orders, "pedido", "pedidos")}`));
      lines.push("");
    }
    if (data.ruas.length) {
      lines.push("*Ruas campeãs*");
      data.ruas.slice(0, 5).forEach((r, i) => lines.push(`${i + 1}º ${r.name}${r.bairro ? ` (${r.bairro})` : ""} · ${plural(r.orders, "pedido", "pedidos")}`));
      lines.push("");
    }
    lines.push(prize.trim() ? `A rua campeã concorre a *${prize.trim()}* no sorteio! Quanto mais pedidos, mais chances.` : "Bora colocar a sua rua no topo do ranking?");
    lines.push(`Peça pelo link: ${site}`);
    return lines.join("\n");
  }, [data, business, range.label, prize, site]);
  useEffect(() => { if (!msgTouched) setMsg(autoMsg); }, [autoMsg, msgTouched]);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast("Copiado. É só colar no grupo."); } catch { toast("Não consegui copiar. Segure no texto e copie.", "err"); }
  };
  const sendWa = (text: string) => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");

  const shareImage = async () => {
    if (!data) return;
    const blob = await rankingImage({ title: "Ranking dos bairros", period: range.label.replace(/^\w/, (c) => c.toUpperCase()), bairros: data.bairros, ruas: data.ruas, prize: prize.trim(), site });
    const file = new File([blob], "ranking-yas.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: msg }); return; } catch { /* cancelou */ return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "ranking-yas.png"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Imagem baixada.");
  };

  const saveBairro = async (c: SemBairro) => {
    const v = (fix[c.id] ?? bairroFromGeo(c.geo_address)).trim();
    if (v.length < 2) return toast("Escreva o bairro.", "err");
    const { error } = await supabase.from("customers").update({ bairro: v }).eq("id", c.id);
    if (error) return toast(friendlyError(error), "err");
    toast(`Bairro de ${first(c.name)} salvo.`);
    void load();
  };

  const scopeList = scope === "rua" ? data?.ruas ?? [] : scope === "bairro" ? data?.bairros ?? [] : [];
  const scopeRow = scopeList.find((r) => r.key === scopeKey);
  const scopeLabel = scope === "todos" ? "Todos os clientes" : scopeRow ? `${scope === "rua" ? "Rua" : "Bairro"}: ${scopeRow.name}` : "";

  const draw = async () => {
    if (!prize.trim()) return toast("Escreva o prêmio do sorteio.", "err");
    if (scope !== "todos" && !scopeKey) return toast(`Escolha ${scope === "rua" ? "a rua" : "o bairro"}.`, "err");
    setDrawing(true);
    const { data: r, error } = await supabase.rpc("draw_raffle", { p: { from: range.from, to: range.to, scope, key: scopeKey, label: scopeLabel, prize: prize.trim(), weighted } });
    setDrawing(false);
    if (error) return toast(friendlyError(error), "err");
    const res = r as DrawResult;
    setResult(res); setRevealed(false);
    // roleta: passa os nomes acelerado e vai freando até parar na pessoa sorteada
    const names = res.entries.flatMap((e) => Array.from({ length: Math.min(e.tickets, 4) }, () => first(e.name)));
    const pool = names.length ? names : [first(res.winner.name)];
    let i = 0, delay = 60;
    const step = () => {
      i++;
      if (delay > 420) { setReel(first(res.winner.name)); setRevealed(true); void loadHistory(); return; }
      setReel(pool[(i * 7) % pool.length]);
      delay = delay * 1.09 + 4;
      timer.current = window.setTimeout(step, delay);
    };
    step();
  };

  const resultGroupMsg = (r: DrawResult) => [
    `*Sorteio ${business}*`,
    scopeLabel ? `${scopeLabel}` : "",
    "",
    `Quem ganhou: *${first(r.winner.name)}* (telefone final ${r.winner.phone.slice(-4)})`,
    `Prêmio: *${prize.trim()}*`,
    "",
    "Parabéns! O próximo sorteio pode ser na sua rua.",
    `Peça pelo link: ${site}`,
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  const winnerMsg = (r: DrawResult) => `Oi, ${first(r.winner.name)}! Aqui é a Yasmim, da ${business}. Seu nome saiu no sorteio do ranking e você ganhou ${prize.trim()}! Vamos combinar a entrega?`;

  const toggleDelivered = async (h: Raffle) => {
    const { error } = await supabase.from("raffles").update({ delivered_at: h.delivered_at ? null : new Date().toISOString() }).eq("id", h.id);
    if (error) return toast(friendlyError(error), "err");
    void loadHistory();
  };
  const removeRaffle = async (h: Raffle) => {
    if (!window.confirm("Apagar esse sorteio do histórico?")) return;
    const { error } = await supabase.from("raffles").delete().eq("id", h.id);
    if (error) return toast(friendlyError(error), "err");
    void loadHistory();
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-choco-900"><Trophy className="text-vinho-600" /> Ranking e sorteio</h1>
          <p className="text-sm text-choco-600">Mande o ranking no grupo pra animar os pedidos e sorteie um prêmio na rua campeã.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Select label="Período" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
            <option value="mes">Este mês</option>
            <option value="mes_passado">Mês passado</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="ano">Este ano</option>
            <option value="tudo">Desde o começo</option>
            <option value="custom">Escolher datas</option>
          </Select>
          {periodo === "custom" && <>
            <Input label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </>}
        </div>
      </div>

      {!data ? <Spinner /> : <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Pedidos no período" value={data.orders} />
          <Stat label="Bairros" value={data.bairros.length} tone="accent" />
          <Stat label="Ruas" value={data.ruas.length} />
          <Stat label="Pedidos sem bairro" value={data.sem_bairro} tone={data.sem_bairro ? "bad" : "good"} sub={data.sem_bairro ? "veja embaixo" : "tudo certo"} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={<span className="flex items-center gap-2"><MapPin size={18} /> Bairros que mais pediram</span>}>
            <RankList rows={data.bairros.slice(0, 10)} unit={["pedido", "pedidos"]} />
          </Card>
          <Card title={<span className="flex items-center gap-2"><Trophy size={18} /> Ruas campeãs</span>}>
            <RankList rows={data.ruas.slice(0, 10)} unit={["pedido", "pedidos"]} sub={(r) => r.bairro} />
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={<span className="flex items-center gap-2"><Send size={18} /> Mandar no grupo</span>}>
            <Input label="Prêmio do sorteio (aparece na mensagem e no sorteio)" placeholder="Ex.: um bolo de cenoura com cobertura" value={prize} onChange={(e) => setPrize(e.target.value)} list="yas-premios" />
            <datalist id="yas-premios">{products.map((p) => <option key={p} value={p} />)}</datalist>
            <div className="mt-3">
              <Textarea label="Mensagem" rows={11} value={msg} onChange={(e) => { setMsg(e.target.value); setMsgTouched(true); }} />
              {msgTouched && <button type="button" className="mt-1 text-xs font-semibold text-vinho-700 underline" onClick={() => { setMsgTouched(false); setMsg(autoMsg); }}>Voltar pra mensagem automática</button>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => void copy(msg)}><Copy size={16} /> Copiar mensagem</Button>
              <Button variant="outline" onClick={() => sendWa(msg)}><Send size={16} /> Abrir no WhatsApp</Button>
              <Button variant="outline" onClick={() => void shareImage()}><ImageDown size={16} /> Imagem do ranking</Button>
            </div>
            <p className="mt-2 text-xs text-choco-500">A mensagem e a imagem mostram só bairros e ruas, nunca o nome dos clientes.</p>
          </Card>

          <Card title={<span className="flex items-center gap-2"><Gift size={18} /> Sorteio</span>}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Sortear entre quem pediu" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
                <option value="rua">na rua</option>
                <option value="bairro">no bairro</option>
                <option value="todos">em qualquer lugar</option>
              </Select>
              {scope !== "todos" && (
                <Select label={scope === "rua" ? "Qual rua" : "Qual bairro"} value={scopeKey} onChange={(e) => setScopeKey(e.target.value)}>
                  {scopeList.length === 0 && <option value="">Nenhum{scope === "rua" ? "a rua" : " bairro"} no período</option>}
                  {scopeList.map((r, i) => <option key={r.key} value={r.key}>{i === 0 ? "Campeã: " : `${i + 1}º `}{r.name} ({plural(r.customers, "cliente", "clientes")})</option>)}
                </Select>
              )}
            </div>
            <label className="mt-3 flex items-start gap-2 text-sm text-choco-700">
              <input type="checkbox" className="mt-1" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} />
              <span>Cada pedido vale um cupom (quem pediu mais vezes tem mais chances). Desmarcado: uma chance por cliente.</span>
            </label>
            <div className="mt-3 rounded-xl bg-rosa-50 p-3 text-sm text-choco-700">
              Prêmio: <b>{prize.trim() || "escreva no campo Prêmio do sorteio"}</b>{scopeLabel ? <> · {scopeLabel}</> : null} · período {range.label}
            </div>
            <Button className="mt-3 w-full" size="lg" loading={drawing} onClick={() => void draw()}><Dices size={18} /> Sortear agora</Button>
            <p className="mt-2 text-xs text-choco-500">O sorteio é feito no servidor e fica guardado no histórico, com data, prêmio e quem ganhou.</p>
          </Card>
        </div>

        {data.sem_bairro_clientes.length > 0 && (
          <Card title={<span className="flex items-center gap-2"><MapPin size={18} /> Clientes sem bairro ({data.sem_bairro_clientes.length})</span>}>
            <p className="mb-3 text-sm text-choco-600">Esses pedidos ficam fora do ranking de bairros. Complete aqui; os próximos pedidos já perguntam o bairro.</p>
            <ul className="divide-y divide-choco-100">
              {data.sem_bairro_clientes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-end gap-2 py-2">
                  <div className="min-w-[10rem] flex-1"><div className="font-semibold">{c.name}</div><div className="text-xs text-choco-500">{c.address || "sem endereço"}</div></div>
                  <Input className="w-56" placeholder="Bairro ou condomínio" value={fix[c.id] ?? bairroFromGeo(c.geo_address)} onChange={(e) => setFix({ ...fix, [c.id]: e.target.value })} list="yas-bairros" />
                  <Button size="sm" onClick={() => void saveBairro(c)}><Check size={14} /> Salvar</Button>
                </li>
              ))}
            </ul>
            <datalist id="yas-bairros">{data.bairros.map((b) => <option key={b.key} value={b.name} />)}</datalist>
          </Card>
        )}
      </>}

      <Card title="Sorteios feitos">
        {!history.length ? <Empty>Nenhum sorteio ainda.</Empty> : (
          <ul className="divide-y divide-choco-100 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-choco-900">{h.winner_name} <span className="font-normal text-choco-500">· {formatPhone(h.winner_phone)}</span></div>
                  <div className="text-xs text-choco-600">{h.prize} · {h.scope_label || "Todos"} · {plural(h.participants, "participante", "participantes")} · {dateTimeBR(h.created_at)}</div>
                </div>
                <a className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700" href={waLink(h.winner_phone, `Oi, ${first(h.winner_name)}! Aqui é a Yasmim, da ${business}. Seu nome saiu no sorteio e você ganhou ${h.prize}! Vamos combinar a entrega?`)} target="_blank" rel="noreferrer">WhatsApp</a>
                <button type="button" onClick={() => void toggleDelivered(h)} className={clsx("rounded-full px-3 py-1.5 text-xs font-bold", h.delivered_at ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>{h.delivered_at ? "Prêmio entregue" : "Marcar entregue"}</button>
                <button type="button" onClick={() => void removeRaffle(h)} className="rounded-full p-1.5 text-choco-400 hover:bg-red-50 hover:text-red-600" aria-label="Apagar"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={!!result} onClose={() => { if (revealed) setResult(null); }} title={revealed ? "Temos quem ganhou!" : "Sorteando…"}>
        {result && (
          <div className="relative overflow-hidden text-center">
            <style>{`@keyframes yas-confetti { 0% { transform: translateY(-20px) rotate(0); opacity: 1 } 100% { transform: translateY(260px) rotate(540deg); opacity: 0 } }`}</style>
            {revealed && Array.from({ length: 36 }).map((_, i) => (
              <span key={i} className="pointer-events-none absolute top-0 h-3 w-2 rounded-sm" style={{ left: `${(i * 29) % 100}%`, background: ["#ec4879", "#b0123a", "#f2b632", "#fce4ec"][i % 4], animation: `yas-confetti ${1.4 + (i % 5) * 0.25}s ease-in ${(i % 7) * 0.08}s forwards` }} />
            ))}
            <div className="text-sm text-choco-600">{scopeLabel} · {plural(result.participants, "participante", "participantes")} · {plural(result.tickets, "cupom", "cupons")}</div>
            <div className={clsx("my-5 rounded-3xl px-4 py-8 text-4xl font-black transition", revealed ? "bg-gradient-to-br from-rosa-500 to-vinho-600 text-white shadow-soft" : "bg-white text-vinho-700")}>
              {revealed && <PartyPopper className="mx-auto mb-2" size={36} />}
              {reel}
            </div>
            {revealed && (
              <div className="space-y-3">
                <p className="text-choco-800"><b>{result.winner.name}</b> · {formatPhone(result.winner.phone)}<br />ganhou <b>{prize.trim()}</b>{weighted ? ` (tinha ${plural(result.winner.tickets, "cupom", "cupons")})` : ""}</p>
                <div className="grid gap-2">
                  <a href={waLink(result.winner.phone, winnerMsg(result))} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700"><Send size={16} /> Avisar quem ganhou no WhatsApp</a>
                  <Button variant="outline" onClick={() => void copy(resultGroupMsg(result))}><Copy size={16} /> Copiar resultado pro grupo</Button>
                  <Button variant="outline" onClick={() => sendWa(resultGroupMsg(result))}><Send size={16} /> Mandar resultado no grupo</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
