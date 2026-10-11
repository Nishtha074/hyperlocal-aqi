"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Activity, ArrowRight, Download, HeartPulse, Leaf, LocateFixed, MapPinned, Quote, RefreshCw, ShieldCheck, Sparkles, Wind } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Station } from "@/components/EmbeddedMap";
import { getNearestStation, getPreferredStation } from "@/lib/locations";

const LiveMap = dynamic(() => import("@/components/EmbeddedMap"), { ssr: false, loading: () => <div className="map-loading">Preparing the live map…</div> });
const api = (path: string) => fetch(path, { cache: "no-store" });

function aqi(pm25: number) {
  if (pm25 <= 12) return Math.round(pm25 * 50 / 12);
  if (pm25 <= 35.4) return Math.round(50 + (pm25 - 12) * 50 / 23.4);
  if (pm25 <= 55.4) return Math.round(100 + (pm25 - 35.4) * 50 / 20);
  if (pm25 <= 150.4) return Math.round(150 + (pm25 - 55.4) * 50 / 95);
  return Math.min(500, Math.round(200 + (pm25 - 150.4) * 100 / 99.6));
}

function category(value: number) {
  if (value <= 50) return ["Good", "#20c997"] as const;
  if (value <= 100) return ["Moderate", "#f7b731"] as const;
  if (value <= 150) return ["Sensitive", "#ff8c42"] as const;
  if (value <= 200) return ["Unhealthy", "#ff5c77"] as const;
  return ["Very unhealthy", "#9b5de5"] as const;
}

function Welcome({ onEnter }: { onEnter: () => void }) {
  return <section className="welcome-shell">
    <div className="welcome-blob welcome-blob-one" /><div className="welcome-blob welcome-blob-two" /><div className="welcome-grid" />
    <div className="welcome-content"><p className="welcome-kicker"><Sparkles size={15}/> AIRPULSE · YOUR AIR, MADE CLEAR</p><h1>Better days begin with <span>better air.</span></h1><p>AirPulse turns live environmental data into simple decisions—for your commute, your workout, and the people you care about.</p><div className="welcome-actions"><button onClick={onEnter}>Enter live dashboard <ArrowRight size={17}/></button><span><i /> Live regional coverage</span></div></div>
    <div className="welcome-orbital"><div className="orbital-ring ring-one"/><div className="orbital-ring ring-two"/><div className="welcome-aqi"><Wind size={25}/><b>LIVE</b><strong>Air<br/>aware</strong><small>Healthier choices, right now.</small></div></div>
    <div className="welcome-features"><article><MapPinned/><div><b>Explore your air</b><p>Find live measurements on an interactive regional map.</p></div></article><article><Activity/><div><b>Plan with confidence</b><p>See an easy six-hour pollution outlook before you leave.</p></div></article><article><ShieldCheck/><div><b>Protect your people</b><p>Get practical advice tailored to your health needs.</p></div></article></div>
  </section>;
}

