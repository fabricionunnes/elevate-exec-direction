import { clsx } from "clsx";
import { Check, ChefHat, ClipboardCheck, Home, PackageCheck, Truck, XCircle, Inbox } from "lucide-react";
import { dateTimeBR, STATUS_ORDER, statusLabelFor } from "@/lib/format";
import type { Fulfillment, OrderEvent, OrderStatus } from "@/lib/types";

const ICON: Record<OrderStatus, typeof Check> = {
  recebido: Inbox,
  confirmado: ClipboardCheck,
  em_producao: ChefHat,
  pronto: PackageCheck,
  saiu_entrega: Truck,
  entregue: Home,
  cancelado: XCircle,
};

/** Linha do tempo estilo rastreio de encomenda. */
export function StatusTimeline({ status, fulfillment, events }: { status: OrderStatus; fulfillment: Fulfillment; events: OrderEvent[] }) {
  const steps = STATUS_ORDER.filter((s) => !(fulfillment === "retirada" && s === "saiu_entrega"));
  const cancelled = status === "cancelado";
  const currentIdx = steps.indexOf(status);
  const lastEvent = (s: OrderStatus) => [...events].reverse().find((e) => e.status === s);

  return (
    <ol className="relative ml-3 border-l-2 border-choco-100">
      {steps.map((s, i) => {
        const done = !cancelled && i <= currentIdx;
        const current = !cancelled && i === currentIdx;
        const Icon = ICON[s];
        const ev = lastEvent(s);
        return (
          <li key={s} className="mb-5 ml-6 last:mb-0">
            <span
              className={clsx(
                "absolute -left-[15px] flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-creme",
                done ? "bg-vinho-600 text-white" : "bg-choco-100 text-choco-400",
                current && "animate-pulse"
              )}
            >
              {done && !current ? <Check size={15} /> : <Icon size={15} />}
            </span>
            <div className={clsx("font-semibold", done ? "text-choco-900" : "text-choco-400")}>{statusLabelFor(s, fulfillment)}</div>
            {ev && done && (
              <div className="text-xs text-choco-500">
                {dateTimeBR(ev.created_at)}
                {ev.note && <span className="block text-choco-600">{ev.note}</span>}
              </div>
            )}
          </li>
        );
      })}
      {cancelled && (
        <li className="ml-6">
          <span className="absolute -left-[15px] flex h-7 w-7 items-center justify-center rounded-full bg-neutral-600 text-white ring-4 ring-creme"><XCircle size={15} /></span>
          <div className="font-semibold text-neutral-700">Cancelado</div>
          {lastEvent("cancelado") && <div className="text-xs text-choco-500">{dateTimeBR(lastEvent("cancelado")!.created_at)}<span className="block">{lastEvent("cancelado")!.note}</span></div>}
        </li>
      )}
    </ol>
  );
}
