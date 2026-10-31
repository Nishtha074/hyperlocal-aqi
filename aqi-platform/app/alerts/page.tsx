"use client";
import { useState, useEffect } from "react";
import {
  Bell, Plus, Trash2, ShieldAlert, AlertTriangle,
  Clock, Zap, Filter, CheckCircle2, Radio, Send,
  BellRing, Info, Settings, TrendingUp, Eye, ToggleLeft, ToggleRight
} from "lucide-react";
import { fetchLiveOrFallbackStations, FALLBACK_STATIONS, ExtendedStation, calculateAQI, getAQIMeta } from "@/lib/dataService";

interface AlertRule {
  id: number;
  station: string;
  city: string;
  pollutant: string;
  operator: string;
  threshold: number;
  is_enabled: boolean;
  created_at: string;
}

const DEFAULT_ALERTS: AlertRule[] = [
  { id: 1, station: "GJ-ANAND-01",  city: "Anand",      pollutant: "pm25", operator: ">",  threshold: 60,  is_enabled: true,  created_at: "Today, 08:30 AM" },
  { id: 2, station: "GJ-AHMD-03",   city: "Ahmedabad",  pollutant: "pm25", operator: ">",  threshold: 80,  is_enabled: true,  created_at: "Today, 09:15 AM" },
  { id: 3, station: "MH-PUNE-05",   city: "Pune",       pollutant: "pm10", operator: ">",  threshold: 100, is_enabled: true,  created_at: "Yesterday, 06:45 PM" },
  { id: 4, station: "GJ-SURAT-02",  city: "Surat",      pollutant: "aqi",  operator: ">=", threshold: 150, is_enabled: false, created_at: "Yesterday, 02:10 PM" },
];

const POLLUTANT_COLORS: Record<string, string> = {
  pm25: "var(--mint)",
  pm10: "#f59e0b",
  aqi:  "var(--cyan)",
  no2:  "#38bdf8",
  so2:  "#ec4899",
};

