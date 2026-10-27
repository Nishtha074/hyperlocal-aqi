"use client";
import { useState, useEffect } from "react";
import {
  Bell, Plus, Trash2, ShieldAlert, AlertTriangle,
  Clock, Zap, Filter, CheckCircle2, Radio, Send,
  BellRing, Info, Settings, TrendingUp, Eye
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
  triggered?: boolean;
}

const DEFAULT_ALERTS: AlertRule[] = [
  { id: 1, station: "GJ-ANAND-01",  city: "Anand",      pollutant: "pm25", operator: ">",  threshold: 60,  is_enabled: true,  created_at: "Today, 08:30 AM" },
  { id: 2, station: "GJ-AHMD-03",   city: "Ahmedabad",  pollutant: "pm25", operator: ">",  threshold: 80,  is_enabled: true,  created_at: "Today, 09:15 AM" },
  { id: 3, station: "MH-PUNE-05",   city: "Pune",       pollutant: "pm10", operator: ">",  threshold: 100, is_enabled: true,  created_at: "Yesterday, 06:45 PM" },
  { id: 4, station: "GJ-SURAT-02",  city: "Surat",      pollutant: "aqi",  operator: ">=", threshold: 150, is_enabled: false, created_at: "Yesterday, 02:10 PM" },
];

const POLLUTANT_COLORS: Record<string, string> = {
  pm25: "#0284c7",
  pm10: "#d97706",
  aqi:  "#7c3aed",
  no2:  "#059669",
  so2:  "#dc2626",
};

