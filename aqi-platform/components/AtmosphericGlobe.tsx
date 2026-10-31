"use client";
import { useEffect, useRef, useCallback } from "react";

interface AtmosphericGlobeProps {
  aqiColor?: string;
  aqi?: number;
  className?: string;
}

function parseHexOrRgb(colorStr: string, fallback: [number, number, number]): [number, number, number] {
  if (!colorStr) return fallback;
  const s = colorStr.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
    const n = parseInt(hex, 16);
    if (!isNaN(n)) {
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
  }
  const rgb = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) return [parseInt(rgb[1]), parseInt(rgb[2]), parseInt(rgb[3])];
  return fallback;
}

export default function AtmosphericGlobe({
  aqiColor = "#8b5cf6",
  aqi = 0,
  className = "",
}: AtmosphericGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);
  const themeColorsRef = useRef<{ c1: [number, number, number]; c2: [number, number, number] }>({
    c1: [139, 92, 246], // default violet
    c2: [0, 245, 255],   // default cyan
  });

  useEffect(() => {
    const updateColors = () => {
      if (typeof window === "undefined") return;
      const cs = getComputedStyle(document.documentElement);
      const mint = cs.getPropertyValue("--mint").trim();
      const cyan = cs.getPropertyValue("--cyan").trim();
      themeColorsRef.current = {
        c1: parseHexOrRgb(mint, [139, 92, 246]),
        c2: parseHexOrRgb(cyan, [0, 245, 255]),
      };
    };
    updateColors();
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

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

    const [r1, g1, b1] = themeColorsRef.current.c1;
    const [r2, g2, b2] = themeColorsRef.current.c2;

    ctx.clearRect(0, 0, W, H);

    // ── Ambient deep glow ──
    const ambientGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.55);
    ambientGrad.addColorStop(0, `rgba(${r1},${g1},${b1},0.08)`);
    ambientGrad.addColorStop(0.5, `rgba(${r2},${g2},${b2},0.04)`);
    ambientGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, W, H);

    const R = W * 0.32;

    // ── Globe core ──
    const coreGrad = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.05, cx, cy, R);
    coreGrad.addColorStop(0, `rgba(${r1},${g1},${b1},0.18)`);
    coreGrad.addColorStop(0.3, `rgba(${r1},${g1},${b1},0.10)`);
    coreGrad.addColorStop(0.7, `rgba(${r2},${g2},${b2},0.05)`);
    coreGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // ── Globe outline with glow ──
    ctx.save();
    ctx.shadowBlur = 24;
    ctx.shadowColor = `rgba(${r1},${g1},${b1},0.5)`;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r1},${g1},${b1},0.45)`;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    // ── Specular highlight ──
    const specGrad = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, 0, cx - R * 0.2, cy - R * 0.25, R * 0.45);
    specGrad.addColorStop(0, "rgba(255,255,255,0.22)");
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
      ctx.strokeStyle = `rgba(${r1},${g1},${b1},0.12)`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    // Longitude lines (animated)
    for (let i = 0; i < 6; i++) {
      const angle = ((i / 6) * Math.PI * 2 + t * 0.3) % (Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * Math.abs(Math.cos(angle)), R, Math.PI / 2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r1},${g1},${b1},${0.05 + Math.abs(Math.cos(angle)) * 0.08})`;
      ctx.lineWidth = 0.7;
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
    ring1Grad.addColorStop(0, `rgba(${r1},${g1},${b1},0)`);
    ring1Grad.addColorStop(0.3, `rgba(${r1},${g1},${b1},0.35)`);
    ring1Grad.addColorStop(0.5, `rgba(${r2},${g2},${b2},0.55)`);
    ring1Grad.addColorStop(0.7, `rgba(${r1},${g1},${b1},0.35)`);
    ring1Grad.addColorStop(1, `rgba(${r1},${g1},${b1},0)`);
    ctx.beginPath();
    ctx.arc(0, 0, ringR1, 0, Math.PI * 2);
    ctx.strokeStyle = ring1Grad;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 14;
    ctx.shadowColor = `rgba(${r2},${g2},${b2},0.65)`;
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
    const ring2color = aqi > 150 ? "rgba(249,115,22,0.3)" : `rgba(${r2},${g2},${b2},0.2)`;
    ctx.strokeStyle = ring2color;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 9;
    ctx.shadowColor = aqi > 150 ? "rgba(249,115,22,0.4)" : `rgba(${r2},${g2},${b2},0.35)`;
    ctx.stroke();
    ctx.restore();

    // ── Scanning arc ──
    ctx.save();
    ctx.translate(cx, cy);
    const scanAngle = t % (Math.PI * 2);
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.05, scanAngle - 0.5, scanAngle + 0.5);
    ctx.strokeStyle = `rgba(${r2},${g2},${b2},${0.35 + Math.sin(t * 3) * 0.12})`;
    ctx.lineWidth = 2.2;
    ctx.shadowBlur = 18;
    ctx.shadowColor = `rgba(${r2},${g2},${b2},0.8)`;
    ctx.stroke();
    ctx.restore();

    // ── Floating data points on globe ──
    const points = [
      { lat: 19.07, lon: 72.87, label: "MUM" }, // Mumbai
      { lat: 18.52, lon: 73.85, label: "PUN" }, // Pune
      { lat: 23.02, lon: 72.57, label: "AHM" }, // Ahmedabad
      { lat: 22.56, lon: 72.92, label: "AND" }, // Anand
      { lat: 21.17, lon: 72.83, label: "SUR" }, // Surat
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
      ctx.arc(px, py, 3.2 + Math.sin(t * 2 + pt.lat) * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r1},${g1},${b1},${alpha * 0.9})`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = `rgba(${r1},${g1},${b1},0.8)`;
      ctx.fill();
      // Ping ring
      const pingR = 4 + ((t * 1.5 + pt.lon) % 1) * 14;
      const pingAlpha = alpha * (1 - ((t * 1.5 + pt.lon) % 1));
      ctx.beginPath();
      ctx.arc(px, py, pingR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r2},${g2},${b2},${pingAlpha * 0.5})`;
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 0;
      ctx.stroke();
    }
    ctx.restore();

    // ── Particles (floating up around globe) ──
    const NPARTICLES = 16;
    for (let i = 0; i < NPARTICLES; i++) {
      const seed = i * 137.5 + 20;
      const angle = ((seed % 360) * Math.PI) / 180 + t * 0.2 * (i % 2 === 0 ? 1 : -1);
      const dist = R * (1.1 + (i % 3) * 0.18);
      const baseX = cx + Math.cos(angle) * dist;
      const baseY = cy + Math.sin(angle) * dist * 0.4;
      const offset = (t * (0.5 + (i % 4) * 0.2) + seed) % (R * 0.6);
      const px2 = baseX;
      const py2 = baseY - offset;
      const pAlpha = Math.max(0, 0.65 - offset / (R * 0.6));
      const pSize = 1.2 + (i % 3) * 0.7;
      ctx.beginPath();
      ctx.arc(px2, py2, pSize, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0
        ? `rgba(${r2},${g2},${b2},${pAlpha * 0.75})`
        : `rgba(${r1},${g1},${b1},${pAlpha * 0.75})`;
      ctx.fill();
    }

    // ── AQI color tint overlay ──
    if (aqi > 100) {
      const tintGrad = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.4);
      const aqiRgb = parseHexOrRgb(aqiColor, [239, 68, 68]);
      const intensity = Math.min(0.18, ((aqi - 100) / 400) * 0.18);
      tintGrad.addColorStop(0, `rgba(${aqiRgb[0]},${aqiRgb[1]},${aqiRgb[2]},${intensity})`);
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