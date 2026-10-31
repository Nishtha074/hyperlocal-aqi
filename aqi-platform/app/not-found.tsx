import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "75vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "40px 20px",
    }}>
      <div style={{
        width: 64, height: 64,
        borderRadius: 18,
        background: "var(--bg-glass-md)",
        border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--mint)",
        marginBottom: 20,
      }}>
        <Compass size={32} />
      </div>
      <h1 style={{ fontSize: 48, fontWeight: 900, color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif" }}>
        404
      </h1>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 6 }}>
        Telemetry Coordinate Not Found
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 420, marginTop: 8, marginBottom: 28 }}>
        The atmospheric monitoring route you requested is unavailable or has been relocated.
      </p>
      <Link href="/" className="btn btn-primary" style={{ padding: "10px 22px" }}>
        <ArrowLeft size={16} /> Return to Overview
      </Link>
    </div>
  );
}

