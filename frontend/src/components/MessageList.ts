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

export function createMessageList(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'messages-container';
  container.id = 'messages';

  return container;
}

export function renderMessages(container: HTMLElement, messages: Message[]): void {
  container.innerHTML = '';

  if (messages.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align: center; color: var(--text-secondary); margin-top: 40px;';
    empty.textContent = 'Type your first command to start the session';
    container.appendChild(empty);
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
      contentEl.innerHTML = marked.parse(message.content) as string;
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

    // Add metadata if available
    if (message.cost !== undefined && message.cost !== null) {
      const metaEl = document.createElement('div');
      metaEl.className = 'message-meta';
      const tokens = (message.tokens_input || 0) + (message.tokens_output || 0);
      metaEl.textContent = `${tokens.toLocaleString()} tokens • $${message.cost.toFixed(4)}`;
      messageEl.appendChild(metaEl);
    }

    container.appendChild(messageEl);
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

export function appendToken(container: HTMLElement, token: string): void {
  const lastMessage = container.querySelector('.message:last-child .message-content');
  if (lastMessage) {
    lastMessage.textContent += token;
    container.scrollTop = container.scrollHeight;
  }
}

export function renderStreamingMessage(container: HTMLElement, content: string): void {
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

  container.scrollTop = container.scrollHeight;
}
