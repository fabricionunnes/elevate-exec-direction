import { Layout } from "@/components/layout/Layout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const faqCategories = [
  {
    category: "Sobre a UNV",
    faqs: [
      { 
        question: "Isso é um curso?", 
        answer: "Não. UNV não é uma plataforma educacional. Atuamos como seu Diretor Comercial: estruturamos sua operação de vendas, treinamos seu time na execução prática, monitoramos o progresso e cobramos resultados. Não há módulos, certificados ou aulas gravadas. Isso é direção, não educação." 
      },
      { 
        question: "Vocês vendem por mim?", 
        answer: "Depende do produto. A maioria dos produtos UNV fornece direção—definimos o que precisa ser feito, treinamos seu time em como fazer e cobramos pela execução. Porém, o UNV Sales Force é exceção: nele, operamos diretamente como SDR e/ou Closer para sua empresa." 
      },
      { 
        question: "Qual a diferença entre UNV e uma consultoria tradicional?", 
        answer: "Consultorias entregam relatórios e recomendações. A UNV entrega direção contínua com cobrança de execução. Não fazemos diagnóstico e vamos embora—ficamos junto, ajustamos a rota e garantimos que o time execute o que foi definido." 
      },
      { 
        question: "Posso esperar resultados no primeiro mês?", 
        answer: "Nossos programas são desenhados para quick wins no primeiro mês através de implementação prática de scripts, sistemas de follow-up e estrutura básica de pipeline. São metas operacionais baseadas em melhoria de execução. Impacto em receita varia conforme qualidade de execução do time e condições de mercado." 
      },
      { 
        question: "Payback em 3 meses é garantido?", 
        answer: "Não. Payback até o terceiro mês é uma projeção baseada em melhorias operacionais, não uma garantia. Resultados dependem de múltiplos fatores incluindo execução do time, condições de mercado, qualidade de leads e seu produto/serviço. A UNV fornece direção e cobrança; o cliente executa." 
      },
    ]
  },
  {
    category: "Trilha Principal",
    faqs: [
      { 
        question: "Qual a diferença entre Core, Control e Sales Acceleration?", 
        answer: "UNV Core (R$ 1.997) é o diagnóstico inicial e estruturação básica. UNV Control é a direção comercial recorrente com acompanhamento semanal. Sales Acceleration é o programa completo de 12 meses com rituais, treinamentos e headhunting. É uma progressão natural: Core → Control → Sales Acceleration." 
      },
      { 
        question: "Preciso fazer o Core antes de entrar no Control?", 
        answer: "O Core é recomendado como ponto de entrada para empresas que ainda não têm estrutura comercial definida. Empresas que já possuem processo comercial estruturado podem entrar diretamente no Control ou Sales Acceleration após diagnóstico." 
      },
      { 
        question: "Quanto tempo dura cada programa?", 
        answer: "UNV Core é implementação única (valor único de R$ 1.997). UNV Control é recorrente mensal/anual. Sales Acceleration é programa de 12 meses. Growth Room é imersão de 2 dias. Partners é R$ 30.000/ano. Sales Ops é R$ 12.000/ano." 
      },
    ]
  },
  {
    category: "Trilha Avançada",
    faqs: [
      { 
        question: "O que é o UNV Growth Room?", 
        answer: "É uma imersão estratégica de 2 dias focada em decisões de crescimento. Não é curso nem treinamento—é um encontro para clareza estratégica com entregáveis concretos. Investimento de R$ 3.997 por evento, com vagas limitadas e curadoria obrigatória." 
      },
      { 
        question: "Como funciona o UNV Partners?", 
        answer: "UNV Partners (R$ 30.000/ano) é o nível premium da trilha de aceleração. Inclui todas as funcionalidades do Sales Acceleration com entrega superior, abrangendo rituais, diagnósticos, playbooks, treinamentos e headhunting. Exige aplicação obrigatória e possui vagas limitadas." 
      },
      { 
        question: "Como funciona a Experiência Mansão?", 
        answer: "A Experiência Mansão é um encontro presencial exclusivo para membros UNV Partners. Recebe até 5 convidados cuidadosamente selecionados por mês para discussões estratégicas em ambiente intimista. Todos os custos (viagem, hospedagem, atividades) são responsabilidade do cliente. Entrada apenas por convite e seleção." 
      },
      { 
        question: "O que é o UNV Mastermind?", 
        answer: "É o grupo mais exclusivo da UNV para empresários com faturamento acima de R$ 500k/mês. Encontros mensais com troca de alto nível, acesso direto à liderança UNV e networking estratégico. Entrada apenas por aplicação e aprovação." 
      },
    ]
  },
  {
    category: "Operação Comercial",
    faqs: [
      { 
        question: "O que é o UNV Sales Ops?", 
        answer: "UNV Sales Ops (R$ 12.000/ano) foca em padronização e treinamento do time comercial. Inclui treinamentos quinzenais segmentados por nível (SDR, Closer, Gestor), suporte diário via AI Advisor (agente de IA) e acompanhamento mensal em grupo." 
      },
      { 
        question: "O que é o UNV Sales Force?", 
        answer: "UNV Sales Force (R$ 6.000/mês + comissão) é execução direta: a UNV opera como SDR e/ou Closer para sua empresa. Diferente dos outros produtos que fornecem direção, no Sales Force nós executamos as vendas. Exige critérios de entrada: 200+ leads/mês, tráfego pago ativo, oferta validada." 
      },
      { 
        question: "O que é o UNV Sales System?", 
        answer: "UNV Sales System é uma infraestrutura de vendas com IA: CRM inteligente + Agentes Autônomos (SDR, Atendimento, Social Setter). Atende B2B e B2C, com prospecção automatizada exclusiva para B2B. Mensalidades de R$ 297 a R$ 9.997 + implementação." 
      },
      { 
        question: "Qual a diferença entre Sales Force e Sales System?", 
        answer: "Sales Force são pessoas (equipe UNV) executando vendas por você. Sales System é tecnologia (agentes de IA) automatizando partes do processo. Sales Force exige volume de leads; Sales System exige estrutura para implementar IA." 
      },
      { 
        question: "Preciso de um CRM para trabalhar com a UNV?", 
        answer: "Não necessariamente. Embora ter um CRM ajude na visibilidade do pipeline, podemos começar com ferramentas simples. Com o UNV Sales System, você recebe um CRM inteligente incluso. Nos outros produtos, ajudamos a definir que nível de ferramentas faz sentido para seu estágio." 
      },
    ]
  },
  {
    category: "Marketing e Tráfego",
    faqs: [
      { 
        question: "O que é o UNV Ads?", 
        answer: "Gestão de tráfego pago (Meta, Google, LinkedIn) com foco em geração de demanda qualificada. Tiers baseados no investimento: R$ 1.800 (até 10k investidos), R$ 2.500 (até 20k), R$ 4.000 (até 50k) e % acima de 50k." 
      },
      { 
        question: "O que é o UNV Social?", 
        answer: "Gestão estratégica de redes sociais focada em posicionamento de autoridade e geração de demanda orgânica. A partir de R$ 1.500/mês, inclui estratégia de conteúdo, produção e gestão de canais." 
      },
    ]
  },
  {
    category: "Estratégia e Estrutura",
    faqs: [
      { 
        question: "O que é o UNV People?", 
        answer: "Gestão estratégica de pessoas com duas frentes: Hiring (recrutamento) por R$ 4.000 (operacional) ou R$ 8.000 (liderança/estratégico) com garantia de 90 dias; e Gestão Recorrente por R$ 2.500 a R$ 6.000/mês dependendo do número de colaboradores." 
      },
      { 
        question: "O que é o UNV Finance?", 
        answer: "Controle financeiro estratégico (não é contabilidade). Para empresários que faturam bem mas não sabem onde ganham ou perdem dinheiro. Entrega: DRE gerencial, fluxo de caixa, margem por produto, projeções de 90 dias. Investimento de R$ 3.000/mês." 
      },
      { 
        question: "O que é o UNV Safe?", 
        answer: "Jurídico preventivo terceirizado: contratos, compliance, LGPD, análise de risco. Não é contencioso pesado. Investimento de R$ 3.000/mês para empresas que crescem rápido e precisam de suporte jurídico estruturado." 
      },
      { 
        question: "O que é o Le Désir?", 
        answer: "Posicionamento estratégico de marca e autoridade pessoal do empresário. Trabalha a percepção de valor e o desejo do mercado pela sua marca. Investimento de R$ 2.000/mês." 
      },
    ]
  },
  {
    category: "Escolha e Diagnóstico",
    faqs: [
      { 
        question: "Qual produto devo escolher?", 
        answer: "Depende do seu estágio, tamanho do time e desafio principal. Use nossa ferramenta de diagnóstico em /diagnostico para uma recomendação personalizada, ou aplique para uma conversa com nossa equipe." 
      },
      { 
        question: "Posso combinar mais de um produto?", 
        answer: "Sim, e é comum. Muitos clientes combinam Control (direção) + Ads (demanda) + Sales Ops (treinamento). Ou Sales Acceleration + People (contratação). O diagnóstico ajuda a definir a combinação ideal para seu momento." 
      },
      { 
        question: "Como funciona o processo de entrada?", 
        answer: "1) Você aplica pelo site ou WhatsApp. 2) Passamos por um diagnóstico para entender seu cenário. 3) Recomendamos o produto ou combinação ideal. 4) Você decide se quer seguir. Não há pressão—buscamos fit, não volume." 
      },
    ]
  },
];

