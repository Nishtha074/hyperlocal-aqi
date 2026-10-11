"use client";
import { useState, useEffect } from "react";
import {
  User, Shield, Activity, Wind, AlertTriangle,
  CheckCircle, HeartPulse, Sparkles, Stethoscope, ChevronRight
} from "lucide-react";
import { getPreferredStation } from "@/lib/locations";

const AGE_GROUPS = [
  { id: "child", label: "Child (0-14 yrs)", desc: "Developing lungs, higher breathing rate" },
  { id: "adult", label: "Healthy Adult (15-64 yrs)", desc: "Normal baseline respiratory capacity" },
  { id: "elderly", label: "Senior Citizen (65+ yrs)", desc: "Elevated cardiovascular sensitivity" },
];

const SENSITIVITIES = [
  { id: "none", label: "No Pre-existing Conditions" },
  { id: "asthma", label: "Asthma / Bronchitis / COPD" },
  { id: "heart", label: "Heart Condition / Hypertension" },
  { id: "pregnant", label: "Expectant Mother / Pregnancy" },
];

const ACTIVITIES = [
  { id: "low", label: "Sedentary / Indoor", factor: "Minimal inhaled volume" },
  { id: "moderate", label: "Brisk Walking / Commute", factor: "Moderate air intake" },
  { id: "high", label: "Running / Outdoor Workout", factor: "5x elevated air inhalation" },
];

interface Profile {
  age_group: string;
  sensitivity: string;
  activity: string;
  station: string;
}

interface RiskResult {
  risk_level: string;
  advice: string;
  threshold_used: number;
  current_pm25: number;
}

