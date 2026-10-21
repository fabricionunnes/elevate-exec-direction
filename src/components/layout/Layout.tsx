import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ServiceAdvisorChat } from "@/components/ServiceAdvisorChat";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  // checkout e páginas do UNV Start: sem o chat flutuante por cima do formulário de compra
  const paginaDeVenda = typeof window !== "undefined" && window.location.hash.startsWith("#/start");
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-16 md:pt-20">{children}</main>
      <Footer />
      {!paginaDeVenda && <ServiceAdvisorChat />}
      <PWAInstallPrompt />
    </div>
  );
}