export default function FAQPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="heading-display text-foreground mb-6">Perguntas Frequentes</h1>
            <p className="text-body text-lg">
              Perguntas comuns sobre nossa abordagem, produtos e o que esperar ao trabalhar com a UNV.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto space-y-12">
            {faqCategories.map((category, catIndex) => (
              <div key={catIndex}>
                <h2 className="text-xl font-bold text-foreground mb-6 pb-2 border-b border-border/50">
                  {category.category}
                </h2>
                <Accordion type="single" collapsible className="space-y-3">
                  {category.faqs.map((faq, faqIndex) => (
                    <AccordionItem 
                      key={faqIndex} 
                      value={`cat-${catIndex}-item-${faqIndex}`} 
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
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="card-premium p-8 lg:p-12 text-center max-w-3xl mx-auto">
            <h2 className="heading-card text-foreground mb-4">Ainda tem dúvidas?</h2>
            <p className="text-body mb-6">
              Aplique para um diagnóstico e nossa equipe responderá qualquer pergunta específica sobre sua situação.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/apply">
                <Button variant="premium" size="lg">Aplicar para Diagnóstico</Button>
              </Link>
              <Link to="/pricing">
                <Button variant="outline" size="lg">Ver Preços</Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Contato (WhatsApp): <span className="text-foreground font-medium">(31) 99912-0003</span>
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
