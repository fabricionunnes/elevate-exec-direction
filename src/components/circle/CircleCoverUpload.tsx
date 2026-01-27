import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CircleCoverUploadProps {
  profileId: string;
  currentCoverUrl: string | null;
  onCoverChange: (url: string | null) => void;
}

export const CircleCoverUpload = ({
  profileId,
  currentCoverUrl,
  onCoverChange,
}: CircleCoverUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/circle-cover-${Date.now()}.${fileExt}`;

      // Delete old cover if exists
      if (currentCoverUrl && currentCoverUrl.includes("circle-media")) {
        const oldPath = currentCoverUrl.split("/circle-media/")[1]?.split("?")[0];
        if (oldPath) {
          await supabase.storage.from("circle-media").remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("circle-media")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Erro ao fazer upload da imagem");
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("circle-media")
        .getPublicUrl(fileName);

      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      // Update circle_profiles
      const { error: updateError } = await supabase
        .from("circle_profiles")
        .update({ cover_url: publicUrl })
        .eq("id", profileId);

      if (updateError) {
        console.error("Update error:", updateError);
        toast.error("Erro ao atualizar capa");
        return;
      }

      onCoverChange(urlWithCacheBust);
      toast.success("Capa atualizada com sucesso!");
    } catch (error) {
      console.error("Cover upload error:", error);
      toast.error("Erro ao atualizar capa");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div
      className={cn(
        "h-48 relative",
        currentCoverUrl
          ? ""
          : "bg-gradient-to-br from-violet-500 to-pink-500"
      )}
      style={
        currentCoverUrl
          ? { backgroundImage: `url(${currentCoverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
    >
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute bottom-4 right-4"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <Camera className="h-4 w-4 mr-2" />
        Alterar capa
      </Button>
    </div>
  );
};
