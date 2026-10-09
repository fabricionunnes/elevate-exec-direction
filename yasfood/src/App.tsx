import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "@/lib/cart";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui";
import ClienteLayout from "@/pages/cliente/Layout";
import Cardapio from "@/pages/cliente/Cardapio";
import Checkout from "@/pages/cliente/Checkout";
import Pedido from "@/pages/cliente/Pedido";
import MeusPedidos from "@/pages/cliente/MeusPedidos";
import AdminLayout from "@/pages/admin/Layout";
import Login from "@/pages/admin/Login";
import Recuperar from "@/pages/admin/Recuperar";
import Dashboard from "@/pages/admin/Dashboard";
import Pedidos from "@/pages/admin/Pedidos";
import Agenda from "@/pages/admin/Agenda";
import CardapioAdmin from "@/pages/admin/CardapioAdmin";
import Banners from "@/pages/admin/Banners";
import Enquetes from "@/pages/admin/Enquetes";
import Entregas from "@/pages/admin/Entregas";
import Clientes from "@/pages/admin/Clientes";
import Estoque from "@/pages/admin/Estoque";
import Financeiro from "@/pages/admin/Financeiro";
import Avaliacoes from "@/pages/admin/Avaliacoes";
import Configuracoes from "@/pages/admin/Configuracoes";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route element={<ClienteLayout />}>
                <Route path="/" element={<Cardapio />} />
                <Route path="/carrinho" element={<Checkout />} />
                <Route path="/pedido/:token" element={<Pedido />} />
                <Route path="/meus-pedidos" element={<MeusPedidos />} />
              </Route>
              <Route path="/admin/login" element={<Login />} />
              <Route path="/admin/recuperar" element={<Recuperar />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="pedidos" element={<Pedidos />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="cardapio" element={<CardapioAdmin />} />
                <Route path="banners" element={<Banners />} />
                <Route path="enquetes" element={<Enquetes />} />
                <Route path="entregas" element={<Entregas />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="estoque" element={<Estoque />} />
                <Route path="financeiro" element={<Financeiro />} />
                <Route path="avaliacoes" element={<Avaliacoes />} />
                <Route path="configuracoes" element={<Configuracoes />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
