/**
 * Main chat interface component
 */

import { store } from '../state/store';
import * as api from '../api';
import { createSidebar } from './Sidebar';
import { createModelSelector } from './ModelSelector';
import { createMessageList, renderMessages, renderStreamingMessage } from './MessageList';
import { createMessageInput } from './MessageInput';
import { getCommandHelp, getCommandSuggestions, parseCommand } from '../commands';
import type { ModelCatalog, ModelInfo, Message, UsageSummary } from '../types';

let models: ModelInfo[] = [];
let catalogDefaults: ModelCatalog['defaults'] | null = null;

export async function createChatInterface(): Promise<HTMLElement> {
  const app = document.createElement('div');
  app.id = 'app';

  // Load models
  try {
    const catalog = await api.getModelCatalog();
    models = catalog.models;
    catalogDefaults = catalog.defaults;
  } catch (error) {
    console.error('Failed to load models:', error);
    models = [
      {
        id: 'gpt-5.1',
        name: 'GPT-5.1',
        provider: 'openai',
        input_cost: 0.01,
        output_cost: 0.03,
        source: 'fallback',
        pricing_source: 'fallback',
        supports_reasoning: true,
        reasoning_levels: ['low', 'medium', 'high'],
        supports_temperature: true,
      },
    ];
    catalogDefaults = { model: 'gpt-5.1', reasoning: 'low', temperature: 0.2 };
  }

  syncDefaults();

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
    store.getState().temperature,
    store.getState().reasoning,
    handleModelChange
  );
  chatArea.appendChild(modelSelector);

  const statsPanel = createStatsPanel();
  chatArea.appendChild(statsPanel);

  const messageList = createMessageList();
  chatArea.appendChild(messageList);

  const messageInput = createMessageInput(handleSendMessage, handleCommand, getSuggestions);
  chatArea.appendChild(messageInput);

  mainContainer.appendChild(chatArea);
  app.appendChild(mainContainer);

  // Subscribe to state changes
  store.subscribe(() => {
    render(app);
  });

  // Load initial data
  await loadConversations();
  await loadUsage();

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

  // Update model selector
  const selectorContainer = app.querySelector('.model-selector-container') as HTMLElement;
  if (selectorContainer) {
    const newSelector = createModelSelector(
      models,
      state.selectedModel,
      state.temperature,
      state.reasoning,
      handleModelChange
    );
    selectorContainer.replaceWith(newSelector);
  }

  // Update stats panel
  const stats = app.querySelector('.stats-panel') as HTMLElement;
  if (stats) {
    stats.replaceWith(createStatsPanel());
  }

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

async function loadUsage(): Promise<void> {
  try {
    const [overall, device] = await Promise.all([
      api.getUsageSummary('overall'),
      api.getUsageSummary('device'),
    ]);
    store.setUsage({ overall, device });
  } catch (error) {
    store.setError('Failed to load usage stats');
  }
}

function handleNewChat(): void {
  store.setCurrentConversation(null);
  store.setSidebarOpen(false);
}

