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
import type { ModelCatalog, ModelInfo, Message, VersionInfo } from '../types';

let models: ModelInfo[] = [];
let catalogDefaults: ModelCatalog['defaults'] | null = null;
let pollTimer: number | null = null;
let versionInfo: VersionInfo | null = null;

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
        available: true,
        supports_reasoning: true,
        reasoning_levels: ['low', 'medium', 'high'],
        supports_temperature: true,
      },
    ];
    catalogDefaults = { model: 'gpt-5.1', reasoning: 'low', temperature: 0.2 };
  }

  syncDefaults();

  try {
    versionInfo = await api.getVersion();
  } catch (error) {
    versionInfo = null;
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
    store.getState().temperature,
    store.getState().reasoning,
    store.getState().usageDevice,
    store.getState().usageOverall,
    openCommandInput
  );
  chatArea.appendChild(modelSelector);

  const messageList = createMessageList();
  chatArea.appendChild(messageList);

  const messageInput = createMessageInput(
    handleSendMessage,
    handleCommand,
    getSuggestions,
    (direction) => store.navigateHistory(direction)
  );
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
  checkPendingPoll();
  updateVersionLabel(app);

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

  const version = document.createElement('span');
  version.className = 'title-version';
  version.textContent = buildVersionLabel();

  const subtitle = document.createElement('span');
  subtitle.className = 'title-sub';
  subtitle.textContent = 'terminal mode';

  titleWrap.appendChild(title);
  titleWrap.appendChild(version);
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
  updateVersionLabel(app);

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
      state.usageDevice,
      state.usageOverall,
      openCommandInput
    );
    selectorContainer.replaceWith(newSelector);
  }

  // Update messages
  const messageList = app.querySelector('#messages') as HTMLElement;
  renderMessages(messageList, state.messages);

  // Update input state
  const inputArea = app.querySelector('.input-area') as any;
  if (inputArea && inputArea.setDisabled) {
    inputArea.setDisabled(state.isStreaming || state.systemUpdating);
  }
}

function buildVersionLabel(): string {
  if (!versionInfo) {
    return 'v0.2 alpha';
  }
  const commit = versionInfo.commit_short || 'dev';
  return `v${versionInfo.version} alpha • ${commit}`;
}

function updateVersionLabel(app: HTMLElement): void {
  const version = app.querySelector('.title-version');
  if (!version) return;
  version.textContent = buildVersionLabel();
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
  if (catalogDefaults) {
    store.setSelectedModel(catalogDefaults.model);
    store.setReasoning(catalogDefaults.reasoning);
    store.setTemperature(catalogDefaults.temperature);
  }
}

