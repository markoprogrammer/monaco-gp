import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Suppress known Rapier WASM deprecation warning (internal to @react-three/rapier)
const origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("deprecated parameters for the initialization")) return;
  origWarn.apply(console, args);
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
