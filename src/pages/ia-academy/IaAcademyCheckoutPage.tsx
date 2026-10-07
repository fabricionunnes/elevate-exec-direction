import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { initMetaPixel, trackMetaEvent, identifyMetaUser } from "@/lib/metaPixel";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import logoUnv from "@/assets/logo-unv.png";
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
  Sparkles,
} from "lucide-react";

// Checkout do UNV IA Academy (Asaas via edge function ia-academy-checkout).
// Planos: anual R$ 2.497 (padrão) e mensal R$ 297. Pix com QR na tela e
// polling de confirmação; cartão abre a página segura do Asaas.

export const IA_ACADEMY_PLANS = {
  annual: { label: "Anual", price: 2497, perMonth: 208, cents: 249700, badge: "2 meses grátis" },
  monthly: { label: "Mensal", price: 297, perMonth: 297, cents: 29700, badge: null },
} as const;
type PlanKey = keyof typeof IA_ACADEMY_PLANS;

async function callCheckout(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("ia-academy-checkout", { body: payload });
  if (error) {
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) return { error: body.error };
    } catch {
      /* noop */
    }
    return { error: error.message || "Erro na comunicação" };
  }
  return data;
}

const beneficios = [
  "7 trilhas do Método CRESCER com IA aplicada ao comercial",
  "1 sessão individual de planejamento com o Fabrício na entrada",
  "1 hotseat mensal em grupo, ao vivo, pra tirar dúvida e implementar",
  "Laboratório de agentes: prompts e fluxos prontos pra copiar",
  "Tutor IA 24h dentro de cada aula",
  "Entregável por aula revisado pelo time UNV",
  "Certificado UNV com verificação pública",
];

const fmt = (n: number) => n.toLocaleString("pt-BR");

