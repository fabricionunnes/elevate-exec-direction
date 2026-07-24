import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { initMetaPixel, trackMetaEvent, META_PIXEL_ID } from "@/lib/metaPixel";
import { ArrowRight, CalendarCheck, CheckCircle, Mail, MessageSquare } from "lucide-react";

// Página de obrigado do UNV Start (Raio-X Comercial).
// Dispara o Purchase no navegador com eventID = `${crm_lead_id}:Purchase`,
// o MESMO event_id usado pelo meta-capi server-side no gate de pagamento —
// o Meta deduplica e a campanha otimiza pelo evento de compra sem contar em dobro.
// Sem lid na URL, só PageView (o Purchase server-side já cobre a conversão).

export default function UNVStartObrigadoPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const crmLeadId = params.get("lid") || "";

  useEffect(() => {
    initMetaPixel();
    if (crmLeadId && typeof window !== "undefined" && window.fbq) {
      window.fbq(
        "track",
        "Purchase",
        { value: 37, currency: "BRL", content_name: "Raio-X Comercial" },
        { eventID: `${crmLeadId}:Purchase` },
      );
    }
  }, [crmLeadId]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0D2B5E] via-[#0D2B5E] to-[#081d40] flex items-center">
      <div className="container-premium py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="h-10 w-10 text-emerald-400" />
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-white mb-4">
            Compra confirmada. Obrigado!
          </h1>
          <p className="text-lg text-white/80 mb-8">
            Seu acesso ao <strong className="text-white">Raio-X Comercial</strong> já
            foi liberado e enviado pra você agora.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-10 text-left">
            <div className="rounded-xl bg-white/5 border border-white/15 p-5 flex items-start gap-3">
              <Mail className="h-5 w-5 text-white/60 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-white/80">
                Confira seu <strong className="text-white">e-mail</strong> — o link de
                acesso chegou por lá (olhe o spam se não achar).
              </p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/15 p-5 flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-white/60 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-white/80">
                Também mandamos o mesmo link no seu{" "}
                <strong className="text-white">WhatsApp</strong>.
              </p>
            </div>
          </div>

          {token && (
            <Link to={`/start/${token}`}>
              <Button
                variant="hero"
                size="xl"
                className="w-full sm:w-auto bg-white text-primary hover:bg-white/90 mb-12"
              >
                Começar meu Raio-X agora
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          )}

          {/* Bônus: sessão estratégica gratuita */}
          <div className="rounded-2xl bg-white/5 border border-white/15 p-8 text-left">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <CalendarCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-emerald-300 text-xs font-bold uppercase tracking-[0.2em] mb-2">
                  Bônus de comprador
                </p>
                <h2 className="text-white font-semibold text-xl mb-2">
                  Sessão estratégica gratuita com a UNV
                </h2>
                <p className="text-white/75 mb-5">
                  Enquanto a IA monta a sua estrutura, que tal uma conversa de
                  diagnóstico com um diretor comercial de verdade? Preencha o
                  formulário e agende a sua sessão — sem custo.
                </p>
                <a href="/sessao/?origem=unv-start">
                  <Button
                    size="lg"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    Agendar minha sessão gratuita
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </div>

          <noscript>
            {/* fallback do pixel */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </div>
      </div>
    </main>
  );
}
