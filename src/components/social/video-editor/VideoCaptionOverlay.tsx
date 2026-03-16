import { cn } from "@/lib/utils";
import { CAPTION_STYLES, CaptionStyleKey } from "./CaptionStylePicker";

export interface VideoCaption {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
  style_preset: CaptionStyleKey;
  sort_order: number;
}

interface VideoCaptionOverlayProps {
  captions: VideoCaption[];
  currentTime: number;
  styleOverride?: CaptionStyleKey;
}

export const VideoCaptionOverlay = ({ captions, currentTime, styleOverride }: VideoCaptionOverlayProps) => {
  const activeCaption = captions.find(
    (c) => currentTime >= c.start_time && currentTime <= c.end_time
  );

  if (!activeCaption) return null;

  const style = CAPTION_STYLES[styleOverride || activeCaption.style_preset] || CAPTION_STYLES.default;

  return (
    <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none z-10">
      <div className={cn(style.bg, "max-w-[90%] text-center")}>
        <span className={style.className}>{activeCaption.text}</span>
      </div>
    </div>
  );
};
