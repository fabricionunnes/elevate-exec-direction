import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import logoUnvBoard from "@/assets/logo-unv-board.png";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle,
  Compass,
  FileText,
  Map,
  MessageSquare,
  Repeat,
  Shield,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

const WHATSAPP_URL = `https://wa.me/5511927008490?text=${encodeURIComponent(
  "Quero saber mais sobre o UNV Board"
)}`;

// O problema com mentorias tradicionais
const problemas = [
  {
    icon: BookOpen,
    title: "Aula e anotação de caderno",
    description:
      "Mentorias tradicionais entregam conteúdo. Você sai com o caderno cheio e a operação exatamente igual.",
  },
  {
    icon: XCircle,
    title: "Ninguém cobra a execução",
    description:
      "Entre um encontro e outro, ninguém pergunta o que foi feito. O plano fica bonito no papel e para por aí.",
  },
  {
    icon: TrendingUp,
    title: "90% dos planos morrem na semana seguinte",
    description:
      "Sem cadência, sem métrica e sem cobrança, a rotina engole a estratégia. Toda semana.",
  },
];

// As 7 entregas
const entregas = [
  {
    icon: Map,
    title: "Jornada anual no sistema",
    description:
      "Plano de 12 meses pelo Método CRESCER, personalizado por IA para o seu segmento, com toda ação datada dentro do UNV Nexus.",
  },
  {
    icon: Calendar,
    title: "Encontros quinzenais ao vivo com Fabrício Nunnes",
    description:
      "Tema do mês + hot seat resolvendo casos reais de empresas do grupo. Direção aplicada, não palestra.",
  },
  {
    icon: UserCheck,
    title: "2 sessões individuais por mês",
    description:
      "Duas sessões de 1 hora por mês com consultor UNV para destravar a execução do seu plano.",
  },
  {
    icon: MessageSquare,
    title: "Diretor comercial no seu WhatsApp",
    description:
      "Cobrança diária das ações no grupo da sua empresa — o que venceu, o que atrasou, o que foi feito.",
  },
  {
    icon: FileText,
    title: "Biblioteca comercial oficial",
    description:
      "Playbook, processos, scripts, ICP e metas gerados em documentos oficiais UNV, com versão e histórico.",
  },
  {
    icon: BarChart3,
    title: "Placar e NPS",
    description:
      "Relatório de evolução por trimestre e pesquisa mensal. Você enxerga o retorno antes de renovar.",
  },
  {
    icon: Users,
    title: "Time inteiro dentro",
    description:
      "Seus vendedores têm login, meta e placar no sistema. O programa não fica só na cabeça do dono.",
  },
];

// As 7 fases do Método CRESCER
const fasesCrescer = [
  {
    letra: "C",
    nome: "Cenário",
    descricao: "Diagnóstico real da operação: funil, números, time e gargalos.",
    icon: Compass,
  },
  {
    letra: "R",
    nome: "Resultado Ideal",
    descricao: "Definição de metas claras de faturamento, conversão e ticket médio.",
    icon: Target,
  },
  {
    letra: "E",
    nome: "Estrutura",
    descricao: "Processo comercial, papéis do time e rotina de gestão definidos.",
    icon: Users,
  },
  {
    letra: "S",
    nome: "Sistema de Captação",
    descricao: "Geração previsível de oportunidades para alimentar o funil todo mês.",
    icon: Zap,
  },
  {
    letra: "C",
    nome: "Conversão",
    descricao: "Discurso, follow-up e fechamento afiados para vender mais com os mesmos leads.",
    icon: TrendingUp,
  },
  {
    letra: "E",
    nome: "Escala",
    descricao: "Crescimento com controle: mais volume sem perder margem nem qualidade.",
    icon: BarChart3,
  },
  {
    letra: "R",
    nome: "Revisão",
    descricao: "Análise do ciclo, correção de rota e preparação do próximo ano.",
    icon: Repeat,
  },
];

// Pra quem é / pra quem não é
const praQuemE = [
  "Empresas com pelo menos 1 vendedor",
  "Faturamento acima de R$ 50 mil/mês",
  "Dono que quer previsibilidade de receita",
  "Disposição real para executar o plano",
  "Quer método, sistema e cobrança — não só conteúdo",
];

const praQuemNaoE = [
  "Quem procura palestra motivacional",
  "Quem quer assistir aula e não executar",
  "Quem não aceita ser cobrado",
  "Negócios sem operação comercial mínima",
];

