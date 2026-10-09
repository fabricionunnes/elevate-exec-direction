// Leitura de prints do WhatsApp: reduz as imagens no navegador e manda pra função
// yasfood-read-order, que devolve o pedido estruturado pra conferência.
import { supabase } from "./supabase";

export interface ReadOrderItem { product_name: string | null; raw_text: string; qty: number }
export interface ReadOrder {
  customer_name: string | null;
  phone: string | null;
  fulfillment: "entrega" | "retirada" | "indefinido";
  zone_name: string | null;
  address: string | null;
  reference: string | null;
  scheduled_date: string | null;
  window_label: string | null;
  time_text: string | null;
  payment_method: "pix" | "dinheiro" | "cartao" | null;
  change_for: number | null;
  items: ReadOrderItem[];
  notes: string | null;
  doubts: string[];
  confidence: "alta" | "media" | "baixa";
}

const MAX_SIDE = 1600;

/** Reduz a imagem pra no máximo 1600 px no maior lado e devolve JPEG em base64 (sem o prefixo data:). */
export async function shrinkImage(file: File): Promise<{ media_type: "image/jpeg"; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não consegui processar a imagem.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { media_type: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}

export async function readOrderFromScreenshots(files: File[], hint?: string): Promise<ReadOrder> {
  const images = await Promise.all(files.slice(0, 6).map(shrinkImage));
  const { data, error } = await supabase.functions.invoke<{ order?: ReadOrder; error?: string }>("yasfood-read-order", { body: { images, hint: hint || undefined } });
  if (error) {
    // a função devolve { error } com status 4xx/5xx; o invoke embrulha isso em FunctionsHttpError
    const ctx = (error as { context?: Response }).context;
    const body = ctx ? await ctx.json().catch(() => null) as { error?: string } | null : null;
    throw new Error(body?.error ?? error.message ?? "Falha ao ler os prints.");
  }
  if (!data?.order) throw new Error(data?.error ?? "A leitura não devolveu um pedido.");
  return data.order;
}
