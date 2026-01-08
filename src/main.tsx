import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Redirect non-hash deep links to hash equivalents for public routes
// e.g., /avaliacao?cycle=... => /#/avaliacao?cycle=...
const publicRoutes = ["/avaliacao", "/disc", "/360", "/nps", "/csat", "/kpi-entry", "/kickoff", "/cac-form"];
if (!window.location.hash && window.location.pathname !== "/") {
  const matchesPublic = publicRoutes.some(route => window.location.pathname.startsWith(route));
  if (matchesPublic) {
    window.location.replace(`${window.location.origin}/#${window.location.pathname}${window.location.search}`);
  }
}

createRoot(document.getElementById("root")!).render(<App />);
