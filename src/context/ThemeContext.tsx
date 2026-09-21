"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type FontFamily = "inter" | "manrope" | "outfit" | "dmsans" | "jakarta";

export interface FontOption {
  id: FontFamily;
  name: string;
  category: string;
  className: string;
  description: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "inter",
    name: "Inter",
    category: "Precision SaaS",
    className: "font-preview-inter",
    description: "Crisp, hyper-readable typeface designed for modern financial UI (Stripe & Linear standard)",
  },
  {
    id: "manrope",
    name: "Manrope",
    category: "Fintech Modern",
    className: "font-preview-manrope",
    description: "Semi-geometric grotesque with sharp numeric balance, popular in modern neobanks & corporate ERPs",
  },
  {
    id: "outfit",
    name: "Outfit",
    category: "Geometric Clean",
    className: "font-preview-outfit",
    description: "Modern, open, geometric sans-serif that brings clarity and breathing room to complex dashboards",
  },
  {
    id: "dmsans",
    name: "DM Sans",
    category: "Corporate & Banking",
    className: "font-preview-dmsans",
    description: "Executive low-contrast grotesque offering rock-solid stability for ledgers, invoices & tax forms",
  },
  {
    id: "jakarta",
    name: "Plus Jakarta",
    category: "Contemporary Display",
    className: "font-preview-jakarta",
    description: "Punchy, modern display typeface with clean circular geometry and bold presence",
  },
];

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  font: FontFamily;
  setFont: (font: FontFamily) => void;
  fontOptions: FontOption[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const ALL_FONT_CLASSES = ["font-inter", "font-manrope", "font-outfit", "font-dmsans", "font-jakarta"];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [font, setFontState] = useState<FontFamily>("inter");
  const [mounted, setMounted] = useState(false);

  // Initialize theme and font from localStorage
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem("sb_theme") as Theme | null;
      if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
        setThemeState(storedTheme);
      }

      const storedFont = localStorage.getItem("sb_font") as FontFamily | null;
      if (
        storedFont === "inter" ||
        storedFont === "manrope" ||
        storedFont === "outfit" ||
        storedFont === "dmsans" ||
        storedFont === "jakarta"
      ) {
        setFontState(storedFont);
      }
    } catch {}
    setMounted(true);
  }, []);

  // Synchronize Font Class onto documentElement
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    ALL_FONT_CLASSES.forEach((cls) => root.classList.remove(cls));
    root.classList.add(`font-${font}`);
  }, [font, mounted]);

  // Compute resolved theme and update DOM class
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      let resolved: ResolvedTheme = "light";
      if (theme === "system") {
        resolved = mediaQuery.matches ? "dark" : "light";
      } else {
        resolved = theme;
      }

      setResolvedTheme(resolved);

      const root = document.documentElement;
      if (resolved === "dark") {
        root.classList.add("dark");
        root.style.colorScheme = "dark";
      } else {
        root.classList.remove("dark");
        root.style.colorScheme = "light";
      }
    };

    applyTheme();

    const listener = () => {
      if (theme === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("sb_theme", newTheme);
    } catch {}
  };

  const toggleTheme = () => {
    if (resolvedTheme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  const setFont = (newFont: FontFamily) => {
    setFontState(newFont);
    try {
      localStorage.setItem("sb_font", newFont);
    } catch {}
  };

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
      font,
      setFont,
      fontOptions: FONT_OPTIONS,
    }),
    [theme, resolvedTheme, font]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: "system",
      resolvedTheme: "light",
      setTheme: () => {},
      toggleTheme: () => {},
      font: "inter",
      setFont: () => {},
      fontOptions: FONT_OPTIONS,
    };
  }
  return context;
}

