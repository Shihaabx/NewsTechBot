import type { Category } from '../config/schema.js';
import type { RuntimeSettings } from '../control/settings.js';

export function channelIdForCategory(category: Category, settings: RuntimeSettings): string | undefined {
  const mapping: Record<Category, string | undefined> = {
    ai: settings.channels.ai,
    'pc-hardware': settings.channels.pcHardware,
    'windows-software': settings.channels.windowsSoftware,
    'gaming-tech': settings.channels.gamingTech,
    cybersecurity: settings.channels.cybersecurity,
    'general-tech': settings.channels.generalTech,
  };
  return mapping[category];
}
