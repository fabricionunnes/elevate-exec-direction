import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Paperclip, Image, Video, Mic, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MediaUploadButtonProps {
  onUpload: (file: File, type: "image" | "video" | "audio" | "document") => Promise<void>;
  disabled?: boolean;
}

export function MediaUploadButton({ onUpload, disabled }: MediaUploadButtonProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentType, setCurrentType] = useState<"image" | "video" | "audio" | "document">("image");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 16MB for WhatsApp)
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 16MB");
      return;
    }

    setUploading(true);
    try {
      await onUpload(file, currentType);
      setOpen(false);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const triggerFileInput = (type: "image" | "video" | "audio" | "document", accept: string) => {
    setCurrentType(type);
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        disabled={uploading || disabled}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            disabled={disabled || uploading}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              className="justify-start gap-2"
              onClick={() => triggerFileInput("image", "image/*")}
              disabled={uploading}
            >
              <Image className="h-4 w-4" />
              Imagem
            </Button>
            <Button
              variant="ghost"
              className="justify-start gap-2"
              onClick={() => triggerFileInput("video", "video/*")}
              disabled={uploading}
            >
              <Video className="h-4 w-4" />
              Vídeo
            </Button>
            <Button
              variant="ghost"
              className="justify-start gap-2"
              onClick={() => triggerFileInput("audio", "audio/*")}
              disabled={uploading}
            >
              <Mic className="h-4 w-4" />
              Áudio
            </Button>
            <Button
              variant="ghost"
              className="justify-start gap-2"
              onClick={() => triggerFileInput("document", "*/*")}
              disabled={uploading}
            >
              <Paperclip className="h-4 w-4" />
              Documento
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
