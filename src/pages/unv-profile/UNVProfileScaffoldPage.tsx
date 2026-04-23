import { Card, CardContent } from "@/components/ui/card";
import { Construction, Sparkles } from "lucide-react";
import { ReactNode } from "react";

interface Props { title: string; description: string; icon?: any; children?: ReactNode }

export default function UNVProfileScaffoldPage({ title, description, icon: Icon = Construction, children }: Props) {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Icon className="w-6 h-6 text-primary" /> {title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children || (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Módulo em construção</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              A estrutura de banco de dados deste módulo já está pronta com isolamento por tenant. A interface completa será evoluída nas próximas iterações.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
