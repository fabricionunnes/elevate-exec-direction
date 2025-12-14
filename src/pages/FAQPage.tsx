import { Layout } from "@/components/layout/Layout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const faqs = [
  { question: "Isso é um curso?", answer: "Não. UNV não é uma plataforma educacional. Atuamos como seu Diretor Comercial: estruturamos sua operação de vendas, treinamos seu time na execução prática, monitoramos o progresso e cobramos resultados. Não há módulos, certificados ou aulas gravadas. Isso é direção, não educação." },
  { question: "Vocês vendem por mim?", answer: "Não. A UNV fornece direção—definimos o que precisa ser feito, treinamos seu time em como fazer e cobramos pela execução. Seu time faz as vendas. Garantimos que façam com método e consistência." },
  { question: "Posso esperar resultados no primeiro mês?", answer: "Nossos programas são desenhados para quick wins no primeiro mês através de implementação prática de scripts, sistemas de follow-up e estrutura básica de pipeline. São metas operacionais baseadas em melhoria de execução. Impacto em receita varia conforme qualidade de execução do time e condições de mercado." },
  { question: "Payback em 3 meses é garantido?", answer: "Não. Payback até o terceiro mês é uma projeção baseada em melhorias operacionais, não uma garantia. Resultados dependem de múltiplos fatores incluindo execução do time, condições de mercado, qualidade de leads e seu produto/serviço. A UNV fornece direção e cobrança; o cliente executa." },
  { question: "Como funciona a Experiência Mansão?", answer: "A Experiência Mansão é um encontro presencial exclusivo para membros UNV Partners. Recebe até 5 convidados cuidadosamente selecionados por mês para discussões estratégicas em ambiente intimista. Todos os custos (viagem, hospedagem, atividades) são responsabilidade do cliente. Entrada apenas por convite e seleção." },
  { question: "Preciso de um CRM para trabalhar com a UNV?", answer: "Não necessariamente. Embora ter um CRM ajude na visibilidade do pipeline, podemos começar com ferramentas simples. Durante o programa, ajudaremos a definir que nível de ferramentas faz sentido para seu estágio e implementar de acordo." },
  { question: "Quanto tempo dura cada programa?", answer: "Varia por produto. UNV Core é implementação única. UNV Control é recorrente mensal/anual. Sales Acceleration é programa de 12 meses. Growth Room é imersão de 3 dias com acompanhamento de 90 dias. Partners é membership contínuo. Sales Ops é mensal por usuário." },
  { question: "Qual produto devo escolher?", answer: "Depende do seu estágio, tamanho do time e desafio principal. Use nossa ferramenta de diagnóstico em /for-closers para uma recomendação personalizada, ou aplique para um diagnóstico e nossa equipe vai guiá-lo para o melhor fit." },
];

export default function FAQPage() {
  return (
    <Layout>
      <section className="section-padding bg-secondary"><div className="container-premium"><div className="max-w-3xl mx-auto text-center"><h1 className="heading-display text-foreground mb-6">Perguntas Frequentes</h1><p className="text-body text-lg">Perguntas comuns sobre nossa abordagem, produtos e o que esperar ao trabalhar com a UNV.</p></div></div></section>
      <section className="section-padding bg-background"><div className="container-premium"><div className="max-w-3xl mx-auto"><Accordion type="single" collapsible className="space-y-4">{faqs.map((faq, i) => <AccordionItem key={i} value={`item-${i}`} className="card-premium px-6"><AccordionTrigger className="text-left font-semibold text-foreground hover:text-accent py-6">{faq.question}</AccordionTrigger><AccordionContent className="text-body pb-6">{faq.answer}</AccordionContent></AccordionItem>)}</Accordion></div></div></section>
      <section className="section-padding bg-secondary"><div className="container-premium"><div className="card-premium p-8 lg:p-12 text-center max-w-3xl mx-auto"><h2 className="heading-card text-foreground mb-4">Ainda tem dúvidas?</h2><p className="text-body mb-6">Aplique para um diagnóstico e nossa equipe responderá qualquer pergunta específica sobre sua situação.</p><div className="flex flex-col sm:flex-row gap-4 justify-center"><Link to="/apply"><Button variant="premium" size="lg">Aplicar para Diagnóstico</Button></Link><a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer"><Button variant="premium-outline" size="lg">WhatsApp</Button></a></div></div></div></section>
    </Layout>
  );
}
