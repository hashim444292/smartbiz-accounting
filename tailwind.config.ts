import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        corporate: {
          teal: "#0f766e",
          "teal-dark": "#115e59",
          "teal-light": "#f0fdfa",
        },
        dark: {
          bg: "#0b1120",
          surface: "#111827",
          card: "#151f32",
          border: "#1e293b",
          "border-subtle": "#273449",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Manrope",
          "Outfit",
          "DM Sans",
          "Plus Jakarta Sans",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        inter: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        manrope: ["Manrope", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        outfit: ["Outfit", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        dmsans: ["DM Sans", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        jakarta: ["Plus Jakarta Sans", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgb(0 0 0 / 0.03)",
        card: "0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)",
        elevation: "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
        dropdown: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
      },
    },
  },
  plugins: [],
};
export default config;
