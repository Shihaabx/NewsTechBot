import Parser from 'rss-parser';
import type { NewsSource } from '../config/schema.js';
import type { RawArticle } from '../core/types.js';

const parser = new Parser({ timeout: 15_000, headers: { 'User-Agent': 'NewsTechBot/0.1 (+Juraa Tech)' } });

export async function fetchSource(source: NewsSource): Promise<RawArticle[]> {
  const feed = await parser.parseURL(source.url);
  return feed.items
    .filter((item) => item.title && item.link)
    .map((item) => ({
      source,
      title: item.title!.trim(),
      url: item.link!.trim(),
      summary: String(item.contentSnippet ?? item.content ?? item.summary ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200),
      publishedAt: item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : undefined,
      author: item.creator ?? item.author,
    }));
}
