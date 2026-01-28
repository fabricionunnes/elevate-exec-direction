import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  FileText, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertCircle 
} from "lucide-react";
import { 
  useCultureFormLink, 
  useCultureFormResponses, 
  useCultureManualVersions,
  useActiveManualVersion,
  usePublishedManualVersion 
} from "./useCultureManual";

interface CultureOverviewSectionProps {
  projectId: string;
}

export function CultureOverviewSection({ projectId }: CultureOverviewSectionProps) {
  const { data: formLink } = useCultureFormLink(projectId);
  const { data: responses } = useCultureFormResponses(projectId);
  const { data: versions } = useCultureManualVersions(projectId);
  const { data: activeVersion } = useActiveManualVersion(projectId);
  const { data: publishedVersion } = usePublishedManualVersion(projectId);

  const hasFormLink = !!formLink?.is_active;
  const hasResponses = responses && responses.length > 0;
  const hasVersions = versions && versions.length > 0;
  const isPublished = !!publishedVersion;

  const getStatusIcon = (completed: boolean) => {
    return completed ? (
      <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
      <Clock className="h-5 w-5 text-amber-500" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <BookOpen className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{versions?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Versões</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <FileText className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{responses?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Respostas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {isPublished ? "Sim" : "Não"}
                </p>
                <p className="text-sm text-muted-foreground">Publicado</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                {hasFormLink ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {hasFormLink ? "Ativo" : "Pendente"}
                </p>
                <p className="text-sm text-muted-foreground">Link Formulário</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Criação do Manual de Cultura</CardTitle>
          <CardDescription>
            Siga os passos abaixo para criar e publicar o manual de cultura da empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
              {getStatusIcon(hasFormLink)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">1. Criar Link do Formulário</h4>
                  {hasFormLink && <Badge variant="secondary">Concluído</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Gere um link público para o empresário responder o formulário estratégico
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
              {getStatusIcon(!!hasResponses)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">2. Aguardar Respostas</h4>
                  {hasResponses && <Badge variant="secondary">Concluído</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  O empresário preenche o formulário com informações sobre a cultura da empresa
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
              {getStatusIcon(hasVersions)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">3. Gerar Manual com IA</h4>
                  {hasVersions && <Badge variant="secondary">Concluído</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  A IA transforma as respostas em um manual de cultura completo e profissional
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
              {getStatusIcon(false)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">4. Revisar e Editar</h4>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Revise o conteúdo gerado e faça ajustes manuais se necessário
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
              {getStatusIcon(isPublished)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">5. Publicar Manual</h4>
                  {isPublished && <Badge variant="secondary">Concluído</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Publique o manual para que colaboradores possam visualizar e baixar o PDF
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Version Info */}
      {activeVersion && (
        <Card>
          <CardHeader>
            <CardTitle>Versão Ativa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  Versão {activeVersion.version_number}
                  {activeVersion.version_name && ` - ${activeVersion.version_name}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  Criada em {new Date(activeVersion.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex gap-2">
                {activeVersion.generated_by_ai && (
                  <Badge variant="outline">Gerado por IA</Badge>
                )}
                {activeVersion.is_published && (
                  <Badge className="bg-green-500">Publicado</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