export default function AlertsPage() {
  const [stations, setStations] = useState<ExtendedStation[]>(FALLBACK_STATIONS);
  const [alerts, setAlerts] = useState<AlertRule[]>(DEFAULT_ALERTS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCity, setSelectedCity] = useState("Anand");
  const [pollutant, setPollutant] = useState("pm25");
  const [operator, setOperator] = useState(">");
  const [threshold, setThreshold] = useState("60");
  const [testNotification, setTestNotification] = useState<string | null>(null);
  const [triggerCity, setTriggerCity] = useState<string | null>(null);

  useEffect(() => {
    fetchLiveOrFallbackStations().then(({ stations: d }) => {
      setStations(d);
      if (d.length > 0) setSelectedCity(d[0].city);
    });
  }, []);

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const targetStation = stations.find(s => s.city === selectedCity);
    const newAlert: AlertRule = {
      id: Date.now(),
      station: targetStation?.station || `${selectedCity}-MONITOR`,
      city: selectedCity,
      pollutant,
      operator,
      threshold: Number(threshold),
      is_enabled: true,
      created_at: "Just now",
    };
    setAlerts([newAlert, ...alerts]);
    setShowAddForm(false);
  };

  const handleDelete = (id: number) => setAlerts(alerts.filter(a => a.id !== id));

  const handleToggle = (id: number) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, is_enabled: !a.is_enabled } : a));
  };

  const handleSimulateAlert = () => {
    const randomStation = stations[Math.floor(Math.random() * stations.length)];
    const aqi = calculateAQI(randomStation.pm25);
    setTriggerCity(randomStation.city);
    setTestNotification(
      `🚨 ${randomStation.city} — PM2.5 reached ${randomStation.pm25.toFixed(1)} µg/m³ (AQI: ${aqi}) · Automated threshold trigger!`
    );
    setTimeout(() => { setTestNotification(null); setTriggerCity(null); }, 6000);
  };

  const activeCount   = alerts.filter(a => a.is_enabled).length;
  const inactiveCount = alerts.filter(a => !a.is_enabled).length;

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
              <Bell size={12} /> Automated Early Warnings
            </span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--mint)", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mint)" }}>Evaluation Loop Active</span>
          </div>
          <h1 className="section-title">Environmental Alert Rules</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6, fontWeight: 400, maxWidth: 620 }}>
            Configure real-time threshold monitoring rules with multi-channel dispatch and statutory exposure warnings.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={handleSimulateAlert} className="btn-secondary">
            <Zap size={14} color="#f59e0b" />
            <span>Simulate Spike</span>
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
            <Plus size={15} />
            <span>{showAddForm ? "Cancel" : "Add Alert Rule"}</span>
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 26 }}>
        {[
          { label: "Configured Rules", value: alerts.length, color: "var(--mint)", icon: Bell },
          { label: "Active Monitors",  value: activeCount,   color: "var(--cyan)", icon: CheckCircle2 },
          { label: "Paused Monitors",  value: inactiveCount, color: "var(--text-muted)", icon: Eye },
          { label: "Covered Stations", value: new Set(alerts.map(a => a.station)).size, color: "#a855f7", icon: Radio },
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

      {/* ── Live Alert Toast ── */}
      {testNotification && (
        <div className="fade-up" style={{
          background: "rgba(239, 68, 68, 0.12)",
          border: "1px solid rgba(239, 68, 68, 0.4)",
          borderRadius: 14,
          padding: "16px 20px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 14,
          boxShadow: "0 8px 30px rgba(239, 68, 68, 0.25)"
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(239, 68, 68, 0.2)",
            border: "1px solid rgba(239, 68, 68, 0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--aqi-unhealthy)", flexShrink: 0
          }}>
            <BellRing size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 13.5, color: "var(--text-primary)", display: "block", marginBottom: 3 }}>
              Real-Time Alert Dispatched — {triggerCity}
            </strong>
            <p style={{ fontSize: 12.5, color: "var(--aqi-unhealthy)", fontWeight: 600 }}>{testNotification}</p>
          </div>
          <button
            onClick={() => setTestNotification(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Add Alert Form ── */}
      {showAddForm && (
        <div className="glass-card fade-up" style={{ padding: "26px", marginBottom: 28, border: "1px solid var(--border-bright)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "var(--bg-glass-md)",
              border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--mint)"
            }}>
              <Settings size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>Create New Alert Monitor</h2>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Set automatic thresholds triggering immediate early warning notifications.</p>
            </div>
          </div>

          <form onSubmit={handleCreateAlert} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 7 }}>
                Target City / Regional Hub
              </label>
              <select
                className="ap-select"
                value={selectedCity}
                onChange={e => setSelectedCity(e.target.value)}
                style={{ width: "100%" }}
              >
                {stations.map(s => <option key={s.station} value={s.city}>{s.city} ({s.station})</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 7 }}>
                Monitored Pollutant
              </label>
              <select
                className="ap-select"
                value={pollutant}
                onChange={e => setPollutant(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="pm25">PM2.5 — Fine Respirable Particulates</option>
                <option value="pm10">PM10 — Coarse Inhalable Dust</option>
                <option value="aqi">Overall Air Quality Index (AQI)</option>
                <option value="no2">NO2 — Nitrogen Dioxide</option>
                <option value="so2">SO2 — Sulphur Dioxide</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 7 }}>
                Trigger Condition
              </label>
              <select
                className="ap-select"
                value={operator}
                onChange={e => setOperator(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value=">">Exceeds Threshold (&gt;)</option>
                <option value=">=">Reaches or Exceeds (≥)</option>
                <option value="<">Falls Below (&lt;)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 7 }}>
                Threshold Limit Value
              </label>
              <input
                type="number"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
                className="ap-input"
                style={{ width: "100%" }}
                required
              />
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-ghost">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save &amp; Activate Rule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Alerts Table / Grid ── */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16 }}>
          Configured Alert Rules
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {alerts.map(rule => {
            const color = POLLUTANT_COLORS[rule.pollutant] || "var(--mint)";
            return (
              <div
                key={rule.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  borderRadius: 14,
                  background: rule.is_enabled ? "var(--bg-surface)" : "var(--bg-card)",
                  border: "1px solid var(--border)",
                  opacity: rule.is_enabled ? 1 : 0.6,
                  transition: "all 0.2s ease",
                  flexWrap: "wrap",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${color}15`,
                    border: `1px solid ${color}35`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color,
                  }}>
                    <Bell size={16} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>
                        {rule.city}
                      </strong>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        ({rule.station})
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      Trigger when <span style={{ color, fontWeight: 700 }}>{rule.pollutant.toUpperCase()}</span> {rule.operator} <strong>{rule.threshold}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <button
                    onClick={() => handleToggle(rule.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "transparent",
                      border: "none",
                      color: rule.is_enabled ? "var(--mint)" : "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {rule.is_enabled ? <ToggleRight size={22} color="var(--mint)" /> : <ToggleLeft size={22} color="var(--text-muted)" />}
                    <span>{rule.is_enabled ? "Active" : "Disabled"}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="btn-ghost"
                    style={{ color: "var(--aqi-unhealthy)", padding: "6px" }}
                    title="Delete Rule"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
