// Supabase Edge Function with AI SDK + Sentry AI Monitoring
// https://docs.sentry.io/platforms/javascript/guides/deno/configuration/integrations/vercelai/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as Sentry from "npm:@sentry/deno@^10.12.0";
import { generateText } from "npm:ai@^3.0.0";
import { openai } from "npm:@ai-sdk/openai@^1.0.0";

Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN"),
  debug: true,
  tracesSampleRate: 1.0,
  integrations: [
    Sentry.vercelAIIntegration({
      recordInputs: true,
      recordOutputs: true,
    }),
  ],
});

console.log("Sentry initialized with DSN:", Deno.env.get("SENTRY_DSN") ? "set" : "missing");

Deno.serve(async (req) => {
  return await Sentry.withIsolationScope(async () => {
    try {
      const { prompt } = await req.json();
      console.log("Received prompt:", prompt);

      if (!prompt) {
        console.log("No prompt provided, returning 400");
        return new Response(
          JSON.stringify({ error: "prompt is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      console.log("Calling generateText with model gpt-4o-mini");
      const result = await generateText({
        model: openai("gpt-4o-mini"),
        prompt,
        experimental_telemetry: {
          isEnabled: true,
          functionId: "ai-chat-test",
        },
      });
      console.log("generateText completed, response length:", result.text.length);

      return new Response(
        JSON.stringify({ text: result.text }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error in ai-chat function:", error);
      Sentry.captureException(error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    } finally {
      console.log("Flushing Sentry events");
      await Sentry.flush(2000);
    }
  });
});
