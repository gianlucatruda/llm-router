import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';

import * as api from '../api';
import {
  getCommandHelp,
  getCommandSuggestions,
  parseCommand,
  type CommandSuggestion,
} from '../commands';
import type {
  Conversation,
  ConversationListItem,
  Message,
  ModelDefaults,
  ModelInfo,
  SystemPromptUpdateResponse,
  UsageSummary,
  VersionInfo,
} from '../types';

const STORAGE_KEYS = {
  conversation: 'currentConversationId',
  model: 'selectedModel',
  temperature: 'temperature',
  reasoning: 'reasoning',
} as const;

const RESET = '\u001b[0m';
const BOLD = '\u001b[1m';
const DIM = '\u001b[2m';
const GREEN = '\u001b[38;2;136;232;145m';
const BLUE = '\u001b[38;2;125;205;255m';
const AMBER = '\u001b[38;2;245;195;108m';
const SLATE = '\u001b[38;2;136;159;145m';

const FALLBACK_MODELS: ModelInfo[] = [
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
    supports_temperature: false,
  },
];

const FALLBACK_DEFAULTS: ModelDefaults = {
  model: 'gpt-5.1',
  reasoning: 'low',
  temperature: 0.2,
};

type LoadConversationOptions = {
  adoptDraft?: boolean;
  closeDrawer?: boolean;
};

function nowSeconds(): number {
  return Date.now() / 1000;
}

function ansi(text: string, color: string, extra = ''): string {
  return `${extra}${color}${text}${RESET}`;
}

function sanitizeForTerminal(input: string): string {
  return input
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/\u001b/g, '')
    .replace(/\t/g, '  ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, 'image: $1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 <$2>');
}

function terminalText(input: string): string {
  return sanitizeForTerminal(input).replace(/\n/g, '\r\n');
}

