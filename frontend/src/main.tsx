import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Note: React.StrictMode is intentionally omitted. In dev it double-mounts
// components, which opens+closes our persistent WebSocket twice on startup and
// makes the Vite proxy log spurious EPIPE/ECONNRESET errors. A single stable
// connection is the correct behavior for this dashboard.
createRoot(document.getElementById("root")!).render(<App />);
