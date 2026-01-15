/**
 * TypeScript type definitions for LLM Router
 */

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
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
  messages?: Message[];
}

export interface ConversationListItem {
  id: string;
  title: string;
  model: string;
  created_at: number;
  updated_at: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  input_cost: number;
  output_cost: number;
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

export interface AppState {
  conversations: ConversationListItem[];
  currentConversation: Conversation | null;
  messages: Message[];
  selectedModel: string;
  isStreaming: boolean;
  error: string | null;
  sidebarOpen: boolean;
}
