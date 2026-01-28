import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Edit3, 
  Sparkles, 
  Save, 
  Lock,
  Unlock,
  RefreshCw,
  Plus,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { 
  useActiveManualVersion,
  useManualSections,
  useCreateManualVersion,
  useUpdateSection,
  useCultureFormResponses
} from "./useCultureManual";
import { supabase } from "@/integrations/supabase/client";
import { MANUAL_SECTIONS } from "./types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RichTextarea } from "@/components/ui/rich-textarea";

interface CultureEditorSectionProps {
  projectId: string;
  canEdit: boolean;
}

export function CultureEditorSection({ projectId, canEdit }: CultureEditorSectionProps) {
  const { data: activeVersion, isLoading: loadingVersion } = useActiveManualVersion(projectId);
  const { data: sections, isLoading: loadingSections } = useManualSections(activeVersion?.id);
  const { data: responses } = useCultureFormResponses(projectId);
  const createVersion = useCreateManualVersion(projectId);
  const updateSection = useUpdateSection();
  
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);

  const hasResponses = responses && responses.length > 0;
  const latestResponse = responses?.[0];

  const handleGenerateWithAI = async () => {
    if (!hasResponses) {
      toast.error("É necessário ter pelo menos uma resposta do formulário para gerar o manual");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("culture-manual-ai", {
        body: {
          action: "generate_full_manual",
          projectId,
          formResponse: latestResponse,
        },
      });

      if (error) throw error;

      // Create new version with AI-generated content
      const version = await createVersion.mutateAsync({
        versionName: "Gerado por IA",
        generatedByAi: true,
      });

      // IMPORTANT: After creating a new version, we must update the *new version's* section rows,
      // not the sections from the previously active version.
      if (data.sections && version) {
        const { data: newVersionSections, error: newSectionsError } = await supabase
          .from("culture_manual_sections")
          .select("id, section_key")
          .eq("version_id", version.id);

        if (newSectionsError) throw newSectionsError;

        for (const section of data.sections) {
          const dbSection = newVersionSections?.find((s) => s.section_key === section.key);
          if (dbSection && section.content) {
            await updateSection.mutateAsync({
              sectionId: dbSection.id,
              content: section.content,
              versionId: version.id,
            });
          }
        }
      }

      toast.success("Manual gerado com sucesso pela IA!");
    } catch (error: any) {
      console.error("Error generating manual:", error);
      toast.error("Erro ao gerar manual: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateSection = async (sectionKey: string) => {
    if (!activeVersion || !latestResponse) return;

    setGeneratingSection(sectionKey);
    try {
      const { data, error } = await supabase.functions.invoke("culture-manual-ai", {
        body: {
          action: "regenerate_section",
          projectId,
          sectionKey,
          formResponse: latestResponse,
        },
      });

      if (error) throw error;

      const dbSection = sections?.find(s => s.section_key === sectionKey);
      if (dbSection && data.content) {
        await updateSection.mutateAsync({
          sectionId: dbSection.id,
          content: data.content,
          versionId: activeVersion.id,
        });
      }

      toast.success("Seção regenerada com sucesso!");
    } catch (error: any) {
      console.error("Error regenerating section:", error);
      toast.error("Erro ao regenerar seção: " + error.message);
    } finally {
      setGeneratingSection(null);
    }
  };

  const handleStartEdit = (sectionId: string, content: string) => {
    setEditingSection(sectionId);
    setEditContent(content || "");
  };

  const handleSaveEdit = async () => {
    if (!editingSection || !activeVersion) return;

    await updateSection.mutateAsync({
      sectionId: editingSection,
      content: editContent,
      versionId: activeVersion.id,
    });

    setEditingSection(null);
    setEditContent("");
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditContent("");
  };

  if (loadingVersion || loadingSections) {
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

  if (!activeVersion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Editor do Manual
          </CardTitle>
          <CardDescription>
            Crie e edite o conteúdo do manual de cultura
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">
              Nenhuma versão do manual foi criada ainda.
            </p>
            
            {!hasResponses && (
              <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg mb-4">
                <p className="text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  É necessário ter pelo menos uma resposta do formulário para gerar o manual com IA.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-center">
              <Button 
                onClick={handleGenerateWithAI}
                disabled={!canEdit || isGenerating || !hasResponses}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Gerando com IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar Manual com IA
                  </>
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={() => createVersion.mutate({ versionName: "Manual em Branco" })}
                disabled={!canEdit || createVersion.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Manual em Branco
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5" />
                Editor do Manual
              </CardTitle>
              <CardDescription>
                Versão {activeVersion.version_number}
                {activeVersion.version_name && ` - ${activeVersion.version_name}`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {activeVersion.generated_by_ai && (
                <Badge variant="outline">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Gerado por IA
                </Badge>
              )}
              <Button 
                variant="outline"
                size="sm"
                onClick={handleGenerateWithAI}
                disabled={!canEdit || isGenerating || !hasResponses}
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Regenerar Tudo
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Accordion type="single" collapsible className="space-y-2">
        {MANUAL_SECTIONS.map((sectionDef) => {
          const section = sections?.find(s => s.section_key === sectionDef.key);
          const isEditing = editingSection === section?.id;
          const isRegenerating = generatingSection === sectionDef.key;

          return (
            <AccordionItem 
              key={sectionDef.key} 
              value={sectionDef.key}
              className="border rounded-lg"
            >
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{sectionDef.order + 1}.</span>
                  <span>{sectionDef.title}</span>
                  {section?.is_locked && (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                  {section?.section_content ? (
                    <Badge variant="secondary" className="ml-2">Preenchido</Badge>
                  ) : (
                    <Badge variant="outline" className="ml-2">Vazio</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <RichTextarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={10}
                      placeholder="Digite o conteúdo da seção..."
                    />
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleSaveEdit}
                        disabled={updateSection.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salvar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleCancelEdit}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {section?.section_content ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <div className="whitespace-pre-wrap text-sm">
                          {section.section_content}
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm italic">
                        Nenhum conteúdo nesta seção ainda.
                      </p>
                    )}
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleStartEdit(section?.id || "", section?.section_content || "")}
                        disabled={!canEdit || section?.is_locked}
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRegenerateSection(sectionDef.key)}
                        disabled={!canEdit || isRegenerating || !hasResponses}
                      >
                        {isRegenerating ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Regenerar com IA
                      </Button>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
