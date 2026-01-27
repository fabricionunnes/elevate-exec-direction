import { useState, useEffect } from "react";
import { Paintbrush, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useThemeCustomization, ThemeColors } from "@/contexts/ThemeCustomizationContext";
import { toast } from "sonner";

// Helper to convert HSL string to hex
function hslToHex(hsl: string): string {
  const [h, s, l] = hsl.split(" ").map((v) => parseFloat(v.replace("%", "")));
  const hDecimal = l / 100;
  const a = (s / 100) * Math.min(hDecimal, 1 - hDecimal);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = hDecimal - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Helper to convert hex to HSL string
function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 0% 50%";

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

interface ColorPickerRowProps {
  label: string;
  description: string;
  value: string;
  onChange: (hsl: string) => void;
}

function ColorPickerRow({ label, description, value, onChange }: ColorPickerRowProps) {
  const hexValue = hslToHex(value);

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-md border border-border shadow-sm"
          style={{ backgroundColor: `hsl(${value})` }}
        />
        <Input
          type="color"
          value={hexValue}
          onChange={(e) => onChange(hexToHsl(e.target.value))}
          className="w-12 h-8 p-0.5 cursor-pointer"
        />
      </div>
    </div>
  );
}

export function ColorCustomizer() {
  const { currentPreset, customColors, setCustomColors, resetToDefault, applyTheme } = useThemeCustomization();
  
  const activeColors = customColors || currentPreset.colors;
  
  const [localColors, setLocalColors] = useState<ThemeColors>(activeColors);

  // Sync local colors when preset changes
  useEffect(() => {
    setLocalColors(customColors || currentPreset.colors);
  }, [currentPreset, customColors]);

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    const newColors = { ...localColors, [key]: value };
    setLocalColors(newColors);
    // Live preview
    applyTheme(newColors, currentPreset.isDark);
  };

  const handleApply = () => {
    setCustomColors(localColors);
    toast.success("Cores personalizadas aplicadas!");
  };

  const handleReset = () => {
    resetToDefault();
    toast.success("Tema redefinido para o padrão");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paintbrush className="h-5 w-5" />
          Cores Personalizadas
        </CardTitle>
        <CardDescription>
          Ajuste as cores individualmente para criar seu próprio tema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ColorPickerRow
          label="Cor Primária"
          description="Botões, links e elementos de destaque"
          value={localColors.primary}
          onChange={(v) => handleColorChange("primary", v)}
        />
        
        <ColorPickerRow
          label="Cor de Destaque"
          description="Elementos secundários de destaque"
          value={localColors.accent}
          onChange={(v) => handleColorChange("accent", v)}
        />
        
        <ColorPickerRow
          label="Fundo"
          description="Cor de fundo principal"
          value={localColors.background}
          onChange={(v) => handleColorChange("background", v)}
        />
        
        <ColorPickerRow
          label="Texto"
          description="Cor principal do texto"
          value={localColors.foreground}
          onChange={(v) => handleColorChange("foreground", v)}
        />
        
        <ColorPickerRow
          label="Cartões"
          description="Fundo de cartões e painéis"
          value={localColors.card}
          onChange={(v) => handleColorChange("card", v)}
        />
        
        <ColorPickerRow
          label="Elementos Suaves"
          description="Fundos secundários e bordas"
          value={localColors.muted}
          onChange={(v) => handleColorChange("muted", v)}
        />

        <div className="flex gap-2 pt-4">
          <Button onClick={handleApply} className="flex-1">
            Aplicar Cores
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Redefinir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
