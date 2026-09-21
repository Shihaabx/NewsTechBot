import { describe, expect, it } from 'vitest';
import { articleFingerprint, canonicalizeUrl, normalizeText } from '../src/utils/text.js';

describe('text utilities', () => {
  it('removes tracking parameters from URLs', () => {
    expect(canonicalizeUrl('https://example.com/news?id=7&utm_source=x#top')).toBe('https://example.com/news?id=7');
  });

  it('normalizes titles consistently', () => {
    expect(normalizeText('  NVIDIA: RTX  NEW!  ')).toBe('nvidia rtx new');
  });

  it('creates stable fingerprints', () => {
    expect(articleFingerprint('Same story', 'https://example.com/a?utm_source=x')).toBe(
      articleFingerprint('Same story', 'https://example.com/a'),
    );
  });
});
