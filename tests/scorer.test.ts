import { describe, expect, it } from 'vitest';
import { scoreArticle } from '../src/core/scorer.js';
import type { Rules } from '../src/config/schema.js';

const rules: Rules = {
  blocked_topics: ['iphone', 'smartphone'],
  high_value_terms: ['release', 'rtx', 'vulnerability'],
  breaking_terms: ['zero-day', 'critical vulnerability'],
  low_value_terms: ['giveaway'],
  categories: {
    ai: { terms: ['openai', 'ai model'] },
    'pc-hardware': { terms: ['nvidia', 'rtx', 'gpu'] },
  },
};

const source = { id: 'nvidia', name: 'NVIDIA', url: 'https://example.com/rss', category: 'pc-hardware' as const, trust: 100, enabled: true, official: true };

describe('scoreArticle', () => {
  it('gives official high-value hardware news a strong score', () => {
    const result = scoreArticle({ source, title: 'NVIDIA announces RTX GPU release', url: 'https://example.com/a', summary: '', publishedAt: new Date() }, rules);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.category).toBe('pc-hardware');
    expect(result.blocked).toBe(false);
  });

  it('blocks phone topics', () => {
    const result = scoreArticle({ source, title: 'New iPhone release', url: 'https://example.com/b', summary: '' }, rules);
    expect(result.blocked).toBe(true);
  });

  it('flags critical security news as breaking', () => {
    const result = scoreArticle({ source, title: 'Critical vulnerability zero-day discovered', url: 'https://example.com/c', summary: '' }, rules);
    expect(result.breaking).toBe(true);
  });
});
