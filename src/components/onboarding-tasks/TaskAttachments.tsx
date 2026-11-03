import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Upload, FileIcon, Trash2, Download, Paperclip, RefreshCw } from "lucide-react";
import { useVisualizarAnexo, BotaoVisualizar } from "@/components/anexos/VisualizarAnexo";

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
  uploaded_by: string | null;
  uploaded_by_staff_id?: string | null;
  uploader?: { name: string } | null;
  uploader_staff?: { name: string } | null;
}

interface TaskAttachmentsProps {
  taskId: string;
  companyId: string;
  projectId: string;
  isAdmin: boolean;
  /** staff logado (onboarding_staff.id): quem subiu o anexo pode excluir e substituir */
  currentStaffId?: string | null;
}

// Nome seguro pro Storage (sem acento, espaço ou caractere especial)
const sanitizeFileName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

export const TaskAttachments = ({ taskId, companyId, projectId, isAdmin, currentStaffId }: TaskAttachmentsProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [substituindo, setSubstituindo] = useState<string | null>(null);
  // Fabrício (03/11/2026): "se o consultor incluir um documento em alguma tarefa, ele mesmo tem que
  // poder excluir o documento e colocar um novo". Admin pode tudo; o staff só no que ele subiu.
  const podeMexer = (doc: Document) => isAdmin || (!!currentStaffId && doc.uploaded_by_staff_id === currentStaffId);
  // Visualizar sem baixar (mesma janela em todos os anexos do Nexus)
  const visor = useVisualizarAnexo();
  const handleView = (doc: Document) => visor.abrir({ nome: doc.file_name, tipo: doc.file_type, bucket: "onboarding-documents", path: doc.file_path });
  

  useEffect(() => {
    fetchDocuments();
  }, [taskId]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_documents")
        .select(`
          *,
          uploader:onboarding_users(name),
          uploader_staff:onboarding_staff!onboarding_documents_uploaded_by_staff_id_fkey(name)
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

  const triggerFileInput = () => {
    // Create a new input element each time to avoid issues with dialog context
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
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

        // Try to get onboarding user id first
        const { data: onboardingUser } = await supabase
          .from("onboarding_users")
          .select("id")
          .eq("user_id", user.id)
          .eq("project_id", projectId)
          .maybeSingle();

        // staff que está subindo (consultor/CS/admin): fica no anexo pra ele poder excluir e substituir
        const { data: staffRow } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        const sanitizedName = sanitizeFileName(file.name);
        const filePath = `${companyId}/tasks/${taskId}/${Date.now()}_${sanitizedName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("onboarding-documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Create document record (uploaded_by can be null for staff members)
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
            uploaded_by_staff_id: staffRow?.id || currentStaffId || null,
          });

        if (docError) throw docError;

        toast.success("Anexo adicionado");
        fetchDocuments();
      } catch (error: any) {
        console.error("Error uploading file:", error);
        toast.error("Erro ao fazer upload: " + (error.message || "Erro desconhecido"));
      } finally {
        setUploading(false);
      }
      // Clean up
      document.body.removeChild(input);
    };
    document.body.appendChild(input);
    input.click();
  };

  // Substituir: troca o arquivo do MESMO anexo (novo arquivo no Storage, registro atualizado, antigo apagado)
  const triggerSubstituir = (doc: Document) => {
    if (!podeMexer(doc)) {
      toast.error("Só quem anexou (ou um administrador) pode substituir este anexo");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) { document.body.removeChild(input); return; }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande (máx. 10MB)");
        document.body.removeChild(input);
        return;
      }
      setSubstituindo(doc.id);
      try {
        const novoPath = `${companyId}/tasks/${taskId}/${Date.now()}_${sanitizeFileName(file.name)}`;
        const { error: upErr } = await supabase.storage.from("onboarding-documents").upload(novoPath, file);
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase
          .from("onboarding_documents")
          .update({
            file_name: file.name,
            file_path: novoPath,
            file_size: file.size,
            file_type: file.type,
            uploaded_by_staff_id: currentStaffId || doc.uploaded_by_staff_id || null,
          })
          .eq("id", doc.id);
        if (dbErr) {
          await supabase.storage.from("onboarding-documents").remove([novoPath]);
          throw dbErr;
        }
        await supabase.storage.from("onboarding-documents").remove([doc.file_path]);
        toast.success("Anexo substituído");
        fetchDocuments();
      } catch (error: any) {
        console.error("Error replacing file:", error);
        toast.error("Erro ao substituir: " + (error.message || "Erro desconhecido"));
      } finally {
        setSubstituindo(null);
        document.body.removeChild(input);
      }
    };
    document.body.appendChild(input);
    input.click();
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
    if (!podeMexer(doc)) {
      toast.error("Só quem anexou (ou um administrador) pode excluir este anexo");
      return;
    }
    if (!confirm(`Excluir o anexo "${doc.file_name}"?`)) return;

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
        <Button
          variant="outline"
          size="sm"
          onClick={triggerFileInput}
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
                  <button type="button" className="block max-w-full text-left text-sm font-medium truncate hover:underline" onClick={() => handleView(doc)} title="Visualizar">
                    {doc.file_name}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.file_size)}
                    {(doc.uploader_staff?.name || doc.uploader?.name) && ` • ${doc.uploader_staff?.name || doc.uploader?.name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <BotaoVisualizar onClick={() => handleView(doc)} carregando={visor.abrindo === doc.file_path} />
                <Button
                  title="Baixar"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {podeMexer(doc) && (
                  <>
                    <Button
                      title="Substituir por outro arquivo"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={substituindo === doc.id}
                      onClick={() => triggerSubstituir(doc)}
                    >
                      {substituindo === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                    <Button
                      title="Excluir"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(doc)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {visor.janela}
    </div>
  );
};
