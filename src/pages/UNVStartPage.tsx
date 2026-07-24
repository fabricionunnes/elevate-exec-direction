import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { initMetaPixel, trackMetaEvent } from "@/lib/metaPixel";
import fabricioMentor from "@/assets/fabricio-mentor.webp";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Activity,
  BookOpen,
  Calendar,
  CheckCircle,
  ClipboardList,
  CreditCard,
  Filter,
  Lock,
  Mail,
  MessageSquare,
  ScrollText,
  Shield,
  Target,
  TrendingDown,
  XCircle,
} from "lucide-react";

// TSL modelada na estrutura da página de referência do método low ticket:
// hero com promessa "mesmo que", prova, realidade (ruminações), agitação,
// transição, 3 passos, resultado, stack, oferta em card, pós-compra,
// fechamento emocional, autoridade com foto, footer legal.
// Sem botão nem preço antes do bloco de oferta.

const ruminacoes = [
  { titulo: "Time abaixo do potencial", frase: "Meu time vende muito menos do que poderia." },
  { titulo: "Lead que não vira venda", frase: "Tem lead entrando e ninguém converte." },
  { titulo: "Desculpa pronta", frase: "Meu vendedor diz que o cliente “não tinha interesse”. Será?" },
  { titulo: "Meta que nunca fecha", frase: "Todo mês a meta fica perto… mas nunca bate." },
  { titulo: "Dúvida que não sai", frase: "Será que o problema é a minha equipe ou o meu processo?" },
  { titulo: "Dinheiro na mesa", frase: "Eu sei que estou deixando dinheiro na mesa. Só não sei onde." },
];

const consequencias = [
  { titulo: "Você troca vendedor — e nada muda", desc: "Porque o problema não estava no vendedor. Estava no processo que ninguém enxerga." },
  { titulo: "Você coloca mais dinheiro em tráfego", desc: "Mais lead entrando pelo mesmo funil furado. O vazamento só fica mais caro." },
  { titulo: "Você cobra mais o time", desc: "Reunião, pressão, planilha… e o mês seguinte repete o anterior." },
  { titulo: "Cada venda vira caso único", desc: "Sem padrão, o resultado depende do humor do dia. Impossível prever o mês." },
  { titulo: "Você entra na venda pra salvar o mês", desc: "A empresa só bate meta quando VOCÊ vende. Isso não é time, é dependência." },
  { titulo: "Você decide tudo no escuro", desc: "Sem diagnóstico, toda decisão é aposta. E aposta errada custa caro todo mês." },
];

const passos = [
  { numero: "1", titulo: "Você responde", descricao: "Perguntas guiadas sobre o seu negócio, direto na tela. Você conhece a sua empresa — leva minutos." },
  { numero: "2", titulo: "A IA diagnostica", descricao: "O sistema cruza suas respostas com o Método dos Vazamentos Comerciais e localiza onde sua operação perde venda." },
  { numero: "3", titulo: "Você recebe o plano pronto", descricao: "Documentos profissionais montados sob medida, prontos pra aplicar com o time amanhã de manhã." },
];

const resultados = [
  "Enxergar o seu funil como ele é — e saber exatamente onde cada venda morre",
  "Parar de decidir por achismo: agir primeiro no vazamento que mais custa dinheiro",
  "Ter processo, script e meta documentados — sem depender de você entrar na venda",
];

const documentos = [
  { icon: Activity, title: "Raio-X Comercial", description: "O diagnóstico completo: onde sua empresa perde venda hoje, ponto por ponto." },
  { icon: Target, title: "ICP e Proposta de Valor", description: "Pare de gastar energia com quem nunca vai comprar." },
  { icon: Filter, title: "Funil de Vendas", description: "Etapas claras: você enxerga onde cada venda morre." },
  { icon: MessageSquare, title: "Script de Vendas", description: "O que o time fala em cada etapa, com contorno de objeção pronto." },
  { icon: BookOpen, title: "Playbook Comercial", description: "O manual que padroniza o jeito certo de vender na sua empresa." },
  { icon: ClipboardList, title: "Processos Comerciais", description: "A rotina que roda sem depender de você." },
  { icon: Calendar, title: "Metas e Calendário", description: "O plano pra bater número por gestão, não por sorte." },
];