function handleModelChange(modelId: string): void {
  store.setSelectedModel(modelId);
  const selected = models.find((model) => model.id === modelId);
  if (!selected) {
    return;
  }
  if (selected.reasoning_levels.length > 0 && !selected.reasoning_levels.includes(store.getState().reasoning)) {
    store.setReasoning(selected.reasoning_levels[0]);
  }
  if (!selected.supports_temperature) {
    store.setTemperature(0.0);
  }
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
      state.temperature,
      state.reasoning,
      (token) => {
        streamedContent += token;
        renderStreamingMessage(messageList, streamedContent);
      },
      async (data) => {
        store.setStreaming(false);
        await loadConversations();
        await loadUsage();

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

function handleCommand(input: string): boolean {
  const parsed = parseCommand(input);
  if (!parsed) {
    store.setError('Unknown command. Type /help.');
    return true;
  }
  if (parsed.id === 'help') {
    addSystemMessage(getCommandHelp());
    return true;
  }
  if (parsed.id === 'model') {
    const match = findModel(parsed.arg);
    if (!match) {
      store.setError('Model not found. Try /model and autocomplete.');
      return true;
    }
    handleModelChange(match.id);
    addSystemMessage(`Model set to **${match.name}** (${match.id}).`);
    return true;
  }
  if (parsed.id === 'temp') {
    const current = models.find((model) => model.id === store.getState().selectedModel);
    if (current && !current.supports_temperature) {
      store.setError('Temperature not supported for this model.');
      return true;
    }
    const value = Number(parsed.arg);
    if (!Number.isFinite(value) || value < 0 || value > 2) {
      store.setError('Temperature must be between 0 and 2.');
      return true;
    }
    store.setTemperature(value);
    addSystemMessage(`Temperature set to **${value.toFixed(2)}**.`);
    return true;
  }
  if (parsed.id === 'reasoning') {
    const levels = getReasoningLevels();
    if (levels.length === 0) {
      store.setError('Reasoning levels not supported for this model.');
      return true;
    }
    const selected = levels.find((level) => level === parsed.arg.toLowerCase());
    if (!selected) {
      store.setError(`Reasoning must be one of: ${levels.join(', ') || 'n/a'}.`);
      return true;
    }
    store.setReasoning(selected);
    addSystemMessage(`Reasoning set to **${selected}**.`);
    return true;
  }
  return false;
}

function addSystemMessage(content: string): void {
  const systemMessage: Message = {
    id: `system-${Date.now()}`,
    role: 'system',
    content,
    created_at: Date.now() / 1000,
  };
  store.addMessage(systemMessage);
}

function findModel(query: string): ModelInfo | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;
  return (
    models.find((model) => model.id.toLowerCase() === normalized) ||
    models.find((model) => model.name.toLowerCase() === normalized) ||
    models.find((model) => model.id.toLowerCase().includes(normalized)) ||
    null
  );
}

function getReasoningLevels(): string[] {
  const current = models.find((model) => model.id === store.getState().selectedModel);
  return current?.reasoning_levels || [];
}

function getSuggestions(input: string) {
  return getCommandSuggestions(input, models, getReasoningLevels());
}

function createStatsPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'stats-panel';
  const overall = renderUsageBlock('Overall', store.getState().usageOverall);
  const device = renderUsageBlock('This device', store.getState().usageDevice);
  panel.appendChild(device);
  panel.appendChild(overall);
  return panel;
}

function renderUsageBlock(label: string, usage: UsageSummary | null): HTMLElement {
  const block = document.createElement('div');
  block.className = 'stats-block';
  const title = document.createElement('div');
  title.className = 'stats-title';
  title.textContent = label;
  const body = document.createElement('div');
  body.className = 'stats-body';
  if (!usage) {
    body.textContent = 'Loading...';
  } else {
    const tokens = (usage.total_tokens_input + usage.total_tokens_output).toLocaleString();
    body.textContent = `${tokens} tokens • $${usage.total_cost.toFixed(4)}`;
  }
  block.appendChild(title);
  block.appendChild(body);
  return block;
}

function syncDefaults(): void {
  if (!catalogDefaults) {
    return;
  }
  const state = store.getState();
  const modelExists = models.some((model) => model.id === state.selectedModel);
  if (!modelExists) {
    store.setSelectedModel(catalogDefaults.model);
  }
  if (!state.reasoning) {
    store.setReasoning(catalogDefaults.reasoning);
  }
  if (!Number.isFinite(state.temperature)) {
    store.setTemperature(catalogDefaults.temperature);
  }
  const currentModel = models.find((model) => model.id === store.getState().selectedModel);
  if (currentModel && currentModel.reasoning_levels.length > 0) {
    const currentReasoning = store.getState().reasoning;
    if (!currentModel.reasoning_levels.includes(currentReasoning)) {
      store.setReasoning(currentModel.reasoning_levels[0]);
    }
  }
}
