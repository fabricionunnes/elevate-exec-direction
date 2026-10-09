import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getMyOrders } from "@/lib/cart";
import { brl, dayLabel, statusLabelFor, STATUS_COLOR } from "@/lib/format";
import type { TrackedOrder } from "@/lib/types";
import { Badge, Empty, Spinner, Button } from "@/components/ui";

export default function MeusPedidos() {
  const refs = getMyOrders();
  const [orders, setOrders] = useState<TrackedOrder[] | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await Promise.all(refs.map((r) => supabase.rpc("get_order_by_token", { p_token: r.token })));
      setOrders(res.map((r) => r.data as TrackedOrder).filter(Boolean));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (refs.length === 0) {
    return (
      <Empty>
        Você ainda não fez pedidos neste aparelho.
        <div className="mt-3"><Link to="/"><Button>Ver cardápio</Button></Link></div>
      </Empty>
    );
  }
  if (!orders) return <Spinner />;

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-black text-choco-900">Meus pedidos</h1>
      {orders.map(({ order, items }) => (
        <Link key={order.id} to={`/pedido/${order.tracking_token}`} className="flex items-center gap-3 rounded-2xl border border-choco-100 bg-white p-4 shadow-card hover:border-vinho-300">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold">{order.code}</span>
              <Badge className={STATUS_COLOR[order.status]}>{statusLabelFor(order.status, order.fulfillment)}</Badge>
            </div>
            <div className="truncate text-sm text-choco-600">{items.map((i) => `${i.qty}x ${i.product_name}`).join(", ")}</div>
            <div className="text-xs capitalize text-choco-500">{dayLabel(order.scheduled_date)} · {brl(order.total)}</div>
          </div>
          <ChevronRight className="text-choco-300" />
        </Link>
      ))}
    </div>
  );
}
