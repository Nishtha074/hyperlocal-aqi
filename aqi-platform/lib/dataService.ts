import { Station } from "@/components/EmbeddedMap";

export interface ExtendedStation extends Station {
  state?: string;
  so2?: number;
  co?: number;
  o3?: number;
  temperature?: number;
  humidity?: number;
  wind_speed?: number;
  visibility?: number;
}

export const PUNE_HYPERLOCAL_STATIONS: ExtendedStation[] = [
  {
    station: "Pimpri",
    city: "Pune",
    state: "Maharashtra",
    pm25: 48.2,
    pm10: 92.5,
    no2: 34.0,
    so2: 14.2,
    co: 1.1,
    o3: 38.0,
    temperature: 28.5,
    humidity: 62,
    wind_speed: 13.0,
    visibility: 8.0,
    latitude: 18.6279,
    longitude: 73.8009,
    source: "Pimpri Chinchwad CAAQMS",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "Bhosari",
    city: "Pune",
    state: "Maharashtra",
    pm25: 54.5,
    pm10: 104.0,
    no2: 38.5,
    so2: 16.5,
    co: 1.3,
    o3: 42.0,
    temperature: 29.0,
    humidity: 59,
    wind_speed: 11.5,
    visibility: 7.2,
    latitude: 18.6385,
    longitude: 73.8443,
    source: "Bhosari Industrial CAAQMS",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "Lohegaon",
    city: "Pune",
    state: "Maharashtra",
    pm25: 29.5,
    pm10: 62.0,
    no2: 22.0,
    so2: 9.5,
    co: 0.7,
    o3: 31.0,
    temperature: 27.8,
    humidity: 64,
    wind_speed: 14.5,
    visibility: 9.0,
    latitude: 18.5808,
    longitude: 73.9197,
    source: "Airport Authority CAAQMS",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "Alandi",
    city: "Pune",
    state: "Maharashtra",
    pm25: 23.4,
    pm10: 51.0,
    no2: 18.2,
    so2: 8.0,
    co: 0.6,
    o3: 28.5,
    temperature: 27.2,
    humidity: 65,
    wind_speed: 15.0,
    visibility: 9.8,
    latitude: 18.6775,
    longitude: 73.8967,
    source: "Alandi Rural Baseline",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "Pashan",
    city: "Pune",
    state: "Maharashtra",
    pm25: 33.0,
    pm10: 71.0,
    no2: 24.5,
    so2: 10.5,
    co: 0.8,
    o3: 33.0,
    temperature: 28.1,
    humidity: 63,
    wind_speed: 12.8,
    visibility: 8.5,
    latitude: 18.5362,
    longitude: 73.7929,
    source: "IITM Pashan CAAQMS",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "Shivajinagar",
    city: "Pune",
    state: "Maharashtra",
    pm25: 36.6,
    pm10: 79.0,
    no2: 28.0,
    so2: 12.0,
    co: 0.9,
    o3: 35.5,
    temperature: 28.6,
    humidity: 61,
    wind_speed: 12.2,
    visibility: 8.2,
    latitude: 18.5314,
    longitude: 73.8446,
    source: "Shivajinagar CPCB Hub",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "Hadapsar",
    city: "Pune",
    state: "Maharashtra",
    pm25: 40.8,
    pm10: 88.5,
    no2: 31.0,
    so2: 13.5,
    co: 1.0,
    o3: 37.0,
    temperature: 29.2,
    humidity: 60,
    wind_speed: 11.8,
    visibility: 7.8,
    latitude: 18.5089,
    longitude: 73.9260,
    source: "Hadapsar IT Corridor",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "Katraj Dairy",
    city: "Pune",
    state: "Maharashtra",
    pm25: 25.2,
    pm10: 55.0,
    no2: 19.5,
    so2: 8.8,
    co: 0.6,
    o3: 30.0,
    temperature: 27.5,
    humidity: 66,
    wind_speed: 14.0,
    visibility: 9.2,
    latitude: 18.4575,
    longitude: 73.8677,
    source: "Katraj Green CAAQMS",
    fetched_at: new Date().toISOString(),
  },
];

