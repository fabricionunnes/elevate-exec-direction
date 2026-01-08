import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Ensure deep links work with HashRouter by moving the path into the hash.
// Example: /csat?token=... => /#/csat?token=...
if (window.location.hash === "" && window.location.pathname !== "/") {
  window.location.replace(`/#${window.location.pathname}${window.location.search}`);
}

createRoot(document.getElementById("root")!).render(<App />);
