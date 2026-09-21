import type { Rules } from '../config/schema.js';
import type { RawArticle, ScoredArticle } from './types.js';
import { classifyArticle } from './classifier.js';
import { articleFingerprint, containsTerm } from '../utils/text.js';

function ageHours(date?: Date): number | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return Math.max(0, (Date.now() - date.getTime()) / 3_600_000);
}

function countCategorySignals(text: string, rules: Rules): number {
  const unique = new Set<string>();
  for (const config of Object.values(rules.categories)) {
    for (const term of config.terms) {
      if (containsTerm(text, term)) unique.add(term.toLowerCase());
    }
  }
  return unique.size;
}

export function scoreArticle(article: RawArticle, rules: Rules): ScoredArticle {
  const text = `${article.title} ${article.summary}`;
  const reasons: string[] = [];

  const blockedTerm = rules.blocked_topics.find((term) => containsTerm(text, term));
  const blocked = Boolean(blockedTerm);
  if (blockedTerm) reasons.push(`blocked:${blockedTerm}`);

  let score = 8;
  score += Math.round(article.source.trust * 0.20);

  if (article.source.official) {
    score += 10;
    reasons.push('official-source');
  }

  const relevanceHits = countCategorySignals(text, rules);
  score += Math.min(20, relevanceHits * 5);
  if (relevanceHits > 0) reasons.push(`tech-signals:${relevanceHits}`);

  const highHits = rules.high_value_terms.filter((term) => containsTerm(text, term));
  score += Math.min(30, highHits.length * 10);
  if (highHits.length) reasons.push(`high-value:${highHits.slice(0, 3).join(',')}`);

  const breakingHits = rules.breaking_terms.filter((term) => containsTerm(text, term));
  score += Math.min(30, breakingHits.length * 15);
  const breaking = breakingHits.length > 0;
  if (breaking) reasons.push(`breaking:${breakingHits.slice(0, 2).join(',')}`);

  const lowHits = rules.low_value_terms.filter((term) => containsTerm(text, term));
  score -= Math.min(45, lowHits.length * 15);
  if (lowHits.length) reasons.push(`low-value:${lowHits.slice(0, 3).join(',')}`);

  const hours = ageHours(article.publishedAt);
  if (hours === null) {
    score -= 3;
    reasons.push('missing-date');
  } else if (hours <= 6) {
    score += 8;
    reasons.push('fresh:<6h');
  } else if (hours <= 24) {
    score += 4;
    reasons.push('fresh:<24h');
  } else if (hours > 72) {
    score -= 10;
    reasons.push('stale:>72h');
  }

  if (article.title.length >= 20 && article.title.length <= 140) score += 2;

  if (relevanceHits === 0 && highHits.length === 0 && breakingHits.length === 0) {
    score -= 25;
    reasons.push('weak-tech-signal');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    ...article,
    category: classifyArticle(article, rules),
    score,
    breaking,
    blocked,
    reasons,
    fingerprint: articleFingerprint(article.title, article.url),
  };
}
