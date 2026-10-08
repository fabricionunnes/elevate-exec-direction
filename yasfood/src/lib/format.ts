import { format, parseISO, isToday, isTomorrow, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { OrderStatus, PaymentMethod } from "./types";

export const brl = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** (31) 99237-2507 */
export function formatPhone(p: string) {
  const d = onlyDigits(p).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}

/** Normaliza pra 55DDDNÚMERO (WhatsApp) */
export function waNumber(p: string) {
  const d = onlyDigits(p);
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

export const dateBR = (iso: string) => format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
export const dateTimeBR = (iso: string) => format(parseISO(iso), "dd/MM 'às' HH:mm", { locale: ptBR });
export const weekdayBR = (iso: string) => format(parseISO(iso), "EEEE", { locale: ptBR });
export const dayLabel = (iso: string) => {
  const d = parseISO(iso);
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  return format(d, "EEE, dd/MM", { locale: ptBR });
};
export const dayLong = (iso: string) => format(parseISO(iso), "EEEE, dd 'de' MMMM", { locale: ptBR });
export const todayISO = () => format(new Date(), "yyyy-MM-dd");
export const addDaysISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return format(d, "yyyy-MM-dd");
};
export const daysUntil = (iso: string) => differenceInCalendarDays(parseISO(iso), new Date());

export const STATUS_ORDER: OrderStatus[] = ["recebido", "confirmado", "em_producao", "pronto", "saiu_entrega", "entregue"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  recebido: "Recebido",
  confirmado: "Confirmado",
  em_producao: "Em produção",
  pronto: "Pronto",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  recebido: "bg-caramelo-400/20 text-caramelo-600 ring-caramelo-400/40",
  confirmado: "bg-sky-100 text-sky-800 ring-sky-300",
  em_producao: "bg-amber-100 text-amber-800 ring-amber-300",
  pronto: "bg-violet-100 text-violet-800 ring-violet-300",
  saiu_entrega: "bg-blue-100 text-blue-800 ring-blue-300",
  entregue: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  cancelado: "bg-neutral-200 text-neutral-700 ring-neutral-300",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão na entrega" };

export function nextStatus(s: OrderStatus, fulfillment: "entrega" | "retirada"): OrderStatus | null {
  const flow: OrderStatus[] = fulfillment === "retirada"
    ? ["recebido", "confirmado", "em_producao", "pronto", "entregue"]
    : ["recebido", "confirmado", "em_producao", "pronto", "saiu_entrega", "entregue"];
  const i = flow.indexOf(s);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}

export const statusLabelFor = (s: OrderStatus, fulfillment: "entrega" | "retirada") =>
  s === "entregue" && fulfillment === "retirada" ? "Retirado" : STATUS_LABEL[s];
