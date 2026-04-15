import { ServiceData } from "@/pages/ServiceSalesPage";
import { ArrowDown, Zap } from "lucide-react";

const serviceIcons: Record<string, string> = {
  prospeccao_b2b: "🎯",
  pontuacao: "💎",
  testes: "📋",
  rh: "👥",
  board: "🏛️",
  trafego_pago: "📈",
  funil_vendas: "🔄",
  diretor_comercial_ia: "🤖",
  gestao_clientes: "📊",
  unv_academy: "🎓",
  instagram: "📱",
  contrato_rotina: "📄",
  unv_disparador: "💬",
  unv_social: "🌐",
  unv_sales_force: "⚡",
};

interface Props {
  service: ServiceData;
  formatPrice: (price: number) => string;
}

export function ServiceSalesHero({ service, formatPrice }: Props) {
  const icon = serviceIcons[service.menu_key] || "✨";

  return (
    <section className="relative pt-24 pb-20 px-4 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(214,65%,12%)] via-[hsl(214,65%,15%)] to-[hsl(214,65%,18%)]" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[hsl(355,85%,50%)]/5 blur-[120px]" />

      <div className="relative max-w-4xl mx-auto text-center">
        <div className="text-6xl mb-6">{icon}</div>
        
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(355,85%,50%)]/10 border border-[hsl(355,85%,50%)]/20 text-[hsl(355,85%,50%)] text-sm font-medium mb-6">
          <Zap className="h-3.5 w-3.5" />
          {service.billing_type === "monthly" ? "Assinatura Mensal" : "Pagamento Único"}
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          {service.name}
        </h1>

        {service.description && (
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            {service.description}
          </p>
        )}

        <div className="flex flex-col items-center gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl md:text-6xl font-bold text-white">
              {formatPrice(service.price)}
            </span>
            {service.billing_type === "monthly" && (
              <span className="text-xl text-white/50">/mês</span>
            )}
          </div>
          
          <button
            onClick={() => document.getElementById("comprar")?.scrollIntoView({ behavior: "smooth" })}
            className="mt-4 inline-flex items-center gap-2 bg-[hsl(355,85%,50%)] hover:bg-[hsl(355,85%,45%)] text-white px-8 py-4 rounded-xl text-lg font-bold transition-all hover:scale-105 shadow-lg shadow-[hsl(355,85%,50%)]/25"
          >
            Contratar Agora
            <ArrowDown className="h-5 w-5 animate-bounce" />
          </button>
        </div>
      </div>
    </section>
  );
}
