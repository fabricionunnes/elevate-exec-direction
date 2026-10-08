import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vinho: { 50: "#fdf2f5", 100: "#fbe4ea", 200: "#f7c6d2", 300: "#ef9bb0", 400: "#e46683", 500: "#dc3a5c", 600: "#cd2345", 700: "#a81b38", 800: "#85152c", 900: "#5f0e1f" },
        rosa: { 100: "#fde9ee", 200: "#fbd0da", 300: "#f6b1c1", 400: "#f08ea6", 500: "#e86f8d" },
        choco: { 50: "#faf5ef", 100: "#f3e7d8", 200: "#e6ccae", 300: "#d4a97c", 400: "#b8804d", 500: "#8c5a2b", 600: "#6b4220", 700: "#5a2a1a", 800: "#43200f", 900: "#2e150a" },
        caramelo: { 400: "#e6a35a", 500: "#d98a3a", 600: "#b86f26" },
        creme: "#fdf3e6",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      boxShadow: { soft: "0 8px 30px -12px rgba(90,42,26,0.25)", card: "0 2px 12px -4px rgba(90,42,26,0.18)" },
    },
  },
  plugins: [],
} satisfies Config;
