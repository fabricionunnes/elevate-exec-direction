import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Upload, FileIcon, Trash2, Download, Paperclip } from "lucide-react";

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
  uploaded_by: string | null;
  uploader?: { name: string } | null;
}

interface TaskAttachmentsProps {
  taskId: string;
  companyId: string;
  projectId: string;
  isAdmin: boolean;
}

export const TaskAttachments = ({ taskId, companyId, projectId, isAdmin }: TaskAttachmentsProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, [taskId]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_documents")
        .select(`
          *,
          uploader:onboarding_users(name)
        `)
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 10MB)");
      return;
    }

    setUploading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get onboarding user id
      const { data: onboardingUser } = await supabase
        .from("onboarding_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .single();

      const filePath = `${companyId}/tasks/${taskId}/${Date.now()}_${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("onboarding-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { error: docError } = await supabase
        .from("onboarding_documents")
        .insert({
          company_id: companyId,
          project_id: projectId,
          task_id: taskId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: onboardingUser?.id || null,
        });

      if (docError) throw docError;

      toast.success("Anexo adicionado");
      fetchDocuments();
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao fazer upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from("onboarding-documents")
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem excluir anexos");
      return;
    }

    try {
      // Delete from storage
      await supabase.storage
        .from("onboarding-documents")
        .remove([doc.file_path]);

      // Delete record
      const { error } = await supabase
        .from("onboarding_documents")
        .delete()
        .eq("id", doc.id);

      if (error) throw error;

      toast.success("Anexo removido");
      fetchDocuments();
    } catch (error: any) {
      console.error("Error deleting:", error);
      toast.error("Erro ao excluir anexo");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string | null) => {
    if (type?.startsWith("image/")) return "🖼️";
    if (type?.includes("pdf")) return "📄";
    if (type?.includes("word") || type?.includes("document")) return "📝";
    if (type?.includes("excel") || type?.includes("spreadsheet")) return "📊";
    return "📎";
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando anexos...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4" />
          Anexos ({documents.length})
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" />
                Anexar
              </>
            )}
          </Button>
        </div>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum anexo</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-md group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-lg">{getFileIcon(doc.file_type)}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.file_size)}
                    {doc.uploader && ` • ${doc.uploader.name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(doc)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
