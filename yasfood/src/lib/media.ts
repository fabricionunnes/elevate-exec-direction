import { supabase } from "./supabase";

export const MAX_UPLOAD_MB = 50;

/** Envia um arquivo pro bucket "produtos" e devolve a URL pública e o tipo. */
export async function uploadMedia(file: File, folder: string): Promise<{ url: string; kind: "image" | "video" }> {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`Arquivo acima de ${MAX_UPLOAD_MB} MB. Comprime o vídeo antes de enviar.`);
  const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
  const ext = (file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg")).toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("produtos").upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  const { data } = supabase.storage.from("produtos").getPublicUrl(path);
  return { url: data.publicUrl, kind };
}
