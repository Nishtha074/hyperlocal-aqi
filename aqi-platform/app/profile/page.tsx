"use client";
import { useState, useEffect } from "react";
import {
  Shield, ShieldCheck, CheckCircle, HeartPulse, Sparkles,
  Stethoscope, Clock, Leaf, Activity, AlertTriangle,
  MapPin, ShieldAlert, Info, Wind, Droplets, Thermometer,
  Timer, Home, Sunrise
} from "lucide-react";
import { fetchLiveOrFallbackStations, FALLBACK_STATIONS, ExtendedStation, calculateAQI, getAQIMeta } from "@/lib/dataService";

const AGE_GROUPS = [
  { id: "child",   label: "Child (0–14 yrs)",       desc: "Developing lungs, high ventilation rate per kg body mass",    color: "#0284c7", bg: "#f0f9ff", icon: "👶" },
  { id: "adult",   label: "Healthy Adult (15–64)",   desc: "Standard baseline respiratory capacity",                      color: "#059669", bg: "#ecfdf5", icon: "🧑" },
  { id: "elderly", label: "Senior Citizen (65+)",    desc: "Elevated cardiovascular and stroke susceptibility",          color: "#d97706", bg: "#fffbeb", icon: "🧓" },
];

const SENSITIVITIES = [
  { id: "none",      label: "No Known Conditions",          desc: "Standard physiological environmental tolerance" },
  { id: "asthma",   label: "Asthma / Bronchitis / COPD",   desc: "Hyper-reactive airways — requires lower PM2.5 tolerance" },
  { id: "heart",    label: "Heart Condition / Hypertension", desc: "Particulates trigger arterial spasm and blood pressure spikes" },
  { id: "pregnant", label: "Expectant Mother / Pregnancy",  desc: "Fine particulates cross alveolar-capillary and placental barriers" },
];

const ACTIVITIES = [
  { id: "low",      label: "Sedentary / Indoor",   icon: "🏠", factor: "~6 L/min inhalation rate" },
  { id: "moderate", label: "Commuting / Walking",  icon: "🚶", factor: "~15–20 L/min ventilation" },
  { id: "high",     label: "Intense Running / Sport", icon: "🏃", factor: "~50–90 L/min air intake" },
];

