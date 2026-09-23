import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { AppEnv } from '../config/env.js';
import {
  categorySchema,
  sourceSchema,
  type NewsSource,
} from '../config/schema.js';
import {
  loadRules,
  loadSources,
  saveRules,
  saveSources,
} from '../config/load.js';
import { fetchSource } from '../feeds/fetcher.js';
import { runtimeSettingsSchema, SettingsStore } from '../control/settings.js';
import { EventLog } from '../control/events.js';
import { BrandStore } from '../control/brand-store.js';
import type { PollCycle, RuntimeStatus } from '../control/runtime.js';
import { StateStore } from '../storage/state.js';
import { InboxStore, type InboxItem } from '../storage/inbox.js';
import { DiscordPublisher } from '../discord/publisher.js';
import { BRAND } from '../brand.js';

const sourceInputSchema = sourceSchema.extend({
  id: sourceSchema.shape.id.optional(),
});

const logoInputSchema = z.object({
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  base64: z.string().min(1),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 45) || 'source';
}

function errorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

export interface DashboardDeps {
  env: AppEnv;
  settingsStore: SettingsStore;
  stateStore: StateStore;
  inboxStore: InboxStore;
  publishInboxItem: (id: string) => Promise<InboxItem>;
  rejectInboxItem: (id: string) => Promise<InboxItem>;
  brandStore: BrandStore;
  publisher: DiscordPublisher;
  events: EventLog;
  getStatus: () => RuntimeStatus;
  pollNow: () => Promise<PollCycle>;
  onSettingsChanged: () => void;
}

