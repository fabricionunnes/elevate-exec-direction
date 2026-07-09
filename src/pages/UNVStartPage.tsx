import { Link } from "react-router-dom";
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
  Activity,
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle,
  ClipboardList,
  Filter,
  MessageSquare,
  ScrollText,
  Shield,
  Target,
} from "lucide-react";

// Dores do problema
const dores = [
  "Cada vendedor vende de um jeito diferente",
  "Ninguém segue um script — cada um improvisa",
  "Você não sabe onde perde a venda no funil",
  "Nada está documentado: o conhecimento está só na sua cabeça",
  "Sem processo, não tem previsibilidade nenhuma",
];

// Value stack — os 7 documentos
const documentos = [
  {
    icon: Activity,
    title: "Raio-X Comercial",
    description: "Descubra exatamente onde você está perdendo venda hoje.",
  },
  {
    icon: Target,
    title: "ICP e Proposta de Valor",
    description: "Pare de gastar energia com quem nunca vai comprar.",
  },
  {
    icon: Filter,
    title: "Funil de Vendas",
    description: 'O caminho claro do primeiro contato até o "sim".',
  },
  {
    icon: MessageSquare,
    title: "Script de Vendas",
    description:
      "O que falar em cada etapa pra fechar mais, com contorno de objeção pronto.",
  },
  {
    icon: BookOpen,
    title: "Playbook Comercial",
    description: "O manual que faz qualquer vendedor vender como você vende.",
  },
  {
    icon: ClipboardList,
    title: "Processos Comerciais",
    description: "A rotina que faz a máquina girar sem depender de você.",
  },
  {
    icon: Calendar,
    title: "Metas e Calendário",
    description: "O plano pra bater número todos os meses, não por sorte.",
  },
];

// Como funciona
const passos = [
  {
    numero: "1",
    titulo: "Você responde",
    descricao:
      "Perguntas simples e guiadas sobre o seu negócio. Você conhece a sua empresa; é rápido.",
  },
  {
    numero: "2",
    titulo: "A IA monta",
    descricao:
      "Cada documento é construído na hora, com a metodologia UNV, personalizado pro seu caso.",
  },
  {
    numero: "3",
    titulo: "Você baixa e usa",
    descricao:
      "Revisa, ajusta o que quiser e baixa em PDF profissional pra usar com o time hoje.",
  },
];

// Por que é diferente
const diferenciais = [
  "Não é curso: você não assiste aula, você constrói a SUA estrutura.",
  "Não é PDF genérico: cada documento é feito sob medida pelo que você respondeu.",
  "Não é teoria: é o material pronto que o seu time usa amanhã de manhã.",
];

// Ancoragem de preço
const ancoragem = [
  "Um consultor pra montar isso: R$ 5.000 ou mais",
  "Um diretor comercial: R$ 7.000 por mês",
  "Meses montando sozinho no tentativa e erro: incalculável",
];

// FAQ
const faqs = [
  {
    question: "Preciso entender de vendas pra usar?",
    answer:
      "Não. As perguntas te guiam passo a passo. Se você conhece o seu negócio, você consegue.",
  },
  {
    question: "Serve pro meu segmento?",
    answer:
      "Sim. Nada aqui é genérico — cada documento é montado a partir das suas respostas, pro seu mercado.",
  },
  {
    question: "É mensalidade?",
    answer:
      "Não. Pagamento único de R$ 97. O que você construir é seu pra sempre.",
  },
  {
    question: "Quando eu recebo o acesso?",
    answer:
      "Na hora. Assim que o pagamento confirma, você recebe o link de acesso por e-mail e WhatsApp.",
  },
  {
    question: "Quanto tempo leva pra montar tudo?",
    answer:
      "Você faz no seu ritmo. A maioria monta a estrutura completa em uma tarde.",
  },
  {
    question: "E se eu quiser ajuda pra colocar em prática?",
    answer:
      "Depois que sua estrutura estiver pronta, a UNV tem programas de execução acompanhada. Mas o UNV Start já te entrega tudo pra começar sozinho.",
  },
];

