import type { Category } from './config/schema.js';

export const BRAND = {
  name: 'NewsTech',
  workspace: 'Juraa Tech Newsroom',
  signature: 'JURAA TECH • NEWS INTELLIGENCE',
  colors: {
    primary: 0xFF6A00,
    dark: 0x111315,
    light: 0xF7F7F5,
    muted: 0x9CA3AF,
  },
} as const;

const categoryMeta: Record<Category, { label: string; emoji: string }> = {
  ai: { label: 'AI', emoji: '🤖' },
  'pc-hardware': { label: 'PC & Hardware', emoji: '🖥️' },
  'windows-software': { label: 'Windows & Software', emoji: '🪟' },
  'gaming-tech': { label: 'Gaming Tech', emoji: '🎮' },
  cybersecurity: { label: 'Cybersecurity', emoji: '🛡️' },
  'general-tech': { label: 'General Tech', emoji: '⚙️' },
};

export function getCategoryMeta(category: Category) {
  return categoryMeta[category];
}

export function getPriorityLabel(score: number) {
  if (score >= 85) return '🔥 High priority';
  if (score >= 72) return '⚡ Strong story';
  return '📰 Worth reviewing';
}
