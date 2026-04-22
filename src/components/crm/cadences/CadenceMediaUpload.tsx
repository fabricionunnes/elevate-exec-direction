import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, FileIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  mediaType: "image" | "audio" | "video" | "document";
  value: string | null;
  filename?: string | null;
  onChange: (url: string | null, filename?: string | null) => void;
}

const ACCEPT_MAP: Record<string, string> = {
  image: "image/*",
  audio: "audio/*",
  video: "video/*",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv",
};

export function CadenceMediaUpload({ mediaType, value, filename, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 16MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${mediaType}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("cadence-media").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("cadence-media").getPublicUrl(path);
      onChange(data.publicUrl, file.name);
      toast.success("Mídia enviada");
    } catch (e: any) {
      toast.error(e.message || "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef} type="file" className="hidden"
        accept={ACCEPT_MAP[mediaType]}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      {value ? (
        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
          {mediaType === "image" ? (
            <img src={value} alt="preview" className="h-12 w-12 object-cover rounded" />
          ) : (
            <FileIcon className="h-8 w-8 text-muted-foreground" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{filename || value.split("/").pop()}</p>
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Abrir</a>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange(null, null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading} className="w-full">
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {uploading ? "Enviando..." : `Enviar ${mediaType === "image" ? "imagem" : mediaType === "audio" ? "áudio" : mediaType === "video" ? "vídeo" : "documento"}`}
        </Button>
      )}
    </div>
  );
}
