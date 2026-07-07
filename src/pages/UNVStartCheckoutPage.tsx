import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import logoUnvBoard from "@/assets/logo-unv-board.png";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  Lock,
  QrCode,
  ShieldCheck,
  CreditCard,
} from "lucide-react";

async function callCheckout(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("unv-start-checkout", {
    body: payload,
  });
  if (error) {
    // extrai mensagem do corpo quando a função responde erro com status !=2xx
    try {
      const body = await error.context?.json?.();
      if (body?.error) return { error: body.error };
    } catch {
      /* noop */
    }
    return { error: error.message || "Erro na comunicação" };
  }
  return data;
}

const beneficios = [
  "7 documentos comerciais prontos e personalizados",
  "Raio-X, ICP, Funil, Script, Playbook, Processos e Metas",
  "Acesso na hora, 100% guiado pela IA da UNV",
  "Seu pra sempre — pagamento único",
  "Garantia incondicional de 7 dias",
];

export default function UNVStartCheckoutPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "pix">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cpf, setCpf] = useState("");
  const [method, setMethod] = useState<"pix" | "credit_card">("pix");

  const [memberId, setMemberId] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [pixImg, setPixImg] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  const pollRef = useRef<number | null>(null);

  const goToPortal = useCallback(
    (token: string) => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      navigate(`/start/${token}`);
    },
    [navigate],
  );

  // polling do pagamento
  useEffect(() => {
    if (step !== "pix" || !memberId) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const r = await callCheckout({ action: "status", member_id: memberId });
        if (r.paid && r.token) goToPortal(r.token);
      } catch {
        /* silencioso */
      }
    }, 4000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [step, memberId, goToPortal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const digitsWhats = whatsapp.replace(/\D/g, "");
    const digitsCpf = cpf.replace(/\D/g, "");
    if (!name.trim() || !email.trim()) return setError("Preencha nome e email.");
    if (digitsWhats.length < 10) return setError("Informe um WhatsApp válido com DDD.");
    if (digitsCpf.length !== 11) return setError("Informe um CPF válido.");

    setLoading(true);
    try {
      const r = await callCheckout({
        action: "create",
        name: name.trim(),
        email: email.trim(),
        whatsapp: digitsWhats,
        cpf: digitsCpf,
        payment_method: method,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      if (r.already_paid && r.token) {
        goToPortal(r.token);
        return;
      }
      if (r.paid && r.token) {
        goToPortal(r.token);
        return;
      }
      setMemberId(r.member_id);
      setPixCode(r.pix_qr_code || null);
      setPixImg(r.pix_qr_code_url || null);
      setInvoiceUrl(r.invoice_url || null);
      setStep("pix");
      if (method === "credit_card" && r.invoice_url) {
        window.open(r.invoice_url, "_blank");
      }
    } catch {
      setError("Não consegui gerar o pagamento. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  function copyPix() {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Layout>
      <section className="min-h-screen bg-gradient-to-br from-[#0D2B5E] to-[#081d40] py-10 md:py-16">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => (step === "pix" ? setStep("form") : navigate("/unv-start"))}
              className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>

            <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-6 md:gap-8 items-start">
              {/* Coluna principal */}
              <div className="min-w-0 bg-white rounded-2xl p-6 md:p-8 shadow-2xl order-2 md:order-1">
                {step === "form" ? (
                  <>
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-[#0D2B5E] mb-1">
                      Falta pouco pra sua estrutura
                    </h1>
                    <p className="text-muted-foreground mb-6">
                      Preencha seus dados pra liberar o acesso na hora.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-foreground">Nome completo</label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-[#0D2B5E]"
                          placeholder="Seu nome"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground">Email</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-[#0D2B5E]"
                          placeholder="voce@email.com"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium text-foreground">WhatsApp</label>
                          <input
                            value={whatsapp}
                            onChange={(e) => setWhatsapp(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-[#0D2B5E]"
                            placeholder="(11) 90000-0000"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground">CPF</label>
                          <input
                            value={cpf}
                            onChange={(e) => setCpf(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-[#0D2B5E]"
                            placeholder="000.000.000-00"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground">Forma de pagamento</label>
                        <div className="mt-1 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setMethod("pix")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium transition-all ${
                              method === "pix"
                                ? "border-[#0D2B5E] bg-[#0D2B5E]/10 text-[#0D2B5E]"
                                : "border-input text-muted-foreground"
                            }`}
                          >
                            <QrCode className="h-4 w-4" /> Pix
                          </button>
                          <button
                            type="button"
                            onClick={() => setMethod("credit_card")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium transition-all ${
                              method === "credit_card"
                                ? "border-[#0D2B5E] bg-[#0D2B5E]/10 text-[#0D2B5E]"
                                : "border-input text-muted-foreground"
                            }`}
                          >
                            <CreditCard className="h-4 w-4" /> Cartão
                          </button>
                        </div>
                      </div>

                      {error && (
                        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                          {error}
                        </p>
                      )}

                      <Button
                        type="submit"
                        size="xl"
                        disabled={loading}
                        className="w-full bg-[#0D2B5E] text-white hover:bg-[#0D2B5E]/90"
                      >
                        {loading ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <>
                            Pagar R$ 97 e liberar acesso
                            <ArrowRight className="ml-2" />
                          </>
                        )}
                      </Button>
                      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" /> Pagamento seguro · Acesso imediato
                      </p>
                    </form>
                  </>
                ) : (
                  <>
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-[#0D2B5E] mb-1">
                      {method === "pix" ? "Pague com Pix pra liberar" : "Finalize no cartão"}
                    </h1>
                    <p className="text-muted-foreground mb-6">
                      {method === "pix"
                        ? "Escaneie o QR code ou copie o código. O acesso libera automaticamente."
                        : "Abrimos a página segura de pagamento. Assim que aprovar, seu acesso libera aqui."}
                    </p>

                    {method === "pix" && pixImg && (
                      <div className="flex flex-col items-center">
                        <div className="rounded-2xl border border-input p-3 bg-white">
                          <img src={pixImg} alt="QR code Pix" className="w-52 h-52" />
                        </div>
                        <button
                          onClick={copyPix}
                          className="mt-4 flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/70 transition-colors w-full justify-center"
                        >
                          {copied ? (
                            <>
                              <Check className="h-4 w-4 text-green-600" /> Código copiado
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" /> Copiar código Pix
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {method === "credit_card" && invoiceUrl && (
                      <a href={invoiceUrl} target="_blank" rel="noreferrer">
                        <Button size="xl" className="w-full bg-[#0D2B5E] text-white hover:bg-[#0D2B5E]/90">
                          Abrir pagamento no cartão
                          <ArrowRight className="ml-2" />
                        </Button>
                      </a>
                    )}

                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      Aguardando confirmação do pagamento...
                    </div>
                  </>
                )}
              </div>

              {/* Resumo do pedido */}
              <div className="min-w-0 order-1 md:order-2">
                <div className="text-center md:text-left mb-5">
                  <img src={logoUnvBoard} alt="UNV" className="h-12 mx-auto md:mx-0 mb-3" />
                  <p className="text-white/60 text-sm uppercase tracking-wider">Você está adquirindo</p>
                  <h2 className="font-display text-xl font-bold text-white">UNV Start</h2>
                  <p className="text-white/70 text-sm">Estrutura comercial completa da sua empresa</p>
                </div>

                <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
                  {beneficios.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-white/85 text-sm">
                      <Check className="h-4 w-4 text-white mt-0.5 shrink-0" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-baseline justify-between rounded-2xl bg-white/10 border border-white/10 px-5 py-4">
                  <span className="text-white/70">Total</span>
                  <span className="font-display text-3xl font-bold text-white">R$ 97</span>
                </div>

                <p className="mt-4 flex items-center gap-2 text-xs text-white/60">
                  <ShieldCheck className="h-4 w-4" /> Garantia incondicional de 7 dias.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
