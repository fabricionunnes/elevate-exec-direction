// Números do painel inicial (gestão à vista da Yasmim), calculados no navegador a partir
// dos pedidos dos últimos 6 meses. Volume pequeno: não precisa de RPC.
import { format, getDaysInMonth, parseISO, startOfWeek, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Customer, Order, Transaction } from "./types";
import { todayISO } from "./format";

export interface DashOrder extends Order { order_items: { product_name: string; qty: number; line_total: number }[] | null }

export interface Periodo { pedidos: number; bolos: number; receita: number; recebido: number; ticket: number; clientesNovos: number }
export interface Fatia { nome: string; qtd: number; receita: number; cor: string }

export const CORES = ["#cd2345", "#e86f8d", "#d98a3a", "#8c5a2b", "#f08ea6", "#b86f26", "#5a2a1a", "#dc3a5c", "#e6a35a", "#d4a97c"];

const ATIVO = (o: Order) => o.status !== "cancelado";
const bolosDe = (o: DashOrder) => (o.order_items ?? []).reduce((a, i) => a + Number(i.qty), 0);
const localDate = (iso: string) => format(new Date(iso), "yyyy-MM-dd");

function periodo(orders: DashOrder[], customers: Customer[], from: string, to: string): Periodo {
  const os = orders.filter((o) => ATIVO(o) && o.scheduled_date >= from && o.scheduled_date <= to);
  const receita = os.reduce((a, o) => a + Number(o.total), 0);
  return {
    pedidos: os.length,
    bolos: os.reduce((a, o) => a + bolosDe(o), 0),
    receita,
    recebido: os.filter((o) => o.payment_status === "pago").reduce((a, o) => a + Number(o.total), 0),
    ticket: os.length ? receita / os.length : 0,
    clientesNovos: customers.filter((c) => { const d = localDate(c.created_at); return d >= from && d <= to; }).length,
  };
}

