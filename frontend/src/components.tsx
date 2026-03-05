import { useRef, useEffect } from "react";
import type { ChatResponse, ToolCall, HistoryEntry, TestPrompt } from "./types";

// ─── Data ──────────────────────────────────────────────────────────────

const TEST_PROMPTS: TestPrompt[] = [
  { label: "Simple Math", prompt: "What is 2 + 2?", category: "simple" },
  { label: "User Lookup", prompt: "What plan is Alice on?", category: "lookup" },
  {
    label: "Order + Stock",
    prompt:
      "What did Alice order recently, and are those products still in stock?",
    category: "chain",
  },
  {
    label: "Error Case",
    prompt: "Look up the order history for a user named Zara",
    category: "error",
  },
  {
    label: "Compare Users",
    prompt:
      "Compare the orders of Alice and Bob. Who spent more, and what did they buy?",
    category: "complex",
  },
];

const TOOL_COLORS: Record<string, string> = {
  lookupUser: "lookupUser",
  lookupOrder: "lookupOrder",
  lookupProduct: "lookupProduct",
};

// ─── Header ────────────────────────────────────────────────────────────

export function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-dot" />
        <h1 className="header-title">AI Agent Observatory</h1>
      </div>
      <div className="header-badges">
        <span className="header-badge">Supabase</span>
        <span className="header-badge">Sentry</span>
      </div>
    </header>
  );
}

// ─── Test Prompt Bar ───────────────────────────────────────────────────

export function TestPromptBar({
  onSelect,
  disabled,
}: {
  onSelect: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="prompt-bar">
      {TEST_PROMPTS.map((tp) => (
        <button
          key={tp.label}
          className="prompt-pill"
          data-category={tp.category}
          onClick={() => onSelect(tp.prompt)}
          disabled={disabled}
        >
          {tp.label}
        </button>
      ))}
    </div>
  );
}

// ─── Prompt Input ──────────────────────────────────────────────────────

export function PromptInput({
  value,
  onChange,
  onSend,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  loading: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !loading) onSend();
    }
  };

  return (
    <div className="input-wrapper">
      <label className="input-label">Prompt</label>
      <div className="input-box">
        <textarea
          ref={textareaRef}
          className="input-textarea"
          placeholder="Ask the agent something..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading}
        />
        <button
          className="send-button"
          onClick={onSend}
          disabled={!value.trim() || loading}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

// ─── Tool Chain Visualization ──────────────────────────────────────────

function ToolNode({ label, variant }: { label: string; variant: string }) {
  return (
    <div className={`tool-node tool-node--${variant}`}>
      <span className="tool-node-dot" />
      {label}
    </div>
  );
}

function Connector() {
  return (
    <div className="tool-connector">
      <span className="tool-connector-line" />
      <span className="tool-connector-arrow" />
    </div>
  );
}

export function ToolChainViz({
  toolCalls,
  loading,
  error,
}: {
  toolCalls: ToolCall[] | null;
  loading: boolean;
  error: boolean;
}) {
  const hasTools = toolCalls && toolCalls.length > 0;

  return (
    <div className="tool-chain">
      <div className="tool-chain-label">Agent Trace</div>
      <div className="tool-chain-pipeline">
        {loading && (
          <>
            <ToolNode label="Prompt" variant="prompt" />
            <Connector />
            <ToolNode label="Processing..." variant="loading" />
          </>
        )}
        {!loading && toolCalls !== null && (
          <>
            <ToolNode label="Prompt" variant="prompt" />
            {hasTools ? (
              toolCalls.map((tc, i) => (
                <span key={i} style={{ display: "contents" }}>
                  <Connector />
                  <ToolNode
                    label={tc.tool}
                    variant={TOOL_COLORS[tc.tool] ?? "prompt"}
                  />
                </span>
              ))
            ) : (
              <>
                <Connector />
                <span className="tool-chain-direct">direct</span>
              </>
            )}
            <Connector />
            <ToolNode
              label="Response"
              variant={error ? "error" : "response"}
            />
          </>
        )}
        {!loading && toolCalls === null && (
          <div className="tool-chain-empty">
            Send a prompt to see the agent trace
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Response Display ──────────────────────────────────────────────────

export function ResponseDisplay({
  response,
  error,
}: {
  response: ChatResponse | null;
  error: string | null;
}) {
  if (!response && !error) return null;

  return (
    <div className={`response-card ${error ? "response-card--error" : ""}`}>
      <div className="response-label">Response</div>
      {error ? (
        <div className="response-error">{error}</div>
      ) : (
        <div className="response-text">{response!.text}</div>
      )}
    </div>
  );
}

// ─── Metrics Bar ───────────────────────────────────────────────────────

export function MetricsBar({ response }: { response: ChatResponse | null }) {
  if (!response) return null;

  const metrics = [
    { label: "Steps", value: response.steps.toString() },
    { label: "Tools", value: response.toolCalls.length.toString() },
    { label: "Tokens", value: response.usage.totalTokens.toLocaleString() },
    { label: "Cost", value: `$${response.usage.estimatedCost.toFixed(4)}` },
    { label: "Time", value: `${(response.durationMs / 1000).toFixed(1)}s` },
  ];

  return (
    <div className="metrics-bar">
      {metrics.map((m) => (
        <div key={m.label} className="metric-card">
          <div className="metric-label">{m.label}</div>
          <div className="metric-value">{m.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Request History ───────────────────────────────────────────────────

export function RequestHistory({
  history,
  onSelect,
}: {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
}) {
  return (
    <div className="history">
      <div className="history-label">Request History</div>
      <div className="history-list">
        {history.length === 0 ? (
          <div className="history-empty">No requests yet</div>
        ) : (
          [...history].reverse().map((entry) => (
            <div
              key={entry.id}
              className={`history-item ${entry.error ? "history-item--error" : ""}`}
              onClick={() => onSelect(entry)}
            >
              <span className="history-number">#{entry.id}</span>
              <span className="history-prompt">
                {entry.prompt}
              </span>
              <span className="history-tools">
                {entry.response
                  ? `${entry.response.toolCalls.length} tool${entry.response.toolCalls.length !== 1 ? "s" : ""}`
                  : "\u2014"}
              </span>
              <span className="history-duration">
                {entry.response
                  ? `${(entry.response.durationMs / 1000).toFixed(1)}s`
                  : "\u2014"}
              </span>
              <span
                className={`history-status ${entry.error ? "history-status--error" : "history-status--success"}`}
              >
                {entry.error ? "\u2717" : "\u2713"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
