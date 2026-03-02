import { useState, useEffect, useCallback } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Already installed as standalone
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // Dismissed this session
    if (sessionStorage.getItem("pwa-prompt-dismissed")) return;

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      // Show iOS instructions after short delay
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Chrome/Edge/Samsung: capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 2000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    sessionStorage.setItem("pwa-prompt-dismissed", "1");
  }, []);

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-500">
      <div className="relative rounded-xl border border-border bg-card p-4 shadow-2xl">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        {isIOS ? (
          <div className="flex items-start gap-3 pr-6">
            <Share className="h-8 w-8 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-foreground">Instalar UNV Nexus</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Toque em{" "}
                <span className="inline-flex items-center font-medium text-primary">
                  Compartilhar <Share className="h-3 w-3 mx-0.5 inline" />
                </span>{" "}
                e depois em <strong>"Adicionar à Tela de Início"</strong>.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 pr-6">
            <Download className="h-8 w-8 text-primary shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">Instalar UNV Nexus</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acesse rápido direto da tela inicial.
              </p>
            </div>
            <Button size="sm" onClick={handleInstall} className="shrink-0">
              Instalar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
