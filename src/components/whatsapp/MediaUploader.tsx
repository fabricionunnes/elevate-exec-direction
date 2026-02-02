import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { 
  ImageIcon, 
  Video, 
  Trash2, 
  Loader2,
  Mic,
  FileText
} from "lucide-react";
import { toast } from "sonner";

interface MediaUploaderProps {
  mediaType: "image" | "video" | "audio" | "document" | null;
  mediaUrl: string | null;
  onMediaChange: (type: "image" | "video" | "audio" | "document" | null, url: string | null) => void;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16MB
const MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16MB
const MAX_DOCUMENT_SIZE = 100 * 1024 * 1024; // 100MB

export function MediaUploader({ mediaType, mediaUrl, onMediaChange }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const getMaxSize = (type: "image" | "video" | "audio" | "document") => {
    switch (type) {
      case "image": return MAX_IMAGE_SIZE;
      case "video": return MAX_VIDEO_SIZE;
      case "audio": return MAX_AUDIO_SIZE;
      case "document": return MAX_DOCUMENT_SIZE;
    }
  };

  const getMaxSizeLabel = (type: "image" | "video" | "audio" | "document") => {
    switch (type) {
      case "image": return "5MB";
      case "video": return "16MB";
      case "audio": return "16MB";
      case "document": return "100MB";
    }
  };

  const handleUpload = async (file: File, type: "image" | "video" | "audio" | "document") => {
    const maxSize = getMaxSize(type);
    
    if (file.size > maxSize) {
      toast.error(`Arquivo muito grande. Máximo: ${getMaxSizeLabel(type)}`);
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop() || "bin";
      const fileName = `bulk-campaign/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("whatsapp-media")
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("whatsapp-media")
        .getPublicUrl(fileName);

      onMediaChange(type, urlData.publicUrl);
      
      const typeLabels = {
        image: "Imagem",
        video: "Vídeo",
        audio: "Áudio",
        document: "Arquivo"
      };
      toast.success(`${typeLabels[type]} carregado com sucesso!`);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (mediaUrl) {
      try {
        const path = mediaUrl.split("/whatsapp-media/")[1];
        if (path) {
          await supabase.storage.from("whatsapp-media").remove([path]);
        }
      } catch (e) {
        // Ignore deletion errors
      }
    }
    onMediaChange(null, null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video" | "audio" | "document") => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file, type);
    }
    e.target.value = "";
  };

  const getMediaIcon = () => {
    switch (mediaType) {
      case "image": return <ImageIcon className="h-4 w-4 text-blue-500" />;
      case "video": return <Video className="h-4 w-4 text-purple-500" />;
      case "audio": return <Mic className="h-4 w-4 text-green-500" />;
      case "document": return <FileText className="h-4 w-4 text-orange-500" />;
      default: return null;
    }
  };

  const getMediaLabel = () => {
    switch (mediaType) {
      case "image": return "Imagem";
      case "video": return "Vídeo";
      case "audio": return "Áudio";
      case "document": return "Arquivo";
      default: return "";
    }
  };

  if (uploading) {
    return (
      <Card className="p-4 flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Fazendo upload...</span>
      </Card>
    );
  }

  if (mediaUrl && mediaType) {
    return (
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getMediaIcon()}
            <span className="text-sm font-medium">
              {getMediaLabel()} anexado
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remover
          </Button>
        </div>

        <div className="rounded-lg overflow-hidden bg-muted">
          {mediaType === "image" && (
            <img
              src={mediaUrl}
              alt="Preview"
              className="max-h-48 w-auto mx-auto object-contain"
            />
          )}
          {mediaType === "video" && (
            <video
              src={mediaUrl}
              controls
              className="max-h-48 w-full"
            />
          )}
          {mediaType === "audio" && (
            <div className="p-4">
              <audio src={mediaUrl} controls className="w-full" />
            </div>
          )}
          {mediaType === "document" && (
            <div className="p-4 flex items-center gap-2">
              <FileText className="h-8 w-8 text-orange-500" />
              <a 
                href={mediaUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline truncate"
              >
                {mediaUrl.split("/").pop()}
              </a>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Anexar Mídia (opcional)</Label>
      <div className="grid grid-cols-2 gap-2">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => handleFileSelect(e, "image")}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/3gpp,video/quicktime"
          className="hidden"
          onChange={(e) => handleFileSelect(e, "video")}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/ogg,audio/mp4,audio/mpeg,audio/amr,audio/aac"
          className="hidden"
          onChange={(e) => handleFileSelect(e, "audio")}
        />
        <input
          ref={documentInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
          className="hidden"
          onChange={(e) => handleFileSelect(e, "document")}
        />
        
        <Button
          type="button"
          variant="outline"
          onClick={() => imageInputRef.current?.click()}
          className="flex-1"
        >
          <ImageIcon className="h-4 w-4 mr-2" />
          Imagem
        </Button>
        
        <Button
          type="button"
          variant="outline"
          onClick={() => videoInputRef.current?.click()}
          className="flex-1"
        >
          <Video className="h-4 w-4 mr-2" />
          Vídeo
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => audioInputRef.current?.click()}
          className="flex-1"
        >
          <Mic className="h-4 w-4 mr-2" />
          Áudio
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => documentInputRef.current?.click()}
          className="flex-1"
        >
          <FileText className="h-4 w-4 mr-2" />
          Arquivo
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Imagem: JPG, PNG, WebP, GIF (máx 5MB) | Vídeo: MP4, 3GP, MOV (máx 16MB) | Áudio: OGG, MP3, AAC (máx 16MB) | Arquivo: PDF, DOC, XLS, etc (máx 100MB)
      </p>
    </div>
  );
}
