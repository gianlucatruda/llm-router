/**
 * Message input component
 */

export function createMessageInput(onSend: (message: string) => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'input-area';

  const inputContainer = document.createElement('div');
  inputContainer.className = 'input-container';

  const prompt = document.createElement('div');
  prompt.className = 'prompt-prefix';
  prompt.textContent = '>';

  const textarea = document.createElement('textarea');
  textarea.className = 'message-input';
  textarea.placeholder = 'Type your message...';
  textarea.rows = 1;
  textarea.setAttribute('aria-label', 'Message input');

  const sendButton = document.createElement('button');
  sendButton.className = 'send-button';
  sendButton.textContent = 'Send';

  // Auto-grow textarea
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    updateSendState();
  });

  // Send on Enter, newline on Shift+Enter
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      handleSend();
    }
  });

  sendButton.addEventListener('click', handleSend);

  function handleSend() {
    const message = textarea.value.trim();
    if (message && !sendButton.disabled) {
      onSend(message);
      textarea.value = '';
      textarea.style.height = 'auto';
      updateSendState();
    }
  }

  function setDisabled(disabled: boolean) {
    textarea.disabled = disabled;
    sendButton.disabled = disabled;
    updateSendState();
  }

  function updateSendState() {
    const hasValue = textarea.value.trim().length > 0;
    sendButton.disabled = textarea.disabled || !hasValue;
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
  container.appendChild(hint);

  updateSendState();

  return container;
}
