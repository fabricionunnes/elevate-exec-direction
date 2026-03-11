import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeCustomization, themePresets } from "@/contexts/ThemeCustomizationContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { currentPreset, setPreset } = useThemeCustomization();

  // Quick toggle between light/dark of same base theme
  const toggleDarkMode = () => {
    const baseId = currentPreset.id.replace("-light", "").replace("-dark", "");
    const targetId = currentPreset.isDark ? `${baseId}-light` : `${baseId}-dark`;
    const target = themePresets.find((p) => p.id === targetId);
    if (target) {
      setPreset(target.id);
    } else {
      // Fallback to default light/dark
      setPreset(currentPreset.isDark ? "default-light" : "default-dark");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
          {currentPreset.isDark ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">Aparência</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleDarkMode} className="gap-2 cursor-pointer">
          {currentPreset.isDark ? (
            <>
              <Sun className="h-4 w-4" />
              Modo Claro
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" />
              Modo Escuro
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs">Temas</DropdownMenuLabel>
        {themePresets
          .filter((p) => p.isDark === currentPreset.isDark)
          .map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => setPreset(preset.id)}
              className="gap-2 cursor-pointer"
            >
              <div
                className="w-4 h-4 rounded-full border"
                style={{ backgroundColor: `hsl(${preset.colors.primary})` }}
              />
              <span className={currentPreset.id === preset.id ? "font-semibold" : ""}>
                {preset.name}
              </span>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
