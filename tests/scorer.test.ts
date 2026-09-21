import { describe, expect, it } from 'vitest';
import { scoreArticle } from '../src/core/scorer.js';
import type { Rules } from '../src/config/schema.js';

const rules: Rules = {
  blocked_topics: ['iphone', 'phone'],
  high_value_terms: ['release', 'rtx', 'vulnerability'],
  breaking_terms: ['zero-day', 'critical vulnerability'],
  low_value_terms: ['giveaway'],
  categories: {
    ai: { terms: ['openai', 'ai model'] },
    'pc-hardware': { terms: ['nvidia', 'rtx', 'gpu'] },
  },
};

const officialSource = {
  id: 'nvidia',
  name: 'NVIDIA',
  url: 'https://example.com/rss',
  category: 'pc-hardware' as const,
  trust: 100,
  enabled: true,
  official: true,
};

describe('scoreArticle', () => {
  it('gives important official hardware news a strong score', () => {
    const result = scoreArticle({
      source: officialSource,
      title: 'NVIDIA announces RTX GPU release',
      url: 'https://example.com/a',
      summary: '',
      publishedAt: new Date(),
    }, rules);

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.category).toBe('pc-hardware');
    expect(result.blocked).toBe(false);
  });

  it('does not promote a generic official post with no strong tech signal', () => {
    const result = scoreArticle({
      source: officialSource,
      title: 'Our company celebrates a community event',
      url: 'https://example.com/generic',
      summary: 'A recap of our community activities.',
      publishedAt: new Date(),
    }, rules);

    expect(result.score).toBeLessThan(58);
  });

  it('blocks phone topics without blocking words such as headphone', () => {
    const phone = scoreArticle({
      source: officialSource,
      title: 'New iPhone release',
      url: 'https://example.com/b',
      summary: '',
    }, rules);

    const headphone = scoreArticle({
      source: officialSource,
      title: 'New headphone GPU audio processing feature',
      url: 'https://example.com/headphone',
      summary: 'NVIDIA GPU audio technology',
      publishedAt: new Date(),
    }, rules);

    expect(phone.blocked).toBe(true);
    expect(headphone.blocked).toBe(false);
  });

  it('flags critical security news as breaking', () => {
    const result = scoreArticle({
      source: officialSource,
      title: 'Critical vulnerability zero-day discovered',
      url: 'https://example.com/c',
      summary: 'GPU driver vulnerability',
      publishedAt: new Date(),
    }, rules);

    expect(result.breaking).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });
});