function handleModelChange(modelId: string): void {
  store.setSelectedModel(modelId);
  const selected = models.find((model) => model.id === modelId);
  if (!selected) {
    return;
  }
  if (!selected.available) {
    store.setError('Model availability is unverified for this API key.');
  } else {
    store.setError(null);
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
    checkPendingPoll();
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
  const model = getActiveModel();
  const effectiveTemp = model && !model.supports_temperature ? null : state.temperature;
  const effectiveReasoning =
    model && model.reasoning_levels.length > 0 ? state.reasoning : '';
  const shouldStream = navigator.onLine && document.visibilityState === 'visible';
  const messageList = document.querySelector('#messages') as HTMLElement | null;

  // Add user message to UI
  const userMessage: Message = {
    id: `temp-${Date.now()}`,
    role: 'user',
    content: message,
    created_at: Date.now() / 1000,
  };
  store.addHistory(message);
  store.addMessage(userMessage);

  if (shouldStream) {
    const assistantMessage: Message = {
      id: `temp-${Date.now()}-assistant`,
      role: 'assistant',
      content: '',
      model: state.selectedModel,
      temperature: effectiveTemp ?? undefined,
      reasoning: effectiveReasoning || undefined,
      status: 'streaming',
      created_at: Date.now() / 1000,
    };
    store.addMessage(assistantMessage);

    store.setStreaming(true);
    store.setError(null);
    let streamed = '';

    await api.streamChat(
      message,
      state.selectedModel,
      state.currentConversation?.id || null,
      effectiveTemp,
      effectiveReasoning,
      state.pendingSystem || null,
      (token) => {
        streamed += token;
        if (messageList) {
          renderStreamingMessage(
            messageList,
            streamed,
            buildStreamingMeta(state.selectedModel, effectiveTemp, effectiveReasoning)
          );
        }
      },
      async (data) => {
        await loadConversations();
        const conversation = await api.getConversation(data.conversation_id);
        store.setCurrentConversation(conversation);
        store.setStreaming(false);
        await loadUsage();
      },
      (error) => {
        store.setStreaming(false);
        store.setError(error);
        const errorContent = `${streamed}\n\nError: ${error}`;
        store.setLastMessageStatus('error', errorContent);
        if (messageList) {
          renderStreamingMessage(
            messageList,
            errorContent,
            buildErrorMeta(state.selectedModel, effectiveTemp, effectiveReasoning)
          );
        }
      }
    );
    store.clearSystemText();
    return;
  }

  // Create pending assistant message
  const assistantMessage: Message = {
    id: `temp-${Date.now()}-assistant`,
    role: 'assistant',
    content: 'Queued...',
    model: state.selectedModel,
    temperature: effectiveTemp ?? undefined,
    reasoning: effectiveReasoning || undefined,
    status: 'pending',
    created_at: Date.now() / 1000,
  };
  store.addMessage(assistantMessage);

  store.setStreaming(true);
  store.setError(null);

  try {
    const response = await api.submitChat(
      message,
      state.selectedModel,
      state.currentConversation?.id || null,
      effectiveTemp,
      effectiveReasoning,
      state.pendingSystem || null
    );
    store.clearSystemText();
    await loadConversations();
    const conversation = await api.getConversation(response.conversation_id);
    store.setCurrentConversation(conversation);
    startPolling(response.conversation_id);
  } catch (error) {
    store.setStreaming(false);
    store.setError(error instanceof Error ? error.message : 'Unknown error');
  }
}

function handleCommand(input: string): boolean {
  store.addHistory(input);
  const parsed = parseCommand(input);
  if (!parsed) {
    store.setError('Unknown command. Type /help.');
    return true;
  }
  if (parsed.id === 'help') {
    addSystemMessage(getCommandHelp());
    store.setError(null);
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
    store.setError(null);
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
    store.setError(null);
    return true;
  }
  if (parsed.id === 'system') {
    const systemText = parsed.arg.trim();
    if (!systemText) {
      store.setError('System text cannot be empty.');
      return true;
    }
    const conversationId = store.getState().currentConversation?.id || null;
    if (conversationId) {
      store.setError(null);
      store.setSystemUpdating(true);
      void api
        .appendSystemText(conversationId, systemText)
        .then((response) => {
          addSystemMessage(
            buildSystemConfirmation(
              systemText,
              true,
              response.model || store.getState().selectedModel,
              response.provider,
              response.system_prompt_length,
              {
                title: store.getState().currentConversation?.title || 'this conversation',
              }
            )
          );
        })
        .catch((error) => {
          store.setError(error instanceof Error ? error.message : 'Failed to update system text.');
        })
        .finally(() => {
          store.setSystemUpdating(false);
        });
      return true;
    }
    store.appendSystemText(systemText);
    addSystemMessage(
      buildSystemConfirmation(
        systemText,
        false,
        store.getState().selectedModel,
        null,
        null,
        {
          title: 'next message',
        }
      )
    );
    store.setError(null);
    return true;
  }
  if (parsed.id === 'image') {
    void handleImageCommand(parsed.arg);
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

function buildSystemConfirmation(
  text: string,
  persisted: boolean,
  modelId: string,
  provider: string | null,
  totalLength: number | null,
  scope: { title: string }
): string {
  const header = persisted
    ? `System text appended for ${scope.title}:`
    : `System text queued for ${scope.title}:`;
  const providerLabel = provider ? `${provider.charAt(0).toUpperCase()}${provider.slice(1)}` : null;
  const preview = text.length > 200 ? `${text.slice(0, 200)}...` : text;
  const quoted = preview
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  const detailLines = [
    `- Model: **${modelId}**`,
    providerLabel ? `- Provider: **${providerLabel}**` : null,
    `- Added: **${text.length} chars**`,
    totalLength ? `- Total: **${totalLength} chars**` : null,
  ].filter(Boolean);
  return `${header}\n\n${detailLines.join('\n')}\n\n${quoted}`;
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
  const current = getActiveModel();
  if (input.startsWith('/temp') && current && !current.supports_temperature) {
    return [];
  }
  if (input.startsWith('/reasoning') && current && current.reasoning_levels.length === 0) {
    return [];
  }
  const levels = getReasoningLevels();
  return getCommandSuggestions(input, models, levels);
}

function getActiveModel(): ModelInfo | null {
  return models.find((model) => model.id === store.getState().selectedModel) || null;
}

async function handleImageCommand(raw: string): Promise<void> {
  const state = store.getState();
  const { prompt, model, size } = parseImageArgs(raw);
  if (!prompt) {
    store.setError('Image prompt cannot be empty.');
    return;
  }
  const timestamp = Date.now() / 1000;
  const userMessage: Message = {
    id: `image-${Date.now()}-user`,
    role: 'user',
    content: `/image ${prompt} model=${model} size=${size}`,
    created_at: timestamp,
  };
  const assistantMessage: Message = {
    id: `image-${Date.now()}-assistant`,
    role: 'assistant',
    content: `Prompt: ${prompt}\nModel: ${model}\nSize: ${size}`,
    model,
    status: 'pending-image',
    created_at: timestamp,
  };
  store.addMessage(userMessage);
  store.addMessage(assistantMessage);
  store.setStreaming(true);
  try {
    const result = await api.generateImage(
      prompt,
      model,
      size,
      state.currentConversation?.id || null
    );
    await loadConversations();
    const conversation = await api.getConversation(result.conversation_id);
    store.setCurrentConversation(conversation);
    store.setError(null);
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Image generation failed');
  } finally {
    store.setStreaming(false);
  }
}

function parseImageArgs(raw: string): { prompt: string; model: string; size: string } {
  const tokens = raw.split(/\s+/).filter(Boolean);
  let model = 'dall-e-3';
  let size = '1024x1024';
  const promptParts: string[] = [];
  tokens.forEach((token) => {
    if (token.startsWith('model=')) {
      model = token.split('=')[1] || model;
      return;
    }
    if (token.startsWith('size=')) {
      size = token.split('=')[1] || size;
      return;
    }
    promptParts.push(token);
  });
  if (promptParts.length > 1) {
    const first = promptParts[0].toLowerCase();
    if (first === 'prompt') {
      promptParts.shift();
    } else if (first.startsWith('prompt:') || first.startsWith('prompt=')) {
      const stripped = promptParts[0].slice('prompt:'.length);
      if (stripped) {
        promptParts[0] = stripped;
      } else {
        promptParts.shift();
      }
    }
  }
  return { prompt: promptParts.join(' '), model, size };
}

function startPolling(conversationId: string): void {
  if (pollTimer) {
    window.clearTimeout(pollTimer);
  }
  const poll = async () => {
    try {
      const conversation = await api.getConversation(conversationId);
      store.setCurrentConversation(conversation);
      const pending = conversation.messages?.some((msg) => msg.status === 'pending');
      if (pending) {
        pollTimer = window.setTimeout(poll, 2000);
      } else {
        store.setStreaming(false);
        await loadUsage();
      }
    } catch (error) {
      pollTimer = window.setTimeout(poll, 3000);
    }
  };
  pollTimer = window.setTimeout(poll, 1500);
}

function checkPendingPoll(): void {
  const current = store.getState().currentConversation;
  if (!current) {
    return;
  }
  const pending = current.messages?.some((msg) => msg.status === 'pending');
  if (pending) {
    startPolling(current.id);
  }
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

function openCommandInput(command: string): void {
  const input = document.getElementById('input-area') as any;
  if (input && input.setValue) {
    input.setValue(command);
  }
}

function buildStreamingMeta(
  model: string,
  temperature: number | null,
  reasoning: string
): string {
  const parts = [model];
  if (temperature !== null) {
    parts.push(`temp ${temperature.toFixed(2)}`);
  }
  if (reasoning) {
    parts.push(`reasoning ${reasoning}`);
  }
  parts.push('streaming');
  return parts.join(' • ');
}

function buildErrorMeta(model: string, temperature: number | null, reasoning: string): string {
  const parts = ['error', model];
  if (temperature !== null) {
    parts.push(`temp ${temperature.toFixed(2)}`);
  }
  if (reasoning) {
    parts.push(`reasoning ${reasoning}`);
  }
  return parts.join(' • ');
}
