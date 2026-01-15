/**
 * Main entry point for LLM Router frontend
 */

import './styles/main.css';
import { createChatInterface } from './components/ChatInterface';

async function init() {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('App container not found');
    return;
  }

  try {
    const chatInterface = await createChatInterface();
    appContainer.replaceWith(chatInterface);
  } catch (error) {
    console.error('Failed to initialize app:', error);
    appContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #da3633;">
        <h2>Failed to initialize application</h2>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    `;
  }
}

init();
