"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  Map,
  TrendingUp,
  Trophy,
  User,
  Bell,
  Radio,
  Wind,
  Leaf
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/",            label: "Home",        icon: Home,            color: "#60a5fa" },
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard, color: "#34d399" },
  { href: "/map",         label: "Live Map",    icon: Map,             color: "#a78bfa" },
  { href: "/trends",      label: "Trends",      icon: TrendingUp,      color: "#fbbf24" },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy,          color: "#f472b6" },
  { href: "/profile",     label: "Health Profile", icon: User,         color: "#fb923c" },
  { href: "/alerts",      label: "Alerts",      icon: Bell,            color: "#f87171" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside id="sidebar">
      {/* ── Brand Logo ── */}
      <Link
        href="/"
        style={{
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "4px 6px 20px",
          marginBottom: 12,
          borderBottom: `1px solid var(--border-light)`,
        }}
      >
        {/* Animated logo mark */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: "linear-gradient(135deg, #10b981 0%, #059669 60%, #047857 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 20px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
            flexShrink: 0,
            position: "relative",
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C6.48 2 2 6.48 2 12C2 15.5 3.8 18.6 6.5 20.4C6.2 18.5 6.4 16.5 7.2 14.8C8.5 12 11.2 10.2 14.2 9.8C16.8 9.5 19.5 10.4 21.2 12.3C21.7 10.7 22 9 22 7.2C22 4.3 17.5 2 12 2Z"
              fill="rgba(255,255,255,0.95)"
            />
            <path
              d="M21.5 12.5C19.2 10.5 16.2 9.6 13.2 10C10.5 10.4 8 12 6.8 14.5C5.9 16.3 5.8 18.4 6.2 20.4C7.9 21.4 9.9 22 12 22C17.5 22 22 17.5 22 12C22 11.8 22 11.7 21.9 11.5L21.5 12.5Z"
              fill="rgba(110,231,183,0.9)"
            />
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <span
            className="sidebar-brand-text"
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 22,
              fontWeight: 900,
              color: "var(--text-title)",
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
            }}
          >
            AirPulse
          </span>
          <span
            className="sidebar-brand-text"
            style={{
              fontSize: 10.5,
              color: "#34d399",
              fontWeight: 700,
              letterSpacing: "0.04em",
              marginTop: 1,
            }}
          >
            Clean Air Intelligence
          </span>
        </div>
      </Link>

      {/* ── Nav Section Label ── */}
      <span
        className="sidebar-brand-text"
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "var(--text-muted)",
          padding: "0 8px",
          marginBottom: 8,
          display: "block",
        }}
      >
        Navigation
      </span>

      {/* ── Navigation Links ── */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        {NAV_ITEMS.map(({ href, label, icon: Icon, color }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`nav-link${isActive ? " active" : ""}`}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: isActive
                    ? `rgba(255,255,255,0.12)`
                    : `rgba(255,255,255,0.06)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.18s ease",
                }}
              >
                <Icon
                  size={15}
                  color={isActive ? color : "rgba(255,255,255,0.5)"}
                  strokeWidth={isActive ? 2.4 : 2.0}
                />
              </div>
              <span className="nav-label" style={{ flex: 1, letterSpacing: "-0.01em" }}>
                {label}
              </span>
              {isActive && (
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: color,
                    boxShadow: `0 0 6px ${color}`,
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "16px 0" }} />

      {/* ── Live System Status ── */}
      <div
        className="sidebar-brand-text"
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(16,185,129,0.1)",
          border: "1px solid rgba(16,185,129,0.2)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(16,185,129,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#34d399",
            flexShrink: 0,
          }}
        >
          <Radio size={14} />
        </div>
        <div style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: "#34d399",
                letterSpacing: "0.04em",
              }}
            >
              NETWORK ONLINE
            </span>
          </div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600, lineHeight: 1.3 }}>
            GJ &amp; MH CAAQMS Active
          </p>
        </div>
      </div>

      {/* ── Version Footer ── */}
      <div
        className="sidebar-brand-text"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 4px",
        }}
      >
        <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.28)", fontWeight: 600 }}>
          AirPulse v4.0
        </span>
        <span
          style={{
            fontSize: 9.5,
            color: "#1d72f2",
            fontWeight: 800,
            background: "rgba(29,114,242,0.15)",
            padding: "2px 7px",
            borderRadius: 4,
          }}
        >
          ML Conformal
        </span>
      </div>
    </aside>
  );
}
