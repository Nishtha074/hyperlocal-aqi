"use client"
import React, { useEffect, useState, use } from "react"
import { ArrowRight, RefreshCw, AlertTriangle } from "lucide-react"
import dynamic from "next/dynamic"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { calculateAQI, getAQIMeta } from "@/lib/dataService"

const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: "rgba(5,18,12,0.95)", border: "1px solid rgba(0,255,163,0.2)",
      borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,255,163,0.6)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
          <div style={{ width: 7, height: 7, borderRadius: 2, background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
          <span style={{ fontSize: 12, color: "rgba(223,242,233,0.7)", fontWeight: 600 }}>{p.name}:</span>
          <strong style={{ fontSize: 12.5, color: p.color }}>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  )
}

export default function ForecastPage({ params }: { params: Promise<{ station: string }> }) {
  const { station } = use(params)
  const [forecast, setForecast] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/forecast/${encodeURIComponent(station)}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data?.forecast) {
        const pts = [
          { time: "Now", pm25: data.current_pm25 },
          { time: "+1h", pm25: data.forecast["1h"]?.value, lower: data.forecast["1h"]?.range?.[0], upper: data.forecast["1h"]?.range?.[1], isForecast: true },
          { time: "+3h", pm25: data.forecast["3h"]?.value, lower: data.forecast["3h"]?.range?.[0], upper: data.forecast["3h"]?.range?.[1], isForecast: true },
          { time: "+6h", pm25: data.forecast["6h"]?.value, lower: data.forecast["6h"]?.range?.[0], upper: data.forecast["6h"]?.range?.[1], isForecast: true },
        ].filter(p => p.pm25 != null)
        setForecast(pts)
      } else {
        setForecast([])
      }
    } catch {
      setError("Failed to load forecast data.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [station])

  return (
    <div className="page-body">
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 className="section-title" style={{ margin: 0 }}>Forecast for {station}</h1>
        <button onClick={load} className="btn btn-ghost" disabled={loading} style={{ padding: "5px 12px" }}>
          <RefreshCw size={12} className={loading ? "spin" : ""} aria-hidden="true" />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {error && (
        <div role="alert" style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
          borderLeft: "3px solid #ef4444", borderRadius: 12, padding: "14px 18px", marginBottom: 24,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <AlertTriangle size={16} color="#ef4444" aria-hidden="true" />
          <p style={{ fontSize: 13, color: "rgba(239,68,68,0.9)", fontWeight: 500 }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
      ) : forecast.length > 0 ? (
        <div className="glass-card" style={{ padding: "20px" }}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={forecast} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="forecast-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ffa3" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00ffa3" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,163,0.05)" vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "rgba(120,170,140,0.5)", fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "rgba(120,170,140,0.5)", fontSize: 10 }} width={32} />
              <Tooltip content={<DarkTooltip />} />
              <Area type="monotone" dataKey="pm25" name="PM2.5" stroke="#00ffa3" strokeWidth={2.2}
                fill="url(#forecast-grad)"
                dot={(props: any) => {
                  const { cx, cy, payload } = props
                  return <circle cx={cx} cy={cy} r={3.5}
                    fill={payload.isForecast ? "#00d4ff" : "#00ffa3"}
                    stroke="rgba(2,10,6,0.8)" strokeWidth={1.5} />
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No forecast data available.</p>
      )}
    </div>
  )
}
