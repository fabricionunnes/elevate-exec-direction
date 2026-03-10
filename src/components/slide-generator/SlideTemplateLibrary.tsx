import { Presentation, ArrowRight, Target, Users, BarChart3, MessageCircle, Award, Zap, TrendingUp, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  onSelect: (topic: string) => void;
}

const TEMPLATES = [
  {
    title: "Treinamento de Vendedores",
    description: "Formação completa para equipes comerciais com técnicas, frameworks e exercícios práticos",
    icon: Target,
    color: "#C81E1E",
  },
  {
    title: "Gestão Comercial",
    description: "Estruturação da área comercial com processos, métricas e gestão de equipes",
    icon: BarChart3,
    color: "#0A1931",
  },
  {
    title: "Liderança Comercial",
    description: "Desenvolvimento de líderes de vendas com foco em resultados e gestão de pessoas",
    icon: Award,
    color: "#7C3AED",
  },
  {
    title: "Negociação Avançada",
    description: "Técnicas avançadas de negociação para fechamentos de alto valor",
    icon: MessageCircle,
    color: "#059669",
  },
  {
    title: "Funil de Vendas",
    description: "Construção e otimização do funil comercial com métricas de conversão",
    icon: TrendingUp,
    color: "#2563EB",
  },
  {
    title: "Atendimento ao Cliente",
    description: "Excelência no atendimento como diferencial competitivo e retenção",
    icon: Users,
    color: "#D97706",
  },
  {
    title: "Estratégia Comercial",
    description: "Planejamento estratégico comercial com metas, posicionamento e expansão",
    icon: Briefcase,
    color: "#0F766E",
  },
  {
    title: "Prospecção e Qualificação",
    description: "Métodos de prospecção ativa e qualificação de leads para vendas B2B",
    icon: Zap,
    color: "#DC2626",
  },
];

export function SlideTemplateLibrary({ onSelect }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Presentation className="h-5 w-5 text-primary" />
          Modelos de Apresentação
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha um modelo e personalize com IA
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <Card
              key={template.title}
              className="group hover:shadow-lg transition-all cursor-pointer border-border/50 hover:border-primary/30"
              onClick={() => onSelect(template.title)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${template.color}15` }}
                  >
                    <Icon className="h-6 w-6" style={{ color: template.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">{template.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-4 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Usar Modelo <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
