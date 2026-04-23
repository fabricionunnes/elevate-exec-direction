import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Brain, Target, AlertTriangle, MessageSquare, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOOLS = [
  { icon: Brain, title: "Análise de candidatos", desc: "Avalia currículo, vídeo e respostas para gerar score de aderência à vaga." },
  { icon: Target, title: "Sugestão de PDI", desc: "Cruza perfil DISC + desempenho + cargo para recomendar plano de desenvolvimento." },
  { icon: TrendingUp, title: "Sugestão de promoções", desc: "Identifica colaboradores prontos para o próximo nível." },
  { icon: AlertTriangle, title: "Risco de turnover", desc: "Detecta colaboradores em risco com base em clima, performance e engajamento." },
  { icon: MessageSquare, title: "Geração de feedbacks", desc: "Sugere feedbacks estruturados a partir de dados de performance." },
  { icon: Sparkles, title: "Cruzamento estratégico", desc: "Análises preditivas de performance × comportamento × cultura." },
];

export default function UNVProfileAIPage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-6 h-6 text-primary" /> UNV IA</h1>
        <p className="text-sm text-muted-foreground">Inteligência artificial aplicada à gestão de pessoas</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((t, i) => (
          <Card key={i} className="hover:shadow-md transition border-primary/10">
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <t.icon className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-base">{t.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">{t.desc}</p>
              <Button size="sm" variant="outline" className="w-full">Em breve</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
