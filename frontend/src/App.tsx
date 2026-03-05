import { useState, useCallback } from "react";
import * as Sentry from "@sentry/react";
import type { ChatResponse, HistoryEntry } from "./types";
import {
  Header,
  TestPromptBar,
  PromptInput,
  ToolChainViz,
  ResponseDisplay,
  MetricsBar,
  RequestHistory,
} from "./components";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://ahpyzgvdacfpvxnssmxt.supabase.co/functions/v1/ai-chat";

const ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "***REDACTED***";

async function sendPrompt(prompt: string): Promise<ChatResponse> {
  return Sentry.startSpan(
    { name: "ai-chat.request", op: "frontend.request" },
    async () => {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return res.json();
    }
  );
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [nextId, setNextId] = useState(1);

  const handleSend = useCallback(async () => {
    const text = prompt.trim();
    if (!text || loading) return;

    setLoading(true);
    setResponse(null);
    setError(null);

    try {
      const result = await sendPrompt(text);
      setResponse(result);
      setHistory((h) => [
        ...h,
        { id: nextId, prompt: text, response: result, error: null, timestamp: new Date() },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setHistory((h) => [
        ...h,
        { id: nextId, prompt: text, response: null, error: msg, timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
      setNextId((n) => n + 1);
      setPrompt("");
    }
  }, [prompt, loading, nextId]);

  const handleSelectPrompt = useCallback(
    (text: string) => {
      setPrompt(text);
    },
    []
  );

  const handleSelectHistory = useCallback((entry: HistoryEntry) => {
    setResponse(entry.response);
    setError(entry.error);
  }, []);

  const toolCalls = loading ? null : response ? response.toolCalls : error ? [] : null;

  return (
    <div className="app">
      <Header />
      <TestPromptBar onSelect={handleSelectPrompt} disabled={loading} />
      <PromptInput
        value={prompt}
        onChange={setPrompt}
        onSend={handleSend}
        loading={loading}
      />
      <ToolChainViz
        toolCalls={loading ? null : toolCalls}
        loading={loading}
        error={!!error}
      />
      <ResponseDisplay response={response} error={error} />
      <MetricsBar response={response} />
      <RequestHistory history={history} onSelect={handleSelectHistory} />
    </div>
  );
}
