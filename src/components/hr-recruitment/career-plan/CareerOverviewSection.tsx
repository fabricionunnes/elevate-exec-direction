import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, GitBranch, Target, Award } from "lucide-react";
import type { CareerPlanVersion, CareerTrack } from "./types";

interface Props {
  versions: CareerPlanVersion[];
  activeVersion: CareerPlanVersion | null;
  tracks: CareerTrack[];
}

export function CareerOverviewSection({ versions, activeVersion, tracks }: Props) {
  const totalRoles = tracks.reduce((acc, t) => acc + (t.roles?.length || 0), 0);
  const verticalTracks = tracks.filter(t => t.track_type === "vertical").length;
  const horizontalTracks = tracks.filter(t => t.track_type === "horizontal").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{versions.length}</p>
                <p className="text-sm text-muted-foreground">Versões</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <GitBranch className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{verticalTracks}</p>
                <p className="text-sm text-muted-foreground">Trilhas Verticais</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Award className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{horizontalTracks}</p>
                <p className="text-sm text-muted-foreground">Trilhas Horizontais</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRoles}</p>
                <p className="text-sm text-muted-foreground">Cargos Mapeados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {activeVersion ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Versão Ativa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Versão</p>
                <p className="font-medium">v{activeVersion.version_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Nome</p>
                <p className="font-medium">{activeVersion.version_name || "Sem nome"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gerado por IA</p>
                <p className="font-medium">{activeVersion.generated_by_ai ? "Sim" : "Não"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Publicado</p>
                <p className="font-medium">{activeVersion.is_published ? "Sim" : "Não"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum Plano de Carreira criado</h3>
            <p className="text-muted-foreground">
              Comece preenchendo o formulário estratégico ou crie uma versão manualmente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
