// Supabase Edge Function with AI SDK Agent + Sentry AI Monitoring
// Uses all three pillars: Tracing, Logs, and Metrics
// https://docs.sentry.io/platforms/javascript/guides/deno/configuration/integrations/vercelai/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as Sentry from "npm:@sentry/deno@^10.45.0";
import { generateText, tool, stepCountIs } from "npm:ai@^6.0.0";
import { openai } from "npm:@ai-sdk/openai@^3.0.0";
import { z } from "npm:zod@^4.1.8";

Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN"),
  debug: true,
  tracesSampleRate: 1.0, // Use 0.1–0.2 in production
  sendDefaultPii: true,
  enableLogs: true,
  integrations: [Sentry.vercelAIIntegration()],
});

const SIMULATED_USERS = [
  { id: "user-001", username: "alice", email: "alice@example.com" },
  { id: "user-002", username: "bob", email: "bob@example.com" },
  { id: "user-003", username: "charlie", email: "charlie@example.com" },
  { id: "user-004", username: "diana", email: "diana@example.com" },
  { id: "user-005", username: "eve", email: "eve@example.com" },
];

// GPT-4o-mini pricing per 1M tokens
const COST_PER_1M_INPUT = 0.15;
const COST_PER_1M_OUTPUT = 0.6;

function estimateCost(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens * COST_PER_1M_INPUT + completionTokens * COST_PER_1M_OUTPUT) /
    1_000_000
  );
}

// --- Agent Tools ---

const lookupUser = tool({
  description: "Look up a user by name in the database",
  inputSchema: z.object({ name: z.string() }),
  execute: async ({ name }) => {
    const users: Record<string, object> = {
      alice: {
        id: "u_101",
        email: "alice@acme.com",
        plan: "pro",
        signupDate: "2024-01-15",
      },
      bob: {
        id: "u_102",
        email: "bob@acme.com",
        plan: "free",
        signupDate: "2024-03-22",
      },
      charlie: {
        id: "u_103",
        email: "charlie@acme.com",
        plan: "enterprise",
        signupDate: "2023-11-01",
      },
    };
    return users[name.toLowerCase()] ?? { error: "User not found" };
  },
});

const lookupOrder = tool({
  description: "Look up recent orders for a user ID",
  inputSchema: z.object({ userId: z.string() }),
  execute: async ({ userId }) => {
    const orders: Record<string, object[]> = {
      u_101: [
        {
          orderId: "ord_501",
          product: "widget-pro",
          qty: 2,
          total: 59.98,
          status: "shipped",
        },
        {
          orderId: "ord_490",
          product: "gadget-mini",
          qty: 1,
          total: 24.99,
          status: "delivered",
        },
      ],
      u_102: [
        {
          orderId: "ord_488",
          product: "widget-basic",
          qty: 1,
          total: 19.99,
          status: "delivered",
        },
      ],
      u_103: [
        {
          orderId: "ord_510",
          product: "enterprise-suite",
          qty: 1,
          total: 999.0,
          status: "processing",
        },
      ],
    };
    return orders[userId] ?? [];
  },
});

const lookupProduct = tool({
  description: "Look up product details by product slug",
  inputSchema: z.object({ slug: z.string() }),
  execute: async ({ slug }) => {
    const products: Record<string, object> = {
      "widget-pro": {
        name: "Widget Pro",
        price: 29.99,
        category: "widgets",
        inStock: true,
      },
      "widget-basic": {
        name: "Widget Basic",
        price: 19.99,
        category: "widgets",
        inStock: true,
      },
      "gadget-mini": {
        name: "Gadget Mini",
        price: 24.99,
        category: "gadgets",
        inStock: false,
      },
      "enterprise-suite": {
        name: "Enterprise Suite",
        price: 999.0,
        category: "enterprise",
        inStock: true,
      },
    };
    return products[slug] ?? { error: "Product not found" };
  },
});