const riskColor: Record<string, { bg: string; border: string; text: string }> = {
  Low: { bg: "#dcfce7", border: "#86efac", text: "#15803d" },
  Moderate: { bg: "#fef3c7", border: "#fde68a", text: "#b45309" },
  High: { bg: "#ffedd5", border: "#fed7aa", text: "#c2410c" },
  Severe: { bg: "#fee2e2", border: "#fca5a5", text: "#b91c1c" },
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>({
    age_group: "adult",
    sensitivity: "none",
    activity: "moderate",
    station: "",
  });
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [stations, setStations] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("aqi-profile");
    if (saved) setProfile(JSON.parse(saved));
    fetch("/api/current")
      .then((r) => r.json())
      .then((d) => {
        setStations(d);
        if (d.length > 0 && !profile.station) {
          setProfile((p) => ({ ...p, station: getPreferredStation(d)?.station ?? "" }));
        }
      })
      .catch(() => {});
  }, []);

  const assess = async () => {
    setLoading(true);
    localStorage.setItem("aqi-profile", JSON.stringify(profile));
    try {
      const res = await fetch("/api/risk-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        setRisk(await res.json());
      } else {
        // Fallback local calculation
        const base = profile.age_group === "elderly" ? 40 : profile.age_group === "child" ? 35 : 60;
        const currentPM = 35.0;
        const level = currentPM > base ? "High" : currentPM > base * 0.6 ? "Moderate" : "Low";
        setRisk({
          risk_level: level,
          advice: level === "Low" ? "Air quality is favorable. Outdoor exercise recommended." : "Limit extended cardio outdoors. Consider indoor training.",
          threshold_used: base,
          current_pm25: currentPM
        });
      }
    } catch {
      // Local fallback
    }
    setLoading(false);
  };

  const currentTheme = risk ? riskColor[risk.risk_level] || riskColor.Low : riskColor.Low;

  return (
    <div className="route-page profile-page" style={{ padding: "32px 40px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div className="route-header" style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <Stethoscope size={20} color="#7c3aed" />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Precision Health Engine
          </span>
        </div>
        <h1 style={{ fontSize: "32px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
          Personalized Air Quality Risk Advisor
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14.5px", marginTop: "4px" }}>
          Custom vulnerability thresholds calibrated for age, respiratory conditions, and physical exertion
        </p>
      </div>

      <div className="profile-layout" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "26px" }}>
        {/* Form Card */}
        <div className="glass-card card-3d" style={{ padding: "30px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={18} color="#2563eb" /> Configure Your Health Parameters
          </h2>

          {/* Age Group */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "8px" }}>
              Age Demographic
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {AGE_GROUPS.map((a) => (
                <div
                  key={a.id}
                  onClick={() => setProfile((p) => ({ ...p, age_group: a.id }))}
                  className={`profile-choice${profile.age_group === a.id ? " selected" : ""}`}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>{a.label}</div>
                    <div style={{ fontSize: "11.5px", color: "#64748b" }}>{a.desc}</div>
                  </div>
                  {profile.age_group === a.id && <CheckCircle size={18} color="#2563eb" />}
                </div>
              ))}
            </div>
          </div>

          {/* Sensitivity */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "8px" }}>
              Respiratory / Cardiac Status
            </label>
            <select
              value={profile.sensitivity}
              onChange={(e) => setProfile((p) => ({ ...p, sensitivity: e.target.value }))}
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "12px", border: "1.5px solid #dbeafe",
                background: "#ffffff", fontWeight: 600, color: "#0f172a", fontSize: "13.5px"
              }}
            >
              {SENSITIVITIES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Activity */}
          <div style={{ marginBottom: "26px" }}>
            <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "8px" }}>
              Planned Outdoor Activity
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {ACTIVITIES.map((act) => (
                <div
                  key={act.id}
                  onClick={() => setProfile((p) => ({ ...p, activity: act.id }))}
                  className={`activity-choice${profile.activity === act.id ? " selected" : ""}`}
                  style={{ padding: "12px", cursor: "pointer", textAlign: "center" }}
                >
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>{act.label}</div>
                  <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "4px" }}>{act.factor}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={assess}
            className="btn-pill"
            style={{
              width: "100%", justifyContent: "center",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#ffffff", border: "none", fontSize: "14.5px", padding: "12px"
            }}
          >
            {loading ? "Calculating Biological Exposure..." : "Generate Personalized Risk Assessment"}
          </button>
        </div>

        {/* Assessment Output Card */}
        <div className="glass-card card-3d" style={{ padding: "30px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginBottom: "16px" }}>
              Biometric Exposure Report
            </h2>

            {risk ? (
              <div style={{
                borderRadius: "16px", padding: "22px",
                background: currentTheme.bg, border: `2px solid ${currentTheme.border}`
              }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: currentTheme.text, textTransform: "uppercase" }}>
                  Current Exposure Status
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: currentTheme.text, marginTop: "4px" }}>
                  {risk.risk_level} Health Risk
                </div>
                <p style={{ fontSize: "13.5px", color: "#334155", marginTop: "10px", lineHeight: 1.5, fontWeight: 500 }}>
                  {risk.advice}
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "18px", paddingTop: "14px", borderTop: `1px solid ${currentTheme.border}` }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Personalized Threshold</div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>{risk.threshold_used} µg/m³</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Current Ambient PM2.5</div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>{risk.current_pm25?.toFixed(1)} µg/m³</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: "30px", textAlign: "center", background: "#f8fafc", borderRadius: "16px", border: "1px dashed #cbd5e1" }}>
                <HeartPulse size={36} color="#94a3b8" style={{ margin: "0 auto 12px" }} />
                <div style={{ fontWeight: 700, color: "#334155", fontSize: "15px" }}>No Assessment Generated Yet</div>
                <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "4px" }}>
                  Select your health demographic on the left and click assess.
                </div>
              </div>
            )}
          </div>

          {/* Activity Safety Guide Matrix */}
          <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid #f1f5f9" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a", marginBottom: "10px" }}>
              Activity Safety Matrix:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "10px", textAlign: "center", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#0f172a" }}>🏃 Outdoor Run</div>
                <div style={{ fontSize: "11px", color: risk?.risk_level === "High" ? "#dc2626" : "#059669", fontWeight: 700, marginTop: "2px" }}>
                  {risk?.risk_level === "High" ? "Avoid" : "Safe"}
                </div>
              </div>
              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "10px", textAlign: "center", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#0f172a" }}>🚶 Walking</div>
                <div style={{ fontSize: "11px", color: "#059669", fontWeight: 700, marginTop: "2px" }}>
                  Recommended
                </div>
              </div>
              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "10px", textAlign: "center", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#0f172a" }}>🪟 Windows Open</div>
                <div style={{ fontSize: "11px", color: risk?.risk_level === "High" ? "#ea580c" : "#059669", fontWeight: 700, marginTop: "2px" }}>
                  {risk?.risk_level === "High" ? "Keep Closed" : "Safe to ventilate"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
