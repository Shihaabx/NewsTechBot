import fs from 'node:fs/promises';
import path from 'node:path';
import type { ScoredArticle } from '../core/types.js';

export type InboxStatus = 'pending' | 'filtered' | 'rejected' | 'published';

export interface InboxItem {
  id: string;
  article: ScoredArticle;
  status: InboxStatus;
  reasons: string[];
  receivedAt: string;
  updatedAt: string;
}

interface InboxFile {
  items: Record<string, InboxItem>;
}

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 500;

export class InboxStore {
  private data: InboxFile = { items: {} };
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as InboxFile;
      if (!parsed || !parsed.items || typeof parsed.items !== 'object' || Array.isArray(parsed.items)) {
        throw new Error('Invalid inbox structure');
      }
      this.data = { items: {} };
      for (const [id, item] of Object.entries(parsed.items)) {
        if (!/^[a-f0-9]{24}$/.test(id) || !item?.article || item.id !== id) continue;
        if (!['pending', 'filtered', 'rejected', 'published'].includes(item.status)) continue;
        if (!item.article.fingerprint || item.article.fingerprint !== id) continue;
        this.data.items[id] = {
          ...item,
          article: {
            ...item.article,
            publishedAt: item.article.publishedAt ? new Date(String(item.article.publishedAt)) : undefined,
          },
        };
      }
      this.prune();
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        const backup = this.filePath + '.corrupt-' + Date.now() + '.json';
        await fs.rename(this.filePath, backup);
        console.error('[NewsTech] Invalid inbox backed up:', backup, error);
      }
      this.data = { items: {} };
      await this.save();
    }
  }

  get(id: string): InboxItem | undefined {
    const item = this.data.items[id];
    return item ? structuredClone(item) : undefined;
  }

  list(): InboxItem[] {
    return Object.values(this.data.items)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .map((item) => structuredClone(item));
  }

  counts() {
    const counts = { pending: 0, filtered: 0, rejected: 0, published: 0 };
    for (const item of Object.values(this.data.items)) counts[item.status] += 1;
    return counts;
  }

  async upsert(article: ScoredArticle, status: 'pending' | 'filtered', extraReasons: string[] = []) {
    const existing = this.data.items[article.fingerprint];
    if (existing) return this.get(article.fingerprint)!;
    const now = new Date().toISOString();
    this.data.items[article.fingerprint] = {
      id: article.fingerprint,
      article: structuredClone(article),
      status,
      reasons: [...article.reasons, ...extraReasons],
      receivedAt: now,
      updatedAt: now,
    };
    this.prune();
    await this.save();
    return this.get(article.fingerprint)!;
  }

  async setStatus(id: string, status: 'rejected' | 'published') {
    const item = this.data.items[id];
    if (!item || item.status !== 'pending') return false;
    item.status = status;
    item.updatedAt = new Date().toISOString();
    await this.save();
    return true;
  }

  private prune() {
    const cutoff = Date.now() - RETENTION_MS;
    const entries = Object.entries(this.data.items)
      .filter(([, item]) => Number.isFinite(Date.parse(item.receivedAt)) && Date.parse(item.receivedAt) >= cutoff)
      .sort((a, b) => b[1].receivedAt.localeCompare(a[1].receivedAt))
      .slice(0, MAX_ITEMS);
    this.data.items = Object.fromEntries(entries);
  }

  private async save() {
    const snapshot = JSON.stringify(this.data, null, 2);
    const write = this.writes.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temp = this.filePath + '.tmp';
      await fs.writeFile(temp, snapshot, 'utf8');
      await fs.rename(temp, this.filePath);
    });
    this.writes = write.catch(() => undefined);
    await write;
  }
}
