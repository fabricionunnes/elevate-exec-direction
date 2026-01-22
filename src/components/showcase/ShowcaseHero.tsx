import { Sparkles } from "lucide-react";

const ShowcaseHero = () => {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
      <div className="container mx-auto px-4 relative">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full mb-8">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-400 font-medium">Sistema Completo de Gestão</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Portal do Cliente{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
              UNV Nexus
            </span>
          </h1>
          
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Gestão comercial completa: KPIs, CRM, vendas, financeiro, RH, suporte e muito mais — 
            tudo em um único lugar, com inteligência artificial integrada.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ShowcaseHero;
