/**
 * Main chat interface component
 */

import { store } from '../state/store';
import * as api from '../api';
import { createSidebar } from './Sidebar';
import { createModelSelector } from './ModelSelector';
import { createMessageList, renderMessages, renderStreamingMessage } from './MessageList';
import { createMessageInput } from './MessageInput';
import type { ModelInfo, Message } from '../types';

let models: ModelInfo[] = [];

export async function createChatInterface(): Promise<HTMLElement> {
  const app = document.createElement('div');
  app.id = 'app';

  // Load models
  try {
    models = await api.getModels();
  } catch (error) {
    console.error('Failed to load models:', error);
    models = [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', input_cost: 0.0025, output_cost: 0.01 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', input_cost: 0.01, output_cost: 0.03 },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', input_cost: 0.0005, output_cost: 0.0015 },
    ];
  }

  // Create header
  const header = createHeader();
  app.appendChild(header);

  // Create error banner (hidden by default)
  const errorBanner = createErrorBanner();
  app.appendChild(errorBanner);

  // Create main container
  const mainContainer = document.createElement('div');
  mainContainer.className = 'main-container';

  // Create conversation panel overlay
  const overlay = document.createElement('div');
  overlay.className = 'panel-overlay';
  overlay.addEventListener('click', () => {
    store.setSidebarOpen(false);
  });

  const panel = createSidebar(
    store.getState().conversations,
    store.getState().currentConversation?.id || null,
    handleNewChat,
    () => store.setSidebarOpen(false),
    handleSelectConversation,
    handleCloneConversation,
    handleDeleteConversation
  );
  panel.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  overlay.appendChild(panel);
  mainContainer.appendChild(overlay);

  // Create chat area
  const chatArea = document.createElement('div');
  chatArea.className = 'chat-area';

  const modelSelector = createModelSelector(
    models,
    store.getState().selectedModel,
    (model) => store.setSelectedModel(model)
  );
  chatArea.appendChild(modelSelector);

  const messageList = createMessageList();
  chatArea.appendChild(messageList);

  const messageInput = createMessageInput(handleSendMessage);
  chatArea.appendChild(messageInput);

  mainContainer.appendChild(chatArea);
  app.appendChild(mainContainer);

  // Subscribe to state changes
  store.subscribe(() => {
    render(app);
  });

  // Load initial data
  await loadConversations();

  return app;
}

function createHeader(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'header';

  const menuButton = document.createElement('button');
  menuButton.className = 'menu-button';
  menuButton.innerHTML = 'SESSIONS';
  menuButton.addEventListener('click', () => {
    store.toggleSidebar();
  });

  const titleWrap = document.createElement('div');
  titleWrap.className = 'title-wrap';

  const title = document.createElement('h1');
  title.textContent = 'LLM Router';

  const subtitle = document.createElement('span');
  subtitle.className = 'title-sub';
  subtitle.textContent = 'terminal mode';

  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);

  const status = document.createElement('div');
  status.className = 'status-pill';
  status.textContent = 'LOCAL';

  const newChatButton = document.createElement('button');
  newChatButton.className = 'header-new';
  newChatButton.textContent = 'NEW';
  newChatButton.addEventListener('click', handleNewChat);

  header.appendChild(menuButton);
  header.appendChild(titleWrap);
  header.appendChild(status);
  header.appendChild(newChatButton);

  return header;
}

function createErrorBanner(): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.style.display = 'none';

  const text = document.createElement('span');
  const closeButton = document.createElement('button');
  closeButton.className = 'error-close';
  closeButton.innerHTML = '×';
  closeButton.addEventListener('click', () => {
    store.setError(null);
  });

  banner.appendChild(text);
  banner.appendChild(closeButton);

  return banner;
}

