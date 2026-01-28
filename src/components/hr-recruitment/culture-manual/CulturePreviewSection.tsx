import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, FileText, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { 
  useActiveManualVersion,
  usePublishedManualVersion,
  useManualSections,
  usePublishVersion
} from "./useCultureManual";
import { MANUAL_SECTIONS } from "./types";

interface CulturePreviewSectionProps {
  projectId: string;
  readOnly?: boolean;
}

export function CulturePreviewSection({ projectId, readOnly }: CulturePreviewSectionProps) {
  const { data: activeVersion, isLoading: loadingActive } = useActiveManualVersion(projectId);
  const { data: publishedVersion, isLoading: loadingPublished } = usePublishedManualVersion(projectId);
  const publishVersion = usePublishVersion(projectId);
  
  // Use published version for clients, active version for staff
  const versionToShow = readOnly ? publishedVersion : activeVersion;
  const { data: sections, isLoading: loadingSections } = useManualSections(versionToShow?.id);

  const isLoading = loadingActive || loadingPublished || loadingSections;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!versionToShow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Pré-visualização do Manual
          </CardTitle>
          <CardDescription>
            {readOnly 
              ? "O manual de cultura ainda não foi publicado" 
              : "Visualize como o manual ficará para os colaboradores"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {readOnly 
                ? "Aguarde a publicação do manual de cultura pela equipe." 
                : "Nenhuma versão ativa do manual. Crie uma versão no Editor."
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedSections = sections?.sort((a, b) => a.sort_order - b.sort_order) || [];
  const hasContent = sortedSections.some(s => s.section_content);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Pré-visualização do Manual
              </CardTitle>
              <CardDescription>
                Versão {versionToShow.version_number}
                {versionToShow.version_name && ` - ${versionToShow.version_name}`}
              </CardDescription>
            </div>
            {!readOnly && (
              <div className="flex gap-2">
                {versionToShow.is_published ? (
                  <Badge className="bg-green-500">Publicado</Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => publishVersion.mutate(versionToShow.id)}
                    disabled={publishVersion.isPending || !hasContent}
                  >
                    {publishVersion.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Publicar Manual
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Preview Container - Simulates PDF */}
      <Card className="overflow-hidden">
        <div 
          className="relative bg-white text-gray-900"
          style={{
            minHeight: "800px",
          }}
        >
          {/* Left stripe decoration */}
          <div className="absolute left-0 top-0 bottom-0 w-2" 
            style={{ backgroundColor: versionToShow.primary_color || "#1e3a5f" }} 
          />
          <div className="absolute left-2 top-0 bottom-0 w-1" 
            style={{ backgroundColor: versionToShow.secondary_color || "#c41e3a" }} 
          />

          <ScrollArea className="h-[800px]">
            <div className="p-8 pl-12">
              {/* Cover Section */}
              <div className="text-center mb-12 pb-8 border-b">
                {versionToShow.company_logo_url && (
                  <img 
                    src={versionToShow.company_logo_url} 
                    alt="Logo" 
                    className="h-24 mx-auto mb-6 object-contain"
                  />
                )}
                <h1 
                  className="text-4xl font-bold mb-2"
                  style={{ color: versionToShow.primary_color || "#1e3a5f" }}
                >
                  Manual de Cultura
                </h1>
                <p className="text-gray-500">{new Date().getFullYear()}</p>
              </div>

              {/* Table of Contents */}
              <div className="mb-12">
                <h2 
                  className="text-2xl font-bold mb-4"
                  style={{ color: versionToShow.primary_color || "#1e3a5f" }}
                >
                  Sumário
                </h2>
                <div className="space-y-2">
                  {sortedSections
                    .filter(s => s.section_content)
                    .map((section, index) => (
                      <div key={section.id} className="flex items-center gap-2">
                        <span className="text-gray-500">{index + 1}.</span>
                        <span>{section.section_title}</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Content Sections */}
              {sortedSections.map((section) => {
                if (!section.section_content) return null;

                return (
                  <div key={section.id} className="mb-12">
                    <h2 
                      className="text-2xl font-bold mb-4 pb-2 border-b-2"
                      style={{ 
                        color: versionToShow.primary_color || "#1e3a5f",
                        borderColor: versionToShow.secondary_color || "#c41e3a"
                      }}
                    >
                      {section.section_title}
                    </h2>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{section.section_content}</ReactMarkdown>
                    </div>
                  </div>
                );
              })}

              {/* Footer */}
              <div className="mt-12 pt-4 border-t text-center text-sm text-gray-500">
                <p>Manual de Cultura – Documento Interno</p>
                <p>{new Date().getFullYear()}</p>
              </div>
            </div>
          </ScrollArea>
        </div>
      </Card>
    </div>
  );
}
