import { Check, Moon, Sun, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { themePresets, ThemePreset, useThemeCustomization } from "@/contexts/ThemeCustomizationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ThemeSelector() {
  const { currentPreset, setPreset, isCustom } = useThemeCustomization();

  // Group presets by base theme
  const lightPresets = themePresets.filter((p) => !p.isDark);
  const darkPresets = themePresets.filter((p) => p.isDark);

  const PresetCard = ({ preset }: { preset: ThemePreset }) => {
    const isSelected = currentPreset.id === preset.id && !isCustom;

    return (
      <button
        onClick={() => setPreset(preset.id)}
        className={cn(
          "relative flex flex-col items-start p-3 rounded-lg border-2 transition-all duration-200 text-left w-full",
          isSelected
            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        {/* Color preview */}
        <div className="flex gap-1 mb-2">
          <div
            className="w-6 h-6 rounded-full border border-border/50 shadow-sm"
            style={{ backgroundColor: `hsl(${preset.colors.primary})` }}
          />
          <div
            className="w-6 h-6 rounded-full border border-border/50 shadow-sm"
            style={{ backgroundColor: `hsl(${preset.colors.accent})` }}
          />
          <div
            className="w-6 h-6 rounded-full border border-border/50 shadow-sm"
            style={{ backgroundColor: `hsl(${preset.colors.background})` }}
          />
        </div>

        {/* Name */}
        <span className="text-sm font-medium">{preset.name}</span>

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2">
            <Check className="h-4 w-4 text-primary" />
          </div>
        )}
      </button>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Temas Predefinidos
        </CardTitle>
        <CardDescription>
          Escolha um tema para personalizar a aparência da plataforma
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Light Themes */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Temas Claros</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {lightPresets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} />
            ))}
          </div>
        </div>

        {/* Dark Themes */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Temas Escuros</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {darkPresets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} />
            ))}
          </div>
        </div>

        {isCustom && (
          <Badge variant="secondary" className="mt-2">
            Cores customizadas aplicadas
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