export const REGIONAL_STATIONS: ExtendedStation[] = [
  {
    station: "GJ-ANAND-01",
    city: "Anand",
    state: "Gujarat",
    pm25: 42.6,
    pm10: 78.4,
    no2: 21.8,
    so2: 12.3,
    co: 0.8,
    o3: 34.2,
    temperature: 29.4,
    humidity: 58,
    wind_speed: 12.5,
    visibility: 8.5,
    latitude: 22.5645,
    longitude: 72.9289,
    source: "CPCB Station",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "GJ-AHMD-03",
    city: "Ahmedabad",
    state: "Gujarat",
    pm25: 88.4,
    pm10: 164.2,
    no2: 46.1,
    so2: 19.4,
    co: 1.6,
    o3: 48.0,
    temperature: 32.1,
    humidity: 46,
    wind_speed: 9.8,
    visibility: 5.2,
    latitude: 23.0225,
    longitude: 72.5714,
    source: "CPCB GIDC",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "MH-MUMB-02",
    city: "Mumbai",
    state: "Maharashtra",
    pm25: 72.8,
    pm10: 132.0,
    no2: 41.5,
    so2: 18.2,
    co: 1.4,
    o3: 42.1,
    temperature: 30.2,
    humidity: 78,
    wind_speed: 16.4,
    visibility: 6.0,
    latitude: 19.076,
    longitude: 72.8777,
    source: "CPCB BKC",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "GJ-VADO-02",
    city: "Vadodara",
    state: "Gujarat",
    pm25: 61.5,
    pm10: 112.4,
    no2: 32.8,
    so2: 16.5,
    co: 1.2,
    o3: 38.6,
    temperature: 31.0,
    humidity: 52,
    wind_speed: 11.2,
    visibility: 6.8,
    latitude: 22.3072,
    longitude: 73.1812,
    source: "CPCB Alkapuri",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "GJ-SURT-01",
    city: "Surat",
    state: "Gujarat",
    pm25: 68.9,
    pm10: 124.6,
    no2: 36.2,
    so2: 21.0,
    co: 1.3,
    o3: 35.8,
    temperature: 30.5,
    humidity: 72,
    wind_speed: 13.8,
    visibility: 6.4,
    latitude: 21.1702,
    longitude: 72.8311,
    source: "CPCB Ring Road",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "GJ-GAND-01",
    city: "Gandhinagar",
    state: "Gujarat",
    pm25: 38.2,
    pm10: 68.0,
    no2: 18.5,
    so2: 9.8,
    co: 0.7,
    o3: 31.4,
    temperature: 31.8,
    humidity: 44,
    wind_speed: 10.4,
    visibility: 9.2,
    latitude: 23.2156,
    longitude: 72.6369,
    source: "CPCB Sector 10",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "GJ-NADI-01",
    city: "Nadiad",
    state: "Gujarat",
    pm25: 45.1,
    pm10: 82.3,
    no2: 22.4,
    so2: 11.6,
    co: 0.9,
    o3: 33.0,
    temperature: 29.8,
    humidity: 55,
    wind_speed: 11.0,
    visibility: 8.0,
    latitude: 22.6916,
    longitude: 72.8634,
    source: "CPCB College Rd",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "MH-NASH-01",
    city: "Nashik",
    state: "Maharashtra",
    pm25: 34.5,
    pm10: 62.1,
    no2: 16.2,
    so2: 8.4,
    co: 0.6,
    o3: 29.5,
    temperature: 26.2,
    humidity: 59,
    wind_speed: 12.0,
    visibility: 9.5,
    latitude: 19.9975,
    longitude: 73.7898,
    source: "CPCB Panchavati",
    fetched_at: new Date().toISOString(),
  },
  {
    station: "GJ-RAJK-01",
    city: "Rajkot",
    state: "Gujarat",
    pm25: 51.0,
    pm10: 94.2,
    no2: 24.5,
    so2: 13.0,
    co: 1.0,
    o3: 36.2,
    temperature: 32.4,
    humidity: 48,
    wind_speed: 13.1,
    visibility: 7.5,
    latitude: 22.3039,
    longitude: 70.8022,
    source: "CPCB Kalawad Rd",
    fetched_at: new Date().toISOString(),
  },
];

