import { Link, NavLink, Outlet } from "react-router-dom";
import { ShoppingBag, ClipboardList, Instagram } from "lucide-react";
import { clsx } from "clsx";
import { useCart } from "@/lib/cart";
import { useSettings } from "@/lib/useSettings";
import { waLink } from "@/lib/whatsapp";

export function Logo({ size = 44, url }: { size?: number; url?: string }) {
  const src = url && url.trim() ? url : "/logo.webp";
  return (
    <img
      src={src}
      alt="Yas Delícias"
      width={size}
      height={size}
      className="rounded-full object-cover"
      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/favicon.svg"; }}
    />
  );
}

export default function ClienteLayout() {
  const { count } = useCart();
  const { settings } = useSettings();
  return (
    <div className="min-h-screen bg-creme">
      <header className="sticky top-0 z-30 border-b border-rosa-200 bg-creme/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2">
          <Link to="/" className="flex items-center gap-2">
            <Logo url={settings?.logo_url} />
            <div className="leading-tight">
              <div className="text-lg font-black text-vinho-700">{settings?.business_name ?? "Yas Delícias"}</div>
              <div className="text-[11px] font-medium text-choco-500">E as delícias? São da Yas!</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/meus-pedidos" className={({ isActive }) => clsx("rounded-full p-2 text-choco-700 hover:bg-rosa-100", isActive && "bg-rosa-100")} aria-label="Meus pedidos">
              <ClipboardList size={22} />
            </NavLink>
            <NavLink to="/carrinho" className={({ isActive }) => clsx("relative rounded-full p-2 text-choco-700 hover:bg-rosa-100", isActive && "bg-rosa-100")} aria-label="Carrinho">
              <ShoppingBag size={22} />
              {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-vinho-600 px-1 text-[11px] font-bold text-white">{count}</span>}
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-choco-500">
        <div className="flex items-center justify-center gap-3">
          {settings?.whatsapp && <a className="underline" href={waLink(settings.whatsapp, "Oi Yasmim! Vi o cardápio da Yas Delícias e quero fazer um pedido.")} target="_blank" rel="noreferrer">WhatsApp</a>}
          {settings?.instagram && <a className="inline-flex items-center gap-1 underline" href={`https://instagram.com/${settings.instagram.replace("@", "")}`} target="_blank" rel="noreferrer"><Instagram size={12} />{settings.instagram}</a>}
          <Link to="/admin" className="text-choco-300 hover:text-choco-500">Painel</Link>
        </div>
        <div className="mt-2 text-[10px] text-choco-300">feito com <b><span className="text-vinho-400">Yas</span><span className="text-choco-400">Food</span></b></div>
      </footer>
    </div>
  );
}
