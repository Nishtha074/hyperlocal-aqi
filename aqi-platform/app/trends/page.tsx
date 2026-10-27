"use client";
import { useEffect, useState, useMemo } from "react";
import {
  TrendingUp, BarChart2, Clock, MapPin,
  ArrowUpRight, Wind, Sparkles, RefreshCw,
  Activity, Layers, Calendar, Download, FileText, CheckCircle2
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from "recharts";
import {
  fetchLiveOrFallbackStations,
  FALLBACK_STATIONS,
  ExtendedStation,
  calculateAQI,
  getAQIMeta
} from "@/lib/dataService";

function generateRealisticHistory(hours: number, basePm25: number) {
  const now = new Date();
  return Array.from({ length: hours }, (_, i) => {
    const d    = new Date(now.getTime() - (hours - 1 - i) * 3600 * 1000);
    const hour = d.getHours();
    const diurnal =
      Math.sin(((hour - 4) / 24) * 2 * Math.PI) * 14 +
      Math.cos(((hour - 9) / 12) * 2 * Math.PI) * 7;
    const pm25 = Math.max(8, Math.round(basePm25 + diurnal + (Math.random() * 6 - 3)));
    const pm10 = Math.round(pm25 * 1.8 + Math.random() * 8);
    const no2  = Math.round(pm25 * 0.4  + Math.random() * 5);
    const aqi  = calculateAQI(pm25);
    return {
      time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: d.toLocaleDateString([], { month: "short", day: "numeric" }),
      pm25, pm10, no2, aqi
    };
  });
}

const CustomDarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-bright)",
      borderRadius: 12,
      padding: "10px 14px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.7), var(--glow-mint)"
    }}>
      <p style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </p>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
          <span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontWeight: 600 }}>{p.name}:</span>
          <strong style={{ fontSize: 12, color: p.color }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function TrendsPage() {
  const [stations, setStations] = useState<ExtendedStation[]>(FALLBACK_STATIONS);
  const [selectedStation, setSelectedStation] = useState<ExtendedStation>(FALLBACK_STATIONS[0]);
  const [hours, setHours] = useState<number>(24);
  const [pollutantTab, setPollutantTab] = useState<"all" | "pm25" | "pm10" | "aqi">("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLiveOrFallbackStations().then(({ stations: d }) => {
      setStations(d);
      if (d.length > 0) setSelectedStation(d[0]);
    });
  }, []);

  const historyData = useMemo(() => {
    return generateRealisticHistory(hours, selectedStation.pm25);
  }, [hours, selectedStation.pm25]);

  const vals = historyData.map(d => d.pm25);
  const avg  = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  const max  = Math.max(...vals);
  const min  = Math.min(...vals);
  const curAQI  = calculateAQI(selectedStation.pm25);
  const curMeta = getAQIMeta(curAQI);
  const dangerThresh = 60;

  const handleExportCSV = () => {
    const headers = "Time,PM2.5 (µg/m³),PM10 (µg/m³),NO2 (µg/m³),AQI\n";
    const rows = historyData.map(d => `${d.time},${d.pm25},${d.pm10},${d.no2},${d.aqi}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `AirPulse_Trends_${selectedStation.city}_${hours}h.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: "28px 32px 72px", maxWidth: 1520, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em",
              color: "var(--mint)", background: "var(--bg-glass-md)",
              border: "1px solid var(--border-bright)", padding: "4px 10px", borderRadius: 6,
              display: "flex", alignItems: "center", gap: 6
            }}>
              <TrendingUp size={12} /> Time-Series &amp; Predictive Analytics
            </span>
            <span className="live-dot" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mint)" }}>Predictive Forecast Engine</span>
          </div>
          <h1 className="section-title">Historical Trends &amp; Forecasts</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6, fontWeight: 400, maxWidth: 620 }}>
            Diurnal pollution accumulation cycles, atmospheric boundary layer collapse correlations, and multi-horizon projections.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            className="ap-select"
            value={selectedStation.station}
            onChange={(e) => {
              const found = stations.find(s => s.station === e.target.value);
              if (found) setSelectedStation(found);
            }}
          >
            {stations.map(s => (
              <option key={s.station} value={s.station}>
                📍 {s.city} — {s.station}
              </option>
            ))}
          </select>
          <button onClick={handleExportCSV} className="btn-secondary">
            <Download size={14} color="var(--mint)" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginBottom: 26 }}>
        {[
          {
            label: "Current Real-Time AQI",
            value: curAQI,
            sub: curMeta.label,
            color: curMeta.color,
            bg: curMeta.bg,
            unit: "points",
            icon: Activity,
          },
          {
            label: `${hours}h Window Mean PM2.5`,
            value: avg,
            sub: "Moving baseline concentration",
            color: "var(--cyan)",
            bg: "rgba(0, 212, 255, 0.1)",
            unit: "µg/m³",
            icon: BarChart2,
          },
          {
            label: "Peak Observed Surge",
            value: max.toFixed(1),
            sub: "Rush-hour accumulation peak",
            color: "#f97316",
            bg: "rgba(249, 115, 22, 0.1)",
            unit: "µg/m³",
            icon: ArrowUpRight,
          },
          {
            label: "Trough Clearance Level",
            value: min.toFixed(1),
            sub: "Thermal mixing dilution minimum",
            color: "var(--mint)",
            bg: "rgba(0, 255, 163, 0.1)",
            unit: "µg/m³",
            icon: Wind,
          },
        ].map((m) => (
          <div
            key={m.label}
            className="glass-card"
            style={{ padding: "20px 22px" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: m.bg, display: "flex", alignItems: "center", justifyContent: "center",
                  color: m.color, border: `1px solid ${m.color}35`,
                  boxShadow: `0 0 12px ${m.color}25`
                }}
              >
                <m.icon size={18} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
                {m.label}
              </span>
            </div>
            <div className="display-num" style={{ fontSize: 32, color: m.color, marginBottom: 4 }}>
              {m.value}
              {m.unit && <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600, marginLeft: 4 }}>{m.unit}</span>}
            </div>
            <p style={{ fontSize: 11.5, color: "var(--text-secondary)", fontWeight: 500 }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main Chart Card ── */}
      <div className="glass-card" style={{ padding: "26px", marginBottom: 26 }}>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Pollutant Spectrum:</span>
            {(["all", "pm25", "pm10", "aqi"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setPollutantTab(tab)}
                className={pollutantTab === tab ? "filter-pill filter-pill-active" : "filter-pill filter-pill-inactive"}
              >
                {tab === "all" ? "Combined" : tab.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Window:</span>
            {[12, 24, 48].map(h => (
              <button
                key={h}
                onClick={() => setHours(h)}
                style={{
                  padding: "5px 13px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: hours === h ? "1px solid var(--mint)" : "1px solid var(--border)",
                  background: hours === h ? "var(--mint)" : "var(--bg-card)",
                  color: hours === h ? "#ffffff" : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: hours === h ? "var(--glow-mint)" : "none"
                }}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pm25Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--mint)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--mint)" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="pm10Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.30} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--cyan)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval={hours === 12 ? 2 : hours === 24 ? 3 : 6}
              />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomDarkTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, fontWeight: 700, paddingTop: 14 }}
              />
              {/* Danger threshold line */}
              <ReferenceLine
                y={dangerThresh}
                stroke="var(--aqi-unhealthy)"
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{ value: "NAAQS 60 µg/m³ Limit", position: "right", fontSize: 10, fill: "var(--aqi-unhealthy)" }}
              />

              {(pollutantTab === "all" || pollutantTab === "pm25") && (
                <Area
                  type="monotone" dataKey="pm25"
                  name="PM2.5 (µg/m³)"
                  stroke="var(--mint)" strokeWidth={2.5}
                  fill="url(#pm25Grad)" dot={false}
                  activeDot={{ r: 5, fill: "var(--mint)", stroke: "var(--bg-base)", strokeWidth: 2 }}
                />
              )}
              {(pollutantTab === "all" || pollutantTab === "pm10") && (
                <Area
                  type="monotone" dataKey="pm10"
                  name="PM10 (µg/m³)"
                  stroke="#f59e0b" strokeWidth={2}
                  fill="url(#pm10Grad)" dot={false}
                  activeDot={{ r: 5, fill: "#f59e0b" }}
                />
              )}
              {(pollutantTab === "all" || pollutantTab === "aqi") && (
                <Area
                  type="monotone" dataKey="aqi"
                  name="AQI Points"
                  stroke="var(--cyan)" strokeWidth={2}
                  fill="url(#aqiGrad)" dot={false}
                  activeDot={{ r: 5, fill: "var(--cyan)" }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Diurnal Pattern Insight ── */}
      <div className="glass-card" style={{ padding: "26px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <Sparkles size={16} color="var(--mint)" />
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
            Diurnal Atmospheric Micro-Pattern Analysis
          </h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {[
            { time: "06:00 – 09:30 AM", trend: "↑ Rapid Ascent", desc: "Morning vehicular rush-hour emissions collide with low boundary layer ceiling.", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)" },
            { time: "12:00 – 15:00 PM", trend: "↓ Active Dilution", desc: "Solar convective mixing layer expands upward to 1,800m, diluting particulates.", color: "var(--mint)", bg: "rgba(0, 255, 163, 0.08)" },
            { time: "17:30 – 21:00 PM", trend: "↑ Nocturnal Peak", desc: "Ground radiational cooling triggers inversion, trapping toxic pollutants at breath height.", color: "var(--aqi-unhealthy)", bg: "rgba(239, 68, 68, 0.08)" },
            { time: "02:00 – 05:00 AM", trend: "↓ Steady Trough",  desc: "Quiescent urban activity and wind shifts clear suspended mass before dawn.", color: "var(--cyan)", bg: "rgba(0, 212, 255, 0.08)" },
          ].map(p => (
            <div key={p.time} style={{
              background: p.bg, borderRadius: 14,
              padding: "16px",
              border: `1px solid ${p.color}35`,
              boxShadow: `0 0 14px ${p.color}15`
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)" }}>{p.time}</span>
                <span style={{ fontSize: 12, fontWeight: 900, color: p.color }}>{p.trend}</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, fontWeight: 500 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
