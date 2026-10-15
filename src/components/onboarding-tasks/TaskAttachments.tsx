import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Upload, FileIcon, Trash2, Download, Paperclip, Eye, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  // Visualizar sem baixar: link assinado (bucket privado) aberto numa janela dentro do Nexus
  const [vendo, setVendo] = useState<{ doc: Document; url: string } | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  

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

        // Sanitize file name for storage path (remove accents, special chars, spaces)
        const sanitizeFileName = (name: string) => {
          return name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[^a-zA-Z0-9._-]/g, "_"); // Replace special chars with underscore
        };
        
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

  const tipoDe = (doc: Document) => {
    const t = (doc.file_type || "").toLowerCase();
    const ext = (doc.file_name.split(".").pop() || "").toLowerCase();
    if (t.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "imagem";
    if (t.includes("pdf") || ext === "pdf") return "pdf";
    if (t.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext)) return "video";
    if (t.startsWith("audio/") || ["mp3", "ogg", "wav", "m4a"].includes(ext)) return "audio";
    if (t.startsWith("text/") || ["txt", "csv"].includes(ext)) return "texto";
    if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext) || /word|excel|spreadsheet|presentation|powerpoint/.test(t)) return "office";
    return "outro";
  };

  const handleView = async (doc: Document) => {
    setAbrindo(doc.id);
    try {
      const { data, error } = await supabase.storage
        .from("onboarding-documents")
        .createSignedUrl(doc.file_path, 60 * 60);
      if (error || !data?.signedUrl) throw error || new Error("sem link");
      if (tipoDe(doc) === "outro") {
        window.open(data.signedUrl, "_blank", "noopener"); // tipo que o navegador não mostra: nova aba
      } else {
        setVendo({ doc, url: data.signedUrl });
      }
    } catch (error: any) {
      console.error("Error viewing:", error);
      toast.error("Não consegui abrir o arquivo");
    } finally {
      setAbrindo(null);
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
                    {doc.uploader && ` • ${doc.uploader.name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Visualizar"
                  onClick={() => handleView(doc)}
                  disabled={abrindo === doc.id}
                >
                  {abrindo === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  title="Baixar"
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

      <Dialog open={!!vendo} onOpenChange={(o) => !o && setVendo(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col gap-3 p-4">
          <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 pr-8">
            <DialogTitle className="truncate text-base">{vendo?.doc.file_name}</DialogTitle>
            <div className="flex shrink-0 gap-1">
              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => vendo && window.open(vendo.url, "_blank", "noopener")}>
                <ExternalLink className="h-3.5 w-3.5" />Nova aba
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => vendo && handleDownload(vendo.doc)}>
                <Download className="h-3.5 w-3.5" />Baixar
              </Button>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30">
            {vendo && (() => {
              const t = tipoDe(vendo.doc);
              if (t === "imagem") return <img src={vendo.url} alt={vendo.doc.file_name} className="mx-auto max-h-full max-w-full object-contain" />;
              if (t === "video") return <video src={vendo.url} controls className="mx-auto max-h-full max-w-full" />;
              if (t === "audio") return <div className="flex h-full items-center justify-center p-6"><audio src={vendo.url} controls className="w-full max-w-lg" /></div>;
              // Word/Excel/PowerPoint: visualizador do Google pelo link assinado (vale 1h)
              if (t === "office") return <iframe title={vendo.doc.file_name} className="h-full w-full" src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(vendo.url)}`} />;
              return <iframe title={vendo.doc.file_name} className="h-full w-full bg-white" src={vendo.url} />;
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
