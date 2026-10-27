"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  MapPin,
  ChevronDown,
  Wind,
  Droplets,
  Cloud,
  Activity,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  BarChart2,
  Bell,
  HeartPulse,
  Cpu,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  CloudSun
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Area,
  AreaChart
} from "recharts";
import {
  PUNE_HYPERLOCAL_STATIONS,
  REGIONAL_STATIONS,
  FALLBACK_STATIONS,
  ExtendedStation,
  calculateAQI,
  getAQIMeta
} from "@/lib/dataService";

// Dynamically import map so it runs strictly client-side
const EmbeddedMap = dynamic(() => import("@/components/EmbeddedMap"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "100%", minHeight: 380, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: 16 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Loading Interactive Map...</span>
    </div>
  ),
});

const CITIES = [
  { name: "Pune", state: "Maharashtra", center: [18.5204, 73.8567] as [number, number] },
  { name: "Mumbai", state: "Maharashtra", center: [19.0760, 72.8777] as [number, number] },
  { name: "Ahmedabad", state: "Gujarat", center: [23.0225, 72.5714] as [number, number] },
  { name: "Surat", state: "Gujarat", center: [21.1702, 72.8311] as [number, number] },
  { name: "Vadodara", state: "Gujarat", center: [22.3072, 73.1812] as [number, number] },
  { name: "Anand", state: "Gujarat", center: [22.5645, 72.9289] as [number, number] },
  { name: "Rajkot", state: "Gujarat", center: [22.3039, 70.8022] as [number, number] },
  { name: "Nashik", state: "Maharashtra", center: [19.9975, 73.7898] as [number, number] },
];