export default function UNVStartPage() {
  return (
    <Layout>
      {/* 1. Hero */}
      <section className="relative flex items-center bg-gradient-to-br from-[#0D2B5E] via-[#0D2B5E] to-[#081d40] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
        <div className="container-premium relative z-10 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <div className="flex justify-center mb-8">
              <img
                src={logoUnvBoard}
                alt="UNV Start"
                className="h-20 md:h-28"
              />
            </div>
            <p className="text-xs md:text-sm uppercase tracking-[0.25em] text-white/70 font-medium mb-5">
              Para donos de empresa que vendem no improviso
            </p>
            <h1 className="heading-display text-white mb-6">
              Monte a estrutura comercial completa da sua empresa em uma tarde —
              e pare de depender de você pra vender.
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-10 mx-auto">
              Playbook, scripts de venda, funil, processos e metas. Tudo
              personalizado pro seu negócio, guiado por inteligência artificial
              com a metodologia que já gerou mais de R$ 1 bilhão em vendas. Sem
              contratar consultor. Sem mensalidade.
            </p>
            <Link to="/start/checkout">
              <Button variant="hero" size="xl" className="w-full sm:w-auto">
                Quero minha estrutura por R$ 97
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
            <p className="text-sm text-white/60 mt-5">
              Pagamento único · Acesso imediato · Garantia de 7 dias
            </p>
          </div>
        </div>
      </section>

      {/* 2. O Problema */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-8">
              Se a sua empresa só bate meta quando VOCÊ entra na venda, o
              problema não é o time. É a falta de estrutura.
            </h2>
            <p className="text-body text-center mb-10">
              Toda semana começa igual. Você puxa o time, cobra, entra na venda
              pra fechar — e no mês seguinte tudo se repete. Não é falta de
              esforço. É falta de sistema.
            </p>
            <div className="space-y-3 mb-10">
              {dores.map((dor, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-4 card-premium"
                >
                  <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">{dor}</span>
                </div>
              ))}
            </div>
            <blockquote className="text-2xl md:text-3xl font-display text-foreground italic text-center">
              "Improviso não escala. Sistema escala."
            </blockquote>
          </div>
        </div>
      </section>

      {/* 3. A Virada */}
      <section className="section-padding bg-gradient-to-br from-[#0D2B5E] to-[#081d40]">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xl md:text-2xl text-white font-medium mb-8">
              Toda empresa que escala vendas tem uma coisa em comum: a estrutura
              comercial está documentada. Playbook, script, funil, processo
              definido. Não é talento — é método.
            </p>
            <p className="text-lg text-white/70">
              O problema é que montar isso do zero leva meses. Ou custa mais de
              R$ 5.000 com um consultor.{" "}
              <span className="text-white font-semibold">Até agora.</span>
            </p>
          </div>
        </div>
      </section>

      {/* 4. A Solução */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              O UNV Start monta a sua estrutura comercial hoje.
            </h2>
            <p className="text-body text-lg">
              Você responde perguntas simples sobre o seu negócio. A
              inteligência artificial da UNV — treinada na metodologia CRESCER, a
              mesma que estrutura empresas que faturam milhões — monta a sua
              estrutura comercial completa. Do seu jeito, pro seu mercado, em
              documentos profissionais prontos pra usar com o seu time hoje.
            </p>
          </div>
        </div>
      </section>

      {/* 5. O Que Você Constrói — Value Stack */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="text-center mb-14">
            <h2 className="heading-section text-foreground mb-4">
              O que você constrói
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Sete documentos oficiais que viram a estrutura comercial da sua
              empresa — e um book final que compila tudo.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-6">
            {documentos.map((doc, i) => (
              <div key={i} className="card-premium p-6">
                <div className="w-12 h-12 rounded-lg bg-[#0D2B5E]/10 flex items-center justify-center mb-4">
                  <doc.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {doc.title}
                </h3>
                <p className="text-small">{doc.description}</p>
              </div>
            ))}
          </div>

          {/* Card de destaque — Book da Estrutura */}
          <div className="max-w-6xl mx-auto">
            <div className="card-highlight p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
              <div className="w-16 h-16 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0 relative">
                <ScrollText className="h-8 w-8 text-accent" />
              </div>
              <div className="relative">
                <p className="text-accent text-sm font-bold uppercase tracking-wider mb-2">
                  E no final
                </p>
                <h3 className="heading-card text-foreground text-2xl mb-2">
                  Book da Estrutura
                </h3>
                <p className="text-body">
                  Tudo compilado num único documento oficial com a sua marca.
                  Seu manual comercial completo, pronto pra imprimir e entregar
                  pro time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Como Funciona */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="text-center mb-14">
            <h2 className="heading-section text-foreground mb-4">
              Como funciona
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Três passos. Sem enrolação.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {passos.map((passo, i) => (
              <div key={i} className="card-premium p-8 text-center">
                <div className="text-6xl md:text-7xl font-display font-bold text-primary/20 mb-3">
                  {passo.numero}
                </div>
                <h3 className="font-semibold text-foreground text-xl mb-3">
                  {passo.titulo}
                </h3>
                <p className="text-small">{passo.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Por Que É Diferente */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Isso não é mais um curso que você compra e não aplica.
            </h2>
            <div className="space-y-4 mb-12">
              {diferenciais.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-5 card-premium"
                >
                  <CheckCircle className="h-6 w-6 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-foreground text-lg">{item}</span>
                </div>
              ))}
            </div>
            <div className="card-premium p-8 bg-[#0D2B5E]/5 border-[#0D2B5E]/20 text-center">
              <p className="text-foreground font-medium text-lg">
                Metodologia UNV — Universidade Nacional de Vendas. Mais de R$ 1
                bilhão em vendas gerados. A mesma estrutura usada nas empresas
                que a UNV assessora.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Oferta */}
      <section
        id="oferta"
        className="section-padding bg-gradient-to-br from-[#0D2B5E] to-[#081d40] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
        <div className="container-premium relative">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="heading-section text-white mb-10">
              Quanto vale ter a estrutura comercial da sua empresa pronta?
            </h2>

            <div className="space-y-3 mb-10 text-left">
              {ancoragem.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <span className="text-white/50 line-through decoration-primary-foreground/40">
                    {item}
                  </span>
                </div>
              ))}
            </div>

            <div className="mb-8">
              <p className="text-white/70 text-lg mb-2">Hoje, tudo isso por</p>
              <p className="text-6xl md:text-7xl font-display font-bold text-white mb-3">
                R$ 97
              </p>
              <p className="text-white/80 text-lg font-medium">
                Pagamento único. Seu pra sempre.
              </p>
            </div>

            <Link to="/start/checkout">
              <Button
                variant="hero"
                size="xl"
                className="w-full sm:w-auto bg-white text-primary hover:bg-white/90"
              >
                Quero minha estrutura por R$ 97
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
            <p className="text-sm text-white/60 mt-5">
              Pix ou cartão · Acesso na hora · Garantia incondicional de 7 dias
            </p>
          </div>
        </div>
      </section>

      {/* 9. Garantia */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-2xl mx-auto">
            <div className="card-premium p-8 md:p-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
                <Shield className="h-8 w-8 text-accent" />
              </div>
              <h2 className="heading-card text-foreground text-2xl mb-4">
                O risco é todo meu.
              </h2>
              <p className="text-body text-lg">
                Monte a sua estrutura. Use por 7 dias. Se você achar que não
                valeu cada centavo, é só pedir: devolvo 100% do seu dinheiro,
                sem pergunta nenhuma.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 10. FAQ */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
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

      {/* 11. Fechamento */}
      <section className="section-padding bg-gradient-to-br from-[#0D2B5E] to-[#081d40]">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-2xl md:text-3xl font-display text-white mb-10">
              Você pode continuar vendendo no improviso e torcendo pra bater
              meta. Ou pode montar a estrutura comercial da sua empresa hoje,
              por R$ 97.
            </p>
            <Link to="/start/checkout">
              <Button
                variant="hero"
                size="xl"
                className="w-full sm:w-auto bg-white text-primary hover:bg-white/90"
              >
                Quero minha estrutura por R$ 97
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
            <p className="text-sm text-white/60 mt-5">
              Pagamento único · Acesso imediato · Garantia de 7 dias
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
