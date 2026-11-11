import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product } from "./types";

export interface CartLine {
  product: Product;
  qty: number;
}

interface CartCtx {
  lines: CartLine[];
  add: (p: Product, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  /** troca os produtos do carrinho pelos atuais do cardápio (preço, mínimo) e tira o que saiu */
  sync: (products: Product[]) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const Ctx = createContext<CartCtx | null>(null);

export const minQty = (p: Pick<Product, "min_qty">) => Math.max(1, Number(p.min_qty ?? 1));
const KEY = "dy_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines]);

  const api = useMemo<CartCtx>(() => ({
    lines,
    add: (p, qty) =>
      setLines((ls) => {
        const i = ls.findIndex((l) => l.product.id === p.id);
        if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + (qty ?? 1) } : l));
        return [...ls, { product: p, qty: Math.max(qty ?? minQty(p), minQty(p)) }];
      }),
    // abaixo do mínimo sai do carrinho (pão: de 4 pra 3 remove)
    setQty: (id, qty) => setLines((ls) => ls.flatMap((l) => (l.product.id !== id ? [l] : qty < minQty(l.product) ? [] : [{ ...l, qty }]))),
    sync: (products) => setLines((ls) => {
      const byId = new Map(products.map((p) => [p.id, p]));
      const next = ls.flatMap((l) => { const p = byId.get(l.product.id); return p ? [{ product: p, qty: Math.max(l.qty, minQty(p)) }] : []; });
      return JSON.stringify(next) === JSON.stringify(ls) ? ls : next;
    }),
    remove: (id) => setLines((ls) => ls.filter((l) => l.product.id !== id)),
    clear: () => setLines([]),
    count: lines.reduce((a, l) => a + l.qty, 0),
    subtotal: lines.reduce((a, l) => a + l.qty * Number(l.product.price), 0),
  }), [lines]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart fora do CartProvider");
  return c;
}

/** Pedidos feitos neste aparelho (tokens de rastreio), pra "Meus pedidos". */
const MY_KEY = "dy_my_orders_v1";
export interface MyOrderRef { code: string; token: string; created_at: string }

export function rememberOrder(ref: MyOrderRef) {
  try {
    const list = getMyOrders().filter((r) => r.token !== ref.token);
    localStorage.setItem(MY_KEY, JSON.stringify([ref, ...list].slice(0, 50)));
  } catch { /* ignore */ }
}

export function getMyOrders(): MyOrderRef[] {
  try {
    const raw = localStorage.getItem(MY_KEY);
    return raw ? (JSON.parse(raw) as MyOrderRef[]) : [];
  } catch {
    return [];
  }
}

/** Dados do cliente pra pré-preencher o checkout. */
const ME_KEY = "dy_me_v1";
export interface Me { name: string; phone: string; zone_id: string; address: string; reference: string }
export function saveMe(me: Me) { try { localStorage.setItem(ME_KEY, JSON.stringify(me)); } catch { /* ignore */ } }
export function loadMe(): Me | null { try { const r = localStorage.getItem(ME_KEY); return r ? (JSON.parse(r) as Me) : null; } catch { return null; } }
