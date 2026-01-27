import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Bell, Star, Heart } from "lucide-react";

export function ThemePreview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Pré-visualização
        </CardTitle>
        <CardDescription>
          Veja como os elementos ficarão com as cores escolhidas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sample Card */}
        <div className="p-4 rounded-lg bg-card border border-border">
          <h4 className="font-semibold text-card-foreground mb-2">Exemplo de Cartão</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Este é um exemplo de como o conteúdo aparecerá dentro de um cartão.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Badge>Badge Padrão</Badge>
            <Badge variant="secondary">Secundário</Badge>
            <Badge variant="outline">Contorno</Badge>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Botões</p>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm">Primário</Button>
            <Button size="sm" variant="secondary">Secundário</Button>
            <Button size="sm" variant="outline">Contorno</Button>
            <Button size="sm" variant="ghost">Ghost</Button>
          </div>
        </div>

        {/* Icons with colors */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Ícones</p>
          <div className="flex gap-3 items-center">
            <Bell className="h-5 w-5 text-primary" />
            <Star className="h-5 w-5 text-accent" />
            <Heart className="h-5 w-5 text-destructive" />
            <span className="text-sm text-muted-foreground">Cores aplicadas aos ícones</span>
          </div>
        </div>

        {/* Muted section */}
        <div className="p-3 rounded-md bg-muted">
          <p className="text-sm text-muted-foreground">
            Área com fundo suave para conteúdo secundário
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