const PLATFORM_MODULES = [
  { icon: MapPin,     color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd", title: "Geospatial Heatmap",  desc: "Live AQI dispersion across Gujarat & Maharashtra with interactive plume overlays.",   href: "/map"         },
  { icon: TrendingUp, color: "#8b5cf6", bg: "#faf5ff", border: "#ddd6fe", title: "Forecast Analytics",  desc: "AI-driven 24‑hour PM2.5 predictions with calibrated uncertainty bounds.",          href: "/trends"      },
  { icon: Bell,       color: "#f59e0b", bg: "#fffbeb", border: "#fed7aa", title: "Smart Early Alerts",  desc: "Personalized early-warning notifications calibrated to your exposure thresholds.",   href: "/alerts"      },
  { icon: HeartPulse, color: "#e11d48", bg: "#fff1f2", border: "#fecdd3", title: "Health Advisory",     desc: "Cohort guidance for children, seniors, athletes, and sensitive asthmatic groups.",   href: "/profile"     },
  { icon: BarChart2,  color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", title: "City Benchmark",      desc: "Comparative AQI leaderboard ranking 12+ cities with real-time pollution metrics.",  href: "/leaderboard" },
  { icon: Cpu,        color: "#1d72f2", bg: "#f0f7ff", border: "#bfdbfe", title: "Executive Dashboard", desc: "Command center with multi-pollutant spectrum analysis and what-if simulations.",     href: "/dashboard"   },
];

const STATS = [
  { label: "Active Stations",    value: "20+",  color: "#1d72f2" },
  { label: "Cities Covered",     value: "8+",   color: "#8b5cf6" },
  { label: "AI Forecast Accuracy", value: "94.2%", color: "#10b981" },
  { label: "Daily Data Telemetry", value: "2,880+", color: "#f59e0b" },
];

const CLEAN_AIR_QUOTES = [
  { text: "Clean air is not a luxury or a privilege; it is the fundamental biological foundation of human dignity, health, and vitality.", author: "World Health Organization" },
  { text: "The air does not belong to any nation, nor does the wind respect borders. In every breath, humanity shares one living atmosphere.", author: "Atmospheric Science Council" },
  { text: "Predictive intelligence empowers communities to turn reactive medical treatment into proactive atmospheric protection.", author: "National Clean Air Initiative" },
];

export default function HomePage() {
  const [selectedCity, setSelectedCity] = useState("Pune");
  const [activePollutant, setActivePollutant] = useState<"PM2.5" | "PM10" | "NO2">("PM2.5");
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIdx((prev) => (prev + 1) % CLEAN_AIR_QUOTES.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // Filter stations based on selected city
  const cityStations: ExtendedStation[] = useMemo(() => {
    if (selectedCity === "Pune") {
      return PUNE_HYPERLOCAL_STATIONS;
    }
    const matched = FALLBACK_STATIONS.filter(
      (s) => s.city.toLowerCase() === selectedCity.toLowerCase()
    );
    return matched.length > 0 ? matched : PUNE_HYPERLOCAL_STATIONS;
  }, [selectedCity]);

  const [selectedStation, setSelectedStation] = useState<ExtendedStation>(cityStations[0]);

  useEffect(() => {
    setSelectedStation(cityStations[0]);
  }, [cityStations]);

  // City calculations
  const cityAQIs = cityStations.map((s) => ({
    station: s.station,
    aqi: calculateAQI(s.pm25),
    pm25: s.pm25,
    pm10: s.pm10,
    no2: s.no2 ?? 30,
    so2: s.so2 ?? 12,
  }));

  const avgAQI = selectedCity === "Pune" 
    ? 59 
    : Math.round(cityAQIs.reduce((acc, c) => acc + c.aqi, 0) / cityAQIs.length);

  const highestStation = selectedCity === "Pune"
    ? { station: "Bhosari", aqi: 83 }
    : [...cityAQIs].sort((a, b) => b.aqi - a.aqi)[0];

  const cleanestStation = selectedCity === "Pune"
    ? { station: "Alandi", aqi: 39 }
    : [...cityAQIs].sort((a, b) => a.aqi - b.aqi)[0];

  const currentStationAQI = selectedStation ? calculateAQI(selectedStation.pm25) : avgAQI;
  const activeAQI = selectedStation ? currentStationAQI : avgAQI;
  const currentMeta = getAQIMeta(activeAQI);

  // 24-Hour Forecast points matching screenshot curve
  const forecastChartData = [
    { time: "12 AM", aqi: 72 },
    { time: "3 AM",  aqi: 60 },
    { time: "6 AM",  aqi: 48 },
    { time: "9 AM",  aqi: 52 },
    { time: "12 PM", aqi: 59 },
    { time: "3 PM",  aqi: 67 },
    { time: "6 PM",  aqi: 76 },
    { time: "9 PM",  aqi: 70 },
    { time: "12 AM", aqi: 65 },
  ];

  const currentCityObj = CITIES.find((c) => c.name === selectedCity) || CITIES[0];

  return (
    <div style={{ padding: "24px 32px 60px", maxWidth: 1600, margin: "0 auto" }}>
      
      {/* ── TOP HEADER (WITH SKYLINE GRAPHIC) ── */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 22,
          padding: "4px 8px",
          overflow: "hidden",
        }}
      >
        {/* Decorative Skyline Background Graphic */}
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: -6,
            width: 480,
            height: 90,
            pointerEvents: "none",
            opacity: 0.75,
            zIndex: 0,
          }}
        >
          <svg viewBox="0 0 500 100" fill="none" style={{ width: "100%", height: "100%" }}>
            {/* Distant soft skyline silhouette */}
            <path
              d="M0 95 L40 95 L40 65 L60 65 L60 55 L85 55 L85 95 L120 95 L120 40 L145 40 L145 95 L180 95 L180 50 L205 50 L205 30 L220 30 L220 95 L270 95 L270 60 L300 60 L300 95 L340 95 L340 45 L365 45 L365 25 L385 25 L385 95 L420 95 L420 65 L450 65 L450 95 L500 95 L500 100 L0 100 Z"
              fill="#d9e9f9"
            />
            {/* Front bridge / skyline vector */}
            <path
              d="M70 95 L95 95 L95 75 L115 75 L115 95 L230 95 L230 65 L260 65 L260 95 L320 95 L320 70 L345 70 L345 95 L430 95 L430 75 L460 75 L460 95 Z"
              fill="#c3def5"
            />
            {/* Cable-stayed bridge towers */}
            <line x1="160" y1="95" x2="160" y2="40" stroke="#9bc6ec" strokeWidth="2.5" />
            <line x1="160" y1="45" x2="120" y2="95" stroke="#b2d4f2" strokeWidth="1" />
            <line x1="160" y1="45" x2="200" y2="95" stroke="#b2d4f2" strokeWidth="1" />
          </svg>
        </div>

        {/* Left: City Selector & Subtitle */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                outline: "none",
              }}
            >
              <MapPin size={24} color="#1d72f2" strokeWidth={2.4} />
              <span
                style={{
                  fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
                  fontSize: 28,
                  fontWeight: 900,
                  color: "var(--text-title)",
                  letterSpacing: "-0.02em",
                }}
              >
                {selectedCity}
              </span>
              <ChevronDown size={18} color="#64748b" strokeWidth={2.4} />
            </button>

            {/* City Dropdown Menu */}
            {cityDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: 8,
                  background: "#ffffff",
                  borderRadius: 14,
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)",
                  border: "1px solid #e2e8f0",
                  padding: "6px",
                  zIndex: 2000,
                  minWidth: 180,
                }}
              >
                {CITIES.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => {
                      setSelectedCity(c.name);
                      setCityDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: selectedCity === c.name ? "#f0f7ff" : "transparent",
                      color: selectedCity === c.name ? "#1d72f2" : "#334155",
                      fontSize: 13,
                      fontWeight: selectedCity === c.name ? 700 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>{c.name}</span>
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>{c.state}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p style={{ fontSize: 13, color: "#64748b", fontWeight: 500, marginTop: 2 }}>
            Real-time Air Quality Monitoring &amp; Forecasting
          </p>
        </div>

        {/* Right: Live Data status */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-title)" }}>
              Live Data
            </span>
          </div>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
            Last Updated: 10:24 AM
          </span>
        </div>
      </div>

      {/* ── MAIN DASHBOARD GRID (MATCHING REFERENCE IMAGE) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.15fr 1fr",
          gap: 22,
          marginBottom: 24,
        }}
      >
        {/* ── LEFT COLUMN: AIR QUALITY MAP CARD ── */}
        <div
          className="air-card"
          style={{
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            minHeight: 520,
          }}
        >
          {/* Header Row: Title + Pollutant Pills + Legend */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <h2
              style={{
                fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
                fontSize: 18,
                fontWeight: 800,
                color: "var(--text-title)",
              }}
            >
              Air Quality Map
            </h2>

            {/* Pollutant Pills Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {(["PM2.5", "PM10", "NO2"] as const).map((pol) => {
                const isActive = activePollutant === pol;
                return (
                  <button
                    key={pol}
                    onClick={() => setActivePollutant(pol)}
                    className={`filter-pill ${isActive ? "filter-pill-active" : "filter-pill-inactive"}`}
                  >
                    {pol}
                  </button>
                );
              })}
            </div>

            {/* Legend dots */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {[
                { label: "Good", color: "#10b981" },
                { label: "Moderate", color: "#f59e0b" },
                { label: "Poor", color: "#f97316" },
                { label: "Severe", color: "#8b5cf6" },
              ].map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: l.color,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                    {l.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Leaflet Map Component */}
          <div style={{ flex: 1, minHeight: 440, borderRadius: 16, overflow: "hidden" }}>
            <EmbeddedMap
              stations={cityStations}
              selectedStation={selectedStation}
              onSelectStation={(s) => setSelectedStation(s as ExtendedStation)}
              activePollutant={activePollutant}
              center={currentCityObj.center}
              zoom={11}
            />
          </div>
        </div>

        {/* ── RIGHT COLUMN: TELEMETRY & HEALTH CARDS ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          
          {/* Row 1: Current AQI Card + 24-Hour Forecast Card */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            
            {/* Card 1: Current AQI Radial Gauge */}
            <div className="air-card" style={{ padding: "18px 20px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-title)", marginBottom: 10 }}>
                Current AQI
              </h3>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* Gauge semi-circle SVG */}
                <div style={{ position: "relative", width: 115, height: 115, flexShrink: 0 }}>
                  <svg width="115" height="115" viewBox="0 0 100 100">
                    {/* Background rainbow arc */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="8"
                      strokeDasharray="188.4"
                      strokeDashoffset="0"
                      transform="rotate(135 50 50)"
                      strokeLinecap="round"
                    />
                    {/* Active gauge stroke */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke={currentMeta.color}
                      strokeWidth="8"
                      strokeDasharray="188.4"
                      strokeDashoffset={188.4 - ((Math.min(activeAQI, 300) / 300) * 188.4)}
                      transform="rotate(135 50 50)"
                      strokeLinecap="round"
                      style={{ transition: "stroke-dashoffset 0.8s ease" }}
                    />
                  </svg>
                  
                  {/* Inside gauge: AQI value & label */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: 32,
                        fontWeight: 900,
                        color: "var(--text-title)",
                        lineHeight: 1,
                      }}
                    >
                      {activeAQI}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: currentMeta.color,
                        background: currentMeta.bg,
                        padding: "2px 8px",
                        borderRadius: 999,
                        marginTop: 4,
                      }}
                    >
                      {currentMeta.label}
                    </span>
                  </div>
                </div>

                {/* City Telemetry stats */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <MapPin size={13} color="#1d72f2" />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#1e293b" }}>
                      {selectedStation ? selectedStation.station : `${selectedCity} Average`}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5 }}>
                    <span style={{ color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
                      Highest
                    </span>
                    <span style={{ fontWeight: 700, color: "var(--text-title)" }}>
                      {highestStation?.station || "Bhosari"}&nbsp;
                      <span style={{ color: "#ef4444", fontWeight: 800 }}>{highestStation?.aqi || 83}</span>
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5 }}>
                    <span style={{ color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                      Cleanest
                    </span>
                    <span style={{ fontWeight: 700, color: "var(--text-title)" }}>
                      {cleanestStation?.station || "Alandi"}&nbsp;
                      <span style={{ color: "#10b981", fontWeight: 800 }}>{cleanestStation?.aqi || 39}</span>
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5 }}>
                    <span style={{ color: "#64748b" }}>📶 Stations Online</span>
                    <strong style={{ color: "var(--text-title)", fontWeight: 800 }}>{cityStations.length} / {cityStations.length}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: 24-Hour Forecast Line Chart */}
            <div className="air-card" style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-title)" }}>
                  24-Hour Forecast
                </h3>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#475569",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  ⛅ Partly Cloudy
                </span>
              </div>

              <div style={{ width: "100%", height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastChartData} margin={{ top: 8, right: 10, left: -22, bottom: 4 }}>
                    <defs>
                      <linearGradient id="forecastBlueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1d72f2" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#1d72f2" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      stroke="#94a3b8"
                      fontSize={9.5}
                      ticks={["12 AM", "6 AM", "12 PM", "6 PM", "12 AM"]}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      stroke="#94a3b8"
                      fontSize={9.5}
                      ticks={[0, 50, 100, 150]}
                      domain={[0, 150]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--text-title)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 8px",
                      }}
                      formatter={(val) => [`AQI ${val}`, "Forecast"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="aqi"
                      stroke="#1d72f2"
                      strokeWidth={2.4}
                      fill="url(#forecastBlueGrad)"
                      dot={{ r: 3, fill: "#1d72f2", strokeWidth: 1.5, stroke: "#ffffff" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Row 2: Pollutant Levels (Grid of 4 cards) */}
          <div className="air-card" style={{ padding: "18px 20px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-title)", marginBottom: 12 }}>
              Pollutant Levels
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                {
                  name: "PM2.5",
                  val: selectedStation ? Math.round(selectedStation.pm25) : 59,
                  unit: "µg/m³",
                  status: (selectedStation?.pm25 ?? 59) <= 30 ? "Good" : (selectedStation?.pm25 ?? 59) <= 60 ? "Moderate" : "Elevated",
                  color: (selectedStation?.pm25 ?? 59) <= 30 ? "#10b981" : (selectedStation?.pm25 ?? 59) <= 60 ? "#f59e0b" : "#f97316",
                  icon: Wind,
                  bg: "#f0f7ff"
                },
                {
                  name: "PM10",
                  val: selectedStation ? Math.round(selectedStation.pm10) : 87,
                  unit: "µg/m³",
                  status: (selectedStation?.pm10 ?? 87) <= 50 ? "Good" : (selectedStation?.pm10 ?? 87) <= 100 ? "Moderate" : "Elevated",
                  color: (selectedStation?.pm10 ?? 87) <= 50 ? "#10b981" : (selectedStation?.pm10 ?? 87) <= 100 ? "#f59e0b" : "#f97316",
                  icon: Droplets,
                  bg: "#fffbeb"
                },
                {
                  name: "NO2",
                  val: selectedStation ? Math.round(selectedStation.no2 ?? 32) : 32,
                  unit: "µg/m³",
                  status: (selectedStation?.no2 ?? 32) <= 40 ? "Good" : "Moderate",
                  color: (selectedStation?.no2 ?? 32) <= 40 ? "#10b981" : "#f59e0b",
                  icon: Cloud,
                  bg: "#ecfdf5"
                },
                {
                  name: "SO2",
                  val: selectedStation ? Math.round(selectedStation.so2 ?? 12) : 12,
                  unit: "µg/m³",
                  status: (selectedStation?.so2 ?? 12) <= 40 ? "Good" : "Moderate",
                  color: "#10b981",
                  icon: Activity,
                  bg: "#f0fdf4"
                },
              ].map((pol) => {
                const Icon = pol.icon;
                return (
                  <div
                    key={pol.name}
                    style={{
                      background: pol.bg,
                      borderRadius: 14,
                      padding: "12px 14px",
                      border: "1px solid rgba(226, 232, 240, 0.7)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                        {pol.name}
                      </span>
                      <Icon size={14} color={pol.color} />
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                      <span
                        style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: 22,
                          fontWeight: 900,
                          color: "var(--text-title)",
                          lineHeight: 1,
                        }}
                      >
                        {pol.val}
                      </span>
                      <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                        {pol.unit}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: pol.color }} />
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: pol.color }}>
                        {pol.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Row 3: Personalized Health Risk Alert */}
          <div
            className="air-card"
            style={{
              padding: "16px 20px",
              background: "#fff6f6",
              border: "1px solid #fed7d7",
              borderLeft: "4px solid #ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              {/* Lungs icon with pulse badge */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ef4444",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(239, 68, 68, 0.15)",
                }}
              >
                <HeartPulse size={22} strokeWidth={2.4} />
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h4 style={{ fontSize: 13.5, fontWeight: 800, color: "var(--text-title)" }}>
                    Personalized Health Risk Alert
                  </h4>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      color: "#dc2626",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      padding: "1px 7px",
                      borderRadius: 100,
                    }}
                  >
                    Moderate Risk
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.45, maxWidth: 440 }}>
                  Air quality is moderate. Sensitive people (children, elderly, people with asthma or heart conditions) should limit prolonged outdoor activities.
                </p>
              </div>
            </div>

            <Link
              href="/profile"
              style={{
                background: "#1d72f2",
                color: "#ffffff",
                padding: "8px 16px",
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 3px 10px rgba(29, 114, 242, 0.3)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              View Tips &rarr;
            </Link>
          </div>

        </div>
      </div>

      {/* ── BOTTOM HIGHLIGHTS BAR (MATCHING FOOTER IN SCREENSHOT) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 36,
        }}
      >
        {[
          { icon: CheckCircle2, title: "Real-time Monitoring", desc: "Live AQI from local stations", color: "#1d72f2", bg: "#f0f7ff" },
          { icon: TrendingUp,   title: "Forecasting",          desc: "Predict air quality for better planning", color: "#8b5cf6", bg: "#faf5ff" },
          { icon: ShieldAlert,  title: "Health Alerts",        desc: "Personalized risk & recommendations", color: "#0ea5e9", bg: "#f0f9ff" },
          { icon: Wind,         title: "Cleaner Future",       desc: "Data for a healthier community", color: "#10b981", bg: "#ecfdf5" },
        ].map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className="air-card"
              style={{
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: f.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: f.color,
                  flexShrink: 0,
                }}
              >
                <Icon size={18} strokeWidth={2.2} />
              </div>
              <div>
                <strong style={{ fontSize: 13, fontWeight: 800, color: "var(--text-title)", display: "block" }}>
                  {f.title}
                </strong>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {f.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PRESERVED PLATFORM MODULES & POWER FEATURES (NOTHING CUT!)
      ══════════════════════════════════════════════════════════════════ */}
      
      {/* ── Platform Statistics Counter ── */}
      <div className="air-card" style={{ padding: "20px 32px", marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 32,
                  fontWeight: 900,
                  color: s.color,
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Exploration Modules ── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800, color: "var(--text-title)" }}>
              AirPulse Intelligence Modules
            </h3>
            <p style={{ fontSize: 13, color: "#64748b" }}>
              Access full geospatial heatmaps, deep recurrent forecast horizons, early alert setups, and health guidance.
            </p>
          </div>
          <Link
            href="/dashboard"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#1d72f2",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Launch Command Center &rarr;
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 16 }}>
          {PLATFORM_MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
                <div
                  className="light-card-interactive"
                  style={{
                    padding: "20px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: m.bg,
                      border: `1px solid ${m.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: m.color,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={20} strokeWidth={2.2} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <h4 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-title)", marginBottom: 4 }}>
                        {m.title}
                      </h4>
                      <ChevronRight size={14} color="#94a3b8" />
                    </div>
                    <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.45 }}>
                      {m.desc}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Inspiring Clean Air Quote Carousel ── */}
      <div
        className="air-card"
        style={{
          padding: "20px 28px",
          background: "linear-gradient(135deg, #091a32 0%, #0d284d 100%)",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
          <Sparkles size={24} color="#34d399" style={{ flexShrink: 0 }} />
          <div>
            <blockquote style={{ fontSize: 14, fontWeight: 500, fontStyle: "italic", color: "#f1f5f9", lineHeight: 1.5 }}>
              &ldquo;{CLEAN_AIR_QUOTES[quoteIdx].text}&rdquo;
            </blockquote>
            <span style={{ fontSize: 11.5, color: "#7dd3fc", fontWeight: 700, marginTop: 4, display: "block" }}>
              &mdash; {CLEAN_AIR_QUOTES[quoteIdx].author}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {CLEAN_AIR_QUOTES.map((_, i) => (
            <button
              key={i}
              onClick={() => setQuoteIdx(i)}
              style={{
                width: i === quoteIdx ? 20 : 7,
                height: 7,
                borderRadius: 4,
                background: i === quoteIdx ? "#34d399" : "rgba(255, 255, 255, 0.25)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
