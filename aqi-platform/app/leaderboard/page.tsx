"use client";
import React from "react";
import Sidebar from "@/components/Sidebar";
import { useEffect, useState, useMemo } from "react";
import { Trophy, RefreshCw, BarChart2, MapPin, ShieldCheck, ShieldAlert, Search } from "lucide-react";
import {
  fetchLiveOrFallbackStations,
  FALLBACK_STATIONS,
  ExtendedStation,
  calculateAQI,
  getAQIMeta
} from "@/lib/dataService";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from "recharts";

const MEDAL_STYLES = [
  { medal: "🥇", rank: 1, bg: "linear-gradient(135deg, #fefce8, #fef9c3)", border: "#fef08a", color: "#a16207", label: "Cleanest Air" },
  { medal: "🥈", rank: 2, bg: "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: "#e2e8f0", color: "#475569", label: "Runner Up" },
  { medal: "🥉", rank: 3, bg: "linear-gradient(135deg, #fff7ed, #ffedd5)", border: "#fed7aa", color: "#c2410c", label: "Third Cleanest" },
];

export default function LeaderboardPage() {
  const [stations, setStations]     = useState<ExtendedStation[]>(FALLBACK_STATIONS);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "gujarat" | "maharashtra">("all");
  const [sortOrder, setSortOrder]   = useState<"cleanest" | "polluted">("cleanest");

  const loadData = async () => {
    setRefreshing(true);
    try {
      const { stations: d } = await fetchLiveOrFallbackStations();
      setStations(d);
    } catch {
      setStations(FALLBACK_STATIONS);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const processedStations = useMemo(() => {
    let list = stations.map(s => ({ ...s, aqi: calculateAQI(s.pm25) }));

    if (search.trim()) {
      list = list.filter(s =>
        s.city.toLowerCase().includes(search.toLowerCase()) ||
        s.station.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (stateFilter === "gujarat") {
      list = list.filter(s =>
        ["Ahmedabad","Anand","Vadodara","Surat","Rajkot","Gandhinagar","Bhavnagar","Jamnagar","Ankleshwar","Vapi"].some(
          c => s.city.toLowerCase().includes(c.toLowerCase())
        )
      );
    } else if (stateFilter === "maharashtra") {
      list = list.filter(s =>
        ["Mumbai","Pune","Nagpur","Nashik","Thane","Navi Mumbai","Aurangabad","Solapur","Chandrapur","Kalyan"].some(
          c => s.city.toLowerCase().includes(c.toLowerCase())
        )
      );
    }
    list.sort((a, b) => sortOrder === "cleanest" ? a.aqi - b.aqi : b.aqi - a.aqi);
    return list;
  }, [stations, search, stateFilter, sortOrder]);

  const top3   = processedStations.slice(0, 3);
  const avgAQI = Math.round(stations.reduce((acc, s) => acc + calculateAQI(s.pm25), 0) / (stations.length || 1));

  // Chart data (top 10)
  const chartData = processedStations.slice(0, 10).map(s => ({
    name: s.city.substring(0, 8),
    aqi:  s.aqi,
    pm25: s.pm25.toFixed(1),
    color: getAQIMeta(s.aqi).color
  }));

  return (
    <div style={{ display: "flex" }}>
      <Sidebar />
      <div style={{ padding: "32px 36px 64px", maxWidth: 1600, margin: "0 auto", flex: 1 }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em",
              color: "#a16207", background: "linear-gradient(135deg, #fefce8, #fef3c7)",
              border: "1px solid #fef08a", padding: "4px 10px", borderRadius: 8,
              display: "flex", alignItems: "center", gap: 6
            }}>
              <Trophy size={12} /> Air Quality Rankings
            </span>
            <span className="live-dot" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>Live CPCB Telemetry</span>
          </div>
          <h1 className="section-title">Regional Clean Air Benchmark</h1>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 6, fontWeight: 500 }}>
            Real-time pollution standings across Western Indian metropolitan and industrial corridors.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={loadData} className="btn-secondary">
            <RefreshCw size={14} className={refreshing ? "spin" : ""} color="#475569" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Summary Stats Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Stations Monitored", value: stations.length, unit: "", color: "#1d72f2", bg: "#eff6ff", icon: MapPin },
          { label: "Regional Average AQI", value: avgAQI, unit: "", color: getAQIMeta(avgAQI).color, bg: getAQIMeta(avgAQI).bg, icon: BarChart2 ?? Trophy },
          { label: "Gujarat Hubs", value: processedStations.filter(s => ["Ahmedabad","Anand","Vadodara","Surat","Rajkot"].some(c => s.city.includes(c))).length, unit: "", color: "#7c3aed", bg: "#faf5ff", icon: ShieldCheck },
          { label: "Maharashtra Hubs", value: processedStations.filter(s => ["Mumbai","Pune","Nagpur","Nashik","Thane"].some(c => s.city.includes(c))).length, unit: "", color: "#059669", bg: "#ecfdf5", icon: ShieldAlert },
        ].map((m, i) => (
          <div key={m.label} className="stat-card hover-lift" style={{ "--stat-accent": m.color } as any}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: m.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: m.color, marginBottom: 12
            }}>
              <m.icon size={18} />
            </div>
            <div className="display-num" style={{ fontSize: 32, color: m.color }}>{m.value}</div>
            <p style={{ fontSize: 11.5, color: "#64748b", marginTop: 4, fontWeight: 600 }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* ── Top 3 Podium ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginBottom: 28 }}>
        {top3.map((city, idx) => {
          const style = MEDAL_STYLES[idx] || MEDAL_STYLES[1];
          const meta  = getAQIMeta(city.aqi);
          return (
            <div
              key={city.station}
              className="light-card"
              style={{
                padding: "24px",
                background: style.bg,
                border: `1px solid ${style.border}`,
                position: "relative",
                overflow: "hidden"
              }}
            >
              {/* Rank number watermark */}
              <div style={{
                position: "absolute", right: 16, top: 12,
                fontSize: 72, fontWeight: 900,
                color: "rgba(0,0,0,0.04)",
                fontFamily: "'Outfit', sans-serif",
                lineHeight: 1,
              }}>
                #{idx + 1}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 32 }}>{style.medal}</span>
                <span style={{
                  padding: "4px 12px", borderRadius: 8,
                  background: meta.bg, color: meta.color,
                  border: `1px solid ${meta.border}`,
                  fontSize: 11.5, fontWeight: 800
                }}>
                  {meta.label}
                </span>
              </div>

              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 900, color: "#0f172a", marginBottom: 2 }}>
                {city.city}
              </h3>
              <p style={{ fontSize: 12, color: "#64748b", fontWeight: 500, marginBottom: 18 }}>{city.station}</p>

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 14 }}>
                <div>
                  <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.06em" }}>
                    AQI INDEX
                  </span>
                  <div className="display-num" style={{ fontSize: 36, color: meta.color, marginTop: 2 }}>{city.aqi}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.06em" }}>
                    PM2.5
                  </span>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                    {city.pm25.toFixed(1)}
                    <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 3 }}>µg/m³</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bar Chart ── */}
      <div className="light-card" style={{ padding: "24px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Top 10 Cities — AQI Comparison</h3>
        </div>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#ffffff", border: "1px solid #e2e8f0",
                  borderRadius: 12, boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                  fontSize: 12, fontWeight: 700
                }}
              />
              <Bar dataKey="aqi" name="AQI" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="light-card" style={{ padding: "14px 20px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240 }}>
          <Search size={15} color="#64748b" />
          <input
            type="text"
            placeholder="Search city or monitoring station…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", border: "none", outline: "none",
              fontSize: 13.5, fontWeight: 600, color: "#0f172a", background: "transparent",
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(["all", "gujarat", "maharashtra"] as const).map(st => (
            <button
              key={st}
              onClick={() => setStateFilter(st)}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                border: stateFilter === st ? "1.5px solid #0284c7" : "1px solid #cbd5e1",
                background: stateFilter === st ? "#f0f9ff" : "#ffffff",
                color: stateFilter === st ? "#0284c7" : "#475569",
                cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s ease"
              }}
            >
              {st === "all" ? "All Regions" : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSortOrder(prev => prev === "cleanest" ? "polluted" : "cleanest")}
          className="btn-secondary"
          style={{ padding: "7px 14px", fontSize: 12 }}
        >
          {sortOrder === "cleanest" ? "↑ Cleanest First" : "↓ Most Polluted"}
        </button>
      </div>

      {/* ── Rankings Table ── */}
      <div className="light-card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="ap-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>City &amp; Station</th>
              <th>AQI</th>
              <th>Category</th>
              <th>PM2.5</th>
              <th>PM10</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {processedStations.map((city, idx) => {
              const meta = getAQIMeta(city.aqi);
              return (
                <tr key={city.station}>
                  <td>
                    <span style={{
                      fontSize: 14, fontWeight: 900,
                      color: idx < 3 ? ["#a16207","#475569","#c2410c"][idx] : "#0f172a"
                    }}>
                      {idx < 3 ? ["🥇","🥈","🥉"][idx] : `#${idx + 1}`}
                    </span>
                  </td>
                  <td>
                    <strong style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a", display: "block" }}>
                      {city.city}
                    </strong>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{city.station}</span>
                  </td>
                  <td>
                    <span className="display-num" style={{ fontSize: 20, color: meta.color }}>{city.aqi}</span>
                  </td>
                  <td>
                    <span style={{
                      padding: "4px 10px", borderRadius: 6,
                      background: meta.bg, color: meta.color,
                      border: `1px solid ${meta.border}`,
                      fontSize: 11.5, fontWeight: 800, display: "inline-block"
                    }}>
                      {meta.label}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                    {city.pm25.toFixed(1)} <span style={{ fontSize: 10, color: "#94a3b8" }}>µg/m³</span>
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                    {city.pm10 ? city.pm10.toFixed(1) : "—"} <span style={{ fontSize: 10, color: "#94a3b8" }}>µg/m³</span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: "#64748b",
                      background: "#f1f5f9", padding: "3px 8px", borderRadius: 5
                    }}>
                      {city.source === "CPCB" ? "CPCB Official" : "Open-Meteo"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
    </div>
  );
}