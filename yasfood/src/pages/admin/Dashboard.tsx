// Painel inicial da Yasmim: gestão à vista. Meta do mês, metas do dia, resultado
// (dia/semana/mês), gráficos em 3D (mix de produtos, vendas por dia, tendência,
// dia da semana), clientes, pedidos de hoje na ordem de prioridade, agenda,
// avaliações e alertas. Atualiza sozinho quando um pedido muda.
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Star, ShoppingCart } from "lucide-react";
import { clsx } from "clsx";
import { Bar, CartesianGrid, ComposedChart, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subMonths } from "date-fns";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { brl, dayLabel, todayISO, addDaysISO, STATUS_COLOR, statusLabelFor, PAYMENT_LABEL } from "@/lib/format";
import { resumo, type DashOrder, type Resumo, CORES } from "@/lib/dash";
import { prioritize, hasCoords, fmtKm } from "@/lib/route";
import type { Availability, Customer, DeliveryWindow, DeliveryZone, Ingredient, Review, ShoppingItem, Transaction } from "@/lib/types";
import { Card, Badge, Spinner, Empty, Stars, Modal, Input, Button, useToast } from "@/components/ui";
import { Barra3D, BarraMeta, Degrades, Dica, Donut3D, Faixa, MetaDia, kfmt } from "@/components/charts";

interface Dados {
  orders: DashOrder[];
  customers: Customer[];
  tx: Transaction[];
  availability: Availability[];
  lowStock: Ingredient[];
  compras: number;
  reviews: Review[];
  reviewQueue: number;
  windows: DeliveryWindow[];
  zones: DeliveryZone[];
}

const H = ({ children, sub }: { children: React.ReactNode; sub?: string }) => (
  <div className="mb-2 text-[10px] font-bold uppercase tracking-[1.5px] text-choco-500">{children}{sub && <span className="ml-2 font-medium normal-case tracking-normal text-choco-400">{sub}</span>}</div>
);
type BarShape = { x?: number; y?: number; width?: number; height?: number };
const n0 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
/** Reais sem centavos quando o valor é redondo: "R$ 315" em vez de "R$ 315,00". */
const brlC = (v: number) => (Math.abs(v - Math.round(v)) < 0.005 ? brl(v).replace(/,00$/, "") : brl(v));

