/**
 * Model selector component
 */

import type { ModelInfo } from '../types';

export function createModelSelector(
  models: ModelInfo[],
  selectedModel: string,
  onChange: (model: string) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'model-selector-container';

  const label = document.createElement('div');
  label.className = 'model-selector-label';
  label.textContent = 'Model';

  const select = document.createElement('select');
  select.className = 'model-selector';

  // Group models by provider
  const byProvider: Record<string, ModelInfo[]> = {};
  models.forEach(model => {
    if (!byProvider[model.provider]) {
      byProvider[model.provider] = [];
    }
    byProvider[model.provider].push(model);
  });

  // Add options grouped by provider
  Object.entries(byProvider).forEach(([provider, providerModels]) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = provider.charAt(0).toUpperCase() + provider.slice(1);

    providerModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      option.selected = model.id === selectedModel;
      optgroup.appendChild(option);
    });

    select.appendChild(optgroup);
  });

  const meta = document.createElement('div');
  meta.className = 'model-meta';

  const updateMeta = () => {
    const current = models.find(model => model.id === select.value);
    if (!current) {
      meta.textContent = '';
      return;
    }
    const provider = current.provider.charAt(0).toUpperCase() + current.provider.slice(1);
    meta.textContent = `${provider} • $${current.input_cost}/$${current.output_cost} per 1K tokens`;
  };

  select.addEventListener('change', () => {
    onChange(select.value);
    updateMeta();
  });

  updateMeta();

  container.appendChild(label);
  container.appendChild(select);
  container.appendChild(meta);

  return container;
}
