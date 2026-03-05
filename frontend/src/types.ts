export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface ChatResponse {
  text: string;
  steps: number;
  toolCalls: ToolCall[];
  usage: Usage;
  durationMs: number;
}

export interface HistoryEntry {
  id: number;
  prompt: string;
  response: ChatResponse | null;
  error: string | null;
  timestamp: Date;
}

export interface TestPrompt {
  label: string;
  prompt: string;
  category: "simple" | "lookup" | "chain" | "error" | "complex";
}
