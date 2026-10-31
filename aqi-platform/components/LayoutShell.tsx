"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import ThemeSelector from "@/components/ThemeSelector";
import AtmosphericSound from "@/components/AtmosphericSound";
import AtmosphericMesh from "@/components/AtmosphericMesh";
import { RefreshCw, Clock, Menu, X, ShieldCheck } from "lucide-react";

const PAGE_LABELS: Record<string, string> = {
  "/":            "Air Quality Overview",
  "/dashboard":   "Air Quality Dashboard",
  "/trends":      "Forecasts & Trends",
  "/map":         "Air Quality Map",
  "/alerts":      "Smart Alerts",
  "/leaderboard": "City Rankings",
  "/profile":     "Health Guide",
};

function useTime() {
  const [t, setT] = useState("");
  useEffect(() => {
    const fmt = () =>
      setT(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
    fmt();
    const id = setInterval(fmt, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const time = useTime();
  const [mobileOpen, setMobileOpen] = useState(false);

  const label =
    PAGE_LABELS[pathname] ??
    Object.entries(PAGE_LABELS).find(([k]) => k !== "/" && pathname.startsWith(k))?.[1] ??
    "AirPulse Intel";

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)", position: "relative", overflowX: "hidden" }}>
      {/* Ambient Mesh Atmosphere */}
      <AtmosphericMesh />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(6px)",
            zIndex: 250,
          }}
        />
      )}

      {/* Left Sidebar - Static, clean, luxury */}
      <div
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0,
          zIndex: 300,
          transform: mobileOpen ? "translateX(0)" : undefined,
        }}
      >
        <Sidebar mobileOpen={mobileOpen} />
      </div>

      {/* Main Container */}
      <main
        id="page-content"
        style={{
          flex: 1,
          minWidth: 0,
          marginLeft: "var(--sidebar-w, 252px)",
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          transition: "margin-left 0.28s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Luminous Frosted Glass Topbar */}
        <header
          className="topbar"
          style={{
            background: "var(--sidebar-bg)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid var(--border)",
            boxShadow: "0 2px 12px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="btn-ghost"
              onClick={() => setMobileOpen(o => !o)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              style={{ padding: "6px 8px" }}
              id="mobile-menu-btn"
            >
              {mobileOpen ? <X size={17} aria-hidden="true" /> : <Menu size={17} aria-hidden="true" />}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 3, height: 18,
                  background: "linear-gradient(180deg, var(--mint), var(--cyan))",
                  borderRadius: 2,
                }}
              />
              <span style={{
                fontSize: 14.5, fontWeight: 800,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
                fontFamily: "'Outfit', sans-serif",
              }}>
                {label}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
            {/* Sensor Status Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 999,
                background: "var(--bg-glass-md)",
                border: "1px solid var(--border-bright)",
              }}
            >
              <ShieldCheck size={13} color="var(--mint)" aria-hidden="true" />
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.04em" }}>
                SENSORS ACTIVE
              </span>
            </div>

            {/* Ambient Sound Synthesizer */}
            <AtmosphericSound />

            {/* Aesthetic Theme Switcher */}
            <ThemeSelector />

            {/* Clock */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-secondary)",
                padding: "4px 10px",
                background: "var(--bg-card)",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <Clock size={12} color="var(--mint)" aria-hidden="true" />
              <span className="mono" style={{ fontSize: 11.5 }}>{time}</span>
            </div>

            {/* Refresh */}
            <button
              onClick={() => window.location.reload()}
              className="btn-ghost"
              aria-label="Refresh telemetry"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              <RefreshCw size={12} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {children}
      </main>

      <style>{`
        @media (max-width: 1100px) {
          #mobile-menu-btn { display: flex; }
        }
        @media (min-width: 1101px) {
          #mobile-menu-btn { display: none; }
        }
      `}</style>
    </div>
  );
}