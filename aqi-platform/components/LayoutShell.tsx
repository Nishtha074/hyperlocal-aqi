"use client";
import Sidebar from "@/components/Sidebar";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main id="page-content" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}