function timeLabel(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dateLabel(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value: number | null | undefined): string {
  return `$${(value ?? 0).toFixed(4)}`;
}

function countRequests(summary: UsageSummary | null): number {
  if (!summary) {
    return 0;
  }
  return Object.values(summary.by_model).reduce((total, item) => total + item.requests, 0);
}

function sortMessages(messages: Message[]): Message[] {
  return [...messages].sort((left, right) => {
    if (left.created_at === right.created_at) {
      return left.id.localeCompare(right.id);
    }
    return left.created_at - right.created_at;
  });
}

export async function mountBrowserTerminal(container: HTMLElement): Promise<void> {
  const app = new BrowserTerminal(container);
  await app.init();
}

class BrowserTerminal {
  private readonly root: HTMLElement;
  private readonly shell = document.createElement('div');
  private readonly topbar = document.createElement('header');
  private readonly sessionToggle = document.createElement('button');
  private readonly newSessionButton = document.createElement('button');
  private readonly versionLabel = document.createElement('span');
  private readonly syncLabel = document.createElement('span');
  private readonly drawerOverlay = document.createElement('div');
  private readonly drawer = document.createElement('aside');
  private readonly drawerClose = document.createElement('button');
  private readonly sessionList = document.createElement('div');
  private readonly activeSessionLabel = document.createElement('span');
  private readonly modelChip = document.createElement('span');
  private readonly reasoningChip = document.createElement('span');
  private readonly temperatureChip = document.createElement('span');
  private readonly systemChip = document.createElement('span');
  private readonly usageChip = document.createElement('span');
  private readonly outputHost = document.createElement('div');
  private readonly errorStrip = document.createElement('div');
  private readonly composer = document.createElement('textarea');
  private readonly sendButton = document.createElement('button');
  private readonly suggestionList = document.createElement('div');
  private readonly probe = document.createElement('pre');
  private readonly resizeObserver: ResizeObserver;
  private readonly terminal: Terminal;
  private readonly fitAddon = new FitAddon();
  private readonly linksAddon = new WebLinksAddon();

  private models: ModelInfo[] = [];
  private catalogDefaults: ModelDefaults = FALLBACK_DEFAULTS;
  private versionInfo: VersionInfo | null = null;
  private conversations: ConversationListItem[] = [];
  private currentConversation: Conversation | null = null;
  private messages: Message[] = [];
  private extraMessagesByConversation: Record<string, Message[]> = {};
  private historyByConversation: Record<string, string[]> = {};
  private historyIndexByConversation: Record<string, number> = {};
  private selectedModel = localStorage.getItem(STORAGE_KEYS.model) || FALLBACK_DEFAULTS.model;
  private temperature = Number(localStorage.getItem(STORAGE_KEYS.temperature) || FALLBACK_DEFAULTS.temperature);
  private reasoning = localStorage.getItem(STORAGE_KEYS.reasoning) || FALLBACK_DEFAULTS.reasoning;
  private pendingSystem = '';
  private usageOverall: UsageSummary | null = null;
  private usageDevice: UsageSummary | null = null;
  private suggestions: CommandSuggestion[] = [];
  private highlightedSuggestion = 0;
  private drawerOpen = false;
  private error: string | null = null;
  private isStreaming = false;
  private systemUpdating = false;
  private pollTimer: number | null = null;

  constructor(container: HTMLElement) {
    this.root = container;
    this.root.id = 'app';
    this.root.className = 'browser-terminal-root';
    this.root.dataset.terminalMode = 'xterm';

    this.buildShell();

    this.terminal = new Terminal({
      allowTransparency: true,
      convertEol: false,
      cursorBlink: true,
      cursorStyle: 'bar',
      disableStdin: true,
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: 14,
      lineHeight: 1.45,
      scrollback: 6000,
      theme: {
        background: '#0d120f',
        foreground: '#eef6ec',
        cursor: '#87e891',
        selectionBackground: 'rgba(125, 205, 255, 0.28)',
        black: '#0d120f',
        red: '#ff8b7d',
        green: '#87e891',
        yellow: '#f5c36c',
        blue: '#7dcdff',
        magenta: '#ca9dff',
        cyan: '#8ae0c8',
        white: '#eef6ec',
        brightBlack: '#61766a',
        brightRed: '#ffab9f',
        brightGreen: '#a8f3b1',
        brightYellow: '#ffd99a',
        brightBlue: '#abdfff',
        brightMagenta: '#ddbfff',
        brightCyan: '#b8f3e2',
        brightWhite: '#ffffff',
      },
    });
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.loadAddon(this.linksAddon);
    this.terminal.open(this.outputHost);

    this.resizeObserver = new ResizeObserver(() => {
      this.fitTerminal();
    });
  }

  async init(): Promise<void> {
    this.bindEvents();
    this.resizeObserver.observe(this.outputHost);
    this.fitTerminal();

    await this.bootstrap();

    this.syncShell();
    this.renderConversation();
    this.focusComposer();
  }

  private buildShell(): void {
    this.shell.className = 'terminal-shell';

    this.topbar.className = 'topbar';

    const brand = document.createElement('div');
    brand.className = 'brand';

    const brandKicker = document.createElement('span');
    brandKicker.className = 'brand-kicker';
    brandKicker.textContent = 'Browser terminal';

    const brandTitle = document.createElement('h1');
    brandTitle.className = 'brand-title';
    brandTitle.textContent = 'LLM Router';

    this.versionLabel.className = 'brand-version';
    this.versionLabel.textContent = 'v0.2 alpha';

    brand.append(brandKicker, brandTitle, this.versionLabel);

    const topbarActions = document.createElement('div');
    topbarActions.className = 'topbar-actions';

    this.syncLabel.className = 'sync-pill';
    this.syncLabel.textContent = 'ready';

    this.sessionToggle.type = 'button';
    this.sessionToggle.className = 'chrome-button session-toggle';
    this.sessionToggle.textContent = 'Sessions';

    this.newSessionButton.type = 'button';
    this.newSessionButton.className = 'chrome-button new-session';
    this.newSessionButton.textContent = 'New';

    topbarActions.append(this.syncLabel, this.sessionToggle, this.newSessionButton);
    this.topbar.append(brand, topbarActions);

    const workspace = document.createElement('div');
    workspace.className = 'workspace';

    this.drawerOverlay.className = 'drawer-overlay';

    this.drawer.className = 'session-drawer';
    const drawerHeader = document.createElement('div');
    drawerHeader.className = 'drawer-header';

    const drawerTitleWrap = document.createElement('div');
    drawerTitleWrap.className = 'drawer-title-wrap';

    const drawerKicker = document.createElement('span');
    drawerKicker.className = 'drawer-kicker';
    drawerKicker.textContent = 'Saved sessions';

    const drawerTitle = document.createElement('h2');
    drawerTitle.className = 'drawer-title';
    drawerTitle.textContent = 'Conversations';

    drawerTitleWrap.append(drawerKicker, drawerTitle);

    this.drawerClose.type = 'button';
    this.drawerClose.className = 'chrome-button drawer-close';
    this.drawerClose.textContent = 'Close';

    drawerHeader.append(drawerTitleWrap, this.drawerClose);

    this.sessionList.className = 'session-list';
    this.drawer.append(drawerHeader, this.sessionList);

    const terminalPanel = document.createElement('section');
    terminalPanel.className = 'terminal-panel';

    const terminalHeader = document.createElement('div');
    terminalHeader.className = 'terminal-header';

    const contextGroup = document.createElement('div');
    contextGroup.className = 'terminal-context';

    this.activeSessionLabel.className = 'terminal-session';
    this.activeSessionLabel.textContent = 'Draft session';

    contextGroup.append(this.activeSessionLabel);

    const statusGroup = document.createElement('div');
    statusGroup.className = 'terminal-status';

    this.modelChip.className = 'status-chip status-model';
    this.reasoningChip.className = 'status-chip';
    this.temperatureChip.className = 'status-chip';
    this.systemChip.className = 'status-chip';
    this.usageChip.className = 'status-chip';

    statusGroup.append(
      this.modelChip,
      this.reasoningChip,
      this.temperatureChip,
      this.systemChip,
      this.usageChip
    );
    terminalHeader.append(contextGroup, statusGroup);

    this.outputHost.className = 'terminal-output';

    this.errorStrip.className = 'error-strip';
    this.errorStrip.hidden = true;

    const composerShell = document.createElement('div');
    composerShell.className = 'composer-shell';

    const prompt = document.createElement('span');
    prompt.className = 'composer-prompt';
    prompt.textContent = '>'; 

    const composerWrap = document.createElement('div');
    composerWrap.className = 'composer-wrap';

    this.composer.className = 'composer-input';
    this.composer.rows = 1;
    this.composer.placeholder = 'Type a prompt or /help';
    this.composer.spellcheck = false;
    this.composer.setAttribute('autocapitalize', 'off');
    this.composer.setAttribute('autocomplete', 'off');
    this.composer.setAttribute('autocorrect', 'off');
    this.composer.id = 'composer-input';

    this.suggestionList.className = 'suggestion-list';
    this.suggestionList.hidden = true;

    const hintBar = document.createElement('div');
    hintBar.className = 'hint-bar';
    hintBar.textContent = 'Enter sends, Shift+Enter adds a line, Tab completes, Cmd/Ctrl+B opens sessions';

    composerWrap.append(this.composer, this.suggestionList, hintBar);

    this.sendButton.type = 'button';
    this.sendButton.className = 'send-button';
    this.sendButton.textContent = 'Send';

    composerShell.append(prompt, composerWrap, this.sendButton);

    this.probe.className = 'app-probe';
    this.probe.hidden = true;
    this.probe.setAttribute('aria-hidden', 'true');

    terminalPanel.append(terminalHeader, this.outputHost, this.errorStrip, composerShell, this.probe);

    workspace.append(this.drawerOverlay, this.drawer, terminalPanel);
    this.shell.append(this.topbar, workspace);
    this.root.replaceChildren(this.shell);
  }

  private bindEvents(): void {
    this.sessionToggle.addEventListener('click', () => {
      this.toggleDrawer();
    });
    this.newSessionButton.addEventListener('click', () => {
      this.startNewSession(true);
    });
    this.drawerClose.addEventListener('click', () => {
      this.setDrawer(false);
    });
    this.drawerOverlay.addEventListener('click', () => {
      this.setDrawer(false);
    });
    this.sendButton.addEventListener('click', () => {
      void this.submitComposer();
    });
    this.outputHost.addEventListener('click', () => {
      this.focusComposer();
    });

    this.composer.addEventListener('input', () => {
      this.syncComposerHeight();
      this.resetHistoryCursor(this.activeConversationKey());
      this.refreshSuggestions();
    });

    this.composer.addEventListener('keydown', (event) => {
      if (event.key === 'Tab' && this.suggestions.length > 0) {
        event.preventDefault();
        const suggestion = this.suggestions[this.highlightedSuggestion] ?? this.suggestions[0];
        if (suggestion) {
          this.applySuggestion(suggestion.value);
        }
        return;
      }

      if (event.key === 'Escape') {
        if (this.drawerOpen) {
          event.preventDefault();
          this.setDrawer(false);
          return;
        }
        this.clearSuggestions();
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void this.submitComposer();
        return;
      }

      if (event.key === 'ArrowDown' && this.suggestions.length > 0) {
        event.preventDefault();
        this.highlightedSuggestion = (this.highlightedSuggestion + 1) % this.suggestions.length;
        this.renderSuggestions();
        return;
      }

      if (event.key === 'ArrowUp' && this.suggestions.length > 0) {
        event.preventDefault();
        this.highlightedSuggestion =
          (this.highlightedSuggestion - 1 + this.suggestions.length) % this.suggestions.length;
        this.renderSuggestions();
        return;
      }

      if (event.key === 'ArrowUp' && this.isCaretOnFirstLine()) {
        const previous = this.navigateHistory(-1);
        if (previous !== null) {
          event.preventDefault();
          this.applyComposerValue(previous);
        }
        return;
      }

      if (event.key === 'ArrowDown' && this.isCaretOnLastLine()) {
        const next = this.navigateHistory(1);
        if (next !== null) {
          event.preventDefault();
          this.applyComposerValue(next);
        }
      }
    });

    window.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        this.toggleDrawer();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        this.focusComposer();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        this.startNewSession(true);
      }
    });
  }

  private async bootstrap(): Promise<void> {
    await Promise.all([this.loadCatalog(), this.loadVersion(), this.refreshConversations(), this.refreshUsage()]);
    this.syncModelConstraints();

    const requestedId = localStorage.getItem(STORAGE_KEYS.conversation);
    const fallbackId = this.conversations[0]?.id ?? null;
    const existingId = requestedId && this.conversations.some((item) => item.id === requestedId)
      ? requestedId
      : fallbackId;

    if (existingId) {
      await this.loadConversation(existingId, { adoptDraft: false, closeDrawer: false });
      return;
    }

    this.startNewSession(false);
  }

  private async loadCatalog(): Promise<void> {
    try {
      const catalog = await api.getModelCatalog();
      this.models = catalog.models;
      this.catalogDefaults = catalog.defaults;
    } catch (error) {
      this.models = FALLBACK_MODELS;
      this.catalogDefaults = FALLBACK_DEFAULTS;
      this.setError('Model catalog unavailable. Using fallback defaults.');
    }

    if (!Number.isFinite(this.temperature)) {
      this.temperature = this.catalogDefaults.temperature;
    }

    if (!this.selectedModel || !this.models.some((model) => model.id === this.selectedModel)) {
      this.selectedModel = this.catalogDefaults.model;
    }

    if (!this.reasoning) {
      this.reasoning = this.catalogDefaults.reasoning;
    }
  }

  private async loadVersion(): Promise<void> {
    try {
      this.versionInfo = await api.getVersion();
    } catch (error) {
      this.versionInfo = null;
    }
  }

  private async refreshConversations(): Promise<void> {
    try {
      this.conversations = await api.getConversations();
      this.renderSessions();
    } catch (error) {
      this.setError('Failed to load conversations.');
    }
  }

  private async refreshUsage(): Promise<void> {
    try {
      const [overall, device] = await Promise.all([
        api.getUsageSummary('overall'),
        api.getUsageSummary('device'),
      ]);
      this.usageOverall = overall;
      this.usageDevice = device;
    } catch (error) {
      this.usageOverall = null;
      this.usageDevice = null;
      this.setError('Failed to load usage totals.');
    }
  }

  private syncModelConstraints(): void {
    const active = this.activeModel();
    if (!active) {
      return;
    }
    if (!active.supports_temperature) {
      this.temperature = 0;
    }
    if (active.reasoning_levels.length > 0 && !active.reasoning_levels.includes(this.reasoning)) {
      this.reasoning = active.reasoning_levels[0];
    }
    if (active.reasoning_levels.length === 0) {
      this.reasoning = this.catalogDefaults.reasoning;
    }
    this.persistSettings();
  }

  private persistSettings(): void {
    localStorage.setItem(STORAGE_KEYS.model, this.selectedModel);
    localStorage.setItem(STORAGE_KEYS.temperature, this.temperature.toString());
    localStorage.setItem(STORAGE_KEYS.reasoning, this.reasoning);
  }

  private buildVersionLabel(): string {
    if (!this.versionInfo) {
      return 'v0.2 alpha';
    }
    const commit = this.versionInfo.commit_short || 'dev';
    return `v${this.versionInfo.version} alpha ${commit}`;
  }

  private renderSessions(): void {
    this.sessionList.replaceChildren();

    if (this.conversations.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'session-empty';
      empty.textContent = 'No conversations yet. Your first prompt creates one.';
      this.sessionList.append(empty);
      return;
    }

    this.conversations.forEach((conversation) => {
      const item = document.createElement('article');
      item.className = 'session-item';
      if (conversation.id === this.currentConversation?.id) {
        item.classList.add('active');
      }

      const itemButton = document.createElement('button');
      itemButton.type = 'button';
      itemButton.className = 'session-main';
      itemButton.addEventListener('click', () => {
        void this.loadConversation(conversation.id, { adoptDraft: false, closeDrawer: true });
      });

      const title = document.createElement('span');
      title.className = 'session-title';
      title.textContent = conversation.title || 'Untitled conversation';

      const meta = document.createElement('span');
      meta.className = 'session-meta';
      meta.textContent = `${conversation.model} | ${dateLabel(conversation.updated_at)}`;

      itemButton.append(title, meta);

      const actions = document.createElement('div');
      actions.className = 'session-actions';

      const cloneButton = document.createElement('button');
      cloneButton.type = 'button';
      cloneButton.className = 'session-action';
      cloneButton.textContent = 'Clone';
      cloneButton.addEventListener('click', (event) => {
        event.stopPropagation();
        void this.cloneConversation(conversation.id);
      });

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'session-action danger';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        void this.deleteConversation(conversation.id);
      });

      actions.append(cloneButton, deleteButton);
      item.append(itemButton, actions);
      this.sessionList.append(item);
    });
  }

  private syncShell(): void {
    this.versionLabel.textContent = this.buildVersionLabel();
    this.syncLabel.textContent = this.isStreaming ? 'streaming' : 'ready';
    this.activeSessionLabel.textContent = this.currentConversation?.title || 'Draft session';
    this.modelChip.textContent = `model ${this.selectedModel}`;
    this.reasoningChip.textContent = `reasoning ${this.reasoning || 'n/a'}`;
    this.temperatureChip.textContent = `temp ${this.temperature.toFixed(2)}`;
    const persistedSystem = this.currentConversation?.system_prompt?.length || 0;
    const queuedSystem = this.pendingSystem.length;
    this.systemChip.textContent = persistedSystem > 0
      ? `system ${persistedSystem} chars`
      : queuedSystem > 0
        ? `queued system ${queuedSystem} chars`
        : 'system off';
    this.usageChip.textContent = `device ${formatMoney(this.usageDevice?.total_cost)} | overall ${formatMoney(this.usageOverall?.total_cost)}`;
    this.shell.classList.toggle('drawer-open', this.drawerOpen);
    this.root.dataset.streaming = String(this.isStreaming);
    this.root.dataset.drawerOpen = String(this.drawerOpen);
    this.root.dataset.model = this.selectedModel;
    this.root.dataset.ready = 'true';
    this.root.dataset.conversations = String(this.conversations.length);
    this.renderSessions();
    this.renderError();
    this.refreshComposerState();
    this.updateProbe();
  }

  private renderError(): void {
    this.errorStrip.hidden = !this.error;
    this.errorStrip.textContent = this.error || '';
  }

  private refreshComposerState(): void {
    const disabled = this.isStreaming || this.systemUpdating;
    this.composer.disabled = disabled;
    this.sendButton.disabled = disabled;
  }

  private renderConversation(): void {
    this.terminal.reset();
    this.fitTerminal();

    this.writeLine(ansi('LLM Router browser terminal', GREEN, BOLD));
    this.writeLine(`${ansi('version', SLATE)} ${this.buildVersionLabel()}`);
    this.writeLine(`${ansi('model', SLATE)} ${this.selectedModel} | ${ansi('reasoning', SLATE)} ${this.reasoning || 'n/a'} | ${ansi('temp', SLATE)} ${this.temperature.toFixed(2)}`);
    this.writeLine(`${ansi('sessions', SLATE)} ${this.conversations.length} saved | ${ansi('device requests', SLATE)} ${countRequests(this.usageDevice)}`);
    if (this.currentConversation?.system_prompt) {
      this.writeLine(`${ansi('system', SLATE)} ${this.currentConversation.system_prompt.length} persisted chars`);
    } else if (this.pendingSystem) {
      this.writeLine(`${ansi('system', SLATE)} ${this.pendingSystem.length} queued chars for the next prompt`);
    }
    this.writeLine(`${ansi('hint', SLATE)} /help, /new, /sessions, Cmd/Ctrl+B, Cmd/Ctrl+K`);
    this.writeLine('');

    const entries = this.currentRenderableMessages();
    if (entries.length === 0) {
      this.writeLine(ansi('No transcript yet.', SLATE));
      this.writeLine('Type a prompt to create a session or use /help for command output.');
      this.syncShell();
      this.terminal.scrollToBottom();
      return;
    }

    entries.forEach((message) => {
      this.writeMessage(message);
    });

    this.syncShell();
    this.terminal.scrollToBottom();
  }

  private writeMessage(message: Message): void {
    const metaParts = [timeLabel(message.created_at)];
    if (message.model) {
      metaParts.push(message.model);
    }
    if (typeof message.temperature === 'number') {
      metaParts.push(`temp ${message.temperature.toFixed(2)}`);
    }
    if (message.reasoning) {
      metaParts.push(`reasoning ${message.reasoning}`);
    }
    if (message.status) {
      metaParts.push(message.status);
    }
    if (typeof message.tokens_input === 'number' || typeof message.tokens_output === 'number') {
      metaParts.push(`${message.tokens_input ?? 0}/${message.tokens_output ?? 0} tok`);
    }
    if (typeof message.cost === 'number') {
      metaParts.push(formatMoney(message.cost));
    }

    const role = this.roleLabel(message.role);
    const header = `${role} ${ansi(metaParts.join(' | '), SLATE, DIM)}`;
    this.writeLine(header);

    if (message.content) {
      this.writeRaw(`${terminalText(message.content)}\r\n\r\n`);
      return;
    }

    if (message.status === 'pending' || message.status === 'pending-image') {
      this.writeLine(ansi('waiting for response...', SLATE, DIM));
      this.writeLine('');
    }
  }

  private roleLabel(role: Message['role']): string {
    if (role === 'user') {
      return ansi('you', AMBER, BOLD);
    }
    if (role === 'assistant') {
      return ansi('agent', BLUE, BOLD);
    }
    return ansi('system', GREEN, BOLD);
  }

  private writeRaw(text: string): void {
    this.terminal.write(text);
  }

  private writeLine(text: string): void {
    this.terminal.writeln(text);
  }

  private currentRenderableMessages(): Message[] {
    return sortMessages([
      ...this.messages,
      ...(this.extraMessagesByConversation[this.activeConversationKey()] || []),
    ]);
  }

  private updateProbe(): void {
    const lines = [
      'LLM Router browser terminal',
      `version ${this.buildVersionLabel()}`,
      `model ${this.selectedModel}`,
      `reasoning ${this.reasoning || 'n/a'}`,
      `temperature ${this.temperature.toFixed(2)}`,
      `streaming ${this.isStreaming}`,
      `session ${this.currentConversation?.title || 'Draft session'}`,
      '',
    ];

    this.currentRenderableMessages().forEach((message) => {
      lines.push(`${message.role.toUpperCase()} ${timeLabel(message.created_at)}`);
      if (message.model) {
        lines.push(`meta ${message.model}${message.status ? ` ${message.status}` : ''}`);
      }
      lines.push(sanitizeForTerminal(message.content || ''));
      lines.push('');
    });

    this.probe.textContent = lines.join('\n');
  }

  private fitTerminal(): void {
    requestAnimationFrame(() => {
      this.fitAddon.fit();
    });
  }

  private focusComposer(): void {
    requestAnimationFrame(() => {
      this.composer.focus();
    });
  }

  private syncComposerHeight(): void {
    this.composer.style.height = 'auto';
    this.composer.style.height = `${Math.min(this.composer.scrollHeight, 180)}px`;
  }

  private applyComposerValue(value: string): void {
    this.composer.value = value;
    this.syncComposerHeight();
    this.clearSuggestions();
    this.composer.setSelectionRange(value.length, value.length);
  }

  private clearComposer(): void {
    this.applyComposerValue('');
  }

  private refreshSuggestions(): void {
    this.suggestions = getCommandSuggestions(
      this.composer.value,
      this.models,
      this.activeReasoningLevels()
    );
    this.highlightedSuggestion = 0;
    this.renderSuggestions();
  }

  private clearSuggestions(): void {
    this.suggestions = [];
    this.highlightedSuggestion = 0;
    this.renderSuggestions();
  }

  private renderSuggestions(): void {
    this.suggestionList.replaceChildren();
    this.suggestionList.hidden = this.suggestions.length === 0;

    this.suggestions.forEach((suggestion, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'suggestion-item';
      if (index === this.highlightedSuggestion) {
        button.classList.add('active');
      }
      button.textContent = suggestion.label;
      button.addEventListener('click', () => {
        this.applySuggestion(suggestion.value);
      });
      this.suggestionList.append(button);
    });
  }

  private applySuggestion(value: string): void {
    this.applyComposerValue(value);
    this.focusComposer();
  }

  private isCaretOnFirstLine(): boolean {
    const start = this.composer.selectionStart ?? 0;
    return !this.composer.value.slice(0, start).includes('\n');
  }

  private isCaretOnLastLine(): boolean {
    const end = this.composer.selectionEnd ?? this.composer.value.length;
    return !this.composer.value.slice(end).includes('\n');
  }

  private resetHistoryCursor(key: string): void {
    const history = this.historyByConversation[key] || [];
    this.historyIndexByConversation[key] = history.length;
  }

  private navigateHistory(direction: number): string | null {
    const key = this.activeConversationKey();
    const history = this.historyByConversation[key] || [];
    if (history.length === 0) {
      return null;
    }

    const currentIndex = this.historyIndexByConversation[key] ?? history.length;
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), history.length);
    this.historyIndexByConversation[key] = nextIndex;
    return nextIndex === history.length ? '' : history[nextIndex];
  }

  private pushHistory(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    const key = this.activeConversationKey();
    const history = this.historyByConversation[key] || [];
    history.push(trimmed);
    this.historyByConversation[key] = history;
    this.historyIndexByConversation[key] = history.length;
  }

  private activeConversationKey(): string {
    return this.currentConversation?.id || 'new';
  }

  private activeModel(): ModelInfo | null {
    return this.models.find((model) => model.id === this.selectedModel) || null;
  }

  private activeReasoningLevels(): string[] {
    return this.activeModel()?.reasoning_levels || [];
  }

  private appendNotice(content: string): void {
    const key = this.activeConversationKey();
    const list = this.extraMessagesByConversation[key] || [];
    list.push({
      id: `local-${Date.now()}-${list.length}`,
      role: 'system',
      content,
      created_at: nowSeconds(),
    });
    this.extraMessagesByConversation[key] = list;
    this.renderConversation();
  }

  private migrateDraftState(destinationKey: string): void {
    const draftExtras = this.extraMessagesByConversation.new;
    if (draftExtras && draftExtras.length > 0) {
      this.extraMessagesByConversation[destinationKey] = [
        ...(this.extraMessagesByConversation[destinationKey] || []),
        ...draftExtras,
      ];
      delete this.extraMessagesByConversation.new;
    }

    const draftHistory = this.historyByConversation.new;
    if (draftHistory && draftHistory.length > 0) {
      this.historyByConversation[destinationKey] = [
        ...(this.historyByConversation[destinationKey] || []),
        ...draftHistory,
      ];
      this.historyIndexByConversation[destinationKey] =
        this.historyByConversation[destinationKey].length;
      delete this.historyByConversation.new;
      delete this.historyIndexByConversation.new;
    }
  }

  private clearPolling(): void {
    if (this.pollTimer) {
      window.clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private applyConversationState(conversation: Conversation): void {
    this.currentConversation = conversation;
    this.messages = sortMessages(conversation.messages || []);
    this.selectedModel = conversation.model;
    this.syncModelConstraints();
    localStorage.setItem(STORAGE_KEYS.conversation, conversation.id);
  }

  private async loadConversation(
    conversationId: string,
    options: LoadConversationOptions
  ): Promise<void> {
    try {
      this.clearPolling();
      const conversation = await api.getConversation(conversationId);
      if (options.adoptDraft) {
        this.migrateDraftState(conversation.id);
      }
      this.applyConversationState(conversation);
      this.error = null;
      if (options.closeDrawer) {
        this.setDrawer(false);
      }
      this.checkPendingPoll();
      this.renderConversation();
    } catch (error) {
      this.setError('Failed to load conversation.');
    }
  }

  private async cloneConversation(conversationId: string): Promise<void> {
    try {
      const cloned = await api.cloneConversation(conversationId);
      await this.refreshConversations();
      await this.loadConversation(cloned.id, { adoptDraft: false, closeDrawer: true });
      this.setError(null);
    } catch (error) {
      this.setError('Failed to clone conversation.');
    }
  }

  private async deleteConversation(conversationId: string): Promise<void> {
    try {
      await api.deleteConversation(conversationId);
      await this.refreshConversations();
      if (this.currentConversation?.id === conversationId) {
        this.startNewSession(false);
      } else {
        this.syncShell();
      }
      this.setError(null);
    } catch (error) {
      this.setError('Failed to delete conversation.');
    }
  }

  private startNewSession(announce: boolean): void {
    this.clearPolling();
    this.currentConversation = null;
    this.messages = [];
    this.pendingSystem = '';
    this.isStreaming = false;
    delete this.extraMessagesByConversation.new;
    localStorage.removeItem(STORAGE_KEYS.conversation);
    this.setDrawer(false);
    this.renderConversation();
    if (announce) {
      this.appendNotice('Draft session ready. The next prompt will create a saved conversation.');
    }
  }

  private setDrawer(open: boolean): void {
    this.drawerOpen = open;
    this.syncShell();
  }

  private toggleDrawer(): void {
    this.setDrawer(!this.drawerOpen);
  }

  private setError(message: string | null): void {
    this.error = message;
    this.syncShell();
  }

  private async submitComposer(): Promise<void> {
    if (this.isStreaming || this.systemUpdating) {
      return;
    }

    const value = this.composer.value.trimEnd();
    if (!value.trim()) {
      return;
    }

    this.pushHistory(value);
    this.clearComposer();
    this.clearSuggestions();

    if (value.startsWith('/')) {
      const handled = await this.handleCommand(value);
      if (handled) {
        this.focusComposer();
        return;
      }
    }

    await this.sendMessage(value);
    this.focusComposer();
  }

  private async handleCommand(input: string): Promise<boolean> {
    const parsed = parseCommand(input);
    if (!parsed) {
      this.setError('Unknown command. Type /help.');
      return true;
    }

    if (parsed.id === 'help') {
      this.appendNotice(getCommandHelp());
      this.setError(null);
      return true;
    }

    if (parsed.id === 'new') {
      this.startNewSession(true);
      this.setError(null);
      return true;
    }

    if (parsed.id === 'sessions') {
      this.toggleDrawer();
      this.setError(null);
      return true;
    }

    if (parsed.id === 'model') {
      if (!parsed.arg.trim()) {
        const choices = this.models.slice(0, 8).map((model) => `${model.name} (${model.id})`).join('\n');
        this.appendNotice(`Current model: ${this.selectedModel}\n\nAvailable models:\n${choices}`);
        this.setError(null);
        return true;
      }
      const nextModel = this.findModel(parsed.arg);
      if (!nextModel) {
        this.setError('Model not found. Use /model and Tab autocomplete.');
        return true;
      }
      this.selectedModel = nextModel.id;
      this.syncModelConstraints();
      this.renderConversation();
      this.appendNotice(`Active model set to ${nextModel.name} (${nextModel.id}).`);
      this.setError(null);
      return true;
    }

    if (parsed.id === 'temp') {
      const active = this.activeModel();
      if (active && !active.supports_temperature) {
        this.setError('Temperature is not supported for this model.');
        return true;
      }
      if (!parsed.arg.trim()) {
        this.appendNotice(`Current temperature: ${this.temperature.toFixed(2)}`);
        this.setError(null);
        return true;
      }
      const nextTemperature = Number(parsed.arg);
      if (!Number.isFinite(nextTemperature) || nextTemperature < 0 || nextTemperature > 2) {
        this.setError('Temperature must be between 0 and 2.');
        return true;
      }
      this.temperature = nextTemperature;
      this.persistSettings();
      this.syncShell();
      this.appendNotice(`Temperature set to ${nextTemperature.toFixed(2)}.`);
      this.setError(null);
      return true;
    }

    if (parsed.id === 'reasoning') {
      const levels = this.activeReasoningLevels();
      if (levels.length === 0) {
        this.setError('Reasoning levels are not supported for this model.');
        return true;
      }
      if (!parsed.arg.trim()) {
        this.appendNotice(`Current reasoning level: ${this.reasoning}\nAvailable levels: ${levels.join(', ')}`);
        this.setError(null);
        return true;
      }
      const nextReasoning = levels.find((level) => level === parsed.arg.trim().toLowerCase());
      if (!nextReasoning) {
        this.setError(`Reasoning must be one of: ${levels.join(', ')}.`);
        return true;
      }
      this.reasoning = nextReasoning;
      this.persistSettings();
      this.syncShell();
      this.appendNotice(`Reasoning set to ${nextReasoning}.`);
      this.setError(null);
      return true;
    }

    if (parsed.id === 'system') {
      const systemText = parsed.arg.trim();
      if (!systemText) {
        this.setError('System text cannot be empty.');
        return true;
      }
      if (this.currentConversation) {
        await this.persistSystemText(systemText);
        return true;
      }
      this.pendingSystem = this.pendingSystem
        ? `${this.pendingSystem}\n${systemText}`
        : systemText;
      this.renderConversation();
      this.appendNotice(`Queued ${systemText.length} chars of system text for the next prompt.`);
      this.setError(null);
      return true;
    }

    if (parsed.id === 'image') {
      await this.handleImageCommand(parsed.arg);
      return true;
    }

    return false;
  }

  private async persistSystemText(systemText: string): Promise<void> {
    if (!this.currentConversation) {
      return;
    }

    this.systemUpdating = true;
    this.syncShell();

    try {
      const response = await api.appendSystemText(this.currentConversation.id, systemText);
      this.applySystemUpdate(response);
      this.appendNotice(
        `System text appended to ${this.currentConversation.title}. Provider ${response.provider}. Total length ${response.system_prompt_length} chars.`
      );
      this.setError(null);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : 'Failed to update system text.');
    } finally {
      this.systemUpdating = false;
      this.syncShell();
    }
  }

  private applySystemUpdate(response: SystemPromptUpdateResponse): void {
    if (!this.currentConversation || this.currentConversation.id !== response.conversation_id) {
      return;
    }
    this.currentConversation = {
      ...this.currentConversation,
      system_prompt: response.system_prompt,
    };
    this.syncShell();
  }

  private async sendMessage(content: string): Promise<void> {
    const active = this.activeModel();
    const effectiveTemperature = active && !active.supports_temperature ? null : this.temperature;
    const effectiveReasoning = active && active.reasoning_levels.length > 0 ? this.reasoning : '';
    const timestamp = nowSeconds();
    const wasDraft = !this.currentConversation;

    this.messages = [
      ...this.messages,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        created_at: timestamp,
      },
    ];
    this.renderConversation();

    const shouldStream = navigator.onLine && document.visibilityState === 'visible';

    if (shouldStream) {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        model: this.selectedModel,
        temperature: effectiveTemperature ?? undefined,
        reasoning: effectiveReasoning || undefined,
        status: 'streaming',
        created_at: nowSeconds(),
      };
      this.messages = [...this.messages, assistantMessage];
      this.isStreaming = true;
      this.setError(null);
      this.renderConversation();

      let streamed = '';
      await api.streamChat(
        content,
        this.selectedModel,
        this.currentConversation?.id || null,
        effectiveTemperature,
        effectiveReasoning,
        this.pendingSystem || null,
        (token) => {
          streamed += token;
          const lastMessage = this.messages[this.messages.length - 1];
          if (lastMessage) {
            lastMessage.content = streamed;
          }
          this.writeRaw(terminalText(token));
          this.updateProbe();
          this.terminal.scrollToBottom();
        },
        async (data) => {
          this.pendingSystem = '';
          this.isStreaming = false;
          await this.refreshConversations();
          await this.refreshUsage();
          await this.loadConversation(data.conversation_id, {
            adoptDraft: wasDraft,
            closeDrawer: false,
          });
          this.setError(null);
        },
        (error) => {
          this.isStreaming = false;
          const lastMessage = this.messages[this.messages.length - 1];
          if (lastMessage) {
            lastMessage.status = 'error';
            lastMessage.content = `${streamed}\n\nError: ${error}`.trim();
          }
          this.renderConversation();
          this.setError(error);
        }
      );
      return;
    }

    this.messages = [
      ...this.messages,
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'Queued for background completion...',
        model: this.selectedModel,
        temperature: effectiveTemperature ?? undefined,
        reasoning: effectiveReasoning || undefined,
        status: 'pending',
        created_at: nowSeconds(),
      },
    ];

    this.isStreaming = true;
    this.renderConversation();
    this.setError(null);

    try {
      const response = await api.submitChat(
        content,
        this.selectedModel,
        this.currentConversation?.id || null,
        effectiveTemperature,
        effectiveReasoning,
        this.pendingSystem || null
      );
      this.pendingSystem = '';
      await this.refreshConversations();
      await this.loadConversation(response.conversation_id, {
        adoptDraft: wasDraft,
        closeDrawer: false,
      });
      this.startPolling(response.conversation_id);
    } catch (error) {
      this.isStreaming = false;
      this.setError(error instanceof Error ? error.message : 'Failed to submit prompt.');
      this.renderConversation();
    }
  }

  private startPolling(conversationId: string): void {
    if (this.pollTimer) {
      window.clearTimeout(this.pollTimer);
    }

    const poll = async () => {
      try {
        const conversation = await api.getConversation(conversationId);
        this.applyConversationState(conversation);
        this.renderConversation();
        const pending = this.messages.some((message) => message.status === 'pending');
        if (pending) {
          this.pollTimer = window.setTimeout(poll, 1500);
          return;
        }
        this.isStreaming = false;
        this.pollTimer = null;
        await this.refreshUsage();
        this.syncShell();
      } catch (error) {
        this.pollTimer = window.setTimeout(poll, 2500);
      }
    };

    this.pollTimer = window.setTimeout(poll, 1200);
  }

  private checkPendingPoll(): void {
    if (!this.currentConversation) {
      return;
    }
    const pending = this.messages.some((message) => message.status === 'pending');
    if (pending) {
      this.isStreaming = true;
      this.startPolling(this.currentConversation.id);
    }
  }

  private async handleImageCommand(raw: string): Promise<void> {
    const parsed = this.parseImageArgs(raw);
    if (!parsed.prompt) {
      this.setError('Image prompt cannot be empty.');
      return;
    }

    const timestamp = nowSeconds();
    const wasDraft = !this.currentConversation;
    this.messages = [
      ...this.messages,
      {
        id: `image-user-${Date.now()}`,
        role: 'user',
        content: `/image ${parsed.prompt} model=${parsed.model} size=${parsed.size}`,
        created_at: timestamp,
      },
      {
        id: `image-agent-${Date.now()}`,
        role: 'assistant',
        content: `Generating image...\nprompt ${parsed.prompt}\nmodel ${parsed.model}\nsize ${parsed.size}`,
        model: parsed.model,
        status: 'pending-image',
        created_at: timestamp,
      },
    ];

    this.isStreaming = true;
    this.renderConversation();

    try {
      const result = await api.generateImage(
        parsed.prompt,
        parsed.model,
        parsed.size,
        this.currentConversation?.id || null
      );
      this.isStreaming = false;
      await this.refreshConversations();
      await this.refreshUsage();
      await this.loadConversation(result.conversation_id, {
        adoptDraft: wasDraft,
        closeDrawer: false,
      });
      this.setError(null);
    } catch (error) {
      this.isStreaming = false;
      this.setError(error instanceof Error ? error.message : 'Image generation failed.');
      this.renderConversation();
    }
  }

  private parseImageArgs(raw: string): { prompt: string; model: string; size: string } {
    const tokens = raw.split(/\s+/).filter(Boolean);
    let model = 'dall-e-3';
    let size = '1024x1024';
    const promptParts: string[] = [];

    tokens.forEach((token) => {
      if (token.startsWith('model=')) {
        model = token.slice('model='.length) || model;
        return;
      }
      if (token.startsWith('size=')) {
        size = token.slice('size='.length) || size;
        return;
      }
      promptParts.push(token);
    });

    if (promptParts[0]?.toLowerCase() === 'prompt') {
      promptParts.shift();
    }

    return {
      prompt: promptParts.join(' '),
      model,
      size,
    };
  }

  private findModel(query: string): ModelInfo | null {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    return (
      this.models.find((model) => model.id.toLowerCase() === normalized) ||
      this.models.find((model) => model.name.toLowerCase() === normalized) ||
      this.models.find((model) => model.id.toLowerCase().includes(normalized)) ||
      null
    );
  }
}
