"use client";
import { useCallback, useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  MapPin, RefreshCw, LocateFixed, Layers, Compass, Sliders,
  ShieldCheck, TrendingUp, Search, Target, ArrowRight,
  CheckCircle2, Wind, Maximize2, X, Droplets, Thermometer,
  Activity, Sparkles
} from "lucide-react";
import { getNearestStation } from "@/lib/locations";
import {
  fetchLiveOrFallbackStations,
  FALLBACK_STATIONS,
  ExtendedStation,
  calculateAQI,
  getAQIMeta
} from "@/lib/dataService";

const GisMapCanvas = dynamic(() => import("@/components/GisMapCanvas"), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", height: "100%", minHeight: 700, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-card)", borderRadius: 16 }}>
      <div className="skeleton" style={{ width: "100%", height: "100%", minHeight: 700, borderRadius: 16 }} />
    </div>
  ),
});

const TARGET_CITIES = [
  { name: "Pune",      lat: 18.5204, lon: 73.8567, zoom: 12 },
  { name: "Mumbai",    lat: 19.0760, lon: 72.8777, zoom: 11 },
  { name: "Ahmedabad", lat: 23.0225, lon: 72.5714, zoom: 11 },
  { name: "Surat",     lat: 21.1702, lon: 72.8311, zoom: 11 },
  { name: "Vadodara",  lat: 22.3072, lon: 73.1812, zoom: 11 },
  { name: "Anand",     lat: 22.5645, lon: 72.9289, zoom: 12 },
  { name: "Rajkot",    lat: 22.3039, lon: 70.8022, zoom: 11 },
  { name: "Nashik",    lat: 19.9975, lon: 73.7898, zoom: 11 },
];

