import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { initMetaPixel, META_PIXEL_ID } from "@/lib/metaPixel";
import { ArrowRight, CalendarCheck, CheckCircle, Mail, MessageSquare, GraduationCap, Users } from "lucide-react";
import { IA_ACADEMY_PLANS } from "./IaAcademyCheckoutPage";
import logoIaAcademy from "@/assets/logo-unv-ia-academy.webp";

// Página de obrigado do UNV IA Academy. Dispara o Purchase com eventID
// `${crm_lead_id}:Purchase` (mesmo id do CAPI server-side, se houver).

const LOGIN_URL = `/onboarding-tasks/login?redirect=${encodeURIComponent("/academy")}`;

export default function IaAcademyObrigadoPage() {
  const [params] = useSearchParams();
  const crmLeadId = params.get("lid") || "";
  const plan = params.get("plano") === "monthly" ? "monthly" : "annual";
  const price = IA_ACADEMY_PLANS[plan].price;

  useEffect(() => {
    document.title = "Bem-vindo · UNV IA Academy";
    initMetaPixel();
    if (crmLeadId && typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "Purchase", { value: price, currency: "BRL", content_name: "UNV IA Academy" }, { eventID: `${crmLeadId}:Purchase` });
    }
  }, [crmLeadId, price]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0D2B5E] via-[#0D2B5E] to-[#081d40] flex items-center">
      <div className="container-premium py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 mb-8 shadow-xl">
            <img src={logoIaAcademy} alt="UNV IA Academy" className="h-14 w-auto" />
          </div>
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="h-10 w-10 text-emerald-400" />
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-white mb-4">Bora. Você está dentro.</h1>
          <p className="text-lg text-white/80 mb-8">
            Seu acesso ao <strong className="text-white">UNV IA Academy</strong> foi liberado agora. Entre com o e-mail e a senha que você criou no checkout.
          </p>

          <Link to={LOGIN_URL}>
            <Button variant="hero" size="xl" className="w-full sm:w-auto bg-white text-primary hover:bg-white/90 mb-10">
              <GraduationCap className="mr-2" />
              Entrar no Academy
              <ArrowRight className="ml-2" />
            </Button>
          </Link>

          <div className="grid sm:grid-cols-2 gap-4 mb-10 text-left">
            <div className="rounded-xl bg-white/5 border border-white/15 p-5 flex items-start gap-3">
              <Mail className="h-5 w-5 text-white/60 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-white/80">
                Mandamos o link de acesso no seu <strong className="text-white">e-mail</strong> (olhe o spam se não achar).
              </p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/15 p-5 flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-white/60 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-white/80">
                O mesmo link foi pro seu <strong className="text-white">WhatsApp</strong>. É por lá que avisamos os encontros.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/15 p-8 text-left space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <CalendarCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-emerald-300 text-xs font-bold uppercase tracking-[0.2em] mb-2">Primeiro passo</p>
                <h2 className="text-white font-semibold text-xl mb-2">Peça sua sessão individual com o Fabrício</h2>
                <p className="text-white/75">
                  Dentro do Academy, abra <strong className="text-white">Encontros ao Vivo</strong> e solicite a sessão de planejamento. É 1:1, ao vivo, pra montar o seu plano de IA e já começar as ações.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-6 w-6 text-white/80" />
              </div>
              <div>
                <p className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] mb-2">Todo mês</p>
                <h2 className="text-white font-semibold text-xl mb-2">Hotseat em grupo, ao vivo</h2>
                <p className="text-white/75">
                  Um encontro por mês pra tirar dúvida, revisar implementação e destravar o que travou. A agenda fica em Encontros ao Vivo.
                </p>
              </div>
            </div>
          </div>

          <noscript>
            <img height="1" width="1" style={{ display: "none" }} src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`} alt="" />
          </noscript>
        </div>
      </div>
    </main>
  );
}
