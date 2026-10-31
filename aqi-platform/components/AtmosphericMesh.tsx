"use client";

import { useEffect, useRef } from "react";

export default function AtmosphericMesh() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Subtle micro dust speckles
    const dustCount = 30;
    const dust = Array.from({ length: dustCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.4 + 0.5,
      alpha: Math.random() * 0.4 + 0.1,
      dAlpha: (Math.random() * 0.005 + 0.002) * (Math.random() > 0.5 ? 1 : -1),
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Micro speckles with gentle fading
      for (const d of dust) {
        d.alpha += d.dAlpha;
        if (d.alpha > 0.45) { d.alpha = 0.45; d.dAlpha = -d.dAlpha; }
        if (d.alpha < 0.08) { d.alpha = 0.08; d.dAlpha = -d.dAlpha; }

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148, 163, 184, ${d.alpha * 0.4})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {/* Dynamic Animated Ambient Mesh Orbs with Soft Diffusion */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "25%",
          width: "50vw",
          height: "50vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, var(--mesh-orb1, rgba(186, 230, 253, 0.45)) 0%, transparent 68%)",
          filter: "blur(90px)",
          animation: "meshFloat1 20s ease-in-out infinite alternate",
          transformOrigin: "center",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "35%",
          right: "-8%",
          width: "48vw",
          height: "48vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, var(--mesh-orb2, rgba(221, 214, 254, 0.35)) 0%, transparent 68%)",
          filter: "blur(110px)",
          animation: "meshFloat2 24s ease-in-out infinite alternate",
          transformOrigin: "center",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-15%",
          left: "5%",
          width: "44vw",
          height: "44vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, var(--mesh-orb3, rgba(254, 215, 170, 0.28)) 0%, transparent 68%)",
          filter: "blur(100px)",
          animation: "meshFloat3 18s ease-in-out infinite alternate",
          transformOrigin: "center",
        }}
      />

      {/* Subtle Digital Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(rgba(148, 163, 184, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          opacity: 0.8,
        }}
      />

      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}