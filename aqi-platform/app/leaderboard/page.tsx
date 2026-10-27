"use client";
import React, { useEffect, useState, useMemo } from "react";
import {
  Trophy, RefreshCw, BarChart2, MapPin, ShieldCheck, ShieldAlert,
  Search, ArrowUpDown, Sparkles, TrendingUp
} from "lucide-react";
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
  { medal: "🥇", rank: 1, glow: "#f59e0b", border: "rgba(245, 158, 11, 0.4)", bg: "rgba(245, 158, 11, 0.1)", label: "Cleanest Regional Air" },
  { medal: "🥈", rank: 2, glow: "var(--cyan)", border: "rgba(0, 212, 255, 0.4)", bg: "rgba(0, 212, 255, 0.1)", label: "Runner Up" },
  { medal: "🥉", rank: 3, glow: "#fb923c", border: "rgba(251, 146, 60, 0.4)", bg: "rgba(251, 146, 60, 0.1)", label: "Third Cleanest" },
];

export default function LeaderboardPage() {
  const [stations, setStations] = useState<ExtendedStation[]>(FALLBACK_STATIONS);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "gujarat" | "maharashtra">("all");
  const [sortOrder, setSortOrder] = useState<"cleanest" | "polluted">("cleanest");

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

  const top3 = processedStations.slice(0, 3);
  const avgAQI = Math.round(stations.reduce((acc, s) => acc + calculateAQI(s.pm25), 0) / (stations.length || 1));

  // Chart data (top 10)
  const chartData = processedStations.slice(0, 10).map(s => ({
    name: s.city.substring(0, 8),
    aqi: s.aqi,
    pm25: s.pm25.toFixed(1),
    color: getAQIMeta(s.aqi).color
  }));

  return (
    <div style={{ padding: "28px 32px 72px", maxWidth: 1520, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em",
              color: "#f59e0b", background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)", padding: "4px 10px", borderRadius: 6,
              display: "flex", alignItems: "center", gap: 6
            }}>
              <Trophy size={12} /> Air Quality Rankings &amp; Benchmark
            </span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mint)" }}>Real-Time Leaderboard</span>
          </div>
          <h1 className="section-title">Regional Clean Air Benchmark</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6, fontWeight: 400, maxWidth: 620 }}>
            Standardized pollution standings across Western Indian municipal centers, coastal corridors, and industrial belts.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={loadData} className="btn-secondary">
            <RefreshCw size={14} className={refreshing ? "spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Summary Stats Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 26 }}>
        {[
          { label: "Stations Monitored", value: stations.length, color: "var(--mint)", icon: MapPin },
          { label: "Regional Mean AQI", value: avgAQI, color: getAQIMeta(avgAQI).color, icon: BarChart2 },
          { label: "Gujarat Hubs", value: processedStations.filter(s => ["Ahmedabad","Anand","Vadodara","Surat","Rajkot"].some(c => s.city.includes(c))).length, color: "var(--cyan)", icon: ShieldCheck },
          { label: "Maharashtra Hubs", value: processedStations.filter(s => ["Mumbai","Pune","Nagpur","Nashik","Thane"].some(c => s.city.includes(c))).length, color: "#a855f7", icon: ShieldAlert },
        ].map(m => (
          <div key={m.label} className="glass-card" style={{ padding: "18px 20px" }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "var(--bg-surface)",
              border: `1px solid ${m.color}35`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: m.color, marginBottom: 12,
              boxShadow: `0 0 12px ${m.color}20`
            }}>
              <m.icon size={18} />
            </div>
            <div className="display-num" style={{ fontSize: 32, color: m.color }}>{m.value}</div>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4, fontWeight: 600 }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* ── Top 3 Cleanest Air Podium ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginBottom: 28 }}>
        {top3.map((st, i) => {
          const style = MEDAL_STYLES[i] || MEDAL_STYLES[2];
          const meta = getAQIMeta(st.aqi);
          return (
            <div
              key={st.station}
              className="glass-card"
              style={{
                padding: "24px",
                border: `1px solid ${style.border}`,
                boxShadow: `0 0 24px ${style.border}`,
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 32 }}>{style.medal}</span>
                <span style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                  color: style.glow,
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}>
                  Rank #{style.rank} · {style.label}
                </span>
              </div>

              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>
                {st.city}
              </h3>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>
                {st.station}
              </span>

              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: "auto" }}>
                <span className="display-num" style={{ fontSize: 36, color: meta.color }}>
                  {st.aqi}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>AQI</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: "auto" }}>
                  PM2.5: <strong>{st.pm25.toFixed(1)}</strong> µg/m³
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Filter Bar & Search ── */}
      <div className="glass-card" style={{ padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search city or station…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="ap-input"
              style={{ paddingLeft: 34, width: 230 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {(["all", "gujarat", "maharashtra"] as const).map(st => (
              <button
                key={st}
                onClick={() => setStateFilter(st)}
                className={stateFilter === st ? "filter-pill filter-pill-active" : "filter-pill filter-pill-inactive"}
              >
                {st === "all" ? "All States" : st === "gujarat" ? "Gujarat" : "Maharashtra"}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setSortOrder(o => o === "cleanest" ? "polluted" : "cleanest")}
          className="btn-secondary"
          style={{ padding: "7px 14px", fontSize: 12 }}
        >
          <ArrowUpDown size={13} />
          <span>Sort: {sortOrder === "cleanest" ? "Cleanest First" : "Most Polluted First"}</span>
        </button>
      </div>

      {/* ── Bar Chart Comparison ── */}
      <div className="glass-card" style={{ padding: "26px", marginBottom: 26 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
          Top 10 Benchmark Comparison
        </h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
          Direct air quality index comparisons across selected centers.
        </p>

        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload;
                  return (
                    <div style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-bright)",
                      borderRadius: 10,
                      padding: "8px 12px",
                      fontSize: 12,
                    }}>
                      <strong style={{ color: "var(--text-primary)" }}>{label}</strong>
                      <div style={{ color: item.color, marginTop: 4, fontWeight: 700 }}>
                        AQI: {item.aqi}
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                        PM2.5: {item.pm25} µg/m³
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="aqi" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Full Rankings Table ── */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <table className="ap-table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>Rank</th>
              <th>City &amp; Station</th>
              <th>AQI Status</th>
              <th>PM2.5 Level</th>
              <th>PM10</th>
              <th>Wind</th>
              <th>Observation Source</th>
            </tr>
          </thead>
          <tbody>
            {processedStations.map((st, idx) => {
              const meta = getAQIMeta(st.aqi);
              return (
                <tr key={st.station}>
                  <td>
                    <span style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 800,
                      fontSize: 15,
                      color: idx === 0 ? "#f59e0b" : idx === 1 ? "var(--cyan)" : idx === 2 ? "#fb923c" : "var(--text-muted)",
                    }}>
                      #{idx + 1}
                    </span>
                  </td>
                  <td>
                    <div>
                      <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{st.city}</strong>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{st.station}</div>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: meta.bg,
                      color: meta.color,
                      border: `1px solid ${meta.border}`,
                      fontSize: 11,
                      fontWeight: 800,
                    }}>
                      {st.aqi} — {meta.label}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: "var(--text-primary)", fontSize: 13 }}>
                      {st.pm25.toFixed(1)}
                    </strong>
                    <span style={{ fontSize: 10.5, color: "var(--text-muted)", marginLeft: 3 }}>µg/m³</span>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>
                    {(st.pm10 || st.pm25 * 1.8).toFixed(1)} µg/m³
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>
                    {st.wind_speed ?? 11.2} km/h
                  </td>
                  <td>
                    <span className="source-badge" style={{ background: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                      {st.source || "CAAQMS"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