export default function AlertsPage() {
  const [stations, setStations]     = useState<ExtendedStation[]>(FALLBACK_STATIONS);
  const [alerts, setAlerts]         = useState<AlertRule[]>(DEFAULT_ALERTS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCity, setSelectedCity] = useState("Anand");
  const [pollutant, setPollutant]   = useState("pm25");
  const [operator, setOperator]     = useState(">");
  const [threshold, setThreshold]   = useState("60");
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
      `🚨 ${randomStation.city} — PM2.5 reached ${randomStation.pm25.toFixed(1)} µg/m³ (AQI: ${aqi}) · Threshold exceeded!`
    );
    setTimeout(() => { setTestNotification(null); setTriggerCity(null); }, 6000);
  };

  const activeCount   = alerts.filter(a => a.is_enabled).length;
  const inactiveCount = alerts.filter(a => !a.is_enabled).length;

  return (
    <div style={{ padding: "32px 36px 64px", maxWidth: 1600, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em",
              color: "#7c3aed", background: "linear-gradient(135deg, #faf5ff, #ede9fe)",
              border: "1px solid #e9d5ff", padding: "4px 10px", borderRadius: 8,
              display: "flex", alignItems: "center", gap: 6
            }}>
              <Bell size={12} /> Automated Early Warnings
            </span>
            <span className="live-dot" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>FastAPI Scheduler Active</span>
          </div>
          <h1 className="section-title">Early Warning Alert Rules</h1>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 6, fontWeight: 500 }}>
            Configure automated threshold monitors for particulate matter spikes with deduplicated alert dispatch.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={handleSimulateAlert} className="btn-secondary">
            <Zap size={14} color="#d97706" />
            <span>Simulate Spike</span>
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
            <Plus size={15} />
            <span>{showAddForm ? "Cancel" : "Add Alert Rule"}</span>
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Rules",   value: alerts.length,      color: "#1d72f2", bg: "#eff6ff", icon: Bell },
          { label: "Active Monitors", value: activeCount,      color: "#059669", bg: "#ecfdf5", icon: CheckCircle2 },
          { label: "Inactive Rules", value: inactiveCount,     color: "#94a3b8", bg: "#f8fafc", icon: Eye },
          { label: "Stations Covered", value: new Set(alerts.map(a => a.station)).size, color: "#7c3aed", bg: "#faf5ff", icon: Radio },
        ].map(m => (
          <div key={m.label} className="stat-card hover-lift" style={{ "--stat-accent": m.color } as any}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", color: m.color, marginBottom: 12 }}>
              <m.icon size={18} />
            </div>
            <div className="display-num" style={{ fontSize: 32, color: m.color }}>{m.value}</div>
            <p style={{ fontSize: 11.5, color: "#64748b", marginTop: 4, fontWeight: 600 }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* ── Live Alert Toast ── */}
      {testNotification && (
        <div className="fade-up" style={{
          background: "linear-gradient(135deg, #fff7ed, #fffbeb)",
          border: "1px solid #fed7aa",
          borderLeft: "4px solid #f97316",
          borderRadius: 16,
          padding: "16px 22px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 14,
          boxShadow: "0 6px 24px rgba(234,88,12,0.18)"
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: "#fed7aa", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#ea580c", flexShrink: 0
          }}>
            <BellRing size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 13.5, color: "#9a3412", display: "block", marginBottom: 3 }}>
              Real-Time Alert Dispatched — {triggerCity}
            </strong>
            <p style={{ fontSize: 12.5, color: "#c2410c", fontWeight: 500 }}>{testNotification}</p>
          </div>
          <button
            onClick={() => setTestNotification(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", flexShrink: 0, fontSize: 18 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Add Alert Form ── */}
      {showAddForm && (
        <div className="light-card fade-up" style={{ padding: "26px", marginBottom: 28, borderTop: "4px solid #1d72f2" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d72f2" }}>
              <Settings size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Create New Monitor Rule</h2>
              <p style={{ fontSize: 12, color: "#64748b" }}>Define a threshold that triggers an automated environmental alert.</p>
            </div>
          </div>

          <form onSubmit={handleCreateAlert} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 7 }}>
                Target City / Hub
              </label>
              <select
                className="ap-select"
                value={selectedCity}
                onChange={e => setSelectedCity(e.target.value)}
                style={{ width: "100%" }}
              >
                {stations.map(s => <option key={s.station} value={s.city}>{s.city}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 7 }}>
                Monitored Pollutant
              </label>
              <select
                className="ap-select"
                value={pollutant}
                onChange={e => setPollutant(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="pm25">PM2.5 — Fine Particulates</option>
                <option value="pm10">PM10 — Coarse Dust</option>
                <option value="aqi">Overall AQI Index</option>
                <option value="no2">NO2 — Nitrogen Dioxide</option>
                <option value="so2">SO2 — Sulphur Dioxide</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 7 }}>
                Trigger Condition
              </label>
              <select
                className="ap-select"
                value={operator}
                onChange={e => setOperator(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value=">">Greater than (&gt;)</option>
                <option value=">=">Greater or Equal (≥)</option>
                <option value="<">Drops Below (&lt;)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 7 }}>
                Threshold Value
              </label>
              <input
                type="number"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
                required
                className="ap-input"
                style={{ width: "100%" }}
                placeholder="e.g. 60"
              />
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">
                <Bell size={14} />
                Save &amp; Activate Alert
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Alert Rules Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
        {alerts.map((rule) => {
          const pollColor = POLLUTANT_COLORS[rule.pollutant] || "#64748b";
          return (
            <div
              key={rule.id}
              className="light-card"
              style={{
                padding: "22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                opacity: rule.is_enabled ? 1 : 0.65,
                borderLeft: `4px solid ${rule.is_enabled ? pollColor : "#e2e8f0"}`,
                transition: "all 0.2s ease"
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 6,
                    background: rule.is_enabled ? "#ecfdf5" : "#f8fafc",
                    color: rule.is_enabled ? "#15803d" : "#94a3b8",
                    border: `1px solid ${rule.is_enabled ? "#bbf7d0" : "#e2e8f0"}`,
                    fontSize: 11, fontWeight: 800,
                    display: "flex", alignItems: "center", gap: 4
                  }}>
                    <CheckCircle2 size={11} />
                    {rule.is_enabled ? "Active Monitor" : "Inactive"}
                  </span>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(rule.id)}
                      title={rule.is_enabled ? "Disable" : "Enable"}
                      style={{
                        background: rule.is_enabled ? "#ecfdf5" : "#f8fafc",
                        border: `1px solid ${rule.is_enabled ? "#a7f3d0" : "#e2e8f0"}`,
                        borderRadius: 7, padding: "5px 8px",
                        cursor: "pointer", fontSize: 11, fontWeight: 700,
                        color: rule.is_enabled ? "#059669" : "#94a3b8",
                        display: "flex", alignItems: "center", gap: 4
                      }}
                    >
                      {rule.is_enabled ? "ON" : "OFF"}
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "#94a3b8", padding: 4, display: "flex",
                        borderRadius: 6, transition: "all 0.15s ease"
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#dc2626")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <h3 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 3 }}>
                  {rule.city}
                </h3>
                <p style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500, marginBottom: 16 }}>
                  {rule.station}
                </p>

                {/* Condition block */}
                <div style={{
                  background: `${pollColor}0a`,
                  border: `1px solid ${pollColor}25`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14
                }}>
                  <div>
                    <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.08em" }}>
                      TRIGGER CONDITION
                    </span>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 3 }}>
                      <span style={{ color: pollColor, fontFamily: "'JetBrains Mono', monospace" }}>
                        {rule.pollutant.toUpperCase()}
                      </span>
                      {" "}{rule.operator}{" "}
                      <span style={{ color: pollColor }}>{rule.threshold}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>
                        {rule.pollutant === "co" ? "mg/m³" : rule.pollutant === "aqi" ? "points" : "µg/m³"}
                      </span>
                    </div>
                  </div>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: "#fef9c3", display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#d97706"
                  }}>
                    <Bell size={18} />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                <span style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={11} /> {rule.created_at}
                </span>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, color: "#059669",
                  background: "#ecfdf5", padding: "2px 8px", borderRadius: 4
                }}>
                  Deduplicated
                </span>
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {alerts.length === 0 && (
          <div style={{
            gridColumn: "1 / -1", textAlign: "center", padding: "60px 24px",
            color: "#94a3b8"
          }}>
            <Bell size={48} color="#e2e8f0" style={{ display: "block", margin: "0 auto 16px" }} />
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#334155", marginBottom: 8 }}>No Alert Rules Configured</h3>
            <p style={{ fontSize: 13.5, fontWeight: 500 }}>Click "Add Alert Rule" to create your first pollution threshold monitor.</p>
          </div>
        )}
      </div>

    </div>
  );
}
