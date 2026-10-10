// Recompras: quem volta, de quanto em quanto tempo, quem está atrasado pra voltar.
// Calculado no navegador a partir dos pedidos (não cancelados), agrupados por cliente.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, ChevronDown, ChevronUp, Repeat } from "lucide-react";
import { clsx } from "clsx";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { brl, dateBR, formatPhone, todayISO } from "@/lib/format";
import { waLink, msgs } from "@/lib/whatsapp";
import { Card, Spinner, Empty, Stat } from "@/components/ui";
import { Faixa } from "@/components/charts";

interface Row { id: string; customer_id: string | null; customer_name: string; customer_phone: string; scheduled_date: string; status: string; total: number; order_items: { product_name: string; qty: number }[] | null }
interface Cliente {
  key: string; nome: string; telefone: string;
  pedidos: number; bolos: number; gasto: number; ticket: number;
  primeira: string; ultima: string; datas: string[]; intervalos: number[];
  mediaDias: number | null; diasDesde: number; proxima: string | null;
  situacao: "nova" | "no_prazo" | "deve_voltar" | "atrasado"; favorito: string;
}

const dias = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000);
const addDias = (a: string, n: number) => new Date(new Date(`${a}T12:00:00`).getTime() + n * 86400000).toISOString().slice(0, 10);
const SIT = {
  nova: { l: "1 compra", c: "bg-choco-100 text-choco-700" },
  no_prazo: { l: "no prazo", c: "bg-emerald-50 text-emerald-800" },
  deve_voltar: { l: "deve voltar", c: "bg-amber-50 text-amber-800" },
  atrasado: { l: "atrasado", c: "bg-red-50 text-red-800" },
};
type Ord = "pedidos" | "gasto" | "media" | "ultima";
type Seg = "todos" | "recorrentes" | "uma" | "atrasados" | "semana";

