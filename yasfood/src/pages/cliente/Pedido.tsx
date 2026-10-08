import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Copy, MessageCircle, PartyPopper, RefreshCw } from "lucide-react";
import { supabase, friendlyError } from "@/lib/supabase";
import { brl, dayLong, PAYMENT_LABEL, statusLabelFor, STATUS_COLOR } from "@/lib/format";
import { waLink, pedidoClienteMsg } from "@/lib/whatsapp";
import type { TrackedOrder } from "@/lib/types";
import { StatusTimeline } from "@/components/StatusTimeline";
import { Button, Badge, Spinner, Empty, Stars, Textarea, useToast } from "@/components/ui";

export default function Pedido() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const novo = params.get("novo") === "1";
  const toast = useToast();
  const [data, setData] = useState<TrackedOrder | null | undefined>(undefined);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const { data: d } = await supabase.rpc("get_order_by_token", { p_token: token });
    setData((d as TrackedOrder) ?? null);
  }, [token]);

  useEffect(() => {
    void load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const savedRating = data?.review?.rating;
  const savedComment = data?.review?.comment;
  useEffect(() => {
    if (savedRating) {
      setRating(savedRating);
      setComment(savedComment ?? "");
    }
  }, [savedRating, savedComment]);

  useEffect(() => {
    if (window.location.hash === "#avaliar" && data) {
      document.getElementById("avaliar")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [data]);

  if (data === undefined) return <Spinner />;
  if (data === null) return <Empty>Pedido não encontrado. Confere o link ou chama no WhatsApp.</Empty>;

  const { order, items, events, settings, review } = data;
  const delivered = order.status === "entregue";

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(settings.pix_key);
      toast("Chave Pix copiada!");
    } catch {
      toast("Não consegui copiar. Segura a chave pra copiar manualmente.", "err");
    }
  };

  const sendReview = async () => {
    if (!rating) return toast("Escolha de 1 a 5 estrelas.", "err");
    setSending(true);
    const { error } = await supabase.rpc("submit_review", { p_token: token, p_rating: rating, p_comment: comment });
    setSending(false);
    if (error) return toast(friendlyError(error), "err");
    toast("Obrigada pela avaliação!");
    void load();
  };

  const waMsg = `Oi Yasmim! Sobre meu pedido ${order.code}...`;
  const waPedido = pedidoClienteMsg({
    code: order.code,
    name: order.customer_name,
    items: items.map((i) => ({ name: i.product_name, qty: i.qty })),
    fulfillment: order.fulfillment,
    zoneName: order.zone_name,
    address: order.address,
    reference: order.reference,
    scheduledDate: order.scheduled_date,
    paymentLabel: PAYMENT_LABEL[order.payment_method],
    changeFor: order.change_for,
    total: Number(order.total),
    notes: order.notes,
    token: order.tracking_token,
  });

  return (
    <div className="space-y-5">
      {novo && (
        <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
          <PartyPopper className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-bold">Pedido recebido!</div>
            <div className="text-sm">Agora é só mandar o resumo pra Yasmim no WhatsApp. Se a aba não abriu sozinha, usa o botão abaixo.</div>
            <a href={waLink(settings.whatsapp, waPedido)} target="_blank" rel="noreferrer" className="mt-3 block"><Button variant="wa" size="lg" className="w-full"><MessageCircle size={18} /> Enviar pedido no WhatsApp</Button></a>
          </div>
        </div>
      )}

      <header className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-choco-500">Pedido</div>
          <h1 className="text-2xl font-black text-choco-900">{order.code}</h1>
        </div>
        <Badge className={STATUS_COLOR[order.status]}>{statusLabelFor(order.status, order.fulfillment)}</Badge>
      </header>

      <section className="rounded-2xl border border-choco-100 bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Acompanhamento</h2>
          <button onClick={load} className="flex items-center gap-1 text-xs text-choco-500 hover:text-choco-800"><RefreshCw size={12} /> atualizar</button>
        </div>
        <StatusTimeline status={order.status} fulfillment={order.fulfillment} events={events} />
      </section>

      {order.payment_method === "pix" && order.payment_status !== "pago" && order.status !== "cancelado" && settings.pix_key && (
        <section className="rounded-2xl border border-vinho-200 bg-vinho-50 p-4">
          <h2 className="font-bold text-vinho-800">Pagamento via Pix</h2>
          <p className="text-sm text-vinho-900">Valor: <b>{brl(order.total)}</b> · Nome: {settings.pix_name}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-xl bg-white px-3 py-2 text-sm">{settings.pix_key}</code>
            <Button variant="outline" size="sm" onClick={copyPix}><Copy size={14} /> Copiar</Button>
          </div>
          <p className="mt-2 text-xs text-vinho-800">Depois de pagar, manda o comprovante no WhatsApp que a Yasmim confirma.</p>
        </section>
      )}

      <section className="rounded-2xl border border-choco-100 bg-white p-4 shadow-card">
        <h2 className="mb-2 font-bold">Detalhes</h2>
        <ul className="divide-y divide-choco-100 text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between py-1.5"><span>{i.qty}x {i.product_name}</span><span>{brl(i.line_total)}</span></li>
          ))}
          {Number(order.delivery_fee) > 0 && <li className="flex justify-between py-1.5 text-choco-600"><span>Entrega</span><span>{brl(order.delivery_fee)}</span></li>}
          <li className="flex justify-between py-1.5 font-black"><span>Total</span><span className="text-vinho-700">{brl(order.total)}</span></li>
        </ul>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-choco-500">Data</dt><dd className="capitalize">{dayLong(order.scheduled_date)}</dd>
          <dt className="text-choco-500">{order.fulfillment === "entrega" ? "Entrega" : "Retirada"}</dt>
          <dd>{order.fulfillment === "entrega" ? `${order.zone_name ?? ""} · ${order.address}` : settings.pickup_address || "Combinar pelo WhatsApp"}</dd>
          <dt className="text-choco-500">Pagamento</dt><dd>{PAYMENT_LABEL[order.payment_method]} · {order.payment_status === "pago" ? "pago" : "pendente"}</dd>
          {order.notes && (<><dt className="text-choco-500">Obs.</dt><dd>{order.notes}</dd></>)}
        </dl>
      </section>

      {(delivered || review) && (
        <section id="avaliar" className="rounded-2xl border border-caramelo-400/40 bg-white p-4 shadow-card">
          <h2 className="font-bold">{review ? "Sua avaliação" : "Gostou? Conta pra gente!"}</h2>
          <p className="mb-3 text-sm text-choco-600">Sua opinião ajuda a Yasmim a melhorar sempre.</p>
          <Stars value={rating} onChange={setRating} size={34} />
          <Textarea className="mt-3" placeholder="Deixe um comentário (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button className="mt-3" loading={sending} onClick={sendReview}>{review ? "Atualizar avaliação" : "Enviar avaliação"}</Button>
          {review?.reply && <p className="mt-3 rounded-xl bg-rosa-100 p-3 text-sm text-vinho-900"><b>Resposta da Yasmim:</b> {review.reply}</p>}
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <a href={waLink(settings.whatsapp, novo ? waMsg : waPedido)} target="_blank" rel="noreferrer" className="flex-1"><Button variant="wa" className="w-full"><MessageCircle size={18} /> {novo ? "Falar com a Yasmim" : "Reenviar pedido no WhatsApp"}</Button></a>
        <Link to="/" className="flex-1"><Button variant="outline" className="w-full">Fazer outro pedido</Button></Link>
      </div>
    </div>
  );
}
