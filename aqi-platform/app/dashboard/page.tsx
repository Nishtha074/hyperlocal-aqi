"use client";
import { redirect } from "next/navigation";
import { useEffect } from "react";

// /dashboard redirects to the main page
export default function DashboardPage() {
  useEffect(() => { window.location.href = "/"; }, []);
  return null;
}
