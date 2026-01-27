import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera, Video, X, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaFile {
  url: string;
  type: "image" | "video";
  file?: File;
}

interface MediaUploadProps {
  media: MediaFile[];
  onMediaChange: (media: MediaFile[]) => void;
  maxFiles?: number;
  folder: string;
  disabled?: boolean;
}

export function MediaUpload({
  media,
  onMediaChange,
  maxFiles = 4,
  folder,
  disabled = false,
}: MediaUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxFiles - media.length;
    if (remainingSlots <= 0) {
      toast({ title: `Máximo de ${maxFiles} arquivos permitidos`, variant: "destructive" });
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    try {
      const newMedia: MediaFile[] = [];

      for (const file of filesToProcess) {
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");

        if (!isVideo && !isImage) {
          toast({ title: "Formato não suportado. Use imagens ou vídeos.", variant: "destructive" });
          continue;
        }

        // Size limits
        const maxSize = isVideo ? 50 : 10; // 50MB for video, 10MB for image
        if (file.size > maxSize * 1024 * 1024) {
          toast({ 
            title: `${isVideo ? "Vídeo" : "Imagem"} deve ter no máximo ${maxSize}MB`, 
            variant: "destructive" 
          });
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("circle-media")
          .upload(fileName, file, { upsert: true });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast({ title: "Erro ao fazer upload", variant: "destructive" });
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("circle-media")
          .getPublicUrl(fileName);

        newMedia.push({
          url: publicUrl,
          type: isVideo ? "video" : "image",
        });
      }

      if (newMedia.length > 0) {
        onMediaChange([...media, ...newMedia]);
      }
    } catch (error) {
      console.error("Media upload error:", error);
      toast({ title: "Erro ao fazer upload", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeMedia = (index: number) => {
    const newMedia = [...media];
    newMedia.splice(index, 1);
    onMediaChange(newMedia);
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />

      {/* Preview Grid */}
      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {media.map((item, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
              {item.type === "image" ? (
                <img
                  src={item.url}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={item.url}
                  className="w-full h-full object-cover"
                  muted
                />
              )}
              <button
                type="button"
                onClick={() => removeMedia(index)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              {item.type === "video" && (
                <div className="absolute bottom-1 left-1 px-2 py-0.5 rounded bg-black/50 text-white text-xs">
                  <Video className="h-3 w-3 inline mr-1" />
                  Vídeo
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {media.length < maxFiles && (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Fotos ou Vídeos ({media.length}/{maxFiles})
            </>
          )}
        </Button>
      )}
    </div>
  );
}