export const FALLBACK_STATIONS: ExtendedStation[] = [
  ...PUNE_HYPERLOCAL_STATIONS,
  ...REGIONAL_STATIONS,
];

/* ── India NAQI Breakpoint Calculation ── */
export function calculateAQI(pm25: number): number {
  if (pm25 <= 30) return Math.round((pm25 / 30) * 50);
  if (pm25 <= 60) return Math.round(50 + ((pm25 - 30) / 30) * 50);
  if (pm25 <= 90) return Math.round(100 + ((pm25 - 60) / 30) * 100);
  if (pm25 <= 120) return Math.round(200 + ((pm25 - 90) / 30) * 100);
  if (pm25 <= 250) return Math.round(300 + ((pm25 - 120) / 130) * 100);
  return Math.min(500, Math.round(400 + ((pm25 - 250) / 150) * 100));
}

export interface AQIMeta {
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  description: string;
  maskAdvice: string;
  activityAdvice: string;
  ventilationAdvice: string;
}

export function getAQIMeta(aqi: number): AQIMeta {
  if (aqi <= 50) {
    return {
      label: "Good",
      color: "#10b981",
      bg: "rgba(16, 185, 129, 0.12)",
      border: "rgba(16, 185, 129, 0.28)",
      glow: "rgba(16, 185, 129, 0.35)",
      description: "Air quality is considered satisfactory, and air pollution poses little or no risk.",
      maskAdvice: "No mask required for general population.",
      activityAdvice: "Ideal conditions for outdoor sports, cycling, and leisure.",
      ventilationAdvice: "Safe to open windows for natural room ventilation.",
    };
  }
  if (aqi <= 100) {
    return {
      label: "Moderate",
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.12)",
      border: "rgba(245, 158, 11, 0.28)",
      glow: "rgba(245, 158, 11, 0.35)",
      description: "Air quality is acceptable; moderate health concern for a very small number of sensitive individuals.",
      maskAdvice: "Optional. Unusually sensitive people should consider N95 if coughing.",
      activityAdvice: "Normal outdoor activity is fine; sensitive groups take short breaks.",
      ventilationAdvice: "Open windows during mid-day breezy hours.",
    };
  }
  if (aqi <= 200) {
    return {
      label: "Poor / Sensitive",
      color: "#f97316",
      bg: "rgba(249, 115, 22, 0.12)",
      border: "rgba(249, 115, 22, 0.28)",
      glow: "rgba(249, 115, 22, 0.35)",
      description: "Breathing discomfort to people with lung disease such as asthma, and children or older adults.",
      maskAdvice: "N95 / FFP2 recommended for long commutes or sensitive groups.",
      activityAdvice: "Reduce strenuous outdoor activities; shift workouts indoors.",
      ventilationAdvice: "Keep windows closed during morning rush hours; use air purifiers.",
    };
  }
  if (aqi <= 300) {
    return {
      label: "Unhealthy",
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.12)",
      border: "rgba(239, 68, 68, 0.28)",
      glow: "rgba(239, 68, 68, 0.35)",
      description: "Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.",
      maskAdvice: "N95 mask mandatory for all outdoor exposure.",
      activityAdvice: "Avoid prolonged outdoor exertion. Keep physical activity indoors.",
      ventilationAdvice: "Seal doors and windows; run HEPA air purifiers continuously.",
    };
  }
  if (aqi <= 400) {
    return {
      label: "Very Unhealthy",
      color: "#8b5cf6",
      bg: "rgba(139, 92, 246, 0.12)",
      border: "rgba(139, 92, 246, 0.28)",
      glow: "rgba(139, 92, 246, 0.35)",
      description: "Health alert: The risk of health effects is increased for everyone.",
      maskAdvice: "High-grade N95/N99 respirator required outdoors.",
      activityAdvice: "Children, seniors, and active adults must stay indoors.",
      ventilationAdvice: "Keep indoor air sealed. Use recirculated indoor HVAC filters.",
    };
  }
  return {
    label: "Severe / Hazardous",
    color: "#b91c1c",
    bg: "rgba(185, 28, 28, 0.14)",
    border: "rgba(185, 28, 28, 0.32)",
    glow: "rgba(185, 28, 28, 0.40)",
    description: "Emergency conditions: The entire population is more likely to be affected by serious respiratory irritation.",
    maskAdvice: "Strictly avoid going outdoors. N99 respirator mandatory if stepping out.",
    activityAdvice: "Cancel all outdoor events and rigorous exercise.",
    ventilationAdvice: "Total indoor lockdown mode. Multiple purifiers recommended.",
  };
}