export function resumo(orders: DashOrder[], customers: Customer[], tx: Transaction[], monthlyGoal: number) {
  const today = todayISO();
  const now = new Date();
  const mesIni = today.slice(0, 8) + "01";
  const semIni = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const diasMes = getDaysInMonth(now);
  const diaHoje = now.getDate();

  const hoje = periodo(orders, customers, today, today);
  const semana = periodo(orders, customers, semIni, today);
  const mes = periodo(orders, customers, mesIni, today.slice(0, 8) + "31");

  // meta do mês
  const pMeta = monthlyGoal > 0 ? Math.min(100, Math.round((mes.receita / monthlyGoal) * 100)) : 0;
  const pTempo = Math.round((diaHoje / diasMes) * 100);
  const ritmo = diaHoje > 0 ? (mes.receita / diaHoje) * diasMes : 0;

  // receita e bolos por dia do mês
  const serieDias = Array.from({ length: diasMes }, (_, i) => {
    const d = `${today.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
    const os = orders.filter((o) => ATIVO(o) && o.scheduled_date === d);
    const futuro = d > today;
    // dias que ainda não chegaram: só o que já está encomendado; sem nada, fica em branco
    const receita = os.reduce((a, o) => a + Number(o.total), 0);
    const bolos = os.reduce((a, o) => a + bolosDe(o), 0);
    return { d: String(i + 1), dia: d, receita: futuro && !receita ? null : receita, bolos: futuro && !bolos ? null : bolos, futuro };
  });

  // 6 meses
  const tendencia = Array.from({ length: 6 }, (_, k) => {
    const m = format(subMonths(now, 5 - k), "yyyy-MM");
    const os = orders.filter((o) => ATIVO(o) && o.scheduled_date.startsWith(m));
    return { m: format(parseISO(`${m}-01`), "MMM", { locale: ptBR }), mes: m, receita: os.reduce((a, o) => a + Number(o.total), 0), bolos: os.reduce((a, o) => a + bolosDe(o), 0), pedidos: os.length, meta: monthlyGoal || null, projecao: m === today.slice(0, 7) ? ritmo : null };
  });

  // dia da semana (90 dias)
  const d90 = format(subDays(now, 90), "yyyy-MM-dd");
  const semanaDias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((n, i) => ({ n, i, bolos: 0, pedidos: 0 }));
  for (const o of orders.filter((o) => ATIVO(o) && o.scheduled_date >= d90 && o.scheduled_date <= today)) {
    const w = parseISO(o.scheduled_date).getDay();
    semanaDias[w].bolos += bolosDe(o); semanaDias[w].pedidos += 1;
  }

  // mix de produtos no mês
  const mixMap = new Map<string, { qtd: number; receita: number }>();
  for (const o of orders.filter((o) => ATIVO(o) && o.scheduled_date >= mesIni)) {
    for (const i of o.order_items ?? []) {
      const cur = mixMap.get(i.product_name) ?? { qtd: 0, receita: 0 };
      cur.qtd += Number(i.qty); cur.receita += Number(i.line_total);
      mixMap.set(i.product_name, cur);
    }
  }
  const mix: Fatia[] = [...mixMap.entries()].sort((a, b) => b[1].qtd - a[1].qtd).map(([nome, v], i) => ({ nome, ...v, cor: CORES[i % CORES.length] }));

  // pagamento, horários e entrega x retirada (mês)
  const osMes = orders.filter((o) => ATIVO(o) && o.scheduled_date >= mesIni);
  const conta = <K extends string>(f: (o: DashOrder) => K) => { const m = new Map<K, number>(); for (const o of osMes) m.set(f(o), (m.get(f(o)) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const pagamento = conta((o) => o.payment_method);
  const horarios = conta((o) => (o.window_label ?? "a combinar") as string);
  const entrega = conta((o) => o.fulfillment);
  const zonas = conta((o) => (o.fulfillment === "entrega" ? o.zone_name ?? "sem região" : "retirada") as string);

  // clientes: top 5 e recorrência (6 meses)
  const porCliente = new Map<string, { nome: string; pedidos: number; bolos: number; gasto: number; ultimo: string }>();
  for (const o of orders.filter(ATIVO)) {
    const k = o.customer_phone;
    const cur = porCliente.get(k) ?? { nome: o.customer_name, pedidos: 0, bolos: 0, gasto: 0, ultimo: o.scheduled_date };
    cur.pedidos += 1; cur.bolos += bolosDe(o); cur.gasto += Number(o.total); if (o.scheduled_date > cur.ultimo) cur.ultimo = o.scheduled_date;
    porCliente.set(k, cur);
  }
  const topClientes = [...porCliente.values()].sort((a, b) => b.gasto - a.gasto).slice(0, 5);
  const recorrentes = [...porCliente.values()].filter((c) => c.pedidos > 1).length;
  const clientesComPedido = porCliente.size;

  // hoje: produção, entregas, caixa
  const osHoje = orders.filter((o) => ATIVO(o) && o.scheduled_date === today);
  const prontos = osHoje.filter((o) => ["pronto", "saiu_entrega", "entregue"].includes(o.status));
  const entregasHoje = osHoje.filter((o) => o.fulfillment === "entrega");
  const entreguesHoje = osHoje.filter((o) => o.status === "entregue");
  const recebidoHoje = tx.filter((t) => t.type === "receita" && t.occurred_on === today).reduce((a, t) => a + Number(t.amount), 0);
  const pagoHoje = tx.filter((t) => t.type === "despesa" && t.occurred_on === today).reduce((a, t) => a + Number(t.amount), 0);
  const aReceberHoje = osHoje.filter((o) => o.payment_status !== "pago").reduce((a, o) => a + Number(o.total), 0);
  const emProducao = osHoje.filter((o) => o.status === "em_producao").length;
  const aguardando = osHoje.filter((o) => ["recebido", "confirmado"].includes(o.status)).length;

  // despesas do mês (pra lucro)
  const despesaMes = tx.filter((t) => t.type === "despesa" && t.occurred_on >= mesIni).reduce((a, t) => a + Number(t.amount), 0);

  return {
    hoje, semana, mes, pMeta, pTempo, ritmo, diasMes, diaHoje,
    serieDias, tendencia, semanaDias, mix, pagamento, horarios, entrega, zonas,
    topClientes, recorrentes, clientesComPedido,
    producao: { total: osHoje.reduce((a, o) => a + bolosDe(o), 0), prontos: prontos.reduce((a, o) => a + bolosDe(o), 0), emProducao, aguardando },
    entregas: { total: entregasHoje.length, feitas: entregasHoje.filter((o) => o.status === "entregue").length, retiradas: osHoje.length - entregasHoje.length, retiradasFeitas: entreguesHoje.length - entregasHoje.filter((o) => o.status === "entregue").length, naRua: osHoje.filter((o) => o.status === "saiu_entrega").length },
    caixa: { recebidoHoje, pagoHoje, aReceberHoje, aReceberMes: mes.receita - mes.recebido },
    despesaMes,
  };
}

export type Resumo = ReturnType<typeof resumo>;
