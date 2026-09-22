import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";

interface AdminAvatarUploadProps {
  staffId: string;
  currentAvatarUrl: string | null;
  userName: string;
  onAvatarChange: (url: string | null) => void;
}

// Igual ao AvatarUpload, mas pra admin/master definir a foto de OUTRO membro —
// passa pela edge function staff-avatar-admin (service role) porque o membro
// não é quem está logado, então não pode gravar via storage.objects/RLS direto.
export const AdminAvatarUpload = ({ staffId, currentAvatarUrl, userName, onAvatarChange }: AdminAvatarUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const call = async (form: FormData) => {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staff-avatar-admin`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: form,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || "Erro ao salvar a foto");
    return j;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Por favor, selecione uma imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 5MB"); return; }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("staff_id", staffId);
      form.append("file", file);
      const j = await call(form);
      onAvatarChange(j.avatar_url);
      toast.success("Foto atualizada com sucesso!");
    } catch (error: any) {
      console.error("Admin avatar upload error:", error);
      toast.error(error.message || "Erro ao atualizar foto");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!currentAvatarUrl) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("staff_id", staffId);
      form.append("remove", "true");
      await call(form);
      onAvatarChange(null);
      toast.success("Foto removida com sucesso!");
    } catch (error: any) {
      console.error("Admin avatar delete error:", error);
      toast.error(error.message || "Erro ao remover foto");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <Avatar className="h-16 w-16">
          <AvatarImage src={currentAvatarUrl || undefined} alt={userName} />
          <AvatarFallback className="text-lg bg-primary/10 text-primary">
            {getInitials(userName || "?")}
          </AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Camera className="h-4 w-4 mr-2" />
          {currentAvatarUrl ? "Alterar Foto" : "Adicionar Foto"}
        </Button>
        {currentAvatarUrl && (
          <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={uploading} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