export default function Home() {
  const [stations, setStations] = useState<Station[]>([]);
  const [selected, setSelected] = useState<Station | null>(null);
  const [forecast, setForecast] = useState<Record<string, any> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const loadStations = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await api("/api/current");
      if (!response.ok) throw new Error("No station response");
      const next = (await response.json()).filter((station: Station) => Number.isFinite(station.latitude) && Number.isFinite(station.longitude));
      setStations(next);
      setSelected(previous => next.find((station: Station) => station.station === previous?.station) ?? getPreferredStation(next) ?? null);
      setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { loadStations().catch(() => undefined); }, [loadStations]);
  useEffect(() => {
    const timer = window.setInterval(() => loadStations().catch(() => undefined), 300000);
    return () => window.clearInterval(timer);
  }, [loadStations]);
  useEffect(() => {
    if (!selected) return;
    api(`/api/forecast/${encodeURIComponent(selected.station)}`).then(response => response.ok ? response.json() : null).then(setForecast).catch(() => setForecast(null));
  }, [selected?.station]);

  const currentAqi = aqi(selected?.pm25 ?? 0);
  const [label, accent] = category(currentAqi);
  const chartData = useMemo(() => {
    const current = selected?.pm25 ?? 0;
    return [
      { time: "Now", value: current },
      { time: "+1h", value: forecast?.forecast?.["1h"]?.value ?? current },
      { time: "+3h", value: forecast?.forecast?.["3h"]?.value ?? current },
      { time: "+6h", value: forecast?.forecast?.["6h"]?.value ?? current },
    ];
  }, [selected?.pm25, forecast]);

  const nearestStation = () => {
    if (!navigator.geolocation) {
      window.alert("Location services are not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const closest = getNearestStation(stations, coords.latitude, coords.longitude);
        if (closest) setSelected(closest);
        else window.alert("No regional air-quality locations are available yet.");
      },
      () => window.alert("Location permission was not available. Choose a city from the location menu instead."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const downloadReport = () => {
    if (!selected) return;
    const report = ["AirPulse live air-quality report", `Location: ${selected.city || selected.station}`, `Measured PM2.5: ${selected.pm25.toFixed(1)} µg/m³`, `US AQI: ${currentAqi} (${label})`, `Generated: ${new Date().toLocaleString()}`].join("\n");
    const url = URL.createObjectURL(new Blob([report], { type: "text/plain" }));
    const link = document.createElement("a"); link.href = url; link.download = "airpulse-report.txt"; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="page-shell">
    <header className="page-header">
      <div><p className="eyebrow"><Sparkles size={14} /> LIVE ENVIRONMENTAL INTELLIGENCE</p><h1>Your day, <span>in cleaner air.</span></h1><p className="lede">Local air-quality readings, short-term forecasts, and practical guidance—all in one clear view.</p></div>
      <div className="header-actions"><span className="live-chip"><i /> Updated {updatedAt || "—"}</span>{stations.length > 0 && <label className="location-picker"><MapPinned size={15} /><span className="sr-only">Choose a monitoring location</span><select aria-label="Choose a monitoring location" value={selected?.station ?? ""} onChange={event => setSelected(stations.find(station => station.station === event.target.value) ?? null)}>{stations.map(station => <option key={station.station} value={station.station}>{station.city || station.station}{station.source === "Open-Meteo" ? " · regional estimate" : " · CPCB"}</option>)}</select></label>}<button className="icon-button" onClick={() => loadStations().catch(() => undefined)} aria-label="Refresh readings"><RefreshCw size={18} className={refreshing ? "spin" : ""} /></button><button className="button secondary" onClick={downloadReport}><Download size={16} /> Report</button></div>
    </header>

    {!selected ? <section className="empty-state"><Wind size={34} /><h2>Connecting to air-quality stations</h2><p>Start the Python API to load current observations.</p><button className="button" onClick={() => loadStations().catch(() => undefined)}>Try again</button></section> : <>
      <section className="hero-grid">
        <article className="aqi-hero" style={{ "--aqi-color": accent } as React.CSSProperties}><div><p className="eyebrow">YOUR SELECTED LOCATION</p><h2>{selected.city || selected.station}</h2><p className="muted">{selected.source === "CPCB" ? "CPCB monitoring station" : "Open-Meteo live city-level model estimate"}{selected.fetched_at ? ` · ${new Date(selected.fetched_at).toLocaleString()}` : ""}</p></div><div className="aqi-number"><strong>{currentAqi}</strong><span>US AQI</span></div><div className="aqi-summary"><span style={{ color: accent }}>{label}</span><p>{currentAqi <= 100 ? "Most people can continue normal outdoor activity." : "Sensitive groups should reduce prolonged outdoor exertion."}</p></div></article>
        <article className="weather-card"><div className="orb orb-one" /><div className="orb orb-two" /><p className="eyebrow">AIRPULSE PLANNER</p><h2>Make today easier</h2><div className="quick-actions"><button onClick={nearestStation}><LocateFixed size={17} /> Find nearest station</button><button onClick={() => document.getElementById("forecast")?.scrollIntoView({ behavior: "smooth" })}><Activity size={17} /> View forecast</button></div><p className="muted">Use location permission to match you with a nearby monitoring node.</p></article>
      </section>

      <section className="metric-grid">{[["PM2.5", `${selected.pm25?.toFixed(1) ?? "—"}`, "µg/m³", "Fine particles"], ["PM10", `${selected.pm10?.toFixed(1) ?? "—"}`, "µg/m³", "Dust & pollen"], ["NO₂", `${selected.no2?.toFixed(1) ?? "—"}`, "µg/m³", "Traffic emissions"], ["Stations online", String(stations.length), "nodes", "Across the region"]].map(([name, value, unit, subtitle], index) => <article className={`metric-card metric-${index}`} key={name}><span>{name}</span><strong>{value}</strong><em>{unit}</em><p>{subtitle}</p></article>)}</section>

      <section className="dashboard-grid"><article className="panel map-panel"><div className="panel-title"><div><p className="eyebrow">EXPLORE</p><h2>Live regional map</h2></div><span>{stations.length} reporting</span></div><div className="map-frame"><LiveMap stations={stations} selectedStation={selected} onSelectStation={setSelected} /></div></article><article className="panel" id="forecast"><div className="panel-title"><div><p className="eyebrow">PREDICT</p><h2>Six-hour outlook</h2></div><span className="forecast-badge">ML forecast</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6256d9" stopOpacity={0.42}/><stop offset="100%" stopColor="#6256d9" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="time" stroke="#8a8eab" tickLine={false} axisLine={false}/><YAxis stroke="#8a8eab" tickLine={false} axisLine={false}/><Tooltip contentStyle={{ background: "#ffffff", color: "#252750", border: "1px solid #e2e0f5", borderRadius: 12 }}/><Area type="monotone" dataKey="value" stroke="#6256d9" strokeWidth={3} fill="url(#forecastFill)" /></AreaChart></ResponsiveContainer></div><div className="forecast-list">{chartData.map(point => <div key={point.time}><span>{point.time}</span><strong>{Number(point.value).toFixed(1)} <small>µg/m³</small></strong></div>)}</div></article></section>
      <section className="wellness-grid">
        <article className="wellness-card quote-card"><Quote size={26} /><p>“Small choices today—walking on the cleaner side of the street, checking the forecast, carrying a mask—create healthier tomorrows.”</p><span>AirPulse daily insight</span></article>
        <article className="wellness-card"><HeartPulse size={24} /><div><b>{currentAqi <= 100 ? "Great time for a walk" : "Choose an easier pace"}</b><p>{currentAqi <= 100 ? "Your local air reading supports light outdoor activity." : "Keep intense activity indoors until the pollution level improves."}</p></div></article>
        <article className="wellness-card"><Leaf size={24} /><div><b>One clean-air action</b><p>Share this dashboard with your family before planning an outdoor activity.</p></div></article>
      </section>
      <section className="action-grid">
        <article className="day-plan"><div><p className="eyebrow">TODAY&apos;S AIR PLAN</p><h2>Pick a better moment to go outside.</h2><p>Based on the current observation and short-range forecast, check your timing before a run, commute, or family outing.</p></div><div className="time-pills">{chartData.map((point, index) => <div key={point.time} className={index === 0 ? "active" : ""}><span>{point.time}</span><b>{Number(point.value).toFixed(0)}</b><small>PM2.5</small></div>)}</div></article>
        <article className="next-step"><Leaf size={27}/><p className="eyebrow">PERSONALIZED</p><h2>Build your air-safe routine</h2><p>Set your health sensitivity and get guidance made for you.</p><Link href="/profile">Open health advisor <ArrowRight size={15}/></Link></article>
        <article className="next-step alert-step"><HeartPulse size={27}/><p className="eyebrow">STAY AHEAD</p><h2>Never miss a rise</h2><p>Create alerts for the station you care about most.</p><Link href="/alerts">Set an alert <ArrowRight size={15}/></Link></article>
      </section>
    </>}
  </div>;
}
