import crypto from 'node:crypto';

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function containsTerm(haystack: string, term: string): boolean {
  const normalizedHaystack = normalizeText(haystack);
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;
  return ` ${normalizedHaystack} `.includes(` ${normalizedTerm} `);
}

export function articleFingerprint(title: string, url: string): string {
  const normalizedTitle = normalizeText(title);
  const identity = normalizedTitle.length >= 12 ? normalizedTitle : canonicalizeUrl(url);
  return crypto.createHash('sha256').update(identity).digest('hex').slice(0, 24);
}

export function canonicalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    [
      'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
      'ref','source','fbclid','gclid',
    ].forEach((key) => url.searchParams.delete(key));
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.trim();
  }
}
