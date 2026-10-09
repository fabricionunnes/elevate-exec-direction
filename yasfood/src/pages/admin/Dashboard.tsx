// Painel inicial da Yasmim: gestão à vista. Meta do mês, metas do dia, resultado
// (dia/semana/mês), gráficos em 3D (mix de produtos, vendas por dia, tendência,
// dia da semana), clientes, pedidos de hoje na ordem de prioridade, agenda,
// avaliações e alertas. Atualiza sozinho quando um pedido muda.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Star, ShoppingCart } from "lucide-react";
import { clsx } from "clsx";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subMonths } from "date-fns";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { brl, dayLabel, todayISO, addDaysISO, STATUS_COLOR, statusLabelFor, PAYMENT_LABEL } from "@/lib/format";
import { resumo, type DashOrder, type Resumo, CORES } from "@/lib/dash";
import { prioritize, hasCoords, fmtKm } from "@/lib/route";
import type { Availability, Customer, DeliveryWindow, DeliveryZone, Ingredient, Review, ShoppingItem, Transaction } from "@/lib/types";
import { Card, Badge, Spinner, Empty, Stars, Modal, Input, Button, useToast } from "@/components/ui";
import { Barra3D, BarraMeta, Degrades, Dica, Donut3D, MetaDia, kfmt } from "@/components/charts";

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
const n0 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

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
  const pagFatias = r.pagamento.map(([k, v], i) => ({ nome: PAYMENT_LABEL[k], valor: v, cor: CORES[i % CORES.length] }));
  const zonaFatias = r.zonas.map(([k, v], i) => ({ nome: k, valor: v, cor: CORES[(i + 3) % CORES.length] }));

  return (
    <div className="space-y-4">
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
          {d.lowStock.length > 0 && <Link to="/admin/estoque" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 ring-1 ring-red-200"><AlertTriangle size={16} /> Estoque baixo: {d.lowStock.map((i) => i.name).join(", ")}</Link>}
          {d.compras > 0 && <Link to="/admin/compras" className="flex items-center gap-2 rounded-xl bg-choco-50 px-3 py-2 text-sm text-choco-900 ring-1 ring-choco-200"><ShoppingCart size={16} /> {d.compras} item(ns) na lista de compras</Link>}
          {d.reviewQueue > 0 && <Link to="/admin/avaliacoes" className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-200"><Star size={16} /> {d.reviewQueue} cliente(s) pra pedir avaliação</Link>}
        </div>
      )}

      {/* linha 1: mix 3D, resultado, vendas por dia */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="min-h-[300px]">
          <H sub="bolos vendidos">Mix de produtos · mês</H>
          <div className="h-[260px]"><Donut3D fatias={mixFatias} vazio="Sem vendas no mês ainda." formato={(f) => `${f.valor} un`} /></div>
        </Card>

        <Card>
          <H>Resultado · dia, semana e mês</H>
          <table className="w-full table-fixed border-collapse text-sm">
            <thead><tr className="text-[10px] uppercase tracking-wide text-choco-400"><th className="w-[28%] py-1 text-left font-medium" /><th className="py-1 text-right font-medium">Hoje</th><th className="py-1 text-right font-medium">Semana</th><th className="py-1 text-right font-medium">Mês</th></tr></thead>
            <tbody className="[&_td]:border-b [&_td]:border-choco-100 [&_td]:py-1.5 [&_td]:pl-1 [&_td]:text-right [&_td]:text-[13px] [&_td]:font-bold [&_td]:tabular-nums [&_th]:border-b [&_th]:border-choco-100 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium [&_th]:text-choco-700">
              <tr><th>Pedidos</th><td>{r.hoje.pedidos}</td><td>{r.semana.pedidos}</td><td>{r.mes.pedidos}</td></tr>
              <tr><th>Bolos</th><td>{r.hoje.bolos}</td><td>{r.semana.bolos}</td><td>{r.mes.bolos}</td></tr>
              <tr><th>Receita</th><td>{brl(r.hoje.receita)}</td><td>{brl(r.semana.receita)}</td><td className="text-vinho-700">{brl(r.mes.receita)}</td></tr>
              <tr><th>Recebido</th><td className="text-emerald-700">{brl(r.hoje.recebido)}</td><td className="text-emerald-700">{brl(r.semana.recebido)}</td><td className="text-emerald-700">{brl(r.mes.recebido)}</td></tr>
              <tr><th>Ticket médio</th><td>{brl(r.hoje.ticket)}</td><td>{brl(r.semana.ticket)}</td><td>{brl(r.mes.ticket)}</td></tr>
              <tr><th>Clientes novos</th><td>{r.hoje.clientesNovos}</td><td>{r.semana.clientesNovos}</td><td>{r.mes.clientesNovos}</td></tr>
            </tbody>
          </table>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-choco-50 p-2"><div className="text-[10px] text-choco-500">Lucro do mês</div><b className={clsx("text-lg", lucroMes >= 0 ? "text-emerald-700" : "text-red-700")}>{brl(lucroMes)}</b><div className="text-[10px] text-choco-500">despesas {brl(r.despesaMes)}</div></div>
            <div className="rounded-xl bg-choco-50 p-2"><div className="text-[10px] text-choco-500">A receber no mês</div><b className={clsx("text-lg", r.caixa.aReceberMes > 0 ? "text-amber-700" : "text-choco-900")}>{brl(r.caixa.aReceberMes)}</b><div className="text-[10px] text-choco-500">pedidos sem pagamento</div></div>
          </div>
        </Card>

        <Card>
          <H sub="barra = receita · linha = bolos">Vendas por dia · mês</H>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={r.serieDias} margin={{ top: 14, right: 6, left: -14, bottom: 0 }}>
                <Degrades />
                <CartesianGrid vertical={false} stroke="#f3e7d8" />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#8c5a2b" }} interval={2} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" tick={{ fontSize: 10, fill: "#8c5a2b" }} axisLine={false} tickLine={false} tickFormatter={kfmt} />
                <YAxis yAxisId="b" orientation="right" hide />
                <Tooltip content={<Dica dinheiro={["Receita"]} />} />
                <Bar yAxisId="r" dataKey="receita" name="Receita" shape={<Barra3D />} isAnimationActive={false} />
                <Line yAxisId="b" dataKey="bolos" name="Bolos" stroke="#d98a3a" strokeWidth={2.5} dot={{ r: 2.5, fill: "#d98a3a" }} filter="url(#brilho)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* linha 2: tendência, dia da semana, horários/pagamento */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <H sub={meta > 0 ? "linha tracejada = meta · ponto = projeção" : "ponto = projeção do mês"}>Tendência · 6 meses</H>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={r.tendencia} margin={{ top: 14, right: 6, left: -14, bottom: 0 }}>
                <Degrades />
                <CartesianGrid vertical={false} stroke="#f3e7d8" />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: "#8c5a2b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#8c5a2b" }} axisLine={false} tickLine={false} tickFormatter={kfmt} />
                <Tooltip content={<Dica dinheiro={["Receita", "Meta", "Projeção"]} />} />
                <Area dataKey="receita" name="Receita" stroke="none" fill="url(#areaVinho)" isAnimationActive={false} />
                <Bar dataKey="receita" name="Receita" shape={<Barra3D />} isAnimationActive={false} />
                {meta > 0 && <Line dataKey="meta" name="Meta" stroke="#b86f26" strokeDasharray="5 4" strokeWidth={1.5} dot={false} />}
                <Line dataKey="projecao" name="Projeção" stroke="#dc3a5c" strokeWidth={0} dot={{ r: 5, fill: "#dc3a5c", stroke: "#fff", strokeWidth: 2 }} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <H sub="últimos 90 dias">Bolos por dia da semana</H>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={r.semanaDias} margin={{ top: 14, right: 6, left: -22, bottom: 0 }}>
                <Degrades />
                <CartesianGrid vertical={false} stroke="#f3e7d8" />
                <XAxis dataKey="n" tick={{ fontSize: 11, fill: "#8c5a2b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#8c5a2b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Dica />} />
                <Bar dataKey="bolos" name="Bolos" shape={<Barra3D tom="caramelo" />} isAnimationActive={false} />
                <Line dataKey="pedidos" name="Pedidos" stroke="#cd2345" strokeWidth={2} dot={{ r: 2.5, fill: "#cd2345" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <H>Como o cliente compra · mês</H>
          <div className="grid gap-3">
            <div className="h-[110px]"><Donut3D fatias={pagFatias} vazio="Sem pedidos no mês." formato={(f) => `${f.valor} ped.`} /></div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-choco-400">Horários</div>
              <div className="space-y-1">
                {r.horarios.slice(0, 4).map(([k, v]) => {
                  const max = r.horarios[0]?.[1] ?? 1;
                  return <div key={k} className="grid grid-cols-[90px_1fr_28px] items-center gap-2 text-xs"><span className="truncate text-choco-700">{k}</span><div className="h-3 overflow-hidden rounded bg-choco-100"><div className="h-full rounded bg-gradient-to-r from-choco-300 to-vinho-500" style={{ width: `${(v / max) * 100}%` }} /></div><b className="text-right">{v}</b></div>;
                })}
                {r.horarios.length === 0 && <div className="text-xs text-choco-500">Sem pedidos no mês.</div>}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* linha 3: pedidos de hoje, agenda, clientes */}
      <div className="grid gap-3 lg:grid-cols-3">
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
      </div>

      {/* linha 4: regiões, avaliações */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <H sub="pedidos no mês">Onde entregamos</H>
          <div className="h-[170px]"><Donut3D fatias={zonaFatias} vazio="Sem pedidos no mês." formato={(f) => `${f.valor}`} /></div>
        </Card>
        <Card className="lg:col-span-2" title={<span className="flex items-center gap-2">Avaliações {d.reviews.length > 0 && <span className="text-sm font-medium text-choco-500">média {avg.toFixed(1)} · {d.reviews.length} avaliação(ões)</span>}</span>} action={<Link to="/admin/avaliacoes" className="text-sm font-semibold text-vinho-600">ver todas</Link>}>
          {d.reviews.length === 0 ? <Empty>Ainda sem avaliações.</Empty> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {d.reviews.slice(0, 4).map((rv) => (
                <li key={rv.id} className="rounded-xl bg-choco-50 p-2 text-sm">
                  <div className="flex items-center justify-between"><b>{rv.customer_name}</b><Stars value={rv.rating} size={14} /></div>
                  {rv.comment && <p className="mt-1 line-clamp-2 text-choco-700">“{rv.comment}”</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="text-center text-[10px] text-choco-400">{n0(d.orders.length)} pedidos nos últimos 6 meses · painel recalculado a cada mudança</div>
    </div>
  );
}
