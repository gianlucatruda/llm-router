/**
 * TypeScript type definitions for LLM Router
 */

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  temperature?: number;
  reasoning?: string;
  status?: string;
  tokens_input?: number;
  tokens_output?: number;
  cost?: number;
  created_at: number;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  created_at: number;
  updated_at: number;
  system_prompt?: string | null;
  messages?: Message[];
}

export interface ConversationListItem {
  id: string;
  title: string;
  model: string;
  created_at: number;
  updated_at: number;
  system_prompt?: string | null;
}

export interface SystemPromptUpdateResponse {
  status: string;
  conversation_id: string;
  model: string;
  provider: string;
  system_prompt: string;
  system_prompt_length: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  input_cost: number;
  output_cost: number;
  source: string;
  pricing_source: string;
  available: boolean;
  supports_reasoning: boolean;
  reasoning_levels: string[];
  supports_temperature: boolean;
}

export interface ModelDefaults {
  model: string;
  reasoning: string;
  temperature: number;
}

export interface ModelCatalog {
  defaults: ModelDefaults;
  models: ModelInfo[];
}

export interface UsageSummary {
  total_tokens_input: number;
  total_tokens_output: number;
  total_cost: number;
  by_model: Record<string, {
    tokens_input: number;
    tokens_output: number;
    cost: number;
    requests: number;
  }>;
}

export interface VersionInfo {
  version: string;
  commit: string | null;
  commit_short: string;
}

export interface AppState {
  conversations: ConversationListItem[];
  currentConversation: Conversation | null;
  messages: Message[];
  selectedModel: string;
  temperature: number;
  reasoning: string;
  pendingSystem: string;
  historyByConversation: Record<string, string[]>;
  historyIndexByConversation: Record<string, number>;
  activeHistoryKey: string;
  usageOverall: UsageSummary | null;
  usageDevice: UsageSummary | null;
  isStreaming: boolean;
  systemUpdating: boolean;
  error: string | null;
  sidebarOpen: boolean;
}