export interface ForecastPoint {
  time: string;
  value: number;
  lower: number;
  upper: number;
  confidence: number;
}

export function generateForecastCurve(currentPm25: number): ForecastPoint[] {
  const steps = [
    { label: "12 AM", hourDelta: 0, mult: 1.15, conf: 0.98 },
    { label: "3 AM",  hourDelta: 3, mult: 1.05, conf: 0.95 },
    { label: "6 AM",  hourDelta: 6, mult: 0.85, conf: 0.92 },
    { label: "9 AM",  hourDelta: 9, mult: 0.92, conf: 0.89 },
    { label: "12 PM", hourDelta: 12, mult: 1.00, conf: 0.86 },
    { label: "3 PM",  hourDelta: 15, mult: 1.10, conf: 0.82 },
    { label: "6 PM",  hourDelta: 18, mult: 1.25, conf: 0.78 },
    { label: "9 PM",  hourDelta: 21, mult: 1.18, conf: 0.74 },
    { label: "12 AM", hourDelta: 24, mult: 1.08, conf: 0.70 },
  ];

  return steps.map((s) => {
    const val = Number((currentPm25 * s.mult).toFixed(1));
    const margin = Number((val * (1 - s.conf) * 1.5).toFixed(1));
    return {
      time: s.label,
      value: val,
      lower: Math.max(0, Number((val - margin).toFixed(1))),
      upper: Number((val + margin).toFixed(1)),
      confidence: Math.round(s.conf * 100),
    };
  });
}

export async function fetchLiveOrFallbackStations(): Promise<{
  stations: ExtendedStation[];
  isLiveBackend: boolean;
}> {
  try {
    const res = await fetch("/api/current", { cache: "no-store" });
    if (!res.ok) throw new Error("Backend offline");
    const data: Station[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("Empty array");

    const validStations = data.filter(
      (s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude)
    );
    if (validStations.length === 0) throw new Error("No valid coordinates");

    const merged: ExtendedStation[] = validStations.map((s) => {
      const match = FALLBACK_STATIONS.find(
        (f) => f.city.toLowerCase() === (s.city || "").toLowerCase()
      );
      return {
        ...s,
        state: match?.state || "India",
        so2: match?.so2 ?? 12.0,
        co: match?.co ?? 1.1,
        o3: match?.o3 ?? 36.0,
        temperature: match?.temperature ?? 30.0,
        humidity: match?.humidity ?? 60,
        wind_speed: match?.wind_speed ?? 12.0,
        visibility: match?.visibility ?? 7.5,
      };
    });

    return { stations: merged, isLiveBackend: true };
  } catch {
    return { stations: FALLBACK_STATIONS, isLiveBackend: false };
  }
}
