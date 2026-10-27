"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, LayoutDashboard, TrendingUp, Map, Bell, BarChart3, Info, Wind
} from "lucide-react";

const NAV = [
  { href: "/",            label: "Overview",          icon: Home,            badge: "Terminal" },
  { href: "/dashboard",   label: "Air Quality Hub",   icon: LayoutDashboard, badge: "Modular" },
  { href: "/trends",      label: "AI Forecasts",      icon: TrendingUp,      badge: "24h ML" },
  { href: "/map",         label: "Pollution Map",     icon: Map,             badge: "GIS" },
  { href: "/alerts",      label: "Early Warnings",    icon: Bell,            badge: "Rules" },
  { href: "/leaderboard", label: "City Rankings",     icon: BarChart3,       badge: "Benchmark" },
  { href: "/profile",     label: "Clinical Health",   icon: Info,            badge: "Health" },
];

export default function Sidebar({ mobileOpen }: { mobileOpen?: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      id="sidebar"
      aria-label="Main navigation"
      style={{
        width: "252px",
        height: "100vh",
        background: "var(--sidebar-bg, rgba(255, 255, 255, 0.92))",
        borderRight: "1px solid var(--border)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        padding: "22px 14px 20px",
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "none",
        position: "relative",
        transform: "translateX(0)",
      }}
    >
      {/* Brand Logo Header - Completely static, quiet, luxury */}
      <Link
        href="/"
        aria-label="AirPulse home"
        style={{
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 11,
          paddingBottom: 20,
          marginBottom: 18,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          flexShrink: 0,
          background: "var(--bg-glass-md)",
          border: "1px solid var(--border-bright)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Wind size={19} color="var(--mint)" strokeWidth={2.4} aria-hidden="true" />
        </div>
        <div className="sidebar-brand-text">
          <div style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 17.5,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            color: "var(--text-primary)",
          }}>
            AirPulse
          </div>
          <div style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: "var(--text-muted)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginTop: 2,
          }}>
            Atmospheric Intel
          </div>
        </div>
      </Link>

      {/* Static Section Label */}
      <div
        className="sidebar-brand-text"
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "var(--text-muted)",
          padding: "0 8px",
          marginBottom: 10,
        }}
      >
        Platform Navigation
      </div>

      {/* Navigation Links - Static, clean, high luxury */}
      <nav style={{ flex: 1 }} aria-label="Primary navigation">
        {NAV.map(({ href, label, icon: Icon, badge }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`nav-link${isActive ? " active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              style={{
                marginBottom: 4,
                padding: "9px 12px",
                borderRadius: 10,
                background: isActive ? "var(--bg-glass-md)" : "transparent",
                border: isActive ? "1px solid var(--border-bright)" : "1px solid transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.04)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textDecoration: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isActive ? "var(--bg-card)" : "transparent",
                  border: isActive ? "1px solid var(--border)" : "1px solid transparent",
                }}>
                  <Icon
                    size={14}
                    color={isActive ? "var(--mint)" : "var(--text-muted)"}
                    strokeWidth={isActive ? 2.4 : 1.9}
                    aria-hidden="true"
                  />
                </div>
                <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500 }}>
                  {label}
                </span>
              </div>

              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 6,
                  background: isActive ? "var(--bg-card)" : "var(--bg-glass)",
                  color: isActive ? "var(--mint)" : "var(--text-muted)",
                  border: "1px solid var(--border)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {badge}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Static Footer Info Box - Absolutely no moving or live elements */}
      <div
        className="sidebar-brand-text"
        style={{
          padding: "12px 14px",
          borderRadius: 11,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          marginTop: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.04em" }}>
            CAAQMS Network
          </span>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--mint)" }}>
            Connected
          </span>
        </div>
        <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
          24 Regional Sensor Stations · Machine Learning Pipeline
        </p>
      </div>

      {/* Static App Version Pill */}
      <div
        className="sidebar-brand-text"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 4px 0",
        }}
      >
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>
          AirPulse v6.4 Pro
        </span>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          color: "var(--text-secondary)",
          background: "var(--bg-glass)",
          padding: "2px 8px",
          borderRadius: 6,
          border: "1px solid var(--border)",
        }}>
          Standard
        </span>
      </div>
    </aside>
  );
}