import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Redirect non-hash deep links to hash equivalents for public routes.
// IMPORTANT: some apps (WhatsApp/Instagram) may drop URL fragments (#/...).
// To keep links shareable, we also support a query-based redirect:
//   /?public=avaliacao&cycle=...  => /#/avaliacao?cycle=...
const publicRoutes = ["/avaliacao", "/disc", "/360", "/nps", "/csat", "/kpi-entry", "/kickoff", "/cac-form"];
const publicParam = new URLSearchParams(window.location.search).get("public");

if (!window.location.hash) {
  if (publicParam === "avaliacao") {
    const cycle = new URLSearchParams(window.location.search).get("cycle");
    const query = cycle ? `?cycle=${encodeURIComponent(cycle)}` : "";
    window.location.replace(`${window.location.origin}/#/avaliacao${query}`);
  } else if (window.location.pathname !== "/") {
    const matchesPublic = publicRoutes.some(route => window.location.pathname.startsWith(route));
    if (matchesPublic) {
      window.location.replace(`${window.location.origin}/#${window.location.pathname}${window.location.search}`);
    }
  }
}

createRoot(document.getElementById("root")!).render(<App />);