export default function IaAcademyCheckoutPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialPlan: PlanKey = params.get("plano") === "mensal" ? "monthly" : "annual";

  const [plan, setPlan] = useState<PlanKey>(initialPlan);
  const [step, setStep] = useState<"form" | "pay">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cpf, setCpf] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<"pix" | "credit_card">("pix");

  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [pixImg, setPixImg] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);

  const pollRef = useRef<number | null>(null);
  const cfg = IA_ACADEMY_PLANS[plan];

  const goToObrigado = useCallback(
    (sid: string, crmLeadId?: string | null) => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      const lid = crmLeadId ? `&lid=${encodeURIComponent(crmLeadId)}` : "";
      navigate(`/unviaacademy/obrigado?sid=${encodeURIComponent(sid)}&plano=${plan}${lid}`);
    },
    [navigate, plan],
  );

  useEffect(() => {
    document.title = "Checkout · UNV IA Academy";
    initMetaPixel();
    trackMetaEvent("InitiateCheckout", { value: cfg.price, currency: "BRL", content_name: "UNV IA Academy" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== "pay" || !subscriptionId) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const r = await callCheckout({ action: "status", subscription_id: subscriptionId });
        if (r?.paid) goToObrigado(subscriptionId, r.crm_lead_id);
      } catch {
        /* silencioso */
      }
    }, 4000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [step, subscriptionId, goToObrigado]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digitsWhats = whatsapp.replace(/\D/g, "");
    const digitsCpf = cpf.replace(/\D/g, "");
    if (!name.trim() || !email.trim()) return setError("Preencha nome e e-mail.");
    if (digitsWhats.length < 10) return setError("Informe um WhatsApp válido com DDD.");
    if (digitsCpf.length !== 11) return setError("Informe um CPF válido.");
    if (password.length < 6) return setError("Crie uma senha com pelo menos 6 caracteres.");

    setLoading(true);
    identifyMetaUser({ email: email.trim(), phone: digitsWhats, name: name.trim() });
    trackMetaEvent("AddPaymentInfo", { value: cfg.price, currency: "BRL", content_name: "UNV IA Academy", payment_method: method });
    try {
      const search = new URLSearchParams(window.location.search);
      const hashSearch = new URLSearchParams(window.location.hash.split("?")[1] || "");
      const utm: Record<string, string> = {};
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => {
        const v = search.get(k) || hashSearch.get(k);
        if (v) utm[k] = v;
      });
      const fbclid = search.get("fbclid") || hashSearch.get("fbclid") || "";

      const r = await callCheckout({
        action: "create",
        name: name.trim(),
        email: email.trim(),
        whatsapp: digitsWhats,
        cpf: digitsCpf,
        company_name: companyName.trim(),
        password,
        plan,
        payment_method: method,
        fbclid,
        utm,
      });
      if (r.error) return setError(r.error);
      if (r.already_paid || r.paid) {
        goToObrigado(r.subscription_id, r.crm_lead_id);
        return;
      }
      setSubscriptionId(r.subscription_id);
      setPixCode(r.pix_payload || null);
      setPixImg(r.pix_qr_code_url || null);
      setInvoiceUrl(r.invoice_url || null);
      setExistingAccount(!!r.existing_account);
      setStep("pay");
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

  const inputCls =
    "mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-[#0D2B5E]";

  return (
    <Layout>
      <section className="min-h-screen bg-gradient-to-br from-[#0D2B5E] to-[#081d40] py-10 md:py-16">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <button
              onClick={() => (step === "pay" ? setStep("form") : window.location.assign("/unviaacademy/"))}
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
                      Bora montar seu time de IA
                    </h1>
                    <p className="text-muted-foreground mb-6">
                      Escolha o plano, crie seu acesso e libere na hora.
                    </p>

                    {/* Plano */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      {(Object.keys(IA_ACADEMY_PLANS) as PlanKey[]).map((k) => {
                        const p = IA_ACADEMY_PLANS[k];
                        const active = plan === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setPlan(k)}
                            className={`relative text-left rounded-xl border px-4 py-3 transition-all ${
                              active ? "border-[#0D2B5E] bg-[#0D2B5E]/5 ring-2 ring-[#0D2B5E]" : "border-input hover:border-[#0D2B5E]/40"
                            }`}
                          >
                            {p.badge && (
                              <span className="absolute -top-2 right-3 text-[10px] font-bold uppercase tracking-wider bg-[#CC1B1B] text-white px-2 py-0.5 rounded-full">
                                {p.badge}
                              </span>
                            )}
                            <div className="text-xs uppercase tracking-wider text-muted-foreground">{p.label}</div>
                            <div className="font-display text-2xl font-bold text-[#0D2B5E]">
                              R$ {fmt(p.price)}
                              <span className="text-sm font-medium text-muted-foreground">{k === "annual" ? "/ano" : "/mês"}</span>
                            </div>
                            {k === "annual" && (
                              <div className="text-xs text-muted-foreground">equivale a R$ {fmt(p.perMonth)}/mês</div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-foreground">Nome completo</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Seu nome" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium text-foreground">E-mail (vai ser seu login)</label>
                          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="voce@empresa.com" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground">Empresa</label>
                          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} placeholder="Nome da empresa" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium text-foreground">WhatsApp</label>
                          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputCls} placeholder="(31) 90000-0000" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground">CPF</label>
                          <input value={cpf} onChange={(e) => setCpf(e.target.value)} className={inputCls} placeholder="000.000.000-00" />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground">Crie uma senha de acesso</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Mínimo 6 caracteres" />
                        <p className="text-xs text-muted-foreground mt-1">Se você já tem conta no Nexus com esse e-mail, a senha atual continua valendo.</p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground">Forma de pagamento</label>
                        <div className="mt-1 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setMethod("pix")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium transition-all ${
                              method === "pix" ? "border-[#0D2B5E] bg-[#0D2B5E]/10 text-[#0D2B5E]" : "border-input text-muted-foreground"
                            }`}
                          >
                            <QrCode className="h-4 w-4" /> Pix
                          </button>
                          <button
                            type="button"
                            onClick={() => setMethod("credit_card")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium transition-all ${
                              method === "credit_card" ? "border-[#0D2B5E] bg-[#0D2B5E]/10 text-[#0D2B5E]" : "border-input text-muted-foreground"
                            }`}
                          >
                            <CreditCard className="h-4 w-4" /> Cartão
                          </button>
                        </div>
                      </div>

                      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

                      <Button type="submit" size="xl" disabled={loading} className="w-full bg-[#CC1B1B] text-white hover:bg-[#CC1B1B]/90">
                        {loading ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <>
                            Assinar {plan === "annual" ? `por R$ ${fmt(cfg.price)}/ano` : `por R$ ${fmt(cfg.price)}/mês`}
                            <ArrowRight className="ml-2" />
                          </>
                        )}
                      </Button>
                      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" /> Pagamento seguro via Asaas · Garantia de 7 dias
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
                        ? "Escaneie o QR code ou copie o código. Assim que o banco confirmar, seu acesso libera aqui na hora."
                        : "Clique abaixo pra abrir a página segura do Asaas. Os dados do cartão ficam só lá. Assim que aprovar, seu acesso libera aqui."}
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
                    {method === "pix" && !pixImg && invoiceUrl && (
                      <a href={invoiceUrl} target="_blank" rel="noreferrer">
                        <Button size="xl" className="w-full bg-[#0D2B5E] text-white hover:bg-[#0D2B5E]/90">
                          Abrir página de pagamento Pix
                          <ArrowRight className="ml-2" />
                        </Button>
                      </a>
                    )}

                    {method === "credit_card" && invoiceUrl && (
                      <a href={invoiceUrl} target="_blank" rel="noreferrer">
                        <Button size="xl" className="w-full bg-[#0D2B5E] text-white hover:bg-[#0D2B5E]/90">
                          Abrir pagamento no cartão
                          <ArrowRight className="ml-2" />
                        </Button>
                      </a>
                    )}

                    {existingAccount && (
                      <p className="mt-4 text-xs text-muted-foreground bg-secondary/60 rounded-lg px-3 py-2">
                        Esse e-mail já tem conta no Nexus. Depois do pagamento, entre com a sua senha atual.
                      </p>
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
                  <img src={logoUnv} alt="UNV" className="h-10 mx-auto md:mx-0 mb-3 brightness-0 invert" />
                  <p className="text-white/60 text-sm uppercase tracking-wider">Você está assinando</p>
                  <h2 className="font-display text-xl font-bold text-white flex items-center gap-2 justify-center md:justify-start">
                    <Sparkles className="h-5 w-5 text-[#ff6b6b]" /> UNV IA Academy
                  </h2>
                  <p className="text-white/70 text-sm">IA aplicada ao comercial da sua empresa, com o Fabrício do lado.</p>
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
                  <span className="text-white/70">{plan === "annual" ? "Plano anual" : "Mensalidade"}</span>
                  <span className="font-display text-3xl font-bold text-white">
                    R$ {fmt(cfg.price)}
                    <span className="text-base font-medium text-white/70">{plan === "annual" ? "/ano" : "/mês"}</span>
                  </span>
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
