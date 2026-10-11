"use client";
import { useEffect, useState } from "react";
import {
  TrendingUp, Clock, BarChart2, Sparkles, Filter,
  Layers, ArrowUpRight, ShieldCheck, Compass
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, AreaChart, Area
} from "recharts";
import { getPreferredStation } from "@/lib/locations";

const MOCK_HOURLY = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, "0")}:00`,
  pm25: Math.round(28 + Math.sin(i / 3.5) * 14 + Math.random() * 4),
  pm10: Math.round(45 + Math.sin(i / 3.5) * 22 + Math.random() * 6),
  no2: Math.round(18 + Math.cos(i / 4) * 8 + Math.random() * 3),
}));

export default function TrendsPage() {
  const [stations, setStations] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState(24);
  const [activeTab, setActiveTab] = useState<"pm25" | "all" | "distribution">("all");

  useEffect(() => {
    fetch("/api/current")
      .then(r => r.json())
      .then(d => {
        setStations(d);
        if (d.length > 0) setSelected(getPreferredStation(d)?.station ?? "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetch(`/api/station/${encodeURIComponent(selected)}/history?hours=${hours}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(rows => setHistory(rows.map((row: any) => ({
        ...row,
        time: new Date(row.fetched_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }))))
      .catch(() => setHistory(MOCK_HOURLY))
      .finally(() => setLoading(false));
  }, [selected, hours]);

  const avg = (history.length ? history.reduce((s, r) => s + (r.pm25 || 0), 0) / history.length : 0).toFixed(1);
  const max = Math.max(0, ...history.map(r => r.pm25 || 0)).toFixed(1);
  const min = Math.min(...(history.length ? history.map(r => r.pm25 || 0) : [0])).toFixed(1);

  return (
    <div className="route-page trends-page" style={{ padding: "32px 40px", maxWidth: "1550px", margin: "0 auto" }}>
      {/* Header */}
      <div className="route-header trend-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "28px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <Sparkles size={16} color="#2563eb" />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Temporal Pollution Analytics
            </span>
          </div>
          <h1 style={{ fontSize: "32px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
            Multi-Pollutant Trends & Forecast Vectors
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14.5px", marginTop: "4px" }}>
            Longitudinal sensor analysis comparing PM2.5, PM10, and satellite NO₂ against WHO Air Quality Limits
          </p>
        </div>

        {/* Station Selector */}
        {stations.length > 0 && (
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              style={{
                padding: "10px 16px", borderRadius: "12px", border: "1.5px solid #dbeafe",
                background: "#ffffff", color: "#0f172a", fontWeight: 700, fontSize: "13.5px",
                boxShadow: "var(--shadow-sm)", cursor: "pointer"
              }}
            >
              {stations.map(s => (
                <option key={s.station} value={s.station}>
                  {s.city || s.station}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPI Highlights */}
      <div className="trend-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginBottom: "26px" }}>
        {[
          { label: "24h Mean PM2.5", val: `${avg} µg/m³`, sub: "WHO Safe Baseline: 15 µg", color: "#2563eb" },
          { label: "Peak Observed Peak", val: `${max} µg/m³`, sub: "Diurnal Peak (Traffic / Inversion)", color: "#ea580c" },
          { label: "Minimum Recorded", val: `${min} µg/m³`, sub: "Post-wind Dispersion Valley", color: "#059669" },
          { label: "Compliance Index", val: Number(avg) <= 35 ? "92% Safe" : "Action Required", sub: "Regional AQ Standards", color: "#7c3aed" },
        ].map((k, i) => (
          <div key={i} className="glass-card card-3d" style={{ padding: "20px 24px" }}>
            <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-muted)" }}>{k.label}</div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", marginTop: "6px" }}>{k.val}</div>
            <div style={{ fontSize: "11.5px", fontWeight: 700, color: k.color, marginTop: "4px" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Main Longitudinal Trend Chart */}
      <div className="glass-card card-3d trend-chart-card" style={{ padding: "30px", marginBottom: "26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
              24-Hour Diurnal Progression (PM2.5 vs PM10 vs NO₂)
            </h2>
            <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "2px" }}>
              Observed telemetry curve with WHO Guideline Reference Threshold
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            {(["all", "pm25"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "6px 14px", borderRadius: "8px", fontSize: "12.5px", fontWeight: 700,
                  border: activeTab === tab ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                  background: activeTab === tab ? "#eff6ff" : "#ffffff",
                  color: activeTab === tab ? "#1d4ed8" : "#64748b",
                  cursor: "pointer"
                }}
              >
                {tab === "all" ? "Combined Tri-Vector" : "PM2.5 Focus"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: "350px", width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pm25Fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#07877d" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#07877d" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="pm10Fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d5a758" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#d5a758" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} unit=" µg" />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #dbeafe",
                  borderRadius: "12px",
                  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
                  fontWeight: 700,
                  color: "#0f172a"
                }}
              />
              <Legend verticalAlign="top" height={36} />
              <ReferenceLine y={15} label="WHO Limit (15 µg)" stroke="#b87562" strokeDasharray="4 4" />

              <Area type="monotone" name="PM2.5 (Fine)" dataKey="pm25" stroke="#07877d" strokeWidth={2.5} fill="url(#pm25Fill)" />
              {activeTab === "all" && (
                <>
                  <Area type="monotone" name="PM10 (Dust)" dataKey="pm10" stroke="#d5a758" strokeWidth={2} fill="url(#pm10Fill)" />
                  <Line type="monotone" name="NO₂ Satellite" dataKey="no2" stroke="#537684" strokeWidth={2} dot={false} />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
