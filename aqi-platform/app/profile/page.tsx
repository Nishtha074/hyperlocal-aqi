"use client";
import { useState, useEffect } from "react";
import {
  Shield, ShieldCheck, CheckCircle, HeartPulse, Sparkles,
  Stethoscope, Clock, Leaf, Activity, AlertTriangle,
  MapPin, ShieldAlert, Info, Wind, Droplets, Thermometer,
  Timer, Home, Sunrise, UserCheck
} from "lucide-react";
import { fetchLiveOrFallbackStations, FALLBACK_STATIONS, ExtendedStation, calculateAQI, getAQIMeta } from "@/lib/dataService";

const AGE_GROUPS = [
  { id: "child",   label: "Child (0–14 yrs)",       desc: "Developing pulmonary alveoli, higher ventilation per kg mass",    icon: "👶" },
  { id: "adult",   label: "Healthy Adult (15–64)",   desc: "Standard statutory respiratory tolerance threshold",              icon: "🧑" },
  { id: "elderly", label: "Senior Citizen (65+)",    desc: "Elevated cardiovascular stress & micro-thrombus risk",             icon: "🧓" },
];

const SENSITIVITIES = [
  { id: "none",      label: "No Pre-existing Conditions",    desc: "Baseline physiological clearance" },
  { id: "asthma",   label: "Asthma / Bronchitis / COPD",   desc: "Hyper-reactive bronchial spasms on ultrafine exposure" },
  { id: "heart",    label: "Cardiovascular / Hypertension",  desc: "Particulates induce systemic arterial vasoconstriction" },
  { id: "pregnant", label: "Expectant Mother / Pregnancy",  desc: "Sub-micron particles cross maternal-fetal barrier" },
];

const ACTIVITIES = [
  { id: "low",      label: "Sedentary / Indoors",   icon: "🏠", factor: "~6–8 L/min resting ventilation" },
  { id: "moderate", label: "Commuting / Walking",   icon: "🚶", factor: "~15–20 L/min active ventilation" },
  { id: "high",     label: "High-Intensity Sports", icon: "🏃", factor: "~50–90 L/min deep respiratory intake" },
];

