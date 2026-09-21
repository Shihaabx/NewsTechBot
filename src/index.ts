import 'dotenv/config';
import path from 'node:path';
import { loadRules, loadSources } from './config/load.js';
import { loadEnv } from './config/env.js';
import { fetchSource } from './feeds/fetcher.js';
import { scoreArticle } from './core/scorer.js';
import { StateStore } from './storage/state.js';
import { DiscordPublisher } from './discord/publisher.js';
import { attachInteractionHandler } from './discord/commands.js';
import { BRAND } from './brand.js';
import { SettingsStore, defaultsFromEnv } from './control/settings.js';
import { EventLog } from './control/events.js';
import { BrandStore } from './control/brand-store.js';
import type { PollCycle, RuntimeStatus } from './control/runtime.js';
import { startDashboard } from './dashboard/server.js';

const env = loadEnv();
const settingsStore = new SettingsStore(
  path.resolve(env.SETTINGS_PATH),
  defaultsFromEnv(env),
);
const stateStore = new StateStore(path.resolve(env.DATA_PATH));
const brandStore = new BrandStore(path.resolve(env.BRAND_LOGO_PATH));
const events = new EventLog();
const publisher = new DiscordPublisher(env, settingsStore);

let running = false;
let timer: NodeJS.Timeout | undefined;

const status: RuntimeStatus = {
  startedAt: new Date().toISOString(),
  enabledSources: 0,
  fetched: 0,
  published: 0,
  filtered: 0,
  duplicates: 0,
  failedSources: 0,
  running: false,
};

function isTooOld(date: Date | undefined, maxAgeHours: number) {
  if (!date || Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() > maxAgeHours * 3_600_000;
}

async function poll(force = false): Promise<PollCycle> {
  const startedAt = new Date();
  const settings = settingsStore.get();

  if (running) {
    return {
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      fetched: 0,
      published: 0,
      filtered: 0,
      duplicates: 0,
      failedSources: 0,
      skipped: 'already-running',
    };
  }

  if (settings.paused && !force) {
    return {
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      fetched: 0,
      published: 0,
      filtered: 0,
      duplicates: 0,
      failedSources: 0,
      skipped: 'paused',
    };
  }

  running = true;
  status.running = true;
  const cycle = {
    fetched: 0,
    published: 0,
    filtered: 0,
    duplicates: 0,
    failedSources: 0,
  };

  try {
    const [sources, rules] = await Promise.all([
      loadSources(env.SOURCES_PATH),
      loadRules(env.RULES_PATH),
    ]);

    const enabled = sources.filter((source) => source.enabled);
    status.enabledSources = enabled.length;

    for (const source of enabled) {
      try {
        const articles = await fetchSource(source);

        for (const raw of articles.slice(0, settings.maxItemsPerSource)) {
          cycle.fetched += 1;
          const article = scoreArticle(raw, rules);

          if (stateStore.has(article.fingerprint)) {
            cycle.duplicates += 1;
            continue;
          }

          if (
            isTooOld(article.publishedAt, settings.maxArticleAgeHours)
            || article.blocked
            || article.score < settings.newsMinScore
          ) {
            cycle.filtered += 1;
            await stateStore.mark(article.fingerprint, article.title, article.url);
            continue;
          }

          const published = await publisher.publish(article);
          if (published) {
            cycle.published += 1;
            await stateStore.mark(article.fingerprint, article.title, article.url);
          }
        }
      } catch (error) {
        cycle.failedSources += 1;
        const detail = error instanceof Error ? error.message : String(error);
        console.error(`[NewsTech:${source.id}] Feed failed`, error);
        events.add('error', `Feed failed: ${source.name}`, detail);
      }
    }
  } finally {
    const completedAt = new Date();
    status.lastPollAt = completedAt.toISOString();
    status.lastPollDurationMs = completedAt.getTime() - startedAt.getTime();
    status.fetched = cycle.fetched;
    status.published = cycle.published;
    status.filtered = cycle.filtered;
    status.duplicates = cycle.duplicates;
    status.failedSources = cycle.failedSources;
    status.running = false;
    running = false;

    const level = cycle.failedSources > 0 ? 'warning' : 'success';
    events.add(
      level,
      `Poll finished: ${cycle.published} published`,
      `${cycle.fetched} fetched • ${cycle.filtered} filtered • ${cycle.duplicates} duplicates • ${cycle.failedSources} source failures`,
    );
  }

  return {
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: status.lastPollDurationMs ?? 0,
    ...cycle,
  };
}

function scheduleNext() {
  if (timer) clearTimeout(timer);
  const minutes = settingsStore.get().pollIntervalMinutes;
  timer = setTimeout(async () => {
    await poll(false);
    scheduleNext();
  }, minutes * 60_000);
}

async function refreshSourceCount() {
  try {
    const sources = await loadSources(env.SOURCES_PATH);
    status.enabledSources = sources.filter((source) => source.enabled).length;
  } catch {}
}

async function main() {
  await Promise.all([
    settingsStore.load(),
    stateStore.load(),
  ]);

  await refreshSourceCount();
  await publisher.start();
  attachInteractionHandler(publisher.client, settingsStore);

  events.add('success', 'Discord bot connected', publisher.client.user?.tag);
  console.log(
    `[${BRAND.name}] ${BRAND.workspace} online. Polling every ${settingsStore.get().pollIntervalMinutes} minutes.`,
  );

  await startDashboard({
    env,
    settingsStore,
    stateStore,
    brandStore,
    publisher,
    events,
    getStatus: () => ({ ...status }),
    pollNow: () => poll(true),
    onSettingsChanged: () => {
      scheduleNext();
      void refreshSourceCount();
    },
  });

  if (!settingsStore.get().paused) {
    await poll(false);
  }
  scheduleNext();
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (timer) clearTimeout(timer);
  console.log(`[NewsTech] ${signal} received. Shutting down.`);
  await publisher.stop();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((error) => {
  console.error('[NewsTech] Fatal startup error', error);
  process.exit(1);
});