// FAQ
const faqs = [
  {
    question: "Como são os encontros ao vivo?",
    answer:
      "Os encontros acontecem às quartas-feiras, às 14h, em formato quinzenal e ao vivo. Cada encontro combina o tema do mês com hot seat resolvendo casos reais das empresas do grupo.",
  },
  {
    question: "E se eu entrar no meio do ano?",
    answer:
      "A entrada é contínua. Sua jornada de 12 meses começa no dia em que você entra — o plano pelo Método CRESCER é montado para a sua empresa a partir da sua data de início.",
  },
  {
    question: "O que é o hot seat?",
    answer:
      "É o momento do encontro em que uma empresa traz um caso real — um gargalo, uma decisão, um número que não fecha — e recebe direcionamento direto do Fabrício, na frente do grupo. Todo mundo aprende com o caso de todo mundo.",
  },
  {
    question: "Preciso ter CRM?",
    answer:
      "Não. O sistema já vem incluso no programa. Seu plano, suas metas, seu placar e seu time rodam dentro do UNV Nexus desde o primeiro dia.",
  },
  {
    question: "Tem fidelidade?",
    answer:
      "O UNV Board é um programa anual. A jornada foi desenhada para 12 meses de execução — e você acompanha a evolução por trimestre no placar antes de decidir a renovação.",
  },
];

export default function UNVBoardPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <div className="flex justify-center mb-8">
              <img src={logoUnvBoard} alt="UNV Board" className="h-32 md:h-44" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary text-sm font-medium rounded-full mb-6 border border-primary/30">
              Programa Anual
            </div>
            <h1 className="heading-display text-foreground mb-6">UNV Board</h1>
            <p className="text-xl md:text-2xl text-foreground/90 font-medium mb-4">
              Mentoria é direção. O UNV Board é direção com cobrança.
            </p>
            <p className="text-lg text-muted-foreground mb-8 mx-auto">
              Um ano de gestão comercial com método, sistema e um diretor
              comercial cobrando a execução da sua equipe todos os dias — dentro
              do seu WhatsApp.
            </p>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="hero" size="xl">
                Quero entrar no Board
                <ArrowRight className="ml-2" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* O Problema */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              O Problema das Mentorias Tradicionais
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              Conteúdo não falta. O que falta é alguém garantindo que o plano
              saia do papel.
            </p>
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {problemas.map((item, i) => (
                <div key={i} className="card-premium p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {item.title}
                  </h3>
                  <p className="text-small">{item.description}</p>
                </div>
              ))}
            </div>
            <blockquote className="text-2xl md:text-3xl font-display text-foreground italic text-center">
              "Reunião sem métrica é terapia em grupo."
            </blockquote>
          </div>
        </div>
      </section>

      {/* O Que É — As 7 Entregas */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              O Que Você Recebe no UNV Board
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Sete entregas que transformam direção em execução — todos os dias,
              não só no dia do encontro.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {entregas.map((item, i) => (
              <div key={i} className="card-premium p-6">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <item.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-small">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como Funciona — Método CRESCER */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              Como Funciona — Método CRESCER
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Sua jornada de 12 meses segue as 7 fases da metodologia
              proprietária UNV, com toda ação datada dentro do sistema.
            </p>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {fasesCrescer.map((fase, i) => (
              <div key={i} className="card-premium p-6 flex items-center gap-5">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold text-xl">
                    {fase.letra}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-accent text-sm font-medium">
                      Fase {i + 1}
                    </p>
                  </div>
                  <h3 className="font-semibold text-foreground">{fase.nome}</h3>
                  <p className="text-small">{fase.descricao}</p>
                </div>
                <fase.icon className="h-6 w-6 text-accent flex-shrink-0 hidden sm:block" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pra Quem É / Pra Quem Não É */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Pra Quem É — e Pra Quem Não É
            </h2>
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  Pra Quem É
                </h3>
                <ul className="space-y-3">
                  {praQuemE.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-body">
                      <CheckCircle className="h-4 w-4 text-accent mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  Pra Quem Não É
                </h3>
                <ul className="space-y-3">
                  {praQuemNaoE.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-muted-foreground"
                    >
                      <XCircle className="h-4 w-4 mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Investimento */}
      <section className="section-padding bg-card border-y border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        <div className="container-premium relative">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              Investimento
            </h2>
            <p className="text-4xl md:text-5xl font-display font-bold text-primary mb-4">
              R$ 20.000
            </p>
            <p className="text-muted-foreground text-lg mb-2">
              Programa anual • ou 12x de R$ 1.666,67
            </p>
            <p className="text-body mb-6 max-w-xl mx-auto">
              Menos que o custo de meio vendedor júnior — com a direção de quem
              já gerou mais de R$ 1 bilhão em vendas.
            </p>
            <p className="text-sm text-muted-foreground/60 mb-10 max-w-xl mx-auto">
              Vagas por sala limitadas a 25 empresas.
            </p>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="hero" size="xl">
                Quero entrar no Board
                <ArrowRight className="ml-2" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Perguntas Frequentes
            </h2>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="card-premium px-6"
                >
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:text-accent py-5">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-body pb-5">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Frase Final */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <blockquote className="text-2xl md:text-3xl font-display text-foreground italic mb-8">
              "Sistema bem estruturado escala. Improviso não escala."
            </blockquote>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="premium" size="lg">
                Quero entrar no Board
                <ArrowRight className="ml-2" />
              </Button>
            </a>
          </div>
        </div>
      </section>
    </Layout>
  );
}
