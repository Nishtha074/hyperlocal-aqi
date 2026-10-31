"use client";
import { useEffect, useRef, useState } from "react";

export interface Station {
  station: string;
  city: string;
  pm25: number;
  pm10: number;
  no2?: number;
  latitude: number;
  longitude: number;
  is_live_weather?: boolean;
  source?: string;
  fetched_at?: string;
}

function getAQIColor(val: number): string {
  if (val <= 50) return "#059669";  // Good
  if (val <= 100) return "#d97706"; // Moderate
  if (val <= 200) return "#ea580c"; // Poor
  if (val <= 300) return "#dc2626"; // Very Poor
  return "#9333ea";                 // Severe
}

function computeAQI(pm25: number): number {
  if (pm25 <= 30) return Math.round((pm25 / 30) * 50);
  if (pm25 <= 60) return Math.round(50 + ((pm25 - 30) / 30) * 50);
  if (pm25 <= 90) return Math.round(100 + ((pm25 - 60) / 30) * 100);
  if (pm25 <= 120) return Math.round(200 + ((pm25 - 90) / 30) * 100);
  if (pm25 <= 250) return Math.round(300 + ((pm25 - 120) / 130) * 100);
  return Math.min(500, Math.round(400 + ((pm25 - 250) / 150) * 100));
}

export default function EmbeddedMap({
  stations,
  selectedStation,
  onSelectStation,
  activePollutant = "PM2.5",
  center,
  zoom = 10,
}: {
  stations: Station[];
  selectedStation: Station | null;
  onSelectStation: (s: Station) => void;
  activePollutant?: "PM2.5" | "PM10" | "NO2";
  center?: [number, number];
  zoom?: number;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const [mapSearch, setMapSearch] = useState("");

  const filteredStations = stations.filter(s =>
    s.station.toLowerCase().includes(mapSearch.toLowerCase()) ||
    s.city.toLowerCase().includes(mapSearch.toLowerCase())
  );

  useEffect(() => {
    let disposed = false;

    import("leaflet").then((L) => {
      if (disposed || !mapRef.current) return;

      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }

      const initialCenter: [number, number] = center
        ? center
        : selectedStation
        ? [selectedStation.latitude, selectedStation.longitude]
        : stations.length > 0
        ? [stations[0].latitude, stations[0].longitude]
        : [19.0760, 72.8777]; // Western India default

      const map = L.map(mapRef.current, {
        center: initialCenter,
        zoom: zoom,
        zoomControl: false,
      });

      mapInstance.current = map;

      // High-Resolution OpenStreetMap Tiles - No API key required, 100% visible and reliable
      const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

      L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      }).addTo(map);

      const mLayer = L.layerGroup().addTo(map);
      markersLayer.current = mLayer;

      const renderMarkers = () => {
        mLayer.clearLayers();

        filteredStations.forEach((s) => {
          if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) return;

          let displayVal = computeAQI(s.pm25 ?? 0);
          if (activePollutant === "PM10") {
            displayVal = Math.round(s.pm10 ?? s.pm25 * 1.8);
          } else if (activePollutant === "NO2") {
            displayVal = Math.round(s.no2 ?? 30);
          }

          const color = getAQIColor(displayVal);
          const isSelected = selectedStation?.station === s.station;

          const pinHtml = `
            <div style="
              display: inline-flex;
              align-items: center;
              background: #ffffff;
              padding: 3px 10px 3px 3px;
              border-radius: 999px;
              box-shadow: 0 4px 16px rgba(15, 23, 42, 0.14), 0 0 10px ${color}35;
              border: 1.5px solid ${isSelected ? 'var(--mint, #0284c7)' : color};
              cursor: pointer;
              transform: ${isSelected ? "scale(1.18)" : "scale(1.0)"};
              transition: all 0.2s ease;
              white-space: nowrap;
            ">
              <div style="
                width: 26px;
                height: 26px;
                border-radius: 50%;
                background: ${color};
                color: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 800;
                font-family: 'Outfit', sans-serif;
                margin-right: 6px;
              ">
                ${displayVal}
              </div>
              <span style="
                font-size: 11.5px;
                font-weight: 700;
                color: #0f172a;
                font-family: 'Inter', sans-serif;
              ">${s.city}</span>
            </div>
          `;

          const icon = L.divIcon({
            html: pinHtml,
            className: "custom-div-pin",
            iconSize: [110, 34],
            iconAnchor: [55, 17],
          });

          const marker = L.marker([s.latitude, s.longitude], { icon }).addTo(mLayer);
          marker.on("click", () => onSelectStation(s));
        });
      };

      renderMarkers();
    });

    return () => {
      disposed = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [stations, selectedStation, activePollutant, mapSearch, zoom]);

  useEffect(() => {
    if (!mapInstance.current || !center) return;
    mapInstance.current.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 380 }}>
      {/* Search Input overlay */}
      <div style={{
        position: "absolute", top: 12, left: 12, zIndex: 1000,
        width: 240, maxWidth: "80%",
      }}>
        <input
          type="text"
          placeholder="Filter map stations..."
          value={mapSearch}
          onChange={(e) => setMapSearch(e.target.value)}
          className="ap-input"
          style={{
            width: "100%",
            fontSize: 12,
            padding: "8px 12px",
            background: "rgba(255, 255, 255, 0.94)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: 380 }} />
    </div>
  );
}