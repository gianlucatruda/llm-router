/**
 * Message list component - displays conversation messages
 */

import { marked } from 'marked';
import hljs from 'highlight.js';
import type { Message } from '../types';

// Configure marked renderer for code highlighting
const renderer = new marked.Renderer();
renderer.code = function(code: string, language: string | undefined) {
  if (language && hljs.getLanguage(language)) {
    const highlighted = hljs.highlight(code, { language }).value;
    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
  }
  const highlighted = hljs.highlightAuto(code).value;
  return `<pre><code class="hljs">${highlighted}</code></pre>`;
};

marked.setOptions({ renderer });

const AUTO_SCROLL_THRESHOLD = 80;

export function createMessageList(): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'messages-shell';

  const container = document.createElement('div');
  container.className = 'messages-container';
  container.id = 'messages';
  container.dataset.autoscroll = 'true';

  const jumpButton = document.createElement('button');
  jumpButton.type = 'button';
  jumpButton.className = 'jump-latest';
  jumpButton.textContent = 'Jump to latest';
  jumpButton.addEventListener('click', () => {
    scrollToBottom(container);
    setAutoScroll(container, true, jumpButton);
  });

  container.addEventListener('scroll', () => {
    setAutoScroll(container, isNearBottom(container), jumpButton);
  });

  shell.appendChild(container);
  shell.appendChild(jumpButton);

  setAutoScroll(container, true, jumpButton);
  return shell;
}

export function renderMessages(container: HTMLElement, messages: Message[]): void {
  const shouldScroll = shouldAutoScroll(container);
  const previousScrollTop = container.scrollTop;
  const previousScrollHeight = container.scrollHeight;
  const jumpButton = getJumpButton(container);
  container.innerHTML = '';

  if (messages.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align: center; color: var(--text-secondary); margin-top: 40px;';
    empty.textContent = 'Type /help for commands';
    container.appendChild(empty);
    if (shouldScroll) {
      scrollToBottom(container);
      setAutoScroll(container, true, jumpButton);
    } else {
      setAutoScroll(container, false, jumpButton);
    }
    return;
  }

  messages.forEach(message => {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.role}`;

    const roleEl = document.createElement('div');
    roleEl.className = 'message-role';
    roleEl.textContent =
      message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Assistant' : 'System';

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';

    // Render markdown for assistant/system messages
    if (message.role === 'assistant' || message.role === 'system') {
      if (message.status === 'pending-image') {
        const details = message.content
          .split('\n')
          .map((line) => `<div class="image-status-line">${line}</div>`)
          .join('');
        contentEl.innerHTML = `
          <div class="image-status">
            <span class="spinner" aria-hidden="true"></span>
            <span>Generating image...</span>
          </div>
          <div class="image-status-details">${details}</div>
        `;
      } else {
        contentEl.innerHTML = marked.parse(message.content) as string;
      }
    } else {
      contentEl.textContent = message.content;
    }

    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.textContent = 'Copy';
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(message.content);
        copyButton.textContent = 'Copied';
        setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 1500);
      } catch (error) {
        copyButton.textContent = 'Failed';
      }
    });

    messageEl.appendChild(roleEl);
    messageEl.appendChild(contentEl);
    messageEl.appendChild(copyButton);

    if (message.role === 'assistant') {
      const metaEl = document.createElement('div');
      metaEl.className = 'message-meta';
      metaEl.textContent = formatMeta(message);
      messageEl.appendChild(metaEl);
    }

    container.appendChild(messageEl);
  });

  if (shouldScroll) {
    scrollToBottom(container);
    setAutoScroll(container, true, jumpButton);
  } else {
    const delta = container.scrollHeight - previousScrollHeight;
    container.scrollTop = previousScrollTop + delta;
    setAutoScroll(container, false, jumpButton);
  }
}

export function appendToken(container: HTMLElement, token: string): void {
  const lastMessage = container.querySelector('.message:last-child .message-content');
  if (lastMessage) {
    lastMessage.textContent += token;
    if (shouldAutoScroll(container)) {
      scrollToBottom(container);
      setAutoScroll(container, true, getJumpButton(container));
    }
  }
}

export function renderStreamingMessage(
  container: HTMLElement,
  content: string,
  meta?: string
): void {
  let lastMessage = container.querySelector('.message.assistant:last-child');

  if (!lastMessage) {
    lastMessage = document.createElement('div');
    lastMessage.className = 'message assistant';

    const roleEl = document.createElement('div');
    roleEl.className = 'message-role';
    roleEl.textContent = 'Assistant';

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';

    lastMessage.appendChild(roleEl);
    lastMessage.appendChild(contentEl);
    container.appendChild(lastMessage);
  }

  const contentEl = lastMessage.querySelector('.message-content');
  if (contentEl) {
    // Render markdown as we stream
    contentEl.innerHTML = marked.parse(content) as string;
  }

  if (meta) {
    let metaEl = lastMessage.querySelector('.message-meta');
    if (!metaEl) {
      metaEl = document.createElement('div');
      metaEl.className = 'message-meta';
      lastMessage.appendChild(metaEl);
    }
    metaEl.textContent = meta;
  }

  if (shouldAutoScroll(container)) {
    scrollToBottom(container);
    setAutoScroll(container, true, getJumpButton(container));
  }
}

function formatMeta(message: Message): string {
  const parts: string[] = [];
  if (message.status && message.status !== 'complete') {
    parts.push(message.status);
  }
  if (message.model) {
    parts.push(message.model);
  }
  if (message.temperature !== undefined && message.temperature !== null) {
    parts.push(`temp ${message.temperature.toFixed(2)}`);
  }
  if (message.reasoning) {
    parts.push(`reasoning ${message.reasoning}`);
  }
  if (message.cost !== undefined && message.cost !== null) {
    const tokens = (message.tokens_input || 0) + (message.tokens_output || 0);
    parts.push(`${tokens.toLocaleString()} tokens`);
    parts.push(`$${message.cost.toFixed(4)}`);
  }
  if (parts.length === 0) {
    return 'No metadata';
  }
  return parts.join(' • ');
}

function isNearBottom(container: HTMLElement): boolean {
  return container.scrollHeight - container.scrollTop - container.clientHeight <= AUTO_SCROLL_THRESHOLD;
}

function shouldAutoScroll(container: HTMLElement): boolean {
  return container.dataset.autoscroll !== 'false';
}

function setAutoScroll(
  container: HTMLElement,
  enabled: boolean,
  button?: HTMLElement | null
): void {
  container.dataset.autoscroll = enabled ? 'true' : 'false';
  if (button) {
    button.classList.toggle('visible', !enabled);
  }
}

function scrollToBottom(container: HTMLElement): void {
  container.scrollTop = container.scrollHeight;
}

function getJumpButton(container: HTMLElement): HTMLElement | null {
  return container.parentElement?.querySelector('.jump-latest') as HTMLElement | null;
}
