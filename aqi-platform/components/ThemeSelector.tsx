"use client";

import { useEffect, useState, useRef } from "react";
import { Palette, Check, Sparkles } from "lucide-react";

export interface ThemeOption {
  id: string;
  name: string;
  badge: string;
  primary: string;
  secondary: string;
  bg: string;
  description: string;
}

export const THEMES: ThemeOption[] = [
  {
    id: "pearl",
    name: "Pearl Luxury Light",
    badge: "Azure & Crystal Aqua",
    primary: "#0284c7",
    secondary: "#06b6d4",
    bg: "#f4f6fa",
    description: "Pristine alabaster porcelain with delicate sky azure and crystal aqua radiance",
  },
  {
    id: "nordic",
    name: "Nordic Frost Glass",
    badge: "Cobalt & Glacier Teal",
    primary: "#2563eb",
    secondary: "#0891b2",
    bg: "#f0f4f9",
    description: "Crisp snow white porcelain with arctic cobalt and glacier cyan accents",
  },
  {
    id: "champagne",
    name: "Rose Champagne Luxe",
    badge: "Topaz Gold & Rose Quartz",
    primary: "#d97706",
    secondary: "#e11d48",
    bg: "#faf7f2",
    description: "Warm ivory porcelain with champagne amber gold and soft rose quartz",
  },
  {
    id: "lilac",
    name: "Neo Lilac Light",
    badge: "Iris Violet & Sky Blue",
    primary: "#7c3aed",
    secondary: "#0284c7",
    bg: "#f8f6fc",
    description: "Delicate lilac porcelain with royal iris and celestial sky azure",
  },
  {
    id: "sage",
    name: "Emerald Botanical",
    badge: "Jade Mint & Teal",
    primary: "#059669",
    secondary: "#0d9488",
    bg: "#f3f7f5",
    description: "Botanical sage porcelain with fresh jade mint and eucalyptus teal",
  },
  {
    id: "cosmic",
    name: "Cosmic Obsidian Dark",
    badge: "Violet & Hyper Cyan",
    primary: "#8b5cf6",
    secondary: "#00f5ff",
    bg: "#060814",
    description: "Deep space obsidian with electric violet and neon aqua",
  },
];

export default function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState<string>("pearl");
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("airpulse_theme_v3");
      if (saved && THEMES.some(t => t.id === saved)) {
        setCurrentTheme(saved);
        document.documentElement.setAttribute("data-theme", saved);
      } else {
        setCurrentTheme("pearl");
        document.documentElement.setAttribute("data-theme", "pearl");
      }
    } catch {
      document.documentElement.setAttribute("data-theme", "pearl");
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectTheme = (themeId: string) => {
    setCurrentTheme(themeId);
    document.documentElement.setAttribute("data-theme", themeId);
    try {
      localStorage.setItem("airpulse_theme_v3", themeId);
    } catch {
      // storage disabled
    }
    setIsOpen(false);
  };

  const active = THEMES.find(t => t.id === currentTheme) || THEMES[0];

  return (
    <div style={{ position: "relative" }} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--bg-card)",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--text-primary)",
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: "0 1px 4px rgba(15, 23, 42, 0.05)",
        }}
        aria-label="Change color palette"
        title="Change Aesthetic Color Palette"
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${active.primary}, ${active.secondary})`,
            boxShadow: `0 0 8px ${active.primary}`,
          }}
        />
        <Palette size={13} style={{ color: "var(--mint)" }} />
        <span style={{ fontSize: 11.5 }}>{active.name}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 310,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            boxShadow: "var(--sh-float)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            padding: 10,
            zIndex: 9999,
            animation: "fadeUpIn 0.2s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <div
            style={{
              padding: "8px 10px 10px",
              borderBottom: "1px solid var(--border)",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "var(--text-muted)",
              }}
            >
              Curated Light & Dark Palettes
            </span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: "var(--mint)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Sparkles size={11} /> 6 Palettes
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {THEMES.map(t => {
              const isSelected = t.id === currentTheme;
              return (
                <button
                  key={t.id}
                  onClick={() => selectTheme(t.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: isSelected ? "var(--bg-glass-md)" : "transparent",
                    border: isSelected ? "1px solid var(--border-bright)" : "1px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.16s ease",
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = "var(--bg-glass)";
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 8,
                        background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})`,
                        boxShadow: isSelected ? `0 0 10px ${t.primary}` : "none",
                        flexShrink: 0,
                        border: "1px solid rgba(15, 23, 42, 0.08)",
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: isSelected ? 800 : 600,
                          color: "var(--text-primary)",
                          lineHeight: 1.2,
                        }}
                      >
                        {t.name}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {t.badge}
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check size={16} color="var(--mint)" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}