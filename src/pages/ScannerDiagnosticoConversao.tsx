import { useEffect } from "react";

/**
 * Página oculta para disparar o Meta Pixel (PageView + Lead) em uma URL
 * dedicada, usada para criar uma Conversão Personalizada no Gerenciador de
 * Anúncios baseada nesta URL específica.
 *
 * É carregada via <iframe> invisível dentro do Scanner de Vendas UNV
 * quando o lead chega na tela do diagnóstico final (etapa 7).
 */
const ScannerDiagnosticoConversao = () => {
  useEffect(() => {
    const pixelId = "247392077001023";
    try {
      (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod
            ? n.callMethod.apply(n, arguments)
            : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = "2.0";
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(
        window,
        document,
        "script",
        "https://connect.facebook.net/en_US/fbevents.js"
      );

      (window as any).fbq("init", pixelId);
      (window as any).fbq("track", "PageView");
      (window as any).fbq("track", "Lead");

      const noscript = document.createElement("noscript");
      const img = document.createElement("img");
      img.height = 1;
      img.width = 1;
      img.style.display = "none";
      img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=Lead&noscript=1`;
      noscript.appendChild(img);
      document.body.appendChild(noscript);
    } catch {
      /* silent */
    }
  }, []);

  return (
    <div style={{ width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
      <span className="sr-only">Conversão de diagnóstico registrada</span>
    </div>
  );
};

export default ScannerDiagnosticoConversao;
