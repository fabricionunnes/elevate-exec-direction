import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Route, ClipboardCheck, FileText, BookOpen, Trophy, Users, Award } from "lucide-react";

const MODULES = [
  { name: "Trilhas de Desenvolvimento", desc: "Crie novas trilhas com categorias personalizadas", icon: Route, status: "Ativo", path: "/pdi/tracks" },
  { name: "Tarefas e Leituras", desc: "Gerencie tipos de tarefas e atividades", icon: FileText, status: "Ativo", path: "/pdi/tasks" },
  { name: "Biblioteca de Livros", desc: "Adicione livros e associe a trilhas", icon: BookOpen, status: "Ativo", path: "/pdi/library" },
  { name: "Testes de Avaliação", desc: "Configure testes de entrada e saída", icon: ClipboardCheck, status: "Ativo", path: "/pdi/assessments" },
  { name: "Relatórios de Evolução", desc: "Visualize e exporte relatórios", icon: Route, status: "Ativo", path: "/pdi/reports" },
  { name: "Certificados", desc: "Gere certificados automatizados", icon: Award, status: "Ativo", path: "/pdi/certificates" },
  { name: "Ranking", desc: "Ranking de desempenho dos participantes", icon: Trophy, status: "Ativo", path: "/pdi/ranking" },
  { name: "Comunidade", desc: "Fórum de discussões entre participantes", icon: Users, status: "Ativo", path: "/pdi/community" },
];

export default function PDISettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações do PDI</h1>
        <p className="text-sm text-muted-foreground">Personalize módulos e funcionalidades</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />Módulos Disponíveis
          </CardTitle>
          <CardDescription>Todos os módulos do PDI estão ativos e prontos para uso.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODULES.map((mod) => (
              <div key={mod.name} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <mod.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-foreground">{mod.name}</h3>
                  <p className="text-xs text-muted-foreground">{mod.desc}</p>
                </div>
                <Badge variant="default" className="text-[10px]">{mod.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Critérios de Pontuação</CardTitle>
          <CardDescription>Como os pontos do ranking são calculados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Tarefa concluída</span><span className="font-medium">+10 pontos</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Nota IA (por ponto)</span><span className="font-medium">+5 pontos</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Evolução positiva (por %)</span><span className="font-medium">+1 ponto</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
