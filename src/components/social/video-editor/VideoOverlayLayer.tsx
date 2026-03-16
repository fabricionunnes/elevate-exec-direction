import { cn } from "@/lib/utils";

export interface VideoOverlay {
  id: string;
  overlay_type: string;
  content: string;
  x: number;
  y: number;
  scale: number;
  start_time: number;
  end_time: number;
  animation: string;
}

interface VideoOverlayLayerProps {
  overlays: VideoOverlay[];
  currentTime: number;
}

export const VideoOverlayLayer = ({ overlays, currentTime }: VideoOverlayLayerProps) => {
  const activeOverlays = overlays.filter(
    (o) => currentTime >= o.start_time && currentTime <= o.end_time
  );

  if (activeOverlays.length === 0) return null;

  return (
    <>
      {activeOverlays.map((overlay) => {
        const progress = Math.min(1, (currentTime - overlay.start_time) / Math.max(0.1, overlay.end_time - overlay.start_time));

        switch (overlay.overlay_type) {
          case "headline":
            return (
              <div
                key={overlay.id}
                className="absolute left-[5%] right-[5%] z-30 flex justify-center pointer-events-none"
                style={{
                  top: `${overlay.y}%`,
                  opacity: progress < 0.1 ? progress / 0.1 : progress > 0.85 ? (1 - progress) / 0.15 : 1,
                  transform: `scale(${progress < 0.1 ? 0.8 + 0.2 * (progress / 0.1) : 1})`,
                  transition: "opacity 0.15s, transform 0.15s",
                }}
              >
                <div className="bg-gradient-to-r from-red-600 to-orange-500 px-4 py-2 rounded-lg shadow-2xl">
                  <span className="text-white font-black text-base sm:text-lg md:text-xl uppercase tracking-wide drop-shadow-lg">
                    {overlay.content}
                  </span>
                </div>
              </div>
            );

          case "text_highlight":
            return (
              <div
                key={overlay.id}
                className="absolute pointer-events-none z-25 flex justify-center"
                style={{
                  left: `${Math.max(5, overlay.x - 20)}%`,
                  right: `${Math.max(5, 100 - overlay.x - 20)}%`,
                  top: `${overlay.y}%`,
                  transform: `translateY(-50%)`,
                  opacity: progress < 0.08 ? progress / 0.08 : progress > 0.9 ? (1 - progress) / 0.1 : 1,
                  transition: "opacity 0.1s",
                }}
              >
                <div className="bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-md border border-white/20 shadow-lg">
                  <span className="text-white font-bold text-xs sm:text-sm md:text-base whitespace-nowrap">
                    {overlay.content}
                  </span>
                </div>
              </div>
            );

          case "zoom_cue":
            return (
              <div
                key={overlay.id}
                className="absolute inset-0 pointer-events-none z-5"
                style={{
                  transform: `scale(${1 + 0.08 * Math.sin(progress * Math.PI)})`,
                  transition: "transform 0.3s ease-out",
                  boxShadow: `inset 0 0 ${40 * Math.sin(progress * Math.PI)}px rgba(255,255,255,0.08)`,
                }}
              />
            );

          case "broll_keyword":
            return (
              <div
                key={overlay.id}
                className="absolute pointer-events-none z-20 flex items-center justify-center"
                style={{
                  left: `${overlay.x - 15}%`,
                  top: `${overlay.y - 10}%`,
                  width: "30%",
                  height: "20%",
                  opacity: progress < 0.1 ? progress / 0.1 : progress > 0.85 ? (1 - progress) / 0.15 : 0.85,
                  transition: "opacity 0.15s",
                }}
              >
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3 py-2 text-center shadow-xl">
                  <span className="text-white/90 text-2xl block mb-0.5">
                    {getBrollEmoji(overlay.content)}
                  </span>
                  <span className="text-white/80 text-[10px] sm:text-xs font-medium uppercase tracking-wider">
                    {overlay.content}
                  </span>
                </div>
              </div>
            );

          default:
            // emoji type
            return (
              <div
                key={overlay.id}
                className="absolute pointer-events-none z-20 transition-all duration-200"
                style={{
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  transform: `translate(-50%, -50%) scale(${overlay.scale * (progress < 0.15 ? 0.5 + 3.3 * progress : 1)})`,
                  opacity: progress < 0.1 ? progress / 0.1 : progress > 0.85 ? (1 - progress) / 0.15 : 1,
                  fontSize: `${Math.max(24, 32 * overlay.scale)}px`,
                }}
              >
                {overlay.content}
              </div>
            );
        }
      })}
    </>
  );
};

function getBrollEmoji(keyword: string): string {
  const map: Record<string, string> = {
    dinheiro: "💰", money: "💰", grana: "💰", lucro: "💰", faturamento: "💰", receita: "💰",
    crescimento: "📈", growth: "📈", aumento: "📈", subir: "📈",
    equipe: "👥", team: "👥", time: "👥", pessoas: "👥", grupo: "👥",
    cliente: "🤝", clientes: "🤝", venda: "🤝", vendas: "🤝",
    estratégia: "♟️", estrategia: "♟️", plano: "♟️", planejamento: "♟️",
    sucesso: "🏆", resultado: "🏆", meta: "🏆", objetivo: "🏆",
    erro: "❌", problema: "❌", falha: "❌", risco: "⚠️",
    ideia: "💡", inovação: "💡", criatividade: "💡", solução: "💡",
    tempo: "⏰", prazo: "⏰", urgente: "⏰", rápido: "⚡",
    tecnologia: "💻", digital: "💻", sistema: "💻", software: "💻",
    energia: "⚡", força: "💪", poder: "💪", motivação: "🔥",
    atenção: "👀", foco: "🎯", importante: "⚠️", cuidado: "⚠️",
    celular: "📱", telefone: "📱", whatsapp: "📱",
    casa: "🏠", imóvel: "🏠",
    carro: "🚗", veículo: "🚗",
    comida: "🍽️", alimentação: "🍽️", restaurante: "🍽️",
    saúde: "🏥", médico: "🏥", saude: "🏥",
    educação: "📚", estudo: "📚", aprender: "📚", curso: "📚",
    viagem: "✈️", viajar: "✈️",
    amor: "❤️", coração: "❤️",
    música: "🎵", musica: "🎵",
  };

  const lower = keyword.toLowerCase().trim();
  for (const [key, emoji] of Object.entries(map)) {
    if (lower.includes(key)) return emoji;
  }
  return "🔹";
}
