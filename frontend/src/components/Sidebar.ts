/**
 * Sidebar component - conversation list and management
 */

import type { ConversationListItem } from '../types';

export function createSidebar(
  conversations: ConversationListItem[],
  currentConversationId: string | null,
  onNewChat: () => void,
  onSelectConversation: (id: string) => void,
  onDeleteConversation: (id: string) => void
): HTMLElement {
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';

  // Header with new chat button
  const header = document.createElement('div');
  header.className = 'sidebar-header';

  const newChatButton = document.createElement('button');
  newChatButton.className = 'new-chat-button';
  newChatButton.textContent = '+ New Chat';
  newChatButton.addEventListener('click', onNewChat);

  header.appendChild(newChatButton);
  sidebar.appendChild(header);

  // Conversation list
  const listContainer = document.createElement('div');
  listContainer.className = 'conversation-list';

  if (conversations.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align: center; color: var(--text-secondary); padding: 20px; font-size: 14px;';
    empty.textContent = 'No conversations yet';
    listContainer.appendChild(empty);
  } else {
    conversations.forEach(conv => {
      const item = document.createElement('div');
      item.className = 'conversation-item';
      if (conv.id === currentConversationId) {
        item.classList.add('active');
      }

      const title = document.createElement('div');
      title.className = 'conversation-title';
      title.textContent = conv.title;

      const meta = document.createElement('div');
      meta.className = 'conversation-meta';
      const date = new Date(conv.updated_at * 1000);
      meta.textContent = `${conv.model} • ${formatDate(date)}`;

      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-button';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this conversation?')) {
          onDeleteConversation(conv.id);
        }
      });

      item.appendChild(title);
      item.appendChild(meta);
      item.appendChild(deleteButton);

      item.addEventListener('click', () => {
        onSelectConversation(conv.id);
      });

      listContainer.appendChild(item);
    });
  }

  sidebar.appendChild(listContainer);

  return sidebar;
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
