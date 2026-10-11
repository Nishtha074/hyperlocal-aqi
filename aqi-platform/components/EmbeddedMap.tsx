"use client";
import { useEffect, useRef } from "react";

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

export default function EmbeddedMap({
  stations,
  selectedStation,
  onSelectStation,
}: {
  stations: Station[];
  selectedStation: Station | null;
  onSelectStation: (s: Station) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const renderMarkers = useRef<(() => void) | null>(null);
  const stationsRef = useRef(stations);
  const selectedStationRef = useRef(selectedStation);
  const onSelectStationRef = useRef(onSelectStation);

  stationsRef.current = stations;
  selectedStationRef.current = selectedStation;
  onSelectStationRef.current = onSelectStation;

  useEffect(() => {
    let disposed = false;

    import("leaflet").then((L) => {
      if (disposed || !mapRef.current) return;

      const initialStation = selectedStationRef.current;
      const initialCenter: [number, number] = initialStation
        ? [initialStation.latitude, initialStation.longitude]
        : [19.076, 72.8777];

      const map = L.map(mapRef.current, {
        center: initialCenter,
        zoom: 7,
        maxZoom: 22,
        zoomControl: true,
      });

      mapInstance.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxNativeZoom: 19,
        maxZoom: 22,
      }).addTo(map);

      const markers = L.layerGroup().addTo(map);
      renderMarkers.current = () => {
        markers.clearLayers();

        stationsRef.current.forEach((s) => {
          if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) return;
          const color = getAQIColor(s.pm25 ?? 0);
          const aqi = getAQI(s.pm25 ?? 0);
          const isSelected = selectedStationRef.current?.station === s.station;

          const icon = L.divIcon({
            className: "",
            html: `
            <div style="
              width: 38px; height: 38px; border-radius: 50%;
              background: #ffffff; border: 2.5px solid ${isSelected ? "#0f172a" : color};
              display: flex; flex-direction: column; align-items: center; justify-content: center;
              font-family: -apple-system, sans-serif;
              box-shadow: 0 4px 12px rgba(15,23,42,0.18), 0 0 0 ${isSelected ? "5px rgba(15,23,42,0.2)" : "3px rgba(0,0,0,0.06)"};
              cursor: pointer; transition: transform 0.2s ease;
            ">
              <span style="font-size: 12px; font-weight: 800; color: #0f172a; line-height: 1;">${aqi}</span>
              <span style="font-size: 7.5px; font-weight: 700; color: ${color}; line-height: 1; margin-top: 1px;">AQI</span>
            </div>
          `,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
          });

          const marker = L.marker([s.latitude, s.longitude], { icon }).addTo(markers);

          marker.on("click", () => {
            onSelectStationRef.current(s);
            map.flyTo([s.latitude, s.longitude], 12, { duration: 1 });
          });

          marker.bindPopup(`
          <div style="font-family: -apple-system, sans-serif; padding: 4px; color: #0f172a;">
            <div style="font-weight: 800; font-size: 14px; margin-bottom: 2px;">${s.city || s.station}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${s.source === "CPCB" ? "CPCB monitoring station" : "Open-Meteo city estimate"}</div>
            <div style="display: flex; gap: 10px; background: #f8fafc; padding: 6px 10px; border-radius: 8px;">
              <div>
                <span style="font-size: 10px; color: #64748b; font-weight: 600;">AQI</span>
                <div style="font-size: 15px; font-weight: 800; color: ${color};">${aqi}</div>
              </div>
              <div>
                <span style="font-size: 10px; color: #64748b; font-weight: 600;">PM2.5</span>
                <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${s.pm25?.toFixed(1)}</div>
              </div>
            </div>
          </div>
        `);
        });
      };
      renderMarkers.current();
      window.requestAnimationFrame(() => map.invalidateSize());
    }).catch((error: unknown) => {
      console.error("Unable to initialize the live map.", error);
    });

    return () => {
      disposed = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      renderMarkers.current = null;
    };
  }, []);

  useEffect(() => {
    renderMarkers.current?.();
  }, [stations, selectedStation?.station]);

  return <div ref={mapRef} style={{ width: "100%", height: "100%", borderRadius: "14px" }} />;
}
