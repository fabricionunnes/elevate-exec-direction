// Página pública do Pix Automático (09/11/2026): /#/pix-automatico/<id da autorização>
// O cliente paga a 1ª parcela pelo QR Code e, no mesmo passo, autoriza no banco dele os débitos
// automáticos seguintes. Os dados vêm da função pix-automatico (ação "ver"), que também confere o
// status no Asaas enquanto a autorização não está ativa; a página consulta de novo a cada 10 s.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Autorizacao {
  id: string; status: string; valor_cents: number; frequencia: string; descricao: string | null;
  cliente_nome: string | null; primeira_cobranca: string | null; start_date: string | null;
  qr_payload: string | null; qr_image: string | null; qr_expira_em: string | null; pago: boolean;
}

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const FREQ: Record<string, string> = { MONTHLY: "por mês", QUARTERLY: "por trimestre", ANNUALLY: "por ano", WEEKLY: "por semana", SEMIANNUALLY: "por semestre" };

export default function PixAutomaticoPage() {
  const { id = "" } = useParams();
  const [a, setA] = useState<Autorizacao | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    const buscar = async () => {
      const { data, error } = await supabase.functions.invoke("pix-automatico", { body: { action: "ver", id } });
      if (!vivo) return;
      if (error || !data?.ok) setErro(data?.error || "Não encontramos esta autorização.");
      else { setA(data.autorizacao); setErro(""); }
      setCarregando(false);
    };
    buscar();
    const t = setInterval(() => { if (document.visibilityState === "visible") buscar(); }, 10000);
    return () => { vivo = false; clearInterval(t); };
  }, [id]);

  const copiar = () => {
    if (!a?.qr_payload) return;
    navigator.clipboard.writeText(a.qr_payload);
    toast.success("Código Pix copiado. Cole no app do seu banco.");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center px-4 py-8">
      <img src="/images/unv-logo.png" alt="UNV" className="h-10 mb-6" />
      <div className="w-full max-w-md rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
        {carregando ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : erro || !a ? (
          <div className="text-center py-10 space-y-2">
            <XCircle className="h-10 w-10 mx-auto text-slate-400" />
            <p className="font-medium">{erro || "Não encontramos esta autorização."}</p>
            <p className="text-sm text-slate-500">Confira o link com quem te enviou.</p>
          </div>
        ) : a.status === "ACTIVE" ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600" />
            <h1 className="text-xl font-semibold">Pix Automático autorizado</h1>
            <p className="text-sm text-slate-600">
              Pronto{a.cliente_nome ? `, ${a.cliente_nome.split(" ")[0]}` : ""}. A partir de {dataBR(a.start_date)}, {brl(a.valor_cents)} {FREQ[a.frequencia] || ""} saem
              automaticamente da sua conta, sem boleto e sem link.
            </p>
            <p className="text-xs text-slate-500">Você pode acompanhar ou cancelar a autorização a qualquer momento no app do seu banco, na área de Pix Automático.</p>
          </div>
        ) : a.status === "CREATED" ? (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <p className="text-sm text-slate-500">{a.descricao}</p>
              <h1 className="text-2xl font-semibold" style={{ color: "#0D2B5E" }}>{brl(a.valor_cents)} <span className="text-base font-normal text-slate-500">{FREQ[a.frequencia] || ""}</span></h1>
            </div>
            {a.pago ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 text-center">
                Recebemos o pagamento da 1ª parcela. Agora falta só o seu banco confirmar a autorização do Pix Automático. Se o app pedir, aprove por lá.
              </div>
            ) : (
              <>
                {a.qr_image && (
                  <div className="flex justify-center">
                    <img src={`data:image/png;base64,${a.qr_image}`} alt="QR Code Pix" className="h-60 w-60 rounded-lg border border-slate-200 p-2" />
                  </div>
                )}
                {a.qr_payload && (
                  <Button type="button" className="w-full text-white" style={{ backgroundColor: "#0D2B5E" }} onClick={copiar}>
                    <Copy className="h-4 w-4 mr-2" />Copiar código Pix
                  </Button>
                )}
                <ol className="text-sm text-slate-600 space-y-2 list-decimal pl-5">
                  <li>Abra o app do seu banco e pague a 1ª parcela pelo QR Code ou pelo código copiado.</li>
                  <li>No mesmo pagamento, o banco vai pedir pra autorizar o <b>Pix Automático</b>. Confirme.</li>
                  <li>Depois disso, as próximas parcelas saem sozinhas{a.start_date ? `, a partir de ${dataBR(a.start_date)}` : ""}. Você pode cancelar quando quiser pelo app do banco.</li>
                </ol>
                {a.qr_expira_em && (
                  <p className="text-xs text-slate-400 text-center">Este QR Code vale até {new Date(a.qr_expira_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.</p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-10 space-y-2">
            <XCircle className="h-10 w-10 mx-auto text-slate-400" />
            <p className="font-medium">
              {a.status === "EXPIRED" ? "Este QR Code expirou." : a.status === "REFUSED" ? "A autorização não foi confirmada pelo banco." : "Esta autorização foi cancelada."}
            </p>
            <p className="text-sm text-slate-500">Fale com quem te enviou o link pra receber um novo.</p>
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400 mt-6 text-center max-w-md">Pagamento processado pelo Asaas. UNV Holdings · CNPJ 51.356.237/0001-40</p>
    </div>
  );
}
