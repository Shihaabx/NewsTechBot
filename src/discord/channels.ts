import type { Category } from '../config/schema.js';
import type { AppEnv } from '../config/env.js';

export function channelIdForCategory(category: Category, env: AppEnv): string | undefined {
  const mapping: Record<Category, string | undefined> = {
    ai: env.DISCORD_CHANNEL_AI,
    'pc-hardware': env.DISCORD_CHANNEL_PC_HARDWARE,
    'windows-software': env.DISCORD_CHANNEL_WINDOWS_SOFTWARE,
    'gaming-tech': env.DISCORD_CHANNEL_GAMING_TECH,
    cybersecurity: env.DISCORD_CHANNEL_CYBERSECURITY,
    'general-tech': env.DISCORD_CHANNEL_GENERAL_TECH,
  };
  return mapping[category];
}
