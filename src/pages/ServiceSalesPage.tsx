import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { ServiceSalesHero } from "@/components/service-sales/ServiceSalesHero";
import { ServiceSalesBenefits } from "@/components/service-sales/ServiceSalesBenefits";
import { ServiceSalesHowItWorks } from "@/components/service-sales/ServiceSalesHowItWorks";
import { ServiceSalesFAQ } from "@/components/service-sales/ServiceSalesFAQ";
import { ServiceSalesPurchaseSection } from "@/components/service-sales/ServiceSalesPurchaseSection";
import { ServiceSalesFooter } from "@/components/service-sales/ServiceSalesFooter";
import logoUnv from "@/assets/logo-unv.png";
import { ServiceSalesNavMenu } from "@/components/service-sales/ServiceSalesNavMenu";

export interface ServiceData {
  id: string;
  menu_key: string;
  name: string;
  description: string | null;
  price: number;
  billing_type: "monthly" | "one_time";
  landing_page_config: any;
}

export default function ServiceSalesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [service, setService] = useState<ServiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("service_catalog")
        .select("id, menu_key, name, description, price, billing_type, landing_page_config")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setService(data as ServiceData);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(214,65%,15%)] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
      </div>
    );
  }

  if (notFound || !service) {
    return (
      <div className="min-h-screen bg-[hsl(214,65%,15%)] flex flex-col items-center justify-center text-white gap-4">
        <img src={logoUnv} alt="UNV" className="h-12 mb-4" />
        <h1 className="text-2xl font-bold">Serviço não encontrado</h1>
        <p className="text-white/60">O link que você acessou é inválido ou o serviço não está disponível.</p>
      </div>
    );
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  return (
    <div className="min-h-screen bg-[hsl(214,65%,15%)]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[hsl(214,65%,15%)]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logoUnv} alt="UNV" className="h-8" />
          <a
            href="#comprar"
            className="bg-[hsl(355,85%,50%)] hover:bg-[hsl(355,85%,45%)] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Contratar Agora
          </a>
        </div>
      </header>

      <ServiceSalesHero service={service} formatPrice={formatPrice} />
      <ServiceSalesBenefits service={service} />
      <ServiceSalesHowItWorks service={service} />
      <ServiceSalesPurchaseSection service={service} formatPrice={formatPrice} />
      <ServiceSalesFAQ service={service} />
      <ServiceSalesFooter />
    </div>
  );
}
