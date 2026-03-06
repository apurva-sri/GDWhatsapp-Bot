import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css"; // Fix Issue 2 — was missing
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
