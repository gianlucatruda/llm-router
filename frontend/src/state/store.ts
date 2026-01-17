/**
 * Simple reactive state management using Proxy
 */

import type { AppState, ConversationListItem, Conversation, Message, UsageSummary } from '../types';

type Listener = () => void;

class Store {
  private state: AppState;
  private listeners: Set<Listener> = new Set();

  constructor(initialState: AppState) {
    this.state = this.createProxy(initialState);
  }

  private createProxy<T extends object>(obj: T): T {
    return new Proxy(obj, {
      set: (target: any, property: string, value: any) => {
        target[property] = value;
        this.notify();
        return true;
      },
    });
  }

  getState(): AppState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  // Actions
  setConversations(conversations: ConversationListItem[]): void {
    this.state.conversations = conversations;
    this.notify();
  }

  setCurrentConversation(conversation: Conversation | null): void {
    this.state.currentConversation = conversation;
    this.state.messages = conversation?.messages || [];
    if (conversation) {
      localStorage.setItem('currentConversationId', conversation.id);
    } else {
      localStorage.removeItem('currentConversationId');
    }
    this.notify();
  }

  addMessage(message: Message): void {
    this.state.messages = [...this.state.messages, message];
    this.notify();
  }

  appendToLastMessage(token: string): void {
    if (this.state.messages.length === 0) return;
    const lastMessage = this.state.messages[this.state.messages.length - 1];
    lastMessage.content += token;
    this.notify();
  }

  setSelectedModel(model: string): void {
    this.state.selectedModel = model;
    localStorage.setItem('selectedModel', model);
    this.notify();
  }

  setTemperature(value: number): void {
    this.state.temperature = value;
    localStorage.setItem('temperature', value.toString());
    this.notify();
  }

  setReasoning(value: string): void {
    this.state.reasoning = value;
    localStorage.setItem('reasoning', value);
    this.notify();
  }

  setUsage(usage: { overall: UsageSummary; device: UsageSummary }): void {
    this.state.usageOverall = usage.overall;
    this.state.usageDevice = usage.device;
    this.notify();
  }

  setStreaming(isStreaming: boolean): void {
    this.state.isStreaming = isStreaming;
    this.notify();
  }

  setError(error: string | null): void {
    this.state.error = error;
    this.notify();
  }

  toggleSidebar(): void {
    this.state.sidebarOpen = !this.state.sidebarOpen;
    this.notify();
  }

  setSidebarOpen(open: boolean): void {
    this.state.sidebarOpen = open;
    this.notify();
  }
}

// Initialize store with default state
const savedModel = localStorage.getItem('selectedModel') || 'gpt-5.1';
const savedTemp = Number(localStorage.getItem('temperature') || '0.2');
const savedReasoning = localStorage.getItem('reasoning') || 'low';

export const store = new Store({
  conversations: [],
  currentConversation: null,
  messages: [],
  selectedModel: savedModel,
  temperature: Number.isFinite(savedTemp) ? savedTemp : 0.2,
  reasoning: savedReasoning,
  usageOverall: null,
  usageDevice: null,
  isStreaming: false,
  error: null,
  sidebarOpen: false,
});
