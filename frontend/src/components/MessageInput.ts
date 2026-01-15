/**
 * Message input component
 */

export function createMessageInput(onSend: (message: string) => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'input-area';

  const inputContainer = document.createElement('div');
  inputContainer.className = 'input-container';

  const textarea = document.createElement('textarea');
  textarea.className = 'message-input';
  textarea.placeholder = 'Type your message...';
  textarea.rows = 1;

  const sendButton = document.createElement('button');
  sendButton.className = 'send-button';
  sendButton.textContent = 'Send';

  // Auto-grow textarea
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  });

  // Send on Ctrl/Cmd + Enter
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  });

  sendButton.addEventListener('click', handleSend);

  function handleSend() {
    const message = textarea.value.trim();
    if (message) {
      onSend(message);
      textarea.value = '';
      textarea.style.height = 'auto';
    }
  }

  function setDisabled(disabled: boolean) {
    textarea.disabled = disabled;
    sendButton.disabled = disabled;
  }

  // Expose methods
  (container as any).setDisabled = setDisabled;

  inputContainer.appendChild(textarea);
  inputContainer.appendChild(sendButton);
  container.appendChild(inputContainer);

  return container;
}
