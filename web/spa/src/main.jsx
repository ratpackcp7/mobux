// Ring buffer for window.onerror/unhandledrejection (#190, #191) — imported
// first, before anything else, so nothing that boots after it goes
// uncaptured. See lib/errorLog.js.
import "./lib/errorLog.js";

import { render } from "preact";
import { App } from "./app.jsx";
import { watchBuildHash } from "./lib/reload.js";
import "./app.css";

// Auto-reload on server update (#189) — remembers the server's build_hash
// and hard-reloads the tab when it changes. Started once for the whole app
// lifetime, independent of route.
watchBuildHash();

// Built-in client telemetry channel, same backend ES module the old
// server-rendered pages loaded as <script type="module" src="/static/telemetry.js">.
// Load it by absolute URL (mirrors themes.js in Theme.jsx) so it resolves to
// the running host in both dev (Vite proxy) and prod, and the bundler treats
// it as a genuine dynamic import rather than trying to inline it. Always on —
// no dev-mode gate.
import(
  /* @vite-ignore */ new URL("/static/telemetry.js", location.origin).href
).catch((e) => console.warn("telemetry.js load failed", e));

// The backend serves a push-only service worker at the origin root. Register
// it from the SPA entry point so every route gets the same registration and
// Chrome can see the app's active service worker when evaluating installability.
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((e) => {
    console.warn("service worker registration failed", e);
  });
}

render(<App />, document.getElementById("app"));
