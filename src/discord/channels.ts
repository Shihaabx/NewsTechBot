import type { Category } from '../config/schema.js';

export function channelIdForCategory(category: Category): string | undefined {
  const mapping: Record<Category, string | undefined> = {
    'ai': process.env.DISCORD_CHANNEL_AI,
    'pc-hardware': process.env.DISCORD_CHANNEL_PC_HARDWARE,
    'windows-software': process.env.DISCORD_CHANNEL_WINDOWS_SOFTWARE,
    'gaming-tech': process.env.DISCORD_CHANNEL_GAMING_TECH,
    'cybersecurity': process.env.DISCORD_CHANNEL_CYBERSECURITY,
    'general-tech': process.env.DISCORD_CHANNEL_GENERAL_TECH,
  };
  return mapping[category];
}
