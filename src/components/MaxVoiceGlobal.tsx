// Max em todo o Nexus: microfone flutuante em qualquer tela do staff logado.
// Mesmo cérebro da tela Time de IA (ai-team-chat, modo voz) e as mesmas ordens:
// abrir tela/cliente/lead, ir pra sala do escritório, rodar agente, tarefa,
// mensagem, anúncio. As telas que já têm o próprio microfone ficam de fora.
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMaxVoice, temReconhecimento } from "@/pages/time-ia/useMaxVoice";

const NAVY = "#0D2B5E";
const RED = "#CC1B1B";
const UNV_CNPJ = "51356237000140";
// telas com microfone próprio (ou públicas) — o global não aparece
const SEM_MIC = [/^\/time-ia/, /^\/office/, /^\/onboarding-tasks\/unv-office/, /^\/onboarding-tasks\/login/, /^\/portal/, /^\/start/, /^\/sessao-estrategica/, /^\/checkout/, /^\/$/];

export default function MaxVoiceGlobal() {
  const location = useLocation();
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [staff, setStaff] = useState(false);
  const [aberto, setAberto] = useState(false);

  // só staff logado (checa de novo quando a rota muda: o login pode acontecer depois)
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !vivo) { setStaff(false); return; }
      const { data: st } = await supabase.from("onboarding_staff").select("id").eq("user_id", session.user.id).limit(1).maybeSingle();
      if (!vivo) return;
      setStaff(!!st);
    })();
    return () => { vivo = false; };
  }, [location.pathname]);

  // empresa da UNV (dona do Time de IA): resolvida na primeira fala, não trava o microfone
  const getCompanyId = useCallback(async (): Promise<string> => {
    if (companyId) return companyId;
    const { data: c } = await supabase.from("onboarding_companies").select("id").eq("cnpj", UNV_CNPJ).maybeSingle();
    if (!c?.id) throw new Error("empresa UNV não encontrada no Nexus");
    setCompanyId(c.id as string);
    return c.id as string;
  }, [companyId]);

  const ask = useCallback(async (msg: string): Promise<string> => {
    const cid = await getCompanyId();
    const { data, error } = await supabase.functions.invoke("ai-team-chat", { body: { companyId: cid, message: msg, modo: "voz", agente: "orquestrador" } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    for (const a of (data?.actions || []) as any[]) {
      const r = a.result || {};
      if (r.acao === "abrir_escritorio") { setTimeout(() => navigate("/onboarding-tasks/unv-office"), 1200); break; }
      if (r.acao === "ir_sala" && r.destino) { setTimeout(() => navigate(`/onboarding-tasks/unv-office?ir=${encodeURIComponent(r.destino)}`), 1200); break; }
      if ((r.acao === "abrir_cliente" || r.acao === "abrir_tela" || r.acao === "abrir_lead") && r.rota) { setTimeout(() => navigate(r.rota), 1200); break; }
    }
    return String(data?.reply || "");
  }, [getCompanyId, navigate]);

  const voz = useMaxVoice(ask);

  const esconder = !staff || SEM_MIC.some((re) => re.test(location.pathname));
  if (esconder) return null;

  const onMic = () => {
    setAberto(true);
    if (voz.fase === "ouvindo") { voz.parar(); return; }
    if (voz.fase === "falando") { voz.parar(); voz.ouvir(); return; }
    if (voz.fase === "pensando") return;
    voz.ouvir();
  };
  const legenda = {
    ouvindo: voz.parcial ? `"${voz.parcial}"` : "Pode falar",
    pensando: "Olhando os números…",
    falando: voz.falaAtual.slice(0, 160),
    parado: temReconhecimento ? "Falar com o Max" : "Voz indisponível neste navegador",
  }[voz.fase];

  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 9999, display: "flex", alignItems: "flex-end", gap: 10, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {(aberto || voz.fase !== "parado") && (
        <div style={{ maxWidth: 320, background: NAVY, color: "#fff", borderRadius: 14, padding: "10px 12px", boxShadow: "0 8px 28px rgba(0,0,0,.35)", fontSize: 13, lineHeight: 1.35 }}>
          <div style={{ fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", opacity: .7, marginBottom: 3 }}>Max · Time de IA</div>
          <div>{legenda}</div>
          {voz.erro && <div style={{ color: "#ffb4b4", marginTop: 4, fontSize: 11 }}>{voz.erro}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={() => voz.setMaosLivres(!voz.maosLivres)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,.65)", fontSize: 11, cursor: "pointer", padding: 0 }}>
              {voz.maosLivres ? "mãos livres" : "toque pra falar"}
            </button>
            <button onClick={() => { voz.parar(); setAberto(false); }} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,.65)", fontSize: 11, cursor: "pointer", padding: 0 }}>fechar</button>
          </div>
        </div>
      )}
      <button
        onClick={onMic}
        disabled={voz.fase === "pensando"}
        title="Falar com o Max"
        style={{
          width: 58, height: 58, borderRadius: "50%", border: "none", cursor: "pointer",
          background: voz.fase === "ouvindo" ? RED : NAVY, color: "#fff",
          boxShadow: voz.fase === "ouvindo" ? `0 0 0 8px ${RED}33, 0 8px 24px rgba(0,0,0,.4)` : "0 8px 24px rgba(0,0,0,.4)",
          fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center",
          transform: voz.fase === "falando" ? "scale(1.06)" : "scale(1)", transition: "transform .1s",
        }}
      >
        {voz.fase === "pensando" ? "…" : voz.fase === "ouvindo" ? "■" : "🎙"}
      </button>
    </div>
  );
}
