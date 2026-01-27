import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2 } from "lucide-react";

interface CommunityImageUploadProps {
  communityId: string;
  type: "avatar" | "cover";
  currentUrl: string | null;
  onImageChange: (url: string) => void;
}

export function CommunityImageUpload({
  communityId,
  type,
  currentUrl,
  onImageChange,
}: CommunityImageUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Por favor, selecione uma imagem", variant: "destructive" });
      return;
    }

    const maxSize = type === "cover" ? 10 : 5;
    if (file.size > maxSize * 1024 * 1024) {
      toast({
        title: `A imagem deve ter no máximo ${maxSize}MB`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `communities/${communityId}/${type}-${Date.now()}.${fileExt}`;

      // Delete old image if exists
      if (currentUrl && currentUrl.includes("circle-media")) {
        const oldPath = currentUrl.split("/circle-media/")[1]?.split("?")[0];
        if (oldPath) {
          await supabase.storage.from("circle-media").remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("circle-media")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast({ title: "Erro ao fazer upload da imagem", variant: "destructive" });
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("circle-media").getPublicUrl(fileName);

      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      // Update community table
      const updateField = type === "avatar" ? "avatar_url" : "cover_url";
      const { error: updateError } = await supabase
        .from("circle_communities")
        .update({ [updateField]: publicUrl })
        .eq("id", communityId);

      if (updateError) {
        console.error("Update error:", updateError);
        toast({ title: "Erro ao atualizar imagem", variant: "destructive" });
        return;
      }

      onImageChange(urlWithCacheBust);
      toast({
        title: type === "avatar" ? "Foto de perfil atualizada!" : "Capa atualizada!",
      });
    } catch (error) {
      console.error("Image upload error:", error);
      toast({ title: "Erro ao atualizar imagem", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
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
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Camera className="h-4 w-4 mr-2" />
            {type === "avatar" ? "Alterar foto" : "Alterar capa"}
          </>
        )}
      </Button>
    </>
  );
}
