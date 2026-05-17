import { useState, useEffect } from "react";
import Module01 from "./modules/Module01.jsx";
import Module02 from "./modules/Module02.jsx";
import ModulePicker from "./ModulePicker.jsx";

// ═══════════════════════════════════════════════════════════════════
// Router.jsx — Hash-based router for the worksheet platform
//
// Routes:
//   #/             → ModulePicker (default landing)
//   #/module/1     → Module 01 (WhatsApp Webhook Monster)
//   #/module/2     → Module 02 (Parking Lot OOD)
//
// Manual hash routing instead of react-router-dom — zero new dependencies,
// works with the existing Vite + Uvicorn SPA catch-all setup.
// ═══════════════════════════════════════════════════════════════════

function getRoute() {
  const hash = window.location.hash || "#/";
  // Strip leading "#" and any leading "/"
  const path = hash.replace(/^#\/?/, "");
  if (!path || path === "") return { name: "picker" };
  const match = path.match(/^module\/(\d+)$/);
  if (match) return { name: "module", id: parseInt(match[1], 10) };
  return { name: "picker" };  // Unknown route → picker
}

function navigate(path) {
  window.location.hash = path;
}

export default function Router() {
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    const handler = () => setRoute(getRoute());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  // Render the picker by default
  if (route.name === "picker") {
    return <ModulePicker onSelect={(id) => navigate(`/module/${id}`)} />;
  }

  if (route.name === "module") {
    if (route.id === 1) return <Module01 onHome={() => navigate("/")} />;
    if (route.id === 2) return <Module02 onHome={() => navigate("/")} />;
    // Unknown module ID — fall back to picker
    return <ModulePicker onSelect={(id) => navigate(`/module/${id}`)} />;
  }

  return <ModulePicker onSelect={(id) => navigate(`/module/${id}`)} />;
}
