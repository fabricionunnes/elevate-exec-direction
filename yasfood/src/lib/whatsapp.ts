import { waNumber, brl, dayLong, STATUS_LABEL } from "./format";
import type { Order, OrderItem } from "./types";

/** Link wa.me com mensagem pronta. */
export function waLink(phone: string, text: string) {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
}

export function trackingUrl(token: string, siteUrl?: string) {
  const base = (siteUrl && siteUrl.trim()) || window.location.origin;
  return `${base.replace(/\/$/, "")}/pedido/${token}`;
}

const first = (name: string) => name.trim().split(" ")[0];

/** Mensagens que a Yasmim manda pro cliente a partir do painel. */
export const msgs = {
  confirmacao: (o: Order, items: OrderItem[], siteUrl?: string) =>
    `Oi ${first(o.customer_name)}! Aqui é a Yasmim, da Yas Delícias.\n\nSeu pedido ${o.code} está confirmado:\n${items.map((i) => `• ${i.qty}x ${i.product_name}`).join("\n")}\n\n${o.fulfillment === "entrega" ? "Entrega" : "Retirada"}: ${dayLong(o.scheduled_date)}\nTotal: ${brl(o.total)}\n\nAcompanhe por aqui: ${trackingUrl(o.tracking_token, siteUrl)}`,

  pix: (o: Order, pixKey: string, pixName: string) =>
    `Oi ${first(o.customer_name)}! Segue o Pix do pedido ${o.code}:\n\nChave: ${pixKey}\nNome: ${pixName}\nValor: ${brl(o.total)}\n\nMe manda o comprovante por aqui que eu confirmo.`,

  saiu: (o: Order, siteUrl?: string) =>
    `Oi ${first(o.customer_name)}! Seu bolo (${o.code}) saiu para entrega. Fica de olho no interfone!\n\nRastreio: ${trackingUrl(o.tracking_token, siteUrl)}`,

  pronto: (o: Order) =>
    `Oi ${first(o.customer_name)}! Seu bolo (${o.code}) está pronto pra retirada. Me chama quando vier buscar.`,

  status: (o: Order, siteUrl?: string) =>
    `Oi ${first(o.customer_name)}! Atualização do pedido ${o.code}: ${STATUS_LABEL[o.status]}.\n\nAcompanhe: ${trackingUrl(o.tracking_token, siteUrl)}`,

  avaliacao: (o: Order, template: string, siteUrl?: string) =>
    template
      .replace("{nome}", first(o.customer_name))
      .replace("{link}", `${trackingUrl(o.tracking_token, siteUrl)}#avaliar`)
      .replace("{codigo}", o.code),

  lead: (name: string, cardapioUrl: string) =>
    `Oi ${first(name)}! Aqui é a Yasmim, da Yas Delícias. Faço bolo de cenoura caseiro com cobertura de chocolate (570g por R$ 35), assado no dia e entregue na sua casa, aqui no Alphaville. Dá uma olhada no cardápio e escolhe o dia: ${cardapioUrl}`,

  reativacao: (name: string, cardapioUrl: string) =>
    `Oi ${first(name)}! Saudade de você por aqui. Essa semana tem bolo de cenoura fresquinho saindo. Quer garantir o seu? ${cardapioUrl}`,
};
