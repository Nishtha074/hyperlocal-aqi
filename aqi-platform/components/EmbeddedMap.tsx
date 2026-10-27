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
  if (val <= 50) return "#10b981";  // Good (Green)
  if (val <= 100) return "#f59e0b"; // Moderate (Yellow/Amber)
  if (val <= 200) return "#f97316"; // Poor (Orange)
  if (val <= 300) return "#ef4444"; // Very Poor (Red)
  return "#8b5cf6";                 // Severe (Purple)
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
  zoom = 11,
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
        : [18.5204, 73.8567]; // Pune default

      const map = L.map(mapRef.current, {
        center: initialCenter,
        zoom: zoom,
        zoomControl: false,
      });

      mapInstance.current = map;

      // Clean OpenStreetMap Tile Layer (crisp, zero watermarks, 100% reliable)
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
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
              padding: 2.5px 10px 2.5px 2.5px;
              border-radius: 999px;
              box-shadow: 0 4px 14px rgba(15, 23, 42, 0.22);
              border: 2px solid ${isSelected ? "#1d72f2" : "#e2e8f0"};
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
                font-family: 'Plus Jakarta Sans', sans-serif;
                margin-right: 6px;
                box-shadow: 0 1px 4px rgba(0,0,0,0.2);
              ">
                ${displayVal}
              </div>
              <span style="
                font-size: 11.5px;
                font-weight: 700;
                color: #0f172a;
                font-family: 'Plus Jakarta Sans', sans-serif;
              ">
                ${s.station}
              </span>
            </div>
          `;

          const customIcon = L.divIcon({
            html: pinHtml,
            className: "custom-div-pin",
            iconSize: [115, 34],
            iconAnchor: [57, 17],
          });

          const marker = L.marker([s.latitude, s.longitude], { icon: customIcon });

          // Popup with rich information
          const popupContent = `
            <div style="padding: 4px 2px; min-width: 160px;">
              <strong style="font-size: 13.5px; color: #0f172a; display: block; margin-bottom: 2px;">${s.station}</strong>
              <span style="font-size: 11px; color: #64748b;">${s.city} CAAQMS Station</span>
              <div style="display: flex; align-items: baseline; gap: 6px; margin: 8px 0 4px;">
                <span style="font-size: 24px; font-weight: 900; color: ${color}; line-height: 1;">${computeAQI(s.pm25)}</span>
                <span style="font-size: 11px; font-weight: 700; color: ${color};">AQI Points</span>
              </div>
              <div style="font-size: 11px; color: #475569; border-top: 1px solid #f1f5f9; padding-top: 6px; margin-top: 6px;">
                PM2.5: <b>${s.pm25} µg/m³</b> | PM10: <b>${s.pm10} µg/m³</b>
              </div>
            </div>
          `;
          marker.bindPopup(popupContent);

          marker.on("click", () => {
            onSelectStation(s);
          });

          marker.addTo(mLayer);
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
  }, [center, zoom, mapSearch]);

  // Update center or markers when stations or selection change
  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current) return;

    import("leaflet").then((L) => {
      markersLayer.current.clearLayers();

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
            padding: 2.5px 10px 2.5px 2.5px;
            border-radius: 999px;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.22);
            border: 2px solid ${isSelected ? "#1d72f2" : "#e2e8f0"};
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
              font-family: 'Plus Jakarta Sans', sans-serif;
              margin-right: 6px;
              box-shadow: 0 1px 4px rgba(0,0,0,0.2);
            ">
              ${displayVal}
            </div>
            <span style="
              font-size: 11.5px;
              font-weight: 700;
              color: #0f172a;
              font-family: 'Plus Jakarta Sans', sans-serif;
            ">
              ${s.station}
            </span>
          </div>
        `;

        const customIcon = L.divIcon({
          html: pinHtml,
          className: "custom-div-pin",
          iconSize: [115, 34],
          iconAnchor: [57, 17],
        });

        const marker = L.marker([s.latitude, s.longitude], { icon: customIcon });

        const popupContent = `
          <div style="padding: 4px 2px; min-width: 160px;">
            <strong style="font-size: 13.5px; color: #0f172a; display: block; margin-bottom: 2px;">${s.station}</strong>
            <span style="font-size: 11px; color: #64748b;">${s.city} CAAQMS Station</span>
            <div style="display: flex; align-items: baseline; gap: 6px; margin: 8px 0 4px;">
              <span style="font-size: 24px; font-weight: 900; color: ${color}; line-height: 1;">${computeAQI(s.pm25)}</span>
              <span style="font-size: 11px; font-weight: 700; color: ${color};">AQI Points</span>
            </div>
            <div style="font-size: 11px; color: #475569; border-top: 1px solid #f1f5f9; padding-top: 6px; margin-top: 6px;">
              PM2.5: <b>${s.pm25} µg/m³</b> | PM10: <b>${s.pm10} µg/m³</b>
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);
        marker.on("click", () => onSelectStation(s));
        marker.addTo(markersLayer.current);
      });

      if (center) {
        mapInstance.current.setView(center, zoom);
      }
    });
  }, [stations, selectedStation, activePollutant, center, zoom, onSelectStation, filteredStations]);

  const handleZoomIn = () => {
    if (mapInstance.current) mapInstance.current.zoomIn();
  };
  const handleZoomOut = () => {
    if (mapInstance.current) mapInstance.current.zoomOut();
  };
  const handleRecenter = () => {
    if (mapInstance.current && stations.length > 0) {
      const target = selectedStation || stations[0];
      mapInstance.current.setView([target.latitude, target.longitude], 12);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 16, overflow: "hidden" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* ── Overlay: Quick Search Input (Top Left) ── */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 1000,
        }}
      >
        <input
          type="text"
          value={mapSearch}
          onChange={(e) => setMapSearch(e.target.value)}
          placeholder="🔍 Search station on map..."
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            border: "1px solid #cbd5e1",
            boxShadow: "0 2px 10px rgba(15, 23, 42, 0.12)",
            fontSize: 12,
            fontWeight: 600,
            color: "#0f172a",
            outline: "none",
            width: 210,
          }}
        />
      </div>

      {/* ── Overlay: Stations Online Badge (Bottom Left) ── */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          zIndex: 1000,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          padding: "6px 14px",
          borderRadius: 999,
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 10px rgba(15, 23, 42, 0.1)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        <span className="live-dot" style={{ width: 7, height: 7 }} />
        <span>{filteredStations.length} Stations Online</span>
      </div>

      {/* ── Overlay: Zoom & Re-Center Controls (Bottom Right) ── */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <button
          onClick={handleZoomIn}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 800,
            color: "#334155",
            cursor: "pointer",
          }}
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 800,
            color: "#334155",
            cursor: "pointer",
          }}
          title="Zoom Out"
        >
          &minus;
        </button>
        <button
          onClick={handleRecenter}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            fontWeight: 800,
            color: "#1d72f2",
            cursor: "pointer",
          }}
          title="Re-Center"
        >
          &#9678;
        </button>
      </div>
    </div>
  );
}
