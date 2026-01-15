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
      option.textContent = `${model.name} ($${model.input_cost}/$${model.output_cost} per 1K tokens)`;
      option.selected = model.id === selectedModel;
      optgroup.appendChild(option);
    });

    select.appendChild(optgroup);
  });

  select.addEventListener('change', () => {
    onChange(select.value);
  });

  container.appendChild(select);

  return container;
}
