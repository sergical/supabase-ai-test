# Supabase Edge Function + Vercel AI SDK + Sentry AI Monitoring

Example Supabase Edge Function using the Vercel AI SDK with Sentry AI monitoring.

## Setup

1. Install Supabase CLI and login:
   ```bash
   supabase login
   ```

2. Link to your project:
   ```bash
   supabase link --project-ref <your-project-ref>
   ```

3. Set secrets:
   ```bash
   supabase secrets set OPENAI_API_KEY="sk-..."
   supabase secrets set SENTRY_DSN="https://..."
   ```

4. Deploy:
   ```bash
   supabase functions deploy ai-chat
   ```

## Local Development

1. Copy `.env.example` to `.env.local` and fill in your keys
2. Run: `supabase functions serve --env-file .env.local`
3. Test:
   ```bash
   curl -X POST http://localhost:54321/functions/v1/ai-chat \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Hello!"}'
   ```

## Key Integration Points

- `@sentry/deno` with `vercelAIIntegration()` for AI monitoring
- `experimental_telemetry: { isEnabled: true }` on AI SDK calls
- `Sentry.withIsolationScope()` for request isolation in concurrent environments

## References

- [Sentry Vercel AI Integration](https://docs.sentry.io/platforms/javascript/guides/deno/configuration/integrations/vercelai/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Vercel AI SDK](https://sdk.vercel.ai/)