export default function ProfilePage() {
  const [stations, setStations] = useState<ExtendedStation[]>(FALLBACK_STATIONS);
  const [station, setStation] = useState<ExtendedStation>(FALLBACK_STATIONS[0]);
  const [ageGroup, setAgeGroup] = useState<string>("adult");
  const [sensitivity, setSensitivity] = useState<string>("none");
  const [activity, setActivity] = useState<string>("moderate");

  useEffect(() => {
    fetchLiveOrFallbackStations().then(({ stations: d }) => {
      setStations(d);
      if (d.length > 0) setStation(d[0]);
    });
  }, []);

  const curAQI = calculateAQI(station.pm25);
  const curMeta = getAQIMeta(curAQI);

  // Compute personalized risk
  let baselineMultiplier = 1.0;
  if (ageGroup === "child" || ageGroup === "elderly") baselineMultiplier *= 1.4;
  if (sensitivity !== "none") baselineMultiplier *= 1.6;
  if (activity === "high")    baselineMultiplier *= 1.5;
  const adjustedScore = station.pm25 * baselineMultiplier;

  let riskLevel = "Optimal / Low Exposure";
  let riskColor = "var(--mint)";
  let maxMins   = 240;
  let maskAdvice = "Standard outdoor activity safe; no respirator needed.";
  let riskIcon  = "✅";

  if (adjustedScore > 120) {
    riskLevel = "Hazardous Pulmonary Burden";
    riskColor = "var(--aqi-hazardous)";
    maxMins = 15;
    maskAdvice = "Strict N95 / FFP2 respirator mandatory outdoors. Keep windows sealed.";
    riskIcon = "🚨";
  } else if (adjustedScore > 75) {
    riskLevel = "High Pulmonary Alert";
    riskColor = "var(--aqi-unhealthy)";
    maxMins = 40;
    maskAdvice = "N95 respirator strongly advised for any prolonged exertion.";
    riskIcon = "⚠️";
  } else if (adjustedScore > 45) {
    riskLevel = "Moderate Sensitivity Caution";
    riskColor = "#f59e0b";
    maxMins = 90;
    maskAdvice = "Sensitive individuals should limit strenuous outdoor workouts.";
    riskIcon = "⚡";
  }

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
              <HeartPulse size={12} /> Personalized Physiological Stratification
            </span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--mint)", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mint)" }}>Clinical Advisory Model</span>
          </div>
          <h1 className="section-title">Personalized Health Risk Assessment</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6, fontWeight: 400, maxWidth: 620 }}>
            Dynamic vulnerability modeling combining physiological profiles, inhalation volumes, and hyperlocal chemical observations.
          </p>
        </div>

        <select
          className="ap-select"
          value={station.station}
          onChange={(e) => {
            const found = stations.find(s => s.station === e.target.value);
            if (found) setStation(found);
          }}
        >
          {stations.map(s => (
            <option key={s.station} value={s.station}>
              📍 {s.city} — {s.station}
            </option>
          ))}
        </select>
      </div>

      {/* ── Context Banner ── */}
      <div
        className="glass-card"
        style={{
          padding: "20px 24px",
          marginBottom: 28,
          border: `1px solid ${curMeta.color}40`,
          boxShadow: `0 0 20px ${curMeta.color}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${curMeta.color}18`,
            border: `1px solid ${curMeta.color}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: curMeta.color,
          }}>
            <Wind size={22} />
          </div>
          <div>
            <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>
              Active Environment: {station.city} ({station.station})
            </strong>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Observed PM2.5: <strong style={{ color: curMeta.color }}>{station.pm25.toFixed(1)} µg/m³</strong> · Current AQI: <strong>{curAQI} ({curMeta.label})</strong>
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            padding: "5px 14px",
            borderRadius: 999,
            background: curMeta.bg,
            border: `1px solid ${curMeta.border}`,
            color: curMeta.color,
            fontSize: 12,
            fontWeight: 800,
          }}>
            ● {curMeta.label}
          </span>
        </div>
      </div>

      {/* ── Main Profiling Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, marginBottom: 28 }}>

        {/* Column 1: Profile Selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Age Group */}
          <div className="glass-card" style={{ padding: "22px 24px" }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", display: "block", marginBottom: 12 }}>
              1. Biological Age Group
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              {AGE_GROUPS.map(ag => {
                const isSelected = ageGroup === ag.id;
                return (
                  <button
                    key={ag.id}
                    onClick={() => setAgeGroup(ag.id)}
                    style={{
                      padding: "12px",
                      borderRadius: 12,
                      background: isSelected ? "var(--bg-glass-md)" : "var(--bg-card)",
                      border: `1px solid ${isSelected ? "var(--mint)" : "var(--border)"}`,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.18s ease",
                      boxShadow: isSelected ? "var(--glow-mint)" : "none",
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{ag.icon}</div>
                    <strong style={{ fontSize: 12.5, color: isSelected ? "var(--mint)" : "var(--text-primary)", display: "block" }}>
                      {ag.label}
                    </strong>
                    <span style={{ fontSize: 10.5, color: "var(--text-muted)", display: "block", marginTop: 4 }}>
                      {ag.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clinical Sensitivity */}
          <div className="glass-card" style={{ padding: "22px 24px" }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", display: "block", marginBottom: 12 }}>
              2. Pre-Existing Health Profile
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SENSITIVITIES.map(s => {
                const isSelected = sensitivity === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSensitivity(s.id)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: isSelected ? "var(--bg-glass-md)" : "var(--bg-card)",
                      border: `1px solid ${isSelected ? "var(--cyan)" : "var(--border)"}`,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13, color: isSelected ? "var(--cyan)" : "var(--text-primary)" }}>
                        {s.label}
                      </strong>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        {s.desc}
                      </p>
                    </div>
                    {isSelected && <CheckCircle size={16} color="var(--cyan)" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity / Exertion */}
          <div className="glass-card" style={{ padding: "22px 24px" }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", display: "block", marginBottom: 12 }}>
              3. Outdoor Physical Exertion
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              {ACTIVITIES.map(act => {
                const isSelected = activity === act.id;
                return (
                  <button
                    key={act.id}
                    onClick={() => setActivity(act.id)}
                    style={{
                      padding: "12px",
                      borderRadius: 12,
                      background: isSelected ? "var(--bg-glass-md)" : "var(--bg-card)",
                      border: `1px solid ${isSelected ? "var(--mint)" : "var(--border)"}`,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.18s ease",
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{act.icon}</div>
                    <strong style={{ fontSize: 12, color: isSelected ? "var(--mint)" : "var(--text-primary)", display: "block" }}>
                      {act.label}
                    </strong>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                      {act.factor}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Column 2: Resulting Health Advisory Output */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="glass-card" style={{ padding: "28px", border: `1px solid ${riskColor}40`, boxShadow: `0 0 30px ${riskColor}15` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text-muted)" }}>
                Personalized Stratification Result
              </span>
              <span style={{ fontSize: 24 }}>{riskIcon}</span>
            </div>

            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 900, color: riskColor, marginBottom: 8 }}>
              {riskLevel}
            </h2>

            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: 24 }}>
              Based on your selected profile, your effective pulmonary particulate exposure multiplier is <strong style={{ color: "var(--text-primary)" }}>{baselineMultiplier.toFixed(1)}×</strong> relative to statutory adult baselines.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
              <div style={{ padding: "14px", borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  SAFE EXPOSURE CAP
                </span>
                <strong style={{ fontSize: 22, color: riskColor }}>
                  ~{maxMins} mins
                </strong>
                <span style={{ fontSize: 10.5, color: "var(--text-secondary)", display: "block", marginTop: 2 }}>
                  before particulate overload
                </span>
              </div>

              <div style={{ padding: "14px", borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  EFFECTIVE PM2.5 DOSE
                </span>
                <strong style={{ fontSize: 22, color: "var(--text-primary)" }}>
                  {adjustedScore.toFixed(1)}
                </strong>
                <span style={{ fontSize: 10.5, color: "var(--text-secondary)", display: "block", marginTop: 2 }}>
                  µg/m³ weighted intake
                </span>
              </div>
            </div>

            <div style={{ padding: "16px", borderRadius: 12, background: "var(--bg-glass-md)", border: "1px solid var(--border)", marginBottom: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--mint)", display: "block", marginBottom: 6 }}>
                Respirator &amp; Mask Recommendation
              </span>
              <p style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
                {maskAdvice}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={14} color="var(--mint)" />
                <span>Keep HEPA air purifiers active in bedroom/workspace.</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={14} color="var(--mint)" />
                <span>Avoid exercise along vehicular arterial roads during rush hour.</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={14} color="var(--mint)" />
                <span>Stay hydrated to maintain mucous clearance of particulates.</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