const ofertaItens = [
  "Diagnóstico Raio-X guiado por IA",
  "7 documentos personalizados pro seu negócio",
  "Book da Estrutura compilado com a sua marca",
  "Download em PDF profissional",
  "Acesso imediato, no seu ritmo",
];

const posCompra = [
  { icon: Mail, titulo: "Verifique seu WhatsApp e e-mail", desc: "Assim que o pagamento confirma, seu link de acesso chega na hora pelos dois canais." },
  { icon: Activity, titulo: "Faça o seu Raio-X", desc: "Responda as perguntas guiadas e veja o diagnóstico da sua operação em cerca de 30 minutos." },
  { icon: ScrollText, titulo: "Baixe e aplique", desc: "Documentos prontos, personalizados, pra colocar na frente do time no dia seguinte." },
];

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

const faqs = [
  { question: "Preciso entender de vendas pra usar?", answer: "Não. As perguntas te guiam passo a passo. Se você conhece o seu negócio, você consegue." },
  { question: "Serve pro meu segmento?", answer: "Sim. Nada aqui é genérico — o diagnóstico e os documentos são montados a partir das suas respostas, pro seu mercado." },
  { question: "É mensalidade?", answer: "Não. Pagamento único de R$ 37. O que você construir é seu pra sempre." },
  { question: "Quando eu recebo o acesso?", answer: "Na hora. Assim que o pagamento confirma, você recebe o link de acesso por e-mail e WhatsApp." },
  { question: "Quanto tempo leva?", answer: "O Raio-X sai em cerca de 30 minutos. A estrutura completa, a maioria monta em uma tarde, no seu ritmo." },
  { question: "E se eu quiser ajuda pra colocar em prática?", answer: "Depois que sua estrutura estiver pronta, a UNV tem programas de execução acompanhada. Mas o Raio-X já te entrega tudo pra agir sozinho." },
];

// Checkout hospedado da Greenn — cole aqui o link do produto quando criar na Greenn.
// Vazio = usa o checkout interno (/start/checkout, Asaas) como fallback.
const GREENN_CHECKOUT_URL = "https://payfast.greenn.com.br/u4q3ecv";

const CheckoutLink = ({ children, className }: { children: ReactNode; className?: string }) =>
  GREENN_CHECKOUT_URL ? (
    <a href={GREENN_CHECKOUT_URL} className={className}>{children}</a>
  ) : (
    <Link to="/start/checkout" className={className}>{children}</Link>
  );

const CTA = ({ label = "SIM! QUERO MEU RAIO-X AGORA" }: { label?: string }) => (
  <CheckoutLink>
    <Button
      variant="hero"
      size="xl"
      className="w-full sm:w-auto bg-white text-primary hover:bg-white/90"
    >
      {label}
      <ArrowRight className="ml-2" />
    </Button>
  </CheckoutLink>
);

/* ---------- Visuais (SVG/CSS inline, zero peso externo) ---------- */

