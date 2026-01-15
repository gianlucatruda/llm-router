/**
 * API client for backend communication
 */

import type { Conversation, ConversationListItem, ModelInfo, UsageSummary } from './types';

const API_BASE = '/api';

/**
 * Generic fetch wrapper with error handling
 */
async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Stream chat completion via SSE
 */
export async function streamChat(
  message: string,
  model: string,
  conversationId: string | null,
  onToken: (token: string) => void,
  onComplete: (data: { conversation_id: string; cost: number; tokens: number }) => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        model,
        conversation_id: conversationId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));

          if (data.token) {
            onToken(data.token);
          } else if (data.done) {
            onComplete({
              conversation_id: data.conversation_id,
              cost: data.cost,
              tokens: data.tokens,
            });
          } else if (data.error) {
            onError(data.error);
            return;
          }
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Get list of all conversations
 */
export async function getConversations(): Promise<ConversationListItem[]> {
  return fetchJSON<ConversationListItem[]>(`${API_BASE}/conversations`);
}

/**
 * Get a specific conversation with messages
 */
export async function getConversation(id: string): Promise<Conversation> {
  return fetchJSON<Conversation>(`${API_BASE}/conversations/${id}`);
}

/**
 * Create a new conversation
 */
export async function createConversation(title: string, model: string): Promise<Conversation> {
  return fetchJSON<Conversation>(`${API_BASE}/conversations`, {
    method: 'POST',
    body: JSON.stringify({ title, model }),
  });
}

/**
 * Delete a conversation
 */
export async function deleteConversation(id: string): Promise<void> {
  await fetchJSON(`${API_BASE}/conversations/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Clone a conversation
 */
export async function cloneConversation(id: string): Promise<Conversation> {
  return fetchJSON<Conversation>(`${API_BASE}/conversations/${id}/clone`, {
    method: 'POST',
  });
}

/**
 * Get available models
 */
export async function getModels(): Promise<ModelInfo[]> {
  return fetchJSON<ModelInfo[]>(`${API_BASE}/usage/models`);
}

/**
 * Get usage summary
 */
export async function getUsageSummary(): Promise<UsageSummary> {
  return fetchJSON<UsageSummary>(`${API_BASE}/usage/summary`);
}
