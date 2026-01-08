import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Redirect non-hash deep links to hash equivalents for public routes.
// IMPORTANT: some apps (WhatsApp/Instagram) may drop URL fragments (#/...).
// To keep links shareable, we also support a query-based redirect:
//   /?public=avaliacao&cycle=...  => /#/avaliacao?cycle=...
const publicRoutes = [
  "/avaliacao",
  "/disc",
  "/360",
  "/nps",
  "/csat",
  "/kpi-entry",
  "/kickoff",
  "/cac-form",
];

const urlSearch = new URLSearchParams(window.location.search);
const publicParam = urlSearch.get("public");

// If this is a public assessment link, ALWAYS force the hash route.
// This handles cases where a previous hash (e.g. /#/onboarding-tasks/...) is still present.
if (publicParam === "avaliacao") {
  const cycle = urlSearch.get("cycle");
  const query = cycle ? `?cycle=${encodeURIComponent(cycle)}` : "";
  const target = `/#/avaliacao${query}`;
  const current = `${window.location.pathname}${window.location.hash}${window.location.search}`;

  if (!current.includes(target)) {
    window.location.replace(`${window.location.origin}${target}`);
  }
} else if (!window.location.hash) {
  if (window.location.pathname !== "/") {
    const matchesPublic = publicRoutes.some((route) => window.location.pathname.startsWith(route));
    if (matchesPublic) {
      window.location.replace(
        `${window.location.origin}/#${window.location.pathname}${window.location.search}`
      );
    }
  }
}

createRoot(document.getElementById("root")!).render(<App />);