const FunilVazando = () => (
  <svg viewBox="0 0 380 340" className="w-full max-w-md mx-auto" role="img" aria-label="Funil de vendas com vazamentos">
    <defs>
      <linearGradient id="seg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0.10" />
      </linearGradient>
    </defs>
    <path d="M40 20 H340 L305 85 H75 Z" fill="url(#seg)" stroke="#ffffff" strokeOpacity="0.35" />
    <path d="M80 95 H300 L272 155 H108 Z" fill="url(#seg)" stroke="#ffffff" strokeOpacity="0.3" />
    <path d="M113 165 H267 L244 220 H136 Z" fill="url(#seg)" stroke="#ffffff" strokeOpacity="0.25" />
    <path d="M141 230 H239 L222 280 H158 Z" fill="url(#seg)" stroke="#ffffff" strokeOpacity="0.2" />
    <text x="190" y="58" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="600">100 leads</text>
    <text x="190" y="130" textAnchor="middle" fill="#fff" fillOpacity="0.85" fontSize="14">42 conversas</text>
    <text x="190" y="197" textAnchor="middle" fill="#fff" fillOpacity="0.75" fontSize="13">11 propostas</text>
    <text x="190" y="260" textAnchor="middle" fill="#fff" fillOpacity="0.7" fontSize="13">3 vendas</text>
    <g fill="#f87171">
      <circle cx="62" cy="105" r="5" />
      <circle cx="58" cy="122" r="3.5" opacity="0.7" />
      <circle cx="316" cy="112" r="5" />
      <circle cx="322" cy="130" r="3.5" opacity="0.7" />
      <circle cx="96" cy="178" r="5" />
      <circle cx="90" cy="196" r="3.5" opacity="0.7" />
      <circle cx="282" cy="185" r="5" />
      <circle cx="288" cy="203" r="3.5" opacity="0.7" />
      <circle cx="128" cy="248" r="5" />
      <circle cx="123" cy="265" r="3.5" opacity="0.7" />
    </g>
    <g fontSize="11" fill="#fecaca">
      <text x="58" y="142" textAnchor="middle">lead esfriou</text>
      <text x="318" y="150" textAnchor="middle">sem follow-up</text>
      <text x="90" y="215" textAnchor="middle">objeção</text>
      <text x="288" y="222" textAnchor="middle">discurso solto</text>
      <text x="124" y="294" textAnchor="middle">proposta parada</text>
    </g>
    <text x="190" y="320" textAnchor="middle" fill="#fecaca" fontSize="13" fontWeight="600">
      97 vendas perdidas — e você não vê onde
    </text>
  </svg>
);

