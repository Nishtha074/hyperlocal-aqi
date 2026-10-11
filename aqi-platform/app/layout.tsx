import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "./professional.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AirPulse — Hyperlocal AQI Intelligence & ML Forecasting",
  description: "Next-Generation Air Quality Platform with Live Geospatial Telemetry, XGBoost Forecasting, and AI Health Risk Engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Sidebar />
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
