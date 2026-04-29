import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface ThemeColors {
  primary: string; // HSL format: "355 85% 50%"
  accent: string;
  background: string;
  foreground: string;
  card: string;
  muted: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  colors: ThemeColors;
  isDark: boolean;
}

export const themePresets: ThemePreset[] = [
  {
    id: "unv-brand-dark",
    name: "UNV Marca (Escuro)",
    isDark: true,
    colors: {
      primary: "355 85% 52%", // vermelho UNV
      accent: "0 0% 100%", // branco como destaque
      background: "214 70% 10%", // azul marinho profundo
      foreground: "0 0% 98%",
      card: "214 60% 14%",
      muted: "214 45% 22%",
    },
  },
  {
    id: "unv-brand-light",
    name: "UNV Marca (Claro)",
    isDark: false,
    colors: {
      primary: "355 85% 45%", // vermelho UNV
      accent: "214 70% 22%", // azul marinho
      background: "0 0% 100%", // branco
      foreground: "214 65% 12%", // azul marinho escuro p/ texto
      card: "0 0% 100%",
      muted: "214 25% 94%",
    },
  },
  {
    id: "default-light",
    name: "UNV Clássico",
    isDark: false,
    colors: {
      primary: "355 85% 50%",
      accent: "355 90% 55%",
      background: "0 0% 100%",
      foreground: "214 65% 15%",
      card: "0 0% 100%",
      muted: "214 15% 94%",
    },
  },
  {
    id: "default-dark",
    name: "UNV Escuro",
    isDark: true,
    colors: {
      primary: "355 85% 50%",
      accent: "355 90% 55%",
      background: "214 65% 12%",
      foreground: "0 0% 98%",
      card: "214 60% 16%",
      muted: "214 45% 24%",
    },
  },
  {
    id: "ocean-light",
    name: "Oceano",
    isDark: false,
    colors: {
      primary: "200 80% 50%",
      accent: "180 70% 45%",
      background: "200 20% 98%",
      foreground: "200 50% 15%",
      card: "0 0% 100%",
      muted: "200 15% 92%",
    },
  },
  {
    id: "ocean-dark",
    name: "Oceano Profundo",
    isDark: true,
    colors: {
      primary: "200 80% 55%",
      accent: "180 70% 50%",
      background: "200 50% 10%",
      foreground: "200 20% 95%",
      card: "200 45% 15%",
      muted: "200 35% 22%",
    },
  },
  {
    id: "forest-light",
    name: "Floresta",
    isDark: false,
    colors: {
      primary: "145 65% 40%",
      accent: "160 60% 45%",
      background: "140 15% 98%",
      foreground: "145 40% 15%",
      card: "0 0% 100%",
      muted: "145 12% 92%",
    },
  },
  {
    id: "forest-dark",
    name: "Floresta Noturna",
    isDark: true,
    colors: {
      primary: "145 65% 45%",
      accent: "160 60% 50%",
      background: "145 45% 10%",
      foreground: "145 15% 95%",
      card: "145 40% 14%",
      muted: "145 30% 20%",
    },
  },
  {
    id: "sunset-light",
    name: "Pôr do Sol",
    isDark: false,
    colors: {
      primary: "25 90% 55%",
      accent: "35 95% 50%",
      background: "30 20% 98%",
      foreground: "25 50% 15%",
      card: "0 0% 100%",
      muted: "30 15% 92%",
    },
  },
  {
    id: "sunset-dark",
    name: "Crepúsculo",
    isDark: true,
    colors: {
      primary: "25 90% 55%",
      accent: "35 95% 50%",
      background: "25 45% 10%",
      foreground: "30 15% 95%",
      card: "25 40% 14%",
      muted: "25 30% 20%",
    },
  },
  {
    id: "purple-light",
    name: "Lavanda",
    isDark: false,
    colors: {
      primary: "270 70% 55%",
      accent: "280 65% 60%",
      background: "270 15% 98%",
      foreground: "270 45% 15%",
      card: "0 0% 100%",
      muted: "270 12% 92%",
    },
  },
  {
    id: "purple-dark",
    name: "Noite Violeta",
    isDark: true,
    colors: {
      primary: "270 70% 60%",
      accent: "280 65% 65%",
      background: "270 45% 10%",
      foreground: "270 15% 95%",
      card: "270 40% 14%",
      muted: "270 30% 20%",
    },
  },
  {
    id: "rose-light",
    name: "Rosa Elegante",
    isDark: false,
    colors: {
      primary: "330 75% 55%",
      accent: "340 70% 60%",
      background: "330 15% 98%",
      foreground: "330 45% 15%",
      card: "0 0% 100%",
      muted: "330 12% 92%",
    },
  },
  {
    id: "rose-dark",
    name: "Rosa Noite",
    isDark: true,
    colors: {
      primary: "330 75% 55%",
      accent: "340 70% 60%",
      background: "330 45% 10%",
      foreground: "330 15% 95%",
      card: "330 40% 14%",
      muted: "330 30% 20%",
    },
  },
];

