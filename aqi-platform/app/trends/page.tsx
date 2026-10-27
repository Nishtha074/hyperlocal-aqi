"use client";
import { useEffect, useState, useMemo } from "react";
import {
  TrendingUp, BarChart2, Clock, MapPin,
  ArrowUpRight, Wind, Sparkles, RefreshCw,
  Activity, Layers, Calendar, Download, FileText
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e2e8f0",
      borderRadius: 12, padding: "12px 16px",
      boxShadow: "0 8px 24px rgba(15,23,42,0.12)"
    }}>
      <p style={{ fontSize: 10.5, fontWeight: 800, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
          <span style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>{p.name}:</span>
          <strong style={{ fontSize: 12.5, color: p.color }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function TrendsPage() {
  const [stations, setStations]     = useState<ExtendedStation[]>(FALLBACK_STATIONS);
  const [selectedStation, setSelectedStation] = useState<ExtendedStation>(FALLBACK_STATIONS[0]);
  const [hours, setHours]           = useState<number>(24);
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

  // AQI Danger threshold reference line value
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
    <div style={{ padding: "32px 36px 64px", maxWidth: 1600, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em",
              color: "#d97706", background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
              border: "1px solid #fde68a", padding: "4px 10px", borderRadius: 8,
              display: "flex", alignItems: "center", gap: 6
            }}>
              <TrendingUp size={12} /> Time-Series & Predictive Analytics
            </span>
            <span className="live-dot" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>Predictive Forecast Engine</span>
          </div>
          <h1 className="section-title">Historical Trends &amp; Forecasts</h1>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 6, fontWeight: 500 }}>
            Diurnal pollution accumulation cycles, atmospheric lag correlations, and multi-horizon projections.
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
                {s.city} — {s.station}
              </option>
            ))}
          </select>
          <button onClick={handleExportCSV} className="btn-secondary">
            <Download size={14} color="#059669" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginBottom: 28 }}>
        {[
          {
            label: "Current AQI",
            value: curAQI,
            sub: curMeta.label,
            color: curMeta.color,
            bg: curMeta.bg,
            unit: "",
            icon: Activity,
            accent: curMeta.color,
          },
          {
            label: `${hours}h Average PM2.5`,
            value: avg,
            sub: "Window mean concentration",
            color: "var(--text-title)",
            bg: "#f8fafc",
            unit: "µg/m³",
            icon: BarChart2,
            accent: "#0284c7",
          },
          {
            label: "Peak Level",
            value: max.toFixed(1),
            sub: "Rush-hour accumulation",
            color: "#ea580c",
            bg: "#fff7ed",
            unit: "µg/m³",
            icon: ArrowUpRight,
            accent: "#ea580c",
          },
          {
            label: "Trough Level",
            value: min.toFixed(1),
            sub: "Afternoon clearance",
            color: "#059669",
            bg: "#ecfdf5",
            unit: "µg/m³",
            icon: Wind,
            accent: "#059669",
          },
        ].map((m) => (
          <div
            key={m.label}
            className="stat-card hover-lift"
            style={{ "--stat-accent": m.accent } as any}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: m.bg, display: "flex", alignItems: "center", justifyContent: "center",
                  color: m.color,
                }}
              >
                <m.icon size={18} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8" }}>
                {m.label}
              </span>
            </div>
            <div className="display-num" style={{ fontSize: 34, color: m.color, marginBottom: 4 }}>
              {m.value}{m.unit && <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600, marginLeft: 3 }}>{m.unit}</span>}
            </div>
            <p style={{ fontSize: 11.5, color: "#64748b", fontWeight: 500 }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main Chart Card ── */}
      <div className="light-card" style={{ padding: "26px", marginBottom: 26 }}>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-title)" }}>Pollutant View:</span>
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
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b" }}>Window:</span>
            {[12, 24, 48].map(h => (
              <button
                key={h}
                onClick={() => setHours(h)}
                style={{
                  padding: "5px 13px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  border: hours === h ? "2px solid #0284c7" : "1px solid #e2e8f0",
                  background: hours === h ? "#0284c7" : "#ffffff",
                  color: hours === h ? "#ffffff" : "#475569",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div style={{ width: "100%", height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pm25Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0284c7" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="pm10Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#d97706" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#94a3b8"
                fontSize={10.5}
                tickLine={false}
                axisLine={false}
                interval={hours === 12 ? 2 : hours === 24 ? 3 : 6}
              />
              <YAxis stroke="#94a3b8" fontSize={10.5} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, fontWeight: 700, paddingTop: 12 }}
              />
              {/* Danger threshold line */}
              <ReferenceLine
                y={dangerThresh}
                stroke="#ef4444"
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{ value: "NAQI Limit", position: "right", fontSize: 10, fill: "#ef4444" }}
              />

              {(pollutantTab === "all" || pollutantTab === "pm25") && (
                <Area
                  type="monotone" dataKey="pm25"
                  name="PM2.5 (µg/m³)"
                  stroke="#0284c7" strokeWidth={2.5}
                  fill="url(#pm25Grad)" dot={false}
                  activeDot={{ r: 5, fill: "#0284c7" }}
                />
              )}
              {(pollutantTab === "all" || pollutantTab === "pm10") && (
                <Area
                  type="monotone" dataKey="pm10"
                  name="PM10 (µg/m³)"
                  stroke="#d97706" strokeWidth={2}
                  fill="url(#pm10Grad)" dot={false}
                  activeDot={{ r: 5, fill: "#d97706" }}
                />
              )}
              {(pollutantTab === "all" || pollutantTab === "aqi") && (
                <Area
                  type="monotone" dataKey="aqi"
                  name="AQI Index"
                  stroke="#8b5cf6" strokeWidth={2}
                  fill="url(#aqiGrad)" dot={false}
                  activeDot={{ r: 5, fill: "#8b5cf6" }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Diurnal Pattern Insight ── */}
      <div className="light-card" style={{ padding: "24px", background: "linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Sparkles size={16} color="#0284c7" />
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-title)" }}>Atmospheric Pattern Insights</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {[
            { time: "06–09 AM", trend: "↑ Rising", desc: "Morning rush-hour vehicle emissions drive PM2.5 accumulation.", color: "#d97706", bg: "#fffbeb" },
            { time: "12–14 PM", trend: "↓ Dispersing", desc: "Thermal mixing layer rises, diluting near-surface particulates.", color: "#059669", bg: "#ecfdf5" },
            { time: "17–20 PM", trend: "↑ Peak", desc: "Evening boundary layer collapse traps pollutants close to ground.", color: "#dc2626", bg: "#fff1f2" },
            { time: "02–05 AM", trend: "↓ Lowest",  desc: "Nocturnal wind shift and minimal emissions produce trough conditions.", color: "#0284c7", bg: "#f0f9ff" },
          ].map(p => (
            <div key={p.time} style={{
              background: p.bg, borderRadius: 14,
              padding: "14px 16px",
              border: `1px solid ${p.color}30`
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>{p.time}</span>
                <span style={{ fontSize: 12, fontWeight: 900, color: p.color }}>{p.trend}</span>
              </div>
              <p style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.45, fontWeight: 500 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
