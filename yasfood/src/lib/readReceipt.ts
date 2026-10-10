// Leitura de nota/cupom de compra: foto → itens casados com o estoque.
import { supabase } from "./supabase";
import type { ShrunkImage } from "./readOrder";

export interface ReceiptItem {
  description: string;
  ingredient_name: string | null;
  packs: number;
  pack_size: number | null;
  unit: "g" | "kg" | "ml" | "l" | "un" | null;
  total_price: number | null;
  relevant: boolean;
}
export interface Receipt {
  supplier: string | null;
  purchased_on: string | null;
  total: number | null;
  items: ReceiptItem[];
  doubts: string[];
  confidence: "alta" | "media" | "baixa";
}

export async function readReceipt(images: ShrunkImage[], hint?: string): Promise<Receipt> {
  const { data, error } = await supabase.functions.invoke<{ receipt?: Receipt; error?: string }>("yasfood-read-receipt", { body: { images, hint: hint || undefined } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const body = ctx ? await ctx.json().catch(() => null) as { error?: string } | null : null;
    throw new Error(body?.error ?? error.message ?? "Falha ao ler a nota.");
  }
  if (!data?.receipt) throw new Error(data?.error ?? "A leitura não devolveu itens.");
  return data.receipt;
}
