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
      {activeOverlays.map((overlay) => (
        <div
          key={overlay.id}
          className="absolute pointer-events-none z-20 transition-all duration-200"
          style={{
            left: `${overlay.x}%`,
            top: `${overlay.y}%`,
            transform: `translate(-50%, -50%) scale(${overlay.scale})`,
            fontSize: `${Math.max(24, 32 * overlay.scale)}px`,
          }}
        >
          {overlay.content}
        </div>
      ))}
    </>
  );
};