const MockupPortal = () => (
  <div className="max-w-lg mx-auto rounded-xl overflow-hidden shadow-2xl border border-black/10 bg-white text-left">
    <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 border-b border-slate-200">
      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
      <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
      <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
      <span className="ml-3 text-[11px] text-slate-400 truncate">Raio-X Comercial — seu diagnóstico</span>
    </div>
    <div className="p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[#0D2B5E]">Etapa 1 de 7 · Raio-X</p>
        <p className="text-[11px] text-slate-400">14%</p>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 mb-5">
        <div className="h-1.5 rounded-full bg-[#0D2B5E]" style={{ width: "14%" }} />
      </div>
      <p className="text-sm font-semibold text-slate-800 mb-3">
        Hoje, quando um lead novo chega, o que acontece primeiro?
      </p>
      <div className="space-y-2">
        {["Alguém do time responde na hora, com padrão definido", "Cada um responde do seu jeito, quando dá", "Depende do dia — às vezes o lead fica sem resposta"].map((op, i) => (
          <div
            key={i}
            className={`px-4 py-2.5 rounded-lg border text-[13px] ${
              i === 1
                ? "border-[#0D2B5E] bg-[#0D2B5E]/5 text-[#0D2B5E] font-medium"
                : "border-slate-200 text-slate-500"
            }`}
          >
            {op}
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
        <span className="w-6 h-6 rounded-full bg-[#0D2B5E] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">IA</span>
        <p className="text-[12px] text-slate-500">
          Entendi. Isso costuma indicar o vazamento nº 6. Vamos confirmar…
        </p>
      </div>
    </div>
  </div>
);

const DocCard = ({ icon: Icon, title, description }: { icon: typeof Activity; title: string; description: string }) => (
  <div className="rounded-xl overflow-hidden border border-black/10 bg-white shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
    <div className="bg-[#0D2B5E] px-5 py-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-white/80" />
      <span className="text-white text-xs font-bold uppercase tracking-wider truncate">{title}</span>
    </div>
    <div className="p-5">
      <p className="text-sm text-slate-600 mb-4">{description}</p>
      <div className="space-y-1.5">
        <div className="h-1.5 rounded bg-slate-200 w-full" />
        <div className="h-1.5 rounded bg-slate-200 w-11/12" />
        <div className="h-1.5 rounded bg-slate-100 w-4/5" />
        <div className="h-1.5 rounded bg-slate-100 w-2/3" />
      </div>
    </div>
  </div>
);

export default function UNVStartPage() {
  useEffect(() => {
    initMetaPixel();
    trackMetaEvent("ViewContent", {
      content_name: "Raio-X Comercial",
      content_category: "low-ticket",
      value: 37,
      currency: "BRL",
    });
  }, []);

  return (
    <main className="min-h-screen bg-background">
      {/* 1. Hero — badge + promessa "mesmo que" + visual. Sem preço, sem botão. */}
      <section className="relative bg-gradient-to-br from-[#0D2B5E] via-[#0D2B5E] to-[#081d40] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
        <div className="container-premium relative z-10 py-14 md:py-20">
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center max-w-6xl mx-auto">
            <div className="text-center md:text-left animate-fade-up">
              <span className="inline-block rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-white mb-5">
                Raio-X Comercial
              </span>
              <p className="text-sm text-white/70 mb-3">
                O diagnóstico pronto do seu processo de vendas
              </p>
              <h1 className="font-display text-2xl md:text-4xl leading-tight text-white mb-5">
                Descubra onde a sua empresa está{" "}
                <span className="underline decoration-red-400/70 decoration-4 underline-offset-4">
                  perdendo vendas
                </span>{" "}
                — mesmo que você ache que o problema é a equipe.
              </h1>
              <p className="text-base md:text-lg text-white/80">
                Em 30 minutos, o Método dos Vazamentos Comerciais mostra por
                onde o dinheiro escapa da sua operação — e já entrega o plano
                pronto pra fechar cada vazamento.
              </p>
            </div>
            <div className="animate-fade-up">
              <FunilVazando />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Prova — números reais (depoimentos do produto entram aqui quando existirem) */}
      <section className="py-10 bg-background border-b border-border">
        <div className="container-premium">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto text-center">
            {[
              ["+20 anos", "de vendas na prática"],
              ["R$ 1 bilhão", "vendidos na carreira"],
              ["Dezenas", "de empresas estruturadas"],
              ["7 pilares", "num único diagnóstico"],
            ].map(([num, label], i) => (
              <div key={i}>
                <p className="text-2xl md:text-3xl font-display font-bold text-primary">{num}</p>
                <p className="text-small mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. A realidade — ruminações em cards com aspas */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-primary mb-4">
              A realidade de quem tem time de vendas
            </p>
            <h2 className="heading-section text-foreground text-center mb-6">
              Você já tentou de tudo pro comercial andar e, mesmo assim, a
              sensação de que algo está errado não sai da sua cabeça.
            </h2>
            <p className="text-body text-center mb-12">
              A gente sabe como é. É frustrante investir em time, tráfego e
              ferramenta… e continuar sem saber por que a venda não acontece.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ruminacoes.map((r, i) => (
                <div key={i} className="card-premium p-5">
                  <p className="font-bold text-primary text-sm uppercase tracking-wide mb-2">{r.titulo}</p>
                  <p className="text-foreground italic">“{r.frase}”</p>
                </div>
              ))}
            </div>
            <p className="text-center text-body mt-10">
              Dá um nó na cabeça, né?{" "}
              <strong className="text-foreground">Mas dá pra virar esse jogo agora.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* 4. Agitação — o que acontece sem diagnóstico */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-6">
              “Já troquei vendedor, já pus dinheiro em tráfego… e continuo no
              escuro. O que eu tô fazendo de errado?”
            </h2>
            <p className="text-body text-center mb-12">
              Sem saber <strong className="text-foreground">onde</strong> o processo
              vaza, toda tentativa vira aposta. E é isso que acontece:
            </p>
            <div className="grid sm:grid-cols-2 gap-5">
              {consequencias.map((c, i) => (
                <div key={i} className="card-premium p-6 flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground mb-1">{c.titulo}</p>
                    <p className="text-small">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Transição */}
      <section className="py-12 bg-gradient-to-br from-[#0D2B5E] to-[#081d40]">
        <div className="container-premium">
          <p className="text-center text-xl md:text-2xl font-display font-bold text-white max-w-3xl mx-auto">
            É JUSTAMENTE PRA EVITAR ISSO QUE EXISTE O RAIO-X COMERCIAL.
          </p>
        </div>
      </section>

      {/* 6. 3 passos + mockup */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="text-center mb-14">
            <span className="inline-block rounded-full bg-[#0D2B5E]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary mb-4">
              Raio-X Comercial
            </span>
            <h2 className="heading-section text-foreground">
              Com ele, você abre o capô da sua operação em 3 passos simples.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center max-w-6xl mx-auto">
            <div>
              <MockupPortal />
            </div>
            <div className="space-y-6">
              {passos.map((passo, i) => (
                <div key={i} className="flex gap-5">
                  <div className="w-12 h-12 rounded-full bg-[#0D2B5E] text-white font-display font-bold text-xl flex items-center justify-center flex-shrink-0">
                    {passo.numero}
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-lg uppercase tracking-wide mb-1">{passo.titulo}</p>
                    <p className="text-body">{passo.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. Resultado dos 3 passos */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Seguindo os 3 passos acima, você vai conseguir…
            </h2>
            <div className="space-y-4">
              {resultados.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-5 card-premium">
                  <CheckCircle className="h-6 w-6 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-foreground text-lg">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-xl font-display font-bold text-foreground mt-12">
              E AINDA NÃO ACABOU.
            </p>
          </div>
        </div>
      </section>

      {/* 8. Stack — tudo que recebe */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="text-center mb-14">
            <h2 className="heading-section text-foreground mb-4">
              Veja tudo que você vai receber no Raio-X Comercial:
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              O diagnóstico + os 7 documentos que fecham os vazamentos — cada um
              montado sob medida pelas suas respostas.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {documentos.map((doc, i) => (
              <DocCard key={i} {...doc} />
            ))}
            <div className="rounded-xl overflow-hidden border-2 border-red-300/40 bg-gradient-to-br from-[#0D2B5E] to-[#081d40] shadow-lg p-5 flex flex-col justify-center">
              <ScrollText className="h-7 w-7 text-red-300 mb-3" />
              <p className="text-red-300 text-xs font-bold uppercase tracking-wider mb-1">Bônus final</p>
              <p className="text-white font-semibold mb-1">Book da Estrutura</p>
              <p className="text-white/70 text-sm">
                Tudo compilado num documento oficial com a sua marca, pronto pra
                entregar pro time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Pra quem é / não é */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              O Raio-X Comercial é pra você que…
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-3">
                {praQuem.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 card-premium">
                    <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </div>
                ))}
              </div>
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

      {/* 10. Oferta — card com lista + preço + selos. Primeira aparição de preço/botão. */}
      <section
        id="oferta"
        className="section-padding bg-gradient-to-br from-[#0D2B5E] to-[#081d40] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
        <div className="container-premium relative">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-red-300 text-sm font-bold uppercase tracking-[0.2em] mb-4">
              Chega de decidir no escuro
            </p>
            <h2 className="heading-section text-white mb-10">
              O diagnóstico completo da sua operação — com o plano pronto pra
              corrigir.
            </h2>
            <div className="rounded-2xl bg-white text-left p-8 md:p-10 shadow-2xl">
              <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-[#0D2B5E] mb-2">
                Raio-X Comercial completo
              </p>
              <p className="text-center text-sm text-slate-500 mb-6">
                Tudo o que você precisa pra achar e fechar os vazamentos
              </p>
              <div className="space-y-3 mb-8">
                {ofertaItens.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-[#0D2B5E] flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
              <div className="text-center border-t border-slate-200 pt-8">
                <p className="text-slate-500 text-sm mb-1">De <span className="line-through">R$ 97</span> por apenas</p>
                <p className="text-6xl font-display font-bold text-[#0D2B5E] mb-1">R$ 37</p>
                <p className="text-slate-500 text-sm mb-6">Pagamento único · Seu pra sempre</p>
                <CheckoutLink>
                  <Button variant="hero" size="xl" className="w-full">
                    SIM! QUERO MEU RAIO-X AGORA
                    <ArrowRight className="ml-2" />
                  </Button>
                </CheckoutLink>
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-5 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Compra 100% segura</span>
                  <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Pix ou cartão</span>
                  <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Garantia de 7 dias</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 11. Pós-compra — como recebe */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="text-center mb-14">
            <h2 className="heading-section text-foreground">
              Seu acesso chega em minutos. Funciona assim:
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {posCompra.map((p, i) => (
              <div key={i} className="card-premium p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#0D2B5E]/10 flex items-center justify-center mx-auto mb-5">
                  <p.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground text-lg mb-3">{p.titulo}</h3>
                <p className="text-small">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 12. Garantia */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-2xl mx-auto">
            <div className="card-premium p-8 md:p-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                <Shield className="h-8 w-8 text-emerald-500" />
              </div>
              <h2 className="heading-card text-foreground text-2xl mb-4">O risco é todo meu.</h2>
              <p className="text-body text-lg">
                Faça o seu Raio-X. Use por 7 dias. Se você achar que não valeu
                cada centavo, é só pedir: devolvo 100% do seu dinheiro, sem
                pergunta nenhuma.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 13. Fechamento emocional — direto na ruminação */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-8">Me fala sem rodeios…</h2>
            <div className="space-y-4 text-lg text-body mb-10">
              <p>Todo fim de mês é a mesma coisa, né?</p>
              <p className="text-foreground font-medium italic">“Será que dessa vez a meta sai?”</p>
              <p>
                Você olha o funil e não sabe dizer onde a venda morre. Cobra o
                time e ouve desculpa. Entra na negociação e salva o mês — de novo.
              </p>
              <p>
                É por isso que o Raio-X Comercial existe: pra te mostrar{" "}
                <strong className="text-foreground">onde está o vazamento, na ordem certa de corrigir</strong>{" "}
                — e você parar de pagar caro pra descobrir por tentativa e erro.
              </p>
            </div>
            <CTA label="Fazer meu Raio-X Comercial agora" />
            <p className="text-sm text-muted-foreground mt-5">
              R$ 37 · Pagamento único · Acesso imediato · Garantia de 7 dias
            </p>
          </div>
        </div>
      </section>

      {/* 14. Autoridade — foto, só aqui embaixo */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-primary mb-10">
              Quem criou o Raio-X Comercial?
            </p>
            <div className="card-premium p-8 md:p-10 grid md:grid-cols-[auto_1fr] gap-8 items-center">
              <img
                src={fabricioMentor}
                alt="Fabrício Nunes"
                className="w-40 h-40 md:w-48 md:h-48 rounded-2xl object-cover mx-auto"
                loading="lazy"
              />
              <div className="text-center md:text-left">
                <h2 className="heading-card text-foreground text-2xl mb-4">Oi, eu sou o Fabrício Nunes.</h2>
                <p className="text-body mb-3">
                  Sou fundador da UNV — Universidade Nacional de Vendas, que atua
                  como diretoria comercial terceirizada de dezenas de empresas.
                  São mais de 20 anos vendendo e mais de R$ 1 bilhão em vendas
                  geradas na carreira.
                </p>
                <p className="text-body">
                  O Método dos Vazamentos Comerciais nasceu do padrão que eu vejo
                  todo dia dentro das operações: empresa boa, produto bom —
                  perdendo venda em pontos que o dono não enxerga. O Raio-X
                  existe pra você enxergar. Sem precisar aprender do jeito difícil.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">Perguntas Frequentes</h2>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="card-premium px-6">
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:text-primary py-5">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-body pb-5">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <div className="text-center mt-12">
              <CTA />
            </div>
          </div>
        </div>
      </section>

      {/* Footer legal */}
      <footer className="py-10 bg-[#081d40] text-center space-y-3">
        <p className="text-xs text-white/50">
          UNV Holdings — Universidade Nacional de Vendas
        </p>
        <p className="text-xs text-white/50">
          Dúvidas? <a href="mailto:acesso@unvholdings.com.br" className="underline">acesso@unvholdings.com.br</a>
        </p>
        <p className="text-[11px] text-white/35 max-w-2xl mx-auto px-4">
          Este site não é afiliado ao Facebook nem a qualquer entidade do
          Facebook. A compra deste material não garante nenhum tipo de
          resultado — os resultados dependem da aplicação no seu negócio.
        </p>
        <p className="text-[11px] text-white/35">
          © {new Date().getFullYear()} UNV Holdings. Todos os direitos reservados.
        </p>
      </footer>
    </main>
  );
}
