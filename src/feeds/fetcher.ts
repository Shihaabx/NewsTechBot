import Parser from 'rss-parser';
import { setTimeout as sleep } from 'node:timers/promises';
import type { NewsSource } from '../config/schema.js';
import type { RawArticle } from '../core/types.js';

const parser = new Parser({
  timeout: 15_000,
  headers: {
    'User-Agent': 'NewsTech/0.2 (Juraa Tech Newsroom)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  },
});

function cleanSummary(value: unknown): string {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1600);
}

export async function fetchSource(source: NewsSource, attempts = 2): Promise<RawArticle[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const feed = await parser.parseURL(source.url);
      return feed.items
        .filter((item) => item.title && item.link)
        .map((item) => ({
          source,
          title: item.title!.trim(),
          url: item.link!.trim(),
          summary: cleanSummary(item.contentSnippet ?? item.content ?? item.summary),
          publishedAt: item.isoDate
            ? new Date(item.isoDate)
            : item.pubDate
              ? new Date(item.pubDate)
              : undefined,
          author: item.creator ?? item.author,
        }))
        .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(800 * attempt);
    }
  }

  throw lastError;
}
