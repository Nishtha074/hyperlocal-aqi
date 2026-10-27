import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";

export const metadata: Metadata = {
  title: "AirPulse — Real-Time Air Quality Monitoring & Forecasting",
  description: "Real-time air quality monitoring, deep learning PM2.5 forecasting, and personalized public health advisories.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}

