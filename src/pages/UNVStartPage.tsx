import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  XCircle,
} from "lucide-react";

// TSL 14 blocos — método low ticket: sem botão nem preço até o bloco de oferta,
// autoridade só no final, dor única (não sei onde perco vendas), mecanismo nomeado.

// Bloco 2 — Ruminação mental (frases que o dono repete na cabeça)
const ruminacoes = [
  "“Meu time vende muito menos do que poderia.”",
  "“Tem lead entrando e ninguém converte.”",
  "“Meu vendedor diz que o cliente ‘não tinha interesse’. Será que é isso mesmo?”",
  "“Todo mês a meta fica perto… mas nunca bate.”",
  "“Será que o problema é a minha equipe ou o meu processo?”",
  "“Eu sei que estou deixando dinheiro na mesa. Só não sei onde.”",
];

// Bloco 4 — Os 7 vazamentos
const vazamentos = [
  "Vender pro público errado (lead que nunca vai comprar)",
  "Funil sem etapas claras — ninguém sabe onde a venda morre",
  "Cada vendedor falando uma coisa diferente pro cliente",
  "Objeção que ninguém sabe contornar (e vira “vou pensar”)",
  "Follow-up que não existe: o lead esfria e some",
  "Rotina comercial no improviso, sem processo definido",
  "Meta sem plano: número jogado, torcida no lugar de gestão",
];

// Bloco 8 — O que recebe (stack)
const documentos = [
  {
    icon: Activity,
    title: "Raio-X Comercial",
    description: "O diagnóstico: exatamente onde sua empresa perde venda hoje.",
  },
  {
    icon: Target,
    title: "ICP e Proposta de Valor",
    description: "Fecha o vazamento nº 1: pare de vender pra quem não compra.",
  },
  {
    icon: Filter,
    title: "Funil de Vendas",
    description: "Etapas claras: você enxerga onde cada venda morre.",
  },
  {
    icon: MessageSquare,
    title: "Script de Vendas",
    description: "O que o time fala em cada etapa, com contorno de objeção pronto.",
  },
  {
    icon: BookOpen,
    title: "Playbook Comercial",
    description: "O manual que faz qualquer vendedor vender do jeito certo.",
  },
  {
    icon: ClipboardList,
    title: "Processos Comerciais",
    description: "A rotina que roda sem depender de você entrar na venda.",
  },
  {
    icon: Calendar,
    title: "Metas e Calendário",
    description: "O plano pra bater número por gestão, não por sorte.",
  },
];

// Bloco 7 — Como funciona
const passos = [
  {
    numero: "1",
    titulo: "Você responde",
    descricao:
      "Perguntas guiadas sobre o seu negócio. Você conhece a sua empresa — leva minutos.",
  },
  {
    numero: "2",
    titulo: "A IA diagnostica e monta",
    descricao:
      "O sistema cruza suas respostas com o Método dos Vazamentos Comerciais e monta cada documento sob medida.",
  },
  {
    numero: "3",
    titulo: "Você baixa e aplica",
    descricao:
      "PDF profissional pronto pra usar com o time amanhã de manhã. Sem aula, sem teoria.",
  },
];

// Bloco 10 — Pra quem é / não é
const praQuem = [
  "Dono de empresa com pelo menos 1 vendedor",
  "Já vende, mas sente que vende menos do que poderia",
  "Quer saber ONDE o processo falha antes de trocar time ou dobrar tráfego",
];
const praQuemNao = [
  "Quer curso pra assistir aula (aqui você constrói, não assiste)",
  "Não tem operação de vendas rodando ainda",
  "Procura fórmula mágica sem responder sobre o próprio negócio",
];

// Bloco 11 — Ancoragem
const ancoragem = [
  "Consultoria pra diagnosticar isso: R$ 5.000 ou mais",
  "Um diretor comercial: R$ 7.000 por mês",
  "Mais um trimestre decidindo no escuro: incalculável",
];

// Bloco 14 — FAQ
const faqs = [
  {
    question: "Preciso entender de vendas pra usar?",
    answer:
      "Não. As perguntas te guiam passo a passo. Se você conhece o seu negócio, você consegue.",
  },
  {
    question: "Serve pro meu segmento?",
    answer:
      "Sim. Nada aqui é genérico — o diagnóstico e os documentos são montados a partir das suas respostas, pro seu mercado.",
  },
  {
    question: "É mensalidade?",
    answer: "Não. Pagamento único de R$ 97. O que você construir é seu pra sempre.",
  },
  {
    question: "Quando eu recebo o acesso?",
    answer:
      "Na hora. Assim que o pagamento confirma, você recebe o link de acesso por e-mail e WhatsApp.",
  },
  {
    question: "Quanto tempo leva?",
    answer:
      "O Raio-X sai em cerca de 30 minutos. A estrutura completa, a maioria monta em uma tarde, no seu ritmo.",
  },
  {
    question: "E se eu quiser ajuda pra colocar em prática?",
    answer:
      "Depois que sua estrutura estiver pronta, a UNV tem programas de execução acompanhada. Mas o Raio-X já te entrega tudo pra agir sozinho.",
  },
];

