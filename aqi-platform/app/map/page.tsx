"use client";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  MapPin, RefreshCw, LocateFixed, Layers, Search,
  X, Wind, Droplets, Thermometer, Activity, ChevronRight,
  ZoomIn, ZoomOut, Compass, Map as MapIcon
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
    <div style={{ width: "100%", height: "100%", minHeight: "calc(100vh - 180px)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-card)", borderRadius: 20 }}>
      <div className="skeleton" style={{ width: "100%", height: "100%", minHeight: "calc(100vh - 180px)", borderRadius: 20 }} />
    </div>
  ),
});

const TARGET_CITIES = [
  { name: "Pune",      lat: 18.5204, lon: 73.8567 },
  { name: "Mumbai",    lat: 19.0760, lon: 72.8777 },
  { name: "Ahmedabad", lat: 23.0225, lon: 72.5714 },
  { name: "Surat",     lat: 21.1702, lon: 72.8311 },
  { name: "Vadodara",  lat: 22.3072, lon: 73.1812 },
  { name: "Anand",     lat: 22.5645, lon: 72.9289 },
  { name: "Rajkot",    lat: 22.3039, lon: 70.8022 },
  { name: "Nashik",    lat: 19.9975, lon: 73.7898 },
];

/* ── Small floating AQI band ── */
function AQIBand({ aqi }: { aqi: number }) {
  const bands = [
    { label: "Good", color: "#059669", max: 50 },
    { label: "Moderate", color: "#d97706", max: 100 },
    { label: "Poor", color: "#ea580c", max: 200 },
    { label: "Unhealthy", color: "#dc2626", max: 300 },
    { label: "Severe", color: "#9333ea", max: 400 },
    { label: "Hazardous", color: "#b91c1c", max: 500 },
  ];
  return (
    <div>
      <div style={{ display: "flex", height: 5, borderRadius: 5, overflow: "hidden", gap: 2, marginBottom: 4 }}>
        {bands.map(b => (
          <div key={b.max} style={{
            flex: 1, background: b.color,
            opacity: aqi >= (b.max - 99) ? 1 : 0.2,
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {bands.map(b => (
          <span key={b.max} style={{ fontSize: 8.5, color: "var(--text-muted)", fontWeight: 600 }}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

export default function MapPage() {
  const [stations, setStations]     = useState<ExtendedStation[]>(FALLBACK_STATIONS);
  const [selected, setSelected]     = useState<ExtendedStation>(FALLBACK_STATIONS[0]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [locating, setLocating]     = useState(false);
  const [activeCity, setActiveCity] = useState("Pune");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [plumeIntensity, setPlumeIntensity] = useState<number>(24);
  const [panelOpen, setPanelOpen]   = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    if (found) { setSelected(found); setActiveCity(city.name); }
  };

  const locateUser = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const nearest = getNearestStation(stations, pos.coords.latitude, pos.coords.longitude);
        if (nearest) { setSelected(nearest); setActiveCity(nearest.city); }
        setLocating(false);
      },
      () => { setLocating(false); },
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
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 57px)", padding: "16px 20px 16px", gap: 12, boxSizing: "border-box", overflow: "hidden" }}>

      {/* ── Compact Header Row ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13,
            background: "var(--bg-glass-md)",
            border: "1px solid var(--border-bright)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <MapIcon size={18} color="var(--mint)" aria-hidden="true" />
          </div>
          <div>
            <h1 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 20, fontWeight: 800,
              color: "var(--text-primary)",
              letterSpacing: "-0.025em", margin: 0, lineHeight: 1.2,
            }}>
              Air Quality Map
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, fontWeight: 500 }}>
              {stations.length} active monitoring stations · Gujarat &amp; Maharashtra
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={locateUser}
            disabled={locating}
            title="Find nearest station to my location"
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 10,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              cursor: locating ? "wait" : "pointer",
              fontSize: 12, fontWeight: 700,
              color: "var(--text-primary)",
              boxShadow: "var(--sh-card)",
              transition: "all 0.15s ease",
            }}
          >
            <LocateFixed size={14} color="var(--mint)" aria-hidden="true" />
            {locating ? "Locating…" : "My Location"}
          </button>
          <button
            onClick={loadStations}
            disabled={refreshing}
            title="Refresh station data"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 38, height: 38, borderRadius: 10,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              cursor: refreshing ? "wait" : "pointer",
              boxShadow: "var(--sh-card)",
            }}
          >
            <RefreshCw size={14} color="var(--text-muted)" className={refreshing ? "spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── City Quick-Jump Pills ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12, padding: "8px 14px",
        overflowX: "auto", scrollbarWidth: "none",
        boxShadow: "var(--sh-card)",
      }}>
        <Compass size={13} color="var(--mint)" aria-hidden="true" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap", flexShrink: 0 }}>
          Jump to:
        </span>
        {TARGET_CITIES.map(city => {
          const isActive = activeCity === city.name;
          return (
            <button
              key={city.name}
              onClick={() => targetCity(city)}
              style={{
                padding: "5px 13px", borderRadius: 8,
                fontSize: 12, fontWeight: 700,
                border: isActive ? "1px solid var(--mint)" : "1px solid var(--border)",
                background: isActive ? "var(--mint)" : "var(--bg-surface)",
                color: isActive ? "#ffffff" : "var(--text-secondary)",
                cursor: "pointer", whiteSpace: "nowrap",
                transition: "all 0.15s ease",
                boxShadow: isActive ? "var(--glow-mint)" : "none",
                flexShrink: 0,
              }}
            >
              {city.name}
            </button>
          );
        })}
      </div>

      {/* ── Main area: Map + right panel ── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: panelOpen ? "1fr 360px" : "1fr", gap: 14, minHeight: 0, height: "100%" }}>

        {/* MAP WRAPPER */}
        <div style={{
          position: "relative",
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid var(--border)",
          boxShadow: "var(--sh-panel)",
          background: "var(--bg-card)",
          flex: 1,
          height: "100%",
        }}>

          {/* Full-height map canvas */}
          {!loading && (
            <GisMapCanvas
              stations={filteredStations}
              selected={selected}
              onSelectStation={s => setSelected(s as ExtendedStation)}
              showHeatmap={showHeatmap}
              showMarkers={showMarkers}
              plumeIntensity={plumeIntensity}
            />
          )}
          {loading && (
            <div className="skeleton" style={{ width: "100%", height: "100%", minHeight: 500, borderRadius: 18 }} />
          )}

          {/* ── Floating Search Bar ── */}
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 1000, width: 300 }}>
            <div style={{ position: "relative" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                padding: "10px 14px", borderRadius: 12,
                border: "1px solid var(--border)",
                boxShadow: "0 8px 32px rgba(15,23,42,0.12)",
              }}>
                <Search size={15} color="var(--mint)" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search city or station…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  style={{
                    border: "none", outline: "none",
                    background: "transparent",
                    fontSize: 13, fontWeight: 600,
                    color: "var(--text-primary)", width: "100%",
                    fontFamily: "'Inter', sans-serif",
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
                  position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                  background: "rgba(255,255,255,0.97)",
                  backdropFilter: "blur(20px)",
                  borderRadius: 12,
                  boxShadow: "0 16px 48px rgba(15,23,42,0.16)",
                  border: "1px solid var(--border)",
                  maxHeight: 300, overflowY: "auto",
                  zIndex: 2000, padding: 6,
                }}>
                  {filteredStations.length === 0 ? (
                    <div style={{ padding: "16px", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                      No stations found for &ldquo;{search}&rdquo;
                    </div>
                  ) : (
                    filteredStations.slice(0, 12).map(st => {
                      const aqi = calculateAQI(st.pm25);
                      const m = getAQIMeta(aqi);
                      return (
                        <div
                          key={st.station}
                          onClick={() => { setSelected(st); setSearchOpen(false); setSearch(""); setActiveCity(st.city); }}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "9px 12px", borderRadius: 8, cursor: "pointer",
                            background: selected?.station === st.station ? "var(--bg-glass-md)" : "transparent",
                            transition: "background 0.12s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: "50%",
                              background: m.color, display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0,
                            }}>{aqi}</div>
                            <div>
                              <strong style={{ fontSize: 13, color: "var(--text-primary)", display: "block" }}>{st.city}</strong>
                              <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{st.station.length > 30 ? st.station.substring(0, 30) + "…" : st.station}</span>
                            </div>
                          </div>
                          <span style={{
                            padding: "2px 9px", borderRadius: 6,
                            background: m.bg, color: m.color,
                            fontSize: 11, fontWeight: 800, border: `1px solid ${m.border}`,
                          }}>{m.label}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Floating Layer Controls ── */}
          <div style={{
            position: "absolute", bottom: 16, left: 16, zIndex: 900,
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            borderRadius: 12, padding: "10px 14px",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 32px rgba(15,23,42,0.10)",
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <Layers size={12} color="var(--mint)" />
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Layers</span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)}
                style={{ accentColor: "var(--mint)", width: 14, height: 14 }} />
              Pollution Glow
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={showMarkers} onChange={e => setShowMarkers(e.target.checked)}
                style={{ accentColor: "var(--mint)", width: 14, height: 14 }} />
              Station Pins
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                Radius: <strong style={{ color: "var(--mint)" }}>{plumeIntensity}</strong>
              </span>
              <input type="range" min={10} max={50} value={plumeIntensity}
                onChange={e => setPlumeIntensity(Number(e.target.value))}
                style={{ accentColor: "var(--mint)", cursor: "pointer", width: 70 }} />
            </div>
          </div>

          {/* ── AQI Legend ── */}
          <div style={{
            position: "absolute", bottom: 16, right: panelOpen ? 16 : 16, zIndex: 900,
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            borderRadius: 12, padding: "10px 14px",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 32px rgba(15,23,42,0.10)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>AQI Scale</div>
            {[
              { label: "Good", color: "#059669", range: "0–50" },
              { label: "Moderate", color: "#d97706", range: "51–100" },
              { label: "Poor", color: "#ea580c", range: "101–200" },
              { label: "Unhealthy", color: "#dc2626", range: "201–300" },
              { label: "Severe", color: "#9333ea", range: "301+" },
            ].map(x => (
              <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: x.color, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{x.label}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto", paddingLeft: 6 }}>{x.range}</span>
              </div>
            ))}
          </div>

          {/* ── Panel toggle button ── */}
          <button
            onClick={() => setPanelOpen(p => !p)}
            title={panelOpen ? "Hide station panel" : "Show station panel"}
            style={{
              position: "absolute", top: 16, right: 16, zIndex: 900,
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(16px)",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 16px rgba(15,23,42,0.10)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ChevronRight size={16} color="var(--mint)"
              style={{ transform: panelOpen ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s ease" }} />
          </button>
        </div>

        {/* ── RIGHT SIDE PANEL ── */}
        {panelOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", scrollbarWidth: "none" }}>

            {/* Station Card */}
            {selected && selMeta && (
              <div className="glass-card" style={{ padding: "22px", flexShrink: 0 }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: selMeta.bg, border: `1px solid ${selMeta.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <MapPin size={16} color={selMeta.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Selected Station</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif" }}>{selected.city}</div>
                    </div>
                  </div>
                  <span className="aqi-badge" style={{ background: selMeta.bg, color: selMeta.color, border: `1px solid ${selMeta.border}` }}>
                    {selMeta.label}
                  </span>
                </div>

                <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.4 }}>
                  📍 {selected.station.length > 40 ? selected.station.substring(0, 40) + "…" : selected.station}
                </p>

                {/* Big AQI number */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "16px 18px", borderRadius: 14,
                  background: "var(--bg-surface)", border: "1px solid var(--border)",
                  marginBottom: 16,
                }}>
                  <div>
                    <div style={{ fontSize: 48, fontWeight: 900, color: selMeta.color, lineHeight: 1, fontFamily: "'Outfit', sans-serif" }}>
                      {selAQI}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, marginTop: 2 }}>INDIA AQI</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <AQIBand aqi={selAQI} />
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4, marginTop: 8 }}>
                      {selMeta.description}
                    </p>
                  </div>
                </div>

                {/* Metrics grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 16 }}>
                  {[
                    { icon: Activity, label: "PM2.5", val: `${selected.pm25.toFixed(1)} µg/m³`, color: selMeta.color },
                    { icon: Activity, label: "PM10", val: selected.pm10 ? `${selected.pm10.toFixed(1)} µg/m³` : "—", color: "var(--cyan)" },
                    { icon: Droplets, label: "Humidity", val: `${selected.humidity ?? 56} %`, color: "var(--mint)" },
                    { icon: Wind, label: "Wind Speed", val: `${selected.wind_speed ?? 12} km/h`, color: "var(--electric)" },
                    { icon: Thermometer, label: "Temperature", val: `${selected.temperature ?? 31} °C`, color: "#f59e0b" },
                    { icon: MapPin, label: "State", val: selected.state ?? "India", color: "var(--text-secondary)" },
                  ].map(item => {
                    const ItemIcon = item.icon;
                    return (
                      <div key={item.label} style={{
                        padding: "9px 12px", borderRadius: 10,
                        background: "var(--bg-surface)", border: "1px solid var(--border)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                          <ItemIcon size={11} color={item.color} aria-hidden="true" />
                          <span style={{ fontSize: 9.5, color: "var(--text-muted)", fontWeight: 700 }}>{item.label}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif" }}>{item.val}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Health Advisory */}
                <div style={{
                  padding: "12px 14px", borderRadius: 11,
                  background: selMeta.bg, border: `1px solid ${selMeta.border}`,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: selMeta.color, display: "block", marginBottom: 5 }}>
                    Health Advisory
                  </span>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                    {selMeta.activityAdvice}
                  </p>
                </div>
              </div>
            )}

            {/* All Stations List */}
            <div className="glass-card" style={{ padding: "18px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 12 }}>
                All Stations ({stations.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto", scrollbarWidth: "thin" }}>
                {stations.map(st => {
                  const aqi = calculateAQI(st.pm25);
                  const m = getAQIMeta(aqi);
                  const isActive = selected?.station === st.station;
                  return (
                    <div
                      key={st.station}
                      onClick={() => { setSelected(st); setActiveCity(st.city); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px", borderRadius: 9, cursor: "pointer",
                        background: isActive ? "var(--bg-glass-md)" : "transparent",
                        border: isActive ? "1px solid var(--border-bright)" : "1px solid transparent",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: m.color, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9.5, fontWeight: 800, color: "#fff",
                      }}>{aqi}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {st.city}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {st.state ?? "India"}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                        background: m.bg, color: m.color, border: `1px solid ${m.border}`, flexShrink: 0,
                      }}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
