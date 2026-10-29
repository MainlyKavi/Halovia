import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/app/globals.css";
import "./mobile.css";
import { App } from "./App";

// Development only (stripped from builds): open with ?simulateOffline=1 to make
// every fetch from the page fail and exercise the offline map/route fallbacks.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("simulateOffline")) {
  window.fetch = () => Promise.reject(new TypeError("Simulated offline (dev flag)"));
}

createRoot(document.getElementById("root") as HTMLElement).render(<StrictMode><App /></StrictMode>);
