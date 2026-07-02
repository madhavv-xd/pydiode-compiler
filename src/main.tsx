import { createRoot } from "react-dom/client";
import App from "./App";

// NOTE: StrictMode is intentionally omitted — its dev double-mount would boot
// the ~10MB Pyodide runtime twice on every load.
createRoot(document.getElementById("root")!).render(<App />);
