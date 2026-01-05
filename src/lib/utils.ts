import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um número de telefone brasileiro no padrão (DDD) XXXXX-XXXX
 * Se houver DDI 55, exibe como +55 (DDD) XXXXX-XXXX
 * @param phone - Telefone em qualquer formato
 * @returns Telefone formatado ou o original se não conseguir formatar
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  
  // Remove todos os caracteres não numéricos
  const digits = phone.replace(/\D/g, "");
  
  if (digits.length === 0) return phone;
  
  // Detecta se tem DDI 55
  let hasDDI = false;
  let cleanDigits = digits;
  
  if (digits.startsWith("55") && digits.length >= 12) {
    hasDDI = true;
    cleanDigits = digits.slice(2);
  }
  
  // Formata o número brasileiro
  let formatted = "";
  
  if (cleanDigits.length === 11) {
    // Celular com 9 dígitos: (XX) XXXXX-XXXX
    const ddd = cleanDigits.slice(0, 2);
    const firstPart = cleanDigits.slice(2, 7);
    const secondPart = cleanDigits.slice(7, 11);
    formatted = `(${ddd}) ${firstPart}-${secondPart}`;
  } else if (cleanDigits.length === 10) {
    // Fixo com 8 dígitos: (XX) XXXX-XXXX
    const ddd = cleanDigits.slice(0, 2);
    const firstPart = cleanDigits.slice(2, 6);
    const secondPart = cleanDigits.slice(6, 10);
    formatted = `(${ddd}) ${firstPart}-${secondPart}`;
  } else if (cleanDigits.length === 9) {
    // Celular sem DDD: XXXXX-XXXX
    const firstPart = cleanDigits.slice(0, 5);
    const secondPart = cleanDigits.slice(5, 9);
    formatted = `${firstPart}-${secondPart}`;
  } else if (cleanDigits.length === 8) {
    // Fixo sem DDD: XXXX-XXXX
    const firstPart = cleanDigits.slice(0, 4);
    const secondPart = cleanDigits.slice(4, 8);
    formatted = `${firstPart}-${secondPart}`;
  } else {
    // Não consegue formatar, retorna original
    return phone;
  }
  
  // Adiciona DDI se presente
  if (hasDDI) {
    formatted = `+55 ${formatted}`;
  }
  
  return formatted;
}
