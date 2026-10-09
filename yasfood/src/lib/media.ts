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

/** Captura um frame do vídeo (no navegador) pra servir de capa antes do play. */
export function captureVideoPoster(file: File, at = 0.5): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
      const done = (b: Blob | null) => { URL.revokeObjectURL(url); resolve(b); };
      const grab = () => {
        try {
          const c = document.createElement("canvas");
          c.width = v.videoWidth || 1200; c.height = v.videoHeight || 900;
          c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
          c.toBlob((b) => done(b), "image/jpeg", 0.86);
        } catch { done(null); }
      };
      v.onloadeddata = () => { try { v.currentTime = Math.min(at, (v.duration || 1) - 0.05); } catch { grab(); } };
      v.onseeked = grab;
      v.onerror = () => done(null);
      setTimeout(() => done(null), 8000);
    } catch { resolve(null); }
  });
}

export async function uploadBlob(blob: Blob, folder: string, ext = "jpg"): Promise<string> {
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("produtos").upload(path, blob, { contentType: blob.type || "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from("produtos").getPublicUrl(path).data.publicUrl;
}
