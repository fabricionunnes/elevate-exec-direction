import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle,
  Brain,
  Heart,
  Eye,
  Shield,
  Calendar,
  XCircle,
  Sparkles,
  Lock,
  Users,
  Target,
  Zap
} from "lucide-react";
import logoLeDesir from "@/assets/logo-le-desir.png";

const pressures = [
  "A pressão por decisões constantes.",
  "A solidão do comando.",
  "A dificuldade de desligar.",
  "O acúmulo silencioso de tensão.",
  "A repetição de padrões que sabotam relações, negócios e visão de longo prazo."
];

const notIs = [
  "terapia tradicional",
  "mentoria de negócios",
  "coaching motivacional",
  "conversa casual"
];

const isFor = [
  "organizar pensamentos complexos",
  "entender padrões que se repetem",
  "reduzir decisões reativas",
  "recuperar presença e lucidez",
  "sustentar crescimento sem colapsar internamente"
];

const problemsWithout = [
  "decide no impulso",
  "centraliza demais",
  "perde clareza estratégica",
  "mistura identidade pessoal com o negócio",
  "reage mais do que conduz"
];

const whereActuates = [
  "no lugar onde as decisões nascem",
  "na origem das escolhas",
  "no que sustenta ou destrói o longo prazo"
];

const realEffects = [
  "decisões mais calmas e assertivas",
  "redução de ansiedade constante",
  "maior capacidade de delegar",
  "menos necessidade de controle excessivo",
  "melhoria nas relações profissionais e pessoais",
  "maior clareza de propósito e direção",
  "sustentação emocional para fases de crescimento"
];

const targetAudience = [
  "Empresários",
  "Fundadores",
  "Sócios",
  "Executivos C-level",
  "Líderes que tomam decisões todos os dias"
];

const especiallyFor = [
  "sente que \"segura tudo sozinho\"",
  "já venceu no financeiro, mas sente desgaste interno",
  "percebe padrões que se repetem",
  "quer crescer sem se perder no processo"
];

const notFor = [
  "busca respostas rápidas",
  "quer fórmula, técnica ou método",
  "não tolera silêncio",
  "quer ser convencido",
  "não está disposto a olhar para si"
];

const format = [
  "Encontros individuais",
  "Online ou presencial (a depender da agenda)",
  "Frequência semanal ou quinzenal",
  "Processo contínuo (sem prazo fechado)",
  "Total confidencialidade"
];

const complements = [
  { name: "UNV Sales Acceleration", aspect: "decisão" },
  { name: "UNV Partners", aspect: "visão" },
  { name: "UNV Mastermind", aspect: "relação" },
  { name: "UNV Leadership", aspect: "presença" }
];

