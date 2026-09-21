import type { Category, Rules } from '../config/schema.js';
import type { RawArticle } from './types.js';
import { containsTerm } from '../utils/text.js';

export function classifyArticle(article: RawArticle, rules: Rules): Category {
  const text = `${article.title} ${article.summary}`;
  let bestCategory: Category = article.source.category;
  let bestMatches = 0;

  for (const [category, config] of Object.entries(rules.categories)) {
    const matches = config.terms.filter((term) => containsTerm(text, term)).length;
    if (matches > bestMatches) {
      bestMatches = matches;
      bestCategory = category as Category;
    }
  }

  return bestCategory;
}