export default function ProfilePage() {
  const [stations,   setStations]   = useState<ExtendedStation[]>(FALLBACK_STATIONS);
  const [station,    setStation]    = useState<ExtendedStation>(FALLBACK_STATIONS[0]);
  const [ageGroup,   setAgeGroup]   = useState<string>("adult");
  const [sensitivity, setSensitivity] = useState<string>("none");
  const [activity,   setActivity]   = useState<string>("moderate");

  useEffect(() => {
    fetchLiveOrFallbackStations().then(({ stations: d }) => {
      setStations(d);
      if (d.length > 0) setStation(d[0]);
    });
  }, []);

  const curAQI  = calculateAQI(station.pm25);
  const curMeta = getAQIMeta(curAQI);

  // Compute personalized risk
  let baselineMultiplier = 1.0;
  if (ageGroup === "child" || ageGroup === "elderly") baselineMultiplier *= 1.4;
  if (sensitivity !== "none") baselineMultiplier *= 1.6;
  if (activity === "high")    baselineMultiplier *= 1.5;
  const adjustedScore = station.pm25 * baselineMultiplier;

  let riskLevel = "Safe / Low Exposure";
  let riskColor = "#059669";
  let riskBg    = "#ecfdf5";
  let riskBorder = "#a7f3d0";
  let maxMins   = 240;
  let maskAdvice = "No mask needed for normal activities";
  let riskIcon  = "✅";

  if (adjustedScore > 120) {
    riskLevel = "Severe Risk"; riskColor = "#dc2626"; riskBg = "#fff1f2"; riskBorder = "#fecdd3";
    maxMins = 15; maskAdvice = "Strict N95 / FFP2 respirator — mandatory outdoor protection"; riskIcon = "🚨";
  } else if (adjustedScore > 75) {
    riskLevel = "High Risk"; riskColor = "#ea580c"; riskBg = "#fff7ed"; riskBorder = "#fed7aa";
    maxMins = 45; maskAdvice = "N95 certified mask strongly recommended"; riskIcon = "⚠️";
  } else if (adjustedScore > 45) {
    riskLevel = "Moderate Advisory"; riskColor = "#d97706"; riskBg = "#fffbeb"; riskBorder = "#fde68a";
    maxMins = 90; maskAdvice = "Surgical mask advised for prolonged outdoor exposure"; riskIcon = "⚡";
  }

  return (
    <div style={{ padding: "32px 36px 64px", maxWidth: 1600, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em",
              color: "#e11d48", background: "linear-gradient(135deg, #fff1f2, #ffe4e6)",
              border: "1px solid #fecdd3", padding: "4px 10px", borderRadius: 8,
              display: "flex", alignItems: "center", gap: 6
            }}>
              <HeartPulse size={12} /> Personalized Health Vulnerability
            </span>
            <span className="live-dot" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>Clinical Advisory Model</span>
          </div>
          <h1 className="section-title">Health Risk Assessment</h1>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 6, fontWeight: 500 }}>
            Tailor-made respiratory guidance based on your physiological vulnerability and current hyperlocal air conditions.
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
              {s.city} — {s.station}
            </option>
          ))}
        </select>
      </div>

      {/* ── Current Air Context Banner ── */}
      <div
        className="light-card"
        style={{
          padding: "20px 26px",
          marginBottom: 28,
          background: `linear-gradient(135deg, ${curMeta.bg} 0%, #ffffff 100%)`,
          border: `1px solid ${curMeta.border}`,
          borderLeft: `5px solid ${curMeta.color}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div className="display-num" style={{ fontSize: 52, color: curMeta.color, lineHeight: 1 }}>
            {curAQI}
          </div>
          <div>
            <span style={{
              display: "inline-block", padding: "4px 12px", borderRadius: 8,
              background: curMeta.bg, color: curMeta.color, border: `1px solid ${curMeta.border}`,
              fontSize: 12, fontWeight: 800, marginBottom: 6
            }}>
              ● {curMeta.label}
            </span>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
              {station.city} — PM2.5: {station.pm25.toFixed(1)} µg/m³
            </p>
            <p style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>{station.station}</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "Temp", val: `${station.temperature ?? "30.5"}°C`, icon: Thermometer, color: "#ea580c" },
            { label: "Humid", val: `${station.humidity ?? "58"}%`, icon: Droplets, color: "#0284c7" },
            { label: "Wind", val: `${station.wind_speed ?? "11"}km/h`, icon: Wind, color: "#059669" },
          ].map(m => (
            <div key={m.label} style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12, padding: "10px 14px",
              textAlign: "center", minWidth: 72
            }}>
              <m.icon size={16} color={m.color} style={{ display: "block", margin: "0 auto 4px" }} />
              <div style={{ fontSize: 13, fontWeight: 800, color: m.color }}>{m.val}</div>
              <span style={{ fontSize: 9.5, color: "#94a3b8" }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.85fr", gap: 24 }}>

        {/* Left: Questionnaire */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Age Group */}
          <div className="light-card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0f9ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7", fontSize: 14 }}>1</div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Age Group / Demographics</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {AGE_GROUPS.map(ag => {
                const isSel = ageGroup === ag.id;
                return (
                  <button
                    key={ag.id}
                    onClick={() => setAgeGroup(ag.id)}
                    style={{
                      padding: "16px", borderRadius: 14,
                      border: isSel ? `2px solid ${ag.color}` : "1px solid #e2e8f0",
                      background: isSel ? ag.bg : "#ffffff",
                      textAlign: "left", cursor: "pointer",
                      transition: "all 0.18s ease",
                      boxShadow: isSel ? `0 4px 16px ${ag.color}20` : "none"
                    }}
                  >
                    <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>{ag.icon}</span>
                    <strong style={{ fontSize: 13, color: isSel ? ag.color : "#0f172a", display: "block", marginBottom: 4 }}>{ag.label}</strong>
                    <p style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.4 }}>{ag.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Health Conditions */}
          <div className="light-card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fff1f2", display: "flex", alignItems: "center", justifyContent: "center", color: "#e11d48", fontSize: 14 }}>2</div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Pre-Existing Health Conditions</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {SENSITIVITIES.map(sen => {
                const isSel = sensitivity === sen.id;
                return (
                  <button
                    key={sen.id}
                    onClick={() => setSensitivity(sen.id)}
                    style={{
                      padding: "13px 16px", borderRadius: 12,
                      border: isSel ? "2px solid #e11d48" : "1px solid #e2e8f0",
                      background: isSel ? "#fff1f2" : "#ffffff",
                      textAlign: "left", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13, color: isSel ? "#9f1239" : "#0f172a", display: "block", marginBottom: 2 }}>
                        {sen.label}
                      </strong>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{sen.desc}</span>
                    </div>
                    {isSel && <CheckCircle size={18} color="#e11d48" style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity Level */}
          <div className="light-card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669", fontSize: 14 }}>3</div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Planned Physical Activity</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {ACTIVITIES.map(act => {
                const isSel = activity === act.id;
                return (
                  <button
                    key={act.id}
                    onClick={() => setActivity(act.id)}
                    style={{
                      padding: "16px 12px", borderRadius: 14,
                      border: isSel ? "2px solid #0284c7" : "1px solid #e2e8f0",
                      background: isSel ? "#f0f9ff" : "#ffffff",
                      textAlign: "center", cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: isSel ? "0 4px 16px rgba(2,132,199,0.15)" : "none"
                    }}
                  >
                    <span style={{ fontSize: 30, display: "block", marginBottom: 8 }}>{act.icon}</span>
                    <strong style={{ fontSize: 12, color: isSel ? "#0284c7" : "#0f172a", display: "block", marginBottom: 3 }}>
                      {act.label}
                    </strong>
                    <span style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.3, display: "block" }}>{act.factor}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Risk Assessment Output */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Risk Level Card */}
          <div className="light-card" style={{
            padding: "26px",
            background: `linear-gradient(180deg, ${riskBg} 0%, #ffffff 100%)`,
            border: `1px solid ${riskBorder}`,
            borderTop: `6px solid ${riskColor}`
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <span style={{ fontSize: 28 }}>{riskIcon}</span>
                <span style={{
                  display: "inline-block", marginLeft: 10,
                  padding: "4px 12px", borderRadius: 8,
                  background: `${riskColor}15`, color: riskColor,
                  fontSize: 12.5, fontWeight: 800
                }}>
                  {riskLevel}
                </span>
              </div>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                {station.city} Ambient Context
              </span>
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>
              Clinical Exposure Prescription
            </h3>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 20 }}>
              Calculated from PM2.5 <strong>{station.pm25.toFixed(1)} µg/m³</strong> (AQI {curAQI}) with{" "}
              {ageGroup} + {sensitivity !== "none" ? sensitivity : "no conditions"} + {activity} activity multiplier.
            </p>

            {/* Key Limits */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 18px", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid #f1f5f9", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Timer size={16} color={riskColor} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#334155" }}>Max Safe Outdoor Time</span>
                </div>
                <strong style={{ fontSize: 18, fontWeight: 900, color: riskColor }}>
                  ≤ {maxMins} min
                </strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Shield size={16} color={riskColor} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#334155" }}>Respirator Advice</span>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#0f172a", textAlign: "right", maxWidth: 180 }}>
                  {maskAdvice}
                </span>
              </div>
            </div>

            {/* Checklist */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                {
                  icon: Home, color: "#0284c7",
                  title: "Window Ventilation",
                  text: curAQI > 150 ? "Keep windows shut; operate indoor HEPA air purifier." : "Safe for natural room ventilation today."
                },
                {
                  icon: Stethoscope, color: "#e11d48",
                  title: "Medication Advisory",
                  text: sensitivity !== "none" ? "Keep rescue inhalers accessible before stepping outdoors." : "Standard hydration precautions are sufficient."
                },
                {
                  icon: Sunrise, color: "#d97706",
                  title: "Commute Timing",
                  text: "Avoid high-density intersections during 08–10 AM and 07–09 PM rush hours."
                },
              ].map(item => (
                <div key={item.title} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: `${item.color}12`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: item.color, flexShrink: 0
                  }}>
                    <item.icon size={14} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 12.5, color: "#0f172a" }}>{item.title}: </strong>
                    <span style={{ fontSize: 12, color: "#475569" }}>{item.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Educational Info */}
          <div className="light-card" style={{ padding: "20px", background: "linear-gradient(135deg, #f0f9ff, #ffffff)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Info size={16} color="#0284c7" />
              <strong style={{ fontSize: 13.5, color: "#0f172a" }}>Why Hyperlocal Monitoring Matters</strong>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
              Fine particles under <strong>2.5 micrometers</strong> penetrate deep into lung alveoli and enter the bloodstream. Hyperlocal variations of just <strong>1 km</strong> can represent a <strong>3× difference</strong> in particulate concentration. Your personalized risk depends on your physiology, not just the city-wide average.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
              {[
                { label: "WHO Safe Limit", val: "15 µg/m³", color: "#059669" },
                { label: "NAQI Ceiling",   val: "60 µg/m³", color: "#d97706" },
                { label: "Your Adj. Score", val: `${adjustedScore.toFixed(0)} µg/m³`, color: riskColor },
                { label: "AQI Category",   val: curMeta.label, color: curMeta.color },
              ].map(m => (
                <div key={m.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.06em" }}>
                    {m.label}
                  </span>
                  <div style={{ fontSize: 14.5, fontWeight: 900, color: m.color, marginTop: 2 }}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
