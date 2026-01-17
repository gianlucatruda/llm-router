/**
 * Slash command registry and helpers.
 */

import type { ModelInfo } from './types';

export type CommandId = 'help' | 'model' | 'temp' | 'reasoning' | 'system' | 'image';

export interface CommandDefinition {
  id: CommandId;
  usage: string;
  description: string;
}

export interface CommandSuggestion {
  value: string;
  label: string;
}

export const COMMANDS: CommandDefinition[] = [
  {
    id: 'help',
    usage: '/help',
    description: 'Show available commands and tips',
  },
  {
    id: 'model',
    usage: '/model <name>',
    description: 'Switch the active model',
  },
  {
    id: 'temp',
    usage: '/temp <0-2>',
    description: 'Set sampling temperature',
  },
  {
    id: 'reasoning',
    usage: '/reasoning <level>',
    description: 'Set reasoning level',
  },
  {
    id: 'system',
    usage: '/system <text>',
    description: 'Append to the default system message for this conversation',
  },
  {
    id: 'image',
    usage: '/image <prompt> [model=...] [size=...]',
    description: 'Generate an image (OpenAI only)',
  },
];

export function getCommandHelp(): string {
  const lines = COMMANDS.map((cmd) => `- \`${cmd.usage}\` — ${cmd.description}`);
  return [
    '**Commands**',
    ...lines,
    '',
    '**Tips**',
    '- Use `/model` with autocomplete to pick quickly.',
    '- `/reasoning` depends on model capabilities.',
    '- `/image` defaults to DALL·E 3, size 1024x1024.',
    '- Press `Shift+Enter` for a newline.',
  ].join('\n');
}

export function parseCommand(input: string): { id: CommandId; arg: string } | null {
  if (!input.startsWith('/')) {
    return null;
  }
  const [rawCommand, ...rest] = input.trim().split(/\s+/);
  const command = rawCommand.slice(1).toLowerCase();
  if (!['help', 'model', 'temp', 'reasoning', 'system', 'image'].includes(command)) {
    return null;
  }
  return {
    id: command as CommandId,
    arg: rest.join(' '),
  };
}

export function getCommandSuggestions(
  input: string,
  models: ModelInfo[],
  reasoningLevels: string[]
): CommandSuggestion[] {
  if (!input.startsWith('/')) {
    return [];
  }
  const [rawCommand, ...rest] = input.trim().split(/\s+/);
  const command = rawCommand.slice(1).toLowerCase();
  const value = rest.join(' ').toLowerCase();

  if (!command || rawCommand === '/') {
    return COMMANDS.map((cmd) => ({ value: `/${cmd.id}`, label: cmd.usage }));
  }

  if (command === 'model') {
    return models
      .filter((model) => model.id.toLowerCase().includes(value) || model.name.toLowerCase().includes(value))
      .slice(0, 8)
      .map((model) => ({
        value: `/model ${model.id}`,
        label: `${model.name} (${model.id})`,
      }));
  }

  if (command === 'reasoning') {
    return reasoningLevels
      .filter((level) => level.toLowerCase().includes(value))
      .map((level) => ({
        value: `/reasoning ${level}`,
        label: level,
      }));
  }

  if (command === 'temp') {
    return ['0.0', '0.2', '0.7', '1.0', '1.5']
      .filter((val) => val.startsWith(value))
      .map((val) => ({ value: `/temp ${val}`, label: val }));
  }

  if (command === 'image') {
    const base = value ? value : 'prompt';
    return [
      { value: `/image ${base} model=dall-e-3 size=1024x1024`, label: 'DALL·E 3 1024x1024' },
      { value: `/image ${base} model=dall-e-2 size=1024x1024`, label: 'DALL·E 2 1024x1024' },
      { value: `/image ${base} model=gpt-image-1 size=1024x1024`, label: 'gpt-image-1 1024x1024' },
    ];
  }

  return COMMANDS.filter((cmd) => cmd.id.startsWith(command as CommandId)).map((cmd) => ({
    value: `/${cmd.id}`,
    label: cmd.usage,
  }));
}
