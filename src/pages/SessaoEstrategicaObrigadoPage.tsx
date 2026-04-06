import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

const SessaoEstrategicaObrigadoPage = () => {
  // Meta Pixel + Conversion Event
  useEffect(() => {
    const pixelId = '247392077001023';
    (function(f: any,b: any,e: any,v: any,n?: any,t?: any,s?: any){
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)
    })(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    (window as any).fbq('init', pixelId);
    (window as any).fbq('track', 'PageView');
    // Conversion event
    (window as any).fbq('track', 'Lead');

    const noscript = document.createElement('noscript');
    const img = document.createElement('img');
    img.height = 1;
    img.width = 1;
    img.style.display = 'none';
    img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=Lead&noscript=1`;
    noscript.appendChild(img);
    document.body.appendChild(noscript);

    return () => { noscript.remove(); };
  }, []);
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.06)_0%,_transparent_70%)]" />
      
      <div className="relative z-10 max-w-lg w-full text-center space-y-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Parabéns! Sua inscrição foi{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-500">
              confirmada!
            </span>
          </h1>

          <p className="text-gray-400 text-lg leading-relaxed">
            Nosso time já recebeu suas informações e entrará em contato com você
            muito em breve para agendar sua <strong className="text-white">análise estratégica gratuita.</strong>
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-gray-800/50 bg-gray-900/30 space-y-3">
          <h3 className="font-semibold text-lg">Próximos passos:</h3>
          <ul className="text-gray-400 text-left space-y-2">
            <li className="flex items-start gap-3">
              <span className="text-red-500 font-bold mt-0.5">1.</span>
              <span>Nossa equipe vai entrar em contato pelo WhatsApp</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-red-500 font-bold mt-0.5">2.</span>
              <span>Vamos agendar o melhor horário para sua análise</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-red-500 font-bold mt-0.5">3.</span>
              <span>Você receberá um plano personalizado para suas vendas</span>
            </li>
          </ul>
        </div>

        <p className="text-sm text-gray-600">
          Universidade Nacional de Vendas LTDA
        </p>
      </div>
    </div>
  );
};

export default SessaoEstrategicaObrigadoPage;
