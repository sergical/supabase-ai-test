import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./App.css";

Sentry.init({
  dsn: "https://3f5aa75ef33e5e89e28d246907d28d90@o4505994951065600.ingest.us.sentry.io/4510982313869312",
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost:54321", "127.0.0.1:54321", "ahpyzgvdacfpvxnssmxt.supabase.co"],
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
