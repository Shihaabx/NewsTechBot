import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { InboxStore } from '../src/storage/inbox.js';

const makeArticle = (id: string) => ({
  source: {
    id: 'nvidia', name: 'NVIDIA', url: 'https://example.com/feed',
    category: 'pc-hardware' as const, enabled: true, official: true, trust: 100,
  },
  title: 'RTX launches with new architecture',
  url: 'https://example.com/news/' + id,
  summary: 'Official hardware announcement',
  publishedAt: new Date('2026-09-22T15:00:00Z'),
  category: 'pc-hardware' as const,
  score: 88, breaking: false, blocked: false,
  reasons: ['official-source', 'tech-signals:2'], fingerprint: id,
});

describe('InboxStore', () => {
  it('persists manual-review decisions and reloads publication dates', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'newstech-inbox-'));
    try {
      const file = path.join(dir, 'inbox.json');
      const store = new InboxStore(file);
      await store.load();
      const first = 'a'.repeat(24);
      const second = 'b'.repeat(24);
      await store.upsert(makeArticle(first), 'pending');
      await store.upsert(makeArticle(second), 'filtered', ['below-publish-threshold']);
      await store.upsert(makeArticle(first), 'pending');
      expect(store.list()).toHaveLength(2);
      expect(store.counts()).toEqual({ pending: 1, filtered: 1, rejected: 0, published: 0 });
      expect(await store.setStatus(first, 'rejected')).toBe(true);
      expect(await store.setStatus(first, 'published')).toBe(false);

      const reloaded = new InboxStore(file);
      await reloaded.load();
      expect(reloaded.get(first)?.status).toBe('rejected');
      expect(reloaded.get(second)?.reasons).toContain('below-publish-threshold');
      expect(reloaded.get(first)?.article.publishedAt).toBeInstanceOf(Date);
      expect(reloaded.counts()).toEqual({ pending: 0, filtered: 1, rejected: 1, published: 0 });
    } finally {
      await fs.rm(dir, {recursive: true, force: true});
    }
  });

  it('backs up a damaged inbox rather than overwriting it silently', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'newstech-inbox-'));
    try {
      const file = path.join(dir, 'inbox.json');
      await fs.writeFile(file, 'broken json', 'utf8');
      const store = new InboxStore(file);
      await store.load();
      expect(store.list()).toEqual([]);
      expect((await fs.readdir(dir)).some((name) => name.startsWith('inbox.json.corrupt-'))).toBe(true);
    } finally {
      await fs.rm(dir, {recursive: true, force: true});
    }
  });
});
