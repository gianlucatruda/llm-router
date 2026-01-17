/**
 * Model selector component
 */

import type { ModelInfo, UsageSummary } from '../types';

export function createModelSelector(
  models: ModelInfo[],
  selectedModel: string,
  temperature: number,
  reasoning: string,
  usageDevice: UsageSummary | null,
  usageOverall: UsageSummary | null,
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
    const pricing = current.input_cost || current.output_cost
      ? `$${current.input_cost}/$${current.output_cost} per 1K`
      : 'Pricing unknown';
    const source = current.source === 'live' ? 'live' : 'fallback';
    const availability = current.available ? 'available' : 'unverified';
    meta.textContent = `${provider} • ${pricing} • ${source} • ${availability}`;
  };

  select.addEventListener('change', () => {
    onChange(select.value);
    updateMeta();
  });

  updateMeta();

  const controls = document.createElement('div');
  controls.className = 'model-controls';

  const current = models.find((model) => model.id === selectedModel);
  const tempChip = document.createElement('div');
  tempChip.className = 'control-chip';
  tempChip.textContent = current?.supports_temperature ? `Temp ${temperature.toFixed(2)}` : 'Temp n/a';

  const reasoningChip = document.createElement('div');
  reasoningChip.className = 'control-chip';
  if (current && current.reasoning_levels.length > 0) {
    reasoningChip.textContent = `Reasoning ${reasoning}`;
  } else {
    reasoningChip.textContent = 'Reasoning n/a';
  }

  controls.appendChild(tempChip);
  controls.appendChild(reasoningChip);

  const deviceChip = document.createElement('div');
  deviceChip.className = 'control-chip control-chip-usage';
  deviceChip.textContent = formatUsage('Device', usageDevice);

  const overallChip = document.createElement('div');
  overallChip.className = 'control-chip control-chip-usage';
  overallChip.textContent = formatUsage('Overall', usageOverall);

  controls.appendChild(deviceChip);
  controls.appendChild(overallChip);

  container.appendChild(label);
  container.appendChild(select);
  container.appendChild(meta);
  container.appendChild(controls);

  return container;
}

function formatUsage(label: string, usage: UsageSummary | null): string {
  if (!usage) {
    return `${label}: ...`;
  }
  const tokens = usage.total_tokens_input + usage.total_tokens_output;
  const tokenLabel = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`;
  return `${label}: ${tokenLabel} • $${usage.total_cost.toFixed(4)}`;
}