interface ThemeCustomizationContextType {
  currentPreset: ThemePreset;
  customColors: ThemeColors | null;
  setPreset: (presetId: string) => void;
  setCustomColors: (colors: ThemeColors) => void;
  resetToDefault: () => void;
  applyTheme: (colors: ThemeColors, isDark: boolean) => void;
  isCustom: boolean;
}

const ThemeCustomizationContext = createContext<ThemeCustomizationContextType | undefined>(undefined);

const STORAGE_KEY = "unv-theme-customization";

interface StoredTheme {
  presetId: string;
  customColors: ThemeColors | null;
}

export function ThemeCustomizationProvider({ children }: { children: ReactNode }) {
  const [currentPreset, setCurrentPreset] = useState<ThemePreset>(themePresets[0]);
  const [customColors, setCustomColorsState] = useState<ThemeColors | null>(null);

  // Load saved theme on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data: StoredTheme = JSON.parse(stored);
        const preset = themePresets.find((p) => p.id === data.presetId) || themePresets[0];
        setCurrentPreset(preset);
        setCustomColorsState(data.customColors);
        
        // Apply the theme
        const colorsToApply = data.customColors || preset.colors;
        applyThemeToDOM(colorsToApply, preset.isDark);
      } catch (e) {
        console.error("Failed to parse stored theme:", e);
      }
    }
  }, []);

  const applyThemeToDOM = (colors: ThemeColors, isDark: boolean) => {
    const root = document.documentElement;
    
    // Toggle dark class
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Apply CSS variables
    root.style.setProperty("--primary", colors.primary);
    root.style.setProperty("--accent", colors.accent);
    root.style.setProperty("--background", colors.background);
    root.style.setProperty("--foreground", colors.foreground);
    root.style.setProperty("--card", colors.card);
    root.style.setProperty("--card-foreground", colors.foreground);
    root.style.setProperty("--muted", colors.muted);
    root.style.setProperty("--popover", colors.card);
    root.style.setProperty("--popover-foreground", colors.foreground);
    
    // Update ring to match primary
    root.style.setProperty("--ring", colors.primary);
    
    // Update secondary based on background
    if (isDark) {
      root.style.setProperty("--secondary", colors.muted);
      root.style.setProperty("--secondary-foreground", colors.foreground);
    } else {
      root.style.setProperty("--secondary", colors.muted);
      root.style.setProperty("--secondary-foreground", colors.foreground);
    }
  };

  const saveToStorage = (presetId: string, colors: ThemeColors | null) => {
    const data: StoredTheme = { presetId, customColors: colors };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const setPreset = (presetId: string) => {
    const preset = themePresets.find((p) => p.id === presetId);
    if (preset) {
      setCurrentPreset(preset);
      setCustomColorsState(null);
      applyThemeToDOM(preset.colors, preset.isDark);
      saveToStorage(presetId, null);
    }
  };

  const setCustomColors = (colors: ThemeColors) => {
    setCustomColorsState(colors);
    applyThemeToDOM(colors, currentPreset.isDark);
    saveToStorage(currentPreset.id, colors);
  };

  const resetToDefault = () => {
    setCurrentPreset(themePresets[0]);
    setCustomColorsState(null);
    applyThemeToDOM(themePresets[0].colors, themePresets[0].isDark);
    localStorage.removeItem(STORAGE_KEY);
  };

  const applyTheme = (colors: ThemeColors, isDark: boolean) => {
    applyThemeToDOM(colors, isDark);
  };

  return (
    <ThemeCustomizationContext.Provider
      value={{
        currentPreset,
        customColors,
        setPreset,
        setCustomColors,
        resetToDefault,
        applyTheme,
        isCustom: customColors !== null,
      }}
    >
      {children}
    </ThemeCustomizationContext.Provider>
  );
}

export function useThemeCustomization() {
  const context = useContext(ThemeCustomizationContext);
  if (context === undefined) {
    throw new Error("useThemeCustomization must be used within a ThemeCustomizationProvider");
  }
  return context;
}
