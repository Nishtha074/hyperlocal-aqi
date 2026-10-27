"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, LayoutDashboard, TrendingUp, Map, Bell, BarChart3, Info, Wind,
} from "lucide-react";

const NAV = [
  { href: "/",            label: "Overview",        icon: Home,            color: "#00ffa3" },
  { href: "/dashboard",   label: "Live Air Quality", icon: LayoutDashboard, color: "#00d4ff" },
  { href: "/trends",      label: "Forecasts",        icon: TrendingUp,      color: "#a3e635" },
  { href: "/map",         label: "Pollution Map",    icon: Map,             color: "#00ffa3" },
  { href: "/alerts",      label: "Alerts",           icon: Bell,            color: "#f59e0b" },
  { href: "/leaderboard", label: "City Rankings",    icon: BarChart3,       color: "#a855f7" },
  { href: "/profile",     label: "About AirPulse",   icon: Info,            color: "#00d4ff" },
];

function hexToRgb(hex: string) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

export default function Sidebar({ mobileOpen }: { mobileOpen?: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      id="sidebar"
      aria-label="Main navigation"
      style={{
        width: "252px",
        height: "100vh",
        background: "rgba(2,10,6,0.97)",
        borderRight: "1px solid rgba(0,255,163,0.10)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        padding: "22px 14px 24px",
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "none",
        position: "relative",
        // Sidebar is always visible on all screen sizes.
        transform: "translateX(0)",
        transition: "transform 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Top line */}
      <div aria-hidden="true" style={{
        position:"absolute", top:0, left:0, right:0, height:1,
        background:"linear-gradient(90deg,transparent 0%,#00ffa3 40%,#00d4ff 70%,transparent 100%)",
        opacity:0.6,
      }} />

      {/* Logo */}
      <Link href="/" aria-label="AirPulse home" style={{
        textDecoration:"none", display:"flex", alignItems:"center", gap:11,
        paddingBottom:22, marginBottom:18,
        borderBottom:"1px solid rgba(0,255,163,0.10)",
      }}>
        <div style={{
          width:38, height:38, borderRadius:11, flexShrink:0,
          background:"linear-gradient(135deg,rgba(0,255,163,0.2),rgba(0,212,255,0.12))",
          border:"1px solid rgba(0,255,163,0.30)",
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:"0 0 20px rgba(0,255,163,0.2)",
        }}>
          <Wind size={19} color="#00ffa3" strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div className="sidebar-brand-text">
          <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:17, fontWeight:800, color:"#fff", letterSpacing:"-0.03em", lineHeight:1.1 }}>
            AirPulse
          </div>
          <div style={{ fontSize:9.5, fontWeight:600, color:"rgba(0,255,163,0.65)", letterSpacing:"0.1em", textTransform:"uppercase", marginTop:2 }}>
            Environmental Intel
          </div>
        </div>
      </Link>

      <div className="sidebar-brand-text" style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.15em", color:"rgba(0,255,163,0.28)", padding:"0 4px", marginBottom:8 }}>
        Navigation
      </div>

      <nav style={{ flex:1 }} aria-label="Primary navigation">
        {NAV.map(({ href, label, icon: Icon, color }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href} href={href}
              className={`nav-link${isActive ? " active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              style={{ marginBottom:2 }}
            >
              <div style={{
                width:28, height:28, borderRadius:8, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                background: isActive ? `rgba(${hexToRgb(color)},0.14)` : "rgba(0,255,163,0.04)",
                transition:"all 0.18s ease",
              }}>
                <Icon size={14} color={isActive ? color : "rgba(120,170,140,0.55)"} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
              </div>
              <span className="nav-label">{label}</span>
              {isActive && (
                <span aria-hidden="true" style={{ width:4, height:4, borderRadius:"50%", background:color, boxShadow:`0 0 6px ${color}`, flexShrink:0 }} />
              )}
            </Link>
          );
        })}
      </nav>

      <div style={{ height:1, background:"linear-gradient(90deg,transparent,rgba(0,255,163,0.12),transparent)", margin:"16px 0" }} aria-hidden="true" />

      <div className="sidebar-brand-text" style={{ padding:"10px 12px", borderRadius:10, background:"rgba(0,255,163,0.06)", border:"1px solid rgba(0,255,163,0.14)", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
          <span className="live-dot" aria-hidden="true" />
          <span style={{ fontSize:10, fontWeight:700, color:"rgba(0,255,163,0.8)", letterSpacing:"0.06em" }}>SYSTEM ONLINE</span>
        </div>
        <p style={{ fontSize:9.5, color:"rgba(120,170,140,0.55)", fontWeight:500 }}>Open-Meteo · CPCB · XGBoost ML</p>
      </div>

      <div className="sidebar-brand-text" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 2px" }}>
        <span style={{ fontSize:10, color:"rgba(0,255,163,0.25)", fontWeight:500 }}>AirPulse v6.0</span>
        <span style={{ fontSize:9, fontWeight:700, color:"rgba(0,255,163,0.6)", background:"rgba(0,255,163,0.08)", padding:"2px 7px", borderRadius:5, letterSpacing:"0.05em" }}>XGBoost</span>
      </div>
    </aside>
  );
}
