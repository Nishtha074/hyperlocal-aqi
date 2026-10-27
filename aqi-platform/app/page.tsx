"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  MapPin, Wind, Droplets, Activity, TrendingUp, Bell,
  RefreshCw, AlertTriangle, ChevronRight, ArrowRight,
  Gauge, Map, ChevronDown, Zap, Shield, Globe,
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
      height: "100%", minHeight: 340,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(5,18,12,0.8)", borderRadius: 14,
    }}>
      <div className="skeleton" style={{ position: "absolute", inset: 0, borderRadius: 14 }} />
    </div>
  ),
});

/* ── Custom dark tooltip for recharts ── */
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(5,18,12,0.95)", border: "1px solid rgba(0,255,163,0.2)",
      borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,255,163,0.6)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
          <div style={{ width: 7, height: 7, borderRadius: 2, background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
          <span style={{ fontSize: 12, color: "rgba(223,242,233,0.7)", fontWeight: 600 }}>{p.name}:</span>
          <strong style={{ fontSize: 12.5, color: p.color }}>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

/* ── Particle field component ── */
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

    const PARTICLE_COUNT = Math.min(60, Math.floor(W * H / 18000));
    type Particle = { x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: string };
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.4 - 0.1,
      size: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.5 + 0.1,
      color: Math.random() > 0.6 ? "#00d4ff" : "#00ffa3",
    }));

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.001;
        if (p.y < -5 || p.alpha <= 0) {
          p.x = Math.random() * W;
          p.y = H + 5;
          p.alpha = Math.random() * 0.4 + 0.1;
          p.vx = (Math.random() - 0.5) * 0.3;
          p.vy = -Math.random() * 0.4 - 0.1;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(")", `,${p.alpha})`).replace("rgb", "rgba").replace("#00ffa3", `rgba(0,255,163,${p.alpha})`).replace("#00d4ff", `rgba(0,212,255,${p.alpha})`);
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
    { label: "Good", color: "#10b981", max: 50 },
    { label: "Moderate", color: "#f59e0b", max: 100 },
    { label: "Poor", color: "#f97316", max: 200 },
    { label: "Unhealthy", color: "#ef4444", max: 300 },
    { label: "Very Bad", color: "#a855f7", max: 400 },
    { label: "Hazardous", color: "#dc2626", max: 500 },
  ];
  const pct = Math.min(100, (aqi / 500) * 100);
  return (
    <div>
      <div style={{ display: "flex", height: 6, borderRadius: 6, overflow: "hidden", gap: 1.5, marginBottom: 5 }}
        role="img" aria-label={`AQI scale. Current value ${aqi} out of 500`}>
        {bands.map(b => (
          <div key={b.max} style={{
            flex: 1, background: b.color,
            opacity: aqi >= (b.max - 99) ? 1 : 0.15,
            transition: "opacity 0.5s ease",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {bands.map(b => (
          <span key={b.max} style={{ fontSize: 8.5, color: "rgba(120,170,140,0.5)", fontWeight: 500 }}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

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
      setError("Unable to load station data.");
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
        <circle cx="65" cy="65" r={R} fill="none" stroke="rgba(0,255,163,0.06)" strokeWidth="8" />
        {/* Fill */}
        <circle
          cx="65" cy="65" r={R} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${circ - stroke} ${stroke}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color}80)`, transition: "stroke-dasharray 0.8s ease" }}
        />
        {/* Glow ring */}
        <circle cx="65" cy="65" r={R} fill="none" stroke={color} strokeWidth="1" opacity="0.2" />
        {/* Center value */}
        <text x="65" y="60" textAnchor="middle" fill={color} fontSize="28" fontWeight="900"
          fontFamily="'Outfit',sans-serif" letterSpacing="-1">{aqiVal}</text>
        <text x="65" y="76" textAnchor="middle" fill="rgba(120,170,140,0.6)" fontSize="10" fontWeight="600"
          fontFamily="'Inter',sans-serif">AQI</text>
      </svg>
    );
  };

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>

      {/* ══════════ HERO SECTION ══════════ */}
      <section
        ref={heroRef}
        style={{
          position: "relative",
          minHeight: "88vh",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          padding: "0 40px",
        }}
        aria-label="Hero section"
      >
        {/* Particle field */}
        <ParticleField />

        {/* Background radial */}
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 60% 70% at 70% 50%, rgba(0,255,163,0.04) 0%, transparent 60%)",
        }} />

        {/* Grid lines */}
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(0,255,163,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,163,0.025) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }} />

        {/* Hero content: text + globe */}
        <div style={{
          position: "relative", zIndex: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 60,
          alignItems: "center",
          maxWidth: 1400,
          margin: "0 auto",
          width: "100%",
          padding: "80px 0 60px",
        }}>
          {/* Left: Text */}
          <div className="fade-in">
            {/* Data source pill */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "6px 14px 6px 8px",
                borderRadius: 999,
                background: "rgba(0,255,163,0.06)",
                border: "1px solid rgba(0,255,163,0.18)",
              }}>
                <span className="live-dot" aria-hidden="true" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,255,163,0.8)", letterSpacing: "0.04em" }}>
                  {isLive ? "CPCB LIVE DATA" : "OPEN-METEO ESTIMATES"}
                </span>
              </div>
              {!loading && stations.length > 0 && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {stations.length} stations monitored
                </span>
              )}
            </div>

            {/* Main headline */}
            <h1 className="hero-title" style={{ marginBottom: 24 }}>
              <span style={{
                display: "block",
                background: "linear-gradient(135deg, #fff 0%, rgba(223,242,233,0.7) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                See the air
              </span>
              <span style={{
                display: "block",
                background: "linear-gradient(135deg, #00ffa3 0%, #00d4ff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                differently.
              </span>
            </h1>

            <p style={{
              fontSize: 17,
              color: "rgba(223,242,233,0.55)",
              lineHeight: 1.65,
              fontWeight: 400,
              maxWidth: 480,
              marginBottom: 44,
            }}>
              Explore hyperlocal air quality, understand pollution patterns, and discover what the next few hours may bring — powered by XGBoost ML forecasting.
            </p>

            {/* CTA buttons */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 52 }}>
              <Link href="/dashboard" className="btn btn-primary" style={{ fontSize: 14, padding: "13px 26px", borderRadius: 12 }}>
                <Activity size={16} aria-hidden="true" />
                Explore live air quality
              </Link>
              <Link href="/trends" className="btn btn-secondary" style={{ fontSize: 14, padding: "12px 24px", borderRadius: 12 }}>
                <TrendingUp size={16} aria-hidden="true" />
                View forecast
              </Link>
            </div>

            {/* Mini stats */}
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              {[
                { icon: Globe, label: "Coverage", value: "Western India", color: "#00ffa3" },
                { icon: Zap, label: "Forecast", value: "1h · 3h · 6h", color: "#00d4ff" },
                { icon: Shield, label: "Model", value: "XGBoost ML", color: "#a3e635" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `rgba(${item.color === "#00ffa3" ? "0,255,163" : item.color === "#00d4ff" ? "0,212,255" : "163,230,53"},0.10)`,
                    border: `1px solid ${item.color}25`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <item.icon size={14} color={item.color} aria-hidden="true" />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Globe + live AQI card */}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            {/* Globe */}
            <div className="float" style={{ width: "100%", maxWidth: 480, aspectRatio: "1", position: "relative" }}>
              <AtmosphericGlobe aqiColor={meta?.color ?? "#00ffa3"} aqi={aqi ?? 0} />
            </div>

            {/* Live AQI card floating below globe */}
            {selected && aqi != null && meta && (
              <div
                className="glass-card fade-in"
                style={{
                  padding: "16px 20px",
                  width: "100%", maxWidth: 400,
                  border: `1px solid ${meta.color}30`,
                  boxShadow: `0 0 40px ${meta.color}15`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <MapPin size={13} color="var(--text-muted)" aria-hidden="true" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                      {selected.station} · {selected.city}
                    </span>
                  </div>
                  <span className="aqi-badge" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, fontSize: 10 }}>
                    {meta.label}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div>
                    <div className="display-num" style={{ fontSize: 38, color: meta.color, lineHeight: 1 }} aria-label={`Current AQI: ${aqi}`}>{aqi}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>AQI Index</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {[
                        { label: "PM2.5", value: `${selected.pm25.toFixed(1)}`, unit: "µg/m³" },
                        { label: "PM10", value: selected.pm10 ? `${selected.pm10.toFixed(1)}` : "—", unit: "µg/m³" },
                      ].map(m => (
                        <div key={m.label} style={{ background: "rgba(0,255,163,0.04)", borderRadius: 8, padding: "6px 9px", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 9.5, color: "var(--text-muted)", fontWeight: 600 }}>{m.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Outfit',sans-serif" }}>{m.value} <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 500, fontFamily: "'Inter',sans-serif" }}>{m.unit}</span></div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <AQIBand aqi={aqi} />
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.45 }}>{meta.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Scroll cue */}
        <button
          onClick={scrollToContent}
          aria-label="Scroll to content"
          style={{
            position: "absolute", bottom: 28, left: "50%",
            transform: "translateX(-50%)",
            background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            color: "rgba(0,255,163,0.4)",
            animation: "floatAnim 2.5s ease-in-out infinite",
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Explore</span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </section>

      {/* ══════════ MAIN CONTENT ══════════ */}
      <div id="main-content" style={{ padding: "0 40px 80px", maxWidth: 1520, margin: "0 auto" }}>

        {/* ── Error ── */}
        {error && (
          <div role="alert" style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            borderLeft: "3px solid #ef4444", borderRadius: 12,
            padding: "14px 18px", marginBottom: 24,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <AlertTriangle size={16} color="#ef4444" aria-hidden="true" />
            <p style={{ fontSize: 13, color: "rgba(239,68,68,0.9)", fontWeight: 500 }}>{error}</p>
          </div>
        )}

        {/* ── Data status row ── */}
        {!loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
            <span className="source-badge" style={{
              background: isLive ? "rgba(0,255,163,0.08)" : "rgba(245,158,11,0.08)",
              color: isLive ? "#00ffa3" : "#f59e0b",
              border: `1px solid ${isLive ? "rgba(0,255,163,0.2)" : "rgba(245,158,11,0.2)"}`,
            }}>
              {isLive ? "● CPCB Live" : "◎ Open-Meteo Estimated"}
            </span>
            {selected?.fetched_at && (
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                Updated {new Date(selected.fetched_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
              </span>
            )}
            <button onClick={() => load(true)} className="btn btn-ghost" disabled={refreshing} aria-label="Refresh stations" style={{ marginLeft: "auto", padding: "5px 12px", fontSize: 12 }}>
              <RefreshCw size={12} className={refreshing ? "spin" : ""} aria-hidden="true" />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        )}

        {/* ── 3-column grid: Map | AQI details | Forecast ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)",
          gap: 22,
          marginBottom: 28,
        }}>
          {/* Map card */}
          <div className="glass-card" style={{ padding: "20px", minHeight: 500 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Map size={15} color="#00ffa3" aria-hidden="true" />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  Monitoring Stations
                </h2>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({stations.length})</span>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {(["PM2.5", "PM10", "NO2"] as const).map(pol => (
                  <button key={pol} onClick={() => setActivePollutant(pol)} aria-pressed={activePollutant === pol}
                    className={`filter-pill ${activePollutant === pol ? "filter-pill-active" : "filter-pill-inactive"}`}>
                    {pol}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: 400, borderRadius: 12, overflow: "hidden" }}>
              {loading ? (
                <div className="skeleton" style={{ height: "100%", borderRadius: 12 }} />
              ) : (
                <EmbeddedMap
                  stations={stations}
                  selectedStation={selected}
                  onSelectStation={s => setSelected(s as ExtendedStation)}
                  activePollutant={activePollutant}
                  center={selected ? [selected.latitude, selected.longitude] : [19.076, 72.8777]}
                  zoom={10}
                />
              )}
            </div>
            {/* Map legend */}
            <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
              {[{ l: "Good ≤50", c: "#10b981" }, { l: "Moderate ≤100", c: "#f59e0b" }, { l: "Poor ≤200", c: "#f97316" }, { l: "Unhealthy >200", c: "#ef4444" }].map(x => (
                <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: x.c, boxShadow: `0 0 6px ${x.c}80`, display: "inline-block" }} />
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 500 }}>{x.l}</span>
                </div>
              ))}
              <span style={{ fontSize: 10.5, color: "var(--text-dim)", marginLeft: "auto" }}>India NAQI</span>
            </div>
          </div>

          {/* Right column: AQI gauge + details + forecast */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Current AQI card */}
            {loading ? (
              <div className="glass-card" style={{ padding: 20 }}>
                <div className="skeleton" style={{ height: 130, borderRadius: 12 }} />
              </div>
            ) : selected && aqi != null && meta ? (
              <div className="glass-card" style={{ padding: "22px", border: `1px solid ${meta.color}25` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
                  <GaugeCircle aqiVal={aqi} color={meta.color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                      <span className="aqi-badge" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>{meta.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
                      <MapPin size={12} color="var(--text-muted)" aria-hidden="true" />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{selected.station}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      {[
                        { label: "PM2.5", value: `${selected.pm25.toFixed(1)} µg/m³` },
                        { label: "PM10", value: selected.pm10 ? `${selected.pm10.toFixed(1)} µg/m³` : "—" },
                        { label: "Humidity", value: selected.humidity ? `${selected.humidity}%` : "—" },
                        { label: "Wind", value: selected.wind_speed ? `${selected.wind_speed} km/h` : "—" },
                      ].map(m => (
                        <div key={m.label} style={{ background: "rgba(0,255,163,0.03)", borderRadius: 8, padding: "7px 10px", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 9.5, color: "var(--text-muted)", fontWeight: 600 }}>{m.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <AQIBand aqi={aqi} />
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>{meta.maskAdvice}</p>
                  </div>
                </div>
                <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }}>
                  <label htmlFor="ov-station-select" style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                    Select monitoring station
                  </label>
                  <select id="ov-station-select" className="ap-select" style={{ width: "100%", fontSize: 12 }}
                    value={selected.station}
                    onChange={e => { const f = stations.find(s => s.station === e.target.value); if (f) setSelected(f); }}>
                    {stations.map(s => <option key={s.station} value={s.station}>{s.city} — {s.station}</option>)}
                  </select>
                </div>
              </div>
            ) : null}

            {/* Forecast chart card */}
            <div className="glass-card" style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <TrendingUp size={14} color="#00ffa3" aria-hidden="true" />
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>PM2.5 Forecast</h3>
                </div>
                <span className="tag">XGBoost ML</span>
              </div>

              {forecastLoading ? (
                <div className="skeleton" style={{ height: 110, borderRadius: 10 }} />
              ) : forecastData.length > 0 ? (
                <>
                  <div style={{ width: "100%", height: 120 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={forecastData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="ov-pm25-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00ffa3" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#00ffa3" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,163,0.05)" vertical={false} />
                        <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "rgba(120,170,140,0.5)", fontSize: 10 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: "rgba(120,170,140,0.5)", fontSize: 10 }} width={32} />
                        <Tooltip content={<DarkTooltip />} />
                        <Area type="monotone" dataKey="pm25" name="PM2.5" stroke="#00ffa3" strokeWidth={2.2}
                          fill="url(#ov-pm25-grad)"
                          dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3.5}
                              fill={payload.isForecast ? "#00d4ff" : "#00ffa3"}
                              stroke="rgba(2,10,6,0.8)" strokeWidth={1.5} />;
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {forecastData.filter(p => p.isForecast).map(pt => (
                      <div key={pt.time} style={{
                        flex: 1, background: "rgba(0,255,163,0.04)", borderRadius: 8,
                        padding: "7px 8px", textAlign: "center", border: "1px solid var(--border)",
                      }}>
                        <div style={{ fontSize: 9.5, color: "var(--text-muted)", fontWeight: 600 }}>{pt.time}</div>
                        <div className="display-num" style={{ fontSize: 16, color: "#00d4ff" }}>{pt.pm25?.toFixed(1)}</div>
                        <div style={{ fontSize: 8.5, color: "var(--text-dim)" }}>µg/m³</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 8 }}>
                    🟢 observed · 🔵 ML forecast (XGBoost)
                  </p>
                </>
              ) : (
                <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                  <TrendingUp size={22} color="var(--text-dim)" />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Select a station to see forecast</span>
                </div>
              )}
            </div>

            {/* Health advisory */}
            {meta && (
              <div className="glass-card" style={{ padding: "14px 16px", border: `1px solid ${meta.color}20`, background: `rgba(${meta.color.slice(1).match(/.{2}/g)!.map(h=>parseInt(h,16)).join(",")},0.04)` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Shield size={13} color={meta.color} aria-hidden="true" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Health Advisory</span>
                  <span className="aqi-badge" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, fontSize: 9.5, padding: "1px 8px" }}>{meta.label}</span>
                </div>
                <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{meta.activityAdvice}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.45, marginTop: 6 }}>{meta.ventilationAdvice}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick nav cards ── */}
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
          Explore AirPulse
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          {[
            { href: "/dashboard", icon: Activity, color: "#00ffa3", title: "Live Air Quality", desc: "Full multi-pollutant dashboard with health guidance." },
            { href: "/trends", icon: TrendingUp, color: "#00d4ff", title: "Forecasts", desc: "XGBoost ML predictions for 1h, 3h, and 6h horizons." },
            { href: "/map", icon: Map, color: "#a3e635", title: "Pollution Map", desc: "Interactive station map with AQI plume overlays." },
            { href: "/alerts", icon: Bell, color: "#f59e0b", title: "Alerts", desc: "Configure threshold-based monitoring alerts." },
          ].map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="glass-card glass-card-lift" style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "16px 18px", textDecoration: "none",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: `rgba(${item.color === "#00ffa3" ? "0,255,163" : item.color === "#00d4ff" ? "0,212,255" : item.color === "#a3e635" ? "163,230,53" : "245,158,11"},0.10)`,
                  border: `1px solid ${item.color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={16} color={item.color} aria-hidden="true" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{item.title}</span>
                    <ChevronRight size={12} color="var(--text-muted)" aria-hidden="true" />
                  </div>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45 }}>{item.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
