import { ServiceData } from "@/pages/ServiceSalesPage";

interface Props {
  service: ServiceData;
}

const steps = [
  {
    number: "01",
    title: "Preencha seus dados",
    description: "Informe seus dados básicos para gerar a cobrança.",
  },
  {
    number: "02",
    title: "Efetue o pagamento",
    description: "Pague via PIX ou boleto bancário com desconto de 5% para pagamento antecipado.",
  },
  {
    number: "03",
    title: "Acesso liberado",
    description: "Após a confirmação do pagamento, seu acesso é liberado automaticamente.",
  },
];

export function ServiceSalesHowItWorks({ service }: Props) {
  return (
    <section className="py-20 px-4 bg-[hsl(214,65%,15%)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
          Como funciona
        </h2>
        <p className="text-white/50 text-center mb-14 text-lg">
          Em 3 passos simples você já começa a usar
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(355,85%,50%)]/10 border border-[hsl(355,85%,50%)]/20 mb-5">
                <span className="text-2xl font-bold text-[hsl(355,85%,50%)]">{step.number}</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
