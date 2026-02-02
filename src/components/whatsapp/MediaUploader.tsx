import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { 
  ImageIcon, 
  Video, 
  Trash2, 
  Loader2,
  Upload,
  X
} from "lucide-react";
import { toast } from "sonner";

interface MediaUploaderProps {
  mediaType: "image" | "video" | null;
  mediaUrl: string | null;
  onMediaChange: (type: "image" | "video" | null, url: string | null) => void;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16MB

export function MediaUploader({ mediaType, mediaUrl, onMediaChange }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File, type: "image" | "video") => {
    const maxSize = type === "image" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    
    if (file.size > maxSize) {
      toast.error(`Arquivo muito grande. Máximo: ${type === "image" ? "5MB" : "16MB"}`);
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
      toast.success(`${type === "image" ? "Imagem" : "Vídeo"} carregado com sucesso!`);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (mediaUrl) {
      // Try to delete from storage (optional, may fail if already deleted)
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file, "image");
    }
    e.target.value = "";
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file, "video");
    }
    e.target.value = "";
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
            {mediaType === "image" ? (
              <ImageIcon className="h-4 w-4 text-blue-500" />
            ) : (
              <Video className="h-4 w-4 text-purple-500" />
            )}
            <span className="text-sm font-medium">
              {mediaType === "image" ? "Imagem" : "Vídeo"} anexado
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
          {mediaType === "image" ? (
            <img
              src={mediaUrl}
              alt="Preview"
              className="max-h-48 w-auto mx-auto object-contain"
            />
          ) : (
            <video
              src={mediaUrl}
              controls
              className="max-h-48 w-full"
            />
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Anexar Mídia (opcional)</Label>
      <div className="flex gap-2">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleImageSelect}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/3gpp,video/quicktime"
          className="hidden"
          onChange={handleVideoSelect}
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
      </div>
      <p className="text-xs text-muted-foreground">
        Imagem: JPG, PNG, WebP, GIF (máx 5MB) | Vídeo: MP4, 3GP, MOV (máx 16MB)
      </p>
    </div>
  );
}
