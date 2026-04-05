import '@xterm/xterm/css/xterm.css';
import './styles/main.css';
import { mountBrowserTerminal } from './components/BrowserTerminal';

async function init() {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('App container not found');
    return;
  }

  try {
    await mountBrowserTerminal(appContainer);
  } catch (error) {
    console.error('Failed to initialize app:', error);
    appContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #ff8b7d;">
        <h2>Failed to initialize terminal</h2>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    `;
  }
}

init();
