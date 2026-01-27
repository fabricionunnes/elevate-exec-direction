import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

interface CircleAvatarUploadProps {
  profileId: string;
  currentAvatarUrl: string | null;
  displayName: string;
  onAvatarChange: (url: string | null) => void;
  size?: "sm" | "md" | "lg" | "xl";
}

export const CircleAvatarUpload = ({
  profileId,
  currentAvatarUrl,
  displayName,
  onAvatarChange,
  size = "lg",
}: CircleAvatarUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-24 w-24",
    xl: "h-32 w-32",
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
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
      const fileName = `${user.id}/circle-avatar-${Date.now()}.${fileExt}`;

      // Delete old avatar if exists
      if (currentAvatarUrl && currentAvatarUrl.includes("circle-media")) {
        const oldPath = currentAvatarUrl.split("/circle-media/")[1]?.split("?")[0];
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
        .update({ avatar_url: publicUrl })
        .eq("id", profileId);

      if (updateError) {
        console.error("Update error:", updateError);
        toast.error("Erro ao atualizar perfil");
        return;
      }

      onAvatarChange(urlWithCacheBust);
      toast.success("Foto atualizada com sucesso!");
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error("Erro ao atualizar foto");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="relative">
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={currentAvatarUrl || undefined} alt={displayName} />
        <AvatarFallback className="text-2xl bg-primary/10 text-primary">
          {getInitials(displayName || "U")}
        </AvatarFallback>
      </Avatar>

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
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
        size="icon"
        className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <Camera className="h-4 w-4" />
      </Button>
    </div>
  );
};
