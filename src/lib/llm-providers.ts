export type LlmProviderId = "openai" | "anthropic" | "google" | "groq" | "ollama" | "custom";

export const LLM_PROVIDERS: {
  id: LlmProviderId;
  label: string;
  baseUrl: string;
  defaultModel: string;
  hint: string;
}[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    hint: "Works with any OpenAI chat model key",
  },
  {
    id: "anthropic",
    label: "Claude (Anthropic)",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-haiku-latest",
    hint: "Use your Anthropic API key",
  },
  {
    id: "google",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    hint: "Gemini OpenAI-compatible endpoint",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.1-8b-instant",
    hint: "Fast small open models",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    baseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "llama3.2",
    hint: "Local models — key can be ollama",
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    hint: "Any /v1 chat completions endpoint",
  },
];
