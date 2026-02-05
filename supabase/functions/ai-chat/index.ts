// Supabase Edge Function with AI SDK + Sentry AI Monitoring
// https://docs.sentry.io/platforms/javascript/guides/deno/configuration/integrations/vercelai/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as Sentry from "npm:@sentry/deno@^10.12.0";
import { generateText } from "npm:ai@^3.0.0";
import { openai } from "npm:@ai-sdk/openai@^1.0.0";

Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN"),
  tracesSampleRate: 1.0,
  integrations: [
    Sentry.vercelAIIntegration({
      recordInputs: true,
      recordOutputs: true,
    }),
  ],
});

Deno.serve(async (req) => {
  return await Sentry.withIsolationScope(async () => {
    try {
      const { prompt } = await req.json();

      if (!prompt) {
        return new Response(
          JSON.stringify({ error: "prompt is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const result = await generateText({
        model: openai("gpt-4o-mini"),
        prompt,
        experimental_telemetry: {
          isEnabled: true,
          functionId: "ai-chat-test",
        },
      });

      return new Response(
        JSON.stringify({ text: result.text }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      Sentry.captureException(error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  });
});
