import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ServiceAdvisorChat } from "@/components/ServiceAdvisorChat";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { ImpactStats } from "@/components/marketing/ImpactStats";

interface LayoutProps {
  children: ReactNode;
}

/** Páginas internas/legais que não recebem a faixa de prova social. */
const HIDE_IMPACT_STATS = [
  "/admin",
  "/admin-setup",
  "/diagnostic-responses",
  "/mastermind/applications",
  "/privacidade",
  "/privacy",
  "/terms",
  "/start/checkout",
];

export function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation();
  const showImpactStats = !HIDE_IMPACT_STATS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-16 md:pt-20">{children}</main>
      {showImpactStats && <ImpactStats />}
      <Footer />
      <ServiceAdvisorChat />
      <PWAInstallPrompt />
    </div>
  );
}
