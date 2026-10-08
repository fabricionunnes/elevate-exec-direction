import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { initMetaPixel, trackMetaEvent, META_PIXEL_ID } from "@/lib/metaPixel";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle,
  Clock,
  Gift,
  Loader2,
  Mail,
  MessageSquare,
  Video,
} from "lucide-react";

// Página de obrigado do UNV Start (Raio-X Comercial).
// Pixel: Purchase no navegador com eventID = `${crm_lead_id}:Purchase`, o MESMO event_id do
// meta-capi server-side no gate de pagamento (o Meta deduplica). Sem lid na URL, só PageView.
// Bônus: diagnóstico comercial gratuito com o time. O token de acesso identifica o comprador,
// então o formulário só pede faturamento e Instagram; os horários vêm da agenda real do closer
// (edge unv-start-diagnostico) e o lead vai pra "Reunião agendada" no funil UNV Start.

const FAIXAS = [
  "Até R$ 50 mil por mês",
  "R$ 50 mil a R$ 100 mil",
  "R$ 100 mil a R$ 300 mil",
  "R$ 300 mil a R$ 1 milhão",
  "Acima de R$ 1 milhão",
];

type Dia = { date: string; slots: string[] };
type Etapa = "oferta" | "form" | "agenda" | "feito";

async function callDiag(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("unv-start-diagnostico", { body: payload });
  if (error) {
    try {
      const body = await error.context?.json?.();
      if (body?.error) return { error: body.error as string, status: error.context?.status as number };
    } catch {
      /* noop */
    }
    return { error: "Não consegui falar com a agenda agora. Tente de novo." };
  }
  return data;
}

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function rotuloDia(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return { semana: SEMANA[dt.getUTCDay()], data: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}` };
}

export default function UNVStartObrigadoPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const crmLeadId = params.get("lid") || "";

  const [primeiroNome, setPrimeiroNome] = useState("");
  const [etapa, setEtapa] = useState<Etapa>("oferta");
  const [faixa, setFaixa] = useState("");
  const [instagram, setInstagram] = useState("");
  const [dias, setDias] = useState<Dia[]>([]);
  const [diaSel, setDiaSel] = useState("");
  const [horaSel, setHoraSel] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState<{ when: string; closer?: string } | null>(null);

  useEffect(() => {
    initMetaPixel();
    if (crmLeadId && typeof window !== "undefined" && window.fbq) {
      window.fbq(
        "track",
        "Purchase",
        { value: 97, currency: "BRL", content_name: "Raio-X Comercial" },
        { eventID: `${crmLeadId}:Purchase` },
      );
    }
  }, [crmLeadId]);

  // quem já agendou e volta pra página vê a confirmação, não o formulário de novo
  useEffect(() => {
    if (!token) return;
    callDiag({ action: "context", token }).then((r) => {
      if (r?.first_name) setPrimeiroNome(r.first_name);
      if (r?.booked?.scheduled_at) {
        const dt = new Date(r.booked.scheduled_at);
        const when = dt.toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        setConfirmado({ when: when.replace(",", " às") });
        setEtapa("feito");
      }
    });
  }, [token]);

  async function carregarHorarios() {
    setCarregando(true);
    setErro(null);
    const r = await callDiag({ action: "slots" });
    setCarregando(false);
    if (r?.error) return setErro(r.error);
    const lista: Dia[] = r?.days || [];
    setDias(lista);
    setDiaSel(lista[0]?.date || "");
    setHoraSel("");
    if (!lista.length) setErro("A agenda do time está cheia nos próximos dias. Fale com a gente no WhatsApp que encaixamos você.");
  }

  async function enviarForm(e: React.FormEvent) {
    e.preventDefault();
    if (!faixa) return setErro("Escolha a faixa de faturamento da sua empresa.");
    setCarregando(true);
    setErro(null);
    const r = await callDiag({ action: "submit", token, revenue: faixa, instagram: instagram.trim() });
    setCarregando(false);
    if (r?.error) return setErro(r.error);
    trackMetaEvent("SubmitApplication", { content_name: "Diagnóstico bônus UNV Start" });
    setEtapa("agenda");
    carregarHorarios();
  }

  async function agendar() {
    if (!diaSel || !horaSel) return setErro("Escolha o dia e o horário.");
    setCarregando(true);
    setErro(null);
    const r = await callDiag({ action: "book", token, date: diaSel, time: horaSel });
    setCarregando(false);
    if (r?.error) {
      setErro(r.error);
      if (r.status === 409) carregarHorarios();
      return;
    }
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq(
        "track",
        "Schedule",
        { content_name: "Diagnóstico bônus UNV Start" },
        r.lead_id ? { eventID: `${r.lead_id}:Schedule` } : undefined,
      );
    }
    setConfirmado({ when: r.when, closer: r.closer });
    setEtapa("feito");
  }

  const horarios = dias.find((d) => d.date === diaSel)?.slots || [];

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0D2B5E] via-[#0D2B5E] to-[#081d40]">
      <div className="container-premium py-12 md:py-16">
        <div className="max-w-2xl mx-auto">
          {/* confirmação da compra */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-emerald-400" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl text-white mb-3 text-balance">
              {primeiroNome ? `Compra confirmada, ${primeiroNome}. Obrigado!` : "Compra confirmada. Obrigado!"}
            </h1>
            <p className="text-lg text-white/80 mb-8">
              Seu acesso ao <strong className="text-white">Raio-X Comercial</strong> já foi liberado.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="rounded-xl bg-white/5 border border-white/15 p-5 flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-emerald-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-white/80">
                O link de acesso chegou no seu <strong className="text-white">WhatsApp</strong>, pelo número que você
                informou na compra.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/15 p-5 flex items-start gap-3">
              <Mail className="h-5 w-5 text-emerald-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-white/80">
                O mesmo link foi pro seu <strong className="text-white">e-mail</strong>. Se não achar, olhe a caixa de
                spam e promoções.
              </p>
            </div>
          </div>

          {token && (
            <div className="text-center mb-12">
              <Link to={`/start/${token}`}>
                <Button
                  variant="hero"
                  size="xl"
                  className="w-full sm:w-auto bg-white text-primary hover:bg-white/90"
                >
                  Começar meu Raio-X agora
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
            </div>
          )}

          {/* bônus: diagnóstico com o time */}
          <section className="rounded-2xl border border-amber-300/40 bg-gradient-to-b from-amber-300/10 to-white/5 p-6 md:p-8">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-[0.2em] mb-3">
              <Gift className="h-4 w-4" />
              Bônus 100% gratuito pra quem assinou
            </div>
            <h2 className="text-white font-semibold text-2xl mb-2 text-balance">
              Diagnóstico comercial feito pelo meu time
            </h2>

            {etapa === "oferta" && (
              <>
                <p className="text-white/80 mb-5">
                  Você ganhou uma reunião de 45 minutos, por videochamada, com um especialista do time da UNV. Ele olha a
                  sua operação comercial com você e aponta onde a venda está vazando, sem custo nenhum.
                </p>
                <ul className="space-y-2 mb-6 text-white/80 text-sm">
                  <li className="flex gap-2"><Video className="h-4 w-4 text-amber-300 mt-0.5" />Online, pelo Google Meet</li>
                  <li className="flex gap-2"><Clock className="h-4 w-4 text-amber-300 mt-0.5" />Você escolhe o horário, de segunda a sexta</li>
                </ul>
                {token ? (
                  <Button
                    size="lg"
                    onClick={() => {
                      setErro(null);
                      setEtapa("form");
                    }}
                    className="w-full sm:w-auto bg-amber-400 hover:bg-amber-300 text-[#0D2B5E] font-semibold"
                  >
                    Quero meu diagnóstico gratuito
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <a href="/sessao/?origem=unv-start">
                    <Button size="lg" className="bg-amber-400 hover:bg-amber-300 text-[#0D2B5E] font-semibold">
                      Quero meu diagnóstico gratuito
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                )}
              </>
            )}

            {etapa === "form" && (
              <form onSubmit={enviarForm} className="space-y-5">
                <p className="text-white/80">
                  Seu nome, WhatsApp e e-mail a gente já tem. Só faltam duas coisas pro especialista chegar preparado.
                </p>
                <fieldset>
                  <legend className="text-white text-sm font-medium mb-2">Quanto a sua empresa fatura por mês?</legend>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {FAIXAS.map((f) => (
                      <button
                        type="button"
                        key={f}
                        aria-pressed={faixa === f}
                        onClick={() => setFaixa(f)}
                        className={`text-left rounded-lg border px-4 py-3 text-sm transition ${
                          faixa === f
                            ? "border-amber-300 bg-amber-300/15 text-white"
                            : "border-white/15 bg-white/5 text-white/80 hover:border-white/40"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label htmlFor="ig" className="block text-white text-sm font-medium mb-2">
                    Instagram da empresa
                  </label>
                  <input
                    id="ig"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="@suaempresa"
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-amber-300"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={carregando}
                  className="w-full bg-amber-400 hover:bg-amber-300 text-[#0D2B5E] font-semibold"
                >
                  {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ver horários disponíveis"}
                </Button>
              </form>
            )}

            {etapa === "agenda" && (
              <div className="space-y-5">
                <p className="text-white/80">Escolha o melhor dia e horário. São 45 minutos, por videochamada.</p>
                {carregando && !dias.length ? (
                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Consultando a agenda do time...
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {dias.map((d) => {
                        const r = rotuloDia(d.date);
                        const on = d.date === diaSel;
                        return (
                          <button
                            type="button"
                            key={d.date}
                            onClick={() => {
                              setDiaSel(d.date);
                              setHoraSel("");
                            }}
                            className={`flex-shrink-0 rounded-lg border px-4 py-2 text-center transition ${
                              on ? "border-amber-300 bg-amber-300/15" : "border-white/15 bg-white/5 hover:border-white/40"
                            }`}
                          >
                            <span className="block text-xs uppercase text-white/60">{r.semana}</span>
                            <span className="block text-white font-semibold">{r.data}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {horarios.map((h) => (
                        <button
                          type="button"
                          key={h}
                          onClick={() => setHoraSel(h)}
                          className={`rounded-lg border py-2.5 text-sm font-medium tabular-nums transition ${
                            horaSel === h
                              ? "border-amber-300 bg-amber-400 text-[#0D2B5E]"
                              : "border-white/15 bg-white/5 text-white hover:border-white/40"
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                    <Button
                      size="lg"
                      onClick={agendar}
                      disabled={carregando || !horaSel}
                      className="w-full bg-amber-400 hover:bg-amber-300 text-[#0D2B5E] font-semibold"
                    >
                      {carregando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : horaSel ? (
                        `Confirmar ${rotuloDia(diaSel).data} às ${horaSel}`
                      ) : (
                        "Escolha um horário"
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}

            {etapa === "feito" && confirmado && (
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                  <CalendarCheck className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="text-white/80">
                  <p className="text-white font-semibold text-lg mb-1">Diagnóstico agendado: {confirmado.when}</p>
                  <p>
                    O convite com o link do Google Meet foi pro seu e-mail. Já deixa reservado na sua agenda.
                  </p>
                </div>
              </div>
            )}

            {erro && <p className="mt-4 text-sm text-red-300">{erro}</p>}
          </section>

          <noscript>
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
