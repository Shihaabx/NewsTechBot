import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDashboardApp } from '../src/dashboard/server.js';
import { SettingsStore } from '../src/control/settings.js';
import { StateStore } from '../src/storage/state.js';
import { InboxStore } from '../src/storage/inbox.js';
import { BrandStore } from '../src/control/brand-store.js';
import { EventLog } from '../src/control/events.js';

describe('NewsTech dashboard API', () => {
  let tempDir = '';
  let app: ReturnType<typeof createDashboardApp>;
  let settingsStore: SettingsStore;
  let stateStore: StateStore;
  let inboxStore: InboxStore;
  let brandStore: BrandStore;
  let sendTest: ReturnType<typeof vi.fn>;
  let applyIdentity: ReturnType<typeof vi.fn>;
  let validateSettingsChannels: ReturnType<typeof vi.fn>;
  let publishInboxItem: ReturnType<typeof vi.fn>;
  let rejectInboxItem: ReturnType<typeof vi.fn>;
  const auth = { Authorization: 'Bearer integration-test-token' };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'newstech-dashboard-'));
    const sourcesPath = path.join(tempDir, 'sources.yml');
    const rulesPath = path.join(tempDir, 'rules.yml');
    const settingsPath = path.join(tempDir, 'settings.json');
    const statePath = path.join(tempDir, 'state.json');
    const inboxPath = path.join(tempDir, 'inbox.json');
    const logoPath = path.join(tempDir, 'brand-logo.json');

    await fs.writeFile(sourcesPath, 'sources: []\n', 'utf8');
    await fs.writeFile(
      rulesPath,
      [
        'blocked_topics: []',
        'high_value_terms: []',
        'breaking_terms: []',
        'low_value_terms: []',
        'categories: {}',
        '',
      ].join('\n'),
      'utf8',
    );

    settingsStore = new SettingsStore(settingsPath, {
      paused: false,
      dryRun: false,
      reviewBeforePublish: true,
      allowedUserIds: [],
      pollIntervalMinutes: 10,
      maxItemsPerSource: 15,
      maxArticleAgeHours: 72,
      newsMinScore: 58,
      breakingMinScore: 82,
      channels: {},
    });
    stateStore = new StateStore(statePath);
    inboxStore = new InboxStore(inboxPath);
    brandStore = new BrandStore(logoPath);
    await Promise.all([settingsStore.load(), stateStore.load(), inboxStore.load()]);

    sendTest = vi.fn(async () => undefined);
    applyIdentity = vi.fn(async () => ({
      username: 'NewsTech',
      avatarUrl: '/assets/newstech-logo.svg',
    }));
    validateSettingsChannels = vi.fn(async () => []);
    publishInboxItem = vi.fn(async (id: string) => {
      await inboxStore.setStatus(id, 'published');
      return inboxStore.get(id);
    });
    rejectInboxItem = vi.fn(async (id: string) => {
      await inboxStore.setStatus(id, 'rejected');
      return inboxStore.get(id);
    });

    const publisher = {
      inspect: vi.fn(async () => ({
        bot: { id: '999999999999999', username: 'NewsTech', avatarUrl: '/assets/newstech-logo.svg' },
        guild: { id: '888888888888888', name: 'Juraa Newsroom', iconUrl: null },
        channels: [],
      })),
      validateSettingsChannels,
      sendTest,
      applyIdentity,
    };

    const env = {
      DASHBOARD_ENABLED: true,
      DASHBOARD_HOST: '127.0.0.1',
      DASHBOARD_PORT: 8787,
      DASHBOARD_TOKEN: 'integration-test-token',
      SOURCES_PATH: sourcesPath,
      RULES_PATH: rulesPath,
    };

    app = createDashboardApp({
      env: env as any,
      settingsStore,
      stateStore,
      inboxStore,
      publishInboxItem,
      rejectInboxItem,
      brandStore,
      publisher: publisher as any,
      events: new EventLog(),
      getStatus: () => ({
        startedAt: new Date().toISOString(),
        enabledSources: 0,
        fetched: 0,
        published: 0,
        filtered: 0,
        duplicates: 0,
        failedSources: 0,
        running: false,
      }),
      pollNow: async () => ({
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 25,
        fetched: 4,
        published: 1,
        filtered: 2,
        duplicates: 1,
        failedSources: 0,
      }),
      onSettingsChanged: vi.fn(),
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('protects the API while keeping health and logo reachable', async () => {
    await request(app).get('/health').expect(200);
    await request(app).get('/api/brand/logo').expect(200);
    await request(app).get('/api/bootstrap').expect(401);

    const response = await request(app).get('/api/bootstrap').set(auth).expect(200);
    expect(response.body.brand.name).toBe('NewsTech');
  });

  it('supports the full source lifecycle', async () => {
    const created = await request(app)
      .post('/api/sources')
      .set(auth)
      .send({
        name: 'Test Feed',
        url: 'https://example.com/feed.xml',
        category: 'general-tech',
        trust: 75,
        enabled: true,
        official: false,
      })
      .expect(201);

    expect(created.body).toHaveLength(1);
    expect(created.body[0].id).toBe('test-feed');

    const updated = await request(app)
      .put('/api/sources/test-feed')
      .set(auth)
      .send({ trust: 91, enabled: false })
      .expect(200);

    expect(updated.body[0].trust).toBe(91);
    expect(updated.body[0].enabled).toBe(false);

    const deleted = await request(app)
      .delete('/api/sources/test-feed')
      .set(auth)
      .expect(200);

    expect(deleted.body).toEqual([]);
  });

  it('saves rules and runtime settings with validation', async () => {
    const rules = {
      blocked_topics: ['phone'],
      high_value_terms: ['release'],
      breaking_terms: ['zero-day'],
      low_value_terms: ['giveaway'],
      categories: {
        ai: { terms: ['openai'] },
      },
    };

    const rulesResponse = await request(app)
      .put('/api/rules')
      .set(auth)
      .send(rules)
      .expect(200);

    expect(rulesResponse.body.blocked_topics).toEqual(['phone']);

    const settings = {
      ...settingsStore.get(),
      dryRun: true,
      allowedUserIds: ['666666666666666'],
      pollIntervalMinutes: 7,
      newsMinScore: 62,
      breakingMinScore: 86,
      channels: { incoming: '333333333333333' },
    };

    const saved = await request(app)
      .put('/api/settings')
      .set(auth)
      .send(settings)
      .expect(200);

    expect(saved.body.dryRun).toBe(true);
    expect(saved.body.pollIntervalMinutes).toBe(7);
    expect(validateSettingsChannels).toHaveBeenCalledOnce();

    await request(app)
      .put('/api/settings')
      .set(auth)
      .send({ ...settings, newsMinScore: 90, breakingMinScore: 80 })
      .expect(400);
  });

  it('runs dashboard actions and Discord checks', async () => {
    await request(app).post('/api/actions/pause').set(auth).expect(200);
    expect(settingsStore.get().paused).toBe(true);

    await request(app).post('/api/actions/resume').set(auth).expect(200);
    expect(settingsStore.get().paused).toBe(false);

    const poll = await request(app).post('/api/actions/poll').set(auth).expect(200);
    expect(poll.body.published).toBe(1);

    await request(app).post('/api/discord/test').set(auth).send({}).expect(200);
    expect(sendTest).toHaveBeenCalledOnce();

    await stateStore.mark('abc', 'Title', 'https://example.com/a');
    expect(stateStore.count()).toBe(1);
    await request(app).post('/api/actions/clear-history').set(auth).expect(200);
    expect(stateStore.count()).toBe(0);
  });

  it('validates logo uploads and can apply/reset identity', async () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZL6kAAAAASUVORK5CYII=';

    await request(app)
      .post('/api/brand/logo')
      .set(auth)
      .send({ mime: 'image/png', base64: png })
      .expect(200);

    expect(await brandStore.get()).not.toBeNull();

    await request(app)
      .post('/api/brand/logo')
      .set(auth)
      .send({ mime: 'image/png', base64: Buffer.from('not-png').toString('base64') })
      .expect(400);

    await request(app).post('/api/brand/apply').set(auth).expect(200);
    expect(applyIdentity).toHaveBeenCalledOnce();

    await request(app).delete('/api/brand/logo').set(auth).expect(200);
    expect(await brandStore.get()).toBeNull();
  });

  it('secures the inbox and supports publishing and rejecting reviewed stories', async () => {
    const sample = (id: string, title: string) => ({
      source: {
        id: 'official-source', name: 'Official source', url: 'https://example.com/feed.xml',
        category: 'ai' as const, trust: 100, enabled: true, official: true,
      },
      title, url: 'https://example.com/' + id, summary: 'An important product announcement',
      publishedAt: new Date(), category: 'ai' as const, score: 85,
      breaking: false, blocked: false, reasons: ['official-source'], fingerprint: id,
    });
    const publishId = 'a'.repeat(24);
    const rejectId = 'b'.repeat(24);
    await inboxStore.upsert(sample(publishId, 'First news'), 'pending');
    await inboxStore.upsert(sample(rejectId, 'Second news'), 'pending');

    await request(app).get('/api/inbox').expect(401);
    const inbox = await request(app).get('/api/inbox').set(auth).expect(200);
    expect(inbox.body.items).toHaveLength(2);
    expect(inbox.body.counts.pending).toBe(2);

    await request(app).post('/api/inbox/' + publishId + '/publish').expect(401);
    const publish = await request(app).post('/api/inbox/' + publishId + '/publish').set(auth).expect(200);
    expect(publish.body.item.status).toBe('published');
    expect(publishInboxItem).toHaveBeenCalledWith(publishId);

    const reject = await request(app).post('/api/inbox/' + rejectId + '/reject').set(auth).expect(200);
    expect(reject.body.item.status).toBe('rejected');
    expect(rejectInboxItem).toHaveBeenCalledWith(rejectId);

    await request(app).post('/api/inbox/not-an-id/publish').set(auth).expect(409);
    const final = await request(app).get('/api/inbox').set(auth).expect(200);
    expect(final.body.counts).toEqual({ pending: 0, filtered: 0, rejected: 1, published: 1 });
  });

  it('returns JSON for unknown API routes', async () => {
    const response = await request(app).get('/api/not-real').set(auth).expect(404);
    expect(response.body.error).toContain('Unknown NewsTech API endpoint');
  });
});
