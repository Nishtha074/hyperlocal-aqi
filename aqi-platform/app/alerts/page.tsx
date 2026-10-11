"use client";
import { useState, useEffect } from "react";
import { Bell, Plus, Trash2, CheckCircle, Clock, AlertTriangle, ShieldAlert } from "lucide-react";
import { getPreferredStation } from "@/lib/locations";

interface Alert {
  id: number;
  station: string;
  pollutant: string;
  operator: string;
  threshold: number;
  is_enabled: boolean;
  created_at: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    station: "",
    pollutant: "pm25",
    operator: ">",
    threshold: 50,
  });

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error(`Alert service returned ${res.status}`);
      setAlerts(await res.json());
      setError("");
    } catch {
      setError("Could not load alert rules. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStations = async () => {
    try {
      const res = await fetch("/api/current");
      if (!res.ok) throw new Error(`Station service returned ${res.status}`);
      const data = await res.json();
      setStations(data);
      if (data.length > 0 && !form.station) setForm(f => ({ ...f, station: getPreferredStation(data)?.station ?? "" }));
    } catch {
      setError("Could not load locations. Start the air-quality service and try again.");
    }
  };

  useEffect(() => { fetchAlerts(); fetchStations(); }, []);

  const createAlert = async () => {
    if (!form.station) {
      setError("Choose a monitoring location before creating an alert.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`Alert service returned ${res.status}`);
      await fetchAlerts();
      setError("");
    } catch {
      setError("Could not create this alert. Please check the service and try again.");
    } finally {
      setCreating(false);
    }
  };

  const deleteAlert = async (alertId: number) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Alert service returned ${response.status}`);
      await fetchAlerts();
    } catch {
      setError("Could not remove this alert. Please try again.");
    }
  };

  return (
    <div className="route-page alerts-page" style={{ padding: "32px 40px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div className="route-header" style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <Bell size={20} color="#dc2626" />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Automated Hazard Monitoring
          </span>
        </div>
        <h1 style={{ fontSize: "32px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
          Early Warning & Pollution Alerts
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14.5px", marginTop: "4px" }}>
          Configure threshold triggers across regional stations to receive immediate notifications
        </p>
      </div>

      <div className="alerts-layout" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "26px" }}>
        {/* Create Alert Card */}
        <div className="glass-card card-3d" style={{ padding: "30px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Plus size={18} color="#2563eb" /> Create New Threshold Rule
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "6px" }}>
                Target Observation Node
              </label>
              <select
                value={form.station}
                onChange={e => setForm(f => ({ ...f, station: e.target.value }))}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: "12px",
                  border: "1.5px solid #dbeafe", background: "#ffffff", fontWeight: 600, color: "#0f172a"
                }}
              >
                {stations.map(s => (
                  <option key={s.station} value={s.station}>{s.city || s.station}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "6px" }}>
                  Pollutant
                </label>
                <select
                  value={form.pollutant}
                  onChange={e => setForm(f => ({ ...f, pollutant: e.target.value }))}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: "12px",
                    border: "1.5px solid #dbeafe", background: "#ffffff", fontWeight: 600, color: "#0f172a"
                  }}
                >
                  <option value="pm25">PM2.5</option>
                  <option value="pm10">PM10</option>
                  <option value="no2">NO₂</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "6px" }}>
                  Threshold (µg/m³)
                </label>
                <input
                  type="number"
                  value={form.threshold}
                  onChange={e => setForm(f => ({ ...f, threshold: Number(e.target.value) }))}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: "12px",
                    border: "1.5px solid #dbeafe", background: "#ffffff", fontWeight: 600, color: "#0f172a"
                  }}
                />
              </div>
            </div>

            <button
              onClick={createAlert}
              className="btn-pill"
              style={{
                marginTop: "10px", width: "100%", justifyContent: "center",
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#ffffff", border: "none"
              }}
            >
              {creating ? "Activating Rule..." : "Deploy Monitoring Trigger"}
            </button>
          </div>
        </div>

        {/* Active Rules List */}
        <div className="glass-card card-3d" style={{ padding: "30px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginBottom: "20px" }}>
            Active Trigger Registry
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {alerts.length > 0 ? (
              alerts.map(a => (
                <div
                  key={a.id}
                  className="alert-rule"
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "14px 18px", borderRadius: "12px", background: "#f8fafc",
                    border: "1px solid #e2e8f0"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>{a.station}</div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      Trigger when {a.pollutant.toUpperCase()} {a.operator} {a.threshold} µg/m³
                    </div>
                  </div>
                  <span style={{
                    padding: "4px 10px", borderRadius: "999px", background: "#dcfce7",
                    color: a.is_enabled ? "#15803d" : "#64748b", fontWeight: 700, fontSize: "11px"
                  }}>
                    {a.is_enabled ? "Active" : "Paused"}
                  </span>
                  <button
                    type="button"
                    className="alert-remove"
                    onClick={() => void deleteAlert(a.id)}
                    aria-label={`Remove alert for ${a.station}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            ) : (
              <div style={{ padding: "30px", textAlign: "center", background: "#f8fafc", borderRadius: "14px", border: "1px dashed #cbd5e1" }}>
                <ShieldAlert size={32} color="#94a3b8" style={{ margin: "0 auto 10px" }} />
                <div style={{ fontWeight: 700, color: "#334155" }}>Standard WHO Alert Defaults Active</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                  Create a rule to monitor PM2.5, PM10, or NO₂ at any reporting location.
                </div>
              </div>
            )}
            {loading && <p className="alert-feedback">Loading your alert rules…</p>}
          </div>
        </div>
      </div>
      {error && <p className="alert-feedback error" role="alert">{error}</p>}
    </div>
  );
}
