import { describe, expect, it } from 'vitest';
import { articleFingerprint, canonicalizeUrl, containsTerm, normalizeText } from '../src/utils/text.js';

describe('text utilities', () => {
  it('removes common tracking parameters from URLs', () => {
    expect(canonicalizeUrl('https://example.com/news?id=7&utm_source=x&fbclid=abc#top'))
      .toBe('https://example.com/news?id=7');
  });

  it('normalizes titles consistently', () => {
    expect(normalizeText('  NVIDIA: RTX  NEW!  ')).toBe('nvidia rtx new');
  });

  it('matches whole words and phrases, not accidental substrings', () => {
    expect(containsTerm('New phone announced', 'phone')).toBe(true);
    expect(containsTerm('New headphone announced', 'phone')).toBe(false);
  });

  it('deduplicates the same headline across different tracking URLs or publishers', () => {
    expect(articleFingerprint('Same important story', 'https://example.com/a?utm_source=x')).toBe(
      articleFingerprint('Same important story', 'https://another.example/story'),
    );
  });
});