export default function LeDesirPage() {
  const leDesirColors = {
    primary: "hsl(355, 45%, 35%)",
    primaryLight: "hsl(355, 40%, 45%)",
    primaryDark: "hsl(355, 50%, 25%)",
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${leDesirColors.primaryDark} 0%, ${leDesirColors.primary} 50%, ${leDesirColors.primaryLight} 100%)` }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
        <div className="container-premium relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-up">
            <div className="inline-block mb-6 p-4 bg-white/95 rounded-2xl shadow-lg">
              <img src={logoLeDesir} alt="Le Désir" className="h-32 md:h-40 w-auto object-contain" />
            </div>
            <p className="text-2xl md:text-3xl text-white font-medium mb-4 leading-relaxed">
              Um espaço de elaboração estratégica para empresários que carregam muito mais do que números.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
              <Button size="lg" className="bg-white hover:bg-white/90 text-[hsl(355,45%,35%)]" asChild>
                <Link to="/diagnostico">
                  Iniciar Processo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" className="border-white/50 text-white hover:bg-white/10 bg-transparent border" asChild>
                <Link to="/compare">
                  Comparar Produtos
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Preço Invisível */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 50%, 25%)" }}>
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-white text-center mb-8">
              Para quem construiu muito, mas sente que está pagando um preço invisível
            </h2>
            <div className="bg-white/10 border border-white/20 rounded-2xl p-8 md:p-12 backdrop-blur-sm">
              <p className="text-lg text-white/90 mb-6 text-center">
                Empresários não quebram apenas por erros de gestão.
              </p>
              <p className="text-xl text-white font-semibold mb-8 text-center">
                Eles quebram por excesso de carga interna.
              </p>
              <div className="space-y-3 mb-8">
                {pressures.map((pressure, index) => (
                  <p key={index} className="text-white/80 text-center">{pressure}</p>
                ))}
              </div>
              <div className="border-t border-white/20 pt-8">
                <p className="text-white/70 text-center mb-4">
                  O problema é que isso não aparece em relatórios,
                </p>
                <p className="text-white font-medium text-center">
                  mas aparece nas decisões, no corpo, no foco e no futuro.
                </p>
              </div>
              <div className="mt-8 p-6 bg-white/10 border border-white/20 rounded-xl">
                <p className="text-white text-center font-medium">
                  O Le Désir nasce para cuidar exatamente disso.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* O que é e o que não é */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 45%, 35%)" }}>
        <div className="container-premium">
          <h2 className="heading-section text-white text-center mb-12">
            O que é o Le Désir (e o que ele não é)
          </h2>
          <div className="max-w-4xl mx-auto">
            <p className="text-lg text-white/90 text-center mb-10">
              O Le Désir é um <span className="text-white font-semibold">espaço privado de elaboração profunda, consciência e clareza</span>, voltado exclusivamente para empresários e executivos.
            </p>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-sm">
                <h3 className="text-xl font-semibold text-white mb-6">Ele não é:</h3>
                <ul className="space-y-3">
                  {notIs.map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <XCircle className="h-5 w-5 text-white/60 shrink-0" />
                      <span className="text-white/80">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-white/15 border border-white/25 rounded-2xl p-8 backdrop-blur-sm">
                <h3 className="text-xl font-semibold text-white mb-6">Ele é um processo onde você pode:</h3>
                <ul className="space-y-3">
                  {isFor.map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-white shrink-0" />
                      <span className="text-white/90">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* O verdadeiro problema */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 50%, 25%)" }}>
        <div className="container-premium">
          <h2 className="heading-section text-white text-center mb-12">
            O verdadeiro problema que resolvemos
          </h2>
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-white mb-6">Quando o empresário não tem onde elaborar, ele:</h3>
                <ul className="space-y-3">
                  {problemsWithout.map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <XCircle className="h-5 w-5 text-white/60 shrink-0" />
                      <span className="text-white/80">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-white/15 border border-white/25 rounded-2xl p-8 backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-white mb-6">O Le Désir atua onde nenhum KPI alcança:</h3>
                <ul className="space-y-4">
                  {whereActuates.map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <Target className="h-5 w-5 text-white shrink-0" />
                      <span className="text-white/90">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 45%, 35%)" }}>
        <div className="container-premium">
          <h2 className="heading-section text-white text-center mb-8">
            Como funciona o Le Désir
          </h2>
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-white/90 text-center mb-10">
              O processo acontece através de encontros individuais, em um ambiente absolutamente confidencial, sem roteiro engessado, sem agenda de performance, sem pressão por resposta rápida.
            </p>
            
            <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-6 text-center">Aqui:</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { icon: Sparkles, text: "o silêncio é parte do processo" },
                  { icon: Heart, text: "a fala é livre" },
                  { icon: Shield, text: "não há certo ou errado" },
                  { icon: Eye, text: "não há julgamento" },
                  { icon: Brain, text: "não há promessa milagrosa" }
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-4 bg-white/10 border border-white/20 rounded-lg">
                    <item.icon className="h-5 w-5 text-white shrink-0" />
                    <span className="text-white/90">{item.text}</span>
                  </div>
                ))}
              </div>
              <p className="text-white text-center font-medium mt-8 text-lg">
                Existe apenas elaboração, que gera clareza.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Efeitos Reais */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 50%, 25%)" }}>
        <div className="container-premium">
          <h2 className="heading-section text-white text-center mb-8">
            O que muda na prática (efeitos reais)
          </h2>
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-white/90 text-center mb-8">
              Empresários que passam pelo Le Désir relatam:
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {realEffects.map((effect, index) => (
                <div key={index} className="flex items-center gap-3 p-4 bg-white/10 border border-white/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-white shrink-0" />
                  <span className="text-white/80">{effect}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 p-6 bg-white/10 border border-white/20 rounded-xl text-center">
              <p className="text-white/80 mb-2">Nada disso é imediato.</p>
              <p className="text-white font-medium">Tudo isso é profundo.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Para quem é */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 45%, 35%)" }}>
        <div className="container-premium">
          <h2 className="heading-section text-white text-center mb-12">
            Para quem o Le Désir é indicado
          </h2>
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6">
                  <Users className="h-6 w-6 text-white" />
                  <h3 className="text-xl font-semibold text-white">Perfil</h3>
                </div>
                <ul className="space-y-3">
                  {targetAudience.map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-white shrink-0" />
                      <span className="text-white/90">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-white/15 border border-white/25 rounded-2xl p-8 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6">
                  <Heart className="h-6 w-6 text-white" />
                  <h3 className="text-xl font-semibold text-white">Especialmente para quem:</h3>
                </div>
                <ul className="space-y-3">
                  {especiallyFor.map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-white shrink-0" />
                      <span className="text-white/90">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Para quem NÃO é */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 50%, 25%)" }}>
        <div className="container-premium">
          <h2 className="heading-section text-white text-center mb-8">
            Para quem NÃO é
          </h2>
          <div className="max-w-2xl mx-auto">
            <p className="text-lg text-white/90 text-center mb-8">
              O Le Désir não é indicado para quem:
            </p>
            <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-sm">
              <ul className="space-y-4">
                {notFor.map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-white/60 shrink-0" />
                    <span className="text-white/80">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Formato */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 45%, 35%)" }}>
        <div className="container-premium">
          <h2 className="heading-section text-white text-center mb-8">
            O formato
          </h2>
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-sm">
              <ul className="space-y-4">
                {format.map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-white shrink-0" />
                    <span className="text-white/90">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Valor */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 50%, 25%)" }}>
        <div className="container-premium">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="heading-section text-white mb-8">
              O valor
            </h2>
            <div className="bg-white/95 rounded-2xl p-10 shadow-lg">
              <p className="text-5xl font-bold text-[hsl(355,45%,35%)] mb-2">R$ 2.000</p>
              <p className="text-[hsl(355,45%,35%)]/70 mb-6">por mês</p>
              <div className="border-t border-[hsl(355,45%,35%)]/20 pt-6">
                <p className="text-[hsl(355,45%,35%)]/80 mb-2">O investimento não é no encontro.</p>
                <p className="text-[hsl(355,45%,35%)] font-medium">É na capacidade de sustentar decisões melhores ao longo do tempo.</p>
              </div>
              <Button size="lg" className="w-full mt-8 bg-[hsl(355,45%,35%)] hover:bg-[hsl(355,50%,25%)] text-white" asChild>
                <Link to="/diagnostico">
                  Iniciar Processo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Papel dentro da UNV */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 45%, 35%)" }}>
        <div className="container-premium">
          <h2 className="heading-section text-white text-center mb-8">
            O papel do Le Désir dentro da UNV
          </h2>
          <div className="max-w-3xl mx-auto">
            <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-sm mb-8">
              <h3 className="text-lg font-semibold text-white mb-6 text-center">O Le Désir existe porque:</h3>
              <div className="space-y-3 text-center">
                <p className="text-white/90">empresas crescem mais rápido que as pessoas</p>
                <p className="text-white/90">números não resolvem conflitos internos</p>
                <p className="text-white/90">performance sem sustentação cobra seu preço</p>
              </div>
            </div>
            
            <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-6 text-center">Ele complementa:</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {complements.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-white/10 border border-white/20 rounded-lg">
                    <span className="text-white font-medium">{item.name}</span>
                    <span className="text-white/70 text-sm">({item.aspect})</span>
                  </div>
                ))}
              </div>
              <p className="text-white text-center font-medium mt-8">
                Cuidando do que normalmente ninguém cuida.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Final */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 50%, 25%)" }}>
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <div className="bg-white/10 border border-white/20 rounded-2xl p-10 md:p-16 backdrop-blur-sm">
              <p className="text-2xl md:text-3xl text-white font-light italic leading-relaxed mb-4">
                "Não é sobre resolver o negócio.
              </p>
              <p className="text-2xl md:text-3xl text-white font-semibold leading-relaxed">
                É sobre sustentar quem resolve."
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10">
              <Button size="lg" className="bg-white hover:bg-white/90 text-[hsl(355,45%,35%)]" asChild>
                <Link to="/diagnostico">
                  Iniciar Processo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" className="border-white/50 text-white hover:bg-white/10 bg-transparent border" asChild>
                <Link to="/compare">
                  Comparar Produtos
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
