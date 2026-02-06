import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Paperclip, Upload, Trash2, FileText, FileImage, FileVideo, 
  FileSpreadsheet, File, Download, Loader2 
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface CardAttachmentsProps {
  cardId: string;
  disabled?: boolean;
}

const getFileIcon = (fileType: string | null) => {
  if (!fileType) return File;
  if (fileType.startsWith("image/")) return FileImage;
  if (fileType.startsWith("video/")) return FileVideo;
  if (fileType.includes("spreadsheet") || fileType.includes("excel") || fileType.includes("csv")) return FileSpreadsheet;
  if (fileType.includes("pdf") || fileType.includes("document") || fileType.includes("word")) return FileText;
  return File;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const CardAttachments = ({ cardId, disabled }: CardAttachmentsProps) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAttachments();
  }, [cardId]);

  const loadAttachments = async () => {
    try {
      const { data } = await supabase
        .from("social_card_attachments")
        .select("*")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false });
      setAttachments(data || []);
    } catch (error) {
      console.error("Error loading attachments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    // Get current staff id once before loop
    const { data: { user } } = await supabase.auth.getUser();
    let staffId = null;
    if (user) {
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.id)
        .single();
      staffId = staff?.id;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const file of Array.from(files)) {
      try {
        // Generate unique file path with UUID to avoid conflicts
        const uniqueId = crypto.randomUUID();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${cardId}/attachments/${uniqueId}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("social-content")
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error for file:", file.name, uploadError);
          errorCount++;
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("social-content")
          .getPublicUrl(fileName);

        const { data: attachment, error: insertError } = await supabase
          .from("social_card_attachments")
          .insert({
            card_id: cardId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: staffId,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Database insert error for file:", file.name, insertError);
          errorCount++;
          continue;
        }
        
        setAttachments((prev) => [attachment, ...prev]);
        successCount++;
      } catch (error) {
        console.error("Error uploading file:", file.name, error);
        errorCount++;
      }
    }
    
    if (successCount > 0) {
      toast.success(`${successCount} arquivo(s) anexado(s)!`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} arquivo(s) falharam ao anexar`);
    }
    
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    try {
      const { error } = await supabase
        .from("social_card_attachments")
        .delete()
        .eq("id", attachment.id);

      if (error) throw error;
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      toast.success("Anexo removido!");
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao remover anexo");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Upload Button */}
      {!disabled && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Enviando..." : "Anexar arquivo"}
          </Button>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">
          <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum anexo</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const FileIcon = getFileIcon(attachment.file_type);
            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.file_size)}
                    {" • "}
                    {formatDistanceToNow(new Date(attachment.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                  >
                    <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  {!disabled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(attachment)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Simple count badge for Kanban
export const AttachmentCountBadge = ({ cardId }: { cardId: string }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const loadCount = async () => {
      const { count: attachmentCount } = await supabase
        .from("social_card_attachments")
        .select("*", { count: "exact", head: true })
        .eq("card_id", cardId);
      setCount(attachmentCount || 0);
    };
    loadCount();
  }, [cardId]);

  if (count === 0) return null;

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Paperclip className="h-3 w-3" />
      {count}
    </span>
  );
};
