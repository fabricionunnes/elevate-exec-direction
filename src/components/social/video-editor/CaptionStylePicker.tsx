import { cn } from "@/lib/utils";

export const CAPTION_STYLES = {
  default: {
    label: "Padrão",
    className: "text-white text-lg font-semibold drop-shadow-lg",
    bg: "bg-black/60 px-3 py-1.5 rounded-lg",
  },
  hormozi: {
    label: "Hormozi",
    className: "text-yellow-400 text-2xl font-black uppercase tracking-wide",
    bg: "bg-black/80 px-4 py-2 rounded-md",
  },
  captions: {
    label: "Captions",
    className: "text-white text-xl font-bold",
    bg: "bg-gradient-to-r from-purple-600/80 to-pink-600/80 px-4 py-2 rounded-xl",
  },
  minimal: {
    label: "Minimal",
    className: "text-white text-base font-medium",
    bg: "px-2 py-1",
  },
  bold: {
    label: "Bold",
    className: "text-white text-2xl font-black",
    bg: "bg-red-600/90 px-4 py-2 rounded-sm",
  },
  neon: {
    label: "Neon",
    className: "text-green-400 text-xl font-bold",
    bg: "bg-black/70 px-3 py-1.5 rounded-lg border border-green-400/50",
  },
} as const;

export type CaptionStyleKey = keyof typeof CAPTION_STYLES;

interface CaptionStylePickerProps {
  value: CaptionStyleKey;
  onChange: (style: CaptionStyleKey) => void;
  disabled?: boolean;
}

export const CaptionStylePicker = ({ value, onChange, disabled }: CaptionStylePickerProps) => {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.entries(CAPTION_STYLES) as [CaptionStyleKey, typeof CAPTION_STYLES[CaptionStyleKey]][]).map(
        ([key, style]) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(key)}
            className={cn(
              "relative h-16 rounded-lg border-2 transition-all overflow-hidden flex items-end justify-center pb-1",
              "bg-gradient-to-b from-gray-800 to-gray-900",
              value === key
                ? "border-primary ring-1 ring-primary"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <span className={cn(style.bg, style.className, "!text-[10px] leading-tight text-center")}>
              {style.label}
            </span>
          </button>
        )
      )}
    </div>
  );
};
