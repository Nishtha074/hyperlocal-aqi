"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { RefreshCw, Clock, Menu, X } from "lucide-react";

const PAGE_LABELS: Record<string, string> = {
  "/":            "Overview",
  "/dashboard":   "Live Air Quality",
  "/trends":      "Forecasts",
  "/map":         "Pollution Map",
  "/alerts":      "Alerts",
  "/leaderboard": "City Rankings",
  "/profile":     "About AirPulse",
};

function useTime() {
  const [t, setT] = useState("");
  useEffect(() => {
    const fmt = () =>
      setT(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }));
    fmt();
    const id = setInterval(fmt, 30_000);
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
    "AirPulse";

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            zIndex: 250,
          }}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0,
          zIndex: 300,
          transform: mobileOpen ? "translateX(0)" : undefined,
        }}
      >
        <Sidebar mobileOpen={mobileOpen} />
      </div>

      {/* Main */}
      <main
        id="page-content"
        style={{ flex: 1, minWidth: 0, marginLeft: "var(--sidebar-w, 252px)" }}
      >
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="btn-ghost"
              onClick={() => setMobileOpen(o => !o)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              style={{ padding: "6px 8px" }}
              id="mobile-menu-btn"
            >
              {mobileOpen ? <X size={17} aria-hidden="true" /> : <Menu size={17} aria-hidden="true" />}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 2, height: 16,
                  background: "linear-gradient(180deg, #00ffa3, #00d4ff)",
                  borderRadius: 2,
                  boxShadow: "0 0 8px rgba(0,255,163,0.5)",
                }}
              />
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
                fontFamily: "'Outfit', sans-serif",
              }}>
                {label}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="live-dot" aria-hidden="true" />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>
                Live feed
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-muted)" }}>
              <Clock size={11} aria-hidden="true" />
              <span>{time}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="btn-ghost"
              aria-label="Refresh data"
              style={{ padding: "5px 10px", fontSize: 12 }}
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
