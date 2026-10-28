import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/app/globals.css";
import "./mobile.css";
import { App } from "./App";

createRoot(document.getElementById("root") as HTMLElement).render(<StrictMode><App /></StrictMode>);