export default function Recompras() {
  const { settings } = useSettings();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [ord, setOrd] = useState<Ord>("pedidos");
  const [seg, setSeg] = useState<Seg>("todos");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void supabase.from("orders").select("id, customer_id, customer_name, customer_phone, scheduled_date, status, total, order_items(product_name, qty)").neq("status", "cancelado").order("scheduled_date")
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, []);

  const clientes = useMemo<Cliente[]>(() => {
    if (!rows) return [];
    const today = todayISO();
    const m = new Map<string, Row[]>();
    for (const r of rows) { const k = r.customer_id ?? r.customer_phone; m.set(k, [...(m.get(k) ?? []), r]); }
    return [...m.entries()].map(([key, os]) => {
      const datas = [...new Set(os.map((o) => o.scheduled_date))].sort();
      const intervalos = datas.slice(1).map((d, i) => dias(datas[i], d));
      const mediaDias = intervalos.length ? Math.round(intervalos.reduce((a, b) => a + b, 0) / intervalos.length) : null;
      const ultima = datas[datas.length - 1];
      const diasDesde = dias(ultima, today);
      const prods = new Map<string, number>();
      for (const o of os) for (const i of o.order_items ?? []) prods.set(i.product_name, (prods.get(i.product_name) ?? 0) + Number(i.qty));
      const favorito = [...prods.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      const gasto = os.reduce((a, o) => a + Number(o.total), 0);
      let situacao: Cliente["situacao"] = "nova";
      if (mediaDias !== null) situacao = diasDesde <= mediaDias ? "no_prazo" : diasDesde <= mediaDias * 1.5 ? "deve_voltar" : "atrasado";
      const last = os[os.length - 1];
      return {
        key, nome: last.customer_name, telefone: last.customer_phone,
        pedidos: os.length, bolos: os.reduce((a, o) => a + (o.order_items ?? []).reduce((x, i) => x + Number(i.qty), 0), 0), gasto, ticket: gasto / os.length,
        primeira: datas[0], ultima, datas, intervalos, mediaDias, diasDesde,
        proxima: mediaDias !== null ? addDias(ultima, mediaDias) : null, situacao, favorito,
      };
    });
  }, [rows]);

  const geral = useMemo(() => {
    const rec = clientes.filter((c) => c.pedidos > 1);
    const todosIntervalos = rec.flatMap((c) => c.intervalos);
    const today = todayISO();
    return {
      clientes: clientes.length,
      recorrentes: rec.length,
      taxa: clientes.length ? Math.round((rec.length / clientes.length) * 100) : 0,
      mediaGeral: todosIntervalos.length ? Math.round(todosIntervalos.reduce((a, b) => a + b, 0) / todosIntervalos.length) : null,
      pedidosPorCliente: clientes.length ? (clientes.reduce((a, c) => a + c.pedidos, 0) / clientes.length).toFixed(1) : "0",
      semana: clientes.filter((c) => c.proxima && c.proxima >= today && dias(today, c.proxima) <= 7).length,
      atrasados: clientes.filter((c) => c.situacao === "atrasado").length,
      faixas: [["até 7 dias", todosIntervalos.filter((d) => d <= 7).length], ["8 a 14", todosIntervalos.filter((d) => d > 7 && d <= 14).length], ["15 a 30", todosIntervalos.filter((d) => d > 14 && d <= 30).length], ["mais de 30", todosIntervalos.filter((d) => d > 30).length]] as [string, number][],
      gastoRec: rec.reduce((a, c) => a + c.gasto, 0),
      gastoTotal: clientes.reduce((a, c) => a + c.gasto, 0),
    };
  }, [clientes]);

  const lista = useMemo(() => {
    const today = todayISO();
    let l = clientes;
    if (seg === "recorrentes") l = l.filter((c) => c.pedidos > 1);
    if (seg === "uma") l = l.filter((c) => c.pedidos === 1);
    if (seg === "atrasados") l = l.filter((c) => c.situacao === "atrasado");
    if (seg === "semana") l = l.filter((c) => c.proxima && c.proxima >= today && dias(today, c.proxima) <= 7);
    const by: Record<Ord, (a: Cliente, b: Cliente) => number> = {
      pedidos: (a, b) => b.pedidos - a.pedidos || b.gasto - a.gasto,
      gasto: (a, b) => b.gasto - a.gasto,
      media: (a, b) => (a.mediaDias ?? 9999) - (b.mediaDias ?? 9999),
      ultima: (a, b) => b.ultima.localeCompare(a.ultima),
    };
    return [...l].sort(by[ord]);
  }, [clientes, seg, ord]);

  const cardapio = settings?.site_url ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black text-choco-900">Recompras</h1>
        <nav className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-choco-200 text-sm font-semibold">
          <Link to="/admin/clientes" className="rounded-full px-3 py-1 text-choco-700">Clientes</Link>
          <span className="rounded-full bg-vinho-600 px-3 py-1 text-white">Recompras</span>
        </nav>
      </div>

      {rows === null ? <Spinner /> : clientes.length === 0 ? <Empty>Ainda não tem pedidos pra medir recompra.</Empty> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Taxa de recompra" value={`${geral.taxa}%`} sub={`${geral.recorrentes} de ${geral.clientes} clientes voltaram`} tone="accent" />
            <Stat label="Intervalo médio" value={geral.mediaGeral !== null ? `${geral.mediaGeral} dias` : "—"} sub="entre uma compra e a próxima" />
            <Stat label="Pedidos por cliente" value={geral.pedidosPorCliente} sub={`${geral.gastoTotal ? Math.round((geral.gastoRec / geral.gastoTotal) * 100) : 0}% da receita vem de quem repete`} />
            <Stat label="Devem voltar em 7 dias" value={geral.semana} sub={`${geral.atrasados} atrasado(s) pra voltar`} tone={geral.atrasados ? "bad" : "good"} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[1.5px] text-choco-500">De quanto em quanto tempo voltam</div>
              <Faixa titulo="intervalos entre compras" itens={geral.faixas} cores={["#cd2345", "#e46683", "#ef9bb0", "#d4a97c"]} />
              <p className="mt-3 text-xs text-choco-600">"Atrasado" é quem passou de uma vez e meia o próprio intervalo médio sem comprar. É a hora de mandar mensagem.</p>
            </Card>
            <Card className="lg:col-span-2">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {(["todos", "recorrentes", "uma", "atrasados", "semana"] as Seg[]).map((s) => (
                  <button key={s} onClick={() => setSeg(s)} className={clsx("rounded-full px-3 py-1 text-xs font-semibold", seg === s ? "bg-vinho-600 text-white" : "bg-white text-choco-700 ring-1 ring-choco-200")}>
                    {{ todos: "todos", recorrentes: "recorrentes", uma: "só 1 compra", atrasados: "atrasados", semana: "voltam esta semana" }[s]}
                  </button>
                ))}
                <select value={ord} onChange={(e) => setOrd(e.target.value as Ord)} className="ml-auto h-8 rounded-lg border border-choco-200 bg-white px-2 text-xs">
                  <option value="pedidos">ranking: mais pedidos</option>
                  <option value="gasto">ranking: mais gastou</option>
                  <option value="media">ranking: volta mais rápido</option>
                  <option value="ultima">última compra</option>
                </select>
              </div>
              {lista.length === 0 ? <Empty>Ninguém nesse filtro.</Empty> : (
                <ul className="divide-y divide-choco-100">
                  {lista.map((c, i) => {
                    const aberto = open === c.key;
                    return (
                      <li key={c.key} className="py-2">
                        <button type="button" onClick={() => setOpen(aberto ? null : c.key)} className="flex w-full items-center gap-2 text-left text-sm">
                          <span className="w-6 text-xs font-bold text-choco-400">{i + 1}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2"><b className="truncate">{c.nome}</b><span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-bold", SIT[c.situacao].c)}>{SIT[c.situacao].l}</span></span>
                            <span className="block truncate text-xs text-choco-500">{c.pedidos} pedido(s) · {c.bolos} bolo(s) · {brl(c.gasto)}{c.mediaDias !== null ? ` · a cada ${c.mediaDias} dias` : ""} · última há {c.diasDesde} dia(s)</span>
                          </span>
                          {aberto ? <ChevronUp size={16} className="text-choco-400" /> : <ChevronDown size={16} className="text-choco-400" />}
                        </button>
                        {aberto && (
                          <div className="mt-2 rounded-xl bg-choco-50 p-3 text-sm">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              <div><div className="text-[10px] uppercase text-choco-500">Primeira compra</div><b>{dateBR(c.primeira)}</b></div>
                              <div><div className="text-[10px] uppercase text-choco-500">Última compra</div><b>{dateBR(c.ultima)}</b></div>
                              <div><div className="text-[10px] uppercase text-choco-500">Intervalo médio</div><b>{c.mediaDias !== null ? `${c.mediaDias} dias` : "—"}</b></div>
                              <div><div className="text-[10px] uppercase text-choco-500">Próxima prevista</div><b>{c.proxima ? dateBR(c.proxima) : "—"}</b></div>
                            </div>
                            <div className="mt-2 text-xs text-choco-600">Ticket médio {brl(c.ticket)}{c.favorito ? ` · prefere ${c.favorito}` : ""} · {formatPhone(c.telefone)}</div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {c.datas.map((d, k) => (
                                <span key={d} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-choco-200">
                                  {k > 0 && <span className="text-[10px] text-choco-400">+{c.intervalos[k - 1]}d</span>}{dateBR(d)}
                                </span>
                              ))}
                            </div>
                            {(c.situacao === "atrasado" || c.situacao === "deve_voltar") && (
                              <a href={waLink(c.telefone, msgs.reativacao(c.nome.split(" ")[0], cardapio))} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"><MessageCircle size={14} /> Chamar no WhatsApp</a>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
          <p className="flex items-center gap-1 text-[10px] text-choco-400"><Repeat size={12} /> Cliente identificado pelo cadastro (ou pelo telefone, em pedidos antigos sem cadastro).</p>
        </>
      )}
    </div>
  );
}
