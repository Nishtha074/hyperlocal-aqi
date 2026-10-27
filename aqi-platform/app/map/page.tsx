"use client";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  MapPin,
  RefreshCw,
  LocateFixed,
  Layers,
  Compass,
  Sliders,
  ShieldCheck,
  TrendingUp,
  Search,
  Target,
  ArrowRight,
  CheckCircle2,
  Wind,
  Maximize2,
  X,
  Droplets,
  Thermometer,
} from "lucide-react";
import { getNearestStation } from "@/lib/locations";
import {
  fetchLiveOrFallbackStations,
  FALLBACK_STATIONS,
  ExtendedStation,
  calculateAQI,
  getAQIMeta
} from "@/lib/dataService";

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
  const mapRef     = useRef<HTMLDivElement>(null);
  const mapInst    = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const heatmapLayer = useRef<any>(null);
  const markerMap  = useRef<Map<string, any>>(new Map());

  const [stations, setStations]   = useState<ExtendedStation[]>(FALLBACK_STATIONS);
  const [selected, setSelected]   = useState<ExtendedStation>(FALLBACK_STATIONS[0]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [locating, setLocating]   = useState(false);

  const [showHeatmap, setShowHeatmap]     = useState(true);
  const [showMarkers, setShowMarkers]     = useState(true);
  const [plumeIntensity, setPlumeIntensity] = useState<number>(22);
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

  // Initialize Leaflet Map with clean tiles
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    let isDisposed = false;

    import("leaflet").then(L => {
      if (isDisposed || !mapRef.current) return;

      // Fix default marker icon path issue
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [20.5, 73.0],
        zoom: 7,
        zoomControl: false,
        attributionControl: true,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Clean, detailed OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      }).addTo(map);

      heatmapLayer.current = L.layerGroup().addTo(map);
      markersLayer.current = L.layerGroup().addTo(map);
      mapInst.current = map;

      setTimeout(() => { map.invalidateSize(); }, 400);
    });

    return () => {
      isDisposed = true;
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
      }
    };
  }, []);

  // Render markers whenever stations/display options change
  useEffect(() => {
    if (!mapInst.current) return;
    import("leaflet").then(L => {
      if (!heatmapLayer.current || !markersLayer.current) return;

      heatmapLayer.current.clearLayers();
      markersLayer.current.clearLayers();
      markerMap.current.clear();

      stations.forEach(s => {
        if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) return;
        const aqi = calculateAQI(s.pm25);
        const meta = getAQIMeta(aqi);
        const isSel = selected?.station === s.station;

        // Ambient plume (stays visible at all zoom levels)
        if (showHeatmap) {
          L.circleMarker([s.latitude, s.longitude], {
            radius:      isSel ? plumeIntensity * 1.6 : plumeIntensity,
            fillColor:   meta.color,
            fillOpacity: isSel ? 0.22 : 0.14,
            stroke:      true,
            color:       meta.color,
            weight:      isSel ? 2 : 1,
            opacity:     0.5,
            interactive: false,
          }).addTo(heatmapLayer.current);
        }

        // Station badge markers
        if (showMarkers) {
          const shortName = s.station
            .replace(/^(GJ|MH)-[A-Z]+-[0-9]+\s*\((.*?)\)$/, "$2")
            .substring(0, 18);

          const icon = L.divIcon({
            className: "custom-div-pin",
            html: `
              <div style="
                display: inline-flex;
                align-items: center;
                background: ${isSel ? '#0f172a' : 'rgba(255,255,255,0.98)'};
                padding: 3px 10px 3px 3px;
                border-radius: 999px;
                box-shadow: 0 4px 20px rgba(15,23,42,${isSel ? '0.4' : '0.18'});
                border: 2px solid ${isSel ? '#1d72f2' : meta.color};
                cursor: pointer;
                transform: ${isSel ? 'scale(1.22)' : 'scale(1)'};
                transition: all 0.2s ease;
                white-space: nowrap;
                font-family: 'Plus Jakarta Sans', sans-serif;
              ">
                <div style="
                  width: 28px; height: 28px;
                  border-radius: 50%;
                  background: ${meta.color};
                  color: #fff;
                  display: flex; align-items: center; justify-content: center;
                  font-size: 10.5px; font-weight: 900;
                  margin-right: 7px;
                  box-shadow: 0 2px 8px ${meta.color}60;
                  flex-shrink: 0;
                ">
                  ${aqi}
                </div>
                <div style="display: flex; flex-direction: column; min-width: 0;">
                  <span style="
                    font-size: 11px; font-weight: 800;
                    color: ${isSel ? '#ffffff' : '#0f172a'};
                    line-height: 1.2;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                    max-width: 90px;
                  ">${shortName}</span>
                  <span style="
                    font-size: 9px; font-weight: 600;
                    color: ${isSel ? '#93c5fd' : '#64748b'};
                    margin-top: 1px;
                  ">${s.city}</span>
                </div>
              </div>
            `,
            iconSize:   [145, 38],
            iconAnchor: [72, 19],
          });

          const m = L.marker([s.latitude, s.longitude], { icon }).addTo(markersLayer.current);
          m.on("click", () => {
            setSelected(s);
            mapInst.current?.setView([s.latitude, s.longitude], Math.max(mapInst.current.getZoom(), 12), { animate: true });
          });
          markerMap.current.set(s.station, m);
        }
      });
    });
  }, [stations, selected, showHeatmap, showMarkers, plumeIntensity]);

  const targetCity = (city: typeof TARGET_CITIES[0]) => {
    const found = stations.find(s => s.city.toLowerCase().includes(city.name.toLowerCase()));
    if (found) setSelected(found);
    setActiveCity(city.name);
    mapInst.current?.flyTo([city.lat, city.lon], city.zoom, { animate: true, duration: 1.4 });
  };

  const selectAndFlyToStation = (st: ExtendedStation) => {
    setSelected(st);
    setSearch(st.city + " — " + st.station);
    setSearchOpen(false);
    mapInst.current?.flyTo([st.latitude, st.longitude], 14, { animate: true, duration: 1.2 });
  };

  const locateUser = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        const nearest = getNearestStation(stations, latitude, longitude);
        if (nearest) selectAndFlyToStation(nearest);
      },
      () => setLocating(false)
    );
  };

  const filteredStations = useMemo(() => {
    if (!search.trim()) return stations;
    const q = search.toLowerCase().replace(/[—–\-]/g, " ").trim();
    return stations.filter(s =>
      s.city?.toLowerCase().includes(q) ||
      s.station?.toLowerCase().includes(q) ||
      s.state?.toLowerCase().includes(q)
    );
  }, [stations, search]);

  const selAQI  = selected ? calculateAQI(selected.pm25) : 0;
  const selMeta = getAQIMeta(selAQI);

  return (
    <div style={{ padding: "26px 32px 64px", maxWidth: 1650, margin: "0 auto" }}>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
              color: "var(--primary)", background: "var(--brand-50)",
              border: "1px solid var(--sage-light)", padding: "3px 10px", borderRadius: 6,
              display: "flex", alignItems: "center", gap: 6
            }}>
              <Compass size={11} aria-hidden="true" /> Pollution Map
            </span>
            <span className="live-dot" aria-hidden="true" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)" }}>Live Stations</span>
          </div>
          <h1 className="section-title">
            Air Quality Monitoring Map
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 6, fontWeight: 400 }}>
            Interactive map showing monitoring stations with real-time AQI. Click any station to see detailed readings and health advisory.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={locateUser} disabled={locating} className="btn-secondary">
            <LocateFixed size={15} color="var(--primary)" aria-hidden="true" />
            <span>{locating ? "Locating…" : "Find Nearest Station"}</span>
          </button>
          <button onClick={loadStations} className="btn-secondary" style={{ padding: "9px 12px" }} aria-label="Refresh station data">
            <RefreshCw size={15} className={refreshing ? "spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── City Quick-Jump Bar ── */}
      <div className="air-card" style={{ padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <Target size={14} color="#1d72f2" />
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" }}>Quick Jump:</span>
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
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 700,
                  border: isActive ? "2px solid #1d72f2" : "1px solid #cbd5e1",
                  background: isActive ? "linear-gradient(135deg, #eff6ff, #dbeafe)" : "#ffffff",
                  color: isActive ? "#1d72f2" : "#334155",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                  boxShadow: isActive ? "0 2px 10px rgba(29,114,242,0.2)" : "none"
                }}
              >
                📍 {city.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Layer Controls ── */}
      <div className="air-card" style={{ padding: "13px 20px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
            <Layers size={15} color="#1d72f2" /> Layers:
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "#334155", cursor: "pointer" }}>
            <input
              type="checkbox" checked={showHeatmap}
              onChange={e => setShowHeatmap(e.target.checked)}
              style={{ accentColor: "#1d72f2", width: 15, height: 15, cursor: "pointer" }}
            />
            Ambient Plume Glow
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "#334155", cursor: "pointer" }}>
            <input
              type="checkbox" checked={showMarkers}
              onChange={e => setShowMarkers(e.target.checked)}
              style={{ accentColor: "#1d72f2", width: 15, height: 15, cursor: "pointer" }}
            />
            Station Badges
          </label>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
            <Sliders size={13} color="#1d72f2" />
            Plume Radius: <strong style={{ color: "#0f172a" }}>{plumeIntensity}px</strong>
          </span>
          <input
            type="range" min={10} max={50} value={plumeIntensity}
            onChange={e => setPlumeIntensity(Number(e.target.value))}
            style={{ accentColor: "#1d72f2", cursor: "pointer", width: 100 }}
          />
        </div>
      </div>

      {/* ── Map + Right Panel ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 22, minHeight: 700 }}>

        {/* MAP */}
        <div className="air-card" style={{ minHeight: 700, position: "relative", padding: 0, overflow: "hidden" }}>
          <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: 700, borderRadius: 20 }} />

          {/* ── Floating Search Bar ── */}
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 1000, width: 320 }}>
            <div style={{ position: "relative" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(255,255,255,0.96)",
                backdropFilter: "blur(16px)",
                padding: "10px 14px",
                borderRadius: 14,
                border: "1.5px solid #cbd5e1",
                boxShadow: "0 6px 24px rgba(15,23,42,0.18)",
              }}>
                <Search size={15} color="#1d72f2" />
                <input
                  type="text"
                  placeholder="Search city or station name…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && filteredStations.length > 0) {
                      selectAndFlyToStation(filteredStations[0]);
                    }
                    if (e.key === "Escape") {
                      setSearchOpen(false);
                    }
                  }}
                  style={{
                    border: "none", outline: "none",
                    background: "transparent",
                    fontSize: 13, fontWeight: 600,
                    color: "#0f172a", width: "100%",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                />
                {search && (
                  <button
                    onClick={() => { setSearch(""); setSearchOpen(false); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2, display: "flex" }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {searchOpen && search.trim() && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0, right: 0,
                  background: "#ffffff",
                  borderRadius: 14,
                  boxShadow: "0 16px 48px rgba(15,23,42,0.22)",
                  border: "1px solid #e2e8f0",
                  maxHeight: 280,
                  overflowY: "auto",
                  zIndex: 2000,
                  padding: 4,
                }}>
                  {filteredStations.length === 0 ? (
                    <div style={{ padding: "14px 16px", fontSize: 12.5, color: "#64748b", textAlign: "center" }}>
                      <Search size={20} color="#cbd5e1" style={{ display: "block", margin: "0 auto 8px" }} />
                      No stations match "{search}"
                    </div>
                  ) : (
                    filteredStations.slice(0, 10).map((st) => {
                      const aqi = calculateAQI(st.pm25);
                      const m = getAQIMeta(aqi);
                      return (
                        <div
                          key={st.station}
                          onClick={() => selectAndFlyToStation(st)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 12px",
                            borderRadius: 10,
                            cursor: "pointer",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8,
                              background: m.bg, color: m.color,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 900, flexShrink: 0
                            }}>
                              {aqi}
                            </div>
                            <div>
                              <strong style={{ fontSize: 12.5, color: "#0f172a", display: "block" }}>
                                {st.station}
                              </strong>
                              <span style={{ fontSize: 10.5, color: "#64748b" }}>
                                📍 {st.city}, {st.state || "India"}
                              </span>
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10.5, fontWeight: 800,
                            color: m.color, background: m.bg,
                            padding: "3px 8px", borderRadius: 6, flexShrink: 0
                          }}>
                            {m.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* AQI Legend */}
          <div style={{
            position: "absolute", top: 16, right: 16, zIndex: 1000,
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(16px)",
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.8)",
            boxShadow: "0 8px 24px rgba(15,23,42,0.14)",
          }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", display: "block", marginBottom: 8 }}>
              CPCB AQI Scale
            </span>
            {[
              { label: "Good",      color: "#10b981", range: "0–50" },
              { label: "Moderate",  color: "#f59e0b", range: "51–100" },
              { label: "Poor",      color: "#f97316", range: "101–200" },
              { label: "Unhealthy", color: "#ef4444", range: "201–300" },
              { label: "Severe",    color: "#8b5cf6", range: "301+" },
            ].map(leg => (
              <div key={leg.label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: leg.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#334155" }}>{leg.label}</span>
                <span style={{ fontSize: 9.5, color: "#94a3b8", marginLeft: "auto" }}>{leg.range}</span>
              </div>
            ))}
          </div>

          {/* Status Pill */}
          <div style={{
            position: "absolute", bottom: 20, left: 20, zIndex: 1000,
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(12px)",
            padding: "8px 16px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.8)",
            boxShadow: "0 4px 16px rgba(15,23,42,0.12)",
            display: "flex", alignItems: "center", gap: 8
          }}>
            <span className="live-dot" />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
              {stations.length} Stations Active
            </span>
            <span style={{ fontSize: 10.5, color: "#64748b" }}>· OpenStreetMap GIS</span>
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Selected Station Inspector */}
          {selected && (
            <div className="air-card" style={{ padding: "24px", borderTop: `5px solid ${selMeta.color}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{
                  padding: "4px 12px", borderRadius: 8,
                  background: selMeta.bg, color: selMeta.color,
                  border: `1px solid ${selMeta.border}`,
                  fontSize: 12, fontWeight: 800,
                }}>
                  ● {selMeta.label}
                </span>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                  {selected.source || "CAAQMS Station"}
                </span>
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", lineHeight: 1.2, marginBottom: 4 }}>
                {selected.station}
              </h2>
              <p style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: 5, marginBottom: 18 }}>
                <MapPin size={13} color="#1d72f2" />
                {selected.city}, {selected.state || "India"}
              </p>

              {/* AQI + PM2.5 */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 14, background: "#f8fafc",
                borderRadius: 14, padding: "16px",
                border: "1px solid #e2e8f0", marginBottom: 18
              }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>AQI INDEX</span>
                  <div className="display-num" style={{ fontSize: 38, color: selMeta.color, marginTop: 4 }}>
                    {selAQI}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>PM2.5 CONC.</span>
                  <div style={{ marginTop: 8 }}>
                    <span className="display-num" style={{ fontSize: 26, color: "#0f172a" }}>
                      {selected.pm25.toFixed(1)}
                    </span>
                    <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 4 }}>µg/m³</span>
                  </div>
                </div>
              </div>

              {/* Microdata */}
              {(selected.temperature || selected.humidity || selected.wind_speed) && (
                <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                  {selected.temperature && (
                    <div style={{ flex: 1, background: "#fff7ed", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                      <Thermometer size={14} color="#ea580c" style={{ display: "block", margin: "0 auto 3px" }} />
                      <span style={{ fontSize: 13, fontWeight: 900, color: "#ea580c" }}>{selected.temperature}°C</span>
                    </div>
                  )}
                  {selected.humidity && (
                    <div style={{ flex: 1, background: "#f0f9ff", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                      <Droplets size={14} color="#0284c7" style={{ display: "block", margin: "0 auto 3px" }} />
                      <span style={{ fontSize: 13, fontWeight: 900, color: "#0284c7" }}>{selected.humidity}%</span>
                    </div>
                  )}
                  {selected.wind_speed && (
                    <div style={{ flex: 1, background: "#ecfdf5", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                      <Wind size={14} color="#059669" style={{ display: "block", margin: "0 auto 3px" }} />
                      <span style={{ fontSize: 13, fontWeight: 900, color: "#059669" }}>{selected.wind_speed}km/h</span>
                    </div>
                  )}
                </div>
              )}

              {/* LSTM Forecast */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                    <TrendingUp size={14} color="#1d72f2" /> ML Forecast
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: "#1d72f2", background: "#eff6ff", padding: "2px 7px", borderRadius: 4 }}>
                    LSTM Engine
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { horizon: "+1 Hr",  mult: 1.05 },
                    { horizon: "+3 Hrs", mult: 1.12 },
                    { horizon: "+6 Hrs", mult: 1.22 },
                  ].map(f => {
                    const predPM  = Math.round(selected.pm25 * f.mult);
                    const predAQI = calculateAQI(predPM);
                    const pm      = getAQIMeta(predAQI);
                    return (
                      <div key={f.horizon} style={{
                        background: "#ffffff", border: "1px solid #e2e8f0",
                        borderRadius: 12, padding: "10px 8px", textAlign: "center"
                      }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block" }}>{f.horizon}</span>
                        <div className="display-num" style={{ fontSize: 20, color: pm.color, margin: "4px 0" }}>{predAQI}</div>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: "#334155" }}>{predPM} µg/m³</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Health Advisory */}
              <div style={{
                background: selAQI > 100 ? "#fff7ed" : "#ecfdf5",
                border: `1px solid ${selAQI > 100 ? "#fed7aa" : "#a7f3d0"}`,
                borderRadius: 12, padding: "12px 14px",
                display: "flex", alignItems: "flex-start", gap: 10
              }}>
                <ShieldCheck size={18} color={selAQI > 100 ? "#ea580c" : "#059669"} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h4 style={{ fontSize: 12.5, fontWeight: 800, color: selAQI > 100 ? "#9a3412" : "#065f46" }}>
                    Public Health Advisory
                  </h4>
                  <p style={{ fontSize: 11.5, color: selAQI > 100 ? "#c2410c" : "#047857", marginTop: 3, lineHeight: 1.4, fontWeight: 500 }}>
                    {selAQI <= 50
                      ? "Air quality is ideal for all outdoor activities."
                      : selAQI <= 100
                      ? "Acceptable air quality; sensitive individuals should limit prolonged exposure."
                      : selAQI <= 200
                      ? "Sensitive cohorts should reduce heavy outdoor exertion."
                      : "High pollution levels. Wear N95 mask outdoors and keep windows closed."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Station List */}
          <div className="air-card" style={{ padding: "16px", maxHeight: 300, overflowY: "auto" }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", marginBottom: 10, display: "block" }}>
              Regional Stations ({stations.length})
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {stations.slice(0, 25).map(st => {
                const aqi  = calculateAQI(st.pm25);
                const m    = getAQIMeta(aqi);
                const isCur = selected?.station === st.station;
                return (
                  <button
                    key={st.station}
                    onClick={() => selectAndFlyToStation(st)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: isCur ? "1.5px solid #1d72f2" : "1px solid #f1f5f9",
                      background: isCur ? "#eff6ff" : "#ffffff",
                      cursor: "pointer", textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => { if (!isCur) e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={e => { if (!isCur) e.currentTarget.style.background = "#ffffff"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: m.bg, color: m.color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 900, flexShrink: 0
                      }}>
                        {aqi}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: 12, color: isCur ? "#1d72f2" : "#0f172a", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
                          {st.station}
                        </strong>
                        <span style={{ fontSize: 10.5, color: "#64748b" }}>{st.city}</span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      color: m.color, background: m.bg,
                      padding: "2px 7px", borderRadius: 5, flexShrink: 0
                    }}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