function render(app: HTMLElement): void {
  const state = store.getState();

  // Update error banner
  const errorBanner = app.querySelector('.error-banner') as HTMLElement;
  if (state.error) {
    errorBanner.style.display = 'flex';
    errorBanner.querySelector('span')!.textContent = state.error;
  } else {
    errorBanner.style.display = 'none';
  }

  // Update panel
  const panelOverlay = app.querySelector('.panel-overlay') as HTMLElement;
  const newSidebar = createSidebar(
    state.conversations,
    state.currentConversation?.id || null,
    handleNewChat,
    () => store.setSidebarOpen(false),
    handleSelectConversation,
    handleCloneConversation,
    handleDeleteConversation
  );
  newSidebar.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  if (state.sidebarOpen) {
    panelOverlay.classList.add('visible');
  } else {
    panelOverlay.classList.remove('visible');
  }
  panelOverlay.innerHTML = '';
  panelOverlay.appendChild(newSidebar);

  // Update messages
  const messageList = app.querySelector('#messages') as HTMLElement;
  renderMessages(messageList, state.messages);

  // Update input state
  const inputArea = app.querySelector('.input-area') as any;
  if (inputArea && inputArea.setDisabled) {
    inputArea.setDisabled(state.isStreaming);
  }
}

async function loadConversations(): Promise<void> {
  try {
    const conversations = await api.getConversations();
    store.setConversations(conversations);
    const lastId = localStorage.getItem('currentConversationId');
    const exists = lastId && conversations.some((conv) => conv.id === lastId);
    if (exists && (!store.getState().currentConversation || store.getState().currentConversation?.id !== lastId)) {
      const conversation = await api.getConversation(lastId as string);
      store.setCurrentConversation(conversation);
    }
  } catch (error) {
    store.setError('Failed to load conversations');
  }
}

function handleNewChat(): void {
  store.setCurrentConversation(null);
  store.setSidebarOpen(false);
}

async function handleSelectConversation(id: string): Promise<void> {
  try {
    const conversation = await api.getConversation(id);
    store.setCurrentConversation(conversation);
    store.setSidebarOpen(false);
  } catch (error) {
    store.setError('Failed to load conversation');
  }
}

async function handleDeleteConversation(id: string): Promise<void> {
  try {
    await api.deleteConversation(id);
    await loadConversations();
    if (store.getState().currentConversation?.id === id) {
      store.setCurrentConversation(null);
    }
  } catch (error) {
    store.setError('Failed to delete conversation');
  }
}

async function handleCloneConversation(id: string): Promise<void> {
  try {
    const conversation = await api.cloneConversation(id);
    await loadConversations();
    store.setCurrentConversation(conversation);
    store.setSidebarOpen(false);
  } catch (error) {
    store.setError('Failed to clone conversation');
  }
}

async function handleSendMessage(message: string): Promise<void> {
  const state = store.getState();

  // Add user message to UI
  const userMessage: Message = {
    id: `temp-${Date.now()}`,
    role: 'user',
    content: message,
    created_at: Date.now() / 1000,
  };
  store.addMessage(userMessage);

  // Create empty assistant message for streaming
  const assistantMessage: Message = {
    id: `temp-${Date.now()}-assistant`,
    role: 'assistant',
    content: '',
    created_at: Date.now() / 1000,
  };
  store.addMessage(assistantMessage);

  store.setStreaming(true);
  store.setError(null);

  let streamedContent = '';
  const messageList = document.querySelector('#messages') as HTMLElement;

  try {
    await api.streamChat(
      message,
      state.selectedModel,
      state.currentConversation?.id || null,
      (token) => {
        streamedContent += token;
        renderStreamingMessage(messageList, streamedContent);
      },
      async (data) => {
        store.setStreaming(false);
        await loadConversations();

        // Reload conversation to get updated messages
        if (data.conversation_id) {
          const conversation = await api.getConversation(data.conversation_id);
          store.setCurrentConversation(conversation);
        }
      },
      (error) => {
        store.setStreaming(false);
        store.setError(`Error: ${error}`);
      }
    );
  } catch (error) {
    store.setStreaming(false);
    store.setError(error instanceof Error ? error.message : 'Unknown error');
  }
}
