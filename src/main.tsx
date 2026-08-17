import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";

import App from "./app/App";
import "./styles/reset.css";
import "./styles/tokens.css";
import "./styles/shell.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("LiteEdit root element was not found.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
