import { Building2, Users, TrendingUp } from "lucide-react";

const impactStats = [
  { value: "+700", label: "Empresas impactadas", icon: Building2 },
  { value: "+4.500", label: "Vendedores impactados", icon: Users },
  {
    value: "+R$ 400mi",
    label: "Em faturamento gerado para nossos clientes",
    icon: TrendingUp,
  },
];

/**
 * Faixa de prova social exibida na home e nas páginas de produto.
 * Renderizada pelo Layout — não incluir manualmente nas páginas.
 */
export function ImpactStats() {
  return (
    <section className="py-10 sm:py-14 bg-card border-y border-border/50 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow opacity-20 pointer-events-none" />
      <div className="container-premium relative">
        <p className="text-center text-xs sm:text-sm uppercase tracking-[0.2em] text-muted-foreground mb-6 sm:mb-8">
          O resultado da UNV em números
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
          {impactStats.map((stat, i) => (
            <div key={i} className="text-center group">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 border border-primary/30 mb-3 sm:mb-4 group-hover:bg-primary/20 transition-colors duration-300">
                <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <p className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-primary mb-1">
                {stat.value}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-[16rem] mx-auto">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
