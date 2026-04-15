import { useState } from "react";
import { ServiceData } from "@/pages/ServiceSalesPage";
import { ChevronDown } from "lucide-react";

interface Props {
  service: ServiceData;
}

const defaultFAQ = [
  {
    q: "Como o acesso é liberado?",
    a: "Após a confirmação do pagamento (PIX instantâneo ou boleto em até 3 dias úteis), seu acesso é liberado automaticamente no sistema.",
  },
  {
    q: "Posso cancelar a assinatura?",
    a: "Sim, você pode solicitar o cancelamento a qualquer momento. O acesso permanece ativo até o final do período já pago.",
  },
  {
    q: "Quais formas de pagamento são aceitas?",
    a: "Aceitamos PIX (liberação imediata) e boleto bancário. Há 5% de desconto para pagamentos realizados antes do vencimento.",
  },
  {
    q: "Preciso ter uma conta no sistema?",
    a: "Não! Basta preencher seus dados e efetuar o pagamento. Se você já for nosso cliente, o módulo será adicionado automaticamente à sua conta.",
  },
  {
    q: "E se eu precisar de suporte?",
    a: "Nossa equipe está disponível para ajudar com qualquer dúvida sobre o módulo contratado. Você terá acesso a suporte dedicado.",
  },
];

export function ServiceSalesFAQ({ service }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const config = service.landing_page_config || {};
  const faq = config.faq || defaultFAQ;

  return (
    <section className="py-20 px-4 bg-[hsl(214,65%,15%)]">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
          Perguntas Frequentes
        </h2>
        <p className="text-white/50 text-center mb-12 text-lg">
          Tire suas dúvidas antes de contratar
        </p>

        <div className="space-y-3">
          {faq.map((item: any, index: number) => (
            <div
              key={index}
              className="rounded-xl border border-white/10 overflow-hidden bg-white/5"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-medium text-white pr-4">{item.q}</span>
                <ChevronDown
                  className={`h-5 w-5 text-white/40 flex-shrink-0 transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openIndex === index && (
                <div className="px-5 pb-5 text-white/60 text-sm leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
