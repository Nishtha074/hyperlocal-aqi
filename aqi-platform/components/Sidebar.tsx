"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  HeartPulse,
  Map,
  TrendingUp,
  Trophy,
  Wind,
} from "lucide-react";

const navItems = [
  { href: "/", icon: Activity, label: "Overview" },
  { href: "/map", icon: Map, label: "Live map" },
  { href: "/trends", icon: TrendingUp, label: "Air trends" },
  { href: "/leaderboard", icon: Trophy, label: "City rankings" },
  { href: "/profile", icon: HeartPulse, label: "Health guide" },
  { href: "/alerts", icon: Bell, label: "Air alerts" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <Link className="brand" href="/" aria-label="AirPulse home">
        <span className="brand-mark"><Wind size={20} strokeWidth={2.3} /></span>
        <span className="brand-copy">
          <strong>AirPulse</strong>
          <small>Air quality, made clear</small>
        </span>
      </Link>

      <div className="sidebar-section-label">Workspace</div>
      <nav className="primary-nav" aria-label="Main navigation">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`nav-link${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-note">
        <span className="sidebar-note-icon"><Activity size={16} /></span>
        <div>
          <strong>Regional coverage</strong>
          <p>Gujarat &amp; Maharashtra</p>
        </div>
      </div>

      <div className="sidebar-footer">
        <span className="status-indicator" />
        <span>Air quality intelligence</span>
      </div>
    </aside>
  );
}
