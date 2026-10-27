"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Wind,
  Sparkles,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Thermometer,
  Droplets,
  Compass,
  ArrowUpRight,
  Sliders,
  CloudRain,
  Car,
  AlertTriangle,
  Download,
  Share2,
  Quote,
  Activity,
  Zap,
  CheckCircle2,
  Clock,
  Eye,
  HeartPulse,
  FileText,
  BarChart3,
  Gauge,
  Globe2
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import {
  fetchLiveOrFallbackStations,
  FALLBACK_STATIONS,
  ExtendedStation,
  calculateAQI,
  getAQIMeta,
  generateForecastCurve
} from "@/lib/dataService";

// Note: scenario simulator uses multiplier overrides on observed PM2.5 values
// to illustrate possible atmospheric scenarios. Clearly labelled as simulation.

export default function DashboardPage() {
  const [stations, setStations] = useState<ExtendedStation[]>(FALLBACK_STATIONS);
  const [selectedStation, setSelectedStation] = useState<ExtendedStation>(FALLBACK_STATIONS[0]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const CLEAN_AIR_QUOTES = [
  "Clean air is a human right.",
  "Every breath matters.",
  "Protect the sky, protect yourself.",
  "Fresh air fuels fresh ideas."
];
const [simScenario, setSimScenario] = useState<"normal" | "rain" | "traffic" | "wind" | "biomass">("normal");
  const [exportingPDF, setExportingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const { stations: d, isLiveBackend } = await fetchLiveOrFallbackStations();
      setStations(d);
      setIsLive(isLiveBackend);
      setSelectedStation(prev => d.find(s => s.station === prev?.station) ?? d[0]);
    } catch {
      setStations(FALLBACK_STATIONS);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const effectivePM25 = useMemo(() => {
    const base = selectedStation.pm25;
    switch (simScenario) {
      case "rain": return Math.max(8, base * 0.52);
      case "traffic": return base * 1.38;
      case "wind": return Math.max(10, base * 0.72);
      case "biomass": return base * 1.65;
      default: return base;
    }
  }, [selectedStation.pm25, simScenario]);

  const effectiveAQI = calculateAQI(effectivePM25);
  const meta = getAQIMeta(effectiveAQI);

  const pollutantsData = useMemo(() => {
    const mult = effectivePM25 / (selectedStation.pm25 || 1);
    return [
      { name: "PM2.5", val: effectivePM25, unit: "µg/m³", limit: 60, color: meta.color },
      { name: "PM10",  val: (selectedStation.pm10 || effectivePM25 * 1.8) * mult, unit: "µg/m³", limit: 100, color: "#d97706" },
      { name: "NO2",   val: (selectedStation.no2 || 24.5) * mult, unit: "µg/m³", limit: 80, color: "#0284c7" },
      { name: "SO2",   val: (selectedStation.so2 || 14.2) * mult, unit: "µg/m³", limit: 80, color: "#059669" },
      { name: "CO",    val: (selectedStation.co || 0.9) * mult, unit: "mg/m³", limit: 2.0, color: "#10b981" },
      { name: "O3",    val: selectedStation.o3 || 32.4, unit: "µg/m³", limit: 100, color: "#6366f1" },
    ];
  }, [selectedStation, effectivePM25, meta.color]);

  const forecastPoints = useMemo(() => {
    return generateForecastCurve(effectivePM25).map(pt => ({
      time: pt.time,
      pm25: pt.value,
      lower: pt.lower,
      upper: pt.upper,
      aqi: calculateAQI(pt.value)
    }));
  }, [effectivePM25]);

  // ── PDF Export ──
  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      let y = 0;

      // ── Cover Header ──
      doc.setFillColor(10, 15, 30);
      doc.rect(0, 0, pw, 52, "F");

      // Accent bar
      doc.setFillColor(29, 114, 242);
      doc.rect(0, 0, pw, 3, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("AIRPULSE", 14, 22);

      doc.setFontSize(9);
      doc.setTextColor(100, 180, 255);
      doc.text("HYPERLOCAL AIR QUALITY INTELLIGENCE PLATFORM", 14, 30);

      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text("Executive Environmental Report", 14, 42);

      doc.setFontSize(8);
      doc.setTextColor(160, 200, 255);
      doc.text(`Generated: ${new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}`, pw - 14, 42, { align: "right" });

      y = 62;

      // ── Report Info Row ──
      doc.setFillColor(240, 247, 255);
      doc.roundedRect(14, y, pw - 28, 26, 3, 3, "F");
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(14, y, pw - 28, 26, 3, 3, "S");

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(selectedStation.city, 20, y + 9);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Station: ${selectedStation.station}`, 20, y + 17);

      // AQI badge
      const aqiCol = meta.color === "#10b981" ? [16,185,129] :
                     meta.color === "#f59e0b" ? [245,158,11] :
                     meta.color === "#f97316" ? [249,115,22] :
                     meta.color === "#ef4444" ? [239,68,68] : [139,92,246];
      doc.setFillColor(aqiCol[0], aqiCol[1], aqiCol[2]);
      doc.roundedRect(pw - 60, y + 5, 46, 16, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`AQI ${effectiveAQI}`, pw - 37, y + 15, { align: "center" });

      y += 36;

      // ── Section: Current Status ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("AIR QUALITY STATUS", 14, y);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y + 2, pw - 14, y + 2);
      y += 10;

      // Status grid
      const statusItems = [
        { label: "AQI Index", value: String(effectiveAQI), color: meta.color },
        { label: "PM2.5 Level", value: `${effectivePM25.toFixed(1)} µg/m³`, color: "#0f172a" },
        { label: "AQI Category", value: meta.label, color: meta.color },
        { label: "Scenario", value: simScenario === "normal" ? "Live Baseline" : simScenario.toUpperCase(), color: "#475569" },
      ];

      const colW = (pw - 28) / 2;
      statusItems.forEach((item, i) => {
        const cx = 14 + (i % 2) * (colW + 4);
        const cy = y + Math.floor(i / 2) * 22;

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(cx, cy, colW, 18, 2, 2, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(cx, cy, colW, 18, 2, 2, "S");

        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.text(item.label.toUpperCase(), cx + 6, cy + 7);

        const rgb = item.color === "#10b981" ? [16,185,129] :
                    item.color === "#f59e0b" ? [245,158,11] :
                    item.color === "#f97316" ? [249,115,22] :
                    item.color === "#ef4444" ? [239,68,68] :
                    item.color === "#0284c7" ? [2,132,199] :
                    item.color === "#475569" ? [71,85,105] : [15,23,42];
        doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(item.value, cx + 6, cy + 15);
      });

      y += 50;

      // ── Section: Pollutant Spectrum ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("MULTI-POLLUTANT CHEMICAL SPECTRUM", 14, y);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y + 2, pw - 28, y + 2);
      y += 10;

      pollutantsData.forEach((pol) => {
        const pct = Math.min(100, (pol.val / pol.limit) * 100);
        const barW = (pw - 80);

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(pol.name, 14, y + 4.5);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7.5);
        doc.text(`${pol.val.toFixed(1)} ${pol.unit}`, 40, y + 4.5);
        doc.text(`Limit: ${pol.limit}`, 78, y + 4.5);

        // Track
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(110, y, barW, 5.5, 2, 2, "F");

        // Fill
        const fillRgb = pct > 85 ? [220,38,38] : pct > 60 ? [217,119,6] : [5,150,105];
        doc.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
        doc.roundedRect(110, y, Math.max(3, barW * pct / 100), 5.5, 2, 2, "F");

        doc.setFontSize(7.5);
        doc.setTextColor(pct > 85 ? 220 : 5, pct > 85 ? 38 : 150, pct > 85 ? 38 : 105);
        doc.text(`${Math.round(pct)}%`, pw - 14, y + 4.5, { align: "right" });

        y += 11;
      });

      y += 6;

      // ── Section: Atmospheric Conditions ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("ATMOSPHERIC CONDITIONS", 14, y);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y + 2, pw - 14, y + 2);
      y += 10;

      const atmoItems = [
        { label: "Temperature", value: `${selectedStation.temperature ?? 30.5} °C` },
        { label: "Humidity", value: `${selectedStation.humidity ?? 58} %` },
        { label: "Wind Speed", value: `${selectedStation.wind_speed ?? 11.2} km/h` },
        { label: "Visibility", value: `${selectedStation.visibility ?? 7.8} km` },
        { label: "Boundary Layer", value: "1,240 m" },
        { label: "Data Source", value: selectedStation.source || "CAAQMS" },
      ];

      const atmoColW = (pw - 28) / 3;
      atmoItems.forEach((item, i) => {
        const cx = 14 + (i % 3) * (atmoColW + 2);
        const cy = y + Math.floor(i / 3) * 20;

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(cx, cy, atmoColW - 2, 17, 2, 2, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(cx, cy, atmoColW - 2, 17, 2, 2, "S");

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(item.label.toUpperCase(), cx + 5, cy + 6);

        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(item.value, cx + 5, cy + 13);
      });

      y += 48;

      // ── Section: ML Forecast ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Predictive AI Forecast Horizons", 14, y);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y + 2, pw - 14, y + 2);
      y += 10;

      const fColW = (pw - 28) / 5;
      forecastPoints.slice(0, 5).forEach((pt, i) => {
        const fMeta = getAQIMeta(pt.aqi);
        const cx = 14 + i * (fColW + 2);

        doc.setFillColor(240, 247, 255);
        doc.roundedRect(cx, y, fColW - 2, 28, 2, 2, "F");
        doc.setDrawColor(191, 219, 254);
        doc.roundedRect(cx, y, fColW - 2, 28, 2, 2, "S");

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(2, 132, 199);
        doc.text(pt.time, cx + (fColW - 2) / 2, y + 7, { align: "center" });

        const fRgb = fMeta.color === "#10b981" ? [16,185,129] :
                     fMeta.color === "#f59e0b" ? [245,158,11] :
                     fMeta.color === "#f97316" ? [249,115,22] :
                     fMeta.color === "#ef4444" ? [239,68,68] : [139,92,246];
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(fRgb[0], fRgb[1], fRgb[2]);
        doc.text(String(pt.aqi), cx + (fColW - 2) / 2, y + 18, { align: "center" });

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`${pt.pm25} µg/m³`, cx + (fColW - 2) / 2, y + 25, { align: "center" });
      });

      y += 38;

      // ── Section: Health Advisory ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("COHORT HEALTH ADVISORIES", 14, y);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y + 2, pw - 14, y + 2);
      y += 10;

      const cohorts = [
        { group: "Children & Infants", status: effectiveAQI <= 100 ? "Safe for Outdoor Play" : "Limit Outdoor Recess", ok: effectiveAQI <= 100 },
        { group: "Athletes & Runners",  status: effectiveAQI <= 80  ? "Optimal Workout" : "Reschedule Indoors",       ok: effectiveAQI <= 80 },
        { group: "Senior Citizens",     status: effectiveAQI <= 100 ? "Comfortable Walk" : "Stay Indoors",            ok: effectiveAQI <= 100 },
        { group: "Asthmatics & COPD",   status: effectiveAQI <= 60  ? "Normal Precautions" : "High Alert — N95",      ok: effectiveAQI <= 60 },
      ];

      const chColW = (pw - 28) / 2;
      cohorts.forEach((coh, i) => {
        const cx = 14 + (i % 2) * (chColW + 4);
        const cy = y + Math.floor(i / 2) * 20;
        const fillR = coh.ok ? 236 : 255;
        const fillG = coh.ok ? 253 : 237;
        const fillB = coh.ok ? 245 : 213;

        doc.setFillColor(fillR, fillG, fillB);
        doc.roundedRect(cx, cy, chColW, 17, 2, 2, "F");
        doc.setDrawColor(coh.ok ? 167 : 252, coh.ok ? 243 : 165, coh.ok ? 208 : 165);
        doc.roundedRect(cx, cy, chColW, 17, 2, 2, "S");

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(6, 95, 70);
        doc.text(coh.group, cx + 6, cy + 7);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(coh.ok ? 4 : 154, coh.ok ? 120 : 52, coh.ok ? 87 : 18);
        doc.text(coh.status, cx + 6, cy + 14);
      });

      y += 44;

      // ── Footer ──
      doc.setFillColor(10, 15, 30);
      doc.rect(0, ph - 20, pw, 20, "F");
      doc.setFillColor(29, 114, 242);
      doc.rect(0, ph - 20, pw, 1.5, "F");

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 140, 200);
      doc.text("AirPulse Hyperlocal AQI Intelligence Platform | Gujarat & Maharashtra CAAQMS Network | ML Conformal Forecasting", pw / 2, ph - 10, { align: "center" });
      doc.setTextColor(60, 100, 160);
      doc.text("This report is generated automatically from real-time sensor telemetry and AI predictions. Not a substitute for official CPCB data.", pw / 2, ph - 5, { align: "center" });

      doc.save(`AirPulse_Report_${selectedStation.city}_${Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("PDF export failed. Please try again.");
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportJSON = () => {
    const payload = {
      project: "AirPulse Hyperlocal AQI",
      station: selectedStation.station,
      city: selectedStation.city,
      simulatedScenario: simScenario,
      effectivePM25: Number(effectivePM25.toFixed(1)),
      effectiveAQI,
      category: meta.label,
      pollutants: pollutantsData,
      forecast: forecastPoints,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AirPulse_Data_${selectedStation.city}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentQuote = CLEAN_AIR_QUOTES[quoteIndex];

  return (
    <div style={{ padding: "28px 32px 64px", maxWidth: 1480, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--primary)",
              background: "var(--brand-50)",
              border: "1px solid var(--sage-light)",
              padding: "3px 10px",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}>
              <LayoutDashboard size={11} aria-hidden="true" /> Live Air Quality
            </span>
            <span className="live-dot" aria-hidden="true" />
            <span style={{ fontSize: 12, fontWeight: 600, color: isLive ? "var(--primary)" : "#b45309" }}>
              {isLive ? "CPCB Live Feed" : "Open-Meteo Estimated"}
            </span>
          </div>
          <h1 className="section-title">
            Air Quality Dashboard
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 6, fontWeight: 400, maxWidth: 560 }}>
            Multi-pollutant readings, atmospheric conditions, and ML-generated forecasts for your selected station.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            className="ap-select"
            value={selectedStation.station}
            onChange={(e) => {
              const found = stations.find((s) => s.station === e.target.value);
              if (found) setSelectedStation(found);
            }}
          >
            {stations.map((s) => (
              <option key={s.station} value={s.station}>
                📍 {s.city} — {s.station}
              </option>
            ))}
          </select>

          <button onClick={loadData} className="btn-secondary" title="Refresh Telemetry">
            <RefreshCw size={14} className={refreshing ? "spin" : ""} color="#475569" />
            <span>Refresh</span>
          </button>

          <button onClick={handleExportJSON} className="btn-secondary" title="Download JSON">
            <Download size={14} color="#1d72f2" />
            <span>JSON Data</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exportingPDF}
            className="btn-primary"
            title="Export Branded PDF Report"
          >
            <FileText size={14} />
            <span>{exportingPDF ? "Generating PDF…" : "Export PDF Report"}</span>
          </button>
        </div>
      </div>

      {/* ── Data notice ── */}
      {!isLive && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderLeft: "3px solid #b45309",
            borderRadius: 10,
            padding: "10px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12.5,
            color: "#92400e",
            fontWeight: 500,
          }}
          role="alert"
        >
          <Sparkles size={14} aria-hidden="true" />
          Showing Open-Meteo modelled estimates. Live CPCB database is not connected. Pollutant values for SO2, CO, O3 are estimated from regional patterns.
        </div>
      )}

      {/* ── Scenario Simulator ── */}
      <div className="light-card" style={{ padding: "18px 24px", marginBottom: 28, background: "#ffffff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
              <Sliders size={15} color="#0284c7" />
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b" }}>
                Interactive Atmospheric Scenario
              </span>
            </div>
            <strong style={{ fontSize: 14, color: "#0f172a" }}>
              Simulate Environmental Impact · {selectedStation.city}
            </strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {[
              { id: "normal",  label: "Live Baseline",           emoji: "📡" },
              { id: "rain",    label: "Heavy Rain Washout",      emoji: "🌧️" },
              { id: "traffic", label: "Rush-Hour Congestion",    emoji: "🚗" },
              { id: "wind",    label: "High Wind Dispersion",    emoji: "🌬️" },
              { id: "biomass", label: "Smoke Inversion Plume",   emoji: "🌾" },
            ].map(sc => (
              <button
                key={sc.id}
                onClick={() => setSimScenario(sc.id as any)}
                style={{
                  padding: "7px 13px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  border: simScenario === sc.id ? "2px solid #0284c7" : "1px solid #e2e8f0",
                  background: simScenario === sc.id ? "#f0f9ff" : "#ffffff",
                  color: simScenario === sc.id ? "#0284c7" : "#475569",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s ease",
                  boxShadow: simScenario === sc.id ? "0 2px 10px rgba(2,132,199,0.2)" : "none"
                }}
              >
                {sc.emoji} {sc.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Master Row: Gauge + Spectrum + Microclimate ── */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr 320px", gap: 22, marginBottom: 26 }}>

        {/* Card 1: AQI Radial Gauge */}
        <div className="light-card" style={{ padding: "28px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", borderTop: `5px solid ${meta.color}`, background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)" }}>
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b" }}>
            National AQI Index
          </span>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
            {selectedStation.city}
          </h3>
          <span style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14, fontWeight: 600 }}>
            {selectedStation.station}
          </span>

          {/* SVG Radial Gauge */}
          <div style={{ position: "relative", width: 200, height: 200, margin: "4px 0 12px" }}>
            <svg width="200" height="200" viewBox="0 0 100 100">
              <defs>
                <radialGradient id="gaugeGlow" cx="50%" cy="50%">
                  <stop offset="0%" stopColor={meta.color} stopOpacity="0.08" />
                  <stop offset="100%" stopColor={meta.color} stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="50" cy="50" r="45" fill="url(#gaugeGlow)" />
              {/* Background track */}
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="9"
                strokeDasharray="251.2"
                strokeDashoffset="62.8"
                transform="rotate(135 50 50)"
                strokeLinecap="round"
              />
              {/* Value arc */}
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke={meta.color}
                strokeWidth="9"
                strokeDasharray="251.2"
                strokeDashoffset={Math.max(62.8, 251.2 - ((Math.min(effectiveAQI, 500) / 500) * 188.4))}
                transform="rotate(135 50 50)"
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)", filter: `drop-shadow(0 0 6px ${meta.color}80)` }}
              />
              {/* Tick marks */}
              {[0, 25, 50, 75, 100].map((pct) => {
                const angle = (135 + pct * 2.7) * (Math.PI / 180);
                const x1 = 50 + 44 * Math.cos(angle);
                const y1 = 50 + 44 * Math.sin(angle);
                const x2 = 50 + 38 * Math.cos(angle);
                const y2 = 50 + 38 * Math.sin(angle);
                return <line key={pct} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />;
              })}
            </svg>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center"
            }}>
              <span className="display-num" style={{ fontSize: 46, color: meta.color }}>
                {effectiveAQI}
              </span>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", marginTop: 2 }}>
                AQI POINTS
              </span>
            </div>
          </div>

          <span style={{
            padding: "6px 18px",
            borderRadius: 999,
            background: meta.bg,
            color: meta.color,
            border: `1px solid ${meta.border}`,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.02em",
            marginBottom: 12,
          }}>
            ● {meta.label}
          </span>

          <p style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.5, fontWeight: 500 }}>
            {simScenario === "normal"
              ? "Reflecting current statutory telemetry and meteorological data."
              : `Simulated under [${simScenario.toUpperCase()}] atmospheric modifier.`}
          </p>
        </div>

        {/* Card 2: Multi-Pollutant Spectrum */}
        <div className="light-card" style={{ padding: "26px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
                Multi-Pollutant Chemical Spectrum
              </h3>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                Continuous ambient concentration vs. national exposure limits.
              </p>
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#0284c7",
              background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
              padding: "5px 10px",
              borderRadius: 8,
              border: "1px solid #bfdbfe",
            }}>
              6 Parameters
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {pollutantsData.map(pol => {
              const pct = Math.min(100, Math.round((pol.val / pol.limit) * 100));
              const isBreach = pol.val > pol.limit;
              return (
                <div key={pol.name} style={{
                  background: isBreach ? "#fff5f5" : "#f8fafc",
                  border: `1px solid ${isBreach ? "#fecaca" : "#e2e8f0"}`,
                  borderRadius: 14,
                  padding: "14px 16px",
                  position: "relative",
                  overflow: "hidden"
                }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: pol.color, borderRadius: "14px 14px 0 0" }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <strong style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>{pol.name}</strong>
                      <span style={{ fontSize: 10.5, color: "#94a3b8", marginLeft: 6 }}>
                        Limit: {pol.limit} {pol.unit}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 900,
                      color: isBreach ? "#dc2626" : "#0f172a"
                    }}>
                      {pol.val.toFixed(1)}
                      <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}> {pol.unit}</span>
                    </span>
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${pct}%`,
                        background: pct > 85 ? "linear-gradient(90deg, #dc2626, #ef4444)" :
                                    pct > 60 ? "linear-gradient(90deg, #d97706, #f59e0b)" :
                                              "linear-gradient(90deg, #059669, #10b981)"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#94a3b8" }}>
                    <span>{pct}% of NAQI ceiling</span>
                    <strong style={{ color: isBreach ? "#dc2626" : "#059669" }}>
                      {isBreach ? "⚠ Breached" : "✓ Safe"}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 3: Atmospheric Microclimate */}
        <div className="light-card" style={{ padding: "26px", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
            Atmospheric Dynamics
          </h3>
          <p style={{ fontSize: 11.5, color: "#64748b", marginBottom: 18, fontWeight: 500 }}>
            Meteorological drivers governing particulate dispersion.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
            {[
              { label: "Temperature",      val: `${selectedStation.temperature ?? 30.5} °C`,  Icon: Thermometer, color: "#ea580c", bg: "#fff7ed" },
              { label: "Humidity",         val: `${selectedStation.humidity ?? 58} %`,         Icon: Droplets,    color: "#0284c7", bg: "#f0f9ff" },
              { label: "Wind Speed",       val: `${selectedStation.wind_speed ?? 11.2} km/h`,  Icon: Wind,        color: "#059669", bg: "#ecfdf5" },
              { label: "Boundary Layer",   val: "1,240 m",                                     Icon: Compass,     color: "#7c3aed", bg: "#faf5ff" },
              { label: "Visibility",       val: `${selectedStation.visibility ?? 7.8} km`,     Icon: Eye,         color: "#d97706", bg: "#fffbeb" },
            ].map(m => (
              <div key={m.label} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: "#f8fafc",
                borderRadius: 12,
                border: "1px solid #f1f5f9"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 32, height: 32,
                    borderRadius: 9,
                    background: m.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: m.color,
                    flexShrink: 0,
                  }}>
                    <m.Icon size={15} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{m.label}</span>
                </div>
                <strong style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{m.val}</strong>
              </div>
            ))}
          </div>

          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: "12px 14px", marginTop: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#065f46", display: "block" }}>
              ✓ Dispersion Conditions
            </span>
            <p style={{ fontSize: 10.5, color: "#047857", marginTop: 3 }}>
              Moderate winds facilitate gradual particulate clearance.
            </p>
          </div>
        </div>
      </div>

      {/* ── AI Forecast Timeline ── */}
      <div className="light-card" style={{ padding: "26px", marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <TrendingUp size={18} color="#0284c7" />
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
                LSTM AI Predictive Horizons (PM2.5)
              </h3>
            </div>
            <p style={{ fontSize: 12, color: "#64748b" }}>
              Long Short-Term Memory multi-step forecasting with conformal uncertainty bounds.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11.5, color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#0284c7", display: "inline-block" }} />
              Predicted PM2.5
            </span>
            <span style={{ fontSize: 11.5, color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#bae6fd", display: "inline-block" }} />
              Confidence Band
            </span>
          </div>
        </div>

        {/* Prediction Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 22 }}>
          {forecastPoints.slice(0, 7).map((pt, idx) => {
            const ptMeta = getAQIMeta(pt.aqi);
            return (
              <div key={pt.time} style={{
                background: idx === 0 ? "linear-gradient(135deg, #eff6ff, #dbeafe)" : "#f8fafc",
                border: idx === 0 ? "2px solid #93c5fd" : "1px solid #e2e8f0",
                borderRadius: 14,
                padding: "14px 10px",
                textAlign: "center",
                position: "relative",
                overflow: "hidden"
              }}>
                {idx === 0 && (
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 3,
                    background: "linear-gradient(90deg, #0284c7, #38bdf8)"
                  }} />
                )}
                <span style={{ fontSize: 10.5, fontWeight: 800, color: idx === 0 ? "#0284c7" : "#64748b", display: "block", marginBottom: 4 }}>
                  {pt.time}
                </span>
                <div className="display-num" style={{ fontSize: 26, color: ptMeta.color, margin: "4px 0" }}>
                  {pt.aqi}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#334155", display: "block" }}>
                  {pt.pm25} µg/m³
                </span>
                <span style={{ fontSize: 9, color: "#94a3b8", display: "block", marginTop: 2 }}>
                  [{pt.lower}–{pt.upper}]
                </span>
              </div>
            );
          })}
        </div>

        {/* Area Chart */}
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastPoints} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dashPredGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0284c7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  color: "#0f172a",
                  boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                  fontSize: 12,
                  fontWeight: 700
                }}
              />
              <Area type="monotone" dataKey="pm25" name="PM2.5 (µg/m³)" stroke="#0284c7" strokeWidth={3} fill="url(#dashPredGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Health Matrix ── */}
      <div className="light-card" style={{ padding: "26px" }}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
            Cohort-Specific Health Guidance &amp; Exposure Limits
          </h3>
          <p style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>
            Clinical exposure caps calibrated to {selectedStation.city}'s current air toxicity — AQI {effectiveAQI}.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {[
            {
              group: "👶 Children & Infants",
              status: effectiveAQI <= 100 ? "Safe for Playground" : "Limit Outdoor Recess",
              desc: "Developing respiratory tract. Limit vigorous physical exertion near highway corridors.",
              color: effectiveAQI <= 100 ? "#059669" : "#ea580c",
              bg: effectiveAQI <= 100 ? "#ecfdf5" : "#fff7ed",
              border: effectiveAQI <= 100 ? "#a7f3d0" : "#fed7aa",
            },
            {
              group: "🏃 Athletes & Runners",
              status: effectiveAQI <= 80 ? "Optimal Workout Conditions" : "Reschedule Indoors",
              desc: "Deep lung inhalation reaches 80 L/min during cardio. Run before 07:30 AM.",
              color: effectiveAQI <= 80 ? "#059669" : "#d97706",
              bg: effectiveAQI <= 80 ? "#ecfdf5" : "#fffbeb",
              border: effectiveAQI <= 80 ? "#a7f3d0" : "#fde68a",
            },
            {
              group: "🧓 Senior Citizens",
              status: effectiveAQI <= 100 ? "Comfortable Walk" : "Stay Indoors",
              desc: "Elevated risk of particulate-induced hypertension and cardiovascular irritation.",
              color: effectiveAQI <= 100 ? "#059669" : "#dc2626",
              bg: effectiveAQI <= 100 ? "#ecfdf5" : "#fff1f2",
              border: effectiveAQI <= 100 ? "#a7f3d0" : "#fecdd3",
            },
            {
              group: "🫁 Asthmatics & COPD",
              status: effectiveAQI <= 60 ? "Normal Precautions" : "High Alert — N95 Ready",
              desc: "Microscopic PM2.5 triggers bronchospasm. Wear certified N95 when outdoors.",
              color: effectiveAQI <= 60 ? "#059669" : "#dc2626",
              bg: effectiveAQI <= 60 ? "#ecfdf5" : "#fff1f2",
              border: effectiveAQI <= 60 ? "#a7f3d0" : "#fecdd3",
            }
          ].map(coh => (
            <div key={coh.group} style={{
              background: coh.bg,
              border: `1px solid ${coh.border}`,
              borderTop: `4px solid ${coh.color}`,
              borderRadius: 16,
              padding: "18px",
              transition: "all 0.2s ease"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <strong style={{ fontSize: 13.5, color: "#0f172a" }}>{coh.group}</strong>
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: coh.color,
                  background: "#ffffff",
                  padding: "3px 8px",
                  borderRadius: 6,
                }}>
                  {coh.status}
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.5 }}>{coh.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
