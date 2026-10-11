"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapPin, Layers, RefreshCw, AlertTriangle, Compass,
  Navigation, Eye, ShieldCheck, Wind, Radio, Maximize2
} from "lucide-react";
import { getNearestStation, getPreferredStation } from "@/lib/locations";

function getAQIColor(pm25: number): string {
  if (pm25 <= 12) return "#059669";
  if (pm25 <= 35.4) return "#d97706";
  if (pm25 <= 55.4) return "#ea580c";
  if (pm25 <= 150.4) return "#dc2626";
  return "#7c3aed";
}

function getAQI(pm25: number): number {
  if (pm25 <= 12) return Math.round((50 / 12) * pm25);
  if (pm25 <= 35.4) return Math.round(50 + (50 / 23.4) * (pm25 - 12));
  if (pm25 <= 55.4) return Math.round(100 + (50 / 20) * (pm25 - 35.4));
  return Math.round(150 + (50 / 95) * (pm25 - 55.4));
}

interface Station {
  station: string;
  city: string;
  pm25: number;
  pm10?: number;
  no2?: number;
  latitude: number;
  longitude: number;
  source?: string;
  fetched_at?: string;
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const savedMapViewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [selected, setSelected] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const refreshStations = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/current", { cache: "no-store" });
      if (!res.ok) throw new Error(`Station service returned ${res.status}`);
      const data: Station[] = await res.json();
      const valid = data.filter(
        (station) => Number.isFinite(station.latitude) && Number.isFinite(station.longitude),
      );
      setStations(valid);
      setSelected(previous =>
        valid.find(station => station.station === previous?.station)
        ?? getPreferredStation(valid)
        ?? null
      );
      setLoadError(valid.length ? "" : "No live regional readings are currently available.");
    } catch {
      setLoadError("Unable to load live readings. Check that the air-quality service is running.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshStations();
    const interval = window.setInterval(() => void refreshStations(), 300000);
    return () => window.clearInterval(interval);
  }, [refreshStations]);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;
    const mapElement = mapRef.current;

    import("leaflet").then((L) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const savedView = savedMapViewRef.current;
      const points = stations
        .filter((station) => Number.isFinite(station.latitude) && Number.isFinite(station.longitude))
        .map((station) => [station.latitude, station.longitude] as [number, number]);
      const map = L.map(mapElement, {
        center: savedView?.center ?? [22.5645, 72.9289],
        zoom: savedView?.zoom ?? 7,
        maxZoom: 22,
        zoomControl: true,
      });

      mapInstanceRef.current = map;
      if (!savedView && points.length > 1) {
        map.fitBounds(points, { padding: [42, 42], maxZoom: 7 });
      }

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxNativeZoom: 19,
        maxZoom: 22,
      }).addTo(map);
      window.requestAnimationFrame(() => map.invalidateSize());

      // Add Stations as 3D Styled Ripple Pulsing Markers
      stations.forEach((s) => {
        if (!s.latitude || !s.longitude) return;
        const color = getAQIColor(s.pm25 ?? 0);
        const aqi = getAQI(s.pm25 ?? 0);

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              width: 46px; height: 46px; border-radius: 50%;
              background: #ffffff; border: 3px solid ${color};
              display: flex; flex-direction: column; align-items: center; justify-content: center;
              font-family: 'Inter', sans-serif;
              box-shadow: 0 8px 20px rgba(0,0,0,0.18), 0 0 0 6px ${color}25;
              cursor: pointer; transition: transform 0.2s ease;
            ">
              <span style="font-size: 13px; font-weight: 800; color: #0f172a; line-height: 1;">${aqi}</span>
              <span style="font-size: 8px; font-weight: 700; color: ${color}; line-height: 1; margin-top: 1px;">AQI</span>
            </div>
          `,
          iconSize: [46, 46],
          iconAnchor: [23, 23],
        });

        const marker = L.marker([s.latitude, s.longitude], { icon }).addTo(map);

        marker.on("click", () => {
          setSelected(s);
          map.flyTo([s.latitude, s.longitude], 10, { duration: 1.2 });
        });

        marker.bindPopup(`
          <div style="font-family: 'Inter', sans-serif; padding: 4px; color: #0f172a;">
            <div style="font-weight: 800; font-size: 15px; margin-bottom: 2px;">${s.city || s.station}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">${s.source === "CPCB" ? "CPCB monitoring station" : "Open-Meteo live city estimate"}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-bottom: 8px;">Node ID: ${s.station}</div>
            <div style="display: flex; gap: 12px; margin-bottom: 8px; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
              <div>
                <div style="font-size: 10px; color: #64748b; font-weight: 600;">AQI</div>
                <div style="font-size: 16px; font-weight: 800; color: ${color};">${aqi}</div>
              </div>
              <div>
                <div style="font-size: 10px; color: #64748b; font-weight: 600;">PM2.5</div>
                <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${s.pm25?.toFixed(1)}</div>
              </div>
            </div>
            <div style="font-size: 10.5px; color: #2563eb; font-weight: 600;">Click card in panel for ML forecast</div>
          </div>
        `);
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        if (stations.length > 0) {
          const center = mapInstanceRef.current.getCenter();
          savedMapViewRef.current = {
            center: [center.lat, center.lng],
            zoom: mapInstanceRef.current.getZoom(),
          };
        }
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [stations]);

  const visibleStations = stations.filter((station) =>
    `${station.city} ${station.station}`.toLowerCase().includes(search.toLowerCase()),
  );

  // Live GPS geolocation
  const locateUser = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lon: longitude });
        const nearestStation = getNearestStation(stations, latitude, longitude);
        if (nearestStation) setSelected(nearestStation);
        const map = mapInstanceRef.current;
        if (!map) {
          setIsLocating(false);
          return;
        }

        import("leaflet").then((L) => {
          const userIcon = L.divIcon({
            className: "",
            html: `
              <div style="
                width: 20px; height: 20px; border-radius: 50%;
                background: #2563eb; border: 3px solid #ffffff;
                box-shadow: 0 0 0 8px rgba(37, 99, 235, 0.35);
              "></div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          L.marker([latitude, longitude], { icon: userIcon }).addTo(map)
            .bindPopup("<b>You are here (Live GPS)</b>").openPopup();
          map.flyTo([latitude, longitude], 11, { duration: 1.5 });
        }).finally(() => setIsLocating(false));
      },
      () => {
        setIsLocating(false);
        alert("GPS location unavailable.");
      }
    );
  };

  return (
    <div className="map-workspace" style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Map Control Sidebar (380px) */}
      <div className="map-control-panel" style={{
        width: "380px", background: "rgba(255, 255, 255, 0.94)",
        backdropFilter: "blur(20px)", borderRight: "1px solid #dbeafe",
        display: "flex", flexDirection: "column", zIndex: 10,
        boxShadow: "6px 0 24px rgba(37, 99, 235, 0.05)"
      }}>
        {/* Header */}
        <div style={{ padding: "26px 24px 20px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Compass size={18} color="#2563eb" />
            <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>
              Geospatial AQI Grid
            </h1>
          </div>
          <p style={{ fontSize: "12.5px", color: "#64748b" }}>
            Live CPCB sensor readings on OpenStreetMap streets
          </p>

          <button
            onClick={locateUser}
            className="btn-pill"
            style={{
              width: "100%", marginTop: "14px", justifyContent: "center",
              background: userCoords ? "#dcfce7" : "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: userCoords ? "#15803d" : "#ffffff",
              border: userCoords ? "1.5px solid #86efac" : "none"
            }}
          >
            <Navigation size={15} />
            {isLocating ? "Acquiring GPS..." : userCoords ? "GPS Position Centered" : "Find stations near me"}
          </button>
          <button
            type="button"
            className="map-refresh-button"
            onClick={() => void refreshStations()}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? "spin" : ""} />
            {refreshing ? "Updating regional readings" : "Refresh regional readings"}
          </button>
        </div>

        {/* Selected Station Detail Spotlight */}
        {selected ? (
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>
                  {selected.source === "CPCB" ? "CPCB monitoring station" : "Open-Meteo city estimate"}
                </span>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                  {selected.city || selected.station}
                </div>
                <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                  {selected.latitude.toFixed(4)}°N, {selected.longitude.toFixed(4)}°E
                </div>
                {selected.fetched_at && (
                  <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "3px" }}>
                    Updated {new Date(selected.fetched_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
              <div style={{
                padding: "8px 14px", borderRadius: "12px", background: "#ffffff",
                border: "1px solid #dbeafe", textAlign: "center", boxShadow: "var(--shadow-sm)"
              }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: getAQIColor(selected.pm25 ?? 0) }}>
                  {getAQI(selected.pm25 ?? 0)}
                </div>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>AQI</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "14px" }}>
              <div style={{ background: "#ffffff", borderRadius: "10px", padding: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>PM2.5 Sensor</span>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>{selected.pm25?.toFixed(1)} µg/m³</div>
              </div>
              <div style={{ background: "#ffffff", borderRadius: "10px", padding: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>PM10 Inhalable</span>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>{selected.pm10?.toFixed(1)} µg/m³</div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Station List Filter */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
            Regional locations ({stations.length})
          </div>
          <input
            className="map-search"
            type="search"
            placeholder="Search Ahmedabad, Anand, Surat…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search regional locations"
          />
          {loadError && <p className="map-error" role="status">{loadError}</p>}
          {!loadError && loading && <p className="map-list-status">Loading regional air-quality data…</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {visibleStations.map((s) => {
              const isCur = selected?.station === s.station;
              const aqiVal = getAQI(s.pm25 ?? 0);
              const color = getAQIColor(s.pm25 ?? 0);
              return (
                <div
                  key={s.station}
                  onClick={() => {
                    setSelected(s);
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.flyTo([s.latitude, s.longitude], 10, { duration: 1 });
                    }
                  }}
                  className="card-3d map-station-card"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 14px", borderRadius: "12px",
                    background: isCur ? "#eff6ff" : "#ffffff",
                    border: isCur ? "1.5px solid #3b82f6" : "1px solid #e2e8f0",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: color }} />
                    <div>
                      <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>{s.city || s.station}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        {s.source === "CPCB" ? "CPCB sensor" : "Live city-level estimate"}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: color }}>
                    {aqiVal} AQI
                  </div>
                </div>
              );
            })}
            {!loading && !loadError && visibleStations.length === 0 && (
              <p className="map-list-status">No locations match “{search}”.</p>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #f1f5f9", fontSize: "11px", background: "#f8fafc" }}>
          <div style={{ fontWeight: 700, color: "#334155", marginBottom: "6px" }}>AQI Index Legend:</div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#059669", fontWeight: 700 }}>● Good (&lt;50)</span>
            <span style={{ color: "#d97706", fontWeight: 700 }}>● Mod (&lt;100)</span>
            <span style={{ color: "#dc2626", fontWeight: 700 }}>● Poor (&lt;200)</span>
            <span style={{ color: "#7c3aed", fontWeight: 700 }}>● Severe (&gt;200)</span>
          </div>
        </div>
      </div>

      {/* Main Real Map Container */}
      <div style={{ flex: 1, position: "relative", height: "100%" }}>
        <div ref={mapRef} style={{ width: "100%", height: "100%", zIndex: 1 }} />
      </div>
    </div>
  );
}
