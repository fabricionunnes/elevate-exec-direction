import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  History, 
  CheckCircle2, 
  Calendar, 
  User,
  RotateCcw,
  Eye,
  RefreshCw,
  BookOpen
} from "lucide-react";
import { 
  useCultureManualVersions,
  useSetActiveVersion,
  usePublishVersion,
  useCultureAuditLog
} from "./useCultureManual";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CultureVersionsSectionProps {
  projectId: string;
  canEdit: boolean;
}

export function CultureVersionsSection({ projectId, canEdit }: CultureVersionsSectionProps) {
  const { data: versions, isLoading: loadingVersions } = useCultureManualVersions(projectId);
  const { data: auditLog, isLoading: loadingAudit } = useCultureAuditLog(projectId);
  const setActiveVersion = useSetActiveVersion(projectId);
  const publishVersion = usePublishVersion(projectId);

  const isLoading = loadingVersions || loadingAudit;

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      form_submitted: "Formulário preenchido",
      version_created: "Versão criada",
      section_edited: "Seção editada",
      version_published: "Versão publicada",
      version_activated: "Versão ativada",
      pdf_download: "PDF baixado",
      ai_generation: "Geração por IA",
    };
    return labels[action] || action;
  };

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Versions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Versões do Manual
          </CardTitle>
          <CardDescription>
            Gerencie as diferentes versões do manual de cultura
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!versions || versions.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Nenhuma versão criada ainda.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {versions.map((version) => (
                  <div 
                    key={version.id} 
                    className={`p-4 rounded-lg border ${
                      version.is_active ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">
                            Versão {version.version_number}
                          </h4>
                          {version.version_name && (
                            <span className="text-muted-foreground">
                              - {version.version_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(version.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {version.is_active && (
                          <Badge className="bg-blue-500">Ativa</Badge>
                        )}
                        {version.is_published && (
                          <Badge className="bg-green-500">Publicada</Badge>
                        )}
                        {version.generated_by_ai && (
                          <Badge variant="outline">IA</Badge>
                        )}
                      </div>
                    </div>

                    {version.notes && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {version.notes}
                      </p>
                    )}

                    {version.published_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Publicada em: {new Date(version.published_at).toLocaleDateString("pt-BR")}
                      </p>
                    )}

                    {canEdit && (
                      <div className="flex gap-2 mt-3">
                        {!version.is_active && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Restaurar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Restaurar versão?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Isso definirá a versão {version.version_number} como a versão ativa 
                                  para edição. A versão ativa atual será mantida no histórico.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => setActiveVersion.mutate(version.id)}
                                >
                                  Restaurar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {!version.is_published && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => publishVersion.mutate(version.id)}
                            disabled={publishVersion.isPending}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Publicar
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Ações
          </CardTitle>
          <CardDescription>
            Registro de todas as ações realizadas no manual
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!auditLog || auditLog.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Nenhuma ação registrada ainda.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {auditLog.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-start gap-3 p-3 rounded-lg border"
                  >
                    <div className="p-1.5 rounded-full bg-muted">
                      <CheckCircle2 className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {getActionLabel(log.action)}
                      </p>
                      {log.action_details && (
                        <p className="text-xs text-muted-foreground truncate">
                          {JSON.stringify(log.action_details)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(log.performed_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
