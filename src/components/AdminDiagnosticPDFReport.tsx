import { useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle, Target, Lightbulb, Sparkles, Building2, TrendingUp } from "lucide-react";
import logoUnv from "@/assets/logo-unv.png";

interface DiagnosticData {
  id: string;
  created_at: string;
  company_name: string;
  contact_name: string;
  whatsapp: string;
  email: string | null;
  revenue: string;
  team_size: string;
  main_pain: string;
  has_sales_process: boolean;
  biggest_challenge: string | null;
  urgency: string;
  recommended_product: string | null;
  why_diagnostic: string | null;
}

interface AdminDiagnosticPDFReportProps {
  diagnostic: DiagnosticData;
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

export default function AdminDiagnosticPDFReport({ diagnostic }: AdminDiagnosticPDFReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const diagnosticDate = new Date(diagnostic.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  const pains = diagnostic.main_pain.split(',').map(p => p.trim());

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

    pdf.save(`Diagnostico_UNV_${diagnostic.company_name.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Botão de Download */}
      <Button
        onClick={generatePDF}
        size="sm"
        className="gap-2 w-full"
        variant="outline"
      >
        <Download className="h-4 w-4" />
        Baixar Relatório PDF
      </Button>

      {/* Relatório para impressão (oculto visualmente mas renderizado) */}
      <div 
        ref={reportRef} 
        className="absolute left-[-9999px] bg-[#0f172a] text-white p-8 md:p-12 rounded-2xl overflow-hidden"
        style={{ width: "800px" }}
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
            <p className="text-sm text-gray-400">Data do diagnóstico</p>
            <p className="text-sm font-medium text-white">{diagnosticDate}</p>
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
              <p className="font-semibold text-white">{diagnostic.company_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Responsável</p>
              <p className="font-semibold text-white">{diagnostic.contact_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Faturamento</p>
              <p className="font-semibold text-white">{revenueLabels[diagnostic.revenue] || diagnostic.revenue}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Equipe Comercial</p>
              <p className="font-semibold text-white">{teamLabels[diagnostic.team_size] || diagnostic.team_size}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">WhatsApp</p>
              <p className="font-semibold text-white">{diagnostic.whatsapp}</p>
            </div>
            {diagnostic.email && (
              <div>
                <p className="text-xs text-gray-400 mb-1">E-mail</p>
                <p className="font-semibold text-white">{diagnostic.email}</p>
              </div>
            )}
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
              {pains.map((pain) => (
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
              <p className="font-medium text-white">{urgencyLabels[diagnostic.urgency] || diagnostic.urgency}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Processo Comercial</p>
              <p className="font-medium text-white">{diagnostic.has_sales_process ? "Sim, possui" : "Não possui"}</p>
            </div>
          </div>

          {diagnostic.why_diagnostic && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-1">Motivação do Diagnóstico</p>
              <p className="text-sm text-gray-300 italic">"{diagnostic.why_diagnostic}"</p>
            </div>
          )}

          {diagnostic.biggest_challenge && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-1">Maior Desafio</p>
              <p className="text-sm text-gray-300">"{diagnostic.biggest_challenge}"</p>
            </div>
          )}
        </div>

        {/* Produto Recomendado */}
        {diagnostic.recommended_product && (
          <div className="bg-[#C41E3A]/10 rounded-xl p-6 mb-8 border-2 border-[#C41E3A]">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-6 w-6 text-[#C41E3A]" />
              <h2 className="text-xl font-bold text-white">Serviço Recomendado</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-4 py-2 bg-[#C41E3A] text-white font-bold rounded-lg text-lg">
                {diagnostic.recommended_product}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              Este serviço foi selecionado com base no seu perfil, faturamento, tamanho de equipe e desafios identificados.
            </p>
          </div>
        )}

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
            <span className="text-gray-400">Contato:</span>
            <span className="text-white font-medium">{diagnostic.whatsapp}</span>
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
            Relatório gerado a partir do diagnóstico realizado em {diagnosticDate}.
          </p>
        </div>
      </div>
    </div>
  );
}
