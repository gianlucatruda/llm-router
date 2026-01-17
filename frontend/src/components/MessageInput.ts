/**
 * Message input component
 */

import type { CommandSuggestion } from '../commands';

export function createMessageInput(
  onSend: (message: string) => void,
  onCommand: (input: string) => boolean,
  getSuggestions: (input: string) => CommandSuggestion[],
  onHistory: (direction: number) => string | null
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'input-area';

  const inputContainer = document.createElement('div');
  inputContainer.className = 'input-container';

  const prompt = document.createElement('div');
  prompt.className = 'prompt-prefix';
  prompt.textContent = '>';

  const textarea = document.createElement('textarea');
  textarea.className = 'message-input';
  textarea.placeholder = 'Type /help for help';
  textarea.rows = 1;
  textarea.setAttribute('aria-label', 'Message input');

  const suggestionBox = document.createElement('div');
  suggestionBox.className = 'command-suggestions';
  suggestionBox.style.display = 'none';

  const sendButton = document.createElement('button');
  sendButton.className = 'send-button';
  sendButton.textContent = 'Send';

  // Auto-grow textarea
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    updateSendState();
    updateSuggestions();
  });

  // Send on Enter, newline on Shift+Enter
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && suggestionBox.style.display === 'none') {
      const atStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0;
      if (atStart) {
        e.preventDefault();
        const value = onHistory(-1);
        if (value !== null) {
          textarea.value = value;
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
          updateSuggestions();
          updateSendState();
        }
        return;
      }
    }
    if (e.key === 'ArrowDown' && suggestionBox.style.display === 'none') {
      const atEnd =
        textarea.selectionStart === textarea.value.length &&
        textarea.selectionEnd === textarea.value.length;
      if (atEnd) {
        e.preventDefault();
        const value = onHistory(1);
        if (value !== null) {
          textarea.value = value;
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
          updateSuggestions();
          updateSendState();
        }
        return;
      }
    }
    if (e.key === 'ArrowDown' && suggestionBox.style.display !== 'none') {
      e.preventDefault();
      moveSelection(1);
      return;
    }
    if (e.key === 'ArrowUp' && suggestionBox.style.display !== 'none') {
      e.preventDefault();
      moveSelection(-1);
      return;
    }
    if (e.key === 'Tab' && suggestionBox.style.display !== 'none') {
      e.preventDefault();
      applySelection();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      handleSend();
    }
  });

  sendButton.addEventListener('click', handleSend);

  function handleSend() {
    const message = textarea.value.trim();
    if (message && !sendButton.disabled) {
      if (message.startsWith('/')) {
        const handled = onCommand(message);
        if (handled) {
          textarea.value = '';
          textarea.style.height = 'auto';
          textarea.focus();
          updateSuggestions();
          updateSendState();
          return;
        }
      }
      onSend(message);
      textarea.value = '';
      textarea.style.height = 'auto';
      textarea.focus();
      updateSuggestions();
      updateSendState();
    }
  }

  let locked = false;

  function setDisabled(disabled: boolean) {
    locked = disabled;
    textarea.disabled = false;
    updateSendState();
  }

  function updateSendState() {
    const hasValue = textarea.value.trim().length > 0;
    sendButton.disabled = locked || !hasValue;
  }

  let selectedIndex = -1;

  function updateSuggestions() {
    const value = textarea.value.trim();
    const suggestions = getSuggestions(value);
    suggestionBox.innerHTML = '';
    selectedIndex = -1;
    if (suggestions.length === 0) {
      suggestionBox.style.display = 'none';
      return;
    }
    suggestions.forEach((item, index) => {
      const row = document.createElement('button');
      row.className = 'suggestion-item';
      row.type = 'button';
      row.textContent = item.label;
      row.dataset.value = item.value;
      row.addEventListener('click', () => {
        textarea.value = item.value + ' ';
        textarea.focus();
        updateSuggestions();
        updateSendState();
      });
      if (index === 0) {
        row.classList.add('active');
        selectedIndex = 0;
      }
      suggestionBox.appendChild(row);
    });
    suggestionBox.style.display = 'block';
  }

  function moveSelection(delta: number) {
    const items = suggestionBox.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;
    selectedIndex = (selectedIndex + delta + items.length) % items.length;
    items.forEach((item, index) => {
      item.classList.toggle('active', index === selectedIndex);
    });
  }

  function applySelection() {
    const items = suggestionBox.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;
    const selected = items[selectedIndex] as HTMLButtonElement;
    if (!selected) return;
    const value = selected.dataset.value;
    if (!value) return;
    textarea.value = value + ' ';
    textarea.focus();
    updateSuggestions();
    updateSendState();
  }

  const hint = document.createElement('div');
  hint.className = 'input-hint';
  hint.textContent = 'Enter to send • Shift+Enter for newline';

  // Expose methods
  (container as any).setDisabled = setDisabled;

  inputContainer.appendChild(prompt);
  inputContainer.appendChild(textarea);
  inputContainer.appendChild(sendButton);
  container.appendChild(inputContainer);
  container.appendChild(suggestionBox);
  container.appendChild(hint);

  updateSendState();
  setTimeout(() => {
    textarea.focus();
  }, 0);

  return container;
}
