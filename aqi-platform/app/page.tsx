"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  MapPin, Wind, Droplets, Activity, TrendingUp, Bell,
  RefreshCw, AlertTriangle, ChevronRight, ArrowRight,
  Gauge, Map, ChevronDown, Zap, Shield, Globe, Sparkles,
  Sliders, Layers, CheckCircle2, ArrowUpRight, ShieldCheck
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  fetchLiveOrFallbackStations, ExtendedStation, calculateAQI, getAQIMeta,
} from "@/lib/dataService";

const AtmosphericGlobe = dynamic(
  () => import("@/components/AtmosphericGlobe"),
  { ssr: false, loading: () => <div style={{ width: "100%", height: "100%" }} /> }
);

const EmbeddedMap = dynamic(() => import("@/components/EmbeddedMap"), {
  ssr: false,
  loading: () => (
    <div style={{
      height: "100%", minHeight: 380,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-card)", borderRadius: 14,
    }}>
      <div className="skeleton" style={{ position: "absolute", inset: 0, borderRadius: 14 }} />
    </div>
  ),
});

/* ── Custom adaptive dark tooltip for recharts ── */
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "10px 14px",
      boxShadow: "var(--sh-panel)",
    }}>
      <p style={{
        fontSize: 10.5,
        fontWeight: 800,
        color: "var(--mint)",
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: "0.08em"
      }}>
        {label}
      </p>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{p.name}:</span>
          <strong style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif" }}>
            {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

/* ── Subtle pastel particle field component ── */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = canvas.offsetWidth;
    let H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    const PARTICLE_COUNT = Math.min(35, Math.floor(W * H / 25000));
    type Particle = { x: number; y: number; vx: number; vy: number; size: number; alpha: number; type: number };
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.2,
      vy: -Math.random() * 0.3 - 0.08,
      size: Math.random() * 2 + 0.6,
      alpha: Math.random() * 0.35 + 0.1,
      type: Math.random() > 0.5 ? 1 : 2,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.0006;
        if (p.y < -5 || p.alpha <= 0) {
          p.x = Math.random() * W;
          p.y = H + 5;
          p.alpha = Math.random() * 0.3 + 0.1;
          p.vx = (Math.random() - 0.5) * 0.2;
          p.vy = -Math.random() * 0.3 - 0.08;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.type === 1
          ? `rgba(2, 132, 199, ${p.alpha * 0.35})`
          : `rgba(6, 182, 212, ${p.alpha * 0.35})`;
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    const resizeHandler = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W;
      canvas.height = H;
    };
    window.addEventListener("resize", resizeHandler);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resizeHandler);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}

