"use client";
import { useEffect, useRef, useCallback } from "react";

interface AtmosphericGlobeProps {
  aqiColor?: string;
  aqi?: number;
  className?: string;
}

export default function AtmosphericGlobe({
  aqiColor = "#00ffa3",
  aqi = 0,
  className = "",
}: AtmosphericGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const t = timeRef.current;
    timeRef.current += 0.005;

    ctx.clearRect(0, 0, W, H);

    // ── Ambient deep glow ──
    const ambientGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.55);
    ambientGrad.addColorStop(0, `rgba(0,255,163,0.06)`);
    ambientGrad.addColorStop(0.5, `rgba(0,212,255,0.03)`);
    ambientGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, W, H);

    const R = W * 0.32;

    // ── Globe core ──
    const coreGrad = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.05, cx, cy, R);
    coreGrad.addColorStop(0, "rgba(0,255,163,0.14)");
    coreGrad.addColorStop(0.3, "rgba(0,180,120,0.08)");
    coreGrad.addColorStop(0.7, "rgba(0,100,80,0.05)");
    coreGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // ── Globe outline with glow ──
    ctx.save();
    ctx.shadowBlur = 24;
    ctx.shadowColor = "rgba(0,255,163,0.4)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,255,163,0.35)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // ── Specular highlight ──
    const specGrad = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, 0, cx - R * 0.2, cy - R * 0.25, R * 0.45);
    specGrad.addColorStop(0, "rgba(255,255,255,0.15)");
    specGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = specGrad;
    ctx.fill();

    // ── Latitude lines ──
    ctx.save();
    ctx.clip();
    for (let lat = -60; lat <= 60; lat += 20) {
      const y = cy + R * Math.sin((lat * Math.PI) / 180);
      const rLine = R * Math.cos((lat * Math.PI) / 180);
      if (rLine <= 0) continue;
      ctx.beginPath();
      ctx.ellipse(cx, y, rLine, rLine * 0.25, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,255,163,0.08)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    // Longitude lines (animated)
    for (let i = 0; i < 6; i++) {
      const angle = ((i / 6) * Math.PI * 2 + t * 0.3) % (Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * Math.abs(Math.cos(angle)), R, Math.PI / 2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,255,163,${0.04 + Math.abs(Math.cos(angle)) * 0.05})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    ctx.restore();

    // ── Atmospheric ring 1 ──
    ctx.save();
    ctx.translate(cx, cy);
    const scaleY1 = 0.25 + Math.sin(t * 0.7) * 0.02;
    ctx.scale(1, scaleY1);
    const ringR1 = R * 1.28;
    const ring1Grad = ctx.createLinearGradient(-ringR1, 0, ringR1, 0);
    ring1Grad.addColorStop(0, "rgba(0,255,163,0)");
    ring1Grad.addColorStop(0.3, "rgba(0,255,163,0.3)");
    ring1Grad.addColorStop(0.5, "rgba(0,212,255,0.5)");
    ring1Grad.addColorStop(0.7, "rgba(0,255,163,0.3)");
    ring1Grad.addColorStop(1, "rgba(0,255,163,0)");
    ctx.beginPath();
    ctx.arc(0, 0, ringR1, 0, Math.PI * 2);
    ctx.strokeStyle = ring1Grad;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(0,212,255,0.6)";
    ctx.stroke();
    ctx.restore();

    // ── Atmospheric ring 2 (tilted, slower) ──
    ctx.save();
    ctx.translate(cx, cy);
    const tilt2 = Math.sin(t * 0.4) * 0.05 + 0.18;
    ctx.scale(1, tilt2);
    const ringR2 = R * 1.55;
    ctx.beginPath();
    ctx.arc(0, 0, ringR2, 0, Math.PI * 2);
    const ring2color = aqi > 150 ? "rgba(249,115,22,0.25)" : "rgba(0,255,163,0.15)";
    ctx.strokeStyle = ring2color;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = aqi > 150 ? "rgba(249,115,22,0.4)" : "rgba(0,255,163,0.3)";
    ctx.stroke();
    ctx.restore();

    // ── Scanning arc ──
    ctx.save();
    ctx.translate(cx, cy);
    const scanAngle = t % (Math.PI * 2);
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.05, scanAngle - 0.5, scanAngle + 0.5);
    ctx.strokeStyle = `rgba(0,212,255,${0.3 + Math.sin(t * 3) * 0.1})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 16;
    ctx.shadowColor = "rgba(0,212,255,0.7)";
    ctx.stroke();
    ctx.restore();

    // ── Floating data points on globe ──
    const points = [
      { lat: 19.07, lon: 72.87, label: "MUM" }, // Mumbai
      { lat: 18.52, lon: 73.85, label: "PUN" }, // Pune
      { lat: 23.02, lon: 72.57, label: "AHM" }, // Ahmedabad
    ];
    const globeRotation = t * 0.15;
    ctx.save();
    for (const pt of points) {
      const latR = (pt.lat * Math.PI) / 180;
      const lonR = ((pt.lon - 90) * Math.PI) / 180 + globeRotation;
      const x3d = Math.cos(latR) * Math.cos(lonR);
      const y3d = Math.sin(latR);
      const z3d = Math.cos(latR) * Math.sin(lonR);
      if (z3d < -0.1) continue; // Behind globe
      const px = cx + x3d * R;
      const py = cy - y3d * R;
      const alpha = (z3d + 0.5) / 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 3 + Math.sin(t * 2 + pt.lat) * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,255,163,${alpha * 0.8})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(0,255,163,0.6)";
      ctx.fill();
      // Ping ring
      const pingR = 4 + ((t * 1.5 + pt.lon) % 1) * 12;
      const pingAlpha = alpha * (1 - ((t * 1.5 + pt.lon) % 1));
      ctx.beginPath();
      ctx.arc(px, py, pingR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,255,163,${pingAlpha * 0.4})`;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.stroke();
    }
    ctx.restore();

    // ── Particles (floating up around globe) ──
    const NPARTICLES = 14;
    for (let i = 0; i < NPARTICLES; i++) {
      const seed = i * 137.5 + 20;
      const angle = ((seed % 360) * Math.PI) / 180 + t * 0.2 * (i % 2 === 0 ? 1 : -1);
      const dist = R * (1.1 + (i % 3) * 0.18);
      const baseX = cx + Math.cos(angle) * dist;
      const baseY = cy + Math.sin(angle) * dist * 0.4;
      const offset = (t * (0.5 + (i % 4) * 0.2) + seed) % (R * 0.6);
      const px2 = baseX;
      const py2 = baseY - offset;
      const pAlpha = Math.max(0, 0.6 - offset / (R * 0.6));
      const pSize = 1 + (i % 3) * 0.7;
      ctx.beginPath();
      ctx.arc(px2, py2, pSize, 0, Math.PI * 2);
      ctx.fillStyle = i % 4 === 0
        ? `rgba(0,212,255,${pAlpha * 0.7})`
        : `rgba(0,255,163,${pAlpha * 0.6})`;
      ctx.fill();
    }

    // ── AQI color tint overlay ──
    if (aqi > 100) {
      const tintGrad = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.4);
      const r = parseInt(aqiColor.slice(1, 3), 16);
      const g = parseInt(aqiColor.slice(3, 5), 16);
      const b = parseInt(aqiColor.slice(5, 7), 16);
      const intensity = Math.min(0.15, ((aqi - 100) / 400) * 0.15);
      tintGrad.addColorStop(0, `rgba(${r},${g},${b},${intensity})`);
      tintGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = tintGrad;
      ctx.fillRect(0, 0, W, H);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [aqiColor, aqi]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeObserver = new ResizeObserver(() => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.offsetWidth;
        canvas.height = parent.offsetHeight;
      }
    });
    resizeObserver.observe(canvas.parentElement!);
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
