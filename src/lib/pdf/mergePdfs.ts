import { PDFDocument } from "pdf-lib";

/**
 * Mescla o PDF principal (contrato) com anexos em um único PDF, na ordem:
 * contrato primeiro, depois cada anexo. Usado pra enviar anexos junto do
 * contrato no MESMO envelope de assinatura (o envelope aceita um único PDF —
 * assim o cliente assina o pacote inteiro de uma vez).
 */
export async function mergePdfBlobs(main: Blob, attachments: File[]): Promise<Blob> {
  if (!attachments.length) return main;
  const merged = await PDFDocument.create();
  const sources: ArrayBuffer[] = [await main.arrayBuffer()];
  for (const f of attachments) sources.push(await f.arrayBuffer());
  for (const buf of sources) {
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  const bytes = await merged.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
