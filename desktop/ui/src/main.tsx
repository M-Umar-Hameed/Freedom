import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Overlay } from "./Overlay";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);

if (window.location.hash === "#overlay") {
  root.render(
    <React.StrictMode>
      <Overlay />
    </React.StrictMode>,
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
