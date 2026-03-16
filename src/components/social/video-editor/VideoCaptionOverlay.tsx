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
    <div className="absolute bottom-[8%] left-[5%] right-[5%] flex justify-center pointer-events-none z-10">
      <div className={cn(style.bg, "max-w-full text-center px-3 py-1.5")}>
        <span className={cn(style.className, "text-sm sm:text-base md:text-lg leading-tight break-words")}>{activeCaption.text}</span>
      </div>
    </div>
  );
};
