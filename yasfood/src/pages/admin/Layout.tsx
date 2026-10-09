import { NavLink, Navigate, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, ClipboardList, CalendarDays, CakeSlice, Truck, Users, Boxes, Wallet, Star, Settings as SettingsIcon, LogOut, ExternalLink, Menu, Image, BarChart3 } from "lucide-react";
import { clsx } from "clsx";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/useSettings";
import { Spinner } from "@/components/ui";
import { YasFoodMark, YasFoodWord } from "@/components/Brand";
import { Logo } from "@/pages/cliente/Layout";

const NAV = [
  { to: "/admin", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/admin/cardapio", label: "Cardápio", icon: CakeSlice },
  { to: "/admin/banners", label: "Banners", icon: Image },
  { to: "/admin/enquetes", label: "Enquetes", icon: BarChart3 },
  { to: "/admin/entregas", label: "Entregas", icon: Truck },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/estoque", label: "Estoque", icon: Boxes },
  { to: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/admin/avaliacoes", label: "Avaliações", icon: Star },
  { to: "/admin/configuracoes", label: "Configurações", icon: SettingsIcon },
];

export default function AdminLayout() {
  const { session, isAdmin, loading, signOut } = useAuth();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);

  if (loading) return <Spinner />;
  if (!session || !isAdmin) return <Navigate to="/admin/login" replace />;

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) => clsx("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition", isActive ? "bg-vinho-600 text-white" : "text-choco-700 hover:bg-rosa-100")}
        >
          <n.icon size={18} /> {n.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-creme lg:flex">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-rosa-200 bg-white p-4 lg:flex">
        <Link to="/admin" className="mb-6 flex items-center gap-2">
          <Logo size={48} url={settings?.logo_url} />
          <div className="leading-tight"><div className="font-black text-vinho-700">{settings?.business_name ?? "Yas Delícias"}</div><div className="text-[11px] text-choco-500">Painel da Yasmim</div></div>
        </Link>
        {nav}
        <div className="mt-auto space-y-1 pt-4">
          <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-choco-600 hover:bg-rosa-100"><ExternalLink size={16} /> Ver cardápio</a>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-choco-600 hover:bg-rosa-100"><LogOut size={16} /> Sair</button>
          <div className="flex items-center gap-1 px-3 pt-2 text-[10px] text-choco-300"><YasFoodMark size={14} className="!rounded" /> feito com <YasFoodWord size="text-[11px]" /></div>
        </div>
      </aside>

      {/* Topbar mobile */}
      <div className="flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-rosa-200 bg-white/90 px-4 py-2 backdrop-blur lg:hidden">
          <Link to="/admin" className="flex items-center gap-2"><Logo size={36} url={settings?.logo_url} /><span className="font-black text-vinho-700">{settings?.business_name ?? "Yas Delícias"}</span></Link>
          <button onClick={() => setOpen((o) => !o)} className="rounded-xl p-2 text-choco-700 hover:bg-rosa-100" aria-label="Menu"><Menu /></button>
        </header>
        {open && (
          <div className="fixed inset-0 z-40 bg-choco-900/40 lg:hidden" onClick={() => setOpen(false)}>
            <div className="h-full w-64 bg-white p-4" onClick={(e) => e.stopPropagation()}>
              {nav}
              <div className="mt-4 space-y-1 border-t border-choco-100 pt-4">
                <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-choco-600"><ExternalLink size={16} /> Ver cardápio</a>
                <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-choco-600"><LogOut size={16} /> Sair</button>
              </div>
            </div>
          </div>
        )}
        <main className="mx-auto max-w-6xl p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
