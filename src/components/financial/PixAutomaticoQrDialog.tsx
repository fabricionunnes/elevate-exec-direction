// QR Code do Pix Automático (09/11/2026): mostrado logo depois de criar a recorrência (empresa ou lead do
// CRM) e pelo botão "Ver QR" da lista. O cliente paga a 1ª parcela por esse QR e, no mesmo passo, autoriza
// no banco dele os débitos automáticos seguintes. O link abre a página pública /#/pix-automatico/<id>.
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, ExternalLink, QrCode } from "lucide-react";

export interface PixAutomaticoInfo {
  id: string;
  status?: string | null;
  payload?: string | null;
  image?: string | null;
  link?: string | null;
  primeira_cobranca?: string | null;
  start_date?: string | null;
  valor_cents?: number | null;
}

export const STATUS_PIX_AUTOMATICO: Record<string, { label: string; cor: string }> = {
  CREATED: { label: "Aguardando o cliente autorizar", cor: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  ACTIVE: { label: "Débito automático ativo", cor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  REFUSED: { label: "Autorização recusada", cor: "bg-red-500/15 text-red-700 dark:text-red-400" },
  CANCELLED: { label: "Autorização cancelada", cor: "bg-muted text-muted-foreground" },
  EXPIRED: { label: "QR Code expirou", cor: "bg-muted text-muted-foreground" },
};

export const linkPixAutomatico = (id: string) => `https://unvholdings.com.br/#/pix-automatico/${id}`;

const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

export function PixAutomaticoQrDialog({ info, onOpenChange }: { info: PixAutomaticoInfo | null; onOpenChange: (open: boolean) => void }) {
  const link = info?.link || (info ? linkPixAutomatico(info.id) : "");
  const st = STATUS_PIX_AUTOMATICO[String(info?.status || "CREATED")] || STATUS_PIX_AUTOMATICO.CREATED;
  const copiar = (texto: string, msg: string) => { navigator.clipboard.writeText(texto); toast.success(msg); };
  return (
    <Dialog open={!!info} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" />Pix Automático</DialogTitle>
          <DialogDescription>
            O cliente paga a 1ª parcela por este QR Code e, no mesmo passo, autoriza no banco dele os débitos automáticos seguintes.
          </DialogDescription>
        </DialogHeader>
        {info && (
          <div className="space-y-4">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${st.cor}`}>{st.label}</span>
            {info.image && info.status !== "ACTIVE" ? (
              <div className="flex justify-center">
                <img src={`data:image/png;base64,${info.image}`} alt="QR Code do Pix Automático" className="h-56 w-56 rounded-lg border bg-white p-2" />
              </div>
            ) : null}
            {(info.primeira_cobranca || info.start_date) && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                {info.primeira_cobranca && <p>1ª parcela: paga agora pelo QR Code (vencimento {dataBR(info.primeira_cobranca)})</p>}
                {info.start_date && <p>Débitos automáticos a partir de <b>{dataBR(info.start_date)}</b></p>}
              </div>
            )}
            <div className="grid gap-2">
              <Button type="button" onClick={() => copiar(link, "Link da página do QR Code copiado")}>
                <Copy className="h-4 w-4 mr-2" />Copiar link pro cliente
              </Button>
              {info.payload && info.status !== "ACTIVE" && (
                <Button type="button" variant="outline" onClick={() => copiar(info.payload!, "Pix copia e cola copiado")}>
                  <Copy className="h-4 w-4 mr-2" />Copiar Pix copia e cola
                </Button>
              )}
              <Button type="button" variant="ghost" asChild>
                <a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Abrir a página do cliente</a>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Se o banco do cliente não confirmar a autorização, a 1ª parcela continua paga e o status fica "recusada". Aí é só criar outra recorrência.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BadgePixAutomatico({ status }: { status?: string | null }) {
  const st = STATUS_PIX_AUTOMATICO[String(status || "CREATED")] || STATUS_PIX_AUTOMATICO.CREATED;
  return <Badge variant="outline" className={`text-xs border-0 ${st.cor}`}>Pix Automático · {st.label.toLowerCase()}</Badge>;
}