const CTA = ({ label = "Quero descobrir onde estou perdendo vendas" }: { label?: string }) => (
  <Link to="/start/checkout">
    <Button
      variant="hero"
      size="xl"
      className="w-full sm:w-auto bg-white text-primary hover:bg-white/90"
    >
      {label}
      <ArrowRight className="ml-2" />
    </Button>
  </Link>
);

export default function UNVStartPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* 1. Headline — promessa + mecanismo. Sem preço, sem botão. */}
      <section className="relative flex items-center bg-gradient-to-br from-[#0D2B5E] via-[#0D2B5E] to-[#081d40] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
        <div className="container-premium relative z-10 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <p className="text-xs md:text-sm uppercase tracking-[0.25em] text-white/70 font-medium mb-5">
              Para donos de empresa com time de vendas
            </p>
            <h1 className="heading-display text-white mb-6">
              Descubra em 30 minutos exatamente onde a sua empresa está perdendo
              vendas — mesmo que você ache que o problema é a equipe.
            </h1>
            <p className="text-lg md:text-xl text-white/80 mx-auto">
              O <strong className="text-white">Raio-X Comercial</strong> usa o
              Método dos Vazamentos Comerciais pra localizar os pontos do seu
              processo por onde o dinheiro escapa todos os dias — e já te
              entrega o plano pronto pra fechar cada um deles.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Ruminação mental */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-10">
              Se você já se pegou pensando isso, essa página é pra você:
            </h2>
            <div className="space-y-3">
              {ruminacoes.map((frase, i) => (
                <div key={i} className="flex items-start gap-3 p-4 card-premium">
                  <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground italic">{frase}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Agitação — o custo de decidir no escuro */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              O mais caro não é perder a venda. É não saber onde ela foi perdida.
            </h2>
            <p className="text-body text-lg mb-6">
              Sem saber onde o processo falha, toda decisão vira aposta: você
              troca vendedor — e nada muda. Coloca mais dinheiro em tráfego — e o
              lead continua esfriando no mesmo lugar. Cobra mais o time — e o mês
              seguinte repete o anterior.
            </p>
            <p className="text-body text-lg">
              Não é falta de esforço. É que você está tentando consertar a
              máquina <strong className="text-foreground">sem abrir o capô</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* 4. A causa real — os 7 vazamentos */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-6">
              Toda operação comercial perde dinheiro em até 7 vazamentos. A sua
              provavelmente tem 3 ou mais.
            </h2>
            <p className="text-body text-center mb-10">
              Depois de estruturar centenas de operações, a UNV mapeou os 7
              pontos por onde as empresas mais perdem venda sem perceber:
            </p>
            <div className="space-y-3">
              {vazamentos.map((v, i) => (
                <div key={i} className="flex items-start gap-3 p-4 card-premium">
                  <span className="w-7 h-7 rounded-full bg-[#0D2B5E]/10 text-primary font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Mecanismo — Método dos Vazamentos Comerciais */}
      <section className="section-padding bg-gradient-to-br from-[#0D2B5E] to-[#081d40]">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-accent text-sm font-bold uppercase tracking-wider mb-4">
              O mecanismo
            </p>
            <h2 className="heading-section text-white mb-6">
              Método dos Vazamentos Comerciais
            </h2>
            <p className="text-lg text-white/80 mb-6">
              Um diagnóstico guiado que varre o seu processo comercial de ponta
              a ponta — público, funil, abordagem, objeção, follow-up, rotina e
              meta — e aponta, um por um, onde a sua operação está vazando.
            </p>
            <p className="text-lg text-white/80">
              E como diagnóstico sem correção não resolve, ele já monta o
              material pronto pra fechar cada vazamento encontrado.{" "}
              <span className="text-white font-semibold">
                Personalizado pro seu negócio, não um PDF genérico.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* 6. O produto — pronto, compra e usa */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              O Raio-X Comercial já está pronto. Você entra e usa.
            </h2>
            <p className="text-body text-lg">
              Não é curso, não é aula, não é consultoria com agenda. É um
              sistema guiado por inteligência artificial: você responde sobre o
              seu negócio e ele diagnostica, monta e entrega os documentos —
              tudo na mesma tela, no seu ritmo.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Como funciona */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="text-center mb-14">
            <h2 className="heading-section text-foreground mb-4">Como funciona</h2>
            <p className="text-body max-w-2xl mx-auto">Três passos. Sem enrolação.</p>
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

      {/* 8. O que você recebe — stack */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="text-center mb-14">
            <h2 className="heading-section text-foreground mb-4">
              O que sai do Raio-X
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              O diagnóstico + os 7 documentos que fecham os vazamentos — e um
              book final que compila tudo.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-6">
            {documentos.map((doc, i) => (
              <div key={i} className="card-premium p-6">
                <div className="w-12 h-12 rounded-lg bg-[#0D2B5E]/10 flex items-center justify-center mb-4">
                  <doc.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{doc.title}</h3>
                <p className="text-small">{doc.description}</p>
              </div>
            ))}
          </div>
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

      {/* 9. Por que é diferente de curso */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Isso não é mais um curso que você compra e não aplica.
            </h2>
            <div className="space-y-4">
              {[
                "Não é curso: você não assiste aula, você constrói a SUA estrutura.",
                "Não é PDF genérico: cada documento é feito sob medida pelo que você respondeu.",
                "Não é teoria: é o material pronto que o seu time usa amanhã de manhã.",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-5 card-premium">
                  <CheckCircle className="h-6 w-6 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-foreground text-lg">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 10. Pra quem é / não é */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="heading-card text-foreground text-xl mb-6">
                O Raio-X é pra você se:
              </h3>
              <div className="space-y-3">
                {praQuem.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 card-premium">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="heading-card text-foreground text-xl mb-6">
                Não é pra você se:
              </h3>
              <div className="space-y-3">
                {praQuemNao.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 card-premium">
                    <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 11. Oferta — primeira aparição de preço e botão */}
      <section
        id="oferta"
        className="section-padding bg-gradient-to-br from-[#0D2B5E] to-[#081d40] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
        <div className="container-premium relative">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="heading-section text-white mb-10">
              Quanto vale saber exatamente onde a sua empresa perde vendas — com
              o plano pronto pra corrigir?
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
              <p className="text-white/70 text-lg mb-2">
                O Raio-X Comercial completo, hoje, por
              </p>
              <p className="text-6xl md:text-7xl font-display font-bold text-white mb-3">
                R$ 97
              </p>
              <p className="text-white/80 text-lg font-medium">
                Pagamento único. Seu pra sempre.
              </p>
            </div>
            <CTA />
            <p className="text-sm text-white/60 mt-5">
              Pix ou cartão · Acesso na hora · Garantia incondicional de 7 dias
            </p>
          </div>
        </div>
      </section>

      {/* 12. Garantia */}
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
                Faça o seu Raio-X. Use por 7 dias. Se você achar que não valeu
                cada centavo, é só pedir: devolvo 100% do seu dinheiro, sem
                pergunta nenhuma.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 13. Autoridade — só aqui embaixo */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <div className="card-premium p-8 bg-[#0D2B5E]/5 border-[#0D2B5E]/20 text-center">
              <p className="text-accent text-sm font-bold uppercase tracking-wider mb-3">
                Quem está por trás
              </p>
              <p className="text-foreground font-medium text-lg">
                O Método dos Vazamentos Comerciais nasceu na UNV — Universidade
                Nacional de Vendas, que atua como diretoria comercial
                terceirizada de dezenas de empresas. Mais de 20 anos de vendas e
                R$ 1 bilhão vendidos alimentam a metodologia por trás do Raio-X.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 14. FAQ + fechamento */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Perguntas Frequentes
            </h2>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="card-premium px-6">
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

      <section className="section-padding bg-gradient-to-br from-[#0D2B5E] to-[#081d40]">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-2xl md:text-3xl font-display text-white mb-10">
              Você pode passar mais um trimestre decidindo no escuro. Ou pode
              abrir o capô da sua operação hoje, por R$ 97.
            </p>
            <CTA label="Fazer meu Raio-X Comercial agora" />
            <p className="text-sm text-white/60 mt-5">
              Pagamento único · Acesso imediato · Garantia de 7 dias
            </p>
          </div>
        </div>
      </section>

      <footer className="py-8 bg-[#081d40] text-center">
        <p className="text-xs text-white/40">
          © {new Date().getFullYear()} UNV Holdings. Todos os direitos reservados.
        </p>
      </footer>
    </main>
  );
}