export function createDashboardApp(deps: DashboardDeps) {
  const app = express();
  const publicDir = path.resolve('public');
  const defaultLogoPng = path.join(publicDir, 'assets', 'newstech-logo.png');
  const defaultLogoSvg = path.join(publicDir, 'assets', 'newstech-logo.svg');

  app.disable('x-powered-by');
  app.use(express.json({ limit: '3mb' }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: https://cdn.discordapp.com https://media.discordapp.net; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    next();
  });

  const auth = (req: Request, res: Response, next: NextFunction) => {
    const token = deps.env.DASHBOARD_TOKEN;
    if (!token) return next();

    const supplied = req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const left = Buffer.from(supplied);
    const right = Buffer.from(token);
    const valid = left.length === right.length && crypto.timingSafeEqual(left, right);
    if (!valid) {
      res.status(401).json({ error: 'Dashboard authentication required.' });
      return;
    }
    next();
  };

  app.get('/health', (_req, res) => {
    res.json({ ok: true, product: BRAND.name });
  });

  app.get('/api/auth', (_req, res) => {
    res.json({ required: Boolean(deps.env.DASHBOARD_TOKEN) });
  });

  app.get('/api/brand/logo', async (_req, res) => {
    try {
      const custom = await deps.brandStore.get();
      if (custom) {
        res.setHeader('Content-Type', custom.mime);
        res.setHeader('Cache-Control', 'no-store');
        res.send(custom.data);
        return;
      }
      res.sendFile(defaultLogoSvg);
    } catch {
      res.sendFile(defaultLogoSvg);
    }
  });

  app.use('/api', auth);

  app.get('/api/bootstrap', async (_req, res) => {
    try {
      const [sources, rules, discord, customLogo] = await Promise.all([
        loadSources(deps.env.SOURCES_PATH),
        loadRules(deps.env.RULES_PATH),
        deps.publisher.inspect(),
        deps.brandStore.get(),
      ]);

      res.json({
        brand: BRAND,
        status: deps.getStatus(),
        settings: deps.settingsStore.get(),
        sources,
        rules,
        discord,
        seenCount: deps.stateStore.count(),
        inboxCounts: deps.inboxStore.counts(),
        events: deps.events.list(),
        customLogo: Boolean(customLogo),
        authRequired: Boolean(deps.env.DASHBOARD_TOKEN),
      });
    } catch (error) {
      res.status(500).json({ error: errorMessage(error) });
    }
  });

  app.get('/api/status', (_req, res) => {
    res.json({
      status: deps.getStatus(),
      settings: deps.settingsStore.get(),
      seenCount: deps.stateStore.count(),
      inboxCounts: deps.inboxStore.counts(),
      events: deps.events.list(30),
    });
  });

  app.get('/api/inbox', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ items: deps.inboxStore.list(), counts: deps.inboxStore.counts() });
  });

  const inboxId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid news item ID.');

  app.post('/api/inbox/:id/publish', async (req, res) => {
    try {
      const id = inboxId.parse(req.params.id);
      const item = await deps.publishInboxItem(id);
      res.json({ ok: true, item, counts: deps.inboxStore.counts() });
    } catch (error) {
      res.status(409).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/inbox/:id/reject', async (req, res) => {
    try {
      const id = inboxId.parse(req.params.id);
      const item = await deps.rejectInboxItem(id);
      res.json({ ok: true, item, counts: deps.inboxStore.counts() });
    } catch (error) {
      res.status(409).json({ error: errorMessage(error) });
    }
  });

  app.get('/api/discord', async (_req, res) => {
    try {
      res.json(await deps.publisher.inspect());
    } catch (error) {
      res.status(500).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/discord/test', async (req, res) => {
    try {
      const channelId = z.object({ channelId: z.string().optional() }).parse(req.body).channelId;
      await deps.publisher.sendTest(channelId);
      deps.events.add('success', 'Discord test message sent');
      res.json({ ok: true });
    } catch (error) {
      deps.events.add('error', 'Discord test failed', errorMessage(error));
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  app.get('/api/sources', async (_req, res) => {
    try {
      res.json(await loadSources(deps.env.SOURCES_PATH));
    } catch (error) {
      res.status(500).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/sources/test', async (req, res) => {
    try {
      const body = z.object({
        url: z.string().url(),
        category: categorySchema.optional().default('general-tech'),
      }).parse(req.body);

      const source: NewsSource = {
        id: 'test-source',
        name: 'Test source',
        url: body.url,
        category: body.category,
        trust: 70,
        enabled: false,
        official: false,
      };
      const articles = await fetchSource(source, 1);
      res.json({
        ok: true,
        count: articles.length,
        latest: articles[0]
          ? {
              title: articles[0].title,
              url: articles[0].url,
              publishedAt: articles[0].publishedAt,
            }
          : null,
      });
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/sources', async (req, res) => {
    try {
      const input = sourceInputSchema.parse(req.body);
      const current = await loadSources(deps.env.SOURCES_PATH);
      let id = input.id ?? slugify(input.name);
      let suffix = 2;
      while (current.some((source) => source.id === id)) id = `${slugify(input.name)}-${suffix++}`;

      const source = sourceSchema.parse({ ...input, id });
      const next = await saveSources(deps.env.SOURCES_PATH, [...current, source]);
      deps.events.add('success', `Source added: ${source.name}`);
      deps.onSettingsChanged();
      res.status(201).json(next);
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  app.put('/api/sources/:id', async (req, res) => {
    try {
      const current = await loadSources(deps.env.SOURCES_PATH);
      const index = current.findIndex((source) => source.id === req.params.id);
      if (index < 0) {
        res.status(404).json({ error: 'Source not found.' });
        return;
      }

      const updated = sourceSchema.parse({ ...current[index], ...req.body, id: req.params.id });
      current[index] = updated;
      const next = await saveSources(deps.env.SOURCES_PATH, current);
      deps.events.add('success', `Source updated: ${updated.name}`);
      deps.onSettingsChanged();
      res.json(next);
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  app.delete('/api/sources/:id', async (req, res) => {
    try {
      const current = await loadSources(deps.env.SOURCES_PATH);
      const source = current.find((item) => item.id === req.params.id);
      if (!source) {
        res.status(404).json({ error: 'Source not found.' });
        return;
      }
      const next = await saveSources(
        deps.env.SOURCES_PATH,
        current.filter((item) => item.id !== req.params.id),
      );
      deps.events.add('warning', `Source deleted: ${source.name}`);
      deps.onSettingsChanged();
      res.json(next);
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  app.get('/api/rules', async (_req, res) => {
    try {
      res.json(await loadRules(deps.env.RULES_PATH));
    } catch (error) {
      res.status(500).json({ error: errorMessage(error) });
    }
  });

  app.put('/api/rules', async (req, res) => {
    try {
      const saved = await saveRules(deps.env.RULES_PATH, req.body);
      deps.events.add('success', 'News filters updated');
      res.json(saved);
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  app.put('/api/settings', async (req, res) => {
    try {
      const next = runtimeSettingsSchema.parse(req.body);
      await deps.publisher.validateSettingsChannels(next);
      const saved = await deps.settingsStore.replace(next);
      deps.onSettingsChanged();
      deps.events.add('success', 'Runtime settings updated');
      res.json(saved);
    } catch (error) {
      deps.events.add('error', 'Settings update rejected', errorMessage(error));
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/actions/poll', async (_req, res) => {
    try {
      const cycle = await deps.pollNow();
      res.json(cycle);
    } catch (error) {
      res.status(500).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/actions/pause', async (_req, res) => {
    const settings = await deps.settingsStore.patch({ paused: true });
    deps.onSettingsChanged();
    deps.events.add('warning', 'News collection paused from dashboard');
    res.json(settings);
  });

  app.post('/api/actions/resume', async (_req, res) => {
    const settings = await deps.settingsStore.patch({ paused: false });
    deps.onSettingsChanged();
    deps.events.add('success', 'News collection resumed from dashboard');
    res.json(settings);
  });

  app.post('/api/actions/clear-history', async (_req, res) => {
    try {
      await deps.stateStore.clear();
      deps.events.add('warning', 'Duplicate history cleared');
      res.json({ ok: true, seenCount: 0 });
    } catch (error) {
      res.status(500).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/brand/logo', async (req, res) => {
    try {
      const input = logoInputSchema.parse(req.body);
      const logo = await deps.brandStore.save(input.mime, input.base64);
      deps.events.add('success', 'Custom NewsTech logo uploaded');
      res.json({ ok: true, bytes: logo.data.length });
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  app.delete('/api/brand/logo', async (_req, res) => {
    try {
      await deps.brandStore.clear();
      deps.events.add('warning', 'Custom logo reset to NewsTech default');
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/brand/apply', async (_req, res) => {
    try {
      const custom = await deps.brandStore.get();
      const logo = custom?.data ?? await fs.readFile(defaultLogoPng);
      const identity = await deps.publisher.applyIdentity(logo);
      deps.events.add('success', 'NewsTech name and logo applied to Discord bot');
      res.json(identity);
    } catch (error) {
      deps.events.add('error', 'Could not apply Discord identity', errorMessage(error));
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Unknown NewsTech API endpoint.' });
  });

  app.use(express.static(publicDir, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

  return app;
}

export async function startDashboard(deps: DashboardDeps) {
  if (!deps.env.DASHBOARD_ENABLED) return null;

  const app = createDashboardApp(deps);
  const server = app.listen(deps.env.DASHBOARD_PORT, deps.env.DASHBOARD_HOST, () => {
    console.log(
      `[NewsTech] Dashboard: http://${deps.env.DASHBOARD_HOST}:${deps.env.DASHBOARD_PORT}`,
    );
    deps.events.add('success', `Dashboard started on ${deps.env.DASHBOARD_HOST}:${deps.env.DASHBOARD_PORT}`);
  });

  return server;
}
