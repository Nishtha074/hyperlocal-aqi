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
  Activity,
  Zap,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  HeartPulse,
  FileText,
  BarChart3,
  Gauge,
  GripVertical,
  Maximize2,
  Minimize2,
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Layers,
  Info,
  Radio,
  PlusCircle,
  SlidersHorizontal,
  X,
  Target
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

/* ── Widget Definition for Movable Layout ── */
interface DashboardWidget {
  id: string;
  title: string;
  span: "span-4" | "span-6" | "span-8" | "span-12";
  visible: boolean;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "aqi_gauge",        title: "National AQI Index",          span: "span-4", visible: true },
  { id: "spectrum",         title: "Multi-Pollutant Spectrum",    span: "span-8", visible: true },
  { id: "scenario_sim",     title: "Atmospheric Scenario Studio", span: "span-12", visible: true },
  { id: "forecast_chart",   title: "Predictive Atmospheric Forecast",   span: "span-8", visible: true },
  { id: "microclimate",     title: "Atmospheric Telemetry",       span: "span-4", visible: true },
  { id: "health_advisory",  title: "Cohort Health Advisories",    span: "span-6", visible: true },
  { id: "city_comparison",  title: "Regional Comparative Radar",  span: "span-6", visible: true },
];

const QUICK_CITIES = [
  "Pune", "Mumbai", "Ahmedabad", "Anand", "Surat", "Vadodara", "Rajkot", "Nashik"
];

