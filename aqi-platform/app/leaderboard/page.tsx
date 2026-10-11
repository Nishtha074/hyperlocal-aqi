"use client";
import { useEffect, useState } from "react";
import {
  Trophy, Wind, TrendingDown, TrendingUp, Medal,
  ArrowUpRight, ArrowDownRight, Sparkles, ShieldCheck
} from "lucide-react";

function getAQI(pm25: number): number {
  if (pm25 <= 12) return Math.round((50 / 12) * pm25);
  if (pm25 <= 35.4) return Math.round(50 + (50 / 23.4) * (pm25 - 12));
  if (pm25 <= 55.4) return Math.round(100 + (50 / 20) * (pm25 - 35.4));
  return Math.round(150 + (50 / 95) * (pm25 - 55.4));
}

function getAQIColor(aqi: number): string {
  if (aqi <= 50) return "#059669";
  if (aqi <= 100) return "#d97706";
  if (aqi <= 150) return "#ea580c";
  if (aqi <= 200) return "#dc2626";
  return "#7c3aed";
}

function getAQILevel(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Sensitive";
  if (aqi <= 200) return "Unhealthy";
  return "Very Unhealthy";
}

export default function LeaderboardPage() {
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/current")
      .then(r => r.json())
      .then(d => {
        const sorted = [...d].sort((a, b) => (a.pm25 ?? 999) - (b.pm25 ?? 999));
        setStations(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="route-page leaderboard-page" style={{ padding: "32px 40px", maxWidth: "1550px", margin: "0 auto" }}>
      {/* Header */}
      <div className="route-header" style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <Trophy size={20} color="#d97706" />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Regional AQI Benchmark
          </span>
        </div>
        <h1 style={{ fontSize: "32px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
          City Air Quality Leaderboard
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14.5px", marginTop: "4px" }}>
          Cities ranked in real-time from cleanest atmosphere to highest particulate burden (Rank 1 = Cleanest)
        </p>
      </div>

      {/* Podium Top 3 Cards */}
      {stations.length >= 3 && (
        <div className="leader-podium" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "30px" }}>
          {stations.slice(0, 3).map((s, idx) => {
            const aqi = getAQI(s.pm25 ?? 0);
            const color = getAQIColor(aqi);
            return (
              <div
                key={s.station}
                className="glass-card card-3d"
                style={{
                  padding: "26px", border: `2px solid ${idx === 0 ? "#fde047" : idx === 1 ? "#cbd5e1" : "#fdba74"}`,
                  textAlign: "center"
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "6px" }}>{medals[idx]}</div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Rank #{idx + 1}
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                  {s.city || s.station}
                </div>
                <div style={{ fontSize: "30px", fontWeight: 800, color: color, marginTop: "10px" }}>
                  {aqi} <span style={{ fontSize: "14px", fontWeight: 600, color: "#64748b" }}>AQI</span>
                </div>
                <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "4px" }}>
                  PM2.5: <b>{s.pm25?.toFixed(1)} µg/m³</b>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Rankings Table */}
      <div className="glass-card card-3d leader-table" style={{ padding: "26px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginBottom: "18px" }}>
          Complete Standings ({stations.length} Cities Reporting)
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {stations.map((s, idx) => {
            const aqi = getAQI(s.pm25 ?? 0);
            const color = getAQIColor(aqi);
            const level = getAQILevel(aqi);

            return (
              <div
                key={s.station}
                className="leader-row"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 20px", borderRadius: "14px", background: "#f8fafc",
                  border: "1px solid #e2e8f0"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
                  <span style={{
                    width: "32px", height: "32px", borderRadius: "10px",
                    background: idx < 3 ? "#fef3c7" : "#e2e8f0",
                    color: idx < 3 ? "#b45309" : "#475569",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: "14px"
                  }}>
                    #{idx + 1}
                  </span>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                      {s.city || s.station}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                      Node ID: {s.station}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600 }}>PM2.5</div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                      {s.pm25?.toFixed(1)} µg/m³
                    </div>
                  </div>

                  <div style={{
                    padding: "6px 14px", borderRadius: "10px", background: "#ffffff",
                    border: `1.5px solid ${color}`, minWidth: "100px", textAlign: "center"
                  }}>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: color }}>
                      {aqi} AQI
                    </div>
                    <div style={{ fontSize: "10.5px", fontWeight: 700, color: color }}>
                      {level}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
