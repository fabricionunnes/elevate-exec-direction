import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gauge, FileText, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import cockpitHtml from "@/data/cockpit/cockpit-unv.html?raw";
import planoHtml from "@/data/cockpit/plano-unv.html?raw";

// Página privada do CEO: Cockpit de projeção da escada comercial + plano estratégico.
// O conteúdo é HTML estático embutido no bundle (srcdoc), não fica em URL pública.
const CEO_EMAIL = "fabricio@universidadevendas.com.br";

type Tab = "cockpit" | "plano";

const tabs: { value: Tab; label: string; icon: typeof Gauge; hint: string }[] = [
  { value: "cockpit", label: "Cockpit", icon: Gauge, hint: "Projeção 36 meses · 3 cenários · métricas por produto e evento" },
  { value: "plano", label: "Plano estratégico", icon: FileText, hint: "Redesenho Comercial UNV · escada de 7 degraus" },
];

function wrapHtml(body: string, dark: boolean) {
  return `<!doctype html><html lang="pt-BR" data-theme="${dark ? "dark" : "light"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${body}</body></html>`;
}

export default function CockpitPage() {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem("cockpit-page-tab");
      return saved === "plano" ? "plano" : "cockpit";
    } catch {
      return "cockpit";
    }
  });
  const [dark, setDark] = useState<boolean>(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    let cancelled = false;
    const checkAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setIsAuthorized(false);
          navigate("/onboarding-tasks/login");
          return;
        }
        if (user.email?.toLowerCase() !== CEO_EMAIL) {
          setIsAuthorized(false);
          navigate("/onboarding-tasks");
          return;
        }
        setIsAuthorized(true);
      } catch (err) {
        console.error("Error checking cockpit access:", err);
        if (!cancelled) {
          setIsAuthorized(false);
          navigate("/onboarding-tasks/login");
        }
      }
    };
    checkAccess();
    return () => { cancelled = true; };
  }, [navigate]);

  // Acompanha o tema do Nexus (classe `dark` no <html>) pra repassar ao iframe.
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    try { localStorage.setItem("cockpit-page-tab", tab); } catch { /* ignore */ }
  }, [tab]);

  const cockpitDoc = useMemo(() => wrapHtml(cockpitHtml, dark), [dark]);
  const planoDoc = useMemo(() => wrapHtml(planoHtml, dark), [dark]);

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthorized) return null;

  const current = tabs.find((t) => t.value === tab)!;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/onboarding-tasks")}
            className="h-9 w-9 shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-foreground leading-tight">Cockpit UNV</h1>
            <p className="text-muted-foreground text-[11px] sm:text-xs truncate">{current.hint}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors",
                tab === t.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-pressed={tab === t.value}
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {/* Os dois iframes ficam montados pra não perder estado (filtros, premissas) ao alternar. */}
        <iframe
          title="Cockpit UNV"
          srcDoc={cockpitDoc}
          className={cn("absolute inset-0 w-full h-full border-0 bg-background", tab !== "cockpit" && "invisible")}
        />
        <iframe
          title="Plano estratégico UNV"
          srcDoc={planoDoc}
          className={cn("absolute inset-0 w-full h-full border-0 bg-background", tab !== "plano" && "invisible")}
        />
      </div>

      <div className="hidden sm:flex items-center justify-between px-5 py-1 border-t border-border text-[11px] text-muted-foreground shrink-0">
        <span>Somente CEO · premissas e realizado ficam salvos neste navegador</span>
        <a
          href="https://claude.ai/code/artifact/696265f2-c202-468f-9ff7-4469f636597a"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          Abrir versão publicada <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
