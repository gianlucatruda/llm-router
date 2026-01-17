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
  onCommand: (command: string) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'model-selector-container';

  const current = models.find((model) => model.id === selectedModel);

  const meta = document.createElement('div');
  meta.className = 'model-meta';

  const updateMeta = () => {
    const currentMeta = models.find(model => model.id === selectedModel);
    if (!currentMeta) {
      meta.textContent = '';
      return;
    }
    const provider = currentMeta.provider.charAt(0).toUpperCase() + currentMeta.provider.slice(1);
    const pricing = currentMeta.input_cost || currentMeta.output_cost
      ? `$${currentMeta.input_cost}/$${currentMeta.output_cost} per 1K`
      : 'Pricing unknown';
    const source = currentMeta.source === 'live' ? 'live' : 'fallback';
    const availability = currentMeta.available ? 'available' : 'unverified';
    meta.textContent = `${provider} • ${pricing} • ${source} • ${availability}`;
  };

  updateMeta();

  const controls = document.createElement('div');
  controls.className = 'model-controls';

  const header = document.createElement('div');
  header.className = 'model-header';

  const modelButton = document.createElement('button');
  modelButton.className = 'control-link';
  modelButton.type = 'button';
  modelButton.textContent = current ? `Model ${current.name}` : 'Model';
  modelButton.addEventListener('click', () => {
    onCommand('/model ');
  });

  header.appendChild(modelButton);

  const tempChip = document.createElement('button');
  tempChip.type = 'button';
  tempChip.className = 'control-chip control-link';
  tempChip.textContent = current?.supports_temperature ? `Temp ${temperature.toFixed(2)}` : 'Temp n/a';
  tempChip.disabled = !current?.supports_temperature;
  tempChip.addEventListener('click', () => {
    if (current?.supports_temperature) {
      onCommand('/temp ');
    }
  });

  const reasoningChip = document.createElement('button');
  reasoningChip.type = 'button';
  reasoningChip.className = 'control-chip control-link';
  if (current && current.reasoning_levels.length > 0) {
    reasoningChip.textContent = `Reasoning ${reasoning}`;
  } else {
    reasoningChip.textContent = 'Reasoning n/a';
  }
  reasoningChip.disabled = !(current && current.reasoning_levels.length > 0);
  reasoningChip.addEventListener('click', () => {
    if (current && current.reasoning_levels.length > 0) {
      onCommand('/reasoning ');
    }
  });

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

  container.appendChild(header);
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
