import { useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, CheckCircle, Target, Lightbulb, Sparkles, Building2, User, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import logoUnv from "@/assets/logo-unv.png";
import { productDetails } from "@/data/productDetails";

interface ProductRecommendation {
  id: string;
  name: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  price: string;
  priceType: string;
  description: string;
  deliverables: string[];
  bestFor: string;
  whyRecommended: string;
}

interface FormData {
  companyName: string;
  contactName: string;
  whatsapp: string;
  email: string;
  revenue: string;
  teamSize: string;
  hasSalesProcess: boolean;
  pains: string[];
  biggestChallenge: string;
  urgency: string;
  goals: string;
  hasTraffic: string;
  trafficSatisfied: string;
  hasSocialMedia: string;
  socialSatisfied: string;
  whyDiagnostic: string;
}

interface DiagnosticPDFReportProps {
  formData: FormData;
  recommendations: ProductRecommendation[];
}

const revenueLabels: Record<string, string> = {
  "menos-50k": "Menos de R$ 50k/mês",
  "50k-100k": "R$ 50k a R$ 100k/mês",
  "100k-200k": "R$ 100k a R$ 200k/mês",
  "200k-500k": "R$ 200k a R$ 500k/mês",
  "500k-1m": "R$ 500k a R$ 1M/mês",
  "acima-1m": "Acima de R$ 1M/mês",
};

const teamLabels: Record<string, string> = {
  "sozinho": "Vende sozinho",
  "1-3": "1 a 3 vendedores",
  "4-10": "4 a 10 vendedores",
  "11-20": "11 a 20 vendedores",
  "20+": "Mais de 20 vendedores",
};

const painLabels: Record<string, string> = {
  "sem-processo": "Sem processo comercial definido",
  "inconsistencia": "Vendas inconsistentes mês a mês",
  "time-desalinhado": "Time desalinhado ou sem padrão",
  "poucos-leads": "Poucos leads qualificados",
  "conversao-baixa": "Baixa conversão de propostas",
  "escala": "Dificuldade em escalar vendas",
  "lideranca-fraca": "Líderes não cobram ou desenvolvem",
  "autoridade": "Falta de autoridade no mercado",
  "sem-diretor-comercial": "Sem diretor comercial ou gestor",
  "rotatividade-time": "Alta rotatividade ou dificuldade de contratar",
  "sem-clareza-financeira": "Sem clareza financeira",
  "sobrecarga-decisao": "Peso da solidão e sobrecarga de decisões",
  "atendimento-lento": "Atendimento lento ou time não dá conta",
};

const urgencyLabels: Record<string, string> = {
  "imediata": "Imediata",
  "alta": "Nos próximos 30 dias",
  "normal": "Nos próximos 90 dias",
  "exploratoria": "Exploratório",
};

export default function DiagnosticPDFReport({ formData, recommendations }: DiagnosticPDFReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  const generatePDF = async () => {
    if (!reportRef.current) return;

    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#0f172a"
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`Diagnostico_UNV_${formData.companyName.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Botão de Download */}
      <div className="flex justify-center">
        <Button
          onClick={generatePDF}
          size="lg"
          className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
        >
          <Download className="h-5 w-5" />
          Baixar Relatório em PDF
        </Button>
      </div>

      {/* Relatório para impressão com scroll */}
      <ScrollArea className="h-[70vh] rounded-2xl">
        <div 
          ref={reportRef} 
          className="bg-[#0f172a] text-white p-8 md:p-12 rounded-2xl"
          style={{ minWidth: "800px" }}
        >
        {/* Header do Relatório */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-8">
          <div className="flex items-center gap-4">
            <img src={logoUnv} alt="UNV" className="h-12" />
            <div className="border-l border-white/20 pl-4">
              <h1 className="text-xl font-bold text-white">Relatório de Diagnóstico</h1>
              <p className="text-sm text-gray-400">Análise Comercial Personalizada</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Gerado em</p>
            <p className="text-sm font-medium text-white">{today}</p>
          </div>
        </div>

        {/* Dados da Empresa */}
        <div className="bg-white/5 rounded-xl p-6 mb-8 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-[#C41E3A]" />
            <h2 className="text-lg font-bold text-white">Dados da Empresa</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Empresa</p>
              <p className="font-semibold text-white">{formData.companyName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Responsável</p>
              <p className="font-semibold text-white">{formData.contactName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Faturamento</p>
              <p className="font-semibold text-white">{revenueLabels[formData.revenue] || formData.revenue}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Equipe Comercial</p>
              <p className="font-semibold text-white">{teamLabels[formData.teamSize] || formData.teamSize}</p>
            </div>
          </div>
        </div>

        {/* Diagnóstico */}
        <div className="bg-white/5 rounded-xl p-6 mb-8 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-[#C41E3A]" />
            <h2 className="text-lg font-bold text-white">Diagnóstico Identificado</h2>
          </div>
          
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">Desafios Principais</p>
            <div className="flex flex-wrap gap-2">
              {formData.pains.map((pain) => (
                <span
                  key={pain}
                  className="px-3 py-1.5 bg-[#C41E3A]/20 text-[#C41E3A] text-sm rounded-lg border border-[#C41E3A]/30"
                >
                  {painLabels[pain] || pain}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Urgência</p>
              <p className="font-medium text-white">{urgencyLabels[formData.urgency] || formData.urgency}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Processo Comercial</p>
              <p className="font-medium text-white">{formData.hasSalesProcess ? "Sim, possui" : "Não possui"}</p>
            </div>
          </div>

          {formData.whyDiagnostic && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-1">Motivação do Diagnóstico</p>
              <p className="text-sm text-gray-300 italic">"{formData.whyDiagnostic}"</p>
            </div>
          )}
        </div>

        {/* Título Recomendações */}
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="h-6 w-6 text-[#C41E3A]" />
          <h2 className="text-xl font-bold text-white">Produtos Recomendados para Você</h2>
        </div>

        {/* Lista de Produtos Recomendados */}
        <div className="space-y-6">
          {recommendations.map((rec, index) => {
            const Icon = rec.icon;
            const details = productDetails[rec.id];
            return (
              <div
                key={rec.id}
                className={cn(
                  "rounded-xl p-6 border-2",
                  index === 0 
                    ? "bg-[#C41E3A]/10 border-[#C41E3A]" 
                    : "bg-white/5 border-white/10"
                )}
              >
                {/* Header do Produto */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                    index === 0 ? "bg-[#C41E3A]" : "bg-white/10"
                  )}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {index === 0 && (
                        <span className="px-2 py-0.5 bg-[#C41E3A] text-white text-xs font-bold rounded">
                          PRINCIPAL
                        </span>
                      )}
                      <h3 className="text-lg font-bold text-white">{rec.name}</h3>
                    </div>
                    <p className="text-sm text-gray-400">{rec.tagline}</p>
                  </div>
                </div>

                {/* Por que este produto */}
                <div className="bg-white/5 rounded-lg p-4 mb-4 border border-white/10">
                  <p className="text-sm text-gray-300">
                    <span className="font-semibold text-white">Por que este serviço para você?</span>
                    <br />
                    <span className="text-gray-400">{rec.whyRecommended}</span>
                  </p>
                </div>

                {/* O que resolve */}
                {details && details.problemsSolved && details.problemsSolved.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-[#C41E3A]" />
                      O QUE ESTE PRODUTO VAI RESOLVER
                    </p>
                    <div className="space-y-2">
                      {details.problemsSolved.slice(0, 3).map((item, i) => (
                        <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/5">
                          <p className="text-xs text-red-400 mb-1">❌ {item.problem}</p>
                          <p className="text-xs text-emerald-400">✓ {item.result}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Entregáveis e Ideal Para */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2">O QUE VOCÊ RECEBE</p>
                    <ul className="space-y-1">
                      {rec.deliverables.slice(0, 4).map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                          <CheckCircle className="h-3 w-3 text-[#C41E3A] shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                      {rec.deliverables.length > 4 && (
                        <li className="text-xs text-gray-500 pl-5">
                          +{rec.deliverables.length - 4} mais...
                        </li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2">IDEAL PARA</p>
                    <p className="text-xs text-gray-300">{rec.bestFor}</p>
                    
                    {details?.timeToResults && (
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <p className="text-xs text-gray-400">
                          ⏱️ {details.timeToResults}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Próximos Passos */}
        <div className="mt-8 bg-gradient-to-r from-[#C41E3A]/20 to-transparent rounded-xl p-6 border border-[#C41E3A]/30">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="h-5 w-5 text-[#C41E3A]" />
            <h3 className="text-lg font-bold text-white">Próximos Passos</h3>
          </div>
          <p className="text-sm text-gray-300 mb-4">
            Nossa equipe entrará em contato pelo WhatsApp para agendar sua reunião de diagnóstico 
            aprofundado. Nessa conversa, vamos entender melhor seu cenário e definir juntos o melhor caminho.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">WhatsApp:</span>
            <span className="text-white font-medium">{formData.whatsapp}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoUnv} alt="UNV" className="h-8 opacity-60" />
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} UNV. Todos os direitos reservados.
            </p>
          </div>
          <p className="text-xs text-gray-500">
            Este relatório foi gerado automaticamente com base nas suas respostas.
          </p>
        </div>
      </div>
      </ScrollArea>
    </div>
  );
}