export default function Dashboard() {
  const { settings, reload: reloadSettings } = useSettings(true);
  const toast = useToast();
  const [d, setD] = useState<Dados | null>(null);
  const [agora, setAgora] = useState(new Date());
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaInput, setMetaInput] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salvarMeta = async () => {
    const v = Number(metaInput.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(v) || v < 0) return toast("Informe um valor válido.", "err");
    setSalvando(true);
    const { error } = await supabase.from("settings").update({ monthly_goal: v }).eq("id", 1);
    setSalvando(false);
    if (error) return toast(friendlyError(error), "err");
    setMetaOpen(false);
    toast(v > 0 ? "Meta do mês salva." : "Meta removida.");
    void reloadSettings();
  };

  const load = useCallback(async () => {
    const today = todayISO();
    const from6 = format(subMonths(new Date(), 5), "yyyy-MM-01");
    const [o, c, t, av, ing, comp, rev, queue, win, zon] = await Promise.all([
      supabase.from("orders").select("*, order_items(product_name, qty, line_total)").gte("scheduled_date", from6).order("scheduled_date").order("created_at"),
      supabase.from("customers").select("*"),
      supabase.from("transactions").select("*").gte("occurred_on", from6),
      supabase.rpc("availability", { p_from: today, p_to: addDaysISO(7) }),
      supabase.from("ingredients").select("*").eq("active", true),
      supabase.from("shopping_items").select("id", { count: "exact", head: true }).eq("done", false),
      supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.rpc("pending_review_requests"),
      supabase.from("delivery_windows").select("id, start_time"),
      supabase.from("delivery_zones").select("id, lat, lng, sort_order"),
    ]);
    setD({
      orders: (o.data as DashOrder[]) ?? [],
      customers: (c.data as Customer[]) ?? [],
      tx: (t.data as Transaction[]) ?? [],
      availability: (av.data as Availability[]) ?? [],
      lowStock: ((ing.data as Ingredient[]) ?? []).filter((i) => Number(i.qty_on_hand) <= Number(i.min_qty)),
      compras: comp.count ?? 0,
      reviews: (rev.data as Review[]) ?? [],
      reviewQueue: ((queue.data as unknown[]) ?? []).length,
      windows: (win.data as DeliveryWindow[]) ?? [],
      zones: (zon.data as DeliveryZone[]) ?? [],
    });
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase.channel("dash-admin");
    for (const table of ["orders", "transactions", "reviews"]) ch.on("postgres_changes", { event: "*", schema: "yasfood", table }, () => void load());
    ch.subscribe();
    const pulso = window.setInterval(() => void load(), 60000);
    const relogio = window.setInterval(() => setAgora(new Date()), 30000);
    return () => { void supabase.removeChannel(ch); window.clearInterval(pulso); window.clearInterval(relogio); };
  }, [load]);

  const r: Resumo | null = useMemo(() => (d ? resumo(d.orders, d.customers, d.tx, Number(settings?.monthly_goal ?? 0)) : null), [d, settings?.monthly_goal]);

  if (!d || !r) return <Spinner />;

  const origin = settings && hasCoords({ lat: settings.origin_lat, lng: settings.origin_lng }) ? { lat: settings.origin_lat as number, lng: settings.origin_lng as number } : null;
  const hojeLista = prioritize(d.orders.filter((o) => o.scheduled_date === todayISO() && o.status !== "cancelado"), { origin, windows: d.windows, zones: d.zones });
  const avg = d.reviews.length ? d.reviews.reduce((a, x) => a + x.rating, 0) / d.reviews.length : 0;
  const lucroMes = r.mes.receita - r.despesaMes;
  const meta = Number(settings?.monthly_goal ?? 0);
  const saud = agora.getHours() < 12 ? "Bom dia" : agora.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const mixFatias = r.mix.map((m) => ({ nome: m.nome, valor: m.qtd, cor: m.cor, sub: brl(m.receita) }));
  const diasComVenda = r.serieDias.filter((x) => (x.bolos ?? 0) > 0).length;
  const maxTend = Math.max(1, ...r.tendencia.map((t) => Math.max(t.receita, t.projecao ?? 0)));
  const metaNaEscala = meta > 0 && meta <= maxTend * 2.5;
  const zonaFatias = r.zonas.map(([k, v], i) => ({ nome: k, valor: v, cor: CORES[(i + 3) % CORES.length] }));

  return (
    <div className="space-y-4">
      <Degrades />
      {/* topo: saudação, data e meta do mês */}
      <div className="grid gap-3 lg:grid-cols-[auto_1fr] lg:items-center">
        <div>
          <h1 className="text-2xl font-black text-choco-900">{saud}, Yasmim</h1>
          <div className="text-xs capitalize text-choco-500">{agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · atualiza sozinho</div>
        </div>
        <Card className="!p-3">
          <H>Meta do mês · faturamento</H>
          <BarraMeta feito={r.mes.receita} meta={meta} pTempo={r.pTempo} ritmo={r.ritmo} onEditar={() => { setMetaInput(meta ? String(meta) : ""); setMetaOpen(true); }} />
        </Card>
      </div>
      {metaOpen && (
        <Modal open onClose={() => setMetaOpen(false)} title="Meta de faturamento do mês">
          <div className="space-y-3">
            <Input label="Quanto quer faturar no mês (R$)" inputMode="decimal" autoFocus value={metaInput} onChange={(e) => setMetaInput(e.target.value)} placeholder="Ex.: 3000" hint="A barra mostra quanto já fez, quanto falta e em quanto fecha no ritmo atual. Também dá pra mudar em Configurações." />
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setMetaOpen(false)}>Cancelar</Button><Button loading={salvando} onClick={salvarMeta}>Salvar meta</Button></div>
          </div>
        </Modal>
      )}

      {/* metas do dia */}
      <div className="grid gap-3 md:grid-cols-3">
        <MetaDia titulo="Hoje · produção" tom="vinho" p={r.producao.total ? Math.round((r.producao.prontos / r.producao.total) * 100) : 100}
          big={`${r.producao.prontos}/${r.producao.total}`} de="bolos prontos" itens={[["Em produção", String(r.producao.emProducao)], ["Na fila", String(r.producao.aguardando)]]} />
        <MetaDia titulo="Hoje · entregas e retiradas" tom="caramelo" p={r.entregas.total + r.entregas.retiradas ? Math.round(((r.entregas.feitas + r.entregas.retiradasFeitas) / (r.entregas.total + r.entregas.retiradas)) * 100) : 100}
          big={`${r.entregas.feitas}/${r.entregas.total}`} de="entregas feitas" itens={[["Na rua", String(r.entregas.naRua)], ["Retiradas", `${r.entregas.retiradasFeitas}/${r.entregas.retiradas}`]]} />
        <MetaDia titulo="Hoje · caixa" tom="verde" p={r.caixa.recebidoHoje + r.caixa.aReceberHoje ? Math.round((r.caixa.recebidoHoje / (r.caixa.recebidoHoje + r.caixa.aReceberHoje)) * 100) : 100}
          big={brl(r.caixa.recebidoHoje)} de="recebido hoje" itens={[["A receber hoje", brl(r.caixa.aReceberHoje)], ["Pago hoje", brl(r.caixa.pagoHoje)]]} />
      </div>

      {/* alertas */}
      {(d.lowStock.length > 0 || r.caixa.aReceberMes > 0 || d.reviewQueue > 0 || d.compras > 0) && (
        <div className="flex flex-wrap gap-2">
          {r.caixa.aReceberMes > 0 && <Link to="/admin/pedidos?pagamento=pendente" className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200"><AlertTriangle size={16} /> {brl(r.caixa.aReceberMes)} a receber no mês</Link>}
          {d.lowStock.length > 0 && <Link to="/admin/estoque" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 ring-1 ring-red-200"><AlertTriangle size={16} /> Estoque baixo: {d.lowStock.map((i) => `${i.name} ${Number(i.qty_on_hand).toLocaleString("pt-BR")} ${i.unit} (mín. ${Number(i.min_qty).toLocaleString("pt-BR")})`).join(" · ")}</Link>}
          {d.compras > 0 && <Link to="/admin/compras" className="flex items-center gap-2 rounded-xl bg-choco-50 px-3 py-2 text-sm text-choco-900 ring-1 ring-choco-200"><ShoppingCart size={16} /> {d.compras} item(ns) na lista de compras</Link>}
          {d.reviewQueue > 0 && <Link to="/admin/avaliacoes" className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-200"><Star size={16} /> {d.reviewQueue} cliente(s) pra pedir avaliação</Link>}
        </div>
      )}

      {/* linha 1: resultado e vendas por dia */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <H>Resultado · dia, semana e mês</H>
          <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,auto)] items-center text-sm">
            <span /><span className="text-right text-[10px] uppercase tracking-wide text-choco-400">Hoje</span><span className="text-right text-[10px] uppercase tracking-wide text-choco-400">Semana</span><span className="text-right text-[10px] uppercase tracking-wide text-choco-400">Mês</span>
            {([
              ["Pedidos", [r.hoje.pedidos, r.semana.pedidos, r.mes.pedidos], ""],
              ["Bolos", [r.hoje.bolos, r.semana.bolos, r.mes.bolos], ""],
              ["Receita", [brlC(r.hoje.receita), brlC(r.semana.receita), brlC(r.mes.receita)], "text-vinho-700"],
              ["Recebido", [brlC(r.hoje.recebido), brlC(r.semana.recebido), brlC(r.mes.recebido)], "text-emerald-700"],
              ["Ticket médio", [brlC(r.hoje.ticket), brlC(r.semana.ticket), brlC(r.mes.ticket)], ""],
              ["Clientes novos", [r.hoje.clientesNovos, r.semana.clientesNovos, r.mes.clientesNovos], ""],
            ] as [string, (string | number)[], string][]).map(([l, vs, cor]) => (
              <Fragment key={l}>
                <span className="truncate border-t border-choco-100 py-2 text-choco-700">{l}</span>
                {vs.map((v, i) => <b key={i} className={clsx("whitespace-nowrap border-t border-choco-100 py-2 pl-3 text-right tabular-nums", i === 2 ? "text-[15px]" : "text-[13px] text-choco-800", i === 2 && cor)}>{v}</b>)}
              </Fragment>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-choco-50 p-2"><div className="text-[10px] text-choco-500">Lucro do mês</div><b className={clsx("text-lg", lucroMes >= 0 ? "text-emerald-700" : "text-red-700")}>{brlC(lucroMes)}</b><div className="text-[10px] text-choco-500">despesas {brl(r.despesaMes)}</div></div>
            <div className="rounded-xl bg-choco-50 p-2"><div className="text-[10px] text-choco-500">A receber no mês</div><b className={clsx("text-lg", r.caixa.aReceberMes > 0 ? "text-amber-700" : "text-choco-900")}>{brlC(r.caixa.aReceberMes)}</b><div className="text-[10px] text-choco-500">pedidos sem pagamento</div></div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <H sub="claro = encomendado pros próximos dias">Vendas por dia · mês</H>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={r.serieDias} margin={{ top: 18, right: 6, left: -16, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="#f3e7d8" />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#8c5a2b" }} interval={2} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#8c5a2b" }} axisLine={false} tickLine={false} tickFormatter={kfmt} />
                <Tooltip content={<Dica dinheiro={["Receita"]} />} cursor={{ fill: "#fdf2f5" }} />
                <ReferenceLine x={String(r.diaHoje)} stroke="#d98a3a" strokeDasharray="3 3" label={{ value: "hoje", position: "top", fontSize: 10, fill: "#b86f26" }} />
                <Bar dataKey="receita" name="Receita" maxBarSize={26} isAnimationActive={false} shape={(p: unknown) => { const q = p as BarShape & { payload?: { futuro?: boolean } }; return <Barra3D {...q} tom={q.payload?.futuro ? "cinza" : "vinho"} />; }}>
                  {diasComVenda <= 12 && <LabelList dataKey="bolos" position="top" fontSize={10} fill="#8c5a2b" formatter={(v: number | null) => (v ? `${v}` : "")} />}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-[10px] text-choco-400">número em cima da barra = bolos do dia</div>
        </Card>
      </div>

      {/* linha 2: mix 3D, tendência, dia da semana */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="min-h-[300px]">
          <H sub="bolos vendidos">Mix de produtos · mês</H>
          <div className="h-[260px]"><Donut3D fatias={mixFatias} vazio="Sem vendas no mês ainda." formato={(f) => `${f.valor} un`} /></div>
        </Card>

        <Card>
          <H sub={meta > 0 ? (metaNaEscala ? "tracejado = meta · claro = projeção no ritmo" : `meta ${brl(meta)} fora da escala · claro = projeção`) : "claro = projeção do mês no ritmo"}>Tendência · 6 meses</H>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={r.tendencia} margin={{ top: 18, right: 6, left: -16, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#f3e7d8" />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: "#8c5a2b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#8c5a2b" }} axisLine={false} tickLine={false} tickFormatter={kfmt} />
                <Tooltip content={<Dica dinheiro={["Receita", "Projeção"]} />} cursor={{ fill: "#fdf2f5" }} />
                {meta > 0 && metaNaEscala && <ReferenceLine y={meta} ifOverflow="extendDomain" stroke="#b86f26" strokeDasharray="5 4" label={{ value: `meta ${kfmt(meta)}`, position: "insideTopRight", fontSize: 10, fill: "#b86f26" }} />}
                <Bar dataKey="receita" name="Receita" stackId="t" maxBarSize={34} isAnimationActive={false} shape={<Barra3D />}>
                  <LabelList dataKey="receita" position="insideTop" fontSize={10} fill="#fff" formatter={(v: number) => (v > 0 ? kfmt(v) : "")} />
                </Bar>
                <Bar dataKey="projecaoExtra" name="Projeção" stackId="t" maxBarSize={34} isAnimationActive={false} shape={<Barra3D tom="cinza" />}>
                  <LabelList dataKey="projecao" position="top" fontSize={10} fill="#b86f26" formatter={(v: number | null) => (v ? `~${kfmt(v)}` : "")} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <H sub={r.melhorDia.bolos > 0 ? `melhor dia: ${r.melhorDia.n} · últimos 90 dias` : "últimos 90 dias"}>Bolos por dia da semana</H>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={r.semanaDias} margin={{ top: 18, right: 6, left: -22, bottom: 0 }} barCategoryGap="26%">
                <CartesianGrid vertical={false} stroke="#f3e7d8" />
                <XAxis dataKey="n" tick={{ fontSize: 11, fill: "#8c5a2b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#8c5a2b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Dica />} cursor={{ fill: "#fdf2f5" }} />
                <Bar dataKey="bolos" name="Bolos" maxBarSize={34} isAnimationActive={false} shape={(p: unknown) => { const q = p as BarShape & { payload?: { i?: number } }; return <Barra3D {...q} tom={q.payload?.i === r.melhorDia.i && r.melhorDia.bolos > 0 ? "vinho" : "caramelo"} />; }}>
                  <LabelList dataKey="bolos" position="top" fontSize={11} fill="#5a2a1a" formatter={(v: number) => (v > 0 ? `${v}` : "")} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

      </div>

      {/* linha 3: como compra, pedidos de hoje, agenda */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <H>Como o cliente compra · mês</H>
          <div className="space-y-4">
            <Faixa titulo="Pagamento" itens={r.pagamento.map(([k, v]) => [PAYMENT_LABEL[k], v])} />
            <Faixa titulo="Entrega ou retirada" itens={r.entrega.map(([k, v]) => [k === "entrega" ? "Entrega" : "Retirada", v])} cores={["#8c5a2b", "#d98a3a"]} />
            <Faixa titulo="Horário" itens={r.horarios.slice(0, 4)} cores={["#dc3a5c", "#e46683", "#ef9bb0", "#f7c6d2"]} />
          </div>
        </Card>
        <Card title="Pedidos de hoje" action={<Link to="/admin/pedidos" className="text-sm font-semibold text-vinho-600">ver todos</Link>}>
          {hojeLista.length === 0 ? <Empty>Nenhum pedido pra hoje.</Empty> : (
            <ul className="divide-y divide-choco-100">
              {hojeLista.map(({ order: o, rank, legKm, approx }) => (
                <li key={o.id} className="flex items-center gap-2 py-2 text-sm">
                  {o.status !== "entregue" && <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-choco-900 px-1.5 text-xs font-black text-white">{rank}º</span>}
                  <Link to={`/admin/pedidos?abrir=${o.id}`} className="min-w-0 truncate font-semibold hover:text-vinho-600">{o.code} · {o.customer_name}</Link>
                  <span className="hidden whitespace-nowrap text-xs text-choco-500 sm:inline">{o.fulfillment === "retirada" ? "retirada" : o.window_label ?? ""}{legKm !== null ? ` · ${approx ? "~" : ""}${fmtKm(legKm)}` : ""}</span>
                  <Badge className={clsx("ml-auto shrink-0", STATUS_COLOR[o.status])}>{statusLabelFor(o.status, o.fulfillment)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Agenda dos próximos 7 dias" action={<Link to="/admin/agenda" className="text-sm font-semibold text-vinho-600">gerenciar</Link>}>
          {d.availability.length === 0 ? <Empty>Agenda fechada. Abra dias na aba Agenda pra receber pedidos.</Empty> : (
            <ul className="space-y-1.5">
              {d.availability.map((a) => (
                <li key={a.day} className="flex items-center gap-3 text-sm">
                  <span className="w-28 capitalize">{dayLabel(a.day)}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-choco-100"><div className={clsx("h-full", a.remaining === 0 ? "bg-red-500" : "bg-gradient-to-r from-vinho-400 to-vinho-600")} style={{ width: `${a.max_units ? Math.min(100, (a.booked_units / a.max_units) * 100) : 0}%` }} /></div>
                  <span className="w-14 text-right text-choco-600">{a.booked_units}/{a.max_units}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

      </div>

      {/* linha 4: clientes, regiões, avaliações */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Clientes" action={<Link to="/admin/clientes" className="text-sm font-semibold text-vinho-600">ver todos</Link>}>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-choco-50 p-2"><b className="block text-xl">{d.customers.filter((c) => c.kind === "cliente").length}</b><span className="text-[10px] text-choco-500">clientes</span></div>
            <div className="rounded-xl bg-choco-50 p-2"><b className="block text-xl text-vinho-700">{r.clientesComPedido ? Math.round((r.recorrentes / r.clientesComPedido) * 100) : 0}%</b><span className="text-[10px] text-choco-500">voltaram a comprar</span></div>
            <div className="rounded-xl bg-choco-50 p-2"><b className="block text-xl">{d.customers.filter((c) => c.kind === "lead").length}</b><span className="text-[10px] text-choco-500">leads</span></div>
          </div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-choco-400">Top 5 · 6 meses</div>
          {r.topClientes.length === 0 ? <div className="text-xs text-choco-500">Ainda sem pedidos.</div> : (
            <ol className="space-y-1 text-sm">
              {r.topClientes.map((c, i) => (
                <li key={c.nome + i} className="flex items-center gap-2"><span className="w-4 text-xs font-bold text-choco-400">{i + 1}</span><span className="min-w-0 flex-1 truncate">{c.nome}</span><span className="text-xs text-choco-500">{c.bolos} bolo(s)</span><b className="whitespace-nowrap">{brl(c.gasto)}</b></li>
              ))}
            </ol>
          )}
        </Card>
        <Card>
          <H sub="pedidos no mês">Onde entregamos</H>
          <div className="h-[230px]"><Donut3D fatias={zonaFatias} vazio="Sem pedidos no mês." formato={(f) => `${f.valor}`} legendaEmbaixo /></div>
        </Card>
        <Card title="Avaliações" action={<Link to="/admin/avaliacoes" className="text-sm font-semibold text-vinho-600">ver todas</Link>}>
          {d.reviews.length === 0 ? <Empty>Ainda sem avaliações.</Empty> : (
            <>
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-choco-50 px-3 py-2"><Stars value={Math.round(avg)} size={16} /><b className="text-lg">{avg.toFixed(1)}</b><span className="text-xs text-choco-500">{d.reviews.length} avaliação(ões)</span></div>
              <ul className="space-y-2">
                {d.reviews.slice(0, 3).map((rv) => (
                  <li key={rv.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2"><b className="truncate">{rv.customer_name}</b><Stars value={rv.rating} size={13} /></div>
                    {rv.comment && <p className="line-clamp-2 text-xs text-choco-700">“{rv.comment}”</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
      <div className="text-center text-[10px] text-choco-400">{n0(d.orders.length)} pedidos nos últimos 6 meses · painel recalculado a cada mudança</div>
    </div>
  );
}
