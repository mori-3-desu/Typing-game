// src/main.tsx
import "./index.css";

// Sentryをインポート
import * as Sentry from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";

// Sentryを初期化
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// 本番にエラーログすら送らないことで意図しないセキュリティ漏れを防ぐ
if (import.meta.env.VITE_SENTRY_DSN && import.meta.env.PROD) {
  console.error = () => {};
  console.warn = () => {};
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
