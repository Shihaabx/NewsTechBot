import type { Category, NewsSource } from '../config/schema.js';

export interface RawArticle {
  source: NewsSource;
  title: string;
  url: string;
  summary: string;
  publishedAt?: Date;
  author?: string;
}

export interface ScoredArticle extends RawArticle {
  category: Category;
  score: number;
  breaking: boolean;
  blocked: boolean;
  reasons: string[];
  fingerprint: string;
}
