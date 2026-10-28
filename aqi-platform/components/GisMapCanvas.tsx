"use client";

import { useEffect, useRef } from "react";
import { calculateAQI, getAQIMeta, ExtendedStation } from "@/lib/dataService";

interface GisMapCanvasProps {
  stations: ExtendedStation[];
  selected: ExtendedStation | null;
  onSelectStation: (s: ExtendedStation) => void;
  showHeatmap: boolean;
  showMarkers: boolean;
  plumeIntensity: number;
}

export default function GisMapCanvas({
  stations,
  selected,
  onSelectStation,
  showHeatmap,
  showMarkers,
  plumeIntensity,
}: GisMapCanvasProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const heatmapLayer = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    let isDisposed = false;

    import("leaflet").then((L) => {
      if (isDisposed || !mapRef.current) return;

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
        minZoom: 5,
        maxZoom: 18,
      });

      // Custom zoom control positioned bottom-right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      const isDark = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "cosmic";
      const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

      L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      heatmapLayer.current = L.layerGroup().addTo(map);
      markersLayer.current = L.layerGroup().addTo(map);
      mapInst.current = map;

      // Force proper tile render after container paint
      setTimeout(() => { map.invalidateSize(); }, 200);
      setTimeout(() => { map.invalidateSize(); }, 800);
    });

    return () => {
      isDisposed = true;
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
      }
    };
  }, []);

  // Update center when selected changes
  useEffect(() => {
    if (!mapInst.current || !selected) return;
    mapInst.current.setView([selected.latitude, selected.longitude], Math.max(mapInst.current.getZoom(), 11), { animate: true });
  }, [selected]);

  // Render markers whenever stations or options change
  useEffect(() => {
    if (!mapInst.current) return;
    import("leaflet").then((L) => {
      if (!heatmapLayer.current || !markersLayer.current) return;

      heatmapLayer.current.clearLayers();
      markersLayer.current.clearLayers();

      stations.forEach((s) => {
        if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) return;
        const aqi = calculateAQI(s.pm25);
        const meta = getAQIMeta(aqi);
        const isSel = selected?.station === s.station;

        // Ambient plume glow
        if (showHeatmap) {
          L.circleMarker([s.latitude, s.longitude], {
            radius:      isSel ? plumeIntensity * 1.6 : plumeIntensity,
            fillColor:   meta.color,
            fillOpacity: isSel ? 0.3 : 0.16,
            stroke:      true,
            color:       meta.color,
            weight:      isSel ? 2 : 1,
            opacity:     0.6,
            interactive: false,
          }).addTo(heatmapLayer.current);
        }

        // Station glowing badges
        if (showMarkers) {
          const shortName = s.station
            .replace(/^(GJ|MH)-[A-Z]+-[0-9]+\s*\((.*?)\)$/, "$2")
            .substring(0, 18);

          const icon = L.divIcon({
            className: "custom-dark-pin",
            html: `
              <div style="
                display: inline-flex;
                align-items: center;
                background: #ffffff;
                padding: 4px 10px 4px 4px;
                border-radius: 999px;
                box-shadow: 0 4px 16px rgba(15,23,42,0.14), 0 0 10px ${meta.color}40;
                border: 1.5px solid ${isSel ? 'var(--mint, #0284c7)' : meta.color};
                cursor: pointer;
                transform: ${isSel ? 'scale(1.20)' : 'scale(1)'};
                transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
                white-space: nowrap;
              ">
                <div style="
                  width: 26px; height: 26px;
                  border-radius: 50%;
                  background: ${meta.color};
                  color: #ffffff;
                  display: flex; align-items: center; justify-content: center;
                  font-size: 10.5px; font-weight: 800;
                  margin-right: 7px;
                  flex-shrink: 0;
                ">
                  ${aqi}
                </div>
                <div style="display: flex; flex-direction: column; min-width: 0;">
                  <span style="
                    font-size: 11px; font-weight: 800;
                    color: #0f172a;
                    line-height: 1.2;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                    max-width: 90px;
                  ">${shortName}</span>
                  <span style="
                    font-size: 9px; font-weight: 600;
                    color: #64748b;
                    margin-top: 1px;
                  ">${s.city}</span>
                </div>
              </div>
            `,
            iconSize:   [145, 38],
            iconAnchor: [72, 19],
          });

          const m = L.marker([s.latitude, s.longitude], { icon }).addTo(markersLayer.current);
          m.on("click", () => onSelectStation(s));
        }
      });
    });
  }, [stations, selected, showHeatmap, showMarkers, plumeIntensity, onSelectStation]);

  return <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: 500, borderRadius: 18 }} />;
}

