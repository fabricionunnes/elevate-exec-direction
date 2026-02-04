import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { FileText, Download, Trash2, Upload, Eye, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CandidateResume } from "../types";

interface CandidateResumesManagerProps {
  candidateId: string;
  projectId: string;
  resumes: CandidateResume[];
  canManage: boolean;
  onUpdate: () => void;
}

export function CandidateResumesManager({
  candidateId,
  projectId,
  resumes,
  canManage,
  onUpdate,
}: CandidateResumesManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("resumes")
        .download(fileUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handleView = async (fileUrl: string) => {
    try {
      // Check if fileUrl is already a full URL (from public bucket)
      if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
        window.open(fileUrl, "_blank");
        return;
      }

      // Otherwise, create a signed URL for the file path
      const { data, error } = await supabase.storage
        .from("resumes")
        .createSignedUrl(fileUrl, 3600);

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Error viewing file:", error);
      toast.error("Erro ao visualizar arquivo");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato inválido. Use PDF ou DOC/DOCX");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      const fileExt = file.name.split(".").pop();
      const filePath = `${projectId}/${candidateId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("candidate_resumes").insert({
        candidate_id: candidateId,
        file_name: file.name,
        file_url: filePath,
        file_type: fileExt,
        file_size: file.size,
        is_primary: resumes.length === 0,
        uploaded_by_staff_id: staff?.id || null,
      });

      if (insertError) throw insertError;

      toast.success("Currículo enviado com sucesso!");
      onUpdate();
    } catch (error: any) {
      console.error("Error uploading resume:", error);
      toast.error(error.message || "Erro ao enviar currículo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (resume: CandidateResume) => {
    setDeletingId(resume.id);
    try {
      // Delete from storage
      await supabase.storage.from("resumes").remove([resume.file_url]);

      // Delete from database
      const { error } = await supabase
        .from("candidate_resumes")
        .delete()
        .eq("id", resume.id);

      if (error) throw error;

      toast.success("Currículo excluído com sucesso!");
      onUpdate();
    } catch (error: any) {
      console.error("Error deleting resume:", error);
      toast.error(error.message || "Erro ao excluir currículo");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Currículos ({resumes.length})
        </h4>
        {canManage && (
          <label>
            <Button variant="outline" size="sm" disabled={uploading} asChild>
              <span className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Enviando..." : "Adicionar"}
              </span>
            </Button>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
        )}
      </div>

      {resumes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum currículo enviado
        </p>
      ) : (
        <div className="space-y-2">
          {resumes.map((resume) => (
            <Card key={resume.id} className="p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{resume.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {resume.file_size && <span>{formatFileSize(resume.file_size)}</span>}
                    <span>•</span>
                    <span>{format(new Date(resume.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                    {resume.is_primary && (
                      <Badge variant="secondary" className="text-xs">Principal</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleView(resume.file_url)}
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(resume.file_url, resume.file_name)}
                    title="Baixar"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canManage && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={deletingId === resume.id}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir currículo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O arquivo será removido permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(resume)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