export default function DashboardPage() {
  const [stations, setStations] = useState<ExtendedStation[]>(FALLBACK_STATIONS);
  const [selectedStation, setSelectedStation] = useState<ExtendedStation>(FALLBACK_STATIONS[0]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [simScenario, setSimScenario] = useState<"normal" | "rain" | "traffic" | "wind" | "biomass">("normal");
  const [exportingPDF, setExportingPDF] = useState(false);

  /* ── Movable Layout State ── */
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS);
  const [isCustomizeMode, setIsCustomizeMode] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);
  const [fullscreenWidget, setFullscreenWidget] = useState<string | null>(null);

  // Load custom layout from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("airpulse_dashboard_layout_v3");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = parsed.map((item: any) => {
            const def = DEFAULT_WIDGETS.find(w => w.id === item.id);
            return {
              id: item.id,
              title: def?.title || item.title,
              span: item.span || def?.span || "span-6",
              visible: item.visible !== undefined ? item.visible : true,
            };
          });
          DEFAULT_WIDGETS.forEach(def => {
            if (!merged.some(m => m.id === def.id)) {
              merged.push(def);
            }
          });
          setWidgets(merged);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const saveLayout = (updated: DashboardWidget[]) => {
    setWidgets(updated);
    try {
      localStorage.setItem("airpulse_dashboard_layout_v3", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const resetLayout = () => {
    saveLayout(DEFAULT_WIDGETS);
  };

  const moveWidget = (id: string, direction: "up" | "down") => {
    const idx = widgets.findIndex(w => w.id === id);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= widgets.length) return;
    const updated = [...widgets];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    saveLayout(updated);
  };

  const changeWidgetSpan = (id: string, span: DashboardWidget["span"]) => {
    const updated = widgets.map(w => w.id === id ? { ...w, span } : w);
    saveLayout(updated);
  };

  const toggleWidgetVisibility = (id: string) => {
    const updated = widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    saveLayout(updated);
  };

  /* Drag and drop handlers */
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedWidgetId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverWidgetId !== id) {
      setDragOverWidgetId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverWidgetId(null);
    if (!draggedWidgetId || draggedWidgetId === targetId) return;

    const sourceIdx = widgets.findIndex(w => w.id === draggedWidgetId);
    const targetIdx = widgets.findIndex(w => w.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const updated = [...widgets];
    const [moved] = updated.splice(sourceIdx, 1);
    updated.splice(targetIdx, 0, moved);
    saveLayout(updated);
    setDraggedWidgetId(null);
  };

  const handleDragEnd = () => {
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  /* Data Loading */
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

  /* Atmospheric Multipliers */
  const effectivePM25 = useMemo(() => {
    const base = selectedStation.pm25;
    switch (simScenario) {
      case "rain":    return Math.max(8, base * 0.52);
      case "traffic": return base * 1.38;
      case "wind":    return Math.max(10, base * 0.72);
      case "biomass": return base * 1.65;
      default:        return base;
    }
  }, [selectedStation.pm25, simScenario]);

  const effectiveAQI = calculateAQI(effectivePM25);
  const meta = getAQIMeta(effectiveAQI);

  const pollutantsData = useMemo(() => {
    const mult = effectivePM25 / (selectedStation.pm25 || 1);
    return [
      { name: "PM2.5", val: effectivePM25, unit: "µg/m³", limit: 60, color: meta.color },
      { name: "PM10",  val: (selectedStation.pm10 || effectivePM25 * 1.8) * mult, unit: "µg/m³", limit: 100, color: "#f59e0b" },
      { name: "NO2",   val: (selectedStation.no2 || 24.5) * mult, unit: "µg/m³", limit: 80, color: "var(--cyan)" },
      { name: "SO2",   val: (selectedStation.so2 || 14.2) * mult, unit: "µg/m³", limit: 80, color: "#10b981" },
      { name: "CO",    val: (selectedStation.co || 0.9) * mult, unit: "mg/m³", limit: 2.0, color: "#a3e635" },
      { name: "O3",    val: (selectedStation.o3 || 32.4), unit: "µg/m³", limit: 100, color: "var(--mint)" },
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

  /* PDF Export */
  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      let y = 0;

      doc.setFillColor(6, 8, 20);
      doc.rect(0, 0, pw, 52, "F");

      doc.setFillColor(139, 92, 246);
      doc.rect(0, 0, pw, 3, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("AIRPULSE", 14, 22);

      doc.setFontSize(9);
      doc.setTextColor(0, 245, 255);
      doc.text("HYPERLOCAL AIR QUALITY INTELLIGENCE PLATFORM", 14, 30);

      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text("Executive Environmental Audit Report", 14, 42);

      doc.setFontSize(8);
      doc.setTextColor(199, 210, 254);
      doc.text(`Generated: ${new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}`, pw - 14, 42, { align: "right" });

      y = 62;

      // Report Info Row
      doc.setFillColor(14, 18, 42);
      doc.roundedRect(14, y, pw - 28, 26, 3, 3, "F");
      doc.setDrawColor(139, 92, 246);
      doc.roundedRect(14, y, pw - 28, 26, 3, 3, "S");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(selectedStation.city, 20, y + 9);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(199, 210, 254);
      doc.text(`Station: ${selectedStation.station}`, 20, y + 17);

      doc.setFillColor(16, 185, 129);
      doc.roundedRect(pw - 60, y + 5, 46, 16, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`AQI ${effectiveAQI}`, pw - 37, y + 15, { align: "center" });

      doc.save(`AirPulse_Audit_${selectedStation.city}_${Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("PDF generation failed. Please try again.");
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportJSON = () => {
    const payload = {
      project: "AirPulse Hyperlocal AQI Intelligence",
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
    a.download = `AirPulse_Telemetry_${selectedStation.city}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Widget Renderers ── */
  const renderWidgetContent = (id: string, inModal = false) => {
    switch (id) {
      /* WIDGET 1: National AQI Gauge */
      case "aqi_gauge":
        return (
          <div style={{ padding: inModal ? "40px" : "26px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", height: "100%", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text-muted)", marginBottom: 4 }}>
              National AQI Status
            </span>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: inModal ? 32 : 24, fontWeight: 900, color: "var(--text-primary)" }}>
              {selectedStation.city}
            </h3>
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, fontWeight: 600 }}>
              📍 {selectedStation.station}
            </span>

            {/* Radial SVG Gauge */}
            <div style={{ position: "relative", width: inModal ? 260 : 190, height: inModal ? 260 : 190, margin: "2px 0 10px" }}>
              <svg width="100%" height="100%" viewBox="0 0 100 100">
                <defs>
                  <radialGradient id="dashGaugeGlow" cx="50%" cy="50%">
                    <stop offset="0%" stopColor={meta.color} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={meta.color} stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="50" cy="50" r="45" fill="url(#dashGaugeGlow)" />
                {/* Track */}
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset="62.8"
                  transform="rotate(135 50 50)"
                  strokeLinecap="round"
                />
                {/* Fill Arc */}
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke={meta.color}
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={Math.max(62.8, 251.2 - ((Math.min(effectiveAQI, 500) / 500) * 188.4))}
                  transform="rotate(135 50 50)"
                  strokeLinecap="round"
                  style={{
                    transition: "stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)",
                    filter: `drop-shadow(0 0 10px ${meta.color})`
                  }}
                />
              </svg>
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center"
              }}>
                <span className="display-num" style={{ fontSize: inModal ? 64 : 44, color: meta.color }}>
                  {effectiveAQI}
                </span>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.12em", marginTop: 2 }}>
                  AQI POINTS
                </span>
              </div>
            </div>

            <span style={{
              padding: "5px 16px",
              borderRadius: 999,
              background: meta.bg || "var(--bg-glass-md)",
              color: meta.color,
              border: `1px solid ${meta.border || meta.color + "40"}`,
              fontSize: 12.5,
              fontWeight: 800,
              letterSpacing: "0.02em",
              marginBottom: 10,
              boxShadow: `0 0 20px ${meta.color}35`
            }}>
              ● {meta.label}
            </span>

            <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5, maxWidth: inModal ? 480 : 280, margin: "0 auto" }}>
              {simScenario === "normal"
                ? "Reflecting statutory real-time sensor observations and dispersion parameters."
                : `Active scenario: [${simScenario.toUpperCase()}] atmospheric modifier applied.`}
            </p>
          </div>
        );

      /* WIDGET 2: Multi-Pollutant Spectrum */
      case "spectrum":
        return (
          <div style={{ padding: inModal ? "36px" : "24px 26px", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={{ fontSize: inModal ? 22 : 17, fontWeight: 800, color: "var(--text-primary)" }}>
                  Multi-Pollutant Chemical Spectrum
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Continuous ambient mass concentration vs. National Ambient Air Quality Standards (NAAQS).
                </p>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                color: "var(--mint)",
                background: "var(--bg-glass-md)",
                padding: "4px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}>
                6 Key Parameters
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, flex: 1 }}>
              {pollutantsData.map(pol => {
                const pct = Math.min(100, Math.round((pol.val / pol.limit) * 100));
                const isBreach = pol.val > pol.limit;
                return (
                  <div key={pol.name} style={{
                    background: "var(--bg-surface)",
                    border: `1px solid ${isBreach ? "rgba(244,63,94,0.4)" : "var(--border)"}`,
                    borderRadius: 14,
                    padding: "14px 16px",
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}>
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 3,
                      background: pol.color, borderRadius: "14px 14px 0 0",
                      boxShadow: `0 0 10px ${pol.color}80`
                    }} />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div>
                        <strong style={{ fontSize: 15, fontWeight: 900, color: "var(--text-primary)" }}>{pol.name}</strong>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6 }}>
                          Ceiling: {pol.limit} {pol.unit}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: isBreach ? "var(--aqi-unhealthy)" : "var(--text-primary)"
                      }}>
                        {pol.val.toFixed(1)}
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}> {pol.unit}</span>
                      </span>
                    </div>

                    <div className="progress-track" style={{ background: "var(--border)", height: 6 }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${pct}%`,
                          background: pct > 85 ? "linear-gradient(90deg, #f43f5e, #dc2626)" :
                                      pct > 60 ? "linear-gradient(90deg, #f59e0b, #d97706)" :
                                                "linear-gradient(90deg, var(--mint), var(--cyan))",
                          boxShadow: `0 0 8px ${pol.color}60`
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10.5 }}>
                      <span style={{ color: "var(--text-muted)" }}>{pct}% statutory ceiling</span>
                      <strong style={{ color: isBreach ? "var(--aqi-unhealthy)" : "var(--mint)" }}>
                        {isBreach ? "⚠ Limit Exceeded" : "✓ Within Limit"}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      /* WIDGET 3: Atmospheric Scenario Studio */
      case "scenario_sim":
        return (
          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                  <Sliders size={15} style={{ color: "var(--mint)" }} />
                  <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>
                    Atmospheric Scenario Studio
                  </span>
                </div>
                <strong style={{ fontSize: 14.5, color: "var(--text-primary)" }}>
                  Simulate Weather &amp; Urban Pollution Dynamics · {selectedStation.city}
                </strong>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {[
                  { id: "normal",  label: "Live Baseline",           emoji: "📡", desc: "Standard statutory readings" },
                  { id: "rain",    label: "Monsoon Washout",         emoji: "🌧️", desc: "48% PM washout via precipitation" },
                  { id: "traffic", label: "Peak Congestion",         emoji: "🚗", desc: "+38% PM & NO2 surge" },
                  { id: "wind",    label: "Gale Dispersion",         emoji: "🌬️", desc: "28% pollutant dilution" },
                  { id: "biomass", label: "Stubble Inversion Plume", emoji: "🌾", desc: "+65% particulate trapping" },
                ].map(sc => {
                  const isActive = simScenario === sc.id;
                  return (
                    <button
                      key={sc.id}
                      onClick={() => setSimScenario(sc.id as any)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        border: isActive ? "1px solid var(--mint)" : "1px solid var(--border)",
                        background: isActive ? "var(--bg-glass-md)" : "rgba(0,0,0,0.25)",
                        color: isActive ? "var(--mint)" : "var(--text-secondary)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.18s ease",
                        boxShadow: isActive ? "var(--glow-mint)" : "none",
                      }}
                      title={sc.desc}
                    >
                      <span>{sc.emoji}</span>
                      <span>{sc.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic scenario impact callout */}
            {simScenario !== "normal" && (
              <div style={{
                padding: "8px 14px",
                borderRadius: 10,
                background: "var(--bg-glass-md)",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                color: "var(--text-primary)",
              }}>
                <Sparkles size={14} color="var(--mint)" />
                <span>
                  <strong>Atmospheric Surge Active:</strong> {
                    simScenario === "rain" ? "Monsoon rain washout model active · Particulate concentrations reduced by 48%." :
                    simScenario === "traffic" ? "Vehicular congestion spike active · Inversion layer holds local PM2.5 and NO2 +38%." :
                    simScenario === "wind" ? "High convective wind dispersion active · Atmospheric turbulence dilutes pollutants -28%." :
                    "Agricultural biomass plume active · Severe thermal inversion traps fine aerosols (+65% surge)."
                  }
                </span>
              </div>
            )}
          </div>
        );

      /* WIDGET 4: Predictive AI Forecast Curve */
      case "forecast_chart":
        return (
          <div style={{ padding: inModal ? "36px" : "24px 26px", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div>
                <h3 style={{ fontSize: inModal ? 22 : 17, fontWeight: 800, color: "var(--text-primary)" }}>
                  24-Hour Predictive Horizon
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Conformal interval projection with statistical upper and lower uncertainty bounds.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--text-muted)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 3, background: "var(--mint)", borderRadius: 2 }} /> Mean Horizon
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 8, background: "rgba(0,245,255,0.18)", borderRadius: 2 }} /> 90% Conformal Range
                </span>
              </div>
            </div>

            <div style={{ height: inModal ? 440 : 260, width: "100%", flex: 1, minHeight: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--mint)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--mint)" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="confidenceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--cyan)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const val = payload[0]?.value;
                      return (
                        <div style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-bright)",
                          borderRadius: 10,
                          padding: "8px 12px",
                          boxShadow: "0 8px 30px rgba(0,0,0,0.8), var(--glow-mint)",
                          fontSize: 12,
                        }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>{label}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <span style={{ width: 7, height: 7, borderRadius: 2, background: "var(--mint)" }} />
                            <span style={{ color: "var(--text-secondary)" }}>PM2.5:</span>
                            <strong style={{ color: "var(--mint)" }}>{val} µg/m³</strong>
                          </div>
                          <div style={{ fontSize: 10, color: "var(--cyan)", marginTop: 2 }}>
                            AQI: ~{calculateAQI(Number(val))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="upper" stroke="transparent" fill="url(#confidenceFill)" />
                  <Area type="monotone" dataKey="pm25" stroke="var(--mint)" strokeWidth={2.5} fill="url(#forecastFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      /* WIDGET 5: Atmospheric Telemetry */
      case "microclimate":
        return (
          <div style={{ padding: inModal ? "36px" : "24px 26px", height: "100%", display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontSize: inModal ? 22 : 17, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
              Atmospheric Telemetry
            </h3>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 16, fontWeight: 500 }}>
              Real-time meteorological indicators driving particulate dispersion.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, justifyContent: "space-between" }}>
              {[
                { label: "Ambient Temperature", val: `${selectedStation.temperature ?? 30.5} °C`,  Icon: Thermometer, color: "#f97316" },
                { label: "Relative Humidity",   val: `${selectedStation.humidity ?? 58} %`,         Icon: Droplets,    color: "var(--cyan)" },
                { label: "Wind Velocity",       val: `${selectedStation.wind_speed ?? 11.2} km/h`,  Icon: Wind,        color: "var(--mint)" },
                { label: "Boundary Layer (PBL)",val: "1,240 m AGL",                                 Icon: Compass,     color: "#a855f7" },
                { label: "Optical Visibility",  val: `${selectedStation.visibility ?? 7.8} km`,     Icon: Eye,         color: "#f59e0b" },
              ].map(m => (
                <div key={m.label} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--bg-surface)",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: `${m.color}15`,
                      border: `1px solid ${m.color}35`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <m.Icon size={16} color={m.color} />
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>
                      {m.label}
                    </span>
                  </div>
                  <strong style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
                    {m.val}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        );

      /* WIDGET 6: Cohort Health Advisories */
      case "health_advisory":
        return (
          <div style={{ padding: inModal ? "36px" : "24px 26px", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: inModal ? 22 : 17, fontWeight: 800, color: "var(--text-primary)" }}>
                  Cohort Health Advisories
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Medical risk stratification tailored to current atmospheric toxicity.
                </p>
              </div>
              <HeartPulse size={18} style={{ color: "var(--mint)" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: inModal ? "1fr 1fr" : "1fr 1fr", gap: 12, flex: 1 }}>
              {[
                { group: "Infants & Children",    advice: effectiveAQI <= 100 ? "Safe for normal outdoor play" : "Restrict vigorous outdoor recess", ok: effectiveAQI <= 100 },
                { group: "Athletes & Runners",    advice: effectiveAQI <= 80  ? "Ideal for endurance workouts" : "Transition training indoors", ok: effectiveAQI <= 80 },
                { group: "Senior Citizens",       advice: effectiveAQI <= 100 ? "Comfortable walking conditions" : "Stay in filtered air environments", ok: effectiveAQI <= 100 },
                { group: "Asthma & COPD Patients",advice: effectiveAQI <= 60  ? "Standard inhaler readiness" : "N95 respirator required outdoors", ok: effectiveAQI <= 60 },
              ].map(coh => (
                <div key={coh.group} style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: coh.ok ? "rgba(16, 185, 129, 0.08)" : "rgba(244, 63, 94, 0.08)",
                  border: `1px solid ${coh.ok ? "rgba(16, 185, 129, 0.25)" : "rgba(244, 63, 94, 0.25)"}`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
                      {coh.group}
                    </span>
                    <p style={{ fontSize: 11.5, color: coh.ok ? "var(--mint)" : "var(--aqi-unhealthy)", marginTop: 4, lineHeight: 1.4, fontWeight: 600 }}>
                      {coh.advice}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginTop: 8,
                    color: coh.ok ? "var(--mint)" : "var(--aqi-unhealthy)",
                  }}>
                    {coh.ok ? "✓ LOW RISK PROFILE" : "⚠ ELEVATED PRECAUTION"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      /* WIDGET 7: Regional Comparative Radar */
      case "city_comparison":
        return (
          <div style={{ padding: inModal ? "36px" : "24px 26px", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: inModal ? 22 : 17, fontWeight: 800, color: "var(--text-primary)" }}>
                  Regional Comparative Radar
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Real-time telemetry across western regional network hubs.
                </p>
              </div>
              <BarChart3 size={18} style={{ color: "var(--cyan)" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, justifyContent: "space-around" }}>
              {stations.slice(0, 5).map(st => {
                const aqiVal = calculateAQI(st.pm25);
                const stMeta = getAQIMeta(aqiVal);
                const isSelected = st.station === selectedStation.station;
                return (
                  <div
                    key={st.station}
                    onClick={() => setSelectedStation(st)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: isSelected ? "var(--bg-glass-md)" : "rgba(0,0,0,0.25)",
                      border: `1px solid ${isSelected ? "var(--mint)" : "var(--border)"}`,
                      cursor: "pointer",
                      transition: "all 0.18s ease",
                      boxShadow: isSelected ? "var(--glow-mint)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: stMeta.color, boxShadow: `0 0 8px ${stMeta.color}` }} />
                      <div>
                        <strong style={{ fontSize: 13, color: isSelected ? "var(--mint)" : "var(--text-primary)" }}>
                          {st.city}
                        </strong>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6 }}>
                          {st.station}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {st.pm25.toFixed(1)} µg/m³
                      </span>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: stMeta.bg,
                        color: stMeta.color,
                        border: `1px solid ${stMeta.border}`,
                        fontSize: 11,
                        fontWeight: 800,
                      }}>
                        {aqiVal} AQI
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ padding: "28px 32px 72px", maxWidth: 1520, margin: "0 auto" }}>

      {/* ── Top Control & Station Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 10.5,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--mint)",
              background: "var(--bg-glass-md)",
              border: "1px solid var(--border-bright)",
              padding: "4px 10px",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}>
              <LayoutDashboard size={11} aria-hidden="true" /> Modular Environmental Console
            </span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--mint)", display: "inline-block" }} aria-hidden="true" />
            <span style={{ fontSize: 12, fontWeight: 700, color: isLive ? "var(--mint)" : "#f59e0b" }}>
              {isLive ? "CPCB Statutory Telemetry" : "High-Resolution Mesh Telemetry"}
            </span>
          </div>
          <h1 className="section-title">
            Air Quality Intelligence Dashboard
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6, fontWeight: 400, maxWidth: 620 }}>
            Customizable modular environmental terminal with draggable layouts, multi-pollutant telemetry, and deep learning forecasts.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Station Selector */}
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

          {/* Movable Layout Toggle */}
          <button
            onClick={() => setIsCustomizeMode(!isCustomizeMode)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 16px",
              borderRadius: 10,
              border: isCustomizeMode ? "1px solid var(--mint)" : "1px solid var(--border-bright)",
              background: isCustomizeMode ? "var(--bg-glass-md)" : "var(--bg-card)",
              color: isCustomizeMode ? "#fff" : "var(--mint)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              boxShadow: isCustomizeMode ? "var(--glow-mint)" : "none",
              transition: "all 0.2s ease",
            }}
            title="Drag, resize, and reorganize your dashboard widgets"
          >
            <SlidersHorizontal size={14} />
            <span>{isCustomizeMode ? "Done Organizing" : "✨ Customize Layout"}</span>
          </button>

          <button onClick={loadData} className="btn-secondary" title="Refresh Live Telemetry">
            <RefreshCw size={14} className={refreshing ? "spin" : ""} />
            <span>Refresh</span>
          </button>

          <button onClick={handleExportJSON} className="btn-secondary" title="Download Telemetry JSON">
            <Download size={14} />
            <span>JSON</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exportingPDF}
            className="btn-primary"
            title="Generate Audit PDF Report"
          >
            <FileText size={14} />
            <span>{exportingPDF ? "Exporting…" : "Export PDF Report"}</span>
          </button>
        </div>
      </div>

      {/* ── Regional Quick City Navigation Pills ── */}
      <div className="glass-card" style={{ padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <Target size={14} color="var(--mint)" />
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--text-primary)", whiteSpace: "nowrap" }}>Quick Hub:</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "nowrap" }}>
          {QUICK_CITIES.map(city => {
            const found = stations.find(s => s.city.toLowerCase() === city.toLowerCase());
            const isSelected = selectedStation.city.toLowerCase() === city.toLowerCase();
            return (
              <button
                key={city}
                onClick={() => {
                  if (found) setSelectedStation(found);
                }}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: isSelected ? "1px solid var(--mint)" : "1px solid var(--border)",
                  background: isSelected ? "var(--bg-glass-md)" : "rgba(0,0,0,0.25)",
                  color: isSelected ? "var(--mint)" : "var(--text-secondary)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected ? "var(--glow-mint)" : "none"
                }}
              >
                📍 {city}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Movable Layout Customization Banner ── */}
      {isCustomizeMode && (
        <div
          style={{
            background: "var(--bg-glass-md)",
            border: "1px dashed var(--mint)",
            borderRadius: 14,
            padding: "14px 20px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            animation: "fadeUpIn 0.25s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <GripVertical size={18} style={{ color: "var(--mint)" }} />
            <div>
              <strong style={{ fontSize: 13.5, color: "var(--text-primary)" }}>
                Layout Organizer Active
              </strong>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                Drag widgets to reorder them, use width toggles (1x, 2x, Full) to resize cards, or hide unwanted widgets.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {widgets.some(w => !w.visible) && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Hidden:</span>
                {widgets.filter(w => !w.visible).map(w => (
                  <button
                    key={w.id}
                    onClick={() => toggleWidgetVisibility(w.id)}
                    className="btn-ghost"
                    style={{ fontSize: 11, padding: "3px 8px", background: "var(--bg-glass-md)", borderRadius: 6 }}
                  >
                    <PlusCircle size={11} color="var(--mint)" /> {w.title}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={resetLayout}
              className="btn-ghost"
              style={{ fontSize: 12, padding: "6px 12px", border: "1px solid var(--border)" }}
            >
              <RotateCcw size={12} /> Reset to Default
            </button>
            <button
              onClick={() => setIsCustomizeMode(false)}
              className="btn-primary"
              style={{ padding: "6px 14px", fontSize: 12 }}
            >
              Save &amp; Finish
            </button>
          </div>
        </div>
      )}

      {/* ── Movable Grid ── */}
      <div className={`movable-grid ${isCustomizeMode ? "customize-mode-active" : ""}`}>
        {widgets.filter(w => w.visible).map((widget, index) => {
          const isDragging = draggedWidgetId === widget.id;
          const isDragTarget = dragOverWidgetId === widget.id;

          return (
            <div
              key={widget.id}
              className={`movable-item ${widget.span} glass-card ${isDragging ? "is-dragging" : ""} ${isDragTarget ? "drag-target" : ""}`}
              draggable={isCustomizeMode}
              onDragStart={(e) => handleDragStart(e, widget.id)}
              onDragOver={(e) => handleDragOver(e, widget.id)}
              onDrop={(e) => handleDrop(e, widget.id)}
              onDragEnd={handleDragEnd}
            >
              {/* Card Header Toolbar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 14px",
                  background: "var(--bg-card)",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 11,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isCustomizeMode ? (
                    <span className="widget-handle" title="Drag to reorder">
                      <GripVertical size={13} /> Drag
                    </span>
                  ) : (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--mint)" }} />
                  )}
                  <strong style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                    {widget.title}
                  </strong>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isCustomizeMode ? (
                    <>
                      <button
                        onClick={() => moveWidget(widget.id, "up")}
                        disabled={index === 0}
                        className="btn-ghost"
                        style={{ padding: "2px 6px" }}
                        title="Move Up"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        onClick={() => moveWidget(widget.id, "down")}
                        disabled={index === widgets.filter(w => w.visible).length - 1}
                        className="btn-ghost"
                        style={{ padding: "2px 6px" }}
                        title="Move Down"
                      >
                        <ChevronDown size={13} />
                      </button>

                      {/* Width toggles */}
                      <button
                        onClick={() => changeWidgetSpan(widget.id, "span-4")}
                        style={{
                          padding: "2px 6px",
                          fontSize: 10,
                          borderRadius: 4,
                          border: widget.span === "span-4" ? "1px solid var(--mint)" : "1px solid var(--border)",
                          background: widget.span === "span-4" ? "var(--bg-glass-md)" : "transparent",
                          color: widget.span === "span-4" ? "var(--mint)" : "var(--text-muted)",
                          cursor: "pointer",
                        }}
                        title="Compact Width (1/3rd)"
                      >
                        1x
                      </button>
                      <button
                        onClick={() => changeWidgetSpan(widget.id, "span-8")}
                        style={{
                          padding: "2px 6px",
                          fontSize: 10,
                          borderRadius: 4,
                          border: widget.span === "span-8" ? "1px solid var(--mint)" : "1px solid var(--border)",
                          background: widget.span === "span-8" ? "var(--bg-glass-md)" : "transparent",
                          color: widget.span === "span-8" ? "var(--mint)" : "var(--text-muted)",
                          cursor: "pointer",
                        }}
                        title="Wide Width (2/3rds)"
                      >
                        2x
                      </button>
                      <button
                        onClick={() => changeWidgetSpan(widget.id, "span-12")}
                        style={{
                          padding: "2px 6px",
                          fontSize: 10,
                          borderRadius: 4,
                          border: widget.span === "span-12" ? "1px solid var(--mint)" : "1px solid var(--border)",
                          background: widget.span === "span-12" ? "var(--bg-glass-md)" : "transparent",
                          color: widget.span === "span-12" ? "var(--mint)" : "var(--text-muted)",
                          cursor: "pointer",
                        }}
                        title="Full Width (100%)"
                      >
                        Full
                      </button>

                      {/* Hide Button */}
                      <button
                        onClick={() => toggleWidgetVisibility(widget.id)}
                        className="btn-ghost"
                        style={{ padding: "2px 6px" }}
                        title="Hide Widget"
                      >
                        <EyeOff size={13} />
                      </button>
                    </>
                  ) : (
                    /* In normal mode: Fullscreen expand button */
                    <button
                      onClick={() => setFullscreenWidget(widget.id)}
                      className="btn-ghost"
                      style={{ padding: "3px 6px", opacity: 0.7 }}
                      title="Inspect Widget in Fullscreen"
                    >
                      <Maximize2 size={12} color="var(--text-muted)" />
                    </button>
                  )}
                </div>
              </div>

              {/* Render Actual Widget Content */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {renderWidgetContent(widget.id)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Fullscreen Modal Overlay ── */}
      {fullscreenWidget && (
        <div className="widget-fullscreen-modal" onClick={() => setFullscreenWidget(null)}>
          <div
            className="widget-fullscreen-inner"
            onClick={e => e.stopPropagation()}
            style={{ position: "relative" }}
          >
            <button
              onClick={() => setFullscreenWidget(null)}
              className="btn-ghost"
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                padding: "8px",
                borderRadius: "50%",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid var(--border)",
                cursor: "pointer",
                zIndex: 10,
              }}
              title="Close Fullscreen View"
            >
              <X size={18} color="var(--text-primary)" />
            </button>

            {renderWidgetContent(fullscreenWidget, true)}
          </div>
        </div>
      )}
    </div>
  );
}