Deno.serve((req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, sentry-trace, baggage",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const sentryTrace = req.headers.get("sentry-trace") ?? "";
  const baggage = req.headers.get("baggage") ?? "";

  return Sentry.continueTrace({ sentryTrace, baggage }, () => {
    return Sentry.withIsolationScope(async () => {
      const startTime = performance.now();
      const user =
        SIMULATED_USERS[Math.floor(Math.random() * SIMULATED_USERS.length)];
      const model = "gpt-4o-mini";

      Sentry.setUser({
        id: user.id,
        username: user.username,
        email: user.email,
      });

      try {
        const { prompt } = await req.json();

        if (!prompt) {
          return new Response(JSON.stringify({ error: "prompt is required" }), {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          });
        }

        const result = await generateText({
          model: openai(model),
          system:
            "You are a helpful assistant with access to a user database, order history, and product catalog. Use the available tools to answer questions.",
          prompt,
          tools: { lookupUser, lookupOrder, lookupProduct },
          stopWhen: stepCountIs(5),
          experimental_telemetry: {
            isEnabled: true,
            functionId: "support-agent",
          },
        });

        const durationMs = performance.now() - startTime;
        const promptTokens = result.totalUsage?.inputTokens ?? 0;
        const completionTokens = result.totalUsage?.outputTokens ?? 0;
        const totalTokens = promptTokens + completionTokens;
        const cost = estimateCost(promptTokens, completionTokens);
        const finishReason = result.finishReason ?? "unknown";
        const tokenEfficiency =
          promptTokens > 0 ? completionTokens / promptTokens : 0;
        const stepCount = result.steps.length;

        const allToolCalls = result.steps.flatMap((s) => s.toolCalls ?? []);
        const attributes = { model, user_id: user.id };

        // ─── METRICS ───────────────────────────────────────────────────
        Sentry.metrics.distribution("ai.request.duration", durationMs, {
          unit: "millisecond",
          attributes,
        });
        Sentry.metrics.distribution("ai.tokens.prompt", promptTokens, {
          attributes,
        });
        Sentry.metrics.distribution("ai.tokens.completion", completionTokens, {
          attributes,
        });
        Sentry.metrics.distribution("ai.tokens.total", totalTokens, {
          attributes,
        });
        Sentry.metrics.count("ai.request.count", 1, {
          attributes: { ...attributes, finish_reason: finishReason },
        });
        Sentry.metrics.distribution("ai.cost", cost, {
          unit: "dollar",
          attributes,
        });
        Sentry.metrics.gauge("ai.tokens.efficiency", tokenEfficiency, {
          attributes,
        });
        Sentry.metrics.distribution("ai.request.steps", stepCount, {
          attributes,
        });

        // ─── LOGS ──────────────────────────────────────────────────────
        const sendDefaultPii = Sentry.getClient()?.getOptions().sendDefaultPii;
        Sentry.logger.info("ai-chat request completed", {
          user_id: user.id,
          model,
          prompt_length: prompt.length,
          response_length: result.text.length,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          duration_ms: Math.round(durationMs),
          estimated_cost: cost,
          finish_reason: finishReason,
          token_efficiency: tokenEfficiency,
          steps: stepCount,
          tool_calls_count: allToolCalls.length,
          tools_used: [...new Set(allToolCalls.map((tc) => tc.toolName))].join(
            ", ",
          ),
          tool_call_sequence: allToolCalls
            .map((tc) => tc.toolName)
            .join(" -> "),
          ...(sendDefaultPii && { prompt: prompt.slice(0, 200) }),
        });

        return new Response(
          JSON.stringify({
            text: result.text,
            steps: stepCount,
            toolCalls: allToolCalls.map((tc) => ({
              tool: tc.toolName,
              args: tc.input,
            })),
            usage: {
              promptTokens,
              completionTokens,
              totalTokens,
              estimatedCost: cost,
            },
            durationMs: Math.round(durationMs),
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      } catch (error) {
        const durationMs = performance.now() - startTime;

        Sentry.metrics.count("ai.request.error", 1, {
          attributes: {
            model,
            user_id: user.id,
            error_type: error instanceof Error ? error.name : "Unknown",
          },
        });

        Sentry.logger.error("ai-chat request failed", {
          user_id: user.id,
          model,
          prompt_length: 0,
          error_message: error instanceof Error ? error.message : String(error),
          duration_ms: Math.round(durationMs),
        });

        Sentry.captureException(error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      } finally {
        await Sentry.flush(2000);
      }
    });
  });
});
