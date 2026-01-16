import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Redirect non-hash deep links to hash equivalents for public routes.
// IMPORTANT: some apps (WhatsApp/Instagram) may drop URL fragments (#/...).
// Also, some in-app browsers keep an old hash around; in that case the HashRouter
// will follow the old hash (often /#/onboarding-tasks/...) and appear to "require login".
//
// To avoid that, whenever we detect a PUBLIC route in the real pathname/search,
// we force the hash to the correct public route.
const publicRoutes = [
  "/avaliacao",
  "/disc",
  "/360",
  "/nps",
  "/csat",
  "/kpi-entry",
  "/kickoff",
  "/cac-form",
  "/points",
  "/points-salesperson",
  "/hr-disc",
];

const urlSearch = new URLSearchParams(window.location.search);
const publicParam = urlSearch.get("public");

const forceHashRoute = (routePath: string, query: string) => {
  const target = `/#${routePath}${query || ""}`;
  const current = `${window.location.pathname}${window.location.hash}${window.location.search}`;
  if (!current.includes(target)) {
    window.location.replace(`${window.location.origin}${target}`);
  }
};

// Query-based public links (most robust for sharing)
if (publicParam) {
  if (publicParam === "avaliacao") {
    const cycle = urlSearch.get("cycle");
    const query = cycle ? `?cycle=${encodeURIComponent(cycle)}` : "";
    forceHashRoute("/avaliacao", query);
  } else if (publicParam === "nps") {
    const project = urlSearch.get("project");
    const query = project ? `?project=${encodeURIComponent(project)}` : window.location.search;
    forceHashRoute("/nps", query);
  } else if (publicParam === "csat") {
    // expects token=...
    forceHashRoute("/csat", window.location.search);
  } else if (publicParam === "360") {
    forceHashRoute("/360", window.location.search);
  } else if (publicParam === "disc") {
    forceHashRoute("/disc", window.location.search);
  } else if (publicParam === "hr-disc") {
    // expects token=...
    const token = urlSearch.get("token");
    if (token) {
      forceHashRoute(`/hr-disc/${encodeURIComponent(token)}`, "");
    }
  } else if (publicParam === "points") {
    // expects company=... (optional)
    forceHashRoute("/points", window.location.search);
  } else if (publicParam === "points-salesperson") {
    // expects company=... or token=...
    forceHashRoute("/points-salesperson", window.location.search);
  }
} else {
  // Path-based public links
  const matchesPublic = publicRoutes.some((route) => window.location.pathname.startsWith(route));

  if (matchesPublic) {
    // Always force hash for public routes even if an old hash exists.
    forceHashRoute(window.location.pathname, window.location.search);
  } else if (!window.location.hash) {
    // Non-public deep links without hash: keep previous behavior (only for public routes)
    // (intentionally no-op here)
  }
}

createRoot(document.getElementById("root")!).render(<App />);
