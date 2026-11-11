import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { applyTheme, getTheme } from "./lib/theme";
import { BRAND } from "./brand";

applyTheme(getTheme());
document.title = `${BRAND} · Planning poker`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