/* ── AQI scale band ── */
function AQIBand({ aqi }: { aqi: number }) {
  const bands = [
    { label: "Good", color: "#059669", max: 50 },
    { label: "Moderate", color: "#d97706", max: 100 },
    { label: "Poor", color: "#ea580c", max: 200 },
    { label: "Unhealthy", color: "#dc2626", max: 300 },
    { label: "Severe", color: "#9333ea", max: 400 },
    { label: "Hazardous", color: "#b91c1c", max: 500 },
  ];
  return (
    <div>
      <div style={{ display: "flex", height: 6, borderRadius: 6, overflow: "hidden", gap: 2, marginBottom: 5 }}
        role="img" aria-label={`AQI scale. Current value ${aqi} out of 500`}>
        {bands.map(b => (
          <div key={b.max} style={{
            flex: 1, background: b.color,
            opacity: aqi >= (b.max - 99) ? 1 : 0.22,
            transition: "opacity 0.4s ease",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {bands.map(b => (
          <span key={b.max} style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600 }}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

const REGIONAL_STATIONS = ["Pune", "Mumbai", "Ahmedabad", "Anand", "Surat", "Vadodara", "Rajkot", "Nashik"];

export default function OverviewPage() {
  const [stations, setStations] = useState<ExtendedStation[]>([]);
  const [selected, setSelected] = useState<ExtendedStation | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [activePollutant, setActivePollutant] = useState<"PM2.5" | "PM10" | "NO2">("PM2.5");
  const heroRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const { stations: d, isLiveBackend } = await fetchLiveOrFallbackStations();
      setStations(d);
      setIsLive(isLiveBackend);
      if (d.length > 0) {
        setSelected(prev => d.find(s => s.station === prev?.station) ?? d[0]);
      }
    } catch {
      setError("Unable to load station telemetry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []); // eslint-disable-line

  useEffect(() => {
    if (!selected) return;
    setForecastLoading(true);
    const ctrl = new AbortController();
    fetch(`/api/forecast/${encodeURIComponent(selected.station)}`, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        if (data?.forecast) {
          const pts = [
            { time: "Now",  pm25: data.current_pm25, isForecast: false },
            { time: "+1h",  pm25: data.forecast["1h"]?.value, lower: data.forecast["1h"]?.range?.[0], upper: data.forecast["1h"]?.range?.[1], isForecast: true },
            { time: "+3h",  pm25: data.forecast["3h"]?.value, lower: data.forecast["3h"]?.range?.[0], upper: data.forecast["3h"]?.range?.[1], isForecast: true },
            { time: "+6h",  pm25: data.forecast["6h"]?.value, lower: data.forecast["6h"]?.range?.[0], upper: data.forecast["6h"]?.range?.[1], isForecast: true },
          ].filter(p => p.pm25 != null);
          setForecastData(pts);
        }
      })
      .catch(() => setForecastData([]))
      .finally(() => setForecastLoading(false));
    return () => ctrl.abort();
  }, [selected?.station]);

  const aqi = useMemo(() => selected ? calculateAQI(selected.pm25) : null, [selected]);
  const meta = useMemo(() => aqi != null ? getAQIMeta(aqi) : null, [aqi]);

  const scrollToContent = () => {
    const el = document.getElementById("main-content");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  /* ── SVG AQI Gauge ── */
  const GaugeCircle = ({ aqiVal, color }: { aqiVal: number; color: string }) => {
    const R = 54;
    const circ = 2 * Math.PI * R;
    const stroke = circ * (1 - Math.min(1, aqiVal / 500));
    return (
      <svg width="130" height="130" viewBox="0 0 130 130" aria-label={`AQI gauge: ${aqiVal}`}>
        {/* Track */}
        <circle cx="65" cy="65" r={R} fill="none" stroke="var(--border)" strokeWidth="8" />
        {/* Fill */}
        <circle
          cx="65" cy="65" r={R} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${circ - stroke} ${stroke}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
        {/* Center value */}
        <text x="65" y="60" textAnchor="middle" fill={color} fontSize="28" fontWeight="900"
          fontFamily="'Outfit', sans-serif" letterSpacing="-1">{aqiVal}</text>
        <text x="65" y="76" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="700"
          fontFamily="'Inter', sans-serif">AQI</text>
      </svg>
    );
  };

  return (
    <div style={{ background: "transparent", minHeight: "100vh", position: "relative" }}>

      {/* ══════════ HERO SECTION ══════════ */}
      <section
        ref={heroRef}
        style={{
          position: "relative",
          padding: "48px 36px 36px",
          overflow: "hidden",
        }}
        aria-label="Hero section"
      >
        {/* Subtle particle field */}
        <ParticleField />

        {/* Ambient atmospheric radial glow */}
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 60% 70% at 70% 50%, var(--bg-glass-md) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />

        {/* Hero content: text + globe */}
        <div style={{
          position: "relative", zIndex: 10,
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 40,
          alignItems: "center",
          maxWidth: 1440,
          margin: "0 auto",
          width: "100%",
        }}>
          {/* Left: Text & Interactive controls */}
          <div className="fade-in">
            {/* Top status badges */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "6px 14px",
                borderRadius: 999,
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                boxShadow: "0 1px 4px rgba(15, 23, 42, 0.05)",
              }}>
                <ShieldCheck size={14} color="var(--mint)" aria-hidden="true" />
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.06em" }}>
                  {isLive ? "CPCB TELEMETRY ACTIVE" : "OPEN-METEO ML ESTIMATES"}
                </span>
              </div>

              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}>
                <Sparkles size={12} color="var(--mint)" aria-hidden="true" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--mint)" }}>
                  XGBoost v2.4 ML
                </span>
              </div>
            </div>

            {/* Main headline */}
            <h1 className="hero-title" style={{ marginBottom: 14 }}>
              <span style={{
                display: "block",
                color: "var(--text-primary)",
                letterSpacing: "-0.03em",
              }}>
                Hyperlocal Air Intelligence.
              </span>
              <span style={{
                display: "block",
                background: "linear-gradient(135deg, var(--mint) 0%, var(--cyan) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                letterSpacing: "-0.03em",
              }}>
                Real-Time & Machine-Predicted.
              </span>
            </h1>

            <p style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              fontWeight: 400,
              maxWidth: 480,
              marginBottom: 24,
            }}>
              Monitor micro-scale pollution surges across Western India with sub-kilometer GIS resolution, modular drag-and-drop dashboarding, and XGBoost machine-learning forecasts.
            </p>

            {/* Regional Quick Station Jump Carousel */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <MapPin size={13} color="var(--mint)" aria-hidden="true" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Select Target City Sensor
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {REGIONAL_STATIONS.map(city => {
                  const isCur = selected?.city?.toLowerCase() === city.toLowerCase();
                  return (
                    <button
                      key={city}
                      onClick={() => {
                        const found = stations.find(s => s.city.toLowerCase() === city.toLowerCase());
                        if (found) setSelected(found);
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.18s ease",
                        background: isCur ? "var(--mint)" : "var(--bg-card)",
                        color: isCur ? "#ffffff" : "var(--text-secondary)",
                        border: isCur ? "1px solid var(--mint)" : "1px solid var(--border)",
                        boxShadow: isCur ? "0 2px 8px rgba(2, 132, 199, 0.25)" : "none",
                      }}
                    >
                      {city}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CTA action buttons */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 34 }}>
              <Link
                href="/dashboard"
                className="btn btn-primary"
                style={{
                  fontSize: 14,
                  padding: "12px 24px",
                  borderRadius: 11,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Activity size={16} aria-hidden="true" />
                Launch Modular Dashboard
              </Link>
              <Link
                href="/trends"
                className="btn btn-secondary"
                style={{
                  fontSize: 14,
                  padding: "12px 22px",
                  borderRadius: 11,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <TrendingUp size={16} aria-hidden="true" />
                View AI Forecast Models
              </Link>
            </div>

            {/* Mini capability stats */}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { icon: Globe, label: "Coverage", value: `${stations.length || 8} Monitored Cities`, color: "var(--mint)" },
                { icon: Zap, label: "Predictor", value: "1h · 3h · 6h Trajectories", color: "var(--cyan)" },
                { icon: Sliders, label: "Layout", value: "Drag & Drop Movable", color: "var(--electric)" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <item.icon size={15} color={item.color} aria-hidden="true" />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: item.color }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Globe + live telemetry card */}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            {/* Holographic 3D Globe */}
            <div className="float" style={{ width: "100%", maxWidth: 360, aspectRatio: "1", position: "relative" }}>
              <AtmosphericGlobe aqiColor={meta?.color ?? "var(--mint)"} aqi={aqi ?? 0} />
            </div>

            {/* Live AQI Floating Telemetry HUD */}
            {selected && aqi != null && meta && (
              <div
                className="glass-card fade-in"
                style={{
                  padding: "14px 18px",
                  width: "100%", maxWidth: 360,
                  border: `1px solid var(--border)`,
                  boxShadow: "var(--sh-panel)",
                  background: "var(--bg-card)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <MapPin size={14} color="var(--mint)" aria-hidden="true" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                      {selected.station} · {selected.city}
                    </span>
                  </div>
                  <span className="aqi-badge" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, fontSize: 11, padding: "2px 10px" }}>
                    {meta.label}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div>
                    <div className="display-num" style={{ fontSize: 44, color: meta.color, lineHeight: 1 }} aria-label={`Current AQI: ${aqi}`}>{aqi}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginTop: 3 }}>India NAQI</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                      <div style={{ background: "var(--bg-surface)", borderRadius: 8, padding: "6px 10px", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 9.5, color: "var(--text-muted)", fontWeight: 700 }}>PM2.5</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif" }}>
                          {selected.pm25.toFixed(1)} <span style={{ fontSize: 9, color: "var(--text-muted)" }}>µg/m³</span>
                        </div>
                      </div>
                      <div style={{ background: "var(--bg-surface)", borderRadius: 8, padding: "6px 10px", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 9.5, color: "var(--text-muted)", fontWeight: 700 }}>PM10</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif" }}>
                          {selected.pm10 ? selected.pm10.toFixed(1) : "—"} <span style={{ fontSize: 9, color: "var(--text-muted)" }}>µg/m³</span>
                        </div>
                      </div>
                    </div>
                    <AQIBand aqi={aqi} />
                  </div>
                </div>

                <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 12, lineHeight: 1.45, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  {meta.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* In-flow structural divider — no absolute positioning, zero overlap */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 28 }}>
          <button
            onClick={scrollToContent}
            aria-label="Scroll to interactive dashboard"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 20px",
              color: "var(--text-muted)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              boxShadow: "var(--sh-card)",
            }}
          >
            <span>Explore Telemetry &amp; GIS Map</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* ══════════ MAIN CONTENT ══════════ */}
      <div id="main-content" style={{ padding: "0 36px 80px", maxWidth: 1520, margin: "0 auto" }}>

        {/* Error notice */}
        {error && (
          <div role="alert" style={{
            background: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.25)",
            borderLeft: "4px solid #dc2626", borderRadius: 12,
            padding: "14px 18px", marginBottom: 24,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <AlertTriangle size={18} color="#dc2626" aria-hidden="true" />
            <p style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>{error}</p>
          </div>
        )}

        {/* Data status telemetry bar */}
        {!loading && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 18px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 12,
            boxShadow: "var(--sh-card)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span className="source-badge" style={{
                background: isLive ? "rgba(5, 150, 105, 0.10)" : "rgba(217, 119, 6, 0.10)",
                color: isLive ? "#059669" : "#d97706",
                border: `1px solid ${isLive ? "rgba(5, 150, 105, 0.25)" : "rgba(217, 119, 6, 0.25)"}`,
                fontWeight: 700,
              }}>
                {isLive ? "● CPCB Telemetry Active" : "◎ Open-Meteo Reanalysis"}
              </span>

              {selected?.fetched_at && (
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                  Station sync: {new Date(selected.fetched_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link
                href="/dashboard"
                style={{
                  fontSize: 12, fontWeight: 700, color: "var(--mint)",
                  display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none",
                }}
              >
                <span>Customize widgets in Dashboard</span>
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>

              <button
                onClick={() => load(true)}
                className="btn btn-ghost"
                disabled={refreshing}
                aria-label="Refresh telemetry"
                style={{ padding: "6px 14px", fontSize: 12 }}
              >
                <RefreshCw size={13} className={refreshing ? "spin" : ""} aria-hidden="true" />
                {refreshing ? "Synchronizing…" : "Sync Telemetry"}
              </button>
            </div>
          </div>
        )}

        {/* ── 2-Column High-Tech Grid: GIS Map | AQI Gauge & Machine Predictions ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)",
          gap: 24,
          marginBottom: 32,
        }}>
          {/* Map card with CartoDB GIS */}
          <div className="glass-card" style={{ padding: "22px", minHeight: 520, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Map size={16} color="var(--mint)" aria-hidden="true" />
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif" }}>
                  Geospatial Sensor GIS
                </h2>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                  ({stations.length} Active Feeds)
                </span>
              </div>

              {/* Pollutant selector */}
              <div style={{ display: "flex", gap: 5 }}>
                {(["PM2.5", "PM10", "NO2"] as const).map(pol => (
                  <button
                    key={pol}
                    onClick={() => setActivePollutant(pol)}
                    aria-pressed={activePollutant === pol}
                    className={`filter-pill ${activePollutant === pol ? "filter-pill-active" : "filter-pill-inactive"}`}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 8,
                    }}
                  >
                    {pol}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 410, borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)" }}>
              {loading ? (
                <div className="skeleton" style={{ height: "100%", borderRadius: 14 }} />
              ) : (
                <EmbeddedMap
                  stations={stations}
                  selectedStation={selected}
                  onSelectStation={s => setSelected(s as ExtendedStation)}
                  activePollutant={activePollutant}
                  center={selected ? [selected.latitude, selected.longitude] : [19.076, 72.8777]}
                  zoom={9}
                />
              )}
            </div>

            {/* Map bottom legend */}
            <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { l: "Good ≤50", c: "#059669" },
                { l: "Moderate ≤100", c: "#d97706" },
                { l: "Poor ≤200", c: "#ea580c" },
                { l: "Unhealthy >200", c: "#dc2626" },
              ].map(x => (
                <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: x.c, display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{x.l}</span>
                </div>
              ))}
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto", fontWeight: 600 }}>
                High-Resolution CartoDB GIS
              </span>
            </div>
          </div>

          {/* Right column: AQI details + forecast chart */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Current AQI Gauge Card */}
            {loading ? (
              <div className="glass-card" style={{ padding: 22 }}>
                <div className="skeleton" style={{ height: 160, borderRadius: 12 }} />
              </div>
            ) : selected && aqi != null && meta ? (
              <div className="glass-card" style={{ padding: "22px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
                  <GaugeCircle aqiVal={aqi} color={meta.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span className="aqi-badge" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                        {meta.label}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                      <MapPin size={13} color="var(--mint)" aria-hidden="true" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{selected.station}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                      {[
                        { label: "PM2.5", value: `${selected.pm25.toFixed(1)} µg/m³` },
                        { label: "PM10", value: selected.pm10 ? `${selected.pm10.toFixed(1)} µg/m³` : "—" },
                        { label: "Humidity", value: selected.humidity ? `${selected.humidity}%` : "—" },
                        { label: "Wind Vector", value: selected.wind_speed ? `${selected.wind_speed} km/h` : "—" },
                      ].map(m => (
                        <div key={m.label} style={{ background: "var(--bg-surface)", borderRadius: 8, padding: "7px 10px", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 9.5, color: "var(--text-muted)", fontWeight: 700 }}>{m.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif" }}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    <AQIBand aqi={aqi} />
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", marginTop: 18, paddingTop: 14 }}>
                  <label htmlFor="ov-station-select" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Switch Monitored Station
                  </label>
                  <select
                    id="ov-station-select"
                    className="ap-select"
                    style={{ width: "100%", fontSize: 12.5 }}
                    value={selected.station}
                    onChange={e => {
                      const f = stations.find(s => s.station === e.target.value);
                      if (f) setSelected(f);
                    }}
                  >
                    {stations.map(s => <option key={s.station} value={s.station}>{s.city} — {s.station}</option>)}
                  </select>
                </div>
              </div>
            ) : null}

            {/* AI XGBoost PM2.5 Forecast Card */}
            <div className="glass-card" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <TrendingUp size={15} color="var(--mint)" aria-hidden="true" />
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif" }}>
                    XGBoost PM2.5 Projection
                  </h3>
                </div>
                <span className="tag">
                  ML Inference
                </span>
              </div>

              {forecastLoading ? (
                <div className="skeleton" style={{ height: 130, borderRadius: 10 }} />
              ) : forecastData.length > 0 ? (
                <>
                  <div style={{ width: "100%", height: 130 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={forecastData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="ov-grad-theme" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--mint)" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="var(--mint)" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
                        <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10, fontWeight: 600 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10, fontWeight: 600 }} width={32} />
                        <Tooltip content={<DarkTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="pm25"
                          name="PM2.5"
                          stroke="var(--mint)"
                          strokeWidth={2.4}
                          fill="url(#ov-grad-theme)"
                          dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            return (
                              <circle
                                key={`dot-${cx}-${cy}`}
                                cx={cx} cy={cy} r={4}
                                fill={payload.isForecast ? "var(--cyan)" : "var(--mint)"}
                                stroke="#ffffff" strokeWidth={2}
                              />
                            );
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {forecastData.filter(p => p.isForecast).map(pt => (
                      <div key={pt.time} style={{
                        flex: 1, background: "var(--bg-surface)", borderRadius: 8,
                        padding: "8px 9px", textAlign: "center", border: "1px solid var(--border)",
                      }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>{pt.time}</div>
                        <div className="display-num" style={{ fontSize: 16, color: "var(--mint)" }}>{pt.pm25?.toFixed(1)}</div>
                        <div style={{ fontSize: 9, color: "var(--text-muted)" }}>µg/m³</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 10, fontWeight: 500 }}>
                    ● Baseline · ◈ XGBoost Horizon Forecasts
                  </p>
                </>
              ) : (
                <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                  <TrendingUp size={24} color="var(--text-muted)" />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Select a station to initialize forecasting</span>
                </div>
              )}
            </div>

            {/* Health protocol advisory */}
            {meta && (
              <div className="glass-card" style={{ padding: "16px 18px", border: `1px solid var(--border)` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Shield size={14} color={meta.color} aria-hidden="true" />
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>Clinical Health Advisory</span>
                  <span className="aqi-badge" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, fontSize: 10, padding: "1px 8px" }}>
                    {meta.label}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{meta.activityAdvice}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45, marginTop: 6 }}>{meta.ventilationAdvice}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── High-Level Navigation Deck ── */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Explore AirPulse Autonomous Modules
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {[
            {
              href: "/dashboard",
              icon: Sliders,
              color: "var(--mint)",
              title: "Modular Dashboard",
              desc: "Reorderable drag-and-drop workspace with widget resizing and focus modes.",
              badge: "Movable Layout"
            },
            {
              href: "/trends",
              icon: TrendingUp,
              color: "var(--cyan)",
              title: "Predictive Analytics",
              desc: "Deep XGBoost machine-learning forecasting across 1h, 3h, and 6h horizons.",
              badge: "ML Inference"
            },
            {
              href: "/map",
              icon: Map,
              color: "var(--electric)",
              title: "Geospatial GIS Map",
              desc: "Interactive CartoDB Dark Matter GIS with atmospheric plume overlays.",
              badge: "GIS Radar"
            },
            {
              href: "/alerts",
              icon: Bell,
              color: "#f59e0b",
              title: "Early Warning Protocols",
              desc: "Custom multi-pollutant threshold alerts with instantaneous simulator.",
              badge: "Automated"
            },
          ].map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="glass-card glass-card-lift"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: "20px 22px",
                  textDecoration: "none",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: "var(--bg-glass-md)",
                    border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={18} color={item.color} aria-hidden="true" />
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    color: item.color,
                    letterSpacing: "0.04em"
                  }}>
                    {item.badge}
                  </span>
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif" }}>
                      {item.title}
                    </span>
                    <ChevronRight size={14} color="var(--text-muted)" aria-hidden="true" />
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {item.desc}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}