import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Target, 
  TrendingUp, 
  Users, 
  Brain, 
  CheckCircle2, 
  ArrowRight,
  Calendar,
  BarChart3,
  Sparkles
} from "lucide-react";

const PortalLandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-slate-950/80 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Portal do Planejamento</h1>
              <p className="text-xs text-slate-400">Mansão Empreendedora 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/portal/login">
              <Button variant="ghost" className="text-slate-300 hover:text-white">
                Entrar
              </Button>
            </Link>
            <Link to="/portal/signup">
              <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                Criar Conta
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full mb-8">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-400 font-medium">Planejamento Estratégico Guiado por IA</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Transforme sua empresa em{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
                2026
              </span>
            </h1>
            
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Construa seu planejamento estratégico com metodologia de empresas do Vale do Silício, 
              acompanhado por uma IA Coach que orienta cada passo do caminho.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/portal/signup">
                <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-lg px-8 py-6">
                  Começar Planejamento
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/portal/login">
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 text-lg px-8 py-6">
                  Já tenho conta
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Tudo que você precisa para executar 2026
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Do diagnóstico à execução, com acompanhamento contínuo e recomendações inteligentes.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-slate-900/50 border-slate-800 hover:border-amber-500/50 transition-colors">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
                  <Target className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">OKRs Estruturados</h3>
                <p className="text-slate-400">
                  Defina objetivos claros e resultados-chave mensuráveis com metodologia comprovada.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800 hover:border-amber-500/50 transition-colors">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
                  <Brain className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">IA Coach</h3>
                <p className="text-slate-400">
                  Orientação inteligente em cada etapa. Perguntas, exemplos e próximos passos personalizados.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800 hover:border-amber-500/50 transition-colors">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Rocks Trimestrais</h3>
                <p className="text-slate-400">
                  Quebre o ano em sprints de 90 dias com prioridades claras e metas alcançáveis.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800 hover:border-amber-500/50 transition-colors">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Dashboard em Tempo Real</h3>
                <p className="text-slate-400">
                  Visualize meta x realizado, alertas automáticos e progresso de cada objetivo.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800 hover:border-amber-500/50 transition-colors">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Multi-Equipe</h3>
                <p className="text-slate-400">
                  Convide seu time, defina owners e acompanhe a execução de cada membro.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800 hover:border-amber-500/50 transition-colors">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Recomendações UNV</h3>
                <p className="text-slate-400">
                  Quando estiver fora do trilho, receba sugestões de soluções para destravar seus resultados.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-t border-white/5 bg-slate-900/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Como funciona
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Um processo estruturado em 7 etapas para criar e executar seu planejamento.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-4">
              {[
                { step: "A", title: "Contexto e Diagnóstico", desc: "Fotografia atual do negócio" },
                { step: "B", title: "Direção", desc: "Visão anual e North Star Metric" },
                { step: "C", title: "OKRs", desc: "3 a 5 objetivos com key results" },
                { step: "D", title: "Estratégia e Iniciativas", desc: "Ações para cada resultado-chave" },
                { step: "E", title: "Rocks Trimestrais", desc: "Prioridades Q1, Q2, Q3, Q4" },
                { step: "F", title: "Plano de Execução", desc: "Cadência e mitigação de riscos" },
                { step: "G", title: "Publicação", desc: "Versão oficial do plano" },
              ].map((item, index) => (
                <div key={item.step} className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
                  <div className="w-10 h-10 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-lg">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">{item.title}</h3>
                    <p className="text-slate-400 text-sm">{item.desc}</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-slate-600" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Pronto para planejar 2026?
            </h2>
            <p className="text-slate-300 text-lg mb-8">
              Comece agora e tenha seu planejamento estratégico estruturado em poucas horas.
            </p>
            <Link to="/portal/signup">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-lg px-10 py-6">
                Criar Minha Conta
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-slate-950" />
              </div>
              <span className="text-slate-400 text-sm">Portal do Planejamento 2026 — UNV Holdings</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link to="/terms" className="hover:text-slate-300">Termos de Uso</Link>
              <Link to="/privacy" className="hover:text-slate-300">Política de Privacidade</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PortalLandingPage;