export default function MapPage() {
  const [stations, setStations]     = useState<ExtendedStation[]>(FALLBACK_STATIONS);
  const [selected, setSelected]     = useState<ExtendedStation>(FALLBACK_STATIONS[0]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [locating, setLocating]     = useState(false);

  const [showHeatmap, setShowHeatmap]     = useState(true);
  const [showMarkers, setShowMarkers]     = useState(true);
  const [plumeIntensity, setPlumeIntensity] = useState<number>(24);
  const [activeCity, setActiveCity]       = useState("Pune");

  const loadStations = useCallback(async () => {
    setRefreshing(true);
    try {
      const { stations: d } = await fetchLiveOrFallbackStations();
      setStations(d);
      setSelected(prev => d.find(s => s.station === prev?.station) ?? d[0]);
    } catch {
      setStations(FALLBACK_STATIONS);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStations(); }, [loadStations]);

  const targetCity = (city: typeof TARGET_CITIES[0]) => {
    const found = stations.find(s => s.city.toLowerCase().includes(city.name.toLowerCase()));
    if (found) {
      setSelected(found);
      setActiveCity(city.name);
    }
  };

  const locateUser = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const nearest = getNearestStation(stations, pos.coords.latitude, pos.coords.longitude);
        if (nearest) {
          setSelected(nearest);
          setActiveCity(nearest.city);
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
        alert("Unable to retrieve location. Defaulting to Pune station.");
      },
      { timeout: 8000 }
    );
  };

  const filteredStations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(s =>
      s.city?.toLowerCase().includes(q) ||
      s.station?.toLowerCase().includes(q) ||
      s.state?.toLowerCase().includes(q)
    );
  }, [stations, search]);

  const selAQI  = selected ? calculateAQI(selected.pm25) : 0;
  const selMeta = getAQIMeta(selAQI);

  return (
    <div style={{ padding: "28px 32px 72px", maxWidth: 1650, margin: "0 auto" }}>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em",
              color: "var(--mint)", background: "var(--bg-glass-md)",
              border: "1px solid var(--border-bright)", padding: "4px 10px", borderRadius: 6,
              display: "flex", alignItems: "center", gap: 6
            }}>
              <Compass size={11} aria-hidden="true" /> Geospatial Sensor GIS
            </span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--mint)", display: "inline-block" }} aria-hidden="true" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mint)" }}>Sensor Mesh Active</span>
          </div>
          <h1 className="section-title">
            Regional Air Quality GIS Map
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6, fontWeight: 400 }}>
            Geospatial sensor distribution across Gujarat &amp; Maharashtra with dynamic pollution heat plumes and real-time station telemetry.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={locateUser} disabled={locating} className="btn-secondary">
            <LocateFixed size={15} color="var(--mint)" aria-hidden="true" />
            <span>{locating ? "Triangulating…" : "Nearest Station"}</span>
          </button>
          <button onClick={loadStations} className="btn-secondary" style={{ padding: "9px 12px" }} aria-label="Refresh station data">
            <RefreshCw size={15} className={refreshing ? "spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── City Quick-Jump Bar ── */}
      <div className="glass-card" style={{ padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <Target size={14} color="var(--mint)" />
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--text-primary)", whiteSpace: "nowrap" }}>Focus Hub:</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "nowrap" }}>
          {TARGET_CITIES.map(city => {
            const isActive = activeCity === city.name;
            return (
              <button
                key={city.name}
                onClick={() => targetCity(city)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: isActive ? "1px solid var(--mint)" : "1px solid var(--border)",
                  background: isActive ? "var(--mint)" : "var(--bg-surface)",
                  color: isActive ? "#ffffff" : "var(--text-secondary)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                  boxShadow: isActive ? "var(--glow-mint)" : "none"
                }}
              >
                📍 {city.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Layer Controls ── */}
      <div className="glass-card" style={{ padding: "12px 20px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
            <Layers size={14} color="var(--mint)" /> Map Overlays:
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer" }}>
            <input
              type="checkbox" checked={showHeatmap}
              onChange={e => setShowHeatmap(e.target.checked)}
              style={{ accentColor: "var(--mint)", width: 14, height: 14, cursor: "pointer" }}
            />
            Ambient Plume Glow
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer" }}>
            <input
              type="checkbox" checked={showMarkers}
              onChange={e => setShowMarkers(e.target.checked)}
              style={{ accentColor: "var(--mint)", width: 14, height: 14, cursor: "pointer" }}
            />
            Station Telemetry Badges
          </label>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
            <Sliders size={13} color="var(--mint)" />
            Plume Radius: <strong style={{ color: "var(--mint)" }}>{plumeIntensity}px</strong>
          </span>
          <input
            type="range" min={10} max={50} value={plumeIntensity}
            onChange={e => setPlumeIntensity(Number(e.target.value))}
            style={{ accentColor: "var(--mint)", cursor: "pointer", width: 90 }}
          />
        </div>
      </div>

      {/* ── Map + Right Inspector ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 22, minHeight: 700 }}>

        {/* MAP CONTAINER */}
        <div className="glass-card" style={{ minHeight: 700, position: "relative", padding: 0, overflow: "hidden" }}>
          <GisMapCanvas
            stations={filteredStations}
            selected={selected}
            onSelectStation={setSelected}
            showHeatmap={showHeatmap}
            showMarkers={showMarkers}
            plumeIntensity={plumeIntensity}
          />

          {/* Floating Search Bar */}
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 1000, width: 320 }}>
            <div style={{ position: "relative" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--bg-card)",
                backdropFilter: "blur(16px)",
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                boxShadow: "var(--sh-panel)",
              }}>
                <Search size={15} color="var(--mint)" />
                <input
                  type="text"
                  placeholder="Search station or city…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  style={{
                    border: "none", outline: "none",
                    background: "transparent",
                    fontSize: 13, fontWeight: 600,
                    color: "var(--text-primary)", width: "100%",
                  }}
                />
                {search && (
                  <button
                    onClick={() => { setSearch(""); setSearchOpen(false); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, display: "flex" }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Search Dropdown */}
              {searchOpen && search.trim() && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0, right: 0,
                  background: "var(--bg-card)",
                  borderRadius: 12,
                  boxShadow: "var(--sh-float)",
                  border: "1px solid var(--border)",
                  maxHeight: 280,
                  overflowY: "auto",
                  zIndex: 2000,
                  padding: 4,
                }}>
                  {filteredStations.length === 0 ? (
                    <div style={{ padding: "14px", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                      No stations match "{search}"
                    </div>
                  ) : (
                    filteredStations.slice(0, 10).map((st) => {
                      const aqi = calculateAQI(st.pm25);
                      const m = getAQIMeta(aqi);
                      return (
                        <div
                          key={st.station}
                          onClick={() => {
                            setSelected(st);
                            setSearchOpen(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 10px",
                            borderRadius: 8,
                            cursor: "pointer",
                            background: selected?.station === st.station ? "var(--bg-glass-md)" : "transparent",
                            transition: "background 0.15s ease",
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>{st.city}</strong>
                            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{st.station}</div>
                          </div>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: m.bg,
                            color: m.color,
                            fontSize: 11,
                            fontWeight: 800,
                          }}>
                            {aqi} AQI
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE INSPECTOR PANEL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {selected && selMeta && (
            <div className="glass-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>
                  Focused Station Telemetry
                </span>
                <span className="aqi-badge" style={{ background: selMeta.bg, color: selMeta.color, border: `1px solid ${selMeta.border}` }}>
                  {selMeta.label}
                </span>
              </div>

              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>
                {selected.city}
              </h2>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 18 }}>
                📍 {selected.station}
              </span>

              <div style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                padding: "16px 20px",
                borderRadius: 14,
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                marginBottom: 20,
              }}>
                <div>
                  <span className="display-num" style={{ fontSize: 44, color: selMeta.color, lineHeight: 1 }}>
                    {selAQI}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginLeft: 6 }}>
                    AQI POINTS
                  </span>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>PM2.5 Mass</div>
                  <strong style={{ fontSize: 18, color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif" }}>
                    {selected.pm25.toFixed(1)} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>µg/m³</span>
                  </strong>
                </div>
              </div>

              {/* Chemical Breakdown */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[
                  { label: "PM10 Coarse", val: `${(selected.pm10 || selected.pm25 * 1.8).toFixed(1)} µg/m³` },
                  { label: "Ambient Temp", val: `${selected.temperature ?? 31.2} °C` },
                  { label: "Relative Humidity", val: `${selected.humidity ?? 56} %` },
                  { label: "Wind Velocity", val: `${selected.wind_speed ?? 12.4} km/h` },
                ].map(item => (
                  <div key={item.label} style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                  }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, display: "block" }}>
                      {item.label}
                    </span>
                    <strong style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2, display: "block" }}>
                      {item.val}
                    </strong>
                  </div>
                ))}
              </div>

              {/* Mask & Health Advice */}
              <div style={{
                padding: "14px 16px",
                borderRadius: 12,
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--mint)", display: "block", marginBottom: 4 }}>
                  Exposure Advisory
                </span>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {selMeta.activityAdvice}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
